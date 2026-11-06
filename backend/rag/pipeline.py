"""
rag/pipeline.py

DGMS Copilot — Full RAG Pipeline (Production Edition)

Pipeline:
  Question
  → Intent Classification (rule-based hybrid)
  → Conversation Context Assembly
  → Hinglish Normalization (retrieval query only)
  → Hybrid Search (Vector + BM25, with embedding cache)
  → Source Prioritization + Deduplication
  → LLM Prompt Construction
  → Streaming / Non-streaming Generation
  → Output Cleaning + Citations
  → RAGResponse

Key improvements vs. v1:
  - Intent classifier short-circuits non-DGMS queries (greetings, smalltalk, general)
  - General knowledge answered by LLM without RAG overhead
  - Conversation memory: last 3 turns injected as context
  - Hinglish queries normalized before embedding
  - Embedding LRU cache (200 entries) eliminates re-embedding
  - BM25 index merged with vector scores (70/30 weighting)
  - Pre-normalized vector matrix for batched cosine similarity
  - Streaming endpoint via generate_stream()
  - Prompt compressed: 380 chars/chunk, 180 num_predict
  - Analytics: timing logged per stage
"""

from __future__ import annotations
import os
import re
import time
import logging
import concurrent.futures
from dataclasses import dataclass
from typing import Iterator

from vectorstore.sqlite_store import SQLiteStore, SearchResult
from citations.formatter import build_citations, Citation
from llm.provider import get_llm_provider
from rag.intent_classifier import (
    Intent, classify_intent, get_canned_response
)
from rag.hinglish_normalizer import normalize_hinglish
from rag.embedding_cache import get_query_cache, get_vector_cache
from rag.bm25_index import get_bm25_index, merge_scores

# Module-level executor for LLM generation with timeout.
_llm_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="llm")

logger = logging.getLogger(__name__)

# Retrieve top-k for citations, send top-3 to LLM
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "6"))
LLM_TOP_K = 3
LLM_CHUNK_MAX_CHARS = 380   # Compressed from 500 → saves ~36 tokens/chunk

SCORE_THRESHOLD = float(os.getenv("RETRIEVAL_SCORE_THRESHOLD", "0.25"))
LLM_GENERATION_TIMEOUT = float(os.getenv("LLM_GENERATION_TIMEOUT", "60.0"))
NOT_FOUND_THRESHOLD = 0.20

NOT_FOUND_RESPONSE = (
    "I couldn't find enough information in the uploaded DGMS documents to answer this question. "
    "Please consult your mine's safety officer or visit the DGMS official website for guidance."
)

NOT_FOUND_RESPONSE_HI = (
    "मुझे इस प्रश्न के लिए अपलोड किए गए DGMS दस्तावेज़ों में पर्याप्त जानकारी नहीं मिली। "
    "कृपया अपनी खदान के सुरक्षा अधिकारी से परामर्श करें या DGMS की आधिकारिक वेबसाइट पर जाएं।"
)

# ── System prompts ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT_COMPLIANCE = """You are an experienced mine safety officer giving on-the-job advice. Answer questions in a friendly, conversational tone. Do NOT use textbook language or formal bureaucratic phrases.

═══ LANGUAGE — ABSOLUTE RULE ═══
The UI language is: {language}

IF language == "hi":
  • Write EVERY SINGLE WORD in Hindi (Devanagari script). No exceptions.
  • Section headings: **मुख्य बिंदु** and **व्यावहारिक सुझाव**
  • The word "Practical Tip" is FORBIDDEN. Use **व्यावहारिक सुझाव** instead.
  • The word "Key Points" is FORBIDDEN. Use **मुख्य बिंदु** instead.
  • Only official IDs like "DGMS-CIR-2024-17" or "CMR 2017" may appear in Latin script.
  • Any English sentence in a Hindi response is a critical failure.

IF language == "en":
  • Write EVERY SINGLE WORD in English. No Hindi words.
  • Section headings: **Key Points** and **Practical Tip**
  • Any Hindi (Devanagari) character in an English response is a critical failure.

═══ FORMAT ═══
IF language == "en":
  - Direct answer (1-3 complete sentences).
  - **Key Points**: 2-3 complete bullet points, each starting with '- '. Every bullet MUST be a complete sentence ending with a period.
  - End with **Practical Tip**: one complete actionable sentence ending with a period.
  - Bold important numbers, limits, distances.
  - Complete all sentences fully. NEVER leave any bullet point or sentence unfinished.

IF language == "hi":
  - सीधा उत्तर (1-3 पूर्ण वाक्य, पूरी तरह हिंदी देवनागरी लिपि में)।
  - **मुख्य बिंदु**: 2-3 पूर्ण बुलेट बिंदु, प्रत्येक '- ' से शुरू। हर बुलेट एक पूर्ण वाक्य होना चाहिए जो पूर्ण विराम (।) पर समाप्त हो।
  - अंत में **व्यावहारिक सुझाव**: एक पूर्ण व्यावहारिक वाक्य जो पूर्ण विराम (।) पर समाप्त हो।
  - महत्वपूर्ण संख्या, सीमाएं बोल्ड करें।
  - सभी वाक्यों को पूरा करें। किसी भी वाक्य या बुलेट बिंदु को आधा न छोड़ें।

NEVER add "Sources Used", "References", or similar sections.
NEVER copy document text verbatim or dump section numbers.

{conversation_context}CONTEXT:
{context}

QUESTION: {question}

Answer:"""


SYSTEM_PROMPT_GENERAL = """You are DGMS Copilot, a helpful AI assistant for mining safety officers at Central Coalfields Limited. Answer both mining compliance questions and general knowledge questions naturally.

LANGUAGE RULE: The UI language is {language}.
IF language == "hi": Write EVERYTHING in Hindi (Devanagari script). No English sentences allowed. "Practical Tip" is FORBIDDEN — use "व्यावहारिक सुझाव" instead.
IF language == "en": Write EVERYTHING in English. No Hindi words allowed.

If it relates to mining safety or DGMS regulations, mention that you can provide more specific guidance with document citations.
Write in clear, complete sentences. ALWAYS finish all sentences completely with a full stop (. or ।).

{conversation_context}QUESTION: {question}

Answer:"""

# ── Singleton store ────────────────────────────────────────────────────────────
_store: SQLiteStore | None = None


def _get_store() -> SQLiteStore:
    global _store
    if _store is None:
        _store = SQLiteStore()
    return _store


def _ensure_indexes_loaded() -> None:
    """Ensure BM25 and vector matrix caches are loaded."""
    bm25 = get_bm25_index()
    vec_cache = get_vector_cache()

    if not bm25.is_built or not vec_cache.is_loaded:
        store = _get_store()
        _rebuild_indexes(store)


def _rebuild_indexes(store: SQLiteStore) -> None:
    """Rebuild BM25 and vector matrix from the current store contents."""
    import sqlite3
    bm25 = get_bm25_index()
    vec_cache = get_vector_cache()

    try:
        with store._connect() as conn:
            rows = conn.execute(
                "SELECT id, content, vector FROM chunks"
            ).fetchall()

        if not rows:
            return

        # Build BM25
        bm25_chunks = [(r["id"], r["content"]) for r in rows]
        bm25.build(bm25_chunks)

        # Build vector matrix — need dim from first embedding
        first_vec = rows[0]["vector"]
        if first_vec:
            import numpy as np
            dim = len(np.frombuffer(first_vec, dtype=np.float32))
            vec_cache.load([(r["id"], r["vector"], dim) for r in rows if r["vector"]])

        logger.info("Indexes rebuilt: %d chunks.", len(rows))
    except Exception as e:
        logger.error("Index rebuild failed: %s", e)


# ── Response dataclass ─────────────────────────────────────────────────────────

@dataclass
class RAGResponse:
    answer: str
    citations: list[Citation]
    chunks_used: int
    model_used: str
    retrieved_scores: list[float]
    intent: str = "COMPLIANCE"


# ── Helper functions ────────────────────────────────────────────────────────────

def _deduplicate_chunks(results: list[SearchResult]) -> list[SearchResult]:
    seen_content = set()
    unique = []
    for result in results:
        norm = re.sub(r'\s+', ' ', result.content.strip()).lower()
        if norm not in seen_content:
            seen_content.add(norm)
            unique.append(result)
    return sorted(unique, key=lambda r: r.score, reverse=True)


def _build_context(results: list[SearchResult], max_chars: int | None = None) -> str:
    if not results:
        return "No relevant document passages were retrieved."
    parts = []
    for i, result in enumerate(results, 1):
        passage = result.content
        if max_chars is not None and len(passage) > max_chars:
            passage = passage[:max_chars] + "…"
        passage = re.sub(r'^\s*\d+(?:\.\d+)*\s*', '', passage).strip()
        parts.append(f"[{i}] From: {result.title}\n    {passage}\n")
    return "\n".join(parts)


def _build_conversation_context(history: list[dict] | None) -> str:
    """Format the last 3 conversation turns as context for the LLM."""
    if not history or len(history) < 2:
        return ""
    # Take last 3 complete turns (user + assistant pairs)
    recent = history[-6:]  # last 3 pairs = 6 messages
    lines = ["CONVERSATION HISTORY:"]
    for msg in recent:
        role = "User" if msg.get("role") == "user" else "Assistant"
        content = msg.get("content", "")[:200]  # Cap each history message
        lines.append(f"{role}: {content}")
    lines.append("")  # blank line separator
    return "\n".join(lines) + "\n"


def _clean_llm_output(text: str, language: str = "en") -> str:
    """Remove think blocks, stray headings, and source sections. Localize section headers."""
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(
        r'\n*\*{0,2}(Sources?|References?|Source Documents?|DGMS References?)\*{0,2}(?::)?\s*\n?.*',
        '', text, flags=re.DOTALL | re.IGNORECASE
    )
    text = re.sub(r'^#{1,4}\s+(?!(Key Points|Practical Tip|मुख्य बिंदु)).+$', '', text, flags=re.MULTILINE)
    text = text.replace('/no_think', '').strip()
    text = re.sub(r'^[ \t]*[-*][ \t]*$', '', text, flags=re.MULTILINE)
    text = re.sub(
        r'(?i)(?:^[ \t]*[-*][ \t]*)?\s*(?:\*\*)?Practical Tip[^A-Za-z0-9]*(?:\*\*)?\s*',
        '\n\n> ',
        text,
        flags=re.MULTILINE
    )
    text = re.sub(r'\n{3,}', '\n\n', text)

    lines = text.split('\n')
    seen_lines: set[str] = set()
    deduped = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            deduped.append(line)
            continue
        norm = re.sub(r'[^\w\s]', '', stripped.lower())
        if norm and norm in seen_lines and stripped.startswith(('- ', '* ')):
            continue
        if norm and stripped.startswith(('- ', '* ')):
            seen_lines.add(norm)
    cleaned = '\n'.join(deduped).strip()
    if cleaned and not (cleaned[-1] in '.!?।|\n' or cleaned.endswith('**') or cleaned.endswith('```')):
        match = re.search(r'^(.*[.!?।|\n])\s*[^.!?।|\n]*$', cleaned, re.DOTALL)
        if match and len(match.group(1).strip()) > 30:
            cleaned = match.group(1).strip()
        else:
            cleaned = cleaned.rstrip() + ("।" if any('\u0900' <= c <= '\u097F' for c in cleaned) else ".")
    return cleaned


def _source_priority(r: SearchResult) -> int:
    st = r.source_type.lower()
    if "circular" in st: return 1
    if "technical note" in st: return 2
    if "sop" in st: return 3
    if "cmr" in st or "regulation" in st: return 4
    if "audit" in st: return 5
    if "shift report" in st: return 7
    return 6


def _hybrid_search(
    query: str,
    n_results: int = RETRIEVAL_TOP_K,
    source_type_filter: str | None = None,
) -> list[SearchResult]:
    """
    Perform hybrid search combining vector similarity and BM25.
    Uses embedding cache and pre-normalized vector matrix when available.
    """
    store = _get_store()
    _ensure_indexes_loaded()

    import numpy as np
    from embeddings.model import EmbeddingModel

    # Get query embedding (with LRU cache)
    q_cache = get_query_cache()
    q_vec = q_cache.get(query)
    if q_vec is None:
        embedder = EmbeddingModel()
        q_vec = np.array(embedder.embed_one(query), dtype=np.float32)
        q_cache.set(query, q_vec)

    # Vector search via matrix cache
    vec_cache = get_vector_cache()
    if vec_cache.is_loaded:
        vector_scores = vec_cache.search(q_vec, n_results=n_results * 2)
    else:
        # Fallback to store search
        raw = store.search(query, n_results=n_results)
        return raw

    # BM25 keyword search
    bm25 = get_bm25_index()
    bm25_scores = bm25.search(query, n_results=n_results * 2) if bm25.is_built else []

    # Merge scores
    merged = merge_scores(vector_scores, bm25_scores)

    # Get top chunk IDs
    top_ids = [cid for _, cid in merged[:n_results * 2]]

    if not top_ids:
        return []

    # Fetch full SearchResult objects from store
    import sqlite3
    sql = """SELECT id, content, vector, source_id, title, source_type,
                    section, page, publication_date, issuing_authority, synthetic
             FROM chunks WHERE id IN ({})""".format(
        ','.join('?' * len(top_ids))
    )
    if source_type_filter:
        sql += " AND source_type = ?"
        params = top_ids + [source_type_filter]
    else:
        params = top_ids

    with store._connect() as conn:
        rows = conn.execute(sql, params).fetchall()

    # Build score lookup
    score_map = {cid: score for score, cid in merged}

    results = []
    seen_content: set[str] = set()
    for row in rows:
        norm_content = re.sub(r'\s+', ' ', row["content"].strip()).lower()
        if norm_content in seen_content:
            continue
        seen_content.add(norm_content)

        chunk_score = score_map.get(row["id"], 0.0)
        results.append(SearchResult(
            chunk_id=row["id"],
            content=row["content"],
            source_id=row["source_id"] or "",
            title=row["title"] or "",
            source_type=row["source_type"] or "",
            section=row["section"] or "",
            page=row["page"] or 1,
            publication_date=row["publication_date"] or "",
            issuing_authority=row["issuing_authority"] or "",
            synthetic=bool(row["synthetic"]),
            score=round(max(0.0, min(1.0, chunk_score)), 4),
        ))

    # Sort by hybrid score
    results.sort(key=lambda r: r.score, reverse=True)
    return results[:n_results]


def _fallback_response(results: list[SearchResult]) -> str:
    if not results:
        return NOT_FOUND_RESPONSE
    points = []
    seen: set = set()
    for result in results:
        content = re.sub(r'\s+', ' ', result.content)
        content = re.sub(r'^\s*\d+(?:\.\d+)*\s*', '', content).strip()
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', content) if len(s.strip()) > 20]
        for sent in sentences:
            if len(points) >= 5:
                break
            if not re.search(
                r'\b(must|shall|should|required|prohibited|ensure|safety|speed|distance|limit|'
                r'maximum|minimum|ppe|inspection|report|register|\d+|wear|check|maintain|'
                r'ventilation|fire|gas|dust|guarding|evacuation)\b',
                sent, re.IGNORECASE
            ):
                continue
            simplified = re.sub(r'\b(shall be|is required to be)\b', 'must be', sent, flags=re.IGNORECASE)
            simplified = re.sub(r'\bshall\b', 'must', simplified, flags=re.IGNORECASE)
            simplified = re.sub(r'^(According to|Subject to|Notwithstanding|Provided that)[^,]+,\s*', '', simplified, flags=re.IGNORECASE)
            if simplified and simplified[0].islower():
                simplified = simplified[0].upper() + simplified[1:]
            words = set(re.findall(r'\b\w{4,}\b', simplified.lower()))
            is_dup = any(
                len(words & sw) / float(min(len(words), len(sw))) > 0.65
                for sw in seen if words and sw
            )
            if not is_dup and simplified:
                if words:
                    seen.add(frozenset(words))
                points.append(f"- {simplified}")
    if not points:
        points.append("- Always follow your site safety officer's instructions and wear all required PPE.")
    intro = "Here are the key safety requirements:\n"
    outro = "\n\n> **Practical Tip**\nAlways follow these rules carefully. If unsure, ask your supervisor before starting work."
    return intro + "\n".join(points) + outro


# ── Main pipeline entry points ─────────────────────────────────────────────────

def ask(
    question: str,
    n_results: int = RETRIEVAL_TOP_K,
    language: str = "hi",
    history: list[dict] | None = None,
) -> RAGResponse:
    """
    Execute the full RAG pipeline for a user question.

    Stages:
    1. Intent classification
    2. Short-circuit for non-compliance intents
    3. Hinglish normalization
    4. Hybrid retrieval (vector + BM25)
    5. Source prioritization + dedup
    6. LLM generation with conversation context
    7. Output cleaning + citation assembly
    """
    store = _get_store()
    start_total = time.time()
    logger.info("[PIPELINE] Question: %s", question[:80])

    # ── Stage 1: Intent classification ─────────────────────────────────────────
    intent = classify_intent(question, history)
    logger.info("[PIPELINE] Intent: %s", intent.value)

    # ── Stage 2: Short-circuit for non-compliance intents ─────────────────────
    canned = get_canned_response(intent, language)
    if canned:
        logger.info("[PIPELINE] Returning canned response for intent: %s", intent.value)
        return RAGResponse(
            answer=canned,
            citations=[],
            chunks_used=0,
            model_used="intent-classifier",
            retrieved_scores=[],
            intent=intent.value,
        )

    # ── Stage 3: General knowledge — use LLM directly (no RAG) ───────────────
    if intent == Intent.GENERAL:
        logger.info("[PIPELINE] General knowledge query — using LLM without RAG.")
        conv_ctx = _build_conversation_context(history)
        prompt = SYSTEM_PROMPT_GENERAL.format(
            language=language,
            conversation_context=conv_ctx,
            question=question,
        )
        provider = get_llm_provider()
        future = _llm_executor.submit(provider.generate, prompt)
        try:
            llm_answer = future.result(timeout=LLM_GENERATION_TIMEOUT)
        except Exception:
            llm_answer = None

        if llm_answer:
            cleaned = _clean_llm_output(llm_answer)
            if cleaned:
                return RAGResponse(
                    answer=cleaned,
                    citations=[],
                    chunks_used=0,
                    model_used=provider.get_model_name(),
                    retrieved_scores=[],
                    intent=intent.value,
                )

        return RAGResponse(
            answer="I'm not sure about that — please ask me a mining safety or compliance question!",
            citations=[],
            chunks_used=0,
            model_used="none",
            retrieved_scores=[],
            intent=intent.value,
        )

    # ── Stage 4: Compliance / Follow-up — normalize and retrieve ─────────────

    # For follow-up questions, use last user message for retrieval context
    retrieval_query = question
    if intent == Intent.FOLLOWUP and history:
        last_user = next(
            (m["content"] for m in reversed(history) if m.get("role") == "user"),
            question
        )
        retrieval_query = f"{last_user} {question}"

    # Normalize Hinglish
    normalized_query = normalize_hinglish(retrieval_query)
    if normalized_query != retrieval_query:
        logger.info("[PIPELINE] Hinglish normalized for retrieval.")

    # ── Stage 5: Hybrid retrieval ─────────────────────────────────────────────
    t0 = time.time()
    results = _hybrid_search(normalized_query, n_results=n_results)
    logger.info("[PIPELINE] Retrieval: %d chunks in %.2fs", len(results), time.time() - t0)

    if not results:
        return RAGResponse(
            answer=NOT_FOUND_RESPONSE_HI if language == "hi" else NOT_FOUND_RESPONSE,
            citations=[],
            chunks_used=0,
            model_used="none",
            retrieved_scores=[],
            intent=intent.value,
        )

    scores = [r.score for r in results]

    # Filter by score threshold
    relevant = [r for r in results if r.score >= SCORE_THRESHOLD]
    if not relevant or max(scores) < NOT_FOUND_THRESHOLD:
        return RAGResponse(
            answer=NOT_FOUND_RESPONSE_HI if language == "hi" else NOT_FOUND_RESPONSE,
            citations=[],
            chunks_used=0,
            model_used="none",
            retrieved_scores=scores,
            intent=intent.value,
        )

    # Remove shift reports unless they are the best match
    has_non_shift = any("shift report" not in r.source_type.lower() for r in relevant)
    if has_non_shift:
        relevant = [r for r in relevant if "shift report" not in r.source_type.lower()]

    relevant.sort(key=lambda r: (_source_priority(r), -r.score))
    deduped = _deduplicate_chunks(relevant)
    llm_chunks = deduped[:LLM_TOP_K]

    # ── Stage 6: Build prompt with conversation context ───────────────────────
    context = _build_context(llm_chunks, max_chars=LLM_CHUNK_MAX_CHARS)
    conv_ctx = _build_conversation_context(history)
    prompt = SYSTEM_PROMPT_COMPLIANCE.format(
        language=language,
        conversation_context=conv_ctx,
        context=context,
        question=question,
    )

    logger.info("[PIPELINE] Prompt: %d chars, ~%d tokens", len(prompt), len(prompt) // 4)

    # ── Stage 7: LLM generation ───────────────────────────────────────────────
    provider = get_llm_provider()
    t1 = time.time()
    llm_answer: str | None = None
    future = _llm_executor.submit(provider.generate, prompt)
    try:
        llm_answer = future.result(timeout=LLM_GENERATION_TIMEOUT)
    except concurrent.futures.TimeoutError:
        logger.warning("[PIPELINE] LLM timed out — using retrieval fallback.")
        future.cancel()
    except Exception as e:
        logger.error("[PIPELINE] LLM error: %s", e)

    logger.info("[PIPELINE] LLM: %.2fs", time.time() - t1)

    # ── Stage 8: Build final answer ───────────────────────────────────────────
    if llm_answer:
        cleaned = _clean_llm_output(llm_answer)
        answer = cleaned if cleaned else _fallback_response(relevant)
        model_used = provider.get_model_name() if cleaned else "direct-retrieval-fallback"
    else:
        answer = _fallback_response(relevant)
        model_used = "direct-retrieval-fallback"

    citations = build_citations(relevant)

    logger.info("[PIPELINE] Total: %.2fs", time.time() - start_total)

    return RAGResponse(
        answer=answer,
        citations=citations,
        chunks_used=len(relevant),
        model_used=model_used,
        retrieved_scores=scores,
        intent=intent.value,
    )


def ask_stream(
    question: str,
    n_results: int = RETRIEVAL_TOP_K,
    language: str = "hi",
    history: list[dict] | None = None,
) -> Iterator[dict]:
    """
    Streaming version of ask().
    Yields dicts: {"token": str} | {"done": True, "citations": [...], "intent": str}
    """
    store = _get_store()
    start = time.time()

    # Intent classification
    intent = classify_intent(question, history)

    # Short-circuit for non-compliance intents
    canned = get_canned_response(intent, language)
    if canned:
        # Stream word-by-word for a more natural feel
        for word in canned.split(' '):
            yield {"token": word + ' '}
        yield {"done": True, "citations": [], "intent": intent.value, "chunks_used": 0}
        return

    # General knowledge — stream LLM directly
    if intent == Intent.GENERAL:
        conv_ctx = _build_conversation_context(history)
        prompt = SYSTEM_PROMPT_GENERAL.format(
            language=language,
            conversation_context=conv_ctx,
            question=question,
        )
        provider = get_llm_provider()
        try:
            for token in provider.generate_stream(prompt):
                yield {"token": token}
        except Exception as e:
            logger.error("[STREAM] General LLM stream error: %s", e)
            yield {"token": "I couldn't process that request. Please try again."}
        yield {"done": True, "citations": [], "intent": intent.value, "chunks_used": 0}
        return

    # Compliance — retrieve first, then stream
    retrieval_query = question
    if intent == Intent.FOLLOWUP and history:
        last_user = next(
            (m["content"] for m in reversed(history) if m.get("role") == "user"),
            question
        )
        retrieval_query = f"{last_user} {question}"

    normalized_query = normalize_hinglish(retrieval_query)
    results = _hybrid_search(normalized_query, n_results=n_results)

    if not results or max((r.score for r in results), default=0) < NOT_FOUND_THRESHOLD:
        fallback = NOT_FOUND_RESPONSE_HI if language == "hi" else NOT_FOUND_RESPONSE
        for word in fallback.split(' '):
            yield {"token": word + ' '}
        yield {"done": True, "citations": [], "intent": intent.value, "chunks_used": 0}
        return

    relevant = [r for r in results if r.score >= SCORE_THRESHOLD]
    has_non_shift = any("shift report" not in r.source_type.lower() for r in relevant)
    if has_non_shift:
        relevant = [r for r in relevant if "shift report" not in r.source_type.lower()]

    relevant.sort(key=lambda r: (_source_priority(r), -r.score))
    deduped = _deduplicate_chunks(relevant)
    llm_chunks = deduped[:LLM_TOP_K]

    context = _build_context(llm_chunks, max_chars=LLM_CHUNK_MAX_CHARS)
    conv_ctx = _build_conversation_context(history)
    prompt = SYSTEM_PROMPT_COMPLIANCE.format(
        language=language,
        conversation_context=conv_ctx,
        context=context,
        question=question,
    )

    provider = get_llm_provider()
    full_text = ""
    try:
        for token in provider.generate_stream(prompt):
            full_text += token
            yield {"token": token}
    except Exception as e:
        logger.error("[STREAM] Compliance LLM stream error: %s", e)
        fallback = _fallback_response(relevant)
        yield {"token": fallback}

    # Send citations at end
    citations = build_citations(relevant)
    yield {
        "done": True,
        "citations": [c.to_dict() for c in citations],
        "intent": intent.value,
        "chunks_used": len(relevant),
        "model_used": provider.get_model_name(),
        "elapsed": round(time.time() - start, 2),
    }


def generate_search_summary(query: str, results: list[SearchResult]) -> str | None:
    """Generate a concise AI summary of search results."""
    if not results:
        return None
    context = _build_context(results[:3], max_chars=300)
    prompt = (
        "You are a DGMS compliance officer. In 2 sentences, explain what "
        "these documents say about the query. Be factual, do NOT hallucinate.\n\n"
        f"CONTEXT:\n{context}\n\nQUERY: {query}\n\nSUMMARY:"
    )
    try:
        provider = get_llm_provider()
        summary = provider.generate(prompt)
        if summary:
            return _clean_llm_output(summary).strip()
    except Exception as e:
        logger.warning("Search summary generation failed: %s", e)
    return None


def search_documents(
    query: str,
    n_results: int = 8,
    source_type_filter: str | None = None,
) -> list[SearchResult]:
    """Pure hybrid search — returns raw SearchResult objects without LLM generation."""
    normalized = normalize_hinglish(query)
    return _hybrid_search(normalized, n_results=n_results, source_type_filter=source_type_filter)

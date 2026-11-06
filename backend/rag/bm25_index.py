"""
rag/bm25_index.py

Lightweight BM25 keyword index for hybrid search.

Complements vector similarity by catching exact matches that embeddings miss:
  - Regulation numbers: DGMS-CIR-2024-17, CMR 2017, Regulation 104
  - Section references: Clause 4.2, Section 3.1
  - Specific equipment names: HEMM, OCP, CHP, VT

The hybrid search combines:
  - Vector similarity (semantic)
  - BM25 (keyword/lexical)
  - Weighted merge: 70% vector + 30% BM25

BM25 Parameters (Okapi BM25):
  k1 = 1.5 (term frequency saturation)
  b  = 0.75 (document length normalization)
"""

from __future__ import annotations
import math
import re
import logging
import threading
from collections import defaultdict, Counter

logger = logging.getLogger(__name__)

# BM25 hyperparameters
K1 = 1.5
B = 0.75

# Hybrid weight: vector similarity contribution
VECTOR_WEIGHT = 0.70
BM25_WEIGHT = 0.30


def _tokenize(text: str) -> list[str]:
    """Simple tokenizer: lowercase, split on non-alphanumeric, keep numbers."""
    text = text.lower()
    tokens = re.findall(r'\b[\w\d]{2,}\b', text)
    return tokens


class BM25Index:
    """
    In-memory BM25 index over document chunks.
    Thread-safe via a read lock (write only during build/rebuild).
    """

    def __init__(self):
        self._lock = threading.RLock()
        self._chunk_ids: list[str] = []
        self._tokens: list[list[str]] = []     # per-chunk token list
        self._df: dict[str, int] = {}           # document frequency per term
        self._idf: dict[str, float] = {}        # precomputed IDF
        self._avg_dl: float = 0.0               # average document length
        self._built = False

    def build(self, chunks: list[tuple[str, str]]) -> None:
        """
        Build (or rebuild) the index from scratch.

        Args:
            chunks: list of (chunk_id, content_text)
        """
        if not chunks:
            return

        chunk_ids = []
        all_tokens = []
        df: dict[str, int] = defaultdict(int)

        for chunk_id, content in chunks:
            tokens = _tokenize(content)
            chunk_ids.append(chunk_id)
            all_tokens.append(tokens)

            # Count document frequency
            for term in set(tokens):
                df[term] += 1

        n = len(chunks)
        avg_dl = sum(len(t) for t in all_tokens) / max(n, 1)

        # Precompute IDF for each term
        idf: dict[str, float] = {}
        for term, freq in df.items():
            idf[term] = math.log((n - freq + 0.5) / (freq + 0.5) + 1.0)

        with self._lock:
            self._chunk_ids = chunk_ids
            self._tokens = all_tokens
            self._df = dict(df)
            self._idf = idf
            self._avg_dl = avg_dl
            self._built = True

        logger.info("BM25 index built: %d chunks, %d unique terms.", n, len(df))

    def search(self, query: str, n_results: int = 10) -> list[tuple[float, str]]:
        """
        Return top-n (score, chunk_id) pairs for the query.
        """
        with self._lock:
            if not self._built or not self._chunk_ids:
                return []

            query_terms = _tokenize(query)
            if not query_terms:
                return []

            scores: list[float] = [0.0] * len(self._chunk_ids)

            for term in query_terms:
                if term not in self._idf:
                    continue
                idf = self._idf[term]

                for i, tokens in enumerate(self._tokens):
                    tf = tokens.count(term)
                    if tf == 0:
                        continue
                    dl = len(tokens)
                    denom = tf + K1 * (1 - B + B * (dl / self._avg_dl))
                    scores[i] += idf * (tf * (K1 + 1)) / denom

            # Get top-n
            indexed = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
            results = []
            for idx, score in indexed[:n_results]:
                if score > 0:
                    results.append((score, self._chunk_ids[idx]))

            return results

    def update_chunk(self, chunk_id: str, content: str) -> None:
        """Add a single new chunk without full rebuild."""
        tokens = _tokenize(content)
        with self._lock:
            self._chunk_ids.append(chunk_id)
            self._tokens.append(tokens)
            n = len(self._chunk_ids)
            self._avg_dl = (self._avg_dl * (n - 1) + len(tokens)) / n
            for term in set(tokens):
                self._df[term] = self._df.get(term, 0) + 1
                # Update IDF
                freq = self._df[term]
                self._idf[term] = math.log((n - freq + 0.5) / (freq + 0.5) + 1.0)

    @property
    def is_built(self) -> bool:
        with self._lock:
            return self._built

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._chunk_ids)


def merge_scores(
    vector_scores: list[tuple[float, str]],
    bm25_scores: list[tuple[float, str]],
    vector_weight: float = VECTOR_WEIGHT,
    bm25_weight: float = BM25_WEIGHT,
) -> list[tuple[float, str]]:
    """
    Merge vector and BM25 scores using reciprocal rank fusion + weighted combination.

    Both score lists are normalized to [0, 1] before weighting.
    """
    # Build score maps
    v_map: dict[str, float] = {cid: score for score, cid in vector_scores}
    b_map: dict[str, float] = {cid: score for score, cid in bm25_scores}

    all_ids = set(v_map.keys()) | set(b_map.keys())
    if not all_ids:
        return []

    # Normalize each set to [0, 1]
    v_max = max(v_map.values(), default=1.0)
    b_max = max(b_map.values(), default=1.0)

    combined: dict[str, float] = {}
    for cid in all_ids:
        v_score = v_map.get(cid, 0.0) / max(v_max, 1e-9)
        b_score = b_map.get(cid, 0.0) / max(b_max, 1e-9)
        combined[cid] = vector_weight * v_score + bm25_weight * b_score

    # Sort by combined score descending
    ranked = sorted(combined.items(), key=lambda x: x[1], reverse=True)
    return [(score, cid) for cid, score in ranked]


# Module-level singleton
_bm25_index: BM25Index | None = None


def get_bm25_index() -> BM25Index:
    global _bm25_index
    if _bm25_index is None:
        _bm25_index = BM25Index()
    return _bm25_index

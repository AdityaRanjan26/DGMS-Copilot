"""
api/assistant.py

POST /api/chat         — Full response (non-streaming, backwards compatible)
POST /api/chat/stream  — Server-Sent Events streaming response

Both endpoints support:
  - Conversation history (last N turns for memory)
  - Intent classification + routing
  - Hinglish normalization
  - Rate limiting (60 requests/minute per IP, configurable)
"""

from __future__ import annotations
import logging
import time
from typing import AsyncIterator
import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from rag.pipeline import ask, ask_stream, RAGResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Rate limiting (simple in-memory, per-IP) ──────────────────────────────────
import threading
from collections import defaultdict, deque

_rate_limit_lock = threading.Lock()
_request_times: dict[str, deque] = defaultdict(lambda: deque(maxlen=60))
_RATE_LIMIT_REQUESTS = int(__import__('os').getenv("RATE_LIMIT_REQUESTS", "60"))
_RATE_LIMIT_WINDOW = 60  # seconds


def _check_rate_limit(ip: str) -> bool:
    """Returns True if request is allowed, False if rate limited."""
    now = time.monotonic()
    with _rate_limit_lock:
        times = _request_times[ip]
        # Remove timestamps outside the window
        while times and now - times[0] > _RATE_LIMIT_WINDOW:
            times.popleft()
        if len(times) >= _RATE_LIMIT_REQUESTS:
            return False
        times.append(now)
        return True


# ── Request/Response schemas ───────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    n_results: int = Field(default=5, ge=1, le=10)
    language: str = Field(default="hi")
    history: list[ConversationTurn] = Field(
        default=[],
        description="Previous conversation turns for context memory.",
    )


class ChatResponse(BaseModel):
    answer: str
    citations: list[dict]
    chunks_used: int
    model_used: str
    retrieved_scores: list[float]
    intent: str = "COMPLIANCE"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, http_request: Request) -> ChatResponse:
    """Non-streaming chat endpoint (backwards compatible)."""
    client_ip = getattr(http_request.client, "host", "unknown")
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please slow down.")

    # Sanitize input
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Validate and truncate history
    history = [
        {"role": t.role, "content": t.content[:500]}
        for t in request.history[-10:]  # last 10 turns max
        if t.role in ("user", "assistant")
    ]

    logger.info("Chat [%s]: %s", client_ip, question[:80])

    try:
        start = time.time()
        response: RAGResponse = ask(
            question=question,
            n_results=request.n_results,
            language=request.language,
            history=history,
        )
        logger.info("Chat completed in %.2fs (intent=%s)", time.time() - start, response.intent)
    except Exception as e:
        logger.exception("RAG pipeline error")
        raise HTTPException(status_code=500, detail={"error": "Pipeline error", "message": str(e)})

    return ChatResponse(
        answer=response.answer,
        citations=[c.to_dict() for c in response.citations],
        chunks_used=response.chunks_used,
        model_used=response.model_used,
        retrieved_scores=response.retrieved_scores,
        intent=response.intent,
    )


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, http_request: Request) -> StreamingResponse:
    """
    Streaming chat endpoint using Server-Sent Events.

    Event format:
      data: {"token": "word "}\n\n          ← incremental tokens
      data: {"done": true, "citations": [...], "intent": "COMPLIANCE"}\n\n

    The client should read the stream and accumulate tokens until done=true.
    """
    client_ip = getattr(http_request.client, "host", "unknown")
    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded.")

    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    history = [
        {"role": t.role, "content": t.content[:500]}
        for t in request.history[-10:]
        if t.role in ("user", "assistant")
    ]

    logger.info("Chat stream [%s]: %s", client_ip, question[:80])

    async def event_generator() -> AsyncIterator[str]:
        try:
            for chunk in ask_stream(
                question=question,
                n_results=request.n_results,
                language=request.language,
                history=history,
            ):
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.exception("Streaming error")
            error_chunk = {"error": str(e), "done": True, "citations": [], "intent": "ERROR"}
            yield f"data: {json.dumps(error_chunk)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

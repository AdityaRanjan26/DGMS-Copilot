"""
DGMS Copilot — FastAPI Backend Entry Point
"""
from contextlib import asynccontextmanager
import os
import httpx
from pathlib import Path
import threading

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")

load_dotenv(Path(__file__).parent / ".env")

from api.assistant import router as assistant_router
from api.search import router as search_router
from api.reports import router as reports_router
from api.repository import router as repository_router
from api.notifications import router as notifications_router
from api.auth import router as auth_router
from vectorstore.sqlite_store import SQLiteStore
from utils.ollama_startup import ensure_ollama_running


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: check vector store, ensure Ollama is running, pre-build indexes."""
    ensure_ollama_running()

    store = SQLiteStore()
    count = store.count()
    if count == 0:
        print("\n" + "=" * 60)
        print("⚠  WARNING: Vector Store collection is empty.")
        print("   Run the ingestion script first:")
        print("   python ingest_documents.py")
        print("=" * 60 + "\n")
    else:
        print(f"\n[OK] Vector Store ready — {count} chunks indexed.\n")

    def startup_background():
        """Pre-load model + build BM25 and vector matrix indexes."""
        model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        print(f"Pre-loading model {model} into memory...")
        try:
            httpx.post(
                f'{os.getenv("OLLAMA_URL", "http://localhost:11434")}/api/generate',
                json={"model": model, "keep_alive": "1h"},
                timeout=120.0
            )
            print(f"[OK] Model {model} loaded into memory.")
        except Exception as e:
            print(f"⚠  WARNING: Failed to pre-load model {model}: {e}")

        # Pre-build BM25 and vector matrix caches for fast retrieval
        if count > 0:
            try:
                from rag.pipeline import _rebuild_indexes
                _rebuild_indexes(store)
                print(f"[OK] BM25 and vector matrix indexes built ({count} chunks).")
            except Exception as e:
                print(f"⚠  WARNING: Failed to build indexes: {e}")

    threading.Thread(target=startup_background, daemon=True).start()

    yield


app = FastAPI(
    title="DGMS Copilot RAG Backend",
    description="Retrieval-Augmented Generation backend for CCL mining compliance.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)

# Routers
app.include_router(auth_router, prefix="/api/auth")
app.include_router(assistant_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(repository_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")


@app.get("/api/status")
async def status():
    from rag.pipeline import _get_store
    from rag.bm25_index import get_bm25_index
    from rag.embedding_cache import get_query_cache, get_vector_cache
    store = _get_store()
    count = store.count()
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    ollama_reachable = False
    try:
        r = httpx.get(f"{ollama_url}/api/tags", timeout=2.0)
        ollama_reachable = r.status_code == 200
    except Exception:
        pass

    bm25 = get_bm25_index()
    vec_cache = get_vector_cache()
    q_cache = get_query_cache()

    return {
        "status": "ok",
        "chunks_indexed": count,
        "corpus_ready": count > 0,
        "ollama_reachable": ollama_reachable,
        "bm25_built": bm25.is_built,
        "bm25_size": bm25.size,
        "vector_matrix_loaded": vec_cache.is_loaded,
        "vector_matrix_size": vec_cache.size,
        "embedding_cache": q_cache.stats(),
    }


@app.get("/api/analytics")
async def analytics():
    """Basic analytics endpoint for monitoring response quality."""
    from rag.embedding_cache import get_query_cache
    cache = get_query_cache()
    return {
        "embedding_cache": cache.stats(),
    }


@app.get("/")
async def root():
    return {"message": "DGMS Copilot RAG Backend v2.0", "docs": "/docs"}

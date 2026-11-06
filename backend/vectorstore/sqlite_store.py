"""
vectorstore/sqlite_store.py

SQLite + NumPy vector store — no C++ build tools required.

This replaces ChromaDB with a pure-Python implementation:
  - Chunk metadata stored in SQLite (built into Python — zero deps)
  - Embedding vectors stored as binary BLOBs in the same SQLite file
  - Cosine similarity computed with NumPy (pre-compiled wheel — no compilation)
  - Persistent on disk — survives server restarts
  - Idempotent ingestion — safe to re-run without duplicating chunks

Performance: For a corpus of ~500 chunks (typical CCL pilot), brute-force
cosine similarity is <10ms per query on a modern laptop.
Scale path: When the corpus grows to 50,000+ chunks, swap this class
with a FAISS or Qdrant implementation — the public interface is identical.

Public interface (same as the original ChromaDB wrapper):
  - add_chunks(chunks: list[Chunk]) -> int
  - search(query: str, n_results: int, source_type_filter: str|None) -> list[SearchResult]
  - count() -> int
  - reset() -> None
  - list_sources() -> list[dict]
"""

from __future__ import annotations
import os
import sqlite3
import logging
import threading
from pathlib import Path

import numpy as np

from ingestion.chunker import Chunk
from embeddings.model import EmbeddingModel

logger = logging.getLogger(__name__)

# Default path: chroma_db/ at the project root (for backward compat naming)
VECTOR_STORE_PATH = os.getenv(
    "VECTOR_DB_PATH",
    str(Path(__file__).parent.parent.parent / "vector_db"),
)

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    vector BLOB NOT NULL,
    source_id TEXT,
    title TEXT,
    source_type TEXT,
    section TEXT,
    page INTEGER DEFAULT 1,
    publication_date TEXT,
    issuing_authority TEXT,
    synthetic INTEGER DEFAULT 0,
    chunk_index INTEGER DEFAULT 0,
    file_path TEXT
)
"""


class SearchResult:
    """A single retrieval result with content and metadata."""
    __slots__ = (
        "chunk_id", "content", "source_id", "title", "source_type",
        "section", "page", "publication_date", "issuing_authority",
        "synthetic", "score",
    )

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def to_dict(self) -> dict:
        return {s: getattr(self, s) for s in self.__slots__}


class SQLiteStore:
    """
    Persistent vector store backed by SQLite + NumPy.
    Thread-safe via a threading lock around write operations.
    """

    def __init__(self):
        db_dir = Path(VECTOR_STORE_PATH)
        db_dir.mkdir(parents=True, exist_ok=True)
        self._db_path = db_dir / "vectors.db"
        self._lock = threading.Lock()
        self._embedder_inst = None
        self._init_db()

    @property
    def _embedder(self) -> EmbeddingModel:
        if self._embedder_inst is None:
            self._embedder_inst = EmbeddingModel()
        return self._embedder_inst

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(_CREATE_TABLE)
            conn.commit()
        logger.info("Vector store initialised at: %s", self._db_path)

    # ── Ingestion ──────────────────────────────────────────────────────────

    def add_chunks(self, chunks: list[Chunk], batch_size: int = 64) -> int:
        """
        Embed and persist chunks. Skips chunks whose IDs already exist.
        Returns the number of new chunks added.
        """
        if not chunks:
            return 0

        with self._connect() as conn:
            existing_ids = {
                row[0]
                for row in conn.execute("SELECT id FROM chunks").fetchall()
            }

        new_chunks = [c for c in chunks if c.id not in existing_ids]
        if not new_chunks:
            logger.info("All %d chunks already indexed — skipping.", len(chunks))
            return 0

        added = 0
        with self._lock:
            with self._connect() as conn:
                for i in range(0, len(new_chunks), batch_size):
                    batch = new_chunks[i : i + batch_size]
                    texts = [c.content for c in batch]
                    embeddings = self._embedder.embed(texts)

                    rows = []
                    for chunk, embedding in zip(batch, embeddings):
                        vec = np.array(embedding, dtype=np.float32)
                        rows.append((
                            chunk.id,
                            chunk.content,
                            vec.tobytes(),
                            chunk.source_id,
                            chunk.title,
                            chunk.source_type,
                            chunk.section,
                            chunk.page,
                            chunk.publication_date,
                            chunk.issuing_authority,
                            int(chunk.synthetic),
                            chunk.chunk_index,
                            chunk.file_path,
                        ))

                    conn.executemany(
                        """INSERT INTO chunks
                           (id, content, vector, source_id, title, source_type,
                            section, page, publication_date, issuing_authority,
                            synthetic, chunk_index, file_path)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                        rows,
                    )
                    conn.commit()
                    added += len(batch)
                    logger.info(
                        "Indexed batch %d–%d (%d new total)",
                        i + 1, i + len(batch), added,
                    )

        return added

    # ── Retrieval ──────────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        n_results: int = 5,
        source_type_filter: str | None = None,
    ) -> list[SearchResult]:
        """
        Embed the query and return the top-k chunks ranked by cosine similarity.
        """
        total = self.count()
        if total == 0:
            logger.warning("Vector store is empty. Run ingestion first.")
            return []

        # Embed and normalise query vector
        q_vec = np.array(self._embedder.embed_one(query), dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []
        q_vec = q_vec / q_norm

        # Fetch all rows (with optional filter)
        sql = """SELECT id, content, vector, source_id, title, source_type,
                        section, page, publication_date, issuing_authority, synthetic
                 FROM chunks"""
        params: list[str] = []
        if source_type_filter:
            sql += " WHERE source_type = ?"
            params.append(source_type_filter)

        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()

        if not rows:
            return []

        # Brute-force cosine similarity — fast enough for <10,000 chunks
        scores: list[tuple[float, sqlite3.Row]] = []
        
        query_lower = query.lower()
        
        import re
        query_words = set(re.findall(r'\b\w{4,}\b', query_lower))

        for row in rows:
            raw = row["vector"]
            dim = len(q_vec)
            vec = np.frombuffer(raw, dtype=np.float32).copy()
            if vec.shape[0] != dim:
                continue  # malformed — skip
            v_norm = np.linalg.norm(vec)
            if v_norm > 0:
                vec = vec / v_norm
            score = float(np.dot(q_vec, vec))
            
            # Boost logic to improve ranking for specific topics
            content_lower = row["content"].lower()
            title_lower = (row["title"] or "").lower()
            text_to_search = title_lower + " " + content_lower
            
            boost = 0.0
            
            # PPE topic boost
            if "ppe" in query_lower or "personal protective" in query_lower or "equipment" in query_lower:
                if "ppe" in text_to_search or "personal protective equipment" in text_to_search or "helmet" in text_to_search or "boot" in text_to_search or "shoe" in text_to_search:
                    boost += 0.20
                    
            # Haul road topic boost
            if "haul road" in query_lower or "dumper" in query_lower or "speed limit" in query_lower:
                if "haul road" in text_to_search or "dumper" in text_to_search or "truck" in text_to_search:
                    boost += 0.20
                    
            # Ventilation topic boost
            if "ventilation" in query_lower or "fan" in query_lower:
                if "ventilation" in text_to_search or "air" in text_to_search or "fan" in text_to_search:
                    boost += 0.20
            
            # Fire extinguisher topic boost
            if "fire" in query_lower or "extinguisher" in query_lower:
                if "fire" in text_to_search or "extinguisher" in text_to_search:
                    boost += 0.20
                    
            # General word overlap boost
            content_words = set(re.findall(r'\b\w{4,}\b', content_lower))
            overlap = len(query_words & content_words)
            boost += 0.02 * overlap
            
            score += boost
            scores.append((score, row))

        scores.sort(key=lambda x: x[0], reverse=True)

        results: list[SearchResult] = []
        seen_content = set()
        
        for score, row in scores:
            # Remove duplicate retrieved chunks by content
            content = row["content"].strip()
            # Basic normalization for deduplication
            norm_content = re.sub(r'\s+', ' ', content).lower()
            
            if norm_content in seen_content:
                continue
            seen_content.add(norm_content)
            
            results.append(
                SearchResult(
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
                    score=round(max(0.0, min(1.0, score)), 4), # Cap score at 1.0 for UI display
                )
            )
            
            if len(results) >= n_results:
                break

        return results

    # ── Utilities ──────────────────────────────────────────────────────────

    def count(self) -> int:
        with self._connect() as conn:
            return conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]

    def reset(self) -> None:
        with self._lock:
            with self._connect() as conn:
                conn.execute("DELETE FROM chunks")
                conn.commit()
        logger.info("Vector store cleared.")

    def list_sources(self) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT source_id, title, source_type,
                          publication_date, synthetic, MAX(file_path) as file_path, COUNT(*) as chunk_count, MAX(page) as total_pages
                   FROM chunks
                   GROUP BY source_id, title, source_type, publication_date, synthetic
                   ORDER BY source_id"""
            ).fetchall()
        return [
            {
                "source_id": r["source_id"],
                "title": r["title"],
                "source_type": r["source_type"],
                "publication_date": r["publication_date"],
                "synthetic": bool(r["synthetic"]),
                "file_path": r["file_path"],
                "chunk_count": r["chunk_count"],
                "total_pages": r["total_pages"] or 1,
            }
            for r in rows
        ]

    def get_source_file_path(self, source_id: str) -> str | None:
        with self._connect() as conn:
            row = conn.execute("SELECT file_path FROM chunks WHERE source_id = ? LIMIT 1", (source_id,)).fetchone()
            if row:
                return row["file_path"]
        return None

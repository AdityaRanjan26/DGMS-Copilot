"""
rag/embedding_cache.py

Thread-safe LRU cache for query embeddings.

Eliminates re-embedding the same (or semantically identical) query.
Expected speedup: embedding step goes from ~50-100ms → ~0ms on cache hit.

Also caches the pre-normalized vector matrix for the entire vector store,
so cosine similarity becomes a single batched np.dot instead of per-row ops.
"""

from __future__ import annotations
import hashlib
import logging
import threading
from collections import OrderedDict

import numpy as np

logger = logging.getLogger(__name__)

# Max queries to cache in memory (~200 × 768-dim float32 = ~590 KB)
_EMBEDDING_CACHE_SIZE = 200


class EmbeddingCache:
    """Thread-safe LRU cache for query embeddings."""

    def __init__(self, maxsize: int = _EMBEDDING_CACHE_SIZE):
        self._cache: OrderedDict[str, np.ndarray] = OrderedDict()
        self._maxsize = maxsize
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    def _key(self, text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]

    def get(self, text: str) -> np.ndarray | None:
        key = self._key(text)
        with self._lock:
            if key in self._cache:
                # Move to end (most recently used)
                self._cache.move_to_end(key)
                self._hits += 1
                return self._cache[key].copy()
            self._misses += 1
            return None

    def set(self, text: str, embedding: np.ndarray) -> None:
        key = self._key(text)
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            else:
                if len(self._cache) >= self._maxsize:
                    # Evict least recently used
                    self._cache.popitem(last=False)
            self._cache[key] = embedding.copy()

    def stats(self) -> dict:
        with self._lock:
            total = self._hits + self._misses
            hit_rate = self._hits / total if total > 0 else 0.0
            return {
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(hit_rate, 3),
                "size": len(self._cache),
                "maxsize": self._maxsize,
            }

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0


# Module-level singleton
_query_cache = EmbeddingCache()


def get_query_cache() -> EmbeddingCache:
    return _query_cache


class VectorMatrixCache:
    """
    Caches the entire vector store as a pre-normalized NumPy matrix.
    Reduces per-query retrieval from O(n) individual ops to a single batched dot product.
    """

    def __init__(self):
        self._matrix: np.ndarray | None = None   # shape: (n_chunks, dim)
        self._row_ids: list[str] = []             # chunk IDs in matrix row order
        self._lock = threading.Lock()
        self._dirty = True  # True = needs reload

    def invalidate(self) -> None:
        """Call this when new chunks are added to the store."""
        with self._lock:
            self._dirty = True
            self._matrix = None
            self._row_ids = []
        logger.info("VectorMatrixCache invalidated.")

    def load(self, rows: list[tuple[str, bytes, int]]) -> None:
        """
        Load all chunk vectors into memory as a normalized matrix.

        Args:
            rows: list of (chunk_id, vector_bytes, dim)
        """
        if not rows:
            return

        dim = rows[0][2]
        matrix = np.zeros((len(rows), dim), dtype=np.float32)
        ids = []

        for i, (chunk_id, raw, _) in enumerate(rows):
            vec = np.frombuffer(raw, dtype=np.float32).copy()
            if vec.shape[0] == dim:
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                matrix[i] = vec
                ids.append(chunk_id)

        with self._lock:
            self._matrix = matrix[:len(ids)]
            self._row_ids = ids
            self._dirty = False

        logger.info("VectorMatrixCache loaded %d vectors (dim=%d).", len(ids), dim)

    def search(
        self,
        query_vec: np.ndarray,
        n_results: int = 10,
    ) -> list[tuple[float, str]]:
        """
        Return top-n (score, chunk_id) pairs using batched cosine similarity.
        Returns empty list if cache is not loaded.
        """
        with self._lock:
            if self._matrix is None or self._dirty:
                return []
            matrix = self._matrix
            row_ids = self._row_ids

        # Normalize query
        norm = np.linalg.norm(query_vec)
        if norm == 0:
            return []
        q = query_vec / norm

        # Batched dot product: shape (n_chunks,)
        scores = matrix @ q

        # Get top-n indices
        if len(scores) <= n_results:
            top_idx = np.argsort(scores)[::-1]
        else:
            top_idx = np.argpartition(scores, -n_results)[-n_results:]
            top_idx = top_idx[np.argsort(scores[top_idx])[::-1]]

        return [(float(scores[i]), row_ids[i]) for i in top_idx if i < len(row_ids)]

    @property
    def is_loaded(self) -> bool:
        with self._lock:
            return self._matrix is not None and not self._dirty

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._row_ids)


# Module-level singleton
_vector_cache = VectorMatrixCache()


def get_vector_cache() -> VectorMatrixCache:
    return _vector_cache

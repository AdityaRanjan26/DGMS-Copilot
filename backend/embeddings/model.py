"""
embeddings/model.py

Embedding model wrapper. Uses sentence-transformers locally — no API key required.

The EmbeddingModel class is a singleton that loads the model once and
reuses it for all embedding requests. To swap models, change EMBEDDING_MODEL
or set the EMBEDDING_MODEL environment variable.

Current model: all-MiniLM-L6-v2
  - 384-dimensional embeddings
  - ~80MB download on first run (cached in ~/.cache/huggingface/)
  - ~2,000 sentences/sec on CPU
  - Excellent for semantic similarity in English

To replace with a different model (e.g. BGE, E5, or an API-based model),
subclass EmbeddingModel and override the embed() method.
"""

from __future__ import annotations
import os
import logging
from typing import ClassVar

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")


class EmbeddingModel:
    """Singleton wrapper around a sentence-transformers model."""

    _instance: ClassVar[EmbeddingModel | None] = None
    _model = None

    def __new__(cls) -> EmbeddingModel:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load()
        return cls._instance

    def _load(self) -> None:
        logger.info("Loading embedding model: %s", EMBEDDING_MODEL_NAME)
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
            self._model = SentenceTransformer(EMBEDDING_MODEL_NAME)
            logger.info("Embedding model loaded successfully.")
        except ImportError:
            raise ImportError(
                "sentence-transformers is required. Run: pip install sentence-transformers"
            )

    def embed(self, texts: list[str]) -> list[list[float]]:
        """
        Embed a list of texts and return a list of float vectors.

        Args:
            texts: List of strings to embed.

        Returns:
            List of embedding vectors (one per input text).
        """
        if not texts:
            return []
        vectors = self._model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return vectors.tolist()

    def embed_one(self, text: str) -> list[float]:
        """Embed a single string."""
        return self.embed([text])[0]

    @property
    def dimension(self) -> int:
        """Return the embedding dimension."""
        return self._model.get_sentence_embedding_dimension()

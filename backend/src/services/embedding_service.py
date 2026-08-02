"""Local embedding service using fastembed (provider-independent).

fastembed runs fully locally via ONNX – no data is sent to any LLM provider.
The model is downloaded once on first use and cached locally.

Usage:
    service = EmbeddingService.get_instance()
    embedding = await service.embed_single("some text")
    embeddings = await service.embed_batch(["text1", "text2"])
"""

import asyncio
import logging
from functools import partial

from src.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Singleton embedding service backed by fastembed.

    Lazy-initializes the model on first use to avoid slowing down startup.
    All CPU-bound embedding operations run in a thread-pool executor so the
    async event loop stays unblocked.
    """

    _instance: "EmbeddingService | None" = None

    def __init__(self) -> None:
        self._model = None
        self._model_name = settings.embedding_model

    @classmethod
    def get_instance(cls) -> "EmbeddingService":
        if cls._instance is None:
            cls._instance = EmbeddingService()
        return cls._instance

    def _ensure_model(self) -> None:
        """Load the fastembed model synchronously (called from thread pool)."""
        if self._model is not None:
            return
        try:
            from fastembed import TextEmbedding
            logger.info(f"Loading embedding model: {self._model_name}")
            self._model = TextEmbedding(model_name=self._model_name)
            logger.info("Embedding model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise

    def _embed_sync(self, texts: list[str]) -> list[list[float]]:
        """Synchronous embedding – runs in thread pool."""
        self._ensure_model()
        embeddings = list(self._model.embed(texts))  # type: ignore[union-attr]
        return [emb.tolist() for emb in embeddings]

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts asynchronously.

        Args:
            texts: List of strings to embed

        Returns:
            List of embedding vectors (list[float])

        Raises:
            RuntimeError: If model loading fails
        """
        if not texts:
            return []
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, partial(self._embed_sync, texts))

    async def embed_single(self, text: str) -> list[float]:
        """Embed a single string.

        Args:
            text: String to embed

        Returns:
            Embedding vector
        """
        results = await self.embed_batch([text])
        return results[0]

    @property
    def model_name(self) -> str:
        return self._model_name

"""Vector store service using Chroma DB.

Provides persistent semantic search over session messages.
Embeddings are generated locally via EmbeddingService (fastembed).

Collection schema (genesis_messages):
    id:       "{session_id}__{message_id}"  for messages
              "{session_id}__summary"       for session summaries
    document: raw message / summary text
    metadata:
        session_id:    str
        project_id:    str
        session_title: str
        role:          "user" | "assistant" | "summary"
        created_at:    str  (ISO-8601 UTC)
        message_id:    str  (original DB id, "" for summaries)
"""

import logging
from dataclasses import dataclass

from src.config import settings
from src.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

COLLECTION_NAME = "genesis_messages"


@dataclass
class SearchResult:
    """A single semantic search hit."""
    text: str
    session_id: str
    session_title: str
    project_id: str
    role: str
    created_at: str
    distance: float  # cosine distance (lower = more similar)


class VectorStore:
    """Singleton Chroma-backed vector store.

    Uses cosine similarity. Embeddings are computed via EmbeddingService.
    """

    _instance: "VectorStore | None" = None
    _client = None
    _collection = None

    @classmethod
    def get_instance(cls) -> "VectorStore":
        if cls._instance is None:
            cls._instance = VectorStore()
        return cls._instance

    def _ensure_collection(self) -> None:
        """Lazily initialize the Chroma client and collection."""
        if self._collection is not None:
            return
        try:
            import chromadb

            self._client = chromadb.PersistentClient(path=settings.chroma_path)
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"}
            )
            count = self._collection.count()
            logger.info(
                f"Chroma collection '{COLLECTION_NAME}' ready. "
                f"{count} documents indexed."
            )
        except Exception as e:
            logger.error(f"Failed to initialize Chroma: {e}")
            raise

    async def index_session(
        self,
        session_id: str,
        project_id: str,
        session_title: str,
        messages: list[dict],
        summary_text: str | None = None,
    ) -> int:
        """Embed and index all messages (+ optional summary) for a session.

        Replaces any previously indexed documents for this session so that
        re-indexing after a new summary is safe.

        Args:
            session_id:    Session UUID
            project_id:    Project UUID
            session_title: Human-readable session title
            messages:      List of dicts with keys: id, role, content, created_at
                           (only "user" and "assistant" roles are indexed)
            summary_text:  Optional summary text to index as a "summary" entry

        Returns:
            Number of documents indexed
        """
        self._ensure_collection()

        # Build list of (id, text, metadata) tuples to embed
        entries: list[tuple[str, str, dict]] = []

        for msg in messages:
            if msg["role"] not in ("user", "assistant"):
                continue
            doc_id = f"{session_id}__{msg['id']}"
            metadata = {
                "session_id": session_id,
                "project_id": project_id,
                "session_title": session_title,
                "role": msg["role"],
                "created_at": msg["created_at"],
                "message_id": msg["id"],
            }
            entries.append((doc_id, msg["content"], metadata))

        if summary_text:
            doc_id = f"{session_id}__summary"
            metadata = {
                "session_id": session_id,
                "project_id": project_id,
                "session_title": session_title,
                "role": "summary",
                "created_at": "",
                "message_id": "",
            }
            entries.append((doc_id, summary_text, metadata))

        if not entries:
            return 0

        # Delete existing entries for this session before re-indexing
        await self.delete_session(session_id)

        # Embed all texts in one batch call (efficient)
        embedding_service = EmbeddingService.get_instance()
        texts = [e[1] for e in entries]
        embeddings = await embedding_service.embed_batch(texts)

        ids = [e[0] for e in entries]
        documents = texts
        metadatas = [e[2] for e in entries]

        self._collection.add(  # type: ignore[union-attr]
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
            ids=ids,
        )

        logger.info(
            f"Indexed {len(entries)} documents for session '{session_title}' "
            f"(id={session_id})."
        )
        return len(entries)

    async def upsert_messages(
        self,
        session_id: str,
        project_id: str,
        session_title: str,
        messages: list[dict],
    ) -> int:
        """Add or update specific messages without touching the rest of the session.

        Uses Chroma upsert – existing doc IDs are updated, new ones are added.
        Much more efficient than full re-indexing for incremental updates.

        Args:
            messages: List of dicts with keys: id, role, content, created_at
                      (only "user" and "assistant" roles are indexed)

        Returns:
            Number of documents upserted
        """
        self._ensure_collection()

        entries: list[tuple[str, str, dict]] = []
        for msg in messages:
            if msg["role"] not in ("user", "assistant"):
                continue
            doc_id = f"{session_id}__{msg['id']}"
            metadata = {
                "session_id": session_id,
                "project_id": project_id,
                "session_title": session_title,
                "role": msg["role"],
                "created_at": msg["created_at"],
                "message_id": msg["id"],
            }
            entries.append((doc_id, msg["content"], metadata))

        if not entries:
            return 0

        embedding_service = EmbeddingService.get_instance()
        texts = [e[1] for e in entries]
        embeddings = await embedding_service.embed_batch(texts)

        self._collection.upsert(  # type: ignore[union-attr]
            embeddings=embeddings,
            documents=texts,
            metadatas=[e[2] for e in entries],
            ids=[e[0] for e in entries],
        )

        logger.info(
            f"Upserted {len(entries)} messages for session '{session_title}' "
            f"(id={session_id})."
        )
        return len(entries)

    async def search(
        self,
        query: str,
        project_id: str,
        limit: int = 5,
        scope: str = "project_only",
        session_id: str | None = None,
    ) -> list[SearchResult]:
        """Semantic search over indexed session messages.

        Args:
            query:       Natural-language search query
            project_id:  Filter to this project (for project_only scope)
            limit:       Maximum number of results to return
            scope:       cross_project | project_only | session_only
            session_id:  Required for session_only scope

        Returns:
            List of SearchResult ordered by relevance (best first)
        """
        self._ensure_collection()

        total_docs = self._collection.count()  # type: ignore[union-attr]
        if total_docs == 0:
            return []

        embedding_service = EmbeddingService.get_instance()
        query_embedding = await embedding_service.embed_single(query)

        # n_results must not exceed total document count (Chroma constraint)
        n_results = min(limit * 3, total_docs, 30)

        if scope == "cross_project":
            where_filter = None
        elif scope == "session_only" and session_id:
            where_filter = {"session_id": {"$eq": session_id}}
        else:
            where_filter = {"project_id": {"$eq": project_id}}

        query_kwargs: dict = {
            "query_embeddings": [query_embedding],
            "n_results": n_results,
            "include": ["documents", "metadatas", "distances"],
        }
        if where_filter:
            query_kwargs["where"] = where_filter

        results = self._collection.query(**query_kwargs)  # type: ignore[union-attr]

        hits: list[SearchResult] = []
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for doc, meta, dist in zip(documents, metadatas, distances):
            hits.append(SearchResult(
                text=doc,
                session_id=meta.get("session_id", ""),
                session_title=meta.get("session_title", ""),
                project_id=meta.get("project_id", ""),
                role=meta.get("role", ""),
                created_at=meta.get("created_at", ""),
                distance=dist,
            ))
            if len(hits) >= limit:
                break

        return hits

    async def delete_session(self, session_id: str) -> None:
        """Remove all indexed documents for a session.

        Safe to call even if no documents exist for the session.

        Args:
            session_id: Session UUID
        """
        self._ensure_collection()
        try:
            self._collection.delete(  # type: ignore[union-attr]
                where={"session_id": {"$eq": session_id}}
            )
        except Exception as e:
            logger.warning(f"Could not delete Chroma docs for session {session_id}: {e}")

    def get_stats(self) -> dict:
        """Return collection statistics."""
        try:
            self._ensure_collection()
            return {
                "collection": COLLECTION_NAME,
                "document_count": self._collection.count(),  # type: ignore[union-attr]
                "embedding_model": EmbeddingService.get_instance().model_name,
                "chroma_path": settings.chroma_path,
            }
        except Exception as e:
            return {"error": str(e)}

"""search_past_sessions tool handler.

Performs semantic search over all indexed session messages for the current
project. Uses Chroma DB + fastembed (local, provider-independent).
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from src.services.vector_store import VectorStore

logger = logging.getLogger(__name__)


async def handle_search_past_sessions(
    db: AsyncSession,
    project_id: str,
    query: str,
    limit: int = 5,
    scope: str = "project_only",
    session_id: str | None = None,
) -> dict:
    """Search past session messages and summaries semantically.

    Args:
        db:         Database session (unused here, kept for API consistency)
        project_id: Restrict search to this project's sessions
        query:      Natural-language search query
        limit:      Maximum number of results (default 5, max 10)

    Returns:
        Result dict with hits list

    Example:
        >>> result = await handle_search_past_sessions(
        ...     db, "proj-123", "What was the budget for Project Alpha?", limit=3
        ... )
        >>> result["success"]
        True
        >>> len(result["hits"])
        3
    """
    if not query or not query.strip():
        raise ValueError("query must not be empty")

    limit = min(max(limit, 1), 10)

    try:
        store = VectorStore.get_instance()
        results = await store.search(
            query=query,
            project_id=project_id,
            limit=limit,
            scope=scope,
            session_id=session_id,
        )
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return {
            "success": False,
            "error": f"Search failed: {e}",
        }

    hits = [
        {
            "session_title": r.session_title,
            "session_id": r.session_id,
            "role": r.role,
            "created_at": r.created_at,
            "text": r.text,
            "relevance": round(1.0 - r.distance, 3),  # cosine similarity
        }
        for r in results
    ]

    return {
        "success": True,
        "query": query,
        "count": len(hits),
        "hits": hits,
        "message": (
            f"{len(hits)} relevant passage(s) found for '{query}'."
            if hits
            else f"No hits for '{query}' in past sessions."
        ),
    }

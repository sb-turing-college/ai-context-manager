"""Document tool handlers.

Handles document search and read operations via AI tool calls.
"""

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import LibraryItem


async def handle_search_documents(
    db: AsyncSession,
    project_id: str,
    query: str,
    limit: int = 5
) -> dict:
    """Search documents in the library.
    
    Args:
        db: Database session
        project_id: Project ID
        query: Search query (searches title and content)
        limit: Maximum number of results
        
    Returns:
        Result dictionary with found documents
        
    Example:
        >>> result = await handle_search_documents(
        ...     db, "proj-123", "API", limit=3
        ... )
        >>> result["count"]
        2
    """
    query_lower = f"%{query.lower()}%"
    
    result = await db.execute(
        select(LibraryItem)
        .where(
            LibraryItem.project_id == project_id,
            or_(
                LibraryItem.title.ilike(query_lower),
                LibraryItem.content.ilike(query_lower)
            )
        )
        .limit(limit)
    )
    documents = result.scalars().all()
    
    return {
        "success": True,
        "count": len(documents),
        "documents": [
            {
                "id": doc.id,
                "title": doc.title,
                "type": doc.item_type,
                "preview": doc.content[:200] + "..." if len(doc.content) > 200 else doc.content
            }
            for doc in documents
        ],
        "message": f"{len(documents)} document(s) found for '{query}'."
    }


async def handle_read_document(
    db: AsyncSession,
    document_id: str
) -> dict:
    """Read full content of a document.
    
    Args:
        db: Database session
        document_id: Document ID
        
    Returns:
        Result dictionary with full document
        
    Raises:
        ValueError: If document not found
        
    Example:
        >>> result = await handle_read_document(db, "doc-123")
        >>> "content" in result
        True
    """
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise ValueError(f"Document with ID {document_id} not found.")
    
    return {
        "success": True,
        "document": {
            "id": document.id,
            "title": document.title,
            "type": document.item_type,
            "content": document.content,
            "created_at": document.created_at.isoformat() if document.created_at else None,
            "version": document.version
        },
        "message": f"Document '{document.title}' read successfully."
    }

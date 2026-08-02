"""Unit tests for document handlers.

Tests handler functions in isolation (no API calls).
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import LibraryItem
from src.services.tools.handlers import documents


# ============================================================================
# handle_search_documents Tests
# ============================================================================

@pytest.mark.asyncio
async def test_handle_search_documents_empty(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test searching documents when none exist."""
    result = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="API",
        limit=5
    )
    
    assert result["success"] is True
    assert result["count"] == 0
    assert result["documents"] == []
    assert "0 document(s)" in result["message"]


@pytest.mark.asyncio
async def test_handle_search_documents_by_title(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test searching documents by title."""
    # Create test documents
    from datetime import datetime, UTC
    
    doc1 = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="API Documentation",
        content="Some content about APIs",
        item_type="markdown",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    doc2 = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="User Guide",
        content="Guide for users",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add_all([doc1, doc2])
    await test_db_session.commit()
    
    # Search for "API"
    result = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="API",
        limit=5
    )
    
    assert result["success"] is True
    assert result["count"] == 1
    assert len(result["documents"]) == 1
    assert result["documents"][0]["title"] == "API Documentation"
    assert result["documents"][0]["type"] == "markdown"
    assert "id" in result["documents"][0]
    assert "preview" in result["documents"][0]


@pytest.mark.asyncio
async def test_handle_search_documents_by_content(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test searching documents by content."""
    from datetime import datetime, UTC
    
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Notes",
        content="This document contains information about FastAPI",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    
    # Search for "FastAPI" in content
    result = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="FastAPI",
        limit=5
    )
    
    assert result["success"] is True
    assert result["count"] == 1
    assert result["documents"][0]["title"] == "Notes"


@pytest.mark.asyncio
async def test_handle_search_documents_case_insensitive(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that search is case-insensitive."""
    from datetime import datetime, UTC
    
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Python Guide",
        content="Python is a programming language",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    
    # Search with different cases
    result1 = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="python",
        limit=5
    )
    result2 = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="PYTHON",
        limit=5
    )
    result3 = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="Python",
        limit=5
    )
    
    assert result1["count"] == 1
    assert result2["count"] == 1
    assert result3["count"] == 1


@pytest.mark.asyncio
async def test_handle_search_documents_limit(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that limit parameter works correctly."""
    from datetime import datetime, UTC
    
    # Create 10 documents
    docs = []
    for i in range(10):
        doc = LibraryItem(
            project_id=test_project_id_for_handlers,
            title=f"Document {i}",
            content=f"Content {i} with search term",
            item_type="text",
            version=1,
            history=[],
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )
        docs.append(doc)
    test_db_session.add_all(docs)
    await test_db_session.commit()
    
    # Search with limit=3
    result = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="search term",
        limit=3
    )
    
    assert result["count"] == 3
    assert len(result["documents"]) == 3


@pytest.mark.asyncio
async def test_handle_search_documents_only_project(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that search only returns documents from specified project."""
    from src.models import Project
    from datetime import datetime, UTC
    
    # Create second project
    project2 = Project(
        title="Project 2",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(project2)
    await test_db_session.commit()
    await test_db_session.refresh(project2)
    
    # Create documents in both projects
    doc1 = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Project 1 Doc",
        content="Content with search",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    doc2 = LibraryItem(
        project_id=project2.id,
        title="Project 2 Doc",
        content="Content with search",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add_all([doc1, doc2])
    await test_db_session.commit()
    
    # Search in project 1
    result = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="search",
        limit=5
    )
    
    assert result["count"] == 1
    assert result["documents"][0]["title"] == "Project 1 Doc"


@pytest.mark.asyncio
async def test_handle_search_documents_preview_truncation(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that preview is truncated at 200 characters."""
    from datetime import datetime, UTC
    
    long_content = "A" * 300  # 300 characters
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Long Document",
        content=long_content,
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    
    result = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="A",
        limit=5
    )
    
    assert result["count"] == 1
    preview = result["documents"][0]["preview"]
    assert len(preview) == 203  # 200 chars + "..."
    assert preview.endswith("...")


@pytest.mark.asyncio
async def test_handle_search_documents_preview_short_content(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that preview doesn't add ... for short content."""
    from datetime import datetime, UTC
    
    short_content = "Short content"  # < 200 chars
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Short Document",
        content=short_content,
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    
    result = await documents.handle_search_documents(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        query="Short",
        limit=5
    )
    
    assert result["count"] == 1
    preview = result["documents"][0]["preview"]
    assert preview == short_content
    assert not preview.endswith("...")


# ============================================================================
# handle_read_document Tests
# ============================================================================

@pytest.mark.asyncio
async def test_handle_read_document_valid(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test reading document with valid ID."""
    from datetime import datetime, UTC
    
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Test Document",
        content="Full document content here",
        item_type="markdown",
        version=2,
        history=[{"version": 1, "content": "Old content", "timestamp": "2024-01-01T00:00:00"}],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    await test_db_session.refresh(doc)
    
    result = await documents.handle_read_document(
        db=test_db_session,
        document_id=doc.id
    )
    
    assert result["success"] is True
    assert result["document"]["id"] == doc.id
    assert result["document"]["title"] == "Test Document"
    assert result["document"]["content"] == "Full document content here"
    assert result["document"]["type"] == "markdown"
    assert result["document"]["version"] == 2
    assert "read successfully" in result["message"]


@pytest.mark.asyncio
async def test_handle_read_document_nonexistent_raises_error(
    test_db_session: AsyncSession
):
    """Test reading non-existent document raises ValueError."""
    with pytest.raises(ValueError, match="not found"):
        await documents.handle_read_document(
            db=test_db_session,
            document_id="nonexistent-id"
        )


@pytest.mark.asyncio
async def test_handle_read_document_includes_created_at(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that read_document includes created_at timestamp."""
    from datetime import datetime, UTC
    
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Timestamp Test",
        content="Content",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    await test_db_session.refresh(doc)
    
    result = await documents.handle_read_document(
        db=test_db_session,
        document_id=doc.id
    )
    
    assert result["document"]["created_at"] is not None
    assert isinstance(result["document"]["created_at"], str)  # ISO format


@pytest.mark.asyncio
async def test_handle_read_document_full_content(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that read_document returns full content (not truncated)."""
    from datetime import datetime, UTC
    
    long_content = "A" * 1000  # 1000 characters
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Long Document",
        content=long_content,
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    await test_db_session.refresh(doc)
    
    result = await documents.handle_read_document(
        db=test_db_session,
        document_id=doc.id
    )
    
    assert len(result["document"]["content"]) == 1000
    assert result["document"]["content"] == long_content

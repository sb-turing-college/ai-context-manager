"""Unit tests for tool executor.

Tests tool routing and execution without LLM provider.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.tools.executor import execute_tool, format_tool_result_for_llm


# ============================================================================
# execute_tool Tests
# ============================================================================

@pytest.mark.asyncio
async def test_execute_tool_create_status(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test executing create_status tool."""
    result = await execute_tool(
        tool_name="create_status",
        parameters={
            "title": "Credits",
            "content": "1000",
            "reason": "Test"
        },
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["success"] is True
    assert result["title"] == "Credits"
    assert result["content"] == "1000"
    assert "topic_id" in result


@pytest.mark.asyncio
async def test_execute_tool_update_status(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test executing update_status tool."""
    # Create topic first
    from src.services.tools.handlers import status
    
    create_result = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Budget",
        content="5000"
    )
    topic_id = create_result["topic_id"]
    
    # Update via executor
    result = await execute_tool(
        tool_name="update_status",
        parameters={
            "topic_id": topic_id,
            "content": "4000",
            "reason": "Expense"
        },
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["success"] is True
    assert result["new_content"] == "4000"
    assert result["old_content"] == "5000"


@pytest.mark.asyncio
async def test_execute_tool_delete_status(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test executing delete_status tool."""
    # Create topic first
    from src.services.tools.handlers import status
    
    create_result = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="To Delete",
        content="Content"
    )
    topic_id = create_result["topic_id"]
    
    # Delete via executor
    result = await execute_tool(
        tool_name="delete_status",
        parameters={"topic_id": topic_id},
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["success"] is True
    assert result["topic_id"] == topic_id


@pytest.mark.asyncio
async def test_execute_tool_search_documents(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test executing search_documents tool."""
    # Create test document
    from src.models import LibraryItem
    from datetime import datetime, UTC
    
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="API Guide",
        content="Content about APIs",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    
    # Search via executor
    result = await execute_tool(
        tool_name="search_documents",
        parameters={"query": "API", "limit": 5},
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["success"] is True
    assert result["count"] == 1
    assert len(result["documents"]) == 1


@pytest.mark.asyncio
async def test_execute_tool_read_document(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test executing read_document tool."""
    # Create test document
    from src.models import LibraryItem
    from datetime import datetime, UTC
    
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Test Doc",
        content="Full content here",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    await test_db_session.commit()
    await test_db_session.refresh(doc)
    
    # Read via executor
    result = await execute_tool(
        tool_name="read_document",
        parameters={"document_id": doc.id},
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["success"] is True
    assert result["document"]["title"] == "Test Doc"
    assert result["document"]["content"] == "Full content here"


@pytest.mark.asyncio
async def test_execute_tool_create_draft():
    """Test executing create_draft tool (no DB needed)."""
    result = await execute_tool(
        tool_name="create_draft",
        parameters={
            "title": "Test Draft",
            "content": "Content",
            "reason": "Test"
        },
        db=None,  # Draft doesn't need DB
        project_id="dummy"
    )
    
    assert result["success"] is True
    assert result["draft"]["title"] == "Test Draft"
    assert result["action"] == "open_workshop"


@pytest.mark.asyncio
async def test_execute_tool_edit_draft():
    """Test executing edit_draft tool (no DB needed)."""
    result = await execute_tool(
        tool_name="edit_draft",
        parameters={
            "edits": [
                {"old_text": "Old", "new_text": "New"}
            ],
            "reason": "Test"
        },
        db=None,  # Draft doesn't need DB
        project_id="dummy"
    )
    
    assert result["success"] is True
    assert len(result["edits"]) == 1
    assert result["edit_count"] == 1
    assert result["action"] == "edit_workshop"


@pytest.mark.asyncio
async def test_execute_tool_unknown_tool_raises_error():
    """Test that unknown tool raises ValueError."""
    with pytest.raises(ValueError, match="Unknown tool"):
        await execute_tool(
            tool_name="unknown_tool",
            parameters={},
            db=None,
            project_id="dummy"
        )


@pytest.mark.asyncio
async def test_execute_tool_missing_parameters_uses_defaults(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that missing optional parameters use defaults."""
    # search_documents has default limit=5
    result = await execute_tool(
        tool_name="search_documents",
        parameters={"query": "test"},  # No limit parameter
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["success"] is True
    # Should work with default limit


# ============================================================================
# format_tool_result_for_llm Tests
# ============================================================================

def test_format_tool_result_create_status():
    """Test formatting create_status result."""
    result = {
        "success": True,
        "topic_id": "topic-123",
        "title": "Credits",
        "content": "1000",
        "message": "Status topic 'Credits' created successfully."
    }
    
    formatted = format_tool_result_for_llm("create_status", result)
    
    assert "✅" in formatted
    assert "Credits" in formatted
    assert "1000" in formatted
    assert "topic-123" in formatted


def test_format_tool_result_update_status():
    """Test formatting update_status result."""
    result = {
        "success": True,
        "message": "Status topic 'Budget' updated successfully.",
        "old_content": "5000",
        "new_content": "4000"
    }
    
    formatted = format_tool_result_for_llm("update_status", result)
    
    assert "✅" in formatted
    assert "5000" in formatted
    assert "4000" in formatted


def test_format_tool_result_search_documents_empty():
    """Test formatting search_documents result with no matches."""
    result = {
        "success": True,
        "count": 0,
        "documents": [],
        "query": "nonexistent"
    }
    
    formatted = format_tool_result_for_llm("search_documents", result)
    
    assert "ℹ️" in formatted
    assert "No documents found" in formatted
    assert "nonexistent" in formatted


def test_format_tool_result_search_documents_with_results():
    """Test formatting search_documents result with matches."""
    result = {
        "success": True,
        "count": 2,
        "documents": [
            {
                "id": "doc-1",
                "title": "API Guide",
                "type": "markdown",
                "preview": "Preview text..."
            },
            {
                "id": "doc-2",
                "title": "User Manual",
                "type": "text",
                "preview": "Another preview..."
            }
        ],
        "message": "2 document(s) found for 'API'."
    }
    
    formatted = format_tool_result_for_llm("search_documents", result)
    
    assert "✅" in formatted
    assert "API Guide" in formatted
    assert "User Manual" in formatted
    assert "doc-1" in formatted
    assert "doc-2" in formatted


def test_format_tool_result_read_document():
    """Test formatting read_document result."""
    result = {
        "success": True,
        "document": {
            "id": "doc-123",
            "title": "Test Document",
            "type": "markdown",
            "content": "Full document content here"
        },
        "message": "Document 'Test Document' read successfully."
    }
    
    formatted = format_tool_result_for_llm("read_document", result)
    
    assert "✅" in formatted
    assert "Test Document" in formatted
    assert "Full document content here" in formatted
    assert "markdown" in formatted


def test_format_tool_result_create_draft():
    """Test formatting create_draft result."""
    result = {
        "success": True,
        "message": "Draft 'Test' was created and opened in the workshop."
    }
    
    formatted = format_tool_result_for_llm("create_draft", result)
    
    assert "✅" in formatted
    assert "created" in formatted


def test_format_tool_result_edit_draft():
    """Test formatting edit_draft result."""
    result = {
        "success": True,
        "edit_count": 3,
        "message": "✅ 3 changes will be applied"
    }
    
    formatted = format_tool_result_for_llm("edit_draft", result)
    
    assert "✅" in formatted
    assert "3 changes" in formatted


def test_format_tool_result_edit_draft_singular():
    """Test formatting edit_draft result with singular form."""
    result = {
        "success": True,
        "edit_count": 1
    }
    
    formatted = format_tool_result_for_llm("edit_draft", result)
    
    assert "1 change" in formatted
    assert "changes" not in formatted


def test_format_tool_result_failure():
    """Test formatting failed tool result."""
    result = {
        "success": False,
        "error": "Validation error"
    }
    
    formatted = format_tool_result_for_llm("create_status", result)
    
    assert "❌" in formatted
    assert "Tool error" in formatted
    assert "Validation error" in formatted


def test_format_tool_result_unknown_tool():
    """Test formatting result for unknown tool (fallback)."""
    result = {
        "success": True,
        "message": "Custom message"
    }
    
    formatted = format_tool_result_for_llm("unknown_tool", result)
    
    assert formatted == "Custom message"


def test_format_tool_result_no_message_fallback():
    """Test formatting result without message (fallback)."""
    result = {
        "success": True
    }
    
    formatted = format_tool_result_for_llm("unknown_tool", result)
    
    assert formatted == "Tool executed successfully."

"""Tests for tool system."""

import pytest
from httpx import AsyncClient

from src.services.tools.definitions import get_tool_definition, get_tools_by_category
from src.services.tools.handlers import status, documents, draft


def test_get_tool_definition():
    """Test getting tool definition by name."""
    tool = get_tool_definition("create_status")
    assert tool is not None
    assert tool["name"] == "create_status"
    assert tool["category"] == "status"
    assert len(tool["parameters"]) > 0


def test_get_tools_by_category():
    """Test getting tools by category."""
    status_tools = get_tools_by_category("status")
    assert len(status_tools) == 3  # create, update, delete (read_status removed - status always in context)
    assert "create_status" in status_tools
    assert "update_status" in status_tools
    assert "delete_status" in status_tools
    # read_status was removed - status is always in context
    
    doc_tools = get_tools_by_category("documents")
    assert len(doc_tools) == 2
    
    workshop_tools = get_tools_by_category("workshop")
    assert len(workshop_tools) == 2  # create_draft, edit_draft
    assert "create_draft" in workshop_tools
    assert "edit_draft" in workshop_tools


@pytest.mark.asyncio
async def test_create_status_tool(test_db_session, test_project_id_for_handlers: str):
    """Test creating a status topic via tool (in-memory test DB)."""
    result = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Test Credits",
        content="1000",
        reason="Test",
    )

    assert result["success"] is True
    assert "Credits" in result["title"]
    assert result["content"] == "1000"


@pytest.mark.asyncio
async def test_read_status_tool(test_db_session, test_project_id_for_handlers: str):
    """Test reading status topics via tool (in-memory test DB)."""
    await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Test Topic",
        content="Test Value",
    )

    result = await status.handle_read_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
    )

    assert result["success"] is True
    assert result["count"] >= 1
    assert len(result["topics"]) >= 1


@pytest.mark.asyncio
async def test_create_draft_tool():
    """Test creating a draft via tool."""
    result = await draft.handle_create_draft(
        title="Test Draft",
        content="# Test\n\nThis is a test draft.",
        reason="Testing"
    )
    
    assert result["success"] is True
    assert result["draft"]["title"] == "Test Draft"
    assert result["action"] == "open_workshop"


@pytest.mark.asyncio
async def test_tool_calling_integration(async_client: AsyncClient, test_project_id: str):
    """Test full tool calling flow via API (mocked)."""
    from unittest.mock import AsyncMock, patch
    from src.services.llm.base import LLMResponse
    
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Tool Test Session"},
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["id"]
    
    # Mock LLM provider with tool call response
    mock_response = LLMResponse(
        content="Status topic 'Credits' created successfully.",
        model="gemini-3-pro-preview",
        usage={"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
        finish_reason="stop"
    )
    
    with patch("src.routers.chat.chat_send.create_provider") as mock_provider:
        mock_instance = AsyncMock()
        mock_instance.generate_text = AsyncMock(return_value=mock_response)
        mock_instance.generate_with_cache = AsyncMock(return_value=mock_response)
        mock_provider.return_value = mock_instance
        
        # Send message that should trigger tool use
        response = await async_client.post(
            "/api/v1/chat/send",
            json={
                "session_id": session_id,
                "message": "Create a status topic 'Credits' with value '1000'",
                "model": "gemini-3-pro-preview",
                "use_tools": True
            },
        )
        
        # Should succeed with mocked provider
        assert response.status_code == 200


@pytest.mark.asyncio
async def test_tool_calling_disabled(async_client: AsyncClient, test_project_id: str):
    """Test chat with tools disabled (mocked)."""
    from unittest.mock import AsyncMock, patch
    from src.services.llm.base import LLMResponse
    
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "No Tool Test"},
    )
    session_id = session_response.json()["id"]
    
    # Mock LLM provider
    mock_response = LLMResponse(
        content="Hello! How can I help you?",
        model="gemini-3-flash-preview",
        usage={"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18},
        finish_reason="stop"
    )
    
    with patch("src.routers.chat.chat_send.create_provider") as mock_provider:
        mock_instance = AsyncMock()
        mock_instance.generate_text = AsyncMock(return_value=mock_response)
        mock_instance.generate_with_cache = AsyncMock(return_value=mock_response)
        mock_provider.return_value = mock_instance
        
        # Send message with tools disabled
        response = await async_client.post(
            "/api/v1/chat/send",
            json={
                "session_id": session_id,
                "message": "Hello!",
                "use_tools": False
            },
        )
        
        # Should succeed with mocked provider
        assert response.status_code == 200

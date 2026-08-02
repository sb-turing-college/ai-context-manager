"""Error handling tests.

Tests that errors are handled correctly throughout the system.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from httpx import AsyncClient

from src.services.tools.orchestrator import execute_with_tools
from src.services.tools.executor import execute_tool
from src.services.llm.base import LLMMessage, LLMProvider


# ============================================================================
# Tool Orchestrator Error Handling
# ============================================================================

@pytest.mark.asyncio
async def test_tool_error_always_has_result_key(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that tool errors always have result key (fix for KeyError: 'result')."""
    mock_provider = MagicMock(spec=LLMProvider)
    mock_provider.model = "gemini-3-flash-preview"
    
    # Mock tool call that will fail
    tool_call_response = MagicMock()
    tool_call_response.candidates = []
    tool_call_response.text = ""
    
    with patch(
        "src.services.tools.orchestrator._call_gemini_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.return_value = tool_call_response
        
        with patch(
            "src.services.tools.orchestrator.extract_tool_calls_from_gemini"
        ) as mock_extract:
            # Return tool call that will fail
            mock_extract.return_value = [
                {"name": "read_document", "arguments": {"document_id": "nonexistent"}}
            ]
            
            # Mock execute_tool to raise exception
            with patch(
                "src.services.tools.orchestrator.execute_tool",
                new_callable=AsyncMock
            ) as mock_exec:
                mock_exec.side_effect = ValueError("Document not found")
                
                # Mock final response after error
                final_response = MagicMock()
                final_response.candidates = []
                final_response.text = "I couldn't find that document."
                mock_call.side_effect = [tool_call_response, final_response]
                mock_extract.side_effect = [
                    [{"name": "read_document", "arguments": {"document_id": "nonexistent"}}],
                    []  # No tool calls in final response
                ]
                
                response_text, tool_history, _ = await execute_with_tools(
                    provider=mock_provider,
                    messages=[LLMMessage(role="user", content="Read document")],
                    enabled_tools=["read_document"],
                    db=test_db_session,
                    project_id=test_project_id_for_handlers
                )
                
                # CRITICAL: result key must always be present
                assert len(tool_history) == 1
                assert "result" in tool_history[0]
                assert tool_history[0]["result"]["success"] is False
                assert "error" in tool_history[0]["result"]


@pytest.mark.asyncio
async def test_tool_error_passed_to_llm(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that tool errors are passed to LLM in messages."""
    mock_provider = MagicMock(spec=LLMProvider)
    mock_provider.model = "gemini-3-flash-preview"
    
    tool_call_response = MagicMock()
    tool_call_response.candidates = []
    tool_call_response.text = ""
    
    with patch(
        "src.services.tools.orchestrator._call_gemini_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        with patch(
            "src.services.tools.orchestrator.extract_tool_calls_from_gemini"
        ) as mock_extract:
            mock_extract.return_value = [
                {"name": "create_status", "arguments": {"title": "", "content": "value"}}
            ]
            
            with patch(
                "src.services.tools.orchestrator.execute_tool",
                new_callable=AsyncMock
            ) as mock_exec:
                mock_exec.side_effect = ValueError("title is required and must not be empty")
                
                # Final response
                final_response = MagicMock()
                final_response.candidates = []
                final_response.text = "I understand the error."
                mock_call.side_effect = [tool_call_response, final_response]
                mock_extract.side_effect = [
                    [{"name": "create_status", "arguments": {"title": "", "content": "value"}}],
                    []
                ]
                
                response_text, tool_history, _ = await execute_with_tools(
                    provider=mock_provider,
                    messages=[LLMMessage(role="user", content="Create status")],
                    enabled_tools=["create_status"],
                    db=test_db_session,
                    project_id=test_project_id_for_handlers
                )
                
                # Error should be in history (plain EN error string, no emoji)
                assert tool_history[0]["result"]["success"] is False
                formatted = tool_history[0]["formatted_result"]
                assert "Tool execution error" in formatted
                assert "title is required" in formatted


# ============================================================================
# Tool Executor Error Handling
# ============================================================================

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
async def test_execute_tool_invalid_parameters_raises_error(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that invalid parameters raise appropriate errors."""
    # Empty title should raise ValueError
    with pytest.raises(ValueError, match="title is required"):
        await execute_tool(
            tool_name="create_status",
            parameters={"title": "", "content": "value"},
            db=test_db_session,
            project_id=test_project_id_for_handlers
        )


# ============================================================================
# API-Level Error Handling
# ============================================================================

@pytest.mark.asyncio
async def test_chat_api_validation_error_400(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test that validation errors return 400."""
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Test"},
    )
    session_id = session_response.json()["id"]
    
    # Empty message should return 422 (validation error)
    response = await async_client.post(
        "/api/v1/chat/send",
        json={
            "session_id": session_id,
            "message": "",  # Empty message
        },
    )
    
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_chat_api_invalid_temperature_422(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test that invalid temperature returns 422."""
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Test"},
    )
    session_id = session_response.json()["id"]
    
    # Temperature out of range
    response = await async_client.post(
        "/api/v1/chat/send",
        json={
            "session_id": session_id,
            "message": "Test",
            "temperature": 5.0,  # Out of range (0-2)
        },
    )
    
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_api_llm_error_500(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test that LLM API errors return 500."""
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Test"},
    )
    session_id = session_response.json()["id"]
    
    # Mock LLM to raise error
    with patch("src.routers.chat.chat_send.create_provider") as mock_provider:
        mock_instance = AsyncMock()
        mock_instance.generate_text = AsyncMock(side_effect=Exception("API Error"))
        mock_instance.generate_with_cache = AsyncMock(side_effect=Exception("API Error"))
        mock_provider.return_value = mock_instance
        
        response = await async_client.post(
            "/api/v1/chat/send",
            json={
                "session_id": session_id,
                "message": "Test",
                "use_tools": False,
            },
        )
        
        assert response.status_code == 500
        assert "API Error" in response.json()["detail"]


@pytest.mark.asyncio
async def test_chat_api_session_not_found_404(
    async_client: AsyncClient
):
    """Test that non-existent session returns 404."""
    response = await async_client.post(
        "/api/v1/chat/send",
        json={
            "session_id": "nonexistent-session",
            "message": "Test",
        },
    )
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ============================================================================
# Handler-Level Error Handling
# ============================================================================

@pytest.mark.asyncio
async def test_handler_validation_error_empty_title(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that handler validates empty title."""
    from src.services.tools.handlers import status
    
    with pytest.raises(ValueError, match="title is required"):
        await status.handle_create_status(
            db=test_db_session,
            project_id=test_project_id_for_handlers,
            title="",
            content="value"
        )


@pytest.mark.asyncio
async def test_handler_validation_error_whitespace_title(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that handler validates whitespace-only title."""
    from src.services.tools.handlers import status
    
    with pytest.raises(ValueError, match="title is required"):
        await status.handle_create_status(
            db=test_db_session,
            project_id=test_project_id_for_handlers,
            title="   ",
            content="value"
        )


@pytest.mark.asyncio
async def test_handler_validation_error_empty_content(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that handler validates empty content."""
    from src.services.tools.handlers import status
    
    with pytest.raises(ValueError, match="content is required"):
        await status.handle_create_status(
            db=test_db_session,
            project_id=test_project_id_for_handlers,
            title="Title",
            content=""
        )


@pytest.mark.asyncio
async def test_handler_error_nonexistent_id(
    test_db_session: AsyncSession
):
    """Test that handler returns empty result for non-existent project (not an error)."""
    from src.services.tools.handlers import status
    
    result = await status.handle_read_status(
        db=test_db_session,
        project_id="nonexistent-project"
    )
    
    # Empty project returns success=True with count=0
    assert result["success"] is True
    assert result["count"] == 0


@pytest.mark.asyncio
async def test_handler_error_update_nonexistent_topic(
    test_db_session: AsyncSession
):
    """Test that handler raises ValueError for non-existent topic update."""
    from src.services.tools.handlers import status
    
    # Handler raises ValueError, orchestrator catches it
    with pytest.raises(ValueError, match="not found"):
        await status.handle_update_status(
            db=test_db_session,
            topic_id="nonexistent-topic",
            content="New value",
            reason=None
        )


@pytest.mark.asyncio
async def test_handler_error_delete_nonexistent_topic(
    test_db_session: AsyncSession
):
    """Test that handler raises ValueError for non-existent topic deletion."""
    from src.services.tools.handlers import status
    
    # Handler raises ValueError, orchestrator catches it
    with pytest.raises(ValueError, match="not found"):
        await status.handle_delete_status(
            db=test_db_session,
            topic_id="nonexistent-topic"
        )


@pytest.mark.asyncio
async def test_handler_error_read_nonexistent_document(
    test_db_session: AsyncSession
):
    """Test that handler raises ValueError for non-existent document."""
    from src.services.tools.handlers import documents
    
    # Handler raises ValueError, orchestrator catches it
    with pytest.raises(ValueError, match="not found"):
        await documents.handle_read_document(
            db=test_db_session,
            document_id="nonexistent-doc"
        )


# ============================================================================
# Format Tool Result Error Handling
# ============================================================================

def test_format_tool_result_error_handling():
    """Test that format_tool_result_for_llm handles errors correctly."""
    from src.services.tools.executor import format_tool_result_for_llm
    
    # Error result
    error_result = {
        "success": False,
        "error": "Validation error"
    }
    
    formatted = format_tool_result_for_llm("create_status", error_result)
    
    assert "❌" in formatted
    assert "Tool error" in formatted
    assert "Validation error" in formatted


def test_format_tool_result_missing_error_message():
    """Test that format_tool_result_for_llm handles missing error message."""
    from src.services.tools.executor import format_tool_result_for_llm
    
    # Error result without error message
    error_result = {
        "success": False
    }
    
    formatted = format_tool_result_for_llm("create_status", error_result)
    
    assert "❌" in formatted
    assert "Unknown error" in formatted

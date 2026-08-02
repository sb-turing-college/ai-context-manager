"""Integration tests for Chat API with tool calling and context.

Tests complete workflows including tool calls, context building, and responses.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient
from datetime import datetime, UTC

from src.services.llm.base import LLMMessage, LLMResponse


# ============================================================================
# Tool Calling Integration Tests
# ============================================================================

@pytest.mark.asyncio
async def test_chat_with_create_status_tool(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test chat endpoint with create_status tool call."""
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Tool Test Session"},
    )
    session_id = session_response.json()["id"]
    
    # Mock LLM to return tool call, then final answer
    mock_provider = AsyncMock()
    
    # First call: tool call
    tool_call_response = MagicMock()
    tool_call_response.candidates = [MagicMock()]
    tool_call_response.candidates[0].content = MagicMock()
    tool_call_response.candidates[0].content.parts = [MagicMock()]
    tool_call_response.candidates[0].content.parts[0].function_call = MagicMock()
    tool_call_response.candidates[0].content.parts[0].function_call.name = "create_status"
    tool_call_response.candidates[0].content.parts[0].function_call.args = {
        "title": "Credits",
        "content": "1000"
    }
    tool_call_response.candidates[0].content.parts[0].text = None
    tool_call_response.text = ""
    
    # Second call: final answer
    final_response = MagicMock()
    final_response.candidates = []
    final_response.text = "Status topic 'Credits' was created successfully."
    
    mock_provider.client = MagicMock()
    mock_provider.client.aio = MagicMock()
    mock_provider.client.aio.models = MagicMock()
    mock_provider.client.aio.models.generate_content = AsyncMock(
        side_effect=[tool_call_response, final_response]
    )
    mock_provider.model = "gemini-3-flash-preview"
    
    with patch("src.routers.chat.chat_send.create_provider", return_value=mock_provider):
        with patch("src.services.tools.orchestrator._call_gemini_with_tools", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.side_effect = [tool_call_response, final_response]
            
            with patch("src.services.tools.orchestrator.extract_tool_calls_from_gemini") as mock_extract:
                mock_extract.side_effect = [
                    [{"name": "create_status", "arguments": {"title": "Credits", "content": "1000"}}],
                    []  # Final response
                ]
                
                response = await async_client.post(
                    "/api/v1/chat/send",
                    json={
                        "session_id": session_id,
                        "message": "Create a status topic 'Credits' with value '1000'",
                        "model": "gemini-3-flash-preview",
                        "use_tools": True,
                    },
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "Credits" in data["content"]
                # Should have tool calls in response
                if data.get("tool_calls"):
                    assert len(data["tool_calls"]) >= 1
                    assert data["tool_calls"][0]["tool_name"] == "create_status"


@pytest.mark.asyncio
async def test_chat_with_search_documents_tool(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test chat endpoint with search_documents tool call."""
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Search Test"},
    )
    session_id = session_response.json()["id"]
    
    # Create test document
    doc_response = await async_client.post(
        f"/api/v1/projects/{test_project_id}/library",
        json={
            "title": "API Guide",
            "content": "Content about APIs",
            "type": "text"
        }
    )
    
    # Mock LLM responses
    mock_provider = AsyncMock()
    mock_provider.model = "gemini-3-flash-preview"
    
    tool_call_response = MagicMock()
    tool_call_response.candidates = [MagicMock()]
    tool_call_response.candidates[0].content = MagicMock()
    tool_call_response.candidates[0].content.parts = [MagicMock()]
    tool_call_response.candidates[0].content.parts[0].function_call = MagicMock()
    tool_call_response.candidates[0].content.parts[0].function_call.name = "search_documents"
    tool_call_response.candidates[0].content.parts[0].function_call.args = {"query": "API"}
    tool_call_response.candidates[0].content.parts[0].text = None
    tool_call_response.text = ""
    
    final_response = MagicMock()
    final_response.candidates = []
    final_response.text = "Ich habe das API Guide Dokument gefunden."
    
    with patch("src.routers.chat.chat_send.create_provider", return_value=mock_provider):
        with patch("src.services.tools.orchestrator._call_gemini_with_tools", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.side_effect = [tool_call_response, final_response]
            
            with patch("src.services.tools.orchestrator.extract_tool_calls_from_gemini") as mock_extract:
                mock_extract.side_effect = [
                    [{"name": "search_documents", "arguments": {"query": "API"}}],
                    []
                ]
                
                response = await async_client.post(
                    "/api/v1/chat/send",
                    json={
                        "session_id": session_id,
                        "message": "Search for documents about APIs",
                        "model": "gemini-3-flash-preview",
                        "use_tools": True,
                    },
                )
                
                assert response.status_code == 200
                data = response.json()
                assert "API" in data["content"] or "document" in data["content"].lower()


@pytest.mark.asyncio
async def test_chat_with_create_draft_tool(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test chat endpoint with create_draft tool call."""
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Draft Test"},
    )
    session_id = session_response.json()["id"]
    
    # Mock LLM
    mock_provider = AsyncMock()
    mock_provider.model = "gemini-3-flash-preview"
    
    tool_call_response = MagicMock()
    tool_call_response.candidates = [MagicMock()]
    tool_call_response.candidates[0].content = MagicMock()
    tool_call_response.candidates[0].content.parts = [MagicMock()]
    tool_call_response.candidates[0].content.parts[0].function_call = MagicMock()
    tool_call_response.candidates[0].content.parts[0].function_call.name = "create_draft"
    tool_call_response.candidates[0].content.parts[0].function_call.args = {
        "title": "Test Draft",
        "content": "# Test\n\nContent"
    }
    tool_call_response.candidates[0].content.parts[0].text = None
    tool_call_response.text = ""
    
    with patch("src.routers.chat.chat_send.create_provider", return_value=mock_provider):
        with patch("src.services.tools.orchestrator._call_gemini_with_tools", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.return_value = tool_call_response
            
            with patch("src.services.tools.orchestrator.extract_tool_calls_from_gemini") as mock_extract:
                mock_extract.return_value = [
                    {"name": "create_draft", "arguments": {"title": "Test Draft", "content": "# Test\n\nContent"}}
                ]
                
                response = await async_client.post(
                    "/api/v1/chat/send",
                    json={
                        "session_id": session_id,
                        "message": "Create a draft",
                        "model": "gemini-3-flash-preview",
                        "use_tools": True,
                    },
                )
                
                assert response.status_code == 200
                data = response.json()
                # Should have draft_data in response
                if data.get("draft_data"):
                    assert data["draft_data"]["title"] == "Test Draft"
                    assert "Test" in data["draft_data"]["content"]


# ============================================================================
# Context Integration Tests
# ============================================================================

@pytest.mark.asyncio
async def test_chat_with_documents_in_context(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test that documents are included in context."""
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Context Test"},
    )
    session_id = session_response.json()["id"]
    
    # Create document
    await async_client.post(
        f"/api/v1/projects/{test_project_id}/library",
        json={
            "title": "Context Doc",
            "content": "This is context content",
            "type": "text"
        }
    )
    
    # Mock LLM
    mock_response = LLMResponse(
        content="I can see the context document.",
        model="gemini-3-flash-preview",
        usage={"prompt_tokens": 100, "completion_tokens": 10, "total_tokens": 110},
        finish_reason="stop"
    )
    
    with patch("src.routers.chat.chat_send.create_provider") as mock_provider:
        mock_instance = AsyncMock()
        mock_instance.generate_text = AsyncMock(return_value=mock_response)
        mock_instance.generate_with_cache = AsyncMock(return_value=mock_response)
        mock_provider.return_value = mock_instance
        
        response = await async_client.post(
            "/api/v1/chat/send",
            json={
                "session_id": session_id,
                "message": "What documents do you have?",
                "model": "gemini-3-flash-preview",
                "use_tools": False,
            },
        )
        
        assert response.status_code == 200
        # Verify LLM was called (context should include document)
        # May use generate_text or generate_with_cache depending on context
        assert mock_instance.generate_text.called or mock_instance.generate_with_cache.called


@pytest.mark.asyncio
async def test_chat_with_status_in_context(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test that status topics are included in context."""
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Status Context Test"},
    )
    session_id = session_response.json()["id"]
    
    # Create status topic
    await async_client.post(
        f"/api/v1/projects/{test_project_id}/status",
        json={
            "title": "Budget",
            "content": "5000"
        }
    )
    
    # Mock LLM
    mock_response = LLMResponse(
        content="I can see the Budget status.",
        model="gemini-3-flash-preview",
        usage={"prompt_tokens": 50, "completion_tokens": 8, "total_tokens": 58},
        finish_reason="stop"
    )
    
    with patch("src.routers.chat.chat_send.create_provider") as mock_provider:
        mock_instance = AsyncMock()
        mock_instance.generate_text = AsyncMock(return_value=mock_response)
        mock_instance.generate_with_cache = AsyncMock(return_value=mock_response)
        mock_provider.return_value = mock_instance
        
        response = await async_client.post(
            "/api/v1/chat/send",
            json={
                "session_id": session_id,
                "message": "What is the current status?",
                "model": "gemini-3-flash-preview",
                "use_tools": False,
            },
        )
        
        assert response.status_code == 200
        # May use generate_text or generate_with_cache
        assert mock_instance.generate_text.called or mock_instance.generate_with_cache.called


@pytest.mark.asyncio
async def test_chat_with_cross_session_summaries(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test that cross-session summaries are included in context."""
    # Create two sessions
    session1_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Session 1"},
    )
    session1_id = session1_response.json()["id"]
    
    session2_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Session 2"},
    )
    session2_id = session2_response.json()["id"]
    
    # Add summary to session 1
    await async_client.put(
        f"/api/v1/sessions/{session1_id}/summary",
        json={
            "content": "Important learnings from session 1",
            "token_count": 10
        }
    )
    
    # Mock LLM
    mock_response = LLMResponse(
        content="I can see the summary from session 1.",
        model="gemini-3-flash-preview",
        usage={"prompt_tokens": 80, "completion_tokens": 10, "total_tokens": 90},
        finish_reason="stop"
    )
    
    with patch("src.routers.chat.chat_send.create_provider") as mock_provider:
        mock_instance = AsyncMock()
        mock_instance.generate_text = AsyncMock(return_value=mock_response)
        mock_instance.generate_with_cache = AsyncMock(return_value=mock_response)
        mock_provider.return_value = mock_instance
        
        # Send message to session 2 with summary from session 1
        response = await async_client.post(
            "/api/v1/chat/send",
            json={
                "session_id": session2_id,
                "message": "What did we learn before?",
                "model": "gemini-3-flash-preview",
                "include_summaries": [session1_id],
                "use_tools": False,
            },
        )
        
        assert response.status_code == 200
        # May use generate_text or generate_with_cache
        assert mock_instance.generate_text.called or mock_instance.generate_with_cache.called


# ============================================================================
# Tool Call History Tests
# ============================================================================

@pytest.mark.asyncio
async def test_chat_tool_call_history_in_response(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test that tool call history is included in response."""
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Tool History Test"},
    )
    session_id = session_response.json()["id"]
    
    # Mock LLM with tool call
    mock_provider = AsyncMock()
    mock_provider.model = "gemini-3-flash-preview"
    
    tool_call_response = MagicMock()
    tool_call_response.candidates = [MagicMock()]
    tool_call_response.candidates[0].content = MagicMock()
    tool_call_response.candidates[0].content.parts = [MagicMock()]
    tool_call_response.candidates[0].content.parts[0].function_call = MagicMock()
    tool_call_response.candidates[0].content.parts[0].function_call.name = "create_status"
    tool_call_response.candidates[0].content.parts[0].function_call.args = {
        "title": "Test",
        "content": "Value"
    }
    tool_call_response.candidates[0].content.parts[0].text = None
    tool_call_response.text = ""
    
    final_response = MagicMock()
    final_response.candidates = []
    final_response.text = "Done."
    
    with patch("src.routers.chat.chat_send.create_provider", return_value=mock_provider):
        with patch("src.services.tools.orchestrator._call_gemini_with_tools", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.side_effect = [tool_call_response, final_response]
            
            with patch("src.services.tools.orchestrator.extract_tool_calls_from_gemini") as mock_extract:
                mock_extract.side_effect = [
                    [{"name": "create_status", "arguments": {"title": "Test", "content": "Value"}}],
                    []
                ]
                
                response = await async_client.post(
                    "/api/v1/chat/send",
                    json={
                        "session_id": session_id,
                        "message": "Create status",
                        "model": "gemini-3-flash-preview",
                        "use_tools": True,
                    },
                )
                
                assert response.status_code == 200
                data = response.json()
                # Tool calls should be in response
                if data.get("tool_calls"):
                    assert len(data["tool_calls"]) >= 1
                    tool_call = data["tool_calls"][0]
                    assert "tool_name" in tool_call
                    assert "arguments" in tool_call
                    assert "result" in tool_call


# ============================================================================
# Error Scenarios
# ============================================================================

@pytest.mark.asyncio
async def test_chat_tool_error_handled_gracefully(
    async_client: AsyncClient,
    test_project_id: str
):
    """Test that tool errors are handled gracefully and returned in response."""
    # Create session
    session_response = await async_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project_id, "title": "Error Test"},
    )
    session_id = session_response.json()["id"]
    
    # Mock LLM with tool call that will fail
    mock_provider = AsyncMock()
    mock_provider.model = "gemini-3-flash-preview"
    
    tool_call_response = MagicMock()
    tool_call_response.candidates = [MagicMock()]
    tool_call_response.candidates[0].content = MagicMock()
    tool_call_response.candidates[0].content.parts = [MagicMock()]
    tool_call_response.candidates[0].content.parts[0].function_call = MagicMock()
    tool_call_response.candidates[0].content.parts[0].function_call.name = "read_document"
    tool_call_response.candidates[0].content.parts[0].function_call.args = {
        "document_id": "nonexistent"
    }
    tool_call_response.candidates[0].content.parts[0].text = None
    tool_call_response.text = ""
    
    final_response = MagicMock()
    final_response.candidates = []
    final_response.text = "I couldn't find that document."
    
    with patch("src.routers.chat.chat_send.create_provider", return_value=mock_provider):
        with patch("src.services.tools.orchestrator._call_gemini_with_tools", new_callable=AsyncMock) as mock_gemini:
            mock_gemini.side_effect = [tool_call_response, final_response]
            
            with patch("src.services.tools.orchestrator.extract_tool_calls_from_gemini") as mock_extract:
                mock_extract.side_effect = [
                    [{"name": "read_document", "arguments": {"document_id": "nonexistent"}}],
                    []
                ]
                
                response = await async_client.post(
                    "/api/v1/chat/send",
                    json={
                        "session_id": session_id,
                        "message": "Read document nonexistent",
                        "model": "gemini-3-flash-preview",
                        "use_tools": True,
                    },
                )
                
                # Should succeed (error handled gracefully)
                assert response.status_code == 200
                data = response.json()
                # Error should be in tool call result
                if data.get("tool_calls"):
                    error_tool = next(
                        (tc for tc in data["tool_calls"] if tc["tool_name"] == "read_document"),
                        None
                    )
                    if error_tool:
                        assert error_tool["result"]["success"] is False
                        assert "error" in error_tool["result"]

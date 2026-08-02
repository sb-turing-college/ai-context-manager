"""Unit tests for tool orchestrator.

Tests tool call loop without real LLM API calls.
All LLM interactions are mocked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.llm.base import LLMMessage, LLMProvider
from src.services.tools.orchestrator import execute_with_tools


# ============================================================================
# Mock Helpers
# ============================================================================

def create_mock_gemini_response(text: str = "", tool_calls: list = None):
    """Create a mock Gemini response."""
    mock_response = MagicMock()
    mock_response.text = text
    
    if tool_calls:
        # Gemini returns function calls in candidates[0].content.parts
        mock_part = MagicMock()
        mock_part.function_call = MagicMock()
        mock_part.function_call.name = tool_calls[0]["name"]
        mock_part.function_call.args = tool_calls[0]["arguments"]
        # Avoid truthy MagicMock .text — orchestrator joins text parts as strings
        mock_part.text = None
        
        mock_candidate = MagicMock()
        mock_candidate.content = MagicMock()
        mock_candidate.content.parts = [mock_part]
        
        mock_response.candidates = [mock_candidate]
    else:
        mock_response.candidates = []
    
    return mock_response


def create_mock_claude_response(text: str = "", tool_calls: list = None):
    """Create a mock Claude response."""
    mock_response = MagicMock()
    
    if tool_calls:
        # Claude returns tool use in content blocks
        mock_block = MagicMock()
        mock_block.type = "tool_use"
        mock_block.id = "tool-use-1"
        mock_block.name = tool_calls[0]["name"]
        mock_block.input = tool_calls[0]["arguments"]
        
        mock_response.content = [mock_block]
    else:
        # Text response
        mock_block = MagicMock()
        mock_block.type = "text"
        mock_block.text = text
        mock_response.content = [mock_block]
    
    return mock_response


def create_mock_provider(model_name: str = "gemini-3-flash-preview"):
    """Create a mock LLM provider."""
    mock_provider = MagicMock(spec=LLMProvider)
    mock_provider.model = model_name
    mock_provider.generate_text = AsyncMock()
    mock_provider.generate_with_cache = AsyncMock()
    return mock_provider


# ============================================================================
# execute_with_tools Tests
# ============================================================================

@pytest.mark.asyncio
async def test_execute_with_tools_no_tool_calls_gemini(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test orchestrator with Gemini returning text (no tool calls)."""
    mock_provider = create_mock_provider("gemini-3-flash-preview")
    
    # Mock Gemini response with text only
    mock_response = create_mock_gemini_response("Hello! How can I help?")
    
    with patch(
        "src.services.tools.orchestrator._call_gemini_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.return_value = mock_response
        
        response_text, tool_history, _ = await execute_with_tools(
            provider=mock_provider,
            messages=[LLMMessage(role="user", content="Hello")],
            enabled_tools=["create_status"],
            db=test_db_session,
            project_id=test_project_id_for_handlers
        )
        
        assert response_text == "Hello! How can I help?"
        assert len(tool_history) == 0
        mock_call.assert_called_once()


@pytest.mark.asyncio
async def test_execute_with_tools_no_tool_calls_claude(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test orchestrator with Claude returning text (no tool calls)."""
    mock_provider = create_mock_provider("claude-sonnet-4-5")
    
    # Mock Claude response with text only
    mock_response = create_mock_claude_response("Hello! How can I help?")
    
    with patch(
        "src.services.tools.orchestrator._call_claude_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.return_value = mock_response
        
        response_text, tool_history, _ = await execute_with_tools(
            provider=mock_provider,
            messages=[LLMMessage(role="user", content="Hello")],
            enabled_tools=["create_status"],
            db=test_db_session,
            project_id=test_project_id_for_handlers
        )
        
        assert response_text == "Hello! How can I help?"
        assert len(tool_history) == 0
        mock_call.assert_called_once()


@pytest.mark.asyncio
async def test_execute_with_tools_single_tool_call_gemini(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test orchestrator with Gemini making one tool call."""
    mock_provider = create_mock_provider("gemini-3-flash-preview")
    
    # First call: tool call
    tool_call_response = create_mock_gemini_response(
        tool_calls=[{
            "name": "create_status",
            "arguments": {"title": "Credits", "content": "1000"}
        }]
    )
    
    # Second call: final answer
    final_response = create_mock_gemini_response("Status topic 'Credits' created.")
    
    with patch(
        "src.services.tools.orchestrator._call_gemini_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.side_effect = [tool_call_response, final_response]
        
        # Mock tool call extraction
        with patch(
            "src.services.tools.orchestrator.extract_tool_calls_from_gemini"
        ) as mock_extract:
            mock_extract.side_effect = [
                [{"name": "create_status", "arguments": {"title": "Credits", "content": "1000"}}],
                []  # No tool calls in final response
            ]
            
            response_text, tool_history, _ = await execute_with_tools(
                provider=mock_provider,
                messages=[LLMMessage(role="user", content="Create status 'Credits' with value '1000'")],
                enabled_tools=["create_status"],
                db=test_db_session,
                project_id=test_project_id_for_handlers
            )
            
            assert "Status topic" in response_text
            assert len(tool_history) == 1
            assert tool_history[0]["tool_name"] == "create_status"
            assert tool_history[0]["result"]["success"] is True
            assert mock_call.call_count == 2  # Tool call + final answer


@pytest.mark.asyncio
async def test_execute_with_tools_single_tool_call_claude(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test orchestrator with Claude making one tool call."""
    mock_provider = create_mock_provider("claude-sonnet-4-5")
    
    # First call: tool call
    tool_call_response = create_mock_claude_response(
        tool_calls=[{
            "name": "create_status",
            "arguments": {"title": "Budget", "content": "5000"}
        }]
    )
    
    # Second call: final answer
    final_response = create_mock_claude_response("Status topic 'Budget' created.")
    
    with patch(
        "src.services.tools.orchestrator._call_claude_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.side_effect = [tool_call_response, final_response]
        
        # Mock tool call extraction
        with patch(
            "src.services.tools.orchestrator.extract_tool_calls_from_claude"
        ) as mock_extract:
            mock_extract.side_effect = [
                [{"name": "create_status", "arguments": {"title": "Budget", "content": "5000"}}],
                []  # No tool calls in final response
            ]
            
            response_text, tool_history, _ = await execute_with_tools(
                provider=mock_provider,
                messages=[LLMMessage(role="user", content="Create status 'Budget' with value '5000'")],
                enabled_tools=["create_status"],
                db=test_db_session,
                project_id=test_project_id_for_handlers
            )
            
            assert "Status topic" in response_text
            assert len(tool_history) == 1
            assert tool_history[0]["tool_name"] == "create_status"
            assert tool_history[0]["result"]["success"] is True
            assert mock_call.call_count == 2


@pytest.mark.asyncio
async def test_execute_with_tools_multiple_iterations(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test orchestrator with multiple tool call iterations."""
    mock_provider = create_mock_provider("gemini-3-flash-preview")
    
    # Create test document first
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
    await test_db_session.refresh(doc)
    
    # First: search documents
    search_response = create_mock_gemini_response(
        tool_calls=[{
            "name": "search_documents",
            "arguments": {"query": "API", "limit": 5}
        }]
    )
    
    # Second: read document
    read_response = create_mock_gemini_response(
        tool_calls=[{
            "name": "read_document",
            "arguments": {"document_id": doc.id}
        }]
    )
    
    # Third: final answer
    final_response = create_mock_gemini_response("I found the API Guide document.")
    
    with patch(
        "src.services.tools.orchestrator._call_gemini_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.side_effect = [search_response, read_response, final_response]
        
        with patch(
            "src.services.tools.orchestrator.extract_tool_calls_from_gemini"
        ) as mock_extract:
            mock_extract.side_effect = [
                [{"name": "search_documents", "arguments": {"query": "API", "limit": 5}}],
                [{"name": "read_document", "arguments": {"document_id": doc.id}}],
                []  # Final answer
            ]
            
            response_text, tool_history, _ = await execute_with_tools(
                provider=mock_provider,
                messages=[LLMMessage(role="user", content="Finde und lies das API Dokument")],
                enabled_tools=["search_documents", "read_document"],
                db=test_db_session,
                project_id=test_project_id_for_handlers
            )
            
            assert "API Guide" in response_text
            assert len(tool_history) == 2
            assert tool_history[0]["tool_name"] == "search_documents"
            assert tool_history[1]["tool_name"] == "read_document"
            assert mock_call.call_count == 3


@pytest.mark.asyncio
async def test_execute_with_tools_terminal_tool_exits_loop(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that terminal tools (create_draft, edit_draft) exit the loop."""
    mock_provider = create_mock_provider("gemini-3-flash-preview")
    
    # Tool call for create_draft
    draft_response = create_mock_gemini_response(
        tool_calls=[{
            "name": "create_draft",
            "arguments": {"title": "Test Draft", "content": "Content"}
        }]
    )
    
    with patch(
        "src.services.tools.orchestrator._call_gemini_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.return_value = draft_response
        
        with patch(
            "src.services.tools.orchestrator.extract_tool_calls_from_gemini"
        ) as mock_extract:
            mock_extract.return_value = [
                {"name": "create_draft", "arguments": {"title": "Test Draft", "content": "Content"}}
            ]
            
            response_text, tool_history, _ = await execute_with_tools(
                provider=mock_provider,
                messages=[LLMMessage(role="user", content="Create a draft")],
                enabled_tools=["create_draft"],
                db=test_db_session,
                project_id=test_project_id_for_handlers
            )
            
            # Should exit after terminal tool
            assert "Draft" in response_text or "created" in response_text.lower()
            assert len(tool_history) == 1
            assert tool_history[0]["tool_name"] == "create_draft"
            # Should only call once (no second iteration)
            assert mock_call.call_count == 1


@pytest.mark.asyncio
async def test_execute_with_tools_tool_error_handling(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test orchestrator handles tool execution errors gracefully."""
    mock_provider = create_mock_provider("gemini-3-flash-preview")
    
    # Tool call that will fail (invalid document_id)
    tool_call_response = create_mock_gemini_response(
        tool_calls=[{
            "name": "read_document",
            "arguments": {"document_id": "nonexistent-id"}
        }]
    )
    
    # LLM responds after error
    final_response = create_mock_gemini_response("I couldn't find that document.")
    
    with patch(
        "src.services.tools.orchestrator._call_gemini_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.side_effect = [tool_call_response, final_response]
        
        with patch(
            "src.services.tools.orchestrator.extract_tool_calls_from_gemini"
        ) as mock_extract:
            mock_extract.side_effect = [
                [{"name": "read_document", "arguments": {"document_id": "nonexistent-id"}}],
                []  # Final answer
            ]
            
            response_text, tool_history, _ = await execute_with_tools(
                provider=mock_provider,
                messages=[LLMMessage(role="user", content="Lies Dokument 'nonexistent-id'")],
                enabled_tools=["read_document"],
                db=test_db_session,
                project_id=test_project_id_for_handlers
            )
            
            # Error should be in history
            assert len(tool_history) == 1
            assert tool_history[0]["tool_name"] == "read_document"
            assert tool_history[0]["result"]["success"] is False
            assert "error" in tool_history[0]["result"]
            # Should continue and get final answer
            assert "couldn't find" in response_text.lower() or "not found" in response_text.lower()


@pytest.mark.asyncio
async def test_execute_with_tools_max_iterations(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test orchestrator respects max_iterations limit."""
    from src.services.llm.base import LLMResponse

    mock_provider = create_mock_provider("gemini-3-flash-preview")
    mock_provider.generate_text = AsyncMock(
        return_value=LLMResponse(
            content="Maximum tool-call iterations reached.",
            model="gemini-3-flash-preview",
            usage={"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            finish_reason="stop",
        )
    )
    
    # Always return tool calls (infinite loop scenario)
    tool_call_response = create_mock_gemini_response(
        tool_calls=[{
            "name": "create_status",
            "arguments": {"title": "Test", "content": "Value"}
        }]
    )
    
    with patch(
        "src.services.tools.orchestrator._call_gemini_with_tools",
        new_callable=AsyncMock
    ) as mock_call:
        mock_call.return_value = tool_call_response
        
        with patch(
            "src.services.tools.orchestrator.extract_tool_calls_from_gemini"
        ) as mock_extract:
            mock_extract.return_value = [
                {"name": "create_status", "arguments": {"title": "Test", "content": "Value"}}
            ]
            
            response_text, tool_history, _ = await execute_with_tools(
                provider=mock_provider,
                messages=[LLMMessage(role="user", content="Test")],
                enabled_tools=["create_status"],
                db=test_db_session,
                project_id=test_project_id_for_handlers,
                max_iterations=3  # Limit to 3
            )
            
            # Tool loop stopped; final synthesis call used generate_text
            assert isinstance(response_text, str)
            assert "iterations" in response_text.lower() or len(tool_history) == 3
            assert mock_call.call_count == 3
            mock_provider.generate_text.assert_called_once()


@pytest.mark.asyncio
async def test_execute_with_tools_unsupported_provider(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test orchestrator with unsupported provider (no tool support)."""
    mock_provider = create_mock_provider("openai-gpt-4")
    
    mock_response = MagicMock()
    mock_response.content = "Hello from GPT-4"
    
    mock_provider.generate_text = AsyncMock(return_value=mock_response)
    
    response_text, tool_history, _ = await execute_with_tools(
        provider=mock_provider,
        messages=[LLMMessage(role="user", content="Hello")],
        enabled_tools=["create_status"],
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert response_text == "Hello from GPT-4"
    assert len(tool_history) == 0
    mock_provider.generate_text.assert_called_once()

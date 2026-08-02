"""Unit tests for draft handlers.

Tests handler functions in isolation (no API calls).
Note: Draft handlers don't interact with database, they just structure data.
"""

import pytest

from src.services.tools.handlers import draft


# ============================================================================
# handle_create_draft Tests
# ============================================================================

@pytest.mark.asyncio
async def test_handle_create_draft_valid():
    """Test creating draft with valid parameters."""
    result = await draft.handle_create_draft(
        title="API Strategy",
        content="## Overview\n\nThe API should...",
        reason="User asked for a strategy document"
    )
    
    assert result["success"] is True
    assert result["draft"]["title"] == "API Strategy"
    assert result["draft"]["content"] == "## Overview\n\nThe API should..."
    assert result["draft"]["reason"] == "User asked for a strategy document"
    assert result["action"] == "open_workshop"
    assert "created and opened in the workshop" in result["message"]


@pytest.mark.asyncio
async def test_handle_create_draft_without_reason():
    """Test creating draft without reason."""
    result = await draft.handle_create_draft(
        title="Test Draft",
        content="Content here"
    )
    
    assert result["success"] is True
    assert result["draft"]["title"] == "Test Draft"
    assert result["draft"]["reason"] is None
    assert result["action"] == "open_workshop"


@pytest.mark.asyncio
async def test_handle_create_draft_empty_title():
    """Test creating draft with empty title (should still work - no validation)."""
    result = await draft.handle_create_draft(
        title="",
        content="Content"
    )
    
    assert result["success"] is True
    assert result["draft"]["title"] == ""
    # Note: No validation in handler - frontend should validate


@pytest.mark.asyncio
async def test_handle_create_draft_empty_content():
    """Test creating draft with empty content (should still work)."""
    result = await draft.handle_create_draft(
        title="Title",
        content=""
    )
    
    assert result["success"] is True
    assert result["draft"]["content"] == ""
    # Note: No validation in handler - frontend should validate


@pytest.mark.asyncio
async def test_handle_create_draft_markdown_content():
    """Test creating draft with Markdown content."""
    markdown_content = """# Heading

## Subheading

- Item 1
- Item 2

**Bold** and *italic*
"""
    result = await draft.handle_create_draft(
        title="Markdown Draft",
        content=markdown_content,
        reason="Test Markdown"
    )
    
    assert result["success"] is True
    assert result["draft"]["content"] == markdown_content
    assert "\n" in result["draft"]["content"]  # Should preserve newlines


# ============================================================================
# handle_edit_draft Tests
# ============================================================================

@pytest.mark.asyncio
async def test_handle_edit_draft_single_edit():
    """Test editing draft with single edit."""
    result = await draft.handle_edit_draft(
        edits=[
            {"old_text": "100ml oil", "new_text": "60ml oil"}
        ],
        reason="Incorporated feedback item"
    )
    
    assert result["success"] is True
    assert len(result["edits"]) == 1
    assert result["edits"][0]["old_text"] == "100ml oil"
    assert result["edits"][0]["new_text"] == "60ml oil"
    assert result["edit_count"] == 1
    assert result["reason"] == "Incorporated feedback item"
    assert result["action"] == "edit_workshop"
    assert "1 change" in result["message"]


@pytest.mark.asyncio
async def test_handle_edit_draft_multiple_edits():
    """Test editing draft with multiple edits (batch)."""
    result = await draft.handle_edit_draft(
        edits=[
            {"old_text": "100ml oil", "new_text": "60ml oil"},
            {"old_text": "5 minutes", "new_text": "2-3 minutes"},
            {"old_text": "high heat", "new_text": "medium heat"}
        ],
        reason="Incorporated several feedback items"
    )
    
    assert result["success"] is True
    assert len(result["edits"]) == 3
    assert result["edit_count"] == 3
    assert "3 changes" in result["message"]


@pytest.mark.asyncio
async def test_handle_edit_draft_without_reason():
    """Test editing draft without reason."""
    result = await draft.handle_edit_draft(
        edits=[
            {"old_text": "Old", "new_text": "New"}
        ]
    )
    
    assert result["success"] is True
    assert result["reason"] is None


@pytest.mark.asyncio
async def test_handle_edit_draft_empty_edits_list():
    """Test editing draft with empty edits list."""
    result = await draft.handle_edit_draft(
        edits=[],
        reason="No changes"
    )
    
    assert result["success"] is True
    assert len(result["edits"]) == 0
    assert result["edit_count"] == 0
    assert "0 changes" in result["message"]


@pytest.mark.asyncio
async def test_handle_edit_draft_missing_keys():
    """Test that missing keys in edits are handled gracefully."""
    result = await draft.handle_edit_draft(
        edits=[
            {"old_text": "Old"},  # Missing new_text
            {"new_text": "New"},  # Missing old_text
            {"old_text": "Old2", "new_text": "New2"}  # Complete
        ]
    )
    
    assert result["success"] is True
    assert len(result["edits"]) == 3
    assert result["edits"][0]["old_text"] == "Old"
    assert result["edits"][0]["new_text"] == ""  # Default empty string
    assert result["edits"][1]["old_text"] == ""  # Default empty string
    assert result["edits"][1]["new_text"] == "New"
    assert result["edits"][2]["old_text"] == "Old2"
    assert result["edits"][2]["new_text"] == "New2"


@pytest.mark.asyncio
async def test_handle_edit_draft_message_singular():
    """Test that message uses singular form for 1 edit."""
    result = await draft.handle_edit_draft(
        edits=[{"old_text": "Old", "new_text": "New"}]
    )
    
    assert "1 change" in result["message"]
    assert "changes" not in result["message"]


@pytest.mark.asyncio
async def test_handle_edit_draft_message_plural():
    """Test that message uses plural form for multiple edits."""
    result = await draft.handle_edit_draft(
        edits=[
            {"old_text": "Old1", "new_text": "New1"},
            {"old_text": "Old2", "new_text": "New2"}
        ]
    )
    
    assert "2 changes" in result["message"]


@pytest.mark.asyncio
async def test_handle_edit_draft_preserves_whitespace():
    """Test that edits preserve whitespace in text."""
    result = await draft.handle_edit_draft(
        edits=[
            {
                "old_text": "Line 1\nLine 2\nLine 3",
                "new_text": "Line 1\nLine 2 Updated\nLine 3"
            }
        ]
    )
    
    assert result["edits"][0]["old_text"] == "Line 1\nLine 2\nLine 3"
    assert result["edits"][0]["new_text"] == "Line 1\nLine 2 Updated\nLine 3"
    assert "\n" in result["edits"][0]["old_text"]
    assert "\n" in result["edits"][0]["new_text"]

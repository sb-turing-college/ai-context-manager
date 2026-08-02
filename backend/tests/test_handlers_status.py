"""Unit tests for status topic handlers.

Tests handler functions in isolation (no API calls).
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import StatusTopic
from src.services.tools.handlers import status


# ============================================================================
# handle_create_status Tests
# ============================================================================

@pytest.mark.asyncio
async def test_handle_create_status_valid(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test creating status with valid parameters."""
    result = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Credits",
        content="1000",
        reason="Initial setup"
    )
    
    assert result["success"] is True
    assert result["topic_id"] is not None
    assert result["title"] == "Credits"
    assert result["content"] == "1000"
    assert "created successfully" in result["message"]
    
    # Verify in database
    db_result = await test_db_session.execute(
        select(StatusTopic).where(StatusTopic.id == result["topic_id"])
    )
    topic = db_result.scalar_one()
    assert topic.title == "Credits"
    assert topic.content == "1000"
    assert topic.project_id == test_project_id_for_handlers
    assert topic.order_index == 0
    assert len(topic.history) == 1
    # History stores previous content; create has no prior content
    assert topic.history[0]["content"] == ""
    assert topic.history[0]["reason"] == "Initial setup"


@pytest.mark.asyncio
async def test_handle_create_status_without_reason(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test creating status without reason (should use default)."""
    result = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Budget",
        content="5000 EUR"
    )
    
    assert result["success"] is True
    
    # Verify default reason in history
    db_result = await test_db_session.execute(
        select(StatusTopic).where(StatusTopic.id == result["topic_id"])
    )
    topic = db_result.scalar_one()
    assert topic.history[0]["reason"] == "Created via AI tool"


@pytest.mark.asyncio
async def test_handle_create_status_empty_title_raises_error(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test validation: empty title should raise ValueError."""
    with pytest.raises(ValueError, match="title is required"):
        await status.handle_create_status(
            db=test_db_session,
            project_id=test_project_id_for_handlers,
            title="",
            content="1000"
        )


@pytest.mark.asyncio
async def test_handle_create_status_whitespace_title_raises_error(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test validation: whitespace-only title should raise ValueError."""
    with pytest.raises(ValueError, match="title is required"):
        await status.handle_create_status(
            db=test_db_session,
            project_id=test_project_id_for_handlers,
            title="   ",
            content="1000"
        )


@pytest.mark.asyncio
async def test_handle_create_status_empty_content_raises_error(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test validation: empty content should raise ValueError."""
    with pytest.raises(ValueError, match="content is required"):
        await status.handle_create_status(
            db=test_db_session,
            project_id=test_project_id_for_handlers,
            title="Credits",
            content=""
        )


@pytest.mark.asyncio
async def test_handle_create_status_auto_increment_order(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that order_index auto-increments for multiple topics."""
    # Create first topic
    result1 = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Topic 1",
        content="Content 1"
    )
    
    # Create second topic
    result2 = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Topic 2",
        content="Content 2"
    )
    
    # Verify order
    db_result = await test_db_session.execute(
        select(StatusTopic).where(StatusTopic.project_id == test_project_id_for_handlers)
    )
    topics = db_result.scalars().all()
    assert len(topics) == 2
    assert topics[0].order_index == 0
    assert topics[1].order_index == 1


# ============================================================================
# handle_read_status Tests
# ============================================================================

@pytest.mark.asyncio
async def test_handle_read_status_empty(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test reading status when no topics exist."""
    result = await status.handle_read_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["success"] is True
    assert result["count"] == 0
    assert result["topics"] == []
    assert "0 status topic(s) found" in result["message"]


@pytest.mark.asyncio
async def test_handle_read_status_multiple_topics(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test reading multiple status topics."""
    # Create multiple topics
    for i in range(3):
        await status.handle_create_status(
            db=test_db_session,
            project_id=test_project_id_for_handlers,
            title=f"Topic {i}",
            content=f"Content {i}"
        )
    
    # Read all topics
    result = await status.handle_read_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["success"] is True
    assert result["count"] == 3
    assert len(result["topics"]) == 3
    
    # Verify order (should be sorted by order_index)
    orders = [t["order_index"] for t in result["topics"]]
    assert orders == sorted(orders)
    
    # Verify topic data
    assert result["topics"][0]["title"] == "Topic 0"
    assert result["topics"][1]["title"] == "Topic 1"
    assert result["topics"][2]["title"] == "Topic 2"


@pytest.mark.asyncio
async def test_handle_read_status_only_project_topics(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that read_status only returns topics for specified project."""
    # Create project 2
    from src.models import Project
    from datetime import datetime, UTC
    
    project2 = Project(
        title="Project 2",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(project2)
    await test_db_session.commit()
    await test_db_session.refresh(project2)
    
    # Create topics in both projects
    await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Project 1 Topic",
        content="Content"
    )
    await status.handle_create_status(
        db=test_db_session,
        project_id=project2.id,
        title="Project 2 Topic",
        content="Content"
    )
    
    # Read only project 1 topics
    result = await status.handle_read_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers
    )
    
    assert result["count"] == 1
    assert result["topics"][0]["title"] == "Project 1 Topic"


# ============================================================================
# handle_update_status Tests
# ============================================================================

@pytest.mark.asyncio
async def test_handle_update_status_valid(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test updating status with valid parameters."""
    # Create topic first
    create_result = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Credits",
        content="1000",
        reason="Initial"
    )
    topic_id = create_result["topic_id"]
    
    # Update topic
    update_result = await status.handle_update_status(
        db=test_db_session,
        topic_id=topic_id,
        content="2000",
        reason="Credits increased"
    )
    
    assert update_result["success"] is True
    assert update_result["topic_id"] == topic_id
    assert update_result["old_content"] == "1000"
    assert update_result["new_content"] == "2000"
    assert "updated successfully" in update_result["message"]
    
    # Verify in database
    db_result = await test_db_session.execute(
        select(StatusTopic).where(StatusTopic.id == topic_id)
    )
    topic = db_result.scalar_one()
    assert topic.content == "2000"
    assert len(topic.history) == 2  # create + update (previous values)
    assert topic.history[0]["content"] == ""
    assert topic.history[1]["content"] == "1000"
    assert topic.history[1]["reason"] == "Credits increased"


@pytest.mark.asyncio
async def test_handle_update_status_nonexistent_raises_error(
    test_db_session: AsyncSession
):
    """Test updating non-existent topic raises ValueError."""
    with pytest.raises(ValueError, match="not found"):
        await status.handle_update_status(
            db=test_db_session,
            topic_id="nonexistent-id",
            content="New content",
            reason="Test"
        )


@pytest.mark.asyncio
async def test_handle_update_status_multiple_updates_creates_history(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that multiple updates create multiple history entries."""
    # Create topic
    create_result = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Budget",
        content="5000",
        reason="Initial"
    )
    topic_id = create_result["topic_id"]
    
    # Update multiple times
    await status.handle_update_status(
        db=test_db_session,
        topic_id=topic_id,
        content="4000",
        reason="Expense 1"
    )
    await status.handle_update_status(
        db=test_db_session,
        topic_id=topic_id,
        content="3000",
        reason="Expense 2"
    )
    
    # Verify history
    db_result = await test_db_session.execute(
        select(StatusTopic).where(StatusTopic.id == topic_id)
    )
    topic = db_result.scalar_one()
    assert topic.content == "3000"
    assert len(topic.history) == 3  # create + 2 updates (previous values)
    assert topic.history[0]["content"] == ""
    assert topic.history[1]["content"] == "5000"
    assert topic.history[2]["content"] == "4000"
    assert topic.history[1]["reason"] == "Expense 1"
    assert topic.history[2]["reason"] == "Expense 2"


# ============================================================================
# handle_delete_status Tests
# ============================================================================

@pytest.mark.asyncio
async def test_handle_delete_status_valid(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test deleting status with valid ID."""
    # Create topic first
    create_result = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="To Delete",
        content="Content"
    )
    topic_id = create_result["topic_id"]
    
    # Delete topic
    delete_result = await status.handle_delete_status(
        db=test_db_session,
        topic_id=topic_id
    )
    
    assert delete_result["success"] is True
    assert delete_result["topic_id"] == topic_id
    assert delete_result["title"] == "To Delete"
    assert "deleted successfully" in delete_result["message"]
    
    # Verify deleted from database
    db_result = await test_db_session.execute(
        select(StatusTopic).where(StatusTopic.id == topic_id)
    )
    topic = db_result.scalar_one_or_none()
    assert topic is None


@pytest.mark.asyncio
async def test_handle_delete_status_nonexistent_raises_error(
    test_db_session: AsyncSession
):
    """Test deleting non-existent topic raises ValueError."""
    with pytest.raises(ValueError, match="not found"):
        await status.handle_delete_status(
            db=test_db_session,
            topic_id="nonexistent-id"
        )


@pytest.mark.asyncio
async def test_handle_delete_status_does_not_affect_other_topics(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that deleting one topic doesn't affect others."""
    # Create multiple topics
    result1 = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Topic 1",
        content="Content 1"
    )
    result2 = await status.handle_create_status(
        db=test_db_session,
        project_id=test_project_id_for_handlers,
        title="Topic 2",
        content="Content 2"
    )
    
    # Delete first topic
    await status.handle_delete_status(
        db=test_db_session,
        topic_id=result1["topic_id"]
    )
    
    # Verify second topic still exists
    db_result = await test_db_session.execute(
        select(StatusTopic).where(StatusTopic.id == result2["topic_id"])
    )
    topic = db_result.scalar_one()
    assert topic.title == "Topic 2"
    
    # Verify first topic is deleted
    db_result2 = await test_db_session.execute(
        select(StatusTopic).where(StatusTopic.id == result1["topic_id"])
    )
    assert db_result2.scalar_one_or_none() is None

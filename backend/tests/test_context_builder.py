"""Unit tests for context builder service.

Tests context assembly without real API calls.
"""

import pytest
from datetime import datetime, UTC
from sqlalchemy.ext.asyncio import AsyncSession

from src.services.context_builder import (
    build_chat_context,
    build_context_for_caching,
    build_audit_context,
    build_verify_context,
    get_session_summaries,
    CacheableContext
)
from src.models import (
    Session,
    Project,
    ChatMessage,
    LibraryItem,
    StatusTopic,
    SessionSummary,
    Setting
)


# ============================================================================
# build_chat_context Tests
# ============================================================================

@pytest.mark.asyncio
async def test_build_chat_context_basic(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building basic chat context."""
    # Create session
    session = Session(
        id="test-session-1",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create system prompt setting
    setting = Setting(
        key="system_prompt_base",
        value={"content": "You are a helpful assistant."}
    )
    test_db_session.add(setting)
    await test_db_session.commit()
    
    # Build context
    context = await build_chat_context(
        db=test_db_session,
        session_id="test-session-1",
        mode="chat"
    )
    
    assert len(context) >= 1  # At least system prompt
    assert context[0].role == "system"


@pytest.mark.asyncio
async def test_build_chat_context_with_documents(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building context with documents."""
    # Create session
    session = Session(
        id="test-session-2",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create system prompt setting
    setting = Setting(
        key="system_prompt_base",
        value={"content": "You are a helpful assistant."}
    )
    test_db_session.add(setting)
    
    # Create document
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
    
    # Build context
    context = await build_chat_context(
        db=test_db_session,
        session_id="test-session-2",
        mode="chat"
    )
    
    # Should have system + context with document
    assert len(context) >= 2
    # Find context message (user role)
    context_msg = next(
        (m for m in context if m.role == "user" and "Available Documents" in m.content),
        None,
    )
    assert context_msg is not None
    assert "API Guide" in context_msg.content


@pytest.mark.asyncio
async def test_build_chat_context_with_status(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building context with status topics."""
    # Create session
    session = Session(
        id="test-session-3",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create status topic
    status = StatusTopic(
        project_id=test_project_id_for_handlers,
        title="Credits",
        content="1000",
        order_index=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(status)
    await test_db_session.commit()
    
    # Build context
    context = await build_chat_context(
        db=test_db_session,
        session_id="test-session-3",
        mode="chat"
    )
    
    # Should have status in context
    context_msg = next((m for m in context if m.role == "user" and "Status" in m.content), None)
    assert context_msg is not None
    assert "Credits" in context_msg.content
    assert "1000" in context_msg.content


@pytest.mark.asyncio
async def test_build_chat_context_with_history(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building context with chat history."""
    # Create session
    session = Session(
        id="test-session-4",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create chat messages
    msg1 = ChatMessage(
        session_id="test-session-4",
        role="user",
        content="Hello",
        timestamp="14:30",
        created_at=datetime.now(UTC)
    )
    msg2 = ChatMessage(
        session_id="test-session-4",
        role="assistant",
        content="Hi there!",
        timestamp="14:31",
        created_at=datetime.now(UTC)
    )
    test_db_session.add_all([msg1, msg2])
    await test_db_session.commit()
    
    # Build context
    context = await build_chat_context(
        db=test_db_session,
        session_id="test-session-4",
        mode="chat"
    )
    
    # History messages are timestamp-prefixed: "[UTC …]\nHello"
    user_msgs = [
        m for m in context if m.role == "user" and m.content.endswith("\nHello")
    ]
    assistant_msgs = [
        m for m in context if m.role == "assistant" and m.content.endswith("\nHi there!")
    ]
    assert len(user_msgs) == 1
    assert len(assistant_msgs) == 1


@pytest.mark.asyncio
async def test_build_chat_context_audit_mode(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building context in audit mode (sparse)."""
    # Create session
    session = Session(
        id="test-session-5",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create audit system prompt
    setting = Setting(
        key="system_prompt_base",
        value={"content": "You are an auditor."}
    )
    test_db_session.add(setting)
    await test_db_session.commit()
    
    # Build context in audit mode
    context = await build_chat_context(
        db=test_db_session,
        session_id="test-session-5",
        mode="audit"
    )
    
    # Audit mode should only have system prompt (no documents/status in context)
    assert len(context) >= 1
    assert context[0].role == "system"
    # Should not have context sections
    context_sections = [
        m for m in context if m.role == "user" and "Available Documents" in m.content
    ]
    assert len(context_sections) == 0


@pytest.mark.asyncio
async def test_build_chat_context_with_summaries(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building context with cross-session summaries."""
    # Create two sessions
    session1 = Session(
        id="test-session-6",
        project_id=test_project_id_for_handlers,
        title="Session 1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    session2 = Session(
        id="test-session-7",
        project_id=test_project_id_for_handlers,
        title="Session 2",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add_all([session1, session2])
    
    # Create summary for session1
    summary = SessionSummary(
        session_id="test-session-6",
        content="Important learnings from session 1",
        token_count=10,
        created_at=datetime.now(UTC)
    )
    test_db_session.add(summary)
    await test_db_session.commit()
    
    # Build context for session2 with summary from session1
    context = await build_chat_context(
        db=test_db_session,
        session_id="test-session-7",
        mode="chat",
        include_summaries=["test-session-6"]
    )
    
    # Should have summary in context
    context_msg = next(
        (
            m
            for m in context
            if m.role == "user" and "Knowledge from Other Sessions" in m.content
        ),
        None,
    )
    assert context_msg is not None
    assert "Session 1" in context_msg.content
    assert "Important learnings" in context_msg.content


@pytest.mark.asyncio
async def test_build_chat_context_session_not_found(test_db_session: AsyncSession):
    """Test that missing session raises ValueError."""
    with pytest.raises(ValueError, match="not found"):
        await build_chat_context(
            db=test_db_session,
            session_id="nonexistent-session",
            mode="chat"
        )


# ============================================================================
# build_context_for_caching Tests
# ============================================================================

@pytest.mark.asyncio
async def test_build_context_for_caching_basic(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building cacheable context."""
    # Create session
    session = Session(
        id="test-session-8",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    await test_db_session.commit()
    
    # Build cacheable context
    ctx = await build_context_for_caching(
        db=test_db_session,
        session_id="test-session-8",
        mode="chat"
    )
    
    assert isinstance(ctx, CacheableContext)
    assert isinstance(ctx.static_content, str)
    assert isinstance(ctx.dynamic_messages, list)


@pytest.mark.asyncio
async def test_build_context_for_caching_static_vs_dynamic(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that static and dynamic parts are correctly separated."""
    # Create session
    session = Session(
        id="test-session-9",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create document (static)
    doc = LibraryItem(
        project_id=test_project_id_for_handlers,
        title="Static Doc",
        content="Static content",
        item_type="text",
        version=1,
        history=[],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(doc)
    
    # Create status (dynamic)
    status = StatusTopic(
        project_id=test_project_id_for_handlers,
        title="Dynamic Status",
        content="Dynamic value",
        order_index=0,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(status)
    
    # Create chat message (dynamic)
    msg = ChatMessage(
        session_id="test-session-9",
        role="user",
        content="Dynamic message",
        timestamp="14:30",
        created_at=datetime.now(UTC)
    )
    test_db_session.add(msg)
    await test_db_session.commit()
    
    # Build cacheable context
    ctx = await build_context_for_caching(
        db=test_db_session,
        session_id="test-session-9",
        mode="chat"
    )
    
    # Document should be in static
    assert "Static Doc" in ctx.static_content
    
    # Status and message should be in dynamic
    status_in_dynamic = any("Dynamic Status" in m.content for m in ctx.dynamic_messages)
    msg_in_dynamic = any("Dynamic message" in m.content for m in ctx.dynamic_messages)
    assert status_in_dynamic
    assert msg_in_dynamic


@pytest.mark.asyncio
async def test_build_context_for_caching_order_stability(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that static content order is stable (critical for Claude caching)."""
    # Create session
    session = Session(
        id="test-session-10",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create multiple documents
    for i in range(3):
        doc = LibraryItem(
            project_id=test_project_id_for_handlers,
            title=f"Doc {i}",
            content=f"Content {i}",
            item_type="text",
            version=1,
            history=[],
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC)
        )
        test_db_session.add(doc)
    await test_db_session.commit()
    
    # Build context twice
    ctx1 = await build_context_for_caching(
        db=test_db_session,
        session_id="test-session-10",
        mode="chat"
    )
    ctx2 = await build_context_for_caching(
        db=test_db_session,
        session_id="test-session-10",
        mode="chat"
    )
    
    # Static content should be identical (stable order)
    assert ctx1.static_content == ctx2.static_content


# ============================================================================
# build_audit_context Tests
# ============================================================================

@pytest.mark.asyncio
async def test_build_audit_context_basic(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building audit context."""
    # Create session
    session = Session(
        id="test-session-11",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create audit system prompt
    setting = Setting(
        key="system_prompt_base",
        value={"content": "You are an auditor."}
    )
    test_db_session.add(setting)
    await test_db_session.commit()
    
    # Build audit context
    context = await build_audit_context(
        db=test_db_session,
        session_id="test-session-11",
        draft_content="Test draft content"
    )
    
    assert len(context) >= 2  # System + draft
    assert context[0].role == "system"
    # Draft should be in last message
    assert "Test draft content" in context[-1].content


@pytest.mark.asyncio
async def test_build_audit_context_no_history(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test that audit context excludes chat history."""
    # Create session
    session = Session(
        id="test-session-12",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create chat message (should be excluded)
    msg = ChatMessage(
        session_id="test-session-12",
        role="user",
        content="Chat history",
        timestamp="14:30",
        created_at=datetime.now(UTC)
    )
    test_db_session.add(msg)
    await test_db_session.commit()
    
    # Build audit context
    context = await build_audit_context(
        db=test_db_session,
        session_id="test-session-12",
        draft_content="Draft"
    )
    
    # Should not have chat history
    history_msgs = [m for m in context if "Chat history" in m.content]
    assert len(history_msgs) == 0


# ============================================================================
# build_verify_context Tests
# ============================================================================

@pytest.mark.asyncio
async def test_build_verify_context_basic(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test building verify context."""
    # Create session
    session = Session(
        id="test-session-13",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create verify system prompt
    setting = Setting(
        key="system_prompt_base",
        value={"content": "You are a verifier."}
    )
    test_db_session.add(setting)
    await test_db_session.commit()
    
    # Build verify context
    context = await build_verify_context(
        db=test_db_session,
        session_id="test-session-13",
        answer_to_verify="Answer to verify"
    )
    
    # Should have verify prompt (system prompt may be empty if not set)
    assert len(context) >= 1
    assert "Answer to verify" in context[-1].content


@pytest.mark.asyncio
async def test_build_verify_context_delta_loading(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test verify context with delta-loading (only new messages)."""
    # Create session
    session = Session(
        id="test-session-14",
        project_id=test_project_id_for_handlers,
        title="Test Session",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(session)
    
    # Create old message
    old_msg = ChatMessage(
        session_id="test-session-14",
        role="user",
        content="Old message",
        timestamp="10:00",
        created_at=datetime(2024, 1, 1, tzinfo=UTC)
    )
    test_db_session.add(old_msg)
    
    # Create new message (after timestamp)
    timestamp = datetime(2024, 1, 2, tzinfo=UTC)
    new_msg = ChatMessage(
        session_id="test-session-14",
        role="user",
        content="New message",
        timestamp="12:00",
        created_at=datetime(2024, 1, 3, tzinfo=UTC)
    )
    test_db_session.add(new_msg)
    await test_db_session.commit()
    
    # Build verify context with delta-loading
    context = await build_verify_context(
        db=test_db_session,
        session_id="test-session-14",
        answer_to_verify="Answer",
        last_verify_timestamp=timestamp
    )
    
    # Should only have new message, not old
    context_text = " ".join(m.content for m in context)
    assert "New message" in context_text
    assert "Old message" not in context_text


# ============================================================================
# get_session_summaries Tests
# ============================================================================

@pytest.mark.asyncio
async def test_get_session_summaries(
    test_db_session: AsyncSession,
    test_project_id_for_handlers: str
):
    """Test getting session summaries."""
    # Create sessions
    session1 = Session(
        id="test-session-15",
        project_id=test_project_id_for_handlers,
        title="Session 1",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    session2 = Session(
        id="test-session-16",
        project_id=test_project_id_for_handlers,
        title="Session 2",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add_all([session1, session2])
    
    # Create summary for session1
    summary = SessionSummary(
        session_id="test-session-15",
        content="Summary content",
        token_count=10,
        created_at=datetime.now(UTC)
    )
    test_db_session.add(summary)
    await test_db_session.commit()
    
    # Get summaries
    summaries = await get_session_summaries(
        db=test_db_session,
        session_ids=["test-session-15", "test-session-16"]
    )
    
    assert len(summaries) == 1  # Only session1 has summary
    assert summaries[0]["session_title"] == "Session 1"
    assert summaries[0]["content"] == "Summary content"


@pytest.mark.asyncio
async def test_get_session_summaries_nonexistent_session(test_db_session: AsyncSession):
    """Test getting summaries for non-existent sessions."""
    summaries = await get_session_summaries(
        db=test_db_session,
        session_ids=["nonexistent-1", "nonexistent-2"]
    )
    
    assert len(summaries) == 0

"""Session and message endpoints."""

import asyncio
import logging

# Keep strong references to background tasks so the GC doesn't cancel them
# (Python 3.12+ requirement for fire-and-forget asyncio.create_task)
_background_tasks: set[asyncio.Task] = set()

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Session, SessionSummary, ChatMessage, Project
from src.services.content_timestamps import (
    touch_project_content,
    touch_session_content,
)
from src.schemas.session import (
    SessionCreate,
    SessionUpdate,
    SessionResponse,
    SessionSummaryCreate,
    SessionSummaryResponse,
)
from src.schemas.message import MessageCreate, MessageResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def _attached_summary_ids(session: Session) -> list[str]:
    """Normalize attached_summary_ids from DB (None / non-list → [])."""
    raw = getattr(session, "attached_summary_ids", None)
    if isinstance(raw, list):
        return [str(x) for x in raw]
    return []


async def _summary_status(db: AsyncSession, session: Session) -> str:
    """Compute summary freshness for a session."""
    summary_result = await db.execute(
        select(SessionSummary).where(SessionSummary.session_id == session.id)
    )
    summary = summary_result.scalar_one_or_none()
    if not summary:
        return "none"
    if summary.message_count_at_creation < session.message_count:
        return "outdated"
    return "current"


async def _to_session_response(db: AsyncSession, session: Session) -> SessionResponse:
    """Build SessionResponse including summary_status and attached summaries."""
    return SessionResponse(
        id=session.id,
        project_id=session.project_id,
        title=session.title,
        message_count=session.message_count,
        active=session.active,
        last_modified=session.last_modified,
        created_at=session.created_at,
        updated_at=session.updated_at,
        summary_status=await _summary_status(db, session),
        attached_summary_ids=_attached_summary_ids(session),
    )


# --- Session Endpoints ---

@router.get("/projects/{project_id}/sessions", response_model=list[SessionResponse])
async def get_project_sessions(
    project_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[SessionResponse]:
    """Get all sessions for a project.
    
    Args:
        project_id: Project UUID
        db: Database session
        
    Returns:
        List of sessions for the project with summary status
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> sessions = await get_project_sessions("abc-123")
        >>> len(sessions)
        5
    """
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    
    # Get sessions
    result = await db.execute(
        select(Session).where(Session.project_id == project_id)
    )
    sessions = result.scalars().all()
    
    return [await _to_session_response(db, session) for session in sessions]


@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    db: AsyncSession = Depends(get_db)
) -> SessionResponse:
    """Create a new session.
    
    Args:
        session_data: Session creation data
        db: Database session
        
    Returns:
        Newly created session
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> session = await create_session(
        ...     SessionCreate(project_id="abc-123", title="New Session")
        ... )
        >>> session.title
        'New Session'
    """
    # Verify project exists
    result = await db.execute(
        select(Project).where(Project.id == session_data.project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {session_data.project_id} not found"
        )
    
    session = Session(
        project_id=session_data.project_id,
        title=session_data.title,
        last_modified="just now",
        attached_summary_ids=[],
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    return await _to_session_response(db, session)


@router.patch("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    session_data: SessionUpdate,
    db: AsyncSession = Depends(get_db)
) -> SessionResponse:
    """Update a session's title and/or attached cross-session summaries.
    
    Args:
        session_id: Session UUID
        session_data: Update data
        db: Database session
        
    Returns:
        Updated session
        
    Raises:
        HTTPException: 404 if session not found
        
    Example:
        >>> session = await update_session(
        ...     "def-456",
        ...     SessionUpdate(title="Renamed Session")
        ... )
        >>> session.title
        'Renamed Session'
    """
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )

    if session_data.title is None and session_data.attached_summary_ids is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide title and/or attached_summary_ids",
        )
    
    if session_data.title is not None:
        session.title = session_data.title
    if session_data.attached_summary_ids is not None:
        # Never attach the current session to itself
        session.attached_summary_ids = [
            sid for sid in session_data.attached_summary_ids if sid != session_id
        ]

    await db.commit()
    await db.refresh(session)
    
    return await _to_session_response(db, session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a session and all related messages.
    
    Args:
        session_id: Session UUID
        db: Database session
        
    Raises:
        HTTPException: 404 if session not found
        
    Example:
        >>> await delete_session("def-456")
        # Session and all messages deleted
    """
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )
    
    await db.delete(session)
    await db.commit()


# --- Message Endpoints ---

@router.get("/sessions/{session_id}/messages", response_model=list[MessageResponse])
async def get_session_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[ChatMessage]:
    """Get all messages for a session.
    
    Args:
        session_id: Session UUID
        db: Database session
        
    Returns:
        List of messages in chronological order
        
    Raises:
        HTTPException: 404 if session not found
        
    Example:
        >>> messages = await get_session_messages("def-456")
        >>> len(messages)
        12
    """
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )
    
    # Get active (non-archived) messages sorted chronologically
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .where(ChatMessage.is_archived.is_not(True))
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return list(messages)


@router.post(
    "/sessions/{session_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_message(
    session_id: str,
    message_data: MessageCreate,
    db: AsyncSession = Depends(get_db)
) -> ChatMessage:
    """Add a new message to a session.
    
    Also updates session's message_count and last_modified.
    
    Args:
        session_id: Session UUID
        message_data: Message creation data
        db: Database session
        
    Returns:
        Newly created message
        
    Raises:
        HTTPException: 404 if session not found
        
    Example:
        >>> message = await create_message(
        ...     "def-456",
        ...     MessageCreate(role="user", content="Hello", timestamp="14:30")
        ... )
        >>> message.content
        'Hello'
    """
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )
    
    # Create message - Backend generates timestamp for consistency (Single Source of Truth)
    from datetime import datetime, UTC
    message = ChatMessage(
        session_id=session_id,
        role=message_data.role,
        content=message_data.content,
        timestamp=datetime.now(UTC),  # Backend-generated, not from frontend
        model=message_data.model,
        tool_call_data=message_data.tool_call_data,
        feedback_data=message_data.feedback_data,
    )
    db.add(message)
    
    # Content activity (not rename/metadata)
    session.message_count += 1
    when = touch_session_content(session)
    project = await db.get(Project, session.project_id)
    if project is not None:
        touch_project_content(project, when=when)
    
    await db.commit()
    await db.refresh(message)
    return message


# --- Summary Endpoints ---

@router.get("/sessions/{session_id}/summary", response_model=SessionSummaryResponse)
async def get_session_summary(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> SessionSummary:
    """Get the summary for a session.
    
    Args:
        session_id: Session UUID
        db: Database session
        
    Returns:
        Session summary
        
    Raises:
        HTTPException: 404 if session or summary not found
        
    Example:
        >>> summary = await get_session_summary("def-456")
        >>> summary.content
        'This session discussed...'
    """
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )
    
    # Get summary
    result = await db.execute(
        select(SessionSummary).where(SessionSummary.session_id == session_id)
    )
    summary = result.scalar_one_or_none()
    
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Summary for session {session_id} not found"
        )
    
    return summary


@router.put("/sessions/{session_id}/summary", response_model=SessionSummaryResponse)
async def upsert_session_summary(
    session_id: str,
    summary_data: SessionSummaryCreate,
    db: AsyncSession = Depends(get_db)
) -> SessionSummary:
    """Create or update a session summary.
    
    If a summary already exists, it will be updated.
    If not, a new summary will be created.
    
    Args:
        session_id: Session UUID
        summary_data: Summary data
        db: Database session
        
    Returns:
        Created or updated summary
        
    Raises:
        HTTPException: 404 if session not found
        
    Example:
        >>> summary = await upsert_session_summary(
        ...     "def-456",
        ...     SessionSummaryCreate(content="Session summary...")
        ... )
        >>> summary.content
        'Session summary...'
    """
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )
    
    # Check if summary exists
    result = await db.execute(
        select(SessionSummary).where(SessionSummary.session_id == session_id)
    )
    existing_summary = result.scalar_one_or_none()
    
    if existing_summary:
        # Update existing summary
        existing_summary.content = summary_data.content
        existing_summary.token_count = summary_data.token_count
        existing_summary.message_count_at_creation = summary_data.message_count_at_creation
        await db.commit()
        await db.refresh(existing_summary)
        saved_summary = existing_summary
    else:
        # Create new summary
        new_summary = SessionSummary(
            session_id=session_id,
            content=summary_data.content,
            token_count=summary_data.token_count,
            message_count_at_creation=summary_data.message_count_at_creation,
        )
        db.add(new_summary)
        await db.commit()
        await db.refresh(new_summary)
        saved_summary = new_summary

    # Load messages within the current request scope (while db is still valid)
    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .where(ChatMessage.role.in_(["user", "assistant"]))
        .order_by(ChatMessage.created_at)
    )
    raw_messages = msg_result.scalars().all()
    msg_dicts = [
        {
            "id": str(msg.id),
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else "",
        }
        for msg in raw_messages
    ]

    # Fire-and-forget: store reference so GC doesn't cancel the task prematurely
    task = asyncio.create_task(
        _index_session_in_background(
            session_id=session_id,
            project_id=session.project_id,
            session_title=session.title,
            summary_text=saved_summary.content,
            msg_dicts=msg_dicts,
        )
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return saved_summary


async def _index_session_in_background(
    session_id: str,
    project_id: str,
    session_title: str,
    summary_text: str,
    msg_dicts: list[dict],
) -> None:
    """Embed session messages into the vector store (fire-and-forget).

    Receives pre-loaded message data – no db session needed.
    Errors are logged but never propagated.
    """
    try:
        from src.services.vector_store import VectorStore
        store = VectorStore.get_instance()
        count = await store.index_session(
            session_id=session_id,
            project_id=project_id,
            session_title=session_title,
            messages=msg_dicts,
            summary_text=summary_text,
        )
        logger.info(f"✅ Vector index: {count} docs for session '{session_title}'")
    except Exception as e:
        logger.warning(f"⚠️ Vector indexing failed for session {session_id}: {e}")

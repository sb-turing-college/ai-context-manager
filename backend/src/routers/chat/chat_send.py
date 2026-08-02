"""Chat send and archive endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Session, ChatMessage
from src.schemas.chat import (
    ChatSendRequest,
    ChatResponse,
)
from src.services.llm.factory import create_provider
from src.services.llm.base import LLMMessage
from src.services.context_builder import build_chat_context
from src.services.moderation import require_text_allowed
from src.disclaimer_acceptance import require_disclaimer_accepted
from src.routers.chat.chat_send_core import run_chat_turn
from src.routers.chat.common import (
    resolve_attached_summary_ids,
    _stream_response,
)


router = APIRouter()


@router.post("/chat/send", response_model=ChatResponse)
async def send_chat_message(
    request: ChatSendRequest,
    stream: bool = Query(False, description="Enable streaming response"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_disclaimer_accepted),
):
    """Send a chat message and get AI response.
    
    Args:
        request: Chat request with message and context
        stream: Whether to stream the response (SSE)
        db: Database session
        
    Returns:
        AI response or streaming response
        
    Raises:
        HTTPException: 404 if session not found, 500 on API errors
        
    Example:
        >>> response = await send_chat_message(
        ...     ChatSendRequest(
        ...         session_id="abc-123",
        ...         message="Hello!",
        ...         model="gemini-2.5-flash"
        ...     ),
        ...     stream=False,
        ...     db=db
        ... )
        >>> response.content
        'Hello! How can I help you?'
    """
    await require_text_allowed(request.message)

    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == request.session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {request.session_id} not found"
        )
    
    try:
        # DB is source of truth for attached cross-session summaries
        summary_ids = resolve_attached_summary_ids(session, request.include_summaries)

        # Create provider
        provider = create_provider(request.model)
        
        if stream:
            # Build OLD context for streaming (no caching support yet)
            context_messages = await build_chat_context(
                db=db,
                session_id=request.session_id,
                mode="chat",
                include_summaries=summary_ids
            )
            context_messages.append(LLMMessage(
                role="user",
                content=request.message
            ))
            
            # Return streaming response (tools + caching not supported in streaming yet)
            return StreamingResponse(
                _stream_response(
                    provider=provider,
                    messages=context_messages,
                    temperature=request.temperature,
                    session_id=request.session_id,
                    model=request.model,
                    db=db
                ),
                media_type="text/event-stream"
            )
        else:
            return await run_chat_turn(
                request, session, db, provider, summary_ids
            )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI API error: {str(e)}"
        )


@router.get("/chat/sessions/{session_id}/archived-messages")
async def get_archived_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Return all soft-archived messages for a session."""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .where(ChatMessage.is_archived.is_(True))
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "timestamp": m.timestamp,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "archived_at": m.archived_at.isoformat() if m.archived_at else None,
        }
        for m in messages
    ]


@router.post("/chat/sessions/{session_id}/restore-archived")
async def restore_archived_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Restore all archived messages of a session back into active context.

    Sets is_archived=False so the AI context builder picks them up again.
    """
    result = await db.execute(
        select(ChatMessage.id)
        .where(ChatMessage.session_id == session_id)
        .where(ChatMessage.is_archived.is_(True))
    )
    ids = [row[0] for row in result.fetchall()]

    if ids:
        await db.execute(
            update(ChatMessage)
            .where(ChatMessage.id.in_(ids))
            .values(is_archived=False, archived_at=None)
        )
        await db.commit()

    return {"restored": len(ids)}

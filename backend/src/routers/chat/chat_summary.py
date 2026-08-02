"""Chat summary endpoint."""

import asyncio
import json
from datetime import datetime, UTC
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Session, ChatMessage, Setting, SessionSummary
from src.schemas.chat import (
    ChatSendRequest,
    ChatResponse,
    ChatAuditRequest,
    ChatVerifyRequest,
    ChatSummaryRequest,
    ToolCallInfo,
    DraftData,
    EditData,
    SingleEdit,
    ChatContext,
)
from src.services.llm.factory import create_provider
from src.services.llm.base import LLMMessage
from src.services.context_builder import (
    build_chat_context,
    build_audit_context,
    build_verify_context,
    build_context_for_caching,
    get_session_summaries,  # For cross-session context
    _system_time_message,
    _format_timestamp
)
from src.services.tools.orchestrator import execute_with_tools
from src.services.tools.definitions import TOOL_DEFINITIONS
from src.services import usage_tracker
from src.services.moderation import require_text_allowed
from src.routers.chat_helper import get_enabled_tools
from src.routers.settings import get_app_settings_dict
from src.disclaimer_acceptance import require_disclaimer_accepted


router = APIRouter()

@router.post("/chat/summary", response_model=ChatResponse)
async def generate_summary(
    request: ChatSummaryRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_disclaimer_accepted),
) -> ChatResponse:
    """Generate a summary of the session conversation.
    
    Args:
        request: Summary request with session ID
        db: Database session
        
    Returns:
        Generated summary
        
    Raises:
        HTTPException: 404 if session not found, 500 on API errors
        
    Example:
        >>> response = await generate_summary(
        ...     ChatSummaryRequest(session_id="abc-123"),
        ...     db=db
        ... )
        >>> "Summary" in response.content
        True
    """
    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == request.session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {request.session_id} not found"
        )
    
    # Get messages from session (filtered by active_message_ids if provided)
    query = select(ChatMessage).where(ChatMessage.session_id == request.session_id)
    
    if request.active_message_ids:
        # Filter to only active messages (excludes archived)
        query = query.where(ChatMessage.id.in_(request.active_message_ids))
    
    query = query.order_by(ChatMessage.timestamp)
    result = await db.execute(query)
    messages = result.scalars().all()
    
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has no messages to summarize"
        )
    
    try:
        # Load previous session summary (if exists) - it's part of active chat content
        summary_result = await db.execute(
            select(SessionSummary).where(SessionSummary.session_id == request.session_id)
        )
        existing_summary = summary_result.scalar_one_or_none()
        
        # Get summary system prompt from settings
        summary_prompt_result = await db.execute(
            select(Setting).where(Setting.key == "system_prompt_summary")
        )
        summary_prompt_setting = summary_prompt_result.scalar_one_or_none()
        
        system_prompt = ""
        if summary_prompt_setting and summary_prompt_setting.value:
            system_prompt = summary_prompt_setting.value.get("content", "")
        
        # Build conversation text: active messages + previous summary (same order as chat window)
        conversation = ""
        for msg in messages:
            role_label = "User" if msg.role == "user" else "AI"
            conversation += f"{role_label}: {msg.content}\n\n"
        if existing_summary:
            conversation += f"Summary: {existing_summary.content}\n\n"
        
        # User prompt with conversation
        user_prompt = f"Create a summary of the following conversation:\n\n{conversation}"
        
        # Create provider
        provider = create_provider(request.model)
        
        # Build messages with system prompt
        summary_messages = []
        if system_prompt:
            summary_messages.append(LLMMessage(role="system", content=system_prompt))
        summary_messages.append(LLMMessage(role="user", content=user_prompt))
        
        # Generate summary
        # Note: Gemini 3 requires temperature=1.0 (default) for optimal performance
        response = await provider.generate_text(
            messages=summary_messages,
            temperature=1.0,
            max_tokens=request.max_tokens
        )
        
        # Track usage
        await usage_tracker.track_usage(
            db=db,
            model=request.model,
            input_tokens=response.usage.get("prompt_tokens", 0),
            output_tokens=response.usage.get("completion_tokens", 0)
        )
        
        # --- PERSISTENZ: Summary + Message Pruning ---
        
        # 1. Delete old summary (if exists)
        await db.execute(
            delete(SessionSummary).where(SessionSummary.session_id == request.session_id)
        )
        
        # 2. Save new summary to DB
        new_summary = SessionSummary(
            id=str(uuid4()),
            session_id=request.session_id,
            content=response.content,
            model=request.model,
            message_count_at_creation=session.message_count,  # For ampel logic
            input_tokens=response.usage.get("prompt_tokens"),
            output_tokens=response.usage.get("completion_tokens"),
        )
        db.add(new_summary)
        
        # 3. Capture ALL messages for vector indexing BEFORE pruning
        all_messages_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == request.session_id)
            .where(ChatMessage.role.in_(["user", "assistant"]))
            .order_by(ChatMessage.timestamp)
        )
        all_messages_for_index = all_messages_result.scalars().all()
        msg_dicts = [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else "",
            }
            for m in all_messages_for_index
        ]

        # 4. Soft-archive old messages (keep last N pairs active, N from settings)
        app_settings_result = await db.execute(
            select(Setting).where(Setting.key == "app_settings")
        )
        app_settings = app_settings_result.scalar_one_or_none()
        keep_pairs = 5
        if app_settings and app_settings.value:
            keep_pairs = app_settings.value.get("summary_keep_message_pairs", 5)
        keep_count = keep_pairs * 2  # pairs -> messages

        all_ids_result = await db.execute(
            select(ChatMessage.id)
            .where(ChatMessage.session_id == request.session_id)
            .where(ChatMessage.is_archived.is_not(True))
            .order_by(ChatMessage.created_at)
        )
        all_message_ids = [row[0] for row in all_ids_result.fetchall()]

        if len(all_message_ids) > keep_count:
            ids_to_archive = all_message_ids[:-keep_count]
            now = datetime.now(UTC)
            await db.execute(
                update(ChatMessage)
                .where(ChatMessage.id.in_(ids_to_archive))
                .values(is_archived=True, archived_at=now)
            )

        # Commit all changes
        await db.commit()
        from src.routers.sessions import _index_session_in_background, _background_tasks
        task = asyncio.create_task(
            _index_session_in_background(
                session_id=request.session_id,
                project_id=session.project_id,
                session_title=session.title,
                summary_text=response.content,
                msg_dicts=msg_dicts,
            )
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)

        return ChatResponse(
            content=response.content,
            model=response.model,
            usage=response.usage
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



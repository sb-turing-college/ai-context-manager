"""Chat audit and verify endpoints."""

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

from src.routers.chat.common import build_context_from_request, resolve_attached_summary_ids

@router.post("/chat/audit", response_model=ChatResponse)
async def audit_draft(
    request: ChatAuditRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_disclaimer_accepted),
) -> ChatResponse:
    """Audit a draft in sparse context mode.
    
    Args:
        request: Audit request with draft content
        db: Database session
        
    Returns:
        Audit feedback from AI
        
    Raises:
        HTTPException: 404 if session not found, 500 on API errors
        
    Example:
        >>> response = await audit_draft(
        ...     ChatAuditRequest(
        ...         session_id="abc-123",
        ...         draft_content="My draft...",
        ...         model="claude-4.5-sonnet"
        ...     ),
        ...     db=db
        ... )
        >>> "Feedback" in response.content
        True
    """
    await require_text_allowed(request.draft_content)

    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == request.session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {request.session_id} not found"
        )
    
    try:
        # CRITICAL: Check if Chat B has existing history
        from src.models.audit_message import AuditMessage
        import uuid
        
        result_check = await db.execute(
            select(AuditMessage)
            .where(AuditMessage.session_id == request.session_id)
            .order_by(AuditMessage.timestamp)
        )
        audit_history = list(result_check.scalars().all())
        has_history = len(audit_history) > 0
        
        # Save draft as user message (visible in Chat B history)
        # Uses [DRAFT V{n}] prefix for frontend DraftBlock detection
        draft_msg = AuditMessage(
            id=str(uuid.uuid4()),
            session_id=request.session_id,
            role="user",
            content=f"[DRAFT V{request.draft_version}]\n\n{request.draft_content}",
            timestamp=datetime.now(UTC)
        )
        db.add(draft_msg)
        await db.commit()
        print(f"✅ Draft V{request.draft_version} saved: {len(request.draft_content)} chars (has_history={has_history})")
        
        # Build context based on history state
        if has_history:
            # Follow-up: Use existing Chat B history + new draft
            from src.services.llm.base import LLMMessage
            from src.services.context_builder import _get_system_prompt
            
            context_messages = []
            
            # System prompt
            system_prompt = await _get_system_prompt(db, "audit")
            if system_prompt:
                context_messages.append(LLMMessage(role="system", content=system_prompt))
            
            # Load ALL audit history (includes previous drafts + AI responses)
            for msg in audit_history:
                context_messages.append(LLMMessage(role=msg.role, content=msg.content))
            
            # Add new draft (already saved to DB, but also add to context for LLM)
            context_messages.append(LLMMessage(role="user", content=f"[DRAFT V{request.draft_version}]\n\n{request.draft_content}"))
            
            print(f"🔄 Audit followup mode: {len(audit_history)} messages in history")
        else:
            # Initial audit: Build full context (docs, status, summaries)
            summary_ids = resolve_attached_summary_ids(session, request.include_summaries)
            context_messages = await build_audit_context(
                db=db,
                session_id=request.session_id,
                draft_content=request.draft_content,
                include_summaries=summary_ids
            )
            print(f"🆕 Initial audit mode")
        
        # Create provider
        provider = create_provider(request.model)
        
        # Generate audit response
        # Note: Using temperature=1.0 (required for Gemini 3 models)
        # For Claude models, lower temperature could be used, but 1.0 is safe default
        response = await provider.generate_text(
            messages=context_messages,
            temperature=1.0
        )
        
        # Track usage
        await usage_tracker.track_usage(
            db=db,
            model=request.model,
            input_tokens=response.usage.get("prompt_tokens", 0),
            output_tokens=response.usage.get("completion_tokens", 0)
        )
        
        # Save AI response to audit_messages for persistence
        ai_msg = AuditMessage(
            id=str(uuid.uuid4()),
            session_id=request.session_id,
            role="assistant",
            content=response.content,
            timestamp=datetime.now(UTC),
            model=request.model
        )
        db.add(ai_msg)
        await db.commit()
        print(f"✅ Initial audit response saved: {len(response.content)} chars")
        
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


@router.post("/chat/verify", response_model=ChatResponse)
async def verify_answer(
    request: ChatVerifyRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_disclaimer_accepted),
) -> ChatResponse:
    """Verify an answer with full context using a different model.
    
    Args:
        request: Verify request with answer to check
        db: Database session
        
    Returns:
        Verification result from AI
        
    Raises:
        HTTPException: 404 if session not found, 500 on API errors
        
    Example:
        >>> response = await verify_answer(
        ...     ChatVerifyRequest(
        ...         session_id="abc-123",
        ...         answer_to_verify="Answer...",
        ...         model="claude-4.5-sonnet"
        ...     ),
        ...     db=db
        ... )
        >>> response.content
        'Verification: ...'
    """
    await require_text_allowed(request.answer_to_verify)

    # Verify session exists
    result = await db.execute(select(Session).where(Session.id == request.session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {request.session_id} not found"
        )
    
    try:
        # Check for existing audit messages (verify history)
        from src.models.audit_message import AuditMessage
        audit_result = await db.execute(
            select(AuditMessage)
            .where(AuditMessage.session_id == request.session_id)
            .order_by(AuditMessage.timestamp)
        )
        audit_history = list(audit_result.scalars().all())
        has_history = len(audit_history) > 0
        
        # Get last verify timestamp (for delta loading of Chat A messages)
        last_verify_timestamp = audit_history[-1].timestamp if audit_history else None
        
        # Save answer to verify as user message in audit_messages
        verify_msg = AuditMessage(
            id=str(uuid.uuid4()),
            session_id=request.session_id,
            role="user",
            content=f"[VERIFY REQUEST]\n\n{request.answer_to_verify}",
            timestamp=datetime.now(UTC)
        )
        db.add(verify_msg)
        await db.commit()
        print(f"✅ Verify request saved: {len(request.answer_to_verify)} chars (has_history={has_history})")
        
        # Build context based on history state
        if has_history:
            # Follow-up: Use existing Chat B history + new verify request (with delta Chat A messages)
            from src.services.llm.base import LLMMessage
            from src.services.context_builder import _get_system_prompt
            
            context_messages = []
            
            # System prompt
            system_prompt = await _get_system_prompt(db, "verify")
            if system_prompt:
                context_messages.append(LLMMessage(role="system", content=system_prompt))
            
            # Load ALL audit history
            for msg in audit_history:
                context_messages.append(LLMMessage(role=msg.role, content=msg.content))
            
            # Add NEW Chat A messages (delta since last verify)
            chat_result = await db.execute(
                select(ChatMessage)
                .where(ChatMessage.session_id == request.session_id)
                .where(ChatMessage.created_at > last_verify_timestamp)
                .order_by(ChatMessage.created_at)
            )
            new_chat_messages = list(chat_result.scalars().all())
            
            if new_chat_messages:
                delta_context = "[NEW MESSAGES SINCE LAST REVIEW]\n\n"
                for msg in new_chat_messages:
                    if msg.role == "user":
                        delta_context += f"User: {msg.content}\n\n"
                    elif msg.role in ("assistant", "ai"):
                        delta_context += f"AI-A: {msg.content}\n\n"
                delta_context += "[END NEW MESSAGES]\n"
                context_messages.append(LLMMessage(role="user", content=delta_context))
            
            # Add new verify request
            context_messages.append(LLMMessage(role="user", content=f"[VERIFY REQUEST]\n\n{request.answer_to_verify}"))
            
            print(f"🔄 Verify followup mode: {len(audit_history)} messages in history, {len(new_chat_messages)} new Chat A messages")
        else:
            # Initial verify: Build full context
            summary_ids = resolve_attached_summary_ids(session, request.include_summaries)
            context_messages = await build_verify_context(
                db=db,
                session_id=request.session_id,
                answer_to_verify=request.answer_to_verify,
                include_summaries=summary_ids,
                last_verify_timestamp=None
            )
            print(f"🆕 Initial verify mode")
        
        # Create provider
        provider = create_provider(request.model)
        
        # Generate verification response
        # Note: Using temperature=1.0 (required for Gemini 3 models)
        # For Claude models, lower temperature could be used, but 1.0 is safe default
        response = await provider.generate_text(
            messages=context_messages,
            temperature=1.0
        )
        
        # Track usage
        await usage_tracker.track_usage(
            db=db,
            model=request.model,
            input_tokens=response.usage.get("prompt_tokens", 0),
            output_tokens=response.usage.get("completion_tokens", 0)
        )
        
        # Save AI response to audit_messages for persistence
        ai_msg = AuditMessage(
            id=str(uuid.uuid4()),
            session_id=request.session_id,
            role="assistant",
            content=response.content,
            timestamp=datetime.now(UTC),
            model=request.model
        )
        db.add(ai_msg)
        await db.commit()
        print(f"✅ Verify response saved: {len(response.content)} chars")
        
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



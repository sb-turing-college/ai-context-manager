"""API endpoints for Audit Messages (Chat B - Critic/Reviewer).

Chat B is fully decoupled from Chat A:
- Context (docs, status) is sent from frontend (own copy, independently manageable)
- Chat B history is ephemeral (not persisted in DB)
- No tools available
- User facts + Chat A history are fetched from DB (read-only reference)
"""
from datetime import datetime, UTC
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models.audit_message import AuditMessage
from src.models.message import ChatMessage
from src.models.session import Session
from src.schemas.audit_message import AuditMessageCreate, AuditMessageResponse
from src.schemas.chat import ChatResponse, ChatBSendRequest
from src.services.llm.factory import create_provider
from src.services import usage_tracker
from src.services.moderation import require_text_allowed
from src.disclaimer_acceptance import require_disclaimer_accepted

router = APIRouter()

# System prompts for Chat B (reviewer role, no tools)
_CHAT_B_SYSTEM_PROMPT_VERIFY = """You are an independent, critical reviewer (Chat B).

You have access to the same context as Chat A (documents, status information, user profile), but you are a fully decoupled, separate AI instance. You receive the conversation history between the user and another AI instance (Chat A) as well as an answer that should be reviewed.

Your task:
- Review critically and independently – do not simply confirm
- Point out errors, gaps, and improvement potential
- Check facts against the available documents and status information
- Answer the user's questions precisely

Important: You use NO tools. You do not write drafts or status entries. You act exclusively as a critical reviewer."""

_CHAT_B_SYSTEM_PROMPT_AUDIT = """You are an independent, critical reviewer (Chat B).

You have access to the same context as Chat A (documents, status information, user profile), but you are a fully decoupled, separate AI instance. You receive a draft/artifact created by another AI instance (Chat A), as well as the conversation history that led to it.

Your task:
- Critically review the draft against the available documents and status information
- Specifically name errors, inconsistencies, and improvement potential
- Answer the user's questions precisely

Important: You use NO tools. You do not write new drafts or status entries. You act exclusively as a critical reviewer."""


@router.post("/audit/send", response_model=ChatResponse)
async def send_chat_b_message(
    request: ChatBSendRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_disclaimer_accepted),
) -> ChatResponse:
    """Send a message in Chat B (Reviewer).

    Context is fully frontend-controlled (decoupled from Chat A).
    Chat B history is ephemeral (not persisted).
    User facts and Chat A history are fetched from DB as read-only reference.

    Args:
        request: Full Chat B request with context + ephemeral history
        db: Database session

    Returns:
        AI response (no DB persistence)

    Raises:
        HTTPException: 404 if session not found
    """
    await require_text_allowed(request.message)

    # Verify session exists (needed to fetch Chat A history + user facts)
    result = await db.execute(select(Session).where(Session.id == request.session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {request.session_id} not found"
        )

    from src.services.llm.base import LLMMessage
    from src.services.context_builder import (
        _get_user_facts,
        _format_user_facts,
        _get_session_summaries,
        format_current_status_block,
        format_cross_session_summaries_block,
    )
    from src.routers.chat.common import resolve_attached_summary_ids
    from src.models.user_fact import UserFact

    messages: list[LLMMessage] = []

    # 1. System prompt (mode-specific reviewer role, no tools)
    system_prompt = (
        _CHAT_B_SYSTEM_PROMPT_VERIFY
        if request.mode == "verify"
        else _CHAT_B_SYSTEM_PROMPT_AUDIT
    )
    messages.append(LLMMessage(role="system", content=system_prompt))

    # 2. Build context block (sent as single user message)
    context_parts: list[str] = []

    # 2a. Documents (from frontend – Chat B's own copy)
    if request.documents:
        doc_context = "## Available Documents\n\n"
        for doc in request.documents:
            doc_context += f"### {doc.title}\n{doc.content}\n\n"
        context_parts.append(doc_context.rstrip())

    # 2b. Status topics (from frontend – Chat B's own copy)
    context_parts.append(
        format_current_status_block(request.status_topics or [])
    )

    # 2c. User facts (from DB – global, read-only reference)
    user_facts = await _get_user_facts(db)
    if user_facts:
        context_parts.append(_format_user_facts(user_facts))

    # 2d. Cross-session summaries (session assignment + request)
    session_row = (
        await db.execute(select(Session).where(Session.id == request.session_id))
    ).scalar_one_or_none()
    summary_ids = (
        resolve_attached_summary_ids(session_row, request.summaries)
        if session_row
        else list(request.summaries or [])
    )
    if summary_ids:
        summaries = await _get_session_summaries(db, summary_ids)
        if summaries:
            context_parts.append(
                format_cross_session_summaries_block(summaries).rstrip()
            )

    # 2e. Chat A history (from DB – flattened, read-only reference)
    chat_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == request.session_id)
        .order_by(ChatMessage.created_at)
    )
    chat_a_messages = list(chat_result.scalars().all())
    if chat_a_messages:
        chat_a_text = "## Chat A History (context – other AI instance)\n\n"
        for msg in chat_a_messages:
            if msg.role == "user":
                chat_a_text += f"User: {msg.content}\n\n"
            elif msg.role in ("assistant", "ai"):
                chat_a_text += f"AI-A: {msg.content}\n\n"
        context_parts.append(chat_a_text.rstrip())

    # 2f. Workshop content / draft (if provided)
    if request.workshop_content:
        context_parts.append(f"## Draft (Workshop content)\n\n{request.workshop_content}")

    # 2g. Answer to verify (verify mode)
    if request.mode == "verify" and request.answer_to_verify:
        context_parts.append(
            f"## Answer to Review (last reply from AI-A)\n\n{request.answer_to_verify}"
        )

    if context_parts:
        full_context = "=== CONTEXT FOR REVIEW ===\n\n"
        full_context += "\n\n---\n\n".join(context_parts)
        full_context += "\n\n=== END CONTEXT ==="
        messages.append(LLMMessage(role="user", content=full_context))

    # 3. Chat B history (ephemeral, from frontend)
    for hist_msg in request.chat_b_history:
        role = hist_msg.role if hist_msg.role in ("user", "assistant") else "user"
        messages.append(LLMMessage(role=role, content=hist_msg.content))  # type: ignore

    # 4. New user message
    messages.append(LLMMessage(role="user", content=request.message))

    print(
        f"🔍 Chat B [{request.mode}] | {len(request.documents)} docs | "
        f"{len(request.status_topics)} status | {len(request.chat_b_history)} history msgs"
    )

    # Generate response (no tools)
    provider = create_provider(request.model)
    llm_response = await provider.generate_text(messages=messages, temperature=1.0)

    # Track usage
    await usage_tracker.track_usage(
        db=db,
        model=request.model,
        input_tokens=llm_response.usage.get("prompt_tokens", 0),
        output_tokens=llm_response.usage.get("completion_tokens", 0)
    )

    return ChatResponse(
        content=llm_response.content,
        model=request.model,
        usage=llm_response.usage
    )


@router.get("/sessions/{session_id}/audit-messages", response_model=list[AuditMessageResponse])
async def get_audit_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[AuditMessage]:
    """Get all audit messages for a session (Chat B history).
    
    Args:
        session_id: Session UUID
        db: Database session
        
    Returns:
        List of audit messages
    """
    result = await db.execute(
        select(AuditMessage)
        .where(AuditMessage.session_id == session_id)
        .order_by(AuditMessage.timestamp)
    )
    return list(result.scalars().all())


@router.delete("/sessions/{session_id}/audit-messages", status_code=status.HTTP_204_NO_CONTENT)
async def clear_audit_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Clear all audit messages for a session (Chat B reset).
    
    Used after feedback transfer if chat_b_persistent is False.
    
    Args:
        session_id: Session UUID
        db: Database session
    """
    await db.execute(
        delete(AuditMessage).where(AuditMessage.session_id == session_id)
    )
    await db.commit()


@router.post("/sessions/{session_id}/audit-messages", response_model=AuditMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_audit_message(
    session_id: str,
    message: AuditMessageCreate,
    db: AsyncSession = Depends(get_db)
) -> AuditMessage:
    """Save a user message to audit_messages without AI response.
    
    Used for follow-up audits where user manually adds draft.
    
    Args:
        session_id: Session UUID
        message: Message data (role, content)
        db: Database session
        
    Returns:
        Created audit message
    """
    # Verify session exists
    session_result = await db.execute(select(Session).where(Session.id == session_id))
    if not session_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found"
        )
    
    # Create message
    audit_msg = AuditMessage(
        id=str(uuid.uuid4()),
        session_id=session_id,
        role=message.role,
        content=message.content,
        timestamp=datetime.now(UTC)
    )
    db.add(audit_msg)
    await db.commit()
    await db.refresh(audit_msg)
    
    print(f"✅ Audit message saved (no AI response): {len(message.content)} chars")
    
    return audit_msg

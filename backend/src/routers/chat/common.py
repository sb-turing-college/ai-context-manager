"""Shared helpers for chat routers."""

import json
from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Session, ChatMessage, SessionSummary, Project
from src.services.content_timestamps import (
    touch_project_content,
    touch_session_content,
)
from src.schemas.chat import ChatContext
from src.services.llm.base import LLMMessage
from src.services.context_builder import (
    _system_time_message,
    _format_timestamp,
    _format_user_facts,
    format_available_documents_block,
    format_cross_session_summaries_block,
    format_current_status_block,
    format_workshop_draft_block,
)


def resolve_attached_summary_ids(
    session: Session,
    request_ids: list[str] | None = None,
) -> list[str]:
    """Merge DB attached_summary_ids with request IDs (DB first, unique, no self)."""
    db_ids = (
        session.attached_summary_ids
        if isinstance(getattr(session, "attached_summary_ids", None), list)
        else []
    )
    seen: set[str] = set()
    out: list[str] = []
    for sid in list(db_ids) + list(request_ids or []):
        if not sid or sid == session.id or sid in seen:
            continue
        seen.add(sid)
        out.append(str(sid))
    return out


def build_context_from_request(
    ctx: ChatContext,
    chat_history: list[ChatMessage],
    session_summary: SessionSummary | None = None,
    cross_session_summaries: list[dict] | None = None,
    *,
    status_topics: list | None = None,
    documents: list | None = None,
    user_facts: list | None = None,
) -> list[LLMMessage]:
    """Build chat context.

    When DB-loaded lists are passed (status/documents/user_facts), those are
    SSOT — same source the UI panels refresh from. FE ctx fields are fallbacks.
    """
    messages: list[LLMMessage] = []
    
    # 0. Current system time (always first)
    messages.append(_system_time_message())
    
    # 1. System Prompt (wenn vorhanden)
    if ctx.system_prompt:
        messages.append(LLMMessage(role="system", content=ctx.system_prompt))
    
    # 2. Library documents (DB SSOT preferred)
    docs_for_llm = documents if documents is not None else list(ctx.documents or [])
    messages.append(
        LLMMessage(
            role="system",
            content=format_available_documents_block(docs_for_llm),
        )
    )
    
    # 3. Status (DB SSOT preferred; always inject so draft cannot invent it)
    topics_for_llm = (
        status_topics if status_topics is not None else list(ctx.status_topics or [])
    )
    messages.append(
        LLMMessage(
            role="user",
            content=format_current_status_block(topics_for_llm, include_ids=True),
        )
    )

    # 4. User Profile (DB SSOT when provided)
    if user_facts:
        messages.append(
            LLMMessage(role="user", content=_format_user_facts(user_facts))
        )
    
    # 5. Cross-Session Summaries (from other sessions - IMPORTANT for knowledge transfer!)
    if cross_session_summaries:
        messages.append(
            LLMMessage(
                role="user",
                content=format_cross_session_summaries_block(cross_session_summaries),
            )
        )
    
    # 5. Chat History + Session Summary (chronologically sorted)
    # CRITICAL: Summary must be inserted at correct position based on created_at timestamp!
    combined_history: list[tuple[datetime, LLMMessage]] = []
    
    # Add chat messages with their created_at timestamps
    from src.services.tools.claim_guard import sanitize_history_assistant_content

    for msg in chat_history:
        if msg.role in ("user", "assistant"):
            ts = _format_timestamp(msg.created_at)
            body = msg.content or ""
            if msg.role == "assistant":
                body = sanitize_history_assistant_content(
                    body, getattr(msg, "tool_call_data", None)
                )
            combined_history.append((
                msg.created_at,
                LLMMessage(role=msg.role, content=f"[{ts}]\n{body}")  # type: ignore
            ))
        elif msg.role == "feedback" and msg.feedback_data:
            # Feedback from Chat B audit - send as user message with prefix
            ts = _format_timestamp(msg.created_at)
            feedback_content = f"[{ts}]\n[AUDIT FEEDBACK from Chat B]\n\n"
            fb_messages = msg.feedback_data.get("messages", [])
            for fb_msg in fb_messages:
                role_label = "Auditor" if fb_msg.get("role") == "ai" else "User"
                feedback_content += f"**{role_label}:** {fb_msg.get('content', '')}\n\n"
            combined_history.append((msg.created_at, LLMMessage(role="user", content=feedback_content)))
    
    # Add session summary at correct chronological position
    if session_summary:
        summary_content = "[SESSION SUMMARY]\n\n"
        summary_content += session_summary.content
        combined_history.append((session_summary.created_at, LLMMessage(role="user", content=summary_content)))
    
    # Sort by timestamp to ensure correct chronological order
    combined_history.sort(key=lambda x: x[0])
    
    # Extract just the messages (sorted)
    for _, msg in combined_history:
        messages.append(msg)
    
    return messages


async def _stream_response(
    provider,
    messages: list[LLMMessage],
    temperature: float,
    session_id: str,
    model: str,
    db: AsyncSession
):
    """Stream AI response chunks.
    
    Generator for Server-Sent Events (SSE) streaming.
    
    Args:
        provider: LLM provider instance
        messages: Context messages
        temperature: Sampling temperature
        session_id: Session ID
        model: Model identifier
        db: Database session
        
    Yields:
        SSE formatted chunks
    """
    full_content = ""
    
    try:
        async for chunk in provider.stream_text(messages, temperature):
            if chunk.content:
                full_content += chunk.content
                
                # Send SSE chunk
                data = json.dumps({"content": chunk.content})
                yield f"data: {data}\n\n"
            
            if chunk.finish_reason:
                # Send final chunk
                yield "data: [DONE]\n\n"
                break
        
        # Save complete AI response to database
        ai_message = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=full_content,
            timestamp=datetime.now(UTC),
            model=model
        )
        db.add(ai_message)
        
        # Update session
        result = await db.execute(select(Session).where(Session.id == session_id))
        session = result.scalar_one_or_none()
        if session:
            session.message_count += 1
            when = touch_session_content(session)
            project = await db.get(Project, session.project_id)
            if project is not None:
                touch_project_content(project, when=when)
        
        await db.commit()
    
    except Exception as e:
        # Send error as SSE
        error_data = json.dumps({"error": str(e)})
        yield f"data: {error_data}\n\n"



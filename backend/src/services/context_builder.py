"""Context builder service for assembling chat context."""

from dataclasses import dataclass
from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import (
    Session,
    SessionSummary,
    ChatMessage,
    LibraryItem,
    StatusTopic,
    UserFact,
    Setting
)
from src.services.llm.base import LLMMessage


def _format_timestamp(dt: datetime) -> str:
    """Format a datetime as absolute UTC timestamp for AI context.
    
    Example: '2026-02-19 14:32 UTC'
    """
    if dt.tzinfo is None:
        # Treat naive datetimes as UTC
        return dt.strftime("%Y-%m-%d %H:%M UTC")
    return dt.astimezone(UTC).strftime("%Y-%m-%d %H:%M UTC")


def _system_time_message() -> LLMMessage:
    """Return a system message with the current UTC time.
    
    Enables the AI to assess temporal context:
    - Age of information in the conversation
    - Staleness of external sources
    - Time elapsed since past events
    """
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    return LLMMessage(
        role="system",
        content=f"[CURRENT SYSTEM TIME: {now}]"
    )


def format_cross_session_summaries_block(
    summaries: list[dict],
    *,
    as_reference: bool = False,
) -> str:
    """Format attached summaries for LLM context (clearly not Library docs)."""
    heading = (
        "## Knowledge from Other Sessions (reference)\n\n"
        if as_reference
        else "## Knowledge from Other Sessions\n\n"
    )
    summary_context = (
        heading
        + "These are cross-session summaries the user attached for this chat. "
        "They are already in context — not Library documents. Do not search "
        "the Library for them; quote or summarize from this block.\n\n"
    )
    for summary_data in summaries:
        session_title = summary_data["session_title"]
        summary_content = summary_data["content"]
        summary_context += (
            f"### Session: {session_title}\n"
            f"(Attached cross-session summary)\n\n"
            f"{summary_content}\n\n"
        )
    return summary_context


def format_current_status_block(
    topics: list | None = None,
    *,
    as_reference: bool = False,
    include_ids: bool = False,
    include_history: bool = True,
) -> str:
    """Format live project status for LLM context (not draft/summary)."""
    from src.services.status_history import format_status_history_for_llm

    heading = (
        "## Current Status (reference)\n\n"
        if as_reference
        else "## Current Status\n\n"
    )
    preamble = (
        "Project-wide status. NOT Workshop draft, NOT a cross-session summary. "
        "Other sessions or the UI may change it between your turns. "
        "Never trust chat memory for status. "
        "When asked what the status is: quote ONLY "
        "`### LIVE STATUS (QUOTE ONLY THIS)` — never the history section, "
        "never earlier chat turns. "
        "Use `STATUS HISTORY` only to explain who/why it changed. "
        "Never claim status was saved unless you just called a status tool. "
        "If draft/summary differs from LIVE STATUS, say they differ.\n\n"
    )
    if not topics:
        return heading + preamble + "No status entries."

    lines = [heading + preamble]
    for topic in topics:
        if isinstance(topic, dict):
            title = topic.get("title", "")
            content = topic.get("content", "")
            topic_id = topic.get("id")
            history = topic.get("history")
        else:
            title = getattr(topic, "title", "")
            content = getattr(topic, "content", "")
            topic_id = getattr(topic, "id", None)
            history = getattr(topic, "history", None)

        id_bit = f" (ID: `{topic_id}`)" if include_ids and topic_id else ""
        lines.append(f"### LIVE STATUS (QUOTE ONLY THIS) — {title}{id_bit}\n")
        lines.append(f"{content}\n")
        lines.append("\n---\n\n")
        if include_history:
            hist_block = format_status_history_for_llm(history)
            if hist_block:
                lines.append(hist_block)
                lines.append("\n")
        else:
            lines.append("\n")
    return "".join(lines).rstrip()


def format_workshop_draft_block(draft_content: str) -> str:
    """Format Workshop draft as proposal-only artifact channel."""
    return (
        "[WORKSHOP DRAFT]\n"
        "Artifact channel — editable proposal only. "
        "This draft does NOT update live project status, Library documents, "
        "or user profile. Live status is exclusively in ## Current Status. "
        "Ignore any claim inside this draft that status was already saved "
        "unless a status tool result in this turn confirms it.\n\n"
        f"{draft_content}\n\n"
        "[END WORKSHOP DRAFT]"
    )


@dataclass
class CacheableContext:
    """Context split for caching optimization.
    
    Separates context into static (cacheable) and dynamic (not cacheable) parts
    to optimize costs with provider caching systems.
    
    Attributes:
        static_content: Stable content (system prompt + docs + summaries) - CACHED
        dynamic_messages: Dynamic content (status + chat history) - NOT CACHED
    """
    
    static_content: str
    dynamic_messages: list[LLMMessage]


async def build_chat_context(
    db: AsyncSession,
    session_id: str,
    mode: str = "chat",
    include_summaries: list[str] | None = None
) -> list[LLMMessage]:
    """Build context for chat completion.
    
    Assembles the full context including:
    - System prompt (from settings)
    - Selected documents (from library)
    - Status topics (current state)
    - Cross-session summaries
    - Conversation history
    
    Args:
        db: Database session
        session_id: Current session ID
        mode: Context mode - 'chat' (full), 'audit' (sparse), 'verify' (full)
        include_summaries: Optional list of session IDs whose summaries to include
        
    Returns:
        List of LLM messages ready for API call
        
    Raises:
        ValueError: If session not found
        
    Example:
        >>> context = await build_chat_context(
        ...     db,
        ...     session_id="abc-123",
        ...     mode="chat",
        ...     include_summaries=["def-456"]
        ... )
        >>> len(context)
        10
    """
    # Get session
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    messages: list[LLMMessage] = []
    
    # 0. Current system time (always first - enables temporal reasoning)
    messages.append(_system_time_message())
    
    # 1. System Prompt
    system_prompt = await _get_system_prompt(db, mode)
    if system_prompt:
        messages.append(LLMMessage(
            role="system",
            content=system_prompt
        ))
    
    # 2. Context sections as USER role (only for full context modes)
    if mode in ("chat", "verify"):
        context_parts: list[str] = []
        
        # Documents (from library)
        documents = await _get_selected_documents(db, session.project_id)
        if documents:
            doc_context = "## Available Documents\n\n"
            for doc in documents:
                doc_context += f"### {doc.title}\n{doc.content}\n\n"
            context_parts.append(doc_context)
        
        # Status Topics
        status_topics = await _get_status_topics(db, session.project_id)
        context_parts.append(
            format_current_status_block(status_topics, include_ids=True)
        )

        # User Profile Facts (global, project-independent)
        user_facts = await _get_user_facts(db)
        if user_facts:
            facts_context = _format_user_facts(user_facts)
            context_parts.append(facts_context)

        # Cross-Session Summaries
        if include_summaries:
            summaries = await _get_session_summaries(db, include_summaries)
            if summaries:
                context_parts.append(format_cross_session_summaries_block(summaries))
        
        # Combine all context into ONE user message
        if context_parts:
            full_context = "\n---\n\n".join(context_parts)
            messages.append(LLMMessage(
                role="user",
                content=full_context
            ))
    
    # 3. Conversation History (with timestamps) – archived messages excluded
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .where(ChatMessage.is_archived.is_not(True))
        .order_by(ChatMessage.created_at)
    )
    chat_messages = result.scalars().all()
    
    from src.services.tools.claim_guard import sanitize_history_assistant_content

    for msg in chat_messages:
        if msg.role in ("user", "assistant"):
            ts = _format_timestamp(msg.created_at)
            body = msg.content or ""
            if msg.role == "assistant":
                body = sanitize_history_assistant_content(body, msg.tool_call_data)
            messages.append(LLMMessage(
                role=msg.role,  # type: ignore
                content=f"[{ts}]\n{body}"
            ))
        # Skip tool/feedback messages in context for now
    
    return messages


async def build_context_for_caching(
    db: AsyncSession,
    session_id: str,
    mode: str = "chat",
    include_summaries: list[str] | None = None
) -> CacheableContext:
    """Build context optimized for caching.
    
    Splits context into static (cacheable) and dynamic (not cacheable) parts:
    
    STATIC (cached):
    - System prompt
    - Documents (library)
    - Cross-session summaries
    
    DYNAMIC (not cached):
    - Status topics (change frequently)
    - Chat history (grows with each turn)
    
    CRITICAL: Order in static content must be stable for Claude caching!
    
    Args:
        db: Database session
        session_id: Current session ID
        mode: Context mode - 'chat' (full), 'audit' (sparse), 'verify' (full)
        include_summaries: Optional list of session IDs whose summaries to include
        
    Returns:
        CacheableContext with static and dynamic parts separated
        
    Raises:
        ValueError: If session not found
        
    Example:
        >>> ctx = await build_context_for_caching(db, "abc-123")
        >>> len(ctx.static_content) > 0
        True
        >>> len(ctx.dynamic_messages) >= 0
        True
    """
    # Get session
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    # ═══════════════════════════════════════════════════════════════
    # STATIC PART (cached) - Order is CRITICAL for Claude!
    # ═══════════════════════════════════════════════════════════════
    static_parts: list[str] = []
    
    # 1. System Prompt (ALWAYS first for stability)
    system_prompt = await _get_system_prompt(db, mode)
    if system_prompt:
        static_parts.append(system_prompt)
    
    # 2. User Profile Facts (global – rarely change, good cache candidate)
    user_facts = await _get_user_facts(db)
    if user_facts:
        static_parts.append(_format_user_facts(user_facts))

    # 3. Documents (only for full context modes)
    if mode in ("chat", "verify"):
        documents = await _get_selected_documents(db, session.project_id)
        if documents:
            doc_section = "## Available Documents\n\n"
            for doc in documents:
                doc_section += f"### {doc.title}\n{doc.content}\n\n"
            static_parts.append(doc_section)
    
    # 5. Cross-Session Summaries
    if include_summaries and mode in ("chat", "verify"):
        summaries = await _get_session_summaries(db, include_summaries)
        if summaries:
            static_parts.append(format_cross_session_summaries_block(summaries))
    
    # Combine static parts with clear separators
    static_content = "\n\n---\n\n".join(static_parts)
    
    # ═══════════════════════════════════════════════════════════════
    # DYNAMIC PART (not cached) - Changes frequently
    # ═══════════════════════════════════════════════════════════════
    dynamic_messages: list[LLMMessage] = []
    
    # 4a. Current system time (dynamic - changes every request)
    dynamic_messages.append(_system_time_message())
    
    # 4b. Status Topics (changes with tool calls)
    if mode in ("chat", "verify"):
        status_topics = await _get_status_topics(db, session.project_id)
        dynamic_messages.append(LLMMessage(
            role="user",
            content=format_current_status_block(status_topics, include_ids=True),
        ))
    
    # 5. Conversation History (with timestamps) – archived messages excluded
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .where(ChatMessage.is_archived.is_not(True))
        .order_by(ChatMessage.created_at)
    )
    chat_messages = result.scalars().all()
    
    from src.services.tools.claim_guard import sanitize_history_assistant_content

    for msg in chat_messages:
        if msg.role in ("user", "assistant"):
            ts = _format_timestamp(msg.created_at)
            body = msg.content or ""
            if msg.role == "assistant":
                body = sanitize_history_assistant_content(body, msg.tool_call_data)
            dynamic_messages.append(LLMMessage(
                role=msg.role,  # type: ignore
                content=f"[{ts}]\n{body}"
            ))
    
    return CacheableContext(
        static_content=static_content,
        dynamic_messages=dynamic_messages
    )


async def build_audit_context(
    db: AsyncSession,
    session_id: str,
    draft_content: str,
    include_summaries: list[str] | None = None
) -> list[LLMMessage]:
    """Build context for draft auditing.
    
    For audit mode, we include:
    - Audit system prompt
    - Documents (for fact-checking)
    - Status (as reference)
    - Cross-session summaries (as reference)
    - The draft to review
    - NO chat history (irrelevant for draft review)
    
    Args:
        db: Database session
        session_id: Current session ID
        draft_content: The draft to audit
        include_summaries: Optional list of session IDs for context
        
    Returns:
        List of LLM messages for audit
    """
    # Get session for project reference
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    messages: list[LLMMessage] = []
    
    # 0. Current system time
    messages.append(_system_time_message())
    
    # 1. Audit system prompt
    system_prompt = await _get_system_prompt(db, "audit")
    if system_prompt:
        messages.append(LLMMessage(
            role="system",
            content=system_prompt
        ))
    
    # 2. Context as USER role
    context_parts: list[str] = []
    
    # Documents (for fact-checking the draft)
    documents = await _get_selected_documents(db, session.project_id)
    if documents:
        doc_context = "## Available Documents (reference for fact-checking)\n\n"
        for doc in documents:
            doc_context += f"### {doc.title}\n{doc.content}\n\n"
        context_parts.append(doc_context)
    
    # Status Topics (as reference)
    status_topics = await _get_status_topics(db, session.project_id)
    context_parts.append(
        format_current_status_block(status_topics, as_reference=True)
    )

    # User Profile Facts
    user_facts = await _get_user_facts(db)
    if user_facts:
        context_parts.append(_format_user_facts(user_facts))

    # Cross-Session Summaries (if any)
    if include_summaries:
        summaries = await _get_session_summaries(db, include_summaries)
        if summaries:
            context_parts.append(
                format_cross_session_summaries_block(summaries, as_reference=True)
            )
    
    # Combine all context into ONE user message
    if context_parts:
        full_context = "=== CONTEXT FOR AUDIT ===\n\n"
        full_context += "\n---\n\n".join(context_parts)
        full_context += "\n\n=== END CONTEXT ===\n"
        
        messages.append(LLMMessage(
            role="user",
            content=full_context
        ))
    
    # 3. The draft to audit (separate user message)
    messages.append(LLMMessage(
        role="user",
        content=f"Please critically review the following draft:\n\n{draft_content}"
    ))
    
    return messages


async def build_verify_context(
    db: AsyncSession,
    session_id: str,
    answer_to_verify: str,
    include_summaries: list[str] | None = None,
    last_verify_timestamp: datetime | None = None
) -> list[LLMMessage]:
    """Build context for answer verification.
    
    IMPORTANT: All context (except the system prompt) is sent as USER role.
    Only the system prompt stays as system role.
    
    Chat B (Verify) therefore receives the full Chat A context:
    - Documents
    - Status
    - Summaries
    - Chat history (flattened) — delta-loading: only new messages when a timestamp is set
    - The answer under review
    
    Args:
        db: Database session
        session_id: Current session ID
        answer_to_verify: The answer to verify
        include_summaries: Optional list of session IDs for context
        last_verify_timestamp: If set, load only messages after this timestamp (delta-loading)
        
    Returns:
        List of LLM messages for verification
    """
    # Get session for project reference
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    messages: list[LLMMessage] = []
    
    # 0. Current system time
    messages.append(_system_time_message())
    
    # 1. System Prompt for Critic role (ONLY this as system!)
    system_prompt = await _get_system_prompt(db, "verify")
    if system_prompt:
        messages.append(LLMMessage(
            role="system",
            content=system_prompt
        ))
    
    # ═══════════════════════════════════════════════════════════════
    # Everything below as USER role — ensures full delivery to the model.
    # ═══════════════════════════════════════════════════════════════
    
    context_parts: list[str] = []
    
    # 2. Documents (for fact-checking reference)
    documents = await _get_selected_documents(db, session.project_id)
    if documents:
        doc_context = "## Available Documents (reference for fact-checking)\n\n"
        for doc in documents:
            doc_context += f"### {doc.title}\n{doc.content}\n\n"
        context_parts.append(doc_context)
    
    # 3. Status Topics (as reference) — critical for correct verification
    status_topics = await _get_status_topics(db, session.project_id)
    context_parts.append(
        format_current_status_block(status_topics, as_reference=True)
    )

    # 3b. User Profile Facts
    user_facts = await _get_user_facts(db)
    if user_facts:
        context_parts.append(_format_user_facts(user_facts))

    # 4. Cross-Session Summaries (if any)
    if include_summaries:
        summaries = await _get_session_summaries(db, include_summaries)
        if summaries:
            context_parts.append(
                format_cross_session_summaries_block(summaries, as_reference=True)
            )
    
    # 5. Chat history as FLATTENED TEXT (not as alternating roles!)
    # Delta-loading: Only load messages AFTER last verify timestamp (if set)
    if last_verify_timestamp:
        chat_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .where(ChatMessage.is_archived.is_not(True))
            .where(ChatMessage.created_at > last_verify_timestamp)
            .order_by(ChatMessage.created_at)
        )
        flattened_chat = "[NEW MESSAGES SINCE LAST REVIEW]\n\n"
    else:
        chat_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .where(ChatMessage.is_archived.is_not(True))
            .order_by(ChatMessage.created_at)
        )
        flattened_chat = "[CONTEXT FROM CHAT A - conversation history of a DIFFERENT AI instance]\n\n"
    
    chat_messages = chat_result.scalars().all()
    
    if chat_messages:
        for msg in chat_messages:
            ts = _format_timestamp(msg.created_at)
            if msg.role == "user":
                flattened_chat += f"[{ts}] User: {msg.content}\n\n"
            elif msg.role in ("assistant", "ai"):
                flattened_chat += f"[{ts}] AI-A: {msg.content}\n\n"
        flattened_chat += "[END CONTEXT]\n"
        context_parts.append(flattened_chat)
    
    # 6. Combine all context into ONE user message
    if context_parts:
        full_context = "=== CONTEXT FOR VERIFICATION ===\n\n"
        full_context += "\n---\n\n".join(context_parts)
        full_context += "\n\n=== END CONTEXT ===\n"
        
        messages.append(LLMMessage(
            role="user",
            content=full_context
        ))
    
    # 7. Verification prompt (separate user message)
    verify_prompt = (
        "[VERIFY-REQUEST]\n\n"
        "You are an EXTERNAL CRITIC (Chat B). "
        "The latest answer from AI-A should be reviewed.\n\n"
        "IMPORTANT:\n"
        "- You are NOT AI-A, but a separate instance (Chat B)\n"
        "- The context above shows you a DIFFERENT AI's conversation\n"
        "- You have access to the same documents and status entries as AI-A\n"
        "- Critically review the following answer as an independent reviewer\n\n"
        "--- ANSWER TO REVIEW FROM AI-A ---\n\n"
        f"{answer_to_verify}\n\n"
        "--- END OF ANSWER TO REVIEW ---\n\n"
        "Analyze this answer now as an external critic:\n"
        "1. Is it factually correct (check against documents and status)?\n"
        "2. Is it complete?\n"
        "3. Are there gaps or errors?\n"
        "4. What could be improved?"
    )
    
    messages.append(LLMMessage(
        role="user",
        content=verify_prompt
    ))
    
    return messages


async def _get_system_prompt(db: AsyncSession, mode: str) -> str:
    """Get system prompt from settings.
    
    Args:
        db: Database session
        mode: Context mode (chat, audit, verify)
        
    Returns:
        System prompt content or empty string
    """
    # Get system prompt modules (3-module design: base, expertise, tool_use)
    modules = []
    for key in ["base", "expertise", "tool_use"]:
        result = await db.execute(
            select(Setting).where(Setting.key == f"system_prompt_{key}")
        )
        setting = result.scalar_one_or_none()
        
        if setting and "content" in setting.value:
            modules.append(setting.value["content"])
    
    # Combine modules
    return "\n\n".join(modules) if modules else ""


async def _get_selected_documents(
    db: AsyncSession,
    project_id: str,
    *,
    limit: int | None = 5,
) -> list[LibraryItem]:
    """Get library documents for context.

    Args:
        db: Database session
        project_id: Project ID
        limit: Max items (None = all, matching UI library panel)

    Returns:
        List of library items
    """
    query = (
        select(LibraryItem)
        .where(LibraryItem.project_id == project_id)
        .order_by(LibraryItem.updated_at.desc())
    )
    if limit is not None:
        query = query.limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


def format_available_documents_block(documents: list) -> str:
    """Format library documents for LLM (same set the UI library shows)."""
    if not documents:
        return (
            "## Available Documents\n\n"
            "No library documents in this project."
        )
    doc_context = (
        "## Available Documents\n\n"
        "LIVE library documents for this project (same as the UI Library panel).\n\n"
    )
    for doc in documents:
        if isinstance(doc, dict):
            title = doc.get("title", "")
            content = doc.get("content", "")
            doc_id = doc.get("id")
        else:
            title = getattr(doc, "title", "")
            content = getattr(doc, "content", "")
            doc_id = getattr(doc, "id", None)
        if doc_id:
            doc_context += f"### {title} (ID: `{doc_id}`)\n{content}\n\n"
        else:
            doc_context += f"### {title}\n{content}\n\n"
    return doc_context.rstrip()


async def _get_user_facts(db: AsyncSession) -> list[UserFact]:
    """Get all global user profile facts ordered by category + order_index.

    Args:
        db: Database session

    Returns:
        List of user facts
    """
    result = await db.execute(
        select(UserFact).order_by(UserFact.category, UserFact.order_index)
    )
    return list(result.scalars().all())


def _format_user_facts(facts: list[UserFact]) -> str:
    """Format user facts for context injection.

    Groups facts by category and formats them as Markdown.

    Args:
        facts: List of user facts

    Returns:
        Formatted Markdown string
    """
    category_labels = {
        "style": "Communication style",
        "expertise": "Expertise",
        "preference": "Preferences",
        "context": "Context & role"
    }

    # Group by category
    by_category: dict[str, list[UserFact]] = {}
    for fact in facts:
        by_category.setdefault(fact.category, []).append(fact)

    sections = ["## User Profile\n\n*Persistent facts about this user (cross-project)*\n"]
    for cat, cat_facts in by_category.items():
        label = category_labels.get(cat, cat.capitalize())
        sections.append(f"### {label}")
        for fact in cat_facts:
            sections.append(f"- **{fact.title}** (ID: `{fact.id}`): {fact.content}")
        sections.append("")

    return "\n".join(sections)


async def _get_status_topics(db: AsyncSession, project_id: str) -> list[StatusTopic]:
    """Get status topics for context.
    
    Args:
        db: Database session
        project_id: Project ID
        
    Returns:
        List of status topics
    """
    result = await db.execute(
        select(StatusTopic)
        .where(StatusTopic.project_id == project_id)
        .order_by(StatusTopic.order_index)
    )
    return list(result.scalars().all())


async def get_session_summaries(
    db: AsyncSession,
    session_ids: list[str]
) -> list[dict]:
    """Get summaries from other sessions.
    
    Public function for cross-session context loading.
    
    Args:
        db: Database session
        session_ids: List of session IDs to get summaries from
        
    Returns:
        List of dictionaries with session_title and content
    """
    summaries = []
    
    for session_id in session_ids:
        # Get session
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            continue
        
        # Get summary
        result = await db.execute(
            select(SessionSummary).where(SessionSummary.session_id == session_id)
        )
        summary = result.scalar_one_or_none()
        
        if summary:
            summaries.append({
                "session_title": session.title,
                "content": summary.content
            })
    
    return summaries


# Alias for internal usage (backwards compatibility)
_get_session_summaries = get_session_summaries

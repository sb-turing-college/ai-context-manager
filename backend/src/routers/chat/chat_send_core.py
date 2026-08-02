"""Shared non-streaming chat-turn logic for /chat/send and /chat/send/progress."""

import asyncio
from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Session, ChatMessage, SessionSummary, Project
from src.services.content_timestamps import (
    touch_project_content,
    touch_session_content,
)
from src.schemas.chat import (
    ChatSendRequest,
    ChatResponse,
    ToolCallInfo,
    DraftData,
    EditData,
    SingleEdit,
)
from src.services.llm.base import LLMMessage
from src.services.context_builder import (
    build_chat_context,
    get_session_summaries,
    _get_selected_documents,
    _get_library_folders,
    _get_status_topics,
    _get_user_facts,
    format_workshop_draft_block,
)
from src.services.tools.orchestrator import execute_with_tools, ProgressEventCallback
from src.services.tools.turn_summary import (
    build_turn_summary,
    strip_echoed_turn_summary,
)
from src.services.tools.claim_guard import (
    apply_claim_guard,
    build_guard_turn_summary,
    make_claim_guard_tool_entry,
    claim_guard_needs_retry,
    build_forced_retry_instruction,
    history_guard_replacement,
    merge_token_usage,
    CLAIM_GUARD_MAX_RETRIES,
)
from src.services import usage_tracker
from src.routers.chat_helper import get_enabled_tools
from src.routers.settings import get_app_settings_dict
from src.routers.chat.common import build_context_from_request


async def _generate_text_with_stages(
    provider,
    messages: list[LLMMessage],
    temperature: float,
    on_event: ProgressEventCallback | None,
):
    """Generate text, emitting thinking/generating stages when on_event is set."""
    if on_event is not None:
        await on_event({"type": "stage", "stage": "thinking"})
        await on_event({"type": "stage", "stage": "generating"})
    return await provider.generate_text(
        messages=messages,
        temperature=temperature,
    )


async def run_chat_turn(
    request: ChatSendRequest,
    session: Session,
    db: AsyncSession,
    provider,
    summary_ids: list,
    on_event: ProgressEventCallback | None = None,
) -> ChatResponse:
    """Build context, run tools/claim-guard, persist, and return ChatResponse.

    When on_event is None, behavior matches the classic JSON /chat/send path.
    """
    # Build context: Use frontend context if provided, otherwise DB
    if request.context:
        # Frontend-provided context (Single Source of Truth)
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == request.session_id)
            .order_by(ChatMessage.created_at)
        )
        chat_history = list(result.scalars().all())

        # Load session summary from session_summaries table (if exists)
        summary_result = await db.execute(
            select(SessionSummary).where(SessionSummary.session_id == request.session_id)
        )
        session_summary = summary_result.scalar_one_or_none()

        # Load cross-session summaries (DB assignment + request IDs)
        cross_session_summaries = None
        if summary_ids:
            cross_session_summaries = await get_session_summaries(db, summary_ids)
            if cross_session_summaries:
                print(
                    f"✅ Loaded {len(cross_session_summaries)} cross-session summaries "
                    f"(ids={summary_ids})"
                )
            else:
                print(
                    f"⚠️ summary_ids set but none loaded from DB (ids={summary_ids})"
                )

        # State/knowledge SSOT from DB (same sources UI panels use)
        status_topics = await _get_status_topics(db, session.project_id)
        documents = await _get_selected_documents(
            db, session.project_id, limit=None
        )
        library_folders = await _get_library_folders(db, session.project_id)
        user_facts = await _get_user_facts(db)

        # Debug: Log context stats
        print(
            f"📄 Context: {len(documents)} docs (DB), "
            f"{len(library_folders)} folders (DB), "
            f"{len(status_topics)} status (DB), "
            f"{len(user_facts)} user-facts (DB), "
            f"{len(cross_session_summaries) if cross_session_summaries else 0} cross-summaries"
        )

        context_messages = build_context_from_request(
            request.context,
            chat_history,
            session_summary,
            cross_session_summaries,
            status_topics=status_topics,
            documents=documents,
            library_folders=library_folders,
            user_facts=user_facts,
        )
    else:
        # Legacy: DB-based context
        context_messages = await build_chat_context(
            db=db,
            session_id=request.session_id,
            mode="chat",
            include_summaries=summary_ids
        )

    # Workshop draft = artifact channel (proposal only; editor is intentional FE SSOT)
    if request.context and request.context.implicit_context:
        context_messages.append(LLMMessage(
            role="user",
            content=format_workshop_draft_block(request.context.implicit_context),
        ))

    # Add current user message to context (NOT saved to DB yet!)
    context_messages.append(LLMMessage(
        role="user",
        content=request.message
    ))

    # Prepare user message (will be saved AFTER successful LLM call)
    user_message = ChatMessage(
        session_id=request.session_id,
        role="user",
        content=request.message,
        timestamp=datetime.now(UTC)
    )

    # Check if tools should be used
    response_content = ""
    tool_calls_made = []
    response_usage = {}
    forced_retries_used = 0

    if request.use_tools:
        # Get enabled tools from settings
        enabled_tools = await get_enabled_tools(db)

        if enabled_tools:
            app_settings = await get_app_settings_dict(db)
            search_scope = app_settings.get("search_past_sessions_scope", "project_only")
            # Execute with tools
            workshop_draft = (
                request.context.implicit_context
                if request.context
                else None
            )
            response_content, tool_calls_made, response_usage = await execute_with_tools(
                provider=provider,
                messages=context_messages,
                enabled_tools=enabled_tools,
                db=db,
                project_id=session.project_id,
                temperature=request.temperature,
                max_iterations=3,
                session_id=request.session_id,
                search_scope=search_scope,
                current_draft=workshop_draft,
                on_event=on_event,
            )
            # Forced tool retry when claim guard would block (circuit: max N)
            while forced_retries_used < CLAIM_GUARD_MAX_RETRIES:
                preview = strip_echoed_turn_summary(response_content or "")
                _, guarded, events = apply_claim_guard(
                    preview, tool_calls_made
                )
                if not claim_guard_needs_retry(
                    guarded, events, tool_calls_made
                ):
                    break
                forced_retries_used += 1
                print(
                    f"[guard] forced tool retry "
                    f"{forced_retries_used}/{CLAIM_GUARD_MAX_RETRIES} "
                    f"events={[e.get('kind') for e in events]}"
                )
                retry_messages = list(context_messages)
                retry_messages.append(LLMMessage(
                    role="assistant",
                    content=history_guard_replacement(events),
                ))
                retry_messages.append(LLMMessage(
                    role="user",
                    content=build_forced_retry_instruction(
                        request.message, events
                    ),
                ))
                response_content, tool_calls_made, retry_usage = (
                    await execute_with_tools(
                        provider=provider,
                        messages=retry_messages,
                        enabled_tools=enabled_tools,
                        db=db,
                        project_id=session.project_id,
                        temperature=request.temperature,
                        max_iterations=3,
                        session_id=request.session_id,
                        search_scope=search_scope,
                        current_draft=workshop_draft,
                        on_event=on_event,
                    )
                )
                response_usage = merge_token_usage(
                    response_usage, retry_usage
                )
            # Note: Tool orchestrator tracks usage internally
        else:
            # No tools enabled - generate text
            llm_response = await _generate_text_with_stages(
                provider, context_messages, request.temperature, on_event
            )
            response_content = llm_response.content
            response_usage = llm_response.usage

            # Track usage
            await usage_tracker.track_usage(
                db=db,
                model=request.model,
                input_tokens=response_usage.get("prompt_tokens", 0),
                output_tokens=response_usage.get("completion_tokens", 0)
            )
    else:
        # Tools disabled - generate text
        llm_response = await _generate_text_with_stages(
            provider, context_messages, request.temperature, on_event
        )
        response_content = llm_response.content
        response_usage = llm_response.usage

        # Track usage
        await usage_tracker.track_usage(
            db=db,
            model=request.model,
            input_tokens=response_usage.get("prompt_tokens", 0),
            output_tokens=response_usage.get("completion_tokens", 0)
        )

    # Save BOTH messages to database AFTER successful LLM call
    # This prevents orphaned user messages if LLM call fails
    db.add(user_message)

    # TURN SUMMARY / claim guard: Tool-Log SSOT — never chat FACT append
    response_content = strip_echoed_turn_summary(response_content or "")
    response_content, claim_guarded, guard_events = apply_claim_guard(
        response_content, tool_calls_made
    )

    log_tool_calls = list(tool_calls_made)
    if claim_guarded:
        log_tool_calls.append(make_claim_guard_tool_entry(guard_events))
        turn_summary = build_guard_turn_summary(tool_calls_made, guard_events)
    else:
        turn_summary = (
            build_turn_summary(tool_calls_made) if tool_calls_made else None
        )

    if forced_retries_used:
        if not turn_summary:
            turn_summary = (
                build_guard_turn_summary(tool_calls_made, guard_events)
                if claim_guarded
                else build_turn_summary(tool_calls_made)
            )
        note = (
            f"Forced tool retries used: "
            f"{forced_retries_used}/{CLAIM_GUARD_MAX_RETRIES}."
        )
        if claim_guarded:
            note += " Exhausted — still no matching write tool."
        turn_summary = f"{turn_summary.rstrip()}\n{note}"

    tools_failed = any(
        not (tc.get("result") or {}).get("success")
        for tc in log_tool_calls
    )
    turn_ok = (not claim_guarded) and (not tools_failed)

    tool_call_payload = None
    if log_tool_calls or turn_summary:
        tool_call_payload = {
            "tool_calls": log_tool_calls,
            "turn_ok": turn_ok,
        }
        if turn_summary:
            tool_call_payload["turn_summary"] = turn_summary
        if guard_events:
            tool_call_payload["guard_events"] = guard_events
        if forced_retries_used:
            tool_call_payload["forced_retries"] = forced_retries_used

    usage_in = response_usage.get("prompt_tokens") if response_usage else None
    usage_out = response_usage.get("completion_tokens") if response_usage else None
    ai_message = ChatMessage(
        session_id=request.session_id,
        role="assistant",
        content=response_content,
        timestamp=datetime.now(UTC),
        model=request.model,
        tool_call_data=tool_call_payload,
        input_tokens=usage_in,
        output_tokens=usage_out
    )
    db.add(ai_message)

    # Update session content-activity (2 new messages: user + AI)
    session.message_count += 2
    when = touch_session_content(session)
    project = await db.get(Project, session.project_id)
    if project is not None:
        touch_project_content(project, when=when)

    await db.commit()

    # Incrementally upsert only the new user+assistant pair (fire-and-forget)
    # fastembed runs locally – no API cost, no full re-index needed
    new_msg_dicts = [
        {
            "id": str(user_message.id),
            "role": user_message.role,
            "content": user_message.content,
            "created_at": user_message.created_at.isoformat() if user_message.created_at else "",
        },
        {
            "id": str(ai_message.id),
            "role": ai_message.role,
            "content": ai_message.content,
            "created_at": ai_message.created_at.isoformat() if ai_message.created_at else "",
        },
    ]
    from src.routers.sessions import _background_tasks
    from src.services.vector_store import VectorStore

    async def _upsert_new_messages() -> None:
        try:
            store = VectorStore.get_instance()
            await store.upsert_messages(
                session_id=request.session_id,
                project_id=session.project_id,
                session_title=session.title,
                messages=new_msg_dicts,
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                f"⚠️ Incremental vector upsert failed for session "
                f"{request.session_id}: {exc}"
            )

    idx_task = asyncio.create_task(_upsert_new_messages())
    _background_tasks.add(idx_task)
    idx_task.add_done_callback(_background_tasks.discard)

    # Extract draft data if create_draft was called
    draft_data = None
    edit_data_list = []  # Collect ALL edit_draft calls
    tool_calls_info = []

    for tc in log_tool_calls:
        result = tc.get("result") or {}
        tool_calls_info.append(ToolCallInfo(
            tool_name=tc["tool_name"],
            arguments=tc.get("arguments") or {},
            result=result,
            action=result.get("action"),  # e.g., "open_workshop"
        ))

    for tc in tool_calls_made:
        # Draft side-effects only from real tools (not claim_guard)
        if tc["tool_name"] == "create_draft" and tc["result"].get("success"):
            draft_data = DraftData(
                title=tc["result"]["draft"]["title"],
                content=tc["result"]["draft"]["content"],
                reason=tc["result"]["draft"].get("reason")
            )

        if tc["tool_name"] == "edit_draft" and tc["result"].get("success"):
            edits_raw = tc["result"].get("edits", [])
            edit_data_list.append(EditData(
                edits=[SingleEdit(old_text=e["old_text"], new_text=e["new_text"]) for e in edits_raw],
                edit_count=tc["result"].get("edit_count", len(edits_raw)),
                reason=tc["result"].get("reason")
            ))

    # Build response
    return ChatResponse(
        content=response_content,
        model=request.model,
        usage=response_usage,
        user_message_id=user_message.id,
        ai_message_id=ai_message.id,
        tool_calls=tool_calls_info if tool_calls_info else None,
        turn_summary=turn_summary,
        turn_ok=turn_ok if (log_tool_calls or turn_summary) else None,
        draft_data=draft_data,
        edit_data_list=edit_data_list if edit_data_list else None
    )

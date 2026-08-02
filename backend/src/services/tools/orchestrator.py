"""Tool orchestrator for managing tool call loops.

Coordinates between LLM and tool execution with multiple iterations.
Claim guard / turn summary live in sibling modules (SoC).
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.services.llm.base import LLMMessage, LLMProvider
from src.services.tools.executor import execute_tool, format_tool_result_for_llm
from src.services.tools.converters import (
    convert_tools_for_gemini,
    convert_tools_for_claude,
    extract_tool_calls_from_gemini,
    extract_tool_calls_from_claude
)
from src.services.tools.tool_kinds import STATUS_TOOLS, TERMINAL_TOOLS
from src.services.tools.turn_summary import (
    build_turn_summary,
    strip_echoed_turn_summary,
)

ProgressEventCallback = Callable[[dict[str, Any]], Awaitable[None]]


async def _emit_progress(
    on_event: ProgressEventCallback | None,
    payload: dict[str, Any],
) -> None:
    if on_event is not None:
        await on_event(payload)


def _tool_summary(result: dict) -> str:
    msg = result.get("message") or result.get("error") or ""
    text = str(msg).replace("\n", " ").strip()
    return text[:120] if text else ""


def _tool_call_dedupe_key(tc: dict) -> str:
    """Composite key: tool name + canonical args (allows bulk create_status)."""
    name = tc.get("name") or ""
    args = tc.get("arguments") or {}
    try:
        args_key = json.dumps(args, sort_keys=True, ensure_ascii=False, default=str)
    except TypeError:
        args_key = str(args)
    return f"{name}:{args_key}"


def _dedupe_tool_calls(tool_calls: list[dict]) -> list[dict]:
    """Drop exact stutter duplicates; keep same-name calls with different args."""
    seen: set[str] = set()
    unique: list[dict] = []
    for tc in tool_calls:
        key = _tool_call_dedupe_key(tc)
        if key in seen:
            print(f"[tool] skipped duplicate: {tc.get('name')} (identical args)")
            continue
        seen.add(key)
        unique.append(tc)
    return unique


def _prioritize_tool_calls(tool_calls: list[dict]) -> list[dict]:
    """Stable sort: status writes first, other tools, terminal draft tools last."""

    def rank(tc: dict) -> int:
        name = tc.get("name") or ""
        if name in STATUS_TOOLS:
            return 0
        if name in TERMINAL_TOOLS:
            return 2
        return 1

    reordered = sorted(tool_calls, key=rank)
    if [tc.get("name") for tc in reordered] != [tc.get("name") for tc in tool_calls]:
        print("[tool] reordered batch: status writes before terminal draft tools")
    return reordered


async def execute_with_tools(
    provider: LLMProvider,
    messages: list[LLMMessage],
    enabled_tools: list[str],
    db: AsyncSession,
    project_id: str,
    temperature: float = 1.0,
    max_iterations: int = 3,
    session_id: str | None = None,
    search_scope: str = "project_only",
    current_draft: str | None = None,
    on_event: ProgressEventCallback | None = None,
) -> tuple[str, list[dict], dict]:
    """Execute LLM request with tool calling support.
    
    Implements the tool call loop:
    1. Send request to LLM with tools
    2. Extract tool calls from response
    3. Execute tools
    4. Send results back to LLM
    5. Repeat until LLM provides final answer or max iterations reached
    
    Args:
        provider: LLM provider instance
        messages: Conversation messages
        enabled_tools: List of enabled tool names
        db: Database session
        project_id: Current project ID
        temperature: Sampling temperature
        max_iterations: Maximum tool call iterations
        on_event: Optional async callback for live progress events
        
    Returns:
        Tuple of (final_response_text, tool_call_history, usage_dict)
        
    Example:
        >>> text, tools = await execute_with_tools(
        ...     provider, messages, ["create_status"], db, "proj-123"
        ... )
        >>> "Status topic" in text
        True
    """
    # Prepare tools for provider
    # Handle mock objects in tests
    model_name = provider.model if isinstance(provider.model, str) else str(provider.model)
    is_gemini = "gemini" in model_name.lower()
    is_claude = "claude" in model_name.lower()
    
    tool_definitions = []
    if is_gemini:
        tool_definitions = convert_tools_for_gemini(enabled_tools)
    elif is_claude:
        tool_definitions = convert_tools_for_claude(enabled_tools)
    
    # Tool call history for response
    tool_call_history = []
    current_messages = messages.copy()
    response_text = ""
    
    for iteration in range(max_iterations):
        await _emit_progress(on_event, {"type": "stage", "stage": "thinking"})

        # Call LLM with tools
        if is_gemini:
            response = await _call_gemini_with_tools(
                provider, current_messages, tool_definitions, temperature
            )
            tool_calls = extract_tool_calls_from_gemini(response)
        elif is_claude:
            response = await _call_claude_with_tools(
                provider, current_messages, tool_definitions, temperature
            )
            tool_calls = extract_tool_calls_from_claude(response)
        else:
            # No tool support for this provider
            await _emit_progress(on_event, {"type": "stage", "stage": "generating"})
            response = await provider.generate_text(current_messages, temperature)
            return response.content, [], response.usage
        
        # Extract text from response (even if tool calls are present)
        response_text = ""
        if is_gemini:
            response_text = _extract_text_from_gemini(response)
        elif is_claude:
            response_text = _extract_text_from_claude(response)
        
        # No tool calls - return final answer (with any text)
        if not tool_calls:
            await _emit_progress(on_event, {"type": "stage", "stage": "generating"})
            usage = _extract_usage_from_response(response, is_gemini)
            return (
                strip_echoed_turn_summary(response_text),
                tool_call_history,
                usage,
            )
        
        # Dedupe exact stutters only; allow bulk create_status / multi-edit.
        # Then run status writes before terminal draft tools in this round.
        tool_calls = _prioritize_tool_calls(_dedupe_tool_calls(tool_calls))

        # Execute entire round; terminal tools must not abort mid-batch.
        terminal_tool_executed = False
        terminal_tool_result = ""  # Stores result of the terminal tool specifically
        for tool_call in tool_calls:
            tool_name = tool_call["name"]
            try:
                # Log tool call attempt (ASCII — Windows cp1252 consoles choke on emoji)
                print(f"[tool] call: {tool_name}")
                print(f"   params: {tool_call['arguments']}")

                await _emit_progress(on_event, {
                    "type": "tool",
                    "tool": tool_name,
                    "status": "running",
                })
                
                result = await execute_tool(
                    tool_name=tool_name,
                    parameters=tool_call["arguments"],
                    db=db,
                    project_id=project_id,
                    session_id=session_id,
                    search_scope=search_scope,
                    current_draft=current_draft,
                )
                
                # Log successful execution
                if result.get("success"):
                    print(f"   [ok] {result.get('message', 'OK')}")
                    
                    if tool_name in TERMINAL_TOOLS:
                        # Flag only — keep processing remaining tools in this round
                        terminal_tool_executed = True
                    await _emit_progress(on_event, {
                        "type": "tool",
                        "tool": tool_name,
                        "status": "done",
                        "summary": _tool_summary(result),
                    })
                else:
                    print(f"   [fail] {result.get('error', 'Unknown error')}")
                    await _emit_progress(on_event, {
                        "type": "tool",
                        "tool": tool_name,
                        "status": "failed",
                        "summary": _tool_summary(result),
                    })
                
                # Format result for LLM
                formatted_result = format_tool_result_for_llm(
                    tool_name, result
                )
                
                # Capture terminal tool result immediately after formatting
                # (cannot use tool_call_history[-1] later – other tools may be appended after)
                if result.get("success") and tool_name in TERMINAL_TOOLS:
                    terminal_tool_result = formatted_result
                
                # Add to history
                tool_call_history.append({
                    "tool_name": tool_name,
                    "arguments": tool_call["arguments"],
                    "result": result,
                    "formatted_result": formatted_result
                })
                
                # Add tool result to messages
                if is_gemini:
                    # Gemini: For proper thought signature handling, we should use
                    # the SDK's automatic function calling feature in the future.
                    # For now, we provide results as user messages
                    current_messages.append(LLMMessage(
                        role="user",
                        content=f"[Tool Result: {tool_name}]\n{formatted_result}"
                    ))
                elif is_claude:
                    # Claude: Add tool_result message
                    current_messages.append(LLMMessage(
                        role="user",  # Will be converted by provider
                        content=formatted_result
                    ))
            
            except Exception as e:
                # Tool execution error - log for debugging
                import traceback
                error_details = traceback.format_exc()
                print(f"[tool] error: {tool_name}")
                print(f"   params: {tool_call['arguments']}")
                print(f"   error: {str(e)}")
                print(f"   traceback:\n{error_details}")
                
                # Tool execution error
                error_message = f"Tool execution error '{tool_name}': {str(e)}"
                tool_call_history.append({
                    "tool_name": tool_name,
                    "arguments": tool_call["arguments"],
                    "result": {
                        "success": False,
                        "error": str(e),
                        "message": error_message
                    },
                    "formatted_result": error_message
                })
                await _emit_progress(on_event, {
                    "type": "tool",
                    "tool": tool_name,
                    "status": "failed",
                    "summary": error_message[:120],
                })
                
                current_messages.append(LLMMessage(
                    role="user",
                    content=error_message
                ))
        
        # Ground truth for continued turns — one consolidated TURN SUMMARY
        # (per-tool FACT blurbs removed from format_tool_result_for_llm).
        round_slice = tool_call_history[-len(tool_calls):] if tool_calls else []
        if not terminal_tool_executed:
            # After any failure, re-anchor the model on cumulative IST outcome
            # so retries (and later synthesis) cannot invent success.
            if any(not (tc.get("result") or {}).get("success") for tc in round_slice):
                current_messages.append(LLMMessage(
                    role="user",
                    content=build_turn_summary(tool_call_history),
                ))

        # Terminal ends the OUTER loop only after the full round finished
        if terminal_tool_executed:
            print("[tool] terminal draft tool in batch — ending outer loop after round")
            await _emit_progress(on_event, {"type": "stage", "stage": "generating"})
            usage = _extract_usage_from_response(response, is_gemini)
            # System owns the confirmation: chat body = formatted tool results only.
            # Do NOT concatenate pre-tool model prose (duplicate success lines).
            # TURN SUMMARY lives in tool_call_data / Tool-Log, not chat.
            round_results = [
                tc["formatted_result"]
                for tc in round_slice
                if tc.get("formatted_result")
            ]
            body = (
                "\n\n---\n\n".join(round_results)
                if round_results
                else terminal_tool_result
            )
            return (
                strip_echoed_turn_summary(body),
                tool_call_history,
                usage,
            )
        
        # Always continue loop after tool execution to get a response that
        # incorporates the tool results. Early return here would cause the user
        # to see only pre-tool announcement text, never the actual results.
    
    # Max iterations reached – final call WITHOUT tools, but with hard turn
    # summary so the model cannot hallucinate create_draft / fake successes.
    print("[tool] max iterations reached — final answer call without tools")
    await _emit_progress(on_event, {"type": "stage", "stage": "generating"})
    turn_summary = build_turn_summary(tool_call_history)
    current_messages.append(LLMMessage(role="user", content=turn_summary))
    print("[tool] injected TURN SUMMARY before final answer")
    final_response = await provider.generate_text(
        messages=current_messages,
        temperature=temperature
    )
    final_text = strip_echoed_turn_summary(_extract_text_content(final_response))
    usage = getattr(final_response, "usage", None) or {}
    if isinstance(usage, dict):
        pass
    else:
        usage = {}
    if final_text:
        return final_text, tool_call_history, usage
    # Absolute fallback — summary goes to Tool-Log via chat_send, not chat text
    return (
        response_text or "Maximum tool-call iterations reached.",
        tool_call_history,
        usage,
    )


async def _call_gemini_with_tools(
    provider: LLMProvider,
    messages: list[LLMMessage],
    tools: list[dict],
    temperature: float
):
    """Call Gemini with tools enabled.
    
    Note: This requires accessing the underlying client directly.
    Uses Gemini 3 recommended settings and thought signatures.
    """
    from google.genai import types
    
    # Extract system instruction and convert messages
    system_instruction, contents = provider._extract_system_and_convert(messages)
    
    # Build config with tools
    function_declarations = tools
    tool = types.Tool(function_declarations=function_declarations)
    config = types.GenerateContentConfig(
        temperature=temperature,
        tools=[tool]
    )
    if system_instruction:
        config.system_instruction = system_instruction
    
    # Call API
    # Note: Gemini SDK automatically handles thought signatures when we pass
    # the complete response back in subsequent turns
    response = await provider.client.aio.models.generate_content(
        model=provider.model,
        contents=contents,
        config=config
    )
    
    return response


async def _call_claude_with_tools(
    provider: LLMProvider,
    messages: list[LLMMessage],
    tools: list[dict],
    temperature: float
):
    """Call Claude with tools enabled."""
    # Separate system message
    system_content, chat_messages = provider._convert_messages(messages)
    
    # Build request with tools
    params = {
        "model": provider.model,
        "max_tokens": 4096,
        "temperature": temperature,
        "messages": chat_messages,
        "tools": tools
    }
    
    if system_content:
        params["system"] = system_content
    
    # Call API
    response = await provider.client.messages.create(**params)
    
    return response


def _extract_text_content(response) -> str:
    """Extract plain text from LLMResponse / provider mocks (never MagicMock)."""
    content = getattr(response, "content", None)
    if isinstance(content, str) and content.strip():
        return content.strip()
    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        return text.strip()
    return ""


def _extract_text_from_gemini(response) -> str:
    """Extract text content from Gemini response.
    
    Handles both text-only responses and responses with tool calls + text.
    """
    text_parts = []
    
    # Try direct text attribute first (for text-only responses)
    text = getattr(response, "text", None)
    if isinstance(text, str) and text:
        return text
    
    # Extract text from parts (for responses with tool calls + text)
    candidates = getattr(response, "candidates", None) or []
    if candidates:
        candidate = candidates[0]
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) if content is not None else None
        if parts:
            for part in parts:
                part_text = getattr(part, "text", None)
                if isinstance(part_text, str) and part_text:
                    text_parts.append(part_text)
    
    return "\n".join(text_parts)


def _extract_text_from_claude(response) -> str:
    """Extract text content from Claude response."""
    text_parts = []
    if hasattr(response, 'content'):
        for content_block in response.content:
            if content_block.type == 'text':
                text_parts.append(content_block.text)
    return "\n".join(text_parts)


def _as_int_token(value, default: int = 0) -> int:
    """Coerce provider token counts to int (never MagicMock / None)."""
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return default


def _extract_usage_from_response(response, is_gemini: bool) -> dict:
    """Extract usage dict from raw API response.
    
    Returns dict with prompt_tokens, completion_tokens (for DB storage).
    """
    usage: dict[str, int] = {}
    if is_gemini and hasattr(response, "usage_metadata"):
        metadata = response.usage_metadata
        if metadata is None:
            return usage
        usage = {
            "prompt_tokens": _as_int_token(getattr(metadata, "prompt_token_count", 0)),
            "completion_tokens": _as_int_token(getattr(metadata, "candidates_token_count", 0)),
        }
    elif not is_gemini and hasattr(response, "usage"):
        u = response.usage
        if u is None:
            return usage
        usage = {
            "prompt_tokens": _as_int_token(getattr(u, "input_tokens", 0)),
            "completion_tokens": _as_int_token(getattr(u, "output_tokens", 0)),
        }
    return usage

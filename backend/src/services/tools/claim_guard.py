"""Claim guard: block invented draft/status success; sanitize history; force-retry helpers."""

import re

from src.services.tools.tool_kinds import DRAFT_TOOLS, STATUS_TOOLS
from src.services.tools.turn_summary import build_turn_summary

# High-precision patterns for invented write success (EN + DE).
_FALSE_STATUS_CLAIM_PATTERNS = (
    re.compile(
        r"status topic\b.{0,160}\b(updated|created|deleted) successfully",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(r"\bOld value:\s*", re.IGNORECASE),
    re.compile(r"live status (is now|ist jetzt)\b", re.IGNORECASE),
    re.compile(r"✅\s*Status\b"),
    re.compile(
        r"\b(status|projektstatus)\b.{0,60}\b(wurde |was )?(aktualisiert|gespeichert|updated|saved)\b",
        re.IGNORECASE | re.DOTALL,
    ),
)

_FALSE_DRAFT_CLAIM_PATTERNS = (
    re.compile(r"✅\s*\d+\s+changes?\s+will be applied", re.IGNORECASE),
    re.compile(r"will be applied to the Workshop draft", re.IGNORECASE),
    re.compile(
        r"workshop draft\b.{0,60}\b(updated|replaced|created|will be)\b",
        re.IGNORECASE | re.DOTALL,
    ),
)

_FALSE_SYNC_CLAIM_PATTERNS = (
    re.compile(
        r"(sind jetzt synchron|are now (in )?sync|Status und Artefakt)",
        re.IGNORECASE,
    ),
)

_HONEST_NO_WRITE = (
    "No changes were applied this turn. "
    "Invented draft/status success claims were blocked. "
    "Live status and workshop draft are unchanged — please retry."
)

# Circuit breaker: initial attempt + at most this many forced tool retries
CLAIM_GUARD_MAX_RETRIES = 2

_SYSTEM_GUARD_PREFIX = "[System-Guard:"


def _tool_mutated(tool_calls: list[dict] | None, names: frozenset[str]) -> bool:
    """True if a tool in ``names`` succeeded with a real (non-noop) change."""
    for tc in tool_calls or []:
        if tc.get("tool_name") not in names:
            continue
        result = tc.get("result") or {}
        if result.get("success") and not result.get("noop"):
            return True
    return False


def _status_tool_mutated(tool_calls: list[dict] | None) -> bool:
    return _tool_mutated(tool_calls, STATUS_TOOLS)


def _draft_tool_mutated(tool_calls: list[dict] | None) -> bool:
    return _tool_mutated(tool_calls, DRAFT_TOOLS)


def _strip_claim_sections(
    text: str,
    *,
    strip_status: bool,
    strip_draft: bool,
    strip_sync: bool,
) -> str:
    """Remove invented success sections; keep unrelated prose when possible."""
    out = text
    if strip_status:
        out = re.sub(
            r"✅\s*Status topic\b[\s\S]*?(?=\n\n|\Z)",
            "",
            out,
            flags=re.IGNORECASE,
        )
        out = re.sub(
            r"(?i)live status (is now|ist jetzt)[\s\S]*?(?=\n\n|\Z)",
            "",
            out,
        )
        out = re.sub(
            r"(?i)^[^\n]*(status|projektstatus)[^\n]*"
            r"(aktualisiert|gespeichert|updated|saved)[^\n]*\n?",
            "",
            out,
            flags=re.MULTILINE,
        )
        out = re.sub(r"(?i)^[^\n]*Old value:[^\n]*\n?", "", out, flags=re.MULTILINE)
        out = re.sub(r"(?i)^[^\n]*New value:[^\n]*\n?", "", out, flags=re.MULTILINE)
    if strip_draft:
        out = re.sub(
            r"✅\s*\d+\s+changes?\s+will be applied[^\n]*\n?",
            "",
            out,
            flags=re.IGNORECASE,
        )
        out = re.sub(
            r"(?i)^[^\n]*will be applied to the Workshop draft[^\n]*\n?",
            "",
            out,
            flags=re.MULTILINE,
        )
    if strip_sync:
        out = re.sub(
            r"(?i)\*\*?Status und Artefakt[^*]*\*\*?[\s\S]*?(?=\n\n---|\n\n\[|\Z)",
            "",
            out,
        )
        out = re.sub(
            r"(?i)(sind jetzt synchron|are now (in )?sync)[\s\S]*?(?=\n\n---|\n\n\[|\Z)",
            "",
            out,
        )
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    out = re.sub(
        r"(?:\n\s*---\s*\n)+",
        "\n\n",
        out,
    ).strip()
    # Drop orphan timestamp-only leftovers
    if re.fullmatch(r"\[\d{4}-\d{2}-\d{2}[^\]]*\]", out or ""):
        return ""
    return out


def build_guard_turn_summary(
    tool_calls: list[dict] | None,
    events: list[dict],
) -> str:
    """TURN SUMMARY for Tool-Log when claim guard fires (always turn_ok=false)."""
    base = (
        build_turn_summary(tool_calls)
        if tool_calls
        else (
            "[TURN SUMMARY]\n"
            "No tools were executed.\n"
            "Never claim draft or status updates."
        )
    )
    lines = [
        base.rstrip(),
        "",
        "[CLAIM GUARD]",
        "Blocked invented success claims (not shown in chat):",
    ]
    for event in events:
        lines.append(f"- {event.get('kind')}: {event.get('detail', '')}")
    lines.append(
        "Ground truth: live status / workshop draft unchanged unless "
        "listed as SUCCESS above."
    )
    return "\n".join(lines)


def make_claim_guard_tool_entry(events: list[dict]) -> dict:
    """Synthetic failed tool entry so Tool-Log shows a red row."""
    return {
        "tool_name": "claim_guard",
        "arguments": {"events": [e.get("kind") for e in events]},
        "result": {
            "success": False,
            "error": "Blocked invented success claims without matching tool mutations",
            "events": events,
        },
        "formatted_result": "Claim guard: blocked invented success claims",
    }


def apply_claim_guard(
    text: str,
    tool_calls: list[dict] | None,
) -> tuple[str, bool, list[dict]]:
    """Rewrite chat when the model invents draft/status success without tools.

    Returns ``(chat_content, guarded, events)``.
    Corrections go to Tool-Log via ``tool_call_data``, never as chat FACT append.
    """
    if not text:
        return text or "", False, []

    # Strip legacy appended corrections if any older path still produced them
    text = re.sub(
        r"\n*---\n*\[SYSTEM FACT — CORRECTION\][\s\S]*$",
        "",
        text,
    ).rstrip()

    status_mut = _status_tool_mutated(tool_calls)
    draft_mut = _draft_tool_mutated(tool_calls)
    events: list[dict] = []

    if not status_mut and any(p.search(text) for p in _FALSE_STATUS_CLAIM_PATTERNS):
        events.append({
            "kind": "false_status_claim",
            "detail": "Claimed status write without create/update/delete_status SUCCESS",
        })
    if not draft_mut and any(p.search(text) for p in _FALSE_DRAFT_CLAIM_PATTERNS):
        events.append({
            "kind": "false_draft_claim",
            "detail": "Claimed draft write without create_draft/edit_draft SUCCESS",
        })
    if (not status_mut or not draft_mut) and any(
        p.search(text) for p in _FALSE_SYNC_CLAIM_PATTERNS
    ):
        events.append({
            "kind": "false_sync_claim",
            "detail": "Claimed status/artifact sync without matching mutations",
        })

    if not events:
        return text, False, []

    print(f"[guard] blocked invented claims: {[e['kind'] for e in events]}")

    if not status_mut and not draft_mut:
        return _HONEST_NO_WRITE, True, events

    cleaned = _strip_claim_sections(
        text,
        strip_status=any(e["kind"] == "false_status_claim" for e in events),
        strip_draft=any(e["kind"] == "false_draft_claim" for e in events),
        strip_sync=any(e["kind"] == "false_sync_claim" for e in events),
    )
    if not cleaned:
        return _HONEST_NO_WRITE, True, events
    return cleaned, True, events


def required_tools_from_guard_events(events: list[dict]) -> list[str]:
    """Map guard event kinds to tools the model must call next."""
    kinds = {e.get("kind") for e in events}
    tools: list[str] = []
    if "false_status_claim" in kinds or "false_sync_claim" in kinds:
        tools.append("update_status")
    if "false_draft_claim" in kinds or "false_sync_claim" in kinds:
        tools.append("edit_draft")
    return tools or ["update_status", "edit_draft"]


def history_guard_replacement(events: list[dict] | None = None) -> str:
    """Technical stand-in for blocked fake-success assistant turns (LLM history)."""
    tools = required_tools_from_guard_events(events or [])
    tool_list = " / ".join(f"'{t}'" for t in tools)
    return (
        f"{_SYSTEM_GUARD_PREFIX} Fake success response blocked. "
        f"Tool call for {tool_list} is mandatory for write requests. "
        f"Do not invent status or draft success in plain text.]"
    )


def sanitize_history_assistant_content(
    content: str,
    tool_call_data: dict | None = None,
) -> str:
    """Replace invented/blocked write-success prose in chat history for the LLM.

    Real tool confirmations (with matching successful write tools) are kept.
    """
    if not content:
        return content
    if content.lstrip().startswith(_SYSTEM_GUARD_PREFIX):
        return content

    data = tool_call_data if isinstance(tool_call_data, dict) else {}
    events = list(data.get("guard_events") or [])
    tool_calls = list(data.get("tool_calls") or [])
    has_claim_guard = any(
        (tc or {}).get("tool_name") == "claim_guard" for tc in tool_calls
    )

    if has_claim_guard or events:
        return history_guard_replacement(events)

    if (
        "Invented draft/status success claims were blocked" in content
        or "[SYSTEM FACT — CORRECTION]" in content
    ):
        return history_guard_replacement(events)

    # Keep genuine tool confirmations
    if _status_tool_mutated(tool_calls) or _draft_tool_mutated(tool_calls):
        return content

    _, guarded, detected = apply_claim_guard(content, tool_calls)
    if guarded:
        return history_guard_replacement(detected)
    return content


def claim_guard_needs_retry(
    guarded: bool,
    events: list[dict],
    tool_calls: list[dict] | None,
) -> bool:
    """True when blocked claims still lack the matching write-tool mutation."""
    if not guarded or not events:
        return False
    status_mut = _status_tool_mutated(tool_calls)
    draft_mut = _draft_tool_mutated(tool_calls)
    kinds = {e.get("kind") for e in events}
    need_status = bool(
        kinds & {"false_status_claim", "false_sync_claim"}
    ) and not status_mut
    need_draft = bool(
        kinds & {"false_draft_claim", "false_sync_claim"}
    ) and not draft_mut
    return need_status or need_draft


def build_forced_retry_instruction(
    user_message: str,
    events: list[dict],
) -> str:
    """Imperative user message for a forced tool-call retry."""
    tools = required_tools_from_guard_events(events)
    tool_hint = ", ".join(tools)
    return (
        "[SYSTEM — FORCED TOOL RETRY]\n"
        "Your previous reply was BLOCKED: you invented draft/status success "
        "without calling tools.\n"
        f"You MUST call the required tool(s) now: {tool_hint}.\n"
        "DO NOT write success messages in plain text.\n"
        "DO NOT claim Old value/New value, 'updated successfully', or "
        "'will be applied' unless a tool actually ran this turn.\n"
        "If you cannot apply the change, ask a short clarifying question — "
        "no fake success.\n"
        f"Original user request:\n{user_message}"
    )


def merge_token_usage(base: dict | None, extra: dict | None) -> dict:
    """Sum prompt/completion token counts across retry attempts."""
    out = dict(base or {})
    for key in (
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "input_tokens",
        "output_tokens",
    ):
        if key in (extra or {}) or key in out:
            out[key] = int(out.get(key) or 0) + int((extra or {}).get(key) or 0)
    return out

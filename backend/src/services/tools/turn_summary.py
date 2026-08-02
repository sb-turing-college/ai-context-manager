"""Ground-truth TURN SUMMARY for Tool-Log / LLM re-anchoring (not chat prose)."""

import re

from src.services.tools.tool_kinds import DRAFT_TOOLS, STATUS_TOOLS


def _tool_outcome_label(result: dict) -> str:
    """Compact outcome code for turn summary lines."""
    if not result.get("success"):
        return "FAILED"
    if result.get("noop"):
        return "NO-OP"
    return "SUCCESS"


def build_turn_summary(tool_call_history: list[dict]) -> str:
    """Single consolidated ground-truth block for LLM and Tool-Log.

    Replaces per-tool FACT blurbs that contradicted each other across tools.
    """
    if not tool_call_history:
        return (
            "[TURN SUMMARY]\n"
            "No tools were executed.\n"
            "Never claim draft or status updates."
        )

    codes = [
        f"{tc.get('tool_name', 'unknown')}="
        f"{_tool_outcome_label(tc.get('result') or {})}"
        for tc in tool_call_history
    ]
    lines = [
        "[TURN SUMMARY]",
        ", ".join(codes),
        "Ground truth for this turn. Report ONLY this to the user.",
        "Do not invent tool calls, XML, <function_calls>, or success claims.",
    ]

    for tc in tool_call_history:
        name = tc.get("tool_name", "unknown")
        result = tc.get("result") or {}
        args = tc.get("arguments") or {}
        label = _tool_outcome_label(result)
        if label == "FAILED":
            err = result.get("error") or result.get("message") or "unknown error"
            lines.append(f"- {name}=FAILED — {err}")
        elif label == "NO-OP":
            preview = str(
                result.get("old_content") or args.get("content") or ""
            )[:120].replace("\n", "\\n")
            lines.append(f"- {name}=NO-OP — already \"{preview}\" (unchanged)")
        elif name == "update_status":
            bits = []
            if (
                result.get("old_title") is not None
                and result.get("new_title") is not None
                and result.get("old_title") != result.get("new_title")
            ) or args.get("title") is not None:
                bits.append(
                    f"title \"{result.get('new_title') or args.get('title', '')}\""
                )
            if (
                result.get("old_content") != result.get("new_content")
                or args.get("content") is not None
            ):
                content_preview = str(
                    result.get("new_content")
                    if result.get("new_content") is not None
                    else args.get("content", "")
                )[:120].replace("\n", "\\n")
                bits.append(f"content \"{content_preview}\"")
            detail = " and ".join(bits) if bits else "updated"
            lines.append(f"- {name}=SUCCESS — live status now {detail}")
        elif name == "create_status":
            lines.append(
                f"- {name}=SUCCESS — created topic \"{args.get('title', '')}\""
            )
        elif name == "delete_status":
            lines.append(f"- {name}=SUCCESS — deleted status topic")
        elif name == "edit_draft":
            n = result.get("edit_count", 0) or 0
            unit = "change" if n == 1 else "changes"
            lines.append(
                f"- {name}=SUCCESS — workshop draft WILL be updated "
                f"({n} {unit})"
            )
        elif name == "create_draft":
            lines.append(
                f"- {name}=SUCCESS — workshop draft WILL be replaced/opened"
            )
        else:
            msg = result.get("message") or "OK"
            lines.append(f"- {name}=SUCCESS — {msg}")

    draft_calls = [
        tc for tc in tool_call_history if tc.get("tool_name") in DRAFT_TOOLS
    ]
    if draft_calls:
        if any(
            (tc.get("result") or {}).get("success")
            and not (tc.get("result") or {}).get("noop")
            for tc in draft_calls
        ):
            lines.append("- Workshop draft: UPDATED.")
        else:
            lines.append("- Workshop draft: UNCHANGED.")
            if not any(tc.get("tool_name") == "create_draft" for tc in draft_calls):
                lines.append("- create_draft: NOT CALLED.")
    else:
        lines.append("- Workshop draft: UNCHANGED (no draft tools).")

    status_calls = [
        tc for tc in tool_call_history if tc.get("tool_name") in STATUS_TOOLS
    ]
    if status_calls:
        if any(
            (tc.get("result") or {}).get("success")
            and not (tc.get("result") or {}).get("noop")
            for tc in status_calls
        ):
            lines.append("- Live status: UPDATED.")
        elif any((tc.get("result") or {}).get("noop") for tc in status_calls):
            lines.append("- Live status: UNCHANGED (no-op).")
        else:
            lines.append("- Live status: UNCHANGED (status tools failed).")
    else:
        lines.append("- Live status: UNCHANGED (no status tools).")

    lines.append(
        "Never claim a draft or status update unless listed as SUCCESS above "
        "(NO-OP means unchanged)."
    )
    return "\n".join(lines)


def strip_echoed_turn_summary(text: str) -> str:
    """Remove TURN SUMMARY blocks the model may have copied into chat text.

    Ground truth belongs in tool_call_data / Tool-Log, not the visible reply.
    """
    if not text or "[TURN SUMMARY]" not in text:
        return text

    cleaned = re.sub(
        r"(?:\n\s*---\s*\n)?\s*\[TURN SUMMARY\][\s\S]*$",
        "",
        text,
        count=1,
    ).rstrip()
    return cleaned

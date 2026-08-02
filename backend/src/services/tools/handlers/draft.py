"""Draft tool handlers.

Handles draft creation for the workshop integration.
Note: The draft is not stored by these handlers; create/edit instructions
are returned to the frontend to update the workshop panel.
"""

import json
import re

# Markdown table separator row: cells of dashes/colons between pipes.
_TABLE_SEP_ROW = re.compile(
    r"^\|?(?:\s*:?-{1,}:?\s*\|)+\s*:?-{1,}:?\s*\|?$"
)
_DASH_RUN = re.compile(r":?-{1,}:?")


def _normalize_line_for_match(line: str) -> str:
    """Normalize one line for canonical old_text matching.

    - Strip trailing whitespace (common LLM drift)
    - Collapse markdown table separator dash-runs so
      ``|----------|`` and ``|-----------|`` compare equal
    """
    line = line.rstrip()
    stripped = line.strip()
    if stripped and _TABLE_SEP_ROW.match(stripped):
        return _DASH_RUN.sub("-", line)
    return line


def _normalize_newlines(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def resolve_old_text_in_content(content: str, old_text: str) -> str | None:
    """Return the exact substring of ``content`` that matches ``old_text``.

    Prefers exact match. Falls back to canonical line matching so markdown
    table separator dash-count / trailing-space drift does not fail the edit.
    On canonical hit, returns the *real* content slice so the frontend
    ``includes``/``replace`` path still works.
    """
    if not old_text:
        return None
    if old_text in content:
        return old_text

    content_n = _normalize_newlines(content)
    old_n = _normalize_newlines(old_text)
    if old_n in content_n:
        return old_n

    content_lines = content_n.split("\n")
    old_lines = old_n.split("\n")
    # Drop a single trailing empty line from the needle (LLM copy artifact)
    if len(old_lines) > 1 and old_lines[-1] == "":
        old_lines = old_lines[:-1]

    norm_content = [_normalize_line_for_match(line) for line in content_lines]
    norm_old = [_normalize_line_for_match(line) for line in old_lines]
    n = len(norm_old)
    if n == 0:
        return None

    for i in range(len(norm_content) - n + 1):
        if norm_content[i : i + n] == norm_old:
            return "\n".join(content_lines[i : i + n])
    return None


async def handle_create_draft(
    title: str,
    content: str,
    reason: str | None = None
) -> dict:
    """Create a draft for the workshop."""
    if title is None or not str(title).strip():
        return {
            "success": False,
            "error": "create_draft requires a non-empty 'title'.",
            "message": (
                "Retry create_draft with both 'title' and full 'content' "
                "(Markdown allowed)."
            ),
        }
    if content is None or not str(content).strip():
        return {
            "success": False,
            "error": "create_draft requires non-empty 'content'.",
            "message": (
                "Do not call create_draft with title only. "
                "Retry with the complete draft body in 'content'."
            ),
        }
    title = str(title).strip()
    content = str(content)
    return {
        "success": True,
        "draft": {
            "title": title,
            "content": content,
            "reason": reason
        },
        "message": f"Draft '{title}' was created and opened in the workshop.",
        "action": "open_workshop"
    }


async def handle_edit_draft(
    edits: list[dict],
    reason: str | None = None,
    current_content: str | None = None,
) -> dict:
    """Edit the current draft in the workshop.

    Validates that every ``old_text`` occurs in ``current_content`` before
    reporting success. Without validation the UI would silently skip misses.
    Matching uses canonical normalization for table separators / trailing
    spaces; resolved ``old_text`` is always an exact slice of the draft.
    """
    # Some LLM APIs return edits as a JSON string instead of a list
    if isinstance(edits, str):
        try:
            edits = json.loads(edits)
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"edits parameter is invalid JSON: {e}",
                "message": "Please pass edits as a list of objects with old_text and new_text."
            }
    if not isinstance(edits, list):
        return {
            "success": False,
            "error": "edits must be a list of changes",
            "message": "edits: [{\"old_text\": \"...\", \"new_text\": \"...\"}, ...]"
        }

    validated_edits = []
    missing: list[str] = []
    for i, edit in enumerate(edits):
        if not isinstance(edit, dict):
            return {
                "success": False,
                "error": f"Edit #{i + 1} must be an object with old_text and new_text",
                "message": "Each entry: {\"old_text\": \"...\", \"new_text\": \"...\"}"
            }
        old_text = edit.get("old_text", "")
        new_text = edit.get("new_text", "")
        if current_content is not None and not old_text:
            return {
                "success": False,
                "error": f"Edit #{i + 1} has empty old_text",
                "message": "old_text must be an exact non-empty excerpt from the current draft.",
            }
        resolved_old = old_text
        if current_content is not None:
            resolved = resolve_old_text_in_content(current_content, old_text)
            if resolved is None:
                preview = old_text[:80].replace("\n", "\\n")
                missing.append(f"#{i + 1}: {preview!r}")
            else:
                resolved_old = resolved
                if resolved != old_text:
                    print(
                        f"[draft] canonical match remapped edit #{i + 1} "
                        f"(table/whitespace drift)"
                    )
        validated_edits.append({
            "old_text": resolved_old,
            "new_text": new_text
        })

    # current_content is required on the chat/send path. None skips validation
    # for legacy unit-test callers that do not pass a draft snapshot.
    if current_content is not None:
        if not current_content.strip():
            return {
                "success": False,
                "error": "No workshop draft content available to edit",
                "message": (
                    "edit_draft failed: there is no current Workshop draft in context. "
                    "Ask the user to open a draft, or use create_draft."
                ),
            }
        if missing:
            return {
                "success": False,
                "error": "old_text not found in current draft",
                "missing_edits": missing,
                "message": (
                    "edit_draft failed: one or more old_text values were not found "
                    "in the current Workshop draft (even after normalizing table "
                    "separators/trailing spaces). Missing: "
                    + "; ".join(missing)
                    + ". Re-read [WORKSHOP DRAFT] and retry with exact old_text."
                ),
            }

    edit_count = len(validated_edits)

    return {
        "success": True,
        "edits": validated_edits,
        "edit_count": edit_count,
        "reason": reason,
        "message": (
            f"✅ {edit_count} change{'s' if edit_count != 1 else ''} will be applied"
        ),
        "action": "edit_workshop"
    }

"""Helpers for status topic change history (project-wide audit trail)."""

from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from src.models import Session, StatusTopic

STATUS_HISTORY_LIMIT = 5
STATUS_HISTORY_PREVIEW_CHARS = 300


def build_status_history_entry(
    previous_content: str,
    reason: str,
    *,
    source: str,
    session_id: str | None = None,
    session_title: str | None = None,
) -> dict:
    """Build a history entry storing the state *before* the change."""
    entry: dict = {
        "content": previous_content,
        "reason": reason,
        "timestamp": datetime.now(UTC).isoformat(),
        "source": source,
    }
    if session_id:
        entry["session_id"] = session_id
    if session_title:
        entry["session_title"] = session_title
    return entry


async def resolve_session_meta(
    db: AsyncSession,
    session_id: str | None,
) -> tuple[str | None, str | None]:
    """Return (session_id, session_title) for history metadata."""
    if not session_id:
        return None, None
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        return session_id, None
    return session_id, session.title


def append_status_history(topic: StatusTopic, entry: dict) -> None:
    """Append history entry and mark JSON column dirty for SQLAlchemy."""
    topic.history = list(topic.history or []) + [entry]
    flag_modified(topic, "history")


def format_status_history_for_llm(
    history: list | None,
    *,
    limit: int = STATUS_HISTORY_LIMIT,
    preview_chars: int = STATUS_HISTORY_PREVIEW_CHARS,
) -> str:
    """Format recent history (obsolete previous states — never quote as live)."""
    if not history:
        return ""
    recent = list(history)[-limit:]
    lines = [
        "#### STATUS HISTORY (OBSOLETE — DO NOT QUOTE AS CURRENT)",
        "Older values only, for explaining who changed what. "
        "Never treat these previews as the live status.",
        "",
    ]
    for entry in recent:
        if not isinstance(entry, dict):
            continue
        ts = str(entry.get("timestamp") or "")[:19].replace("T", " ")
        source = entry.get("source") or "unknown"
        session_title = entry.get("session_title")
        session_bit = f' session "{session_title}"' if session_title else ""
        reason = entry.get("reason") or ""
        prev = str(entry.get("content") or "")
        if len(prev) > preview_chars:
            prev = prev[:preview_chars].rstrip() + "…"
        prev_display = prev.replace("\n", " / ") if prev else "(empty)"
        lines.append(f"- [{ts} UTC]{session_bit} | source: {source}")
        lines.append(f"  Reason: {reason}")
        prev_title = entry.get("previous_title")
        new_title = entry.get("new_title")
        if prev_title and new_title and prev_title != new_title:
            lines.append(
                f"  PREVIOUS TITLE (OBSOLETE): \"{prev_title}\" → \"{new_title}\""
            )
        lines.append(
            f"  PREVIOUS VALUE (OBSOLETE, NOT CURRENT): {prev_display}"
        )
        lines.append("")
    return "\n".join(lines)

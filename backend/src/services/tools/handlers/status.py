"""Status topic tool handlers.

Handles CRUD operations for status topics via AI tool calls.
"""

from datetime import datetime, UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import StatusTopic
from src.services.status_history import (
    append_status_history,
    build_status_history_entry,
    resolve_session_meta,
)


async def handle_create_status(
    db: AsyncSession,
    project_id: str,
    title: str,
    content: str,
    reason: str | None = None,
    session_id: str | None = None,
) -> dict:
    """Create a new status topic."""
    if not title or not title.strip():
        raise ValueError("title is required and must not be empty")
    if not content or not content.strip():
        raise ValueError("content is required and must not be empty")
    
    result = await db.execute(
        select(StatusTopic)
        .where(StatusTopic.project_id == project_id)
        .order_by(StatusTopic.order_index.desc())
        .limit(1)
    )
    last_topic = result.scalar_one_or_none()
    next_order = (last_topic.order_index + 1) if last_topic else 0

    sid, stitle = await resolve_session_meta(db, session_id)
    history = [
        build_status_history_entry(
            previous_content="",
            reason=reason or "Created via AI tool",
            source="ai_tool",
            session_id=sid,
            session_title=stitle,
        )
    ]
    
    topic = StatusTopic(
        project_id=project_id,
        title=title,
        content=content,
        order_index=next_order,
        history=history,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    
    return {
        "success": True,
        "topic_id": topic.id,
        "title": topic.title,
        "content": topic.content,
        "message": f"Status topic '{title}' created successfully."
    }


async def handle_read_status(
    db: AsyncSession,
    project_id: str
) -> dict:
    """Read all status topics for a project."""
    result = await db.execute(
        select(StatusTopic)
        .where(StatusTopic.project_id == project_id)
        .order_by(StatusTopic.order_index)
    )
    topics = result.scalars().all()
    
    return {
        "success": True,
        "count": len(topics),
        "topics": [
            {
                "id": topic.id,
                "title": topic.title,
                "content": topic.content,
                "order_index": topic.order_index
            }
            for topic in topics
        ],
        "message": f"{len(topics)} status topic(s) found."
    }


async def handle_update_status(
    db: AsyncSession,
    topic_id: str,
    content: str | None = None,
    reason: str | None = None,
    title: str | None = None,
    session_id: str | None = None,
) -> dict:
    """Update a status topic's content and/or title.

    At least one of ``title`` or ``content`` must be provided. Unchanged
    fields are a no-op: success with ``noop=True``, no history entry, no
    DB write — so the model is not told a fake "updated".
    """
    if content is None and title is None:
        raise ValueError(
            "You must provide at least 'title' or 'content' to update."
        )
    if title is not None and not str(title).strip():
        raise ValueError("title must not be empty when provided")
    if content is not None and not str(content).strip():
        raise ValueError("content must not be empty when provided")

    result = await db.execute(
        select(StatusTopic).where(StatusTopic.id == topic_id)
    )
    topic = result.scalar_one_or_none()

    if not topic:
        raise ValueError(f"Status topic with ID {topic_id} not found.")

    old_content = topic.content
    old_title = topic.title
    new_title = str(title).strip() if title is not None else old_title
    new_content = content if content is not None else old_content

    title_changed = title is not None and new_title != old_title
    # Exact match only — whitespace-different content is a real update.
    content_changed = content is not None and new_content != old_content

    if not title_changed and not content_changed:
        preview = (old_content or "")[:80].replace("\n", "\\n")
        return {
            "success": True,
            "noop": True,
            "topic_id": topic.id,
            "title": topic.title,
            "old_title": old_title,
            "new_title": old_title,
            "old_content": old_content,
            "new_content": old_content,
            "message": (
                f"Status ignored (no-op): '{topic.title}' is already "
                f"'{preview}'"
                + (
                    f" with title '{old_title}'"
                    if title is not None
                    else ""
                )
                + "."
            ),
        }

    history_reason = reason or "Updated via AI tool"
    if title_changed:
        history_reason = (
            f"{history_reason} "
            f"(retitled: '{old_title}' → '{new_title}')"
        )

    sid, stitle = await resolve_session_meta(db, session_id)
    entry = build_status_history_entry(
        previous_content=old_content,
        reason=history_reason,
        source="ai_tool",
        session_id=sid,
        session_title=stitle,
    )
    if title_changed:
        entry["previous_title"] = old_title
        entry["new_title"] = new_title
    append_status_history(topic, entry)

    if title_changed:
        topic.title = new_title
    if content_changed:
        topic.content = new_content
    topic.updated_at = datetime.now(UTC)

    await db.commit()

    if title_changed and content_changed:
        message = (
            f"Status topic retitled from '{old_title}' to '{new_title}' "
            f"and content updated successfully."
        )
    elif title_changed:
        message = (
            f"Status topic retitled from '{old_title}' to '{new_title}' "
            f"successfully."
        )
    else:
        message = f"Status topic '{topic.title}' updated successfully."

    return {
        "success": True,
        "noop": False,
        "topic_id": topic.id,
        "title": topic.title,
        "old_title": old_title,
        "new_title": topic.title,
        "old_content": old_content,
        "new_content": topic.content,
        "message": message,
    }


async def handle_delete_status(
    db: AsyncSession,
    topic_id: str
) -> dict:
    """Delete a status topic."""
    result = await db.execute(
        select(StatusTopic).where(StatusTopic.id == topic_id)
    )
    topic = result.scalar_one_or_none()
    
    if not topic:
        raise ValueError(f"Status topic with ID {topic_id} not found.")
    
    title = topic.title
    await db.delete(topic)
    await db.commit()
    
    return {
        "success": True,
        "topic_id": topic_id,
        "title": title,
        "message": f"Status topic '{title}' deleted successfully."
    }

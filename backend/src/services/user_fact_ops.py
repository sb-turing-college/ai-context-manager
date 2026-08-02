"""Shared UserFact upsert helpers (tools + REST).

Identity: (category, normalize_user_fact_title(title)).
"""

from datetime import datetime, UTC
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from src.models import UserFact

VALID_CATEGORIES = ("style", "expertise", "preference", "context")
UpsertAction = Literal["created", "updated"]


def normalize_user_fact_title(title: str) -> str:
    """Normalize a fact title for identity matching.

    Rules: strip leading/trailing whitespace, then ``str.casefold()``.
    Used for lookup and for the stored ``title_normalized`` column.
    """
    return (title or "").strip().casefold()


async def upsert_user_fact(
    db: AsyncSession,
    title: str,
    content: str,
    category: str = "preference",
    reason: str | None = None,
) -> tuple[UserFact, UpsertAction]:
    """Insert or update a user fact by (category, normalized title).

    Returns:
        (fact, "created"|"updated")
    """
    if not title or not title.strip():
        raise ValueError("title is required and must not be empty")
    if not content or not content.strip():
        raise ValueError("content is required and must not be empty")

    if category not in VALID_CATEGORIES:
        category = "preference"

    title_stripped = title.strip()
    title_norm = normalize_user_fact_title(title_stripped)
    if not title_norm:
        raise ValueError("title is required and must not be empty")

    result = await db.execute(
        select(UserFact).where(
            UserFact.category == category,
            UserFact.title_normalized == title_norm,
        )
    )
    existing = result.scalar_one_or_none()
    now = datetime.now(UTC)
    history_reason = reason or ("Updated via upsert" if existing else "Created via upsert")

    if existing:
        old_content = existing.content
        existing.title = title_stripped
        existing.title_normalized = title_norm
        existing.content = content
        existing.history = list(existing.history or []) + [{
            "content": content,
            "reason": history_reason,
            "timestamp": now.isoformat(),
            "previous_content": old_content,
        }]
        attributes.flag_modified(existing, "history")
        existing.updated_at = now
        await db.commit()
        await db.refresh(existing)
        return existing, "updated"

    order_result = await db.execute(
        select(UserFact)
        .where(UserFact.category == category)
        .order_by(UserFact.order_index.desc())
        .limit(1)
    )
    last = order_result.scalar_one_or_none()
    next_order = (last.order_index + 1) if last else 0

    fact = UserFact(
        category=category,
        title=title_stripped,
        title_normalized=title_norm,
        content=content,
        order_index=next_order,
        history=[{
            "content": content,
            "reason": history_reason,
            "timestamp": now.isoformat(),
        }],
        created_at=now,
        updated_at=now,
    )
    db.add(fact)
    await db.commit()
    await db.refresh(fact)
    return fact, "created"

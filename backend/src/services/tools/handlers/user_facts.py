"""UserFact tool handlers (upsert + delete)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import UserFact
from src.services.user_fact_ops import upsert_user_fact


async def handle_upsert_user_fact(
    db: AsyncSession,
    title: str,
    content: str,
    category: str = "preference",
    reason: str | None = None,
) -> dict:
    """Create or update a global user profile fact by category + normalized title."""
    fact, action = await upsert_user_fact(
        db=db,
        title=title,
        content=content,
        category=category,
        reason=reason,
    )
    verb = "created" if action == "created" else "updated"
    return {
        "success": True,
        "fact_id": fact.id,
        "title": fact.title,
        "content": fact.content,
        "category": fact.category,
        "action": action,
        "message": f"User fact '{fact.title}' [{fact.category}] {verb} successfully.",
    }


async def handle_delete_user_fact(
    db: AsyncSession,
    fact_id: str,
) -> dict:
    """Delete a user fact."""
    result = await db.execute(select(UserFact).where(UserFact.id == fact_id))
    fact = result.scalar_one_or_none()

    if not fact:
        raise ValueError(f"User fact with ID {fact_id} not found.")

    title = fact.title
    await db.delete(fact)
    await db.commit()

    return {
        "success": True,
        "fact_id": fact_id,
        "title": title,
        "message": f"User fact '{title}' deleted successfully.",
    }

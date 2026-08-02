"""UserFacts endpoints – global AI user profile (project-independent)."""

from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from src.database import get_db
from src.models import UserFact
from src.schemas.user_fact import UserFactResponse, UserFactCreate, UserFactUpdate
from src.services.user_fact_ops import normalize_user_fact_title, upsert_user_fact

router = APIRouter()


@router.get("/user-facts", response_model=list[UserFactResponse])
async def get_user_facts(
    db: AsyncSession = Depends(get_db)
) -> list[UserFact]:
    """Get all user profile facts ordered by category + order_index."""
    result = await db.execute(
        select(UserFact).order_by(UserFact.category, UserFact.order_index)
    )
    return list(result.scalars().all())


@router.post("/user-facts", response_model=UserFactResponse)
async def create_user_fact(
    fact_data: UserFactCreate,
    response: Response,
    db: AsyncSession = Depends(get_db)
) -> UserFact:
    """Upsert a user fact (merge on category + normalized title)."""
    try:
        fact, action = await upsert_user_fact(
            db=db,
            title=fact_data.title,
            content=fact_data.content,
            category=fact_data.category,
            reason="Upserted via API",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user fact with this category and title already exists",
        ) from exc

    # Optional order_index from create payload (only applied after upsert)
    if fact_data.order_index is not None and fact.order_index != fact_data.order_index:
        fact.order_index = fact_data.order_index
        fact.updated_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(fact)

    response.status_code = (
        status.HTTP_201_CREATED if action == "created" else status.HTTP_200_OK
    )
    return fact


@router.patch("/user-facts/{fact_id}", response_model=UserFactResponse)
async def update_user_fact(
    fact_id: str,
    fact_data: UserFactUpdate,
    db: AsyncSession = Depends(get_db)
) -> UserFact:
    """Update a user fact by ID. Content changes create a history entry."""
    result = await db.execute(select(UserFact).where(UserFact.id == fact_id))
    fact = result.scalar_one_or_none()

    if not fact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"UserFact {fact_id} not found"
        )

    if fact_data.category is not None:
        fact.category = fact_data.category
    if fact_data.title is not None:
        fact.title = fact_data.title.strip()
        fact.title_normalized = normalize_user_fact_title(fact.title)
    elif fact_data.category is not None:
        # category changed with same title — keep normalized in sync
        fact.title_normalized = normalize_user_fact_title(fact.title)

    if fact_data.content is not None and fact_data.content != fact.content:
        history_entry = {
            "content": fact.content,
            "timestamp": datetime.now(UTC).isoformat(),
            "reason": fact_data.reason or "Updated"
        }
        fact.history = fact.history + [history_entry]
        fact.content = fact_data.content
        attributes.flag_modified(fact, "history")
    if fact_data.order_index is not None:
        fact.order_index = fact_data.order_index

    fact.updated_at = datetime.now(UTC)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another user fact already uses this category and title",
        ) from exc
    await db.refresh(fact)
    return fact


@router.delete("/user-facts/{fact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_fact(
    fact_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a user fact."""
    result = await db.execute(select(UserFact).where(UserFact.id == fact_id))
    fact = result.scalar_one_or_none()

    if not fact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"UserFact {fact_id} not found"
        )

    await db.delete(fact)
    await db.commit()

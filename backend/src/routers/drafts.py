"""Draft endpoints for workshop persistence."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Draft, Session
from src.schemas.draft import DraftResponse, DraftUpdate

router = APIRouter(prefix="/api/v1", tags=["drafts"])


@router.get("/sessions/{session_id}/draft", response_model=DraftResponse | None)
async def get_draft(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> Draft | None:
    """Get draft for a session.
    
    Returns null if no draft exists for this session.
    
    Args:
        session_id: Session UUID
        db: Database session
        
    Returns:
        Draft or None
    """
    result = await db.execute(
        select(Draft).where(Draft.session_id == session_id)
    )
    draft = result.scalar_one_or_none()
    return draft


@router.put("/sessions/{session_id}/draft", response_model=DraftResponse)
async def save_draft(
    session_id: str,
    draft_data: DraftUpdate,
    db: AsyncSession = Depends(get_db)
) -> Draft:
    """Save or update draft for a session (upsert).
    
    Creates a new draft if none exists, otherwise updates the existing one.
    
    Args:
        session_id: Session UUID
        draft_data: Draft data to save
        db: Database session
        
    Returns:
        Updated draft
        
    Raises:
        HTTPException: 404 if session not found
    """
    # Verify session exists
    session_result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with id {session_id} not found"
        )
    
    # Get or create draft
    result = await db.execute(
        select(Draft).where(Draft.session_id == session_id)
    )
    draft = result.scalar_one_or_none()
    
    if draft:
        # Update existing draft
        if draft_data.title is not None:
            draft.title = draft_data.title
        if draft_data.content is not None:
            draft.content = draft_data.content
        if draft_data.history is not None:
            draft.history = [h.model_dump() for h in draft_data.history]
        if draft_data.current_version is not None:
            draft.current_version = draft_data.current_version
    else:
        # Create new draft
        draft = Draft(
            session_id=session_id,
            title=draft_data.title or "Entwurf",
            content=draft_data.content or "",
            history=([h.model_dump() for h in draft_data.history] if draft_data.history else []),
            current_version=draft_data.current_version or 1
        )
        db.add(draft)
    
    await db.commit()
    await db.refresh(draft)
    return draft


@router.delete("/sessions/{session_id}/draft", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    session_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete draft for a session.
    
    Args:
        session_id: Session UUID
        db: Database session
    """
    result = await db.execute(
        select(Draft).where(Draft.session_id == session_id)
    )
    draft = result.scalar_one_or_none()
    
    if draft:
        await db.delete(draft)
        await db.commit()

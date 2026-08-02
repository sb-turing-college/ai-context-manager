"""Status Topics endpoints for project status tracking."""

from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import StatusTopic, Project
from src.schemas.status import (
    StatusTopicResponse,
    StatusTopicCreate,
    StatusTopicUpdate,
)
from src.services.status_history import (
    append_status_history,
    build_status_history_entry,
)

router = APIRouter()


@router.get("/projects/{project_id}/status", response_model=list[StatusTopicResponse])
async def get_project_status_topics(
    project_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[StatusTopic]:
    """Get all status topics for a project.
    
    Args:
        project_id: Project UUID
        db: Database session
        
    Returns:
        List of status topics ordered by order_index
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> topics = await get_project_status_topics("abc-123")
        >>> len(topics)
        3
    """
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    
    # Get topics ordered by order_index
    result = await db.execute(
        select(StatusTopic)
        .where(StatusTopic.project_id == project_id)
        .order_by(StatusTopic.order_index)
    )
    topics = result.scalars().all()
    return list(topics)


@router.post("/status", response_model=StatusTopicResponse, status_code=status.HTTP_201_CREATED)
async def create_status_topic(
    topic_data: StatusTopicCreate,
    db: AsyncSession = Depends(get_db)
) -> StatusTopic:
    """Create a new status topic.
    
    Args:
        topic_data: Topic creation data
        db: Database session
        
    Returns:
        Newly created topic
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> topic = await create_status_topic(
        ...     StatusTopicCreate(
        ...         project_id="abc-123",
        ...         title="Budget",
        ...         content="5000 EUR remaining"
        ...     )
        ... )
        >>> topic.title
        'Budget'
    """
    # Verify project exists
    result = await db.execute(
        select(Project).where(Project.id == topic_data.project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {topic_data.project_id} not found"
        )
    
    # Determine order_index if not provided
    order_index = topic_data.order_index
    if order_index is None:
        # Get max order_index and add 1
        result = await db.execute(
            select(StatusTopic)
            .where(StatusTopic.project_id == topic_data.project_id)
            .order_by(StatusTopic.order_index.desc())
        )
        last_topic = result.scalars().first()
        order_index = (last_topic.order_index + 1) if last_topic else 0
    
    now = datetime.now(UTC)
    history = [
        build_status_history_entry(
            previous_content="",
            reason="Created via UI",
            source="user_ui",
        )
    ]
    
    topic = StatusTopic(
        project_id=topic_data.project_id,
        title=topic_data.title,
        content=topic_data.content,
        order_index=order_index,
        history=history,
        created_at=now,
        updated_at=now
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.get("/status/{topic_id}", response_model=StatusTopicResponse)
async def get_status_topic(
    topic_id: str,
    db: AsyncSession = Depends(get_db)
) -> StatusTopic:
    """Get a single status topic.
    
    Args:
        topic_id: Topic UUID
        db: Database session
        
    Returns:
        Status topic
        
    Raises:
        HTTPException: 404 if topic not found
        
    Example:
        >>> topic = await get_status_topic("def-456")
        >>> topic.title
        'Budget'
    """
    result = await db.execute(select(StatusTopic).where(StatusTopic.id == topic_id))
    topic = result.scalar_one_or_none()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Status topic with id {topic_id} not found"
        )
    
    return topic


@router.patch("/status/{topic_id}", response_model=StatusTopicResponse)
async def update_status_topic(
    topic_id: str,
    topic_data: StatusTopicUpdate,
    db: AsyncSession = Depends(get_db)
) -> StatusTopic:
    """Update a status topic.
    
    If content is changed, a history entry is created.
    
    Args:
        topic_id: Topic UUID
        topic_data: Update data
        db: Database session
        
    Returns:
        Updated topic
        
    Raises:
        HTTPException: 404 if topic not found
        
    Example:
        >>> topic = await update_status_topic(
        ...     "def-456",
        ...     StatusTopicUpdate(
        ...         content="4000 EUR remaining",
        ...         reason="Paid invoice"
        ...     )
        ... )
        >>> topic.content
        '4000 EUR remaining'
    """
    result = await db.execute(select(StatusTopic).where(StatusTopic.id == topic_id))
    topic = result.scalar_one_or_none()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Status topic with id {topic_id} not found"
        )
    
    # Update title if provided
    if topic_data.title is not None:
        topic.title = topic_data.title
    
    # Update content and create history entry if changed
    if topic_data.content is not None and topic_data.content != topic.content:
        append_status_history(
            topic,
            build_status_history_entry(
                previous_content=topic.content,
                reason=topic_data.reason or "Updated via UI",
                source="user_ui",
            ),
        )
        topic.content = topic_data.content
    
    # Update order_index if provided
    if topic_data.order_index is not None:
        topic.order_index = topic_data.order_index
    
    topic.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/status/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_status_topic(
    topic_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a status topic.
    
    Args:
        topic_id: Topic UUID
        db: Database session
        
    Raises:
        HTTPException: 404 if topic not found
        
    Example:
        >>> await delete_status_topic("def-456")
        # Topic deleted
    """
    result = await db.execute(select(StatusTopic).where(StatusTopic.id == topic_id))
    topic = result.scalar_one_or_none()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Status topic with id {topic_id} not found"
        )
    
    await db.delete(topic)
    await db.commit()


@router.get("/status/{topic_id}/history", response_model=list[dict])
async def get_status_topic_history(
    topic_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Get change history for a status topic.
    
    Args:
        topic_id: Topic UUID
        db: Database session
        
    Returns:
        List of history entries
        
    Raises:
        HTTPException: 404 if topic not found
        
    Example:
        >>> history = await get_status_topic_history("def-456")
        >>> len(history)
        5
    """
    result = await db.execute(select(StatusTopic).where(StatusTopic.id == topic_id))
    topic = result.scalar_one_or_none()
    
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Status topic with id {topic_id} not found"
        )
    
    return topic.history

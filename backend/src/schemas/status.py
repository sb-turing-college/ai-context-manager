"""Pydantic schemas for Status Topics endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class StatusTopicResponse(BaseModel):
    """Schema for status topic responses.
    
    Attributes:
        id: Unique topic identifier
        project_id: Parent project ID
        title: Topic title
        content: Topic content
        order_index: Display order
        history: Change history
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    
    id: str
    project_id: str
    title: str
    content: str
    order_index: int
    history: list[dict]
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class StatusTopicCreate(BaseModel):
    """Schema for creating a status topic.
    
    Attributes:
        project_id: Parent project ID
        title: Topic title
        content: Topic content
        order_index: Display order (optional, defaults to end)
    """
    
    project_id: str = Field(..., description="Parent project UUID")
    title: str = Field(..., min_length=1, max_length=200, description="Topic title")
    content: str = Field(..., min_length=1, description="Topic content")
    order_index: int | None = Field(None, ge=0, description="Display order")


class StatusTopicUpdate(BaseModel):
    """Schema for updating a status topic.
    
    If content is changed, a history entry is created.
    
    Attributes:
        title: New title (optional)
        content: New content (optional, creates history entry)
        order_index: New order (optional)
        reason: Reason for content change (optional, for history)
    """
    
    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = Field(None, min_length=1)
    order_index: int | None = Field(None, ge=0)
    reason: str | None = Field(None, description="Reason for change (saved to history)")

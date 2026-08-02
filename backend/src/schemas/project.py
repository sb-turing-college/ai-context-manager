"""Pydantic schemas for Project endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    """Schema for creating a new project.
    
    Attributes:
        title: Project name/title
    """
    
    title: str = Field(..., min_length=1, max_length=200, description="Project name")


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project.
    
    Attributes:
        title: New project name/title
    """
    
    title: str = Field(..., min_length=1, max_length=200, description="New project name")


class ProjectResponse(BaseModel):
    """Schema for project responses.
    
    Attributes:
        id: Unique project identifier
        title: Project name
        session_count: Number of sessions in this project
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    
    id: str
    title: str
    session_count: int = 0
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

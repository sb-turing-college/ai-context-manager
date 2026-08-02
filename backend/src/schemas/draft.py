"""Pydantic schemas for Draft endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class DraftHistoryEntry(BaseModel):
    """Single version entry in draft history."""
    version: int
    content: str


class DraftResponse(BaseModel):
    """Schema for draft response."""
    id: str
    session_id: str
    title: str
    content: str
    history: list[DraftHistoryEntry]
    current_version: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DraftUpdate(BaseModel):
    """Schema for updating a draft."""
    title: str | None = Field(None, description="Draft title")
    content: str | None = Field(None, description="Current draft content")
    history: list[DraftHistoryEntry] | None = Field(None, description="Version history")
    current_version: int | None = Field(None, description="Current version number")

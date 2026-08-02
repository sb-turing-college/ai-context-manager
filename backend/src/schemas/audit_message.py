"""Pydantic schemas for Audit Messages (Chat B)."""
from datetime import datetime
from pydantic import BaseModel, Field


class AuditMessageCreate(BaseModel):
    """Schema for creating an audit message (Chat B).
    
    Attributes:
        role: Message role ('user' | 'assistant')
        content: Message content
        model: AI model (optional, for assistant messages)
    """
    role: str = Field(..., description="user or assistant")
    content: str = Field(..., min_length=1)
    model: str | None = Field(None, description="AI model name")


class AuditMessageResponse(BaseModel):
    """Schema for audit message response.
    
    Attributes:
        id: Message UUID
        session_id: Parent session ID
        role: Message role
        content: Message content
        timestamp: ISO timestamp (auto-serialized from datetime)
        model: AI model (optional)
    """
    id: str
    session_id: str
    role: str
    content: str
    timestamp: datetime  # Pydantic auto-serializes to ISO string
    model: str | None = None
    
    class Config:
        from_attributes = True

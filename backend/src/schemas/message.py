"""Pydantic schemas for ChatMessage endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field, field_serializer


class MessageCreate(BaseModel):
    """Schema for creating a new chat message.
    
    Attributes:
        role: Message role ('user', 'ai', 'feedback', 'tool')
        content: Message text content
        timestamp: Human-readable timestamp
        model: AI model name (optional, for AI messages)
        tool_call_data: Tool call data (optional, for tool messages)
        feedback_data: Feedback block data (optional, for feedback messages)
    """
    
    role: str = Field(..., description="Message role: user, ai, feedback, or tool")
    content: str = Field(..., min_length=1, description="Message content")
    timestamp: str | None = Field(None, description="Optional - Backend generates if not provided")
    model: str | None = Field(None, description="AI model name")
    tool_call_data: dict | None = Field(None, description="Tool call details")
    feedback_data: dict | None = Field(None, description="Feedback block data")


class MessageResponse(BaseModel):
    """Schema for chat message responses.
    
    Attributes:
        id: Unique message identifier
        session_id: Parent session ID
        role: Message role
        content: Message text
        timestamp: Human-readable timestamp
        created_at: ISO datetime string for chronological sorting
        model: AI model name
        tool_call_data: Tool call data
        feedback_data: Feedback block data
    """
    
    id: str
    session_id: str
    role: str
    content: str
    timestamp: str
    created_at: datetime  # DateTime object from DB, serialized to ISO string
    model: str | None
    tool_call_data: dict | None
    feedback_data: dict | None
    input_tokens: int | None = None
    output_tokens: int | None = None
    
    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        """Serialize datetime to ISO string."""
        return value.isoformat()
    
    model_config = {"from_attributes": True}

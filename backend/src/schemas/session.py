"""Pydantic schemas for Session and SessionSummary endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    """Schema for creating a new session.
    
    Attributes:
        project_id: Parent project ID
        title: Session name/title
    """
    
    project_id: str = Field(..., description="Parent project UUID")
    title: str = Field(..., min_length=1, max_length=200, description="Session name")


class SessionUpdate(BaseModel):
    """Schema for updating an existing session.
    
    Attributes:
        title: New session name/title (optional)
        attached_summary_ids: Other session IDs whose summaries are attached (optional)
    """
    
    title: str | None = Field(
        None, min_length=1, max_length=200, description="New session name"
    )
    attached_summary_ids: list[str] | None = Field(
        None,
        description="Session IDs whose summaries are attached as cross-session context",
    )


class SessionResponse(BaseModel):
    """Schema for session responses.
    
    Attributes:
        id: Unique session identifier
        project_id: Parent project ID
        title: Session name
        message_count: Number of messages in session
        active: Whether this is the active session
        last_modified: Human-readable last modified time
        created_at: Creation timestamp
        updated_at: Last update timestamp
        summary_status: Summary freshness indicator (none | outdated | current)
        attached_summary_ids: Other session IDs whose summaries are attached
    """
    
    id: str
    project_id: str
    title: str
    message_count: int
    active: bool
    last_modified: str | None
    created_at: datetime
    updated_at: datetime
    summary_status: str = Field(
        default="none",
        description="Summary status: 'none' (no summary), 'outdated' (summary exists but session has new messages), 'current' (summary is up-to-date)"
    )
    attached_summary_ids: list[str] = Field(
        default_factory=list,
        description="Session IDs whose summaries are attached as cross-session context",
    )
    
    model_config = {"from_attributes": True}


class SessionSummaryCreate(BaseModel):
    """Schema for creating a session summary.
    
    Attributes:
        content: Summary text content
        token_count: Estimated token count (optional)
        message_count_at_creation: Message count when summary was created (optional)
    """
    
    content: str = Field(..., min_length=1, description="Summary content")
    token_count: int | None = Field(None, description="Estimated token count")
    message_count_at_creation: int | None = Field(
        None,
        description="Message count at summary creation"
    )


class SessionSummaryResponse(BaseModel):
    """Schema for session summary responses.
    
    Attributes:
        id: Unique summary identifier
        session_id: Parent session ID
        content: Summary text
        token_count: Estimated token count
        message_count_at_creation: Message count when created
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    
    id: str
    session_id: str
    content: str
    token_count: int | None
    message_count_at_creation: int | None
    model: str | None
    input_tokens: int | None = None
    output_tokens: int | None = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

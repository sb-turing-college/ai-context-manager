"""ChatMessage model."""

from datetime import datetime, UTC
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from src.database import Base


class ChatMessage(Base):
    """ChatMessage model representing a message in a chat session.
    
    Messages can be from user, AI, feedback blocks, or tool calls.
    
    Attributes:
        id: Unique message identifier (UUID)
        session_id: Parent session ID (foreign key)
        role: Message role ('user', 'ai', 'feedback', 'tool')
        content: Message text content
        timestamp: Human-readable timestamp ("14:30")
        created_at: Creation timestamp for chronological sorting
        model: AI model name (for AI messages)
        tool_call_data: Tool call data (for tool messages)
        feedback_data: Feedback block data (for feedback messages)
        is_archived: Soft-delete flag – archived by summarize, excluded from AI context
        archived_at: Timestamp when message was archived
        session: Parent session relationship
    """
    
    __tablename__ = "chat_messages"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # 'user', 'ai', 'feedback', 'tool'
    content = Column(Text, nullable=False)
    timestamp = Column(String, nullable=False)  # Human-readable time ("14:30")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))  # For sorting
    model = Column(String, nullable=True)
    
    # Optional fields for specific message types
    tool_call_data = Column(JSON, nullable=True)  # Tool call details
    feedback_data = Column(JSON, nullable=True)   # Feedback block data
    
    # Soft-delete for summarize – messages stay in DB but are excluded from AI context
    is_archived = Column(Boolean, default=False, server_default='0', nullable=False)
    archived_at = Column(DateTime, nullable=True)
    
    # Token usage from API (for AI messages only)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    
    # Relationships
    session = relationship("Session", back_populates="messages")

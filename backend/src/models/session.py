"""Session and SessionSummary models."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from src.database import Base


class Session(Base):
    """Session model representing a chat session.
    
    A session contains messages and optionally a summary.
    
    Attributes:
        id: Unique session identifier (UUID)
        project_id: Parent project ID (foreign key)
        title: Session name/title
        message_count: Number of messages in session
        active: Whether this is the currently active session
        last_modified: Human-readable last modified time
        attached_summary_ids: Other session IDs whose summaries are attached as context
        created_at: Session creation timestamp
        updated_at: Last *content* activity (messages); not bumped by rename/metadata
        project: Parent project relationship
        messages: Related chat messages (one-to-many)
        summary: Related session summary (one-to-one)
    """
    
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    message_count = Column(Integer, default=0)
    active = Column(Boolean, default=False)
    last_modified = Column(String, nullable=True)  # ISO timestamp of last content activity
    attached_summary_ids = Column(JSON, nullable=False, default=lambda: [])
    created_at = Column(DateTime, default=datetime.utcnow)
    # No onupdate: rename/metadata must not rewrite content-activity time
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="sessions")
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan"
    )
    draft = relationship(
        "Draft",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan"
    )
    summary = relationship(
        "SessionSummary",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan"
    )


class SessionSummary(Base):
    """SessionSummary model for cross-session context sharing.
    
    Stores condensed session information for use in other sessions.
    
    Attributes:
        id: Unique summary identifier (UUID)
        session_id: Parent session ID (foreign key, unique)
        content: Summary text content
        token_count: Estimated token count (for context caching)
        message_count_at_creation: Message count when summary was created
        created_at: Summary creation timestamp
        updated_at: Last update timestamp
        session: Parent session relationship
    """
    
    __tablename__ = "session_summaries"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    session_id = Column(String, ForeignKey("sessions.id"), unique=True, nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=True)
    message_count_at_creation = Column(Integer, nullable=True)
    model = Column(String, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    session = relationship("Session", back_populates="summary")

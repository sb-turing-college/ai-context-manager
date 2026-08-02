"""Draft model for workshop drafts."""

from datetime import datetime, UTC
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from src.database import Base


class Draft(Base):
    """Draft model for workshop content.
    
    Each session can have ONE active draft (1:1 relationship).
    Drafts are auto-saved and persist across app restarts.
    
    Attributes:
        id: Unique draft identifier (UUID)
        session_id: Parent session ID (foreign key, unique)
        title: Draft title
        content: Current draft content
        history: Version history as JSON array
        current_version: Current version number
        created_at: Creation timestamp
        updated_at: Last modification timestamp
    """
    
    __tablename__ = "drafts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False, unique=True)
    title = Column(String, nullable=False, default="Draft")
    content = Column(Text, nullable=False, default="")
    history = Column(JSON, nullable=False, default=list)  # [{ version: 1, content: "..." }, ...]
    current_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    
    # Relationships
    session = relationship("Session", back_populates="draft")

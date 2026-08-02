"""StatusTopic model for dynamic context tracking."""

from datetime import datetime, UTC
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from src.database import Base


class StatusTopic(Base):
    """StatusTopic model for tracking dynamic facts and state.
    
    Status topics can be created/updated/deleted by AI via tools.
    History is stored as JSON array.
    
    Attributes:
        id: Unique topic identifier (UUID)
        project_id: Parent project ID (foreign key)
        title: Topic title/name
        content: Current topic content
        order_index: Display order index
        history: Change history as JSON array
        created_at: Creation timestamp
        updated_at: Last update timestamp
        project: Parent project relationship
    """
    
    __tablename__ = "status_topics"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    order_index = Column(Integer, default=0)
    history = Column(
        JSON,
        default=list
    )  # [{ content, timestamp, reason }]
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    
    # Relationships
    project = relationship("Project", back_populates="status_topics")

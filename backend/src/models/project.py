"""Project model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import relationship

from src.database import Base


class Project(Base):
    """Project model representing a user project.
    
    A project contains sessions, library items, and status topics.
    
    Attributes:
        id: Unique project identifier (UUID)
        title: Project name
        created_at: Project creation timestamp
        updated_at: Last *content* activity in the project; not bumped by title rename
        sessions: Related sessions (one-to-many)
        library_items: Related library items (one-to-many)
        library_folders: Related library folders (one-to-many)
        status_topics: Related status topics (one-to-many)
    """
    
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # No onupdate: rename must not rewrite content-activity time
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    sessions = relationship(
        "Session",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    library_items = relationship(
        "LibraryItem",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    library_folders = relationship(
        "LibraryFolder",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    status_topics = relationship(
        "StatusTopic",
        back_populates="project",
        cascade="all, delete-orphan"
    )

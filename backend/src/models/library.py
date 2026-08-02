"""Library models for document management."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import backref, relationship

from src.database import Base


class LibraryFolder(Base):
    """LibraryFolder model for organizing library items.
    
    Supports nested folder hierarchy via parent-child relationships.
    
    Attributes:
        id: Unique folder identifier (UUID)
        project_id: Parent project ID (foreign key)
        parent_id: Parent folder ID (foreign key, nullable)
        name: Folder name
        created_at: Folder creation timestamp
        project: Parent project relationship
        parent: Parent folder relationship
        children: Child folders (one-to-many)
        items: Library items in this folder (one-to-many)
    """
    
    __tablename__ = "library_folders"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    parent_id = Column(String, ForeignKey("library_folders.id"), nullable=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="library_folders")
    parent = relationship(
        "LibraryFolder",
        remote_side=[id],
        backref=backref("children", cascade="all, delete-orphan")
    )
    items = relationship("LibraryItem", back_populates="folder")


class LibraryItem(Base):
    """LibraryItem model for documents with version history.
    
    Supports versioning with history stored as JSON array.
    
    Attributes:
        id: Unique item identifier (UUID)
        project_id: Parent project ID (foreign key)
        folder_id: Parent folder ID (foreign key, nullable)
        title: Document title
        content: Current document content
        item_type: File type ('text', 'markdown', 'pdf')
        version: Current version number
        history: Version history as JSON array
        created_at: Item creation timestamp
        updated_at: Last update timestamp
        project: Parent project relationship
        folder: Parent folder relationship
    """
    
    __tablename__ = "library_items"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    folder_id = Column(String, ForeignKey("library_folders.id"), nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    item_type = Column(String, default="text")  # 'text', 'markdown', 'pdf'
    version = Column(Integer, default=1)
    history = Column(JSON, default=list)  # [{ version, content, timestamp }]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="library_items")
    folder = relationship("LibraryFolder", back_populates="items")

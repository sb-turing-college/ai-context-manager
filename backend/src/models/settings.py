"""Settings models for application configuration."""

from datetime import datetime, UTC
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, JSON, String, Text

from src.database import Base


class Setting(Base):
    """Setting model for key-value app settings.
    
    Stores generic application settings as JSON values.
    
    Attributes:
        key: Setting key (primary key)
        value: Setting value as JSON
        updated_at: Last update timestamp
    """
    
    __tablename__ = "settings"
    
    key = Column(String, primary_key=True)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class SystemRole(Base):
    """SystemRole model for AI system prompts.
    
    Defines different roles for Chat A, Chat B (Audit), and Verify modes.
    
    Attributes:
        id: Unique role identifier (UUID)
        title: Role title/name
        content: Role prompt content
        category: Role category ('chat', 'audit', 'verify')
        is_default: Whether this is the default role for its category
        created_at: Role creation timestamp
        updated_at: Last update timestamp
    """
    
    __tablename__ = "system_roles"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String, nullable=False)  # 'chat', 'audit', 'verify'
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

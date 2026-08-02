"""UserFact model for global, project-independent user profile facts."""

from datetime import datetime, UTC
from uuid import uuid4

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text, UniqueConstraint

from src.database import Base


class UserFact(Base):
    """Global user profile facts managed by the AI via tools.

    Unlike StatusTopic, UserFacts are not tied to any project.
    They persist across all projects and sessions and are injected
    into every chat context so the AI can adapt to the user.

    Identity for upsert: (category, title_normalized) where
    title_normalized = strip + casefold of title.

    Attributes:
        id: Unique fact identifier (UUID)
        category: Fact category (style, expertise, preference, context)
        title: Display title (original casing preserved)
        title_normalized: Normalized title for uniqueness / upsert match
        content: Current fact content
        order_index: Display order index
        history: Change history as JSON array [{content, timestamp, reason}]
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """

    __tablename__ = "user_facts"
    __table_args__ = (
        UniqueConstraint(
            "category",
            "title_normalized",
            name="uq_user_facts_category_title_norm",
        ),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    category = Column(String, nullable=False, default="preference")
    title = Column(String, nullable=False)
    title_normalized = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    order_index = Column(Integer, default=0)
    history = Column(JSON, default=list)  # [{ content, timestamp, reason }]
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC)
    )

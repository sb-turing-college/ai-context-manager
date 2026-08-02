"""Audit Message model for Chat B (Critic/Auditor) conversations.

Separate from chat_messages to keep Chat A and Chat B isolated.
"""
from sqlalchemy import Column, String, ForeignKey, DateTime
from src.database import Base


class AuditMessage(Base):
    """AuditMessage model for Chat B conversations.
    
    Chat B (Auditor) messages are stored separately from Chat A.
    They are only transferred to Chat A when user clicks "Feedback →".
    
    Attributes:
        id: Unique message ID (UUID)
        session_id: Reference to parent session
        role: Message role ("user" | "assistant")
        content: Message text
        timestamp: Message creation time (UTC)
        model: AI model used (for assistant messages)
    """
    __tablename__ = "audit_messages"
    
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    model = Column(String, nullable=True)

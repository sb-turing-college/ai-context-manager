"""Content-activity timestamps for sessions and projects.

Rename / metadata edits must not bump these. Only chat/content writes should.
"""

from datetime import datetime, UTC

from src.models import Project, Session


def touch_session_content(session: Session, when: datetime | None = None) -> datetime:
    """Mark a session as content-changed (messages / real activity)."""
    ts = when or datetime.now(UTC)
    # Store naive UTC to match existing SQLite rows written via datetime.utcnow
    naive = ts.replace(tzinfo=None) if ts.tzinfo else ts
    session.updated_at = naive
    session.last_modified = naive.isoformat() + "+00:00"
    return naive


def touch_project_content(project: Project, when: datetime | None = None) -> datetime:
    """Mark a project as content-changed (for dashboard last-modified)."""
    ts = when or datetime.now(UTC)
    naive = ts.replace(tzinfo=None) if ts.tzinfo else ts
    project.updated_at = naive
    return naive

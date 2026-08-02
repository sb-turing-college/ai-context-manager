"""Database configuration and session management.

Sets up SQLAlchemy async engine and session factory for database operations.
"""

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base

from src.config import settings

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,  # Log SQL queries in debug mode
    future=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for all models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session dependency for FastAPI.
    
    Yields:
        AsyncSession: Database session
        
    Example:
        >>> @router.get("/projects")
        >>> async def get_projects(db: AsyncSession = Depends(get_db)):
        >>>     result = await db.execute(select(Project))
        >>>     return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def _run_migrations() -> None:
    """Apply additive schema migrations on startup.

    Uses try/except per column because SQLite has no IF NOT EXISTS for
    ADD COLUMN in older versions. Safe to run repeatedly.
    """
    migrations = [
        "ALTER TABLE chat_messages ADD COLUMN is_archived INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE chat_messages ADD COLUMN archived_at DATETIME",
        "ALTER TABLE session_summaries ADD COLUMN model VARCHAR",
        "ALTER TABLE chat_messages ADD COLUMN input_tokens INTEGER",
        "ALTER TABLE chat_messages ADD COLUMN output_tokens INTEGER",
        "ALTER TABLE session_summaries ADD COLUMN input_tokens INTEGER",
        "ALTER TABLE session_summaries ADD COLUMN output_tokens INTEGER",
        "ALTER TABLE sessions ADD COLUMN attached_summary_ids JSON DEFAULT '[]'",
        # UserFact upsert identity (nullable first; backfill then unique index)
        "ALTER TABLE user_facts ADD COLUMN title_normalized VARCHAR",
    ]
    async with engine.begin() as conn:
        for stmt in migrations:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # Column already exists – skip


async def _backfill_user_fact_title_normalized() -> None:
    """Backfill title_normalized and ensure unique index for upsert identity.

    If duplicate (category, normalized title) rows already exist, unique index
    creation fails — delete ``*.db`` and restart (A1 / pre-publish OK).
    """
    from src.services.user_fact_ops import normalize_user_fact_title

    async with AsyncSessionLocal() as session:
        result = await session.execute(text(
            "SELECT id, title, title_normalized FROM user_facts"
        ))
        rows = result.fetchall()
        for row in rows:
            fact_id, title, title_norm = row[0], row[1], row[2]
            computed = normalize_user_fact_title(title or "")
            if title_norm != computed:
                await session.execute(
                    text(
                        "UPDATE user_facts SET title_normalized = :n WHERE id = :id"
                    ),
                    {"n": computed, "id": fact_id},
                )
        await session.commit()

    async with engine.begin() as conn:
        try:
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_facts_category_title_norm "
                "ON user_facts (category, title_normalized)"
            ))
        except Exception as exc:
            print(
                "[db] WARNING: could not create unique index on "
                "user_facts(category, title_normalized). "
                "If duplicates exist, delete the local SQLite DB and restart. "
                f"Error: {exc}"
            )


async def init_db() -> None:
    """Initialize database by creating all tables, then run migrations.

    Called on application startup to ensure all tables and columns exist.

    ``create_all(checkfirst=True)`` is normally idempotent, but under
    uvicorn ``--reload`` two workers can race: both see "missing", one
    creates, the other hits ``table already exists``. Treat that as OK.
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True)
            )
    except OperationalError as exc:
        if "already exists" not in str(exc).lower():
            raise
    await _run_migrations()
    await _backfill_user_fact_title_normalized()

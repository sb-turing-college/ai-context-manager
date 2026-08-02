"""Test configuration and fixtures."""

import asyncio
from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from src.database import Base
from src.main import app
from src.config import settings


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(
    TEST_DATABASE_URL, 
    echo=False,
    poolclass=None  # Disable connection pooling for tests
)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(autouse=True)
def _disclaimer_accepted_for_tests(monkeypatch: pytest.MonkeyPatch):
    """CI/test bypass — same idea as DISCLAIMER_ACCEPTED=1 for Capstone."""
    monkeypatch.setattr(settings, "disclaimer_accepted", True)


async def override_get_db():
    """Override database dependency for testing."""
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture(scope="function", autouse=True)
async def setup_database():
    """Setup test database before each test.
    
    Creates all tables and cleans up after test.
    """
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Clean up after test - just drop all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def pytest_sessionfinish(session, exitstatus):
    """Clean up after all tests are done."""
    asyncio.run(test_engine.dispose())


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create async HTTP client for testing.
    
    Yields:
        AsyncClient instance
    """
    from src.database import get_db
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    
    app.dependency_overrides.clear()


@pytest.fixture
async def test_project_id(async_client: AsyncClient) -> str:
    """Create a test project and return its ID.
    
    Args:
        async_client: Async HTTP client
        
    Returns:
        Project ID string
    """
    response = await async_client.post(
        "/api/v1/projects",
        json={"title": "Test Project"},
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
async def test_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get test database session for handler-level tests.
    
    Yields:
        AsyncSession instance
    """
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture
async def test_project_id_for_handlers(test_db_session: AsyncSession) -> str:
    """Create a test project directly in DB (for handler tests).
    
    Args:
        test_db_session: Database session
        
    Returns:
        Project ID string
    """
    from src.models import Project
    from datetime import datetime, UTC
    
    project = Project(
        title="Test Project for Handlers",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC)
    )
    test_db_session.add(project)
    await test_db_session.commit()
    await test_db_session.refresh(project)
    return project.id


@pytest.fixture(scope="function")
def test_client():
    """Create a TestClient with test database override.
    
    CRITICAL: This ensures tests NEVER access the real database (app.db).
    All tests using TestClient must use this fixture.
    
    Yields:
        TestClient instance with test DB dependency override
    """
    from fastapi.testclient import TestClient
    from src.database import get_db
    from src.services.init_defaults import init_default_settings
    
    # Override database dependency to use test DB
    app.dependency_overrides[get_db] = override_get_db

    # Lifespan seeds the real DB; TestClient uses the in-memory override.
    # Seed defaults here so settings/prompt endpoints match a fresh install.
    async def _seed_defaults() -> None:
        async with TestSessionLocal() as session:
            await init_default_settings(session)
            await session.commit()

    asyncio.run(_seed_defaults())
    
    try:
        client = TestClient(app)
        yield client
    finally:
        # Clean up: Remove dependency override (ALWAYS, even on error)
        app.dependency_overrides.clear()

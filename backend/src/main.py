"""FastAPI application entrypoint.

Main application setup with CORS, lifespan management, and router registration.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.database import init_db, get_db
from src.routers import chat, health, library, projects, sessions, status, usage, system_roles, audit, drafts, user_facts, disclaimer
from src.routers import settings as settings_router
from src.services.init_defaults import init_default_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager.
    
    Handles startup and shutdown events.
    
    Args:
        app: FastAPI application instance
        
    Yields:
        None
    """
    # Startup: Initialize database
    await init_db()
    print("✅ Database initialized")
    
    # Initialize default settings
    async for db in get_db():
        await init_default_settings(db)
        print("✅ Default settings initialized")
        break
    
    yield
    
    # Shutdown: Cleanup (if needed)
    print("👋 Shutting down")


# Create FastAPI app
app = FastAPI(
    title="AI Context Manager API",
    description="Backend API for AI-powered context management and chat completion",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(disclaimer.router, prefix="/api/v1", tags=["disclaimer"])
app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
app.include_router(sessions.router, prefix="/api/v1", tags=["sessions"])
app.include_router(library.router, prefix="/api/v1", tags=["library"])
app.include_router(settings_router.router, prefix="/api/v1", tags=["settings"])
app.include_router(status.router, prefix="/api/v1", tags=["status"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(audit.router, prefix="/api/v1", tags=["audit"])
app.include_router(usage.router, prefix="/api/v1", tags=["usage"])
app.include_router(system_roles.router, prefix="/api/v1", tags=["system-roles"])
app.include_router(drafts.router)
app.include_router(user_facts.router, prefix="/api/v1", tags=["user-facts"])


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint redirect.
    
    Returns:
        Redirect message to API docs
    """
    return {
        "message": "AI Context Manager API",
        "docs": "/docs",
        "health": "/api/v1/health"
    }

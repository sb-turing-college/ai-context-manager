"""Health check endpoints."""

from fastapi import APIRouter

from src import __version__

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Check if the API is running.
    
    Returns:
        Health status and version information
        
    Example:
        >>> response = await health_check()
        >>> print(response)
        {'status': 'healthy', 'version': '0.1.0'}
    """
    return {
        "status": "healthy",
        "version": __version__
    }


@router.get("/info")
async def api_info() -> dict[str, str | list[str]]:
    """Get API information and capabilities.
    
    Returns:
        API metadata including name, version, providers, and database type
        
    Example:
        >>> response = await api_info()
        >>> print(response['name'])
        'AI Context Manager'
    """
    return {
        "name": "AI Context Manager",
        "version": __version__,
        "providers": ["google", "anthropic"],
        "database": "sqlite",
        "features": ["streaming", "tool_use", "cross_session_summaries"]
    }

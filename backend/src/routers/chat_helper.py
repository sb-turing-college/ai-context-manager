"""Helper functions for chat router."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Setting
from src.services.tools.definitions import TOOL_DEFINITIONS


async def get_enabled_tools(db: AsyncSession) -> list[str]:
    """Get list of enabled tools from settings.
    
    Args:
        db: Database session
        
    Returns:
        List of enabled tool names
    """
    # Get tool-use settings
    result = await db.execute(
        select(Setting).where(Setting.key == "tool_use")
    )
    setting = result.scalar_one_or_none()
    
    if not setting or not setting.value:
        # Default: All tools enabled
        return list(TOOL_DEFINITIONS.keys())
    
    # Extract enabled tools
    enabled_tools = []
    for tool_name, enabled in setting.value.items():
        if enabled:
            enabled_tools.append(tool_name)
    
    return enabled_tools

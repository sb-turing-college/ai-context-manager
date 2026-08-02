"""Initialize default settings in database on first startup."""

from datetime import datetime, UTC
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Setting
from src.routers.settings import DEFAULT_SYSTEM_PROMPTS


# Known placeholder values that should be replaced with full defaults
PLACEHOLDER_VALUES = {
    "Custom base prompt",
    "Custom expertise", 
    "Custom context handling",
    "Custom tool use",
    ""
}


async def init_default_settings(db: AsyncSession) -> None:
    """Initialize default system prompts if not present or if placeholder values.
    
    Called on application startup to ensure defaults exist in database.
    Also updates old placeholder values to the full default prompts.
    Stores both active prompts AND immutable defaults for reset functionality.
    
    IMPORTANT: 
    - Default (`_default`) is ALWAYS updated to match current code (for reset button)
    - Active prompt is updated if:
      - It doesn't exist (creates new)
      - It's a placeholder value (updates)
      - It still matches the previous shipped default (forward-sync of defaults)
    - User-customized prompts (diverged from previous default) are NEVER overwritten!
    - To reset a customized prompt, use the reset button
      (POST /settings/system-prompt-modules/{key}/reset)
    
    Args:
        db: Database session
        
    Example:
        >>> async with get_db() as db:
        ...     await init_default_settings(db)
        # Creates/updates system_prompt_base, system_prompt_expertise, etc.
        # Also creates system_prompt_base_default, system_prompt_expertise_default, etc.
    """
    for key, content in DEFAULT_SYSTEM_PROMPTS.items():
        # 1. Immutable default copy (for reset functionality)
        # ALWAYS update this to match current code (reset button uses this)
        default_key = f"system_prompt_{key}_default"
        
        result = await db.execute(
            select(Setting).where(Setting.key == default_key)
        )
        existing_default = result.scalar_one_or_none()
        
        previous_default_content = ""
        if not existing_default:
            # Create immutable default
            default_setting = Setting(
                key=default_key,
                value={"content": content, "immutable": True},
                updated_at=datetime.now(UTC)
            )
            db.add(default_setting)
            print(f"  🔒 Created immutable default for: {key}")
        else:
            previous_default_content = (
                existing_default.value.get("content", "") if existing_default.value else ""
            )
            # Update default to match current code (always keep in sync for reset button)
            existing_default.value = {"content": content, "immutable": True}
            existing_default.updated_at = datetime.now(UTC)
        
        # 2. Active prompt (user-editable)
        # Create/update if missing, placeholder, or still on previous shipped default.
        # Never overwrite prompts the user has customized away from the old default.
        setting_key = f"system_prompt_{key}"
        
        # Check if already exists
        result = await db.execute(
            select(Setting).where(Setting.key == setting_key)
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            # Create new default setting (first time)
            setting = Setting(
                key=setting_key,
                value={"content": content},
                updated_at=datetime.now(UTC)
            )
            db.add(setting)
            print(f"  ✅ Created default system prompt: {key}")
        else:
            existing_content = existing.value.get("content", "") if existing.value else ""
            
            if existing_content in PLACEHOLDER_VALUES:
                existing.value = {"content": content}
                existing.updated_at = datetime.now(UTC)
                print(f"  🔄 Updated placeholder system prompt: {key}")
            elif (
                previous_default_content
                and existing_content == previous_default_content
                and existing_content != content
            ):
                # Still on last shipped default → forward-sync to new default
                existing.value = {"content": content}
                existing.updated_at = datetime.now(UTC)
                print(f"  🔄 Synced active system prompt to new default: {key}")
            # else: User has customized it - NEVER touch it on startup!
    
    await db.commit()

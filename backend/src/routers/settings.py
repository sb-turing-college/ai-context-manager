"""Settings endpoints for app configuration and system roles."""

from datetime import datetime, UTC
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from src.database import get_db
from src.models.settings import Setting, SystemRole
from src.schemas.settings import (
    AppSettingsResponse,
    AppSettingsUpdate,
    SystemPromptModuleResponse,
    SystemPromptModuleUpdate,
    SystemPromptResponse,
    SystemPromptUpdate,
    SystemPromptsListResponse,
    SystemRoleResponse,
    SystemRoleCreate,
    SystemRoleUpdate,
    ToolUseSettingsResponse,
    ToolUseSettingsUpdate,
)

router = APIRouter()


def _load_prompt_defaults() -> dict[str, str]:
    """Load default system prompt content from markdown files in src/prompts/.

    Each key maps to a file named systemprompt-{key}-default.md.
    Underscores in key names are converted to hyphens for the filename.
    Raises FileNotFoundError on startup if a required file is missing.
    """
    prompts_dir = Path(__file__).parent.parent / "prompts"
    keys = ["base", "expertise", "tool_use", "summary", "verify", "audit"]
    result: dict[str, str] = {}
    for key in keys:
        filename = f"systemprompt-{key.replace('_', '-')}-default.md"
        filepath = prompts_dir / filename
        if not filepath.exists():
            raise FileNotFoundError(
                f"Required prompt file missing: {filepath}. "
                "Please restore or create it in src/prompts/."
            )
        result[key] = filepath.read_text(encoding="utf-8").strip()
    return result


# Default system prompt modules – loaded from src/prompts/*.md files.
# To update defaults: edit the corresponding .md file and restart the backend.
# User-customized prompts in the DB are never overwritten on restart.
DEFAULT_SYSTEM_PROMPTS = _load_prompt_defaults()


# --- App Settings ---

async def get_app_settings_dict(db: AsyncSession) -> dict:
    """Fetch app settings from DB. Callable from other routers."""
    result = await db.execute(select(Setting).where(Setting.key == "app_settings"))
    setting = result.scalar_one_or_none()
    defaults = {
        "font_size": 14,
        "animations_enabled": True,
        "summary_trigger_mode": "manual",
        "summary_keep_message_pairs": 5,
        "model_ids_hidden": [],
        "summary_model_mode": "current",
        "summary_model_id": None,
        "search_past_sessions_scope": "cross_project",
    }
    if not setting:
        return defaults
    return {**defaults, **setting.value}


@router.get("/settings", response_model=AppSettingsResponse)
async def get_app_settings(
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Get application settings.
    
    Args:
        db: Database session
        
    Returns:
        App settings with font size, animations, summary trigger mode
        
    Example:
        >>> settings = await get_app_settings()
        >>> settings["font_size"]
        14
    """
    return await get_app_settings_dict(db)


@router.patch("/settings", response_model=AppSettingsResponse)
async def update_app_settings(
    settings_data: AppSettingsUpdate,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Update application settings.
    
    Args:
        settings_data: Settings to update
        db: Database session
        
    Returns:
        Updated settings
        
    Example:
        >>> settings = await update_app_settings(
        ...     AppSettingsUpdate(font_size=16)
        ... )
        >>> settings["font_size"]
        16
    """
    # Get current settings
    result = await db.execute(select(Setting).where(Setting.key == "app_settings"))
    setting = result.scalar_one_or_none()
    
    if not setting:
        # Create new settings
        current = {
            "font_size": 14,
            "animations_enabled": True,
            "summary_trigger_mode": "manual",
            "summary_keep_message_pairs": 5,
            "model_ids_hidden": [],
            "summary_model_mode": "current",
            "summary_model_id": None,
            "search_past_sessions_scope": "cross_project"
        }
    else:
        current = setting.value
    
    # Update with new values
    update_data = settings_data.model_dump(exclude_unset=True)
    current.update(update_data)
    
    if setting:
        setting.value = current
        setting.updated_at = datetime.now(UTC)
        # Mark value as modified for SQLAlchemy
        attributes.flag_modified(setting, "value")
    else:
        setting = Setting(
            key="app_settings",
            value=current,
            updated_at=datetime.now(UTC)
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    
    return setting.value


# --- System Prompt Modules (for Chat A) ---

@router.get("/settings/system-prompt-modules", response_model=list[SystemPromptModuleResponse])
async def get_system_prompt_modules(
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Get all system prompt modules for Chat A (base, expertise, tool_use).
    
    Args:
        db: Database session
        
    Returns:
        List of system prompt modules
        
    Example:
        >>> prompts = await get_system_prompt_modules()
        >>> len(prompts)
        3-4
    """
    modules = []
    
    for key, default_content in DEFAULT_SYSTEM_PROMPTS.items():
        # Get active setting
        result = await db.execute(
            select(Setting).where(Setting.key == f"system_prompt_{key}")
        )
        setting = result.scalar_one_or_none()
        
        # Get default setting from DB (for comparison)
        result = await db.execute(
            select(Setting).where(Setting.key == f"system_prompt_{key}_default")
        )
        default_setting = result.scalar_one_or_none()
        
        if setting:
            content = setting.value.get("content", "")
            last_modified = setting.updated_at
            
            # Check if it matches the default (from DB, not code)
            is_default = False
            if default_setting:
                default_content_db = default_setting.value.get("content", "")
                is_default = (content == default_content_db)
            else:
                # Fallback: compare with code default if DB default not found
                is_default = (content == default_content)
            
            modules.append({
                "key": key,
                "content": content,
                "is_default": is_default,
                "last_modified": last_modified
            })
        else:
            # No active setting - use default from DB or code
            if default_setting:
                content = default_setting.value.get("content", "")
                last_modified = default_setting.updated_at
            else:
                content = default_content
                last_modified = datetime.now(UTC)
            
            modules.append({
                "key": key,
                "content": content,
                "is_default": True,
                "last_modified": last_modified
            })
    
    return modules


@router.put("/settings/system-prompt-modules/{module_key}", response_model=SystemPromptModuleResponse)
async def update_system_prompt_module(
    module_key: str,
    prompt_data: SystemPromptModuleUpdate,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Update a system prompt module.
    
    Args:
        module_key: Module key (base, expertise, context_handling, tool_use)
        prompt_data: New prompt content
        db: Database session
        
    Returns:
        Updated module
        
    Raises:
        HTTPException: 404 if module key is invalid
        
    Example:
        >>> module = await update_system_prompt(
        ...     "base",
        ...     SystemPromptModuleUpdate(content="Custom prompt...")
        ... )
        >>> module["is_default"]
        False
    """
    if module_key not in DEFAULT_SYSTEM_PROMPTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"System prompt module '{module_key}' not found"
        )
    
    # Get default setting for comparison
    default_key = f"system_prompt_{module_key}_default"
    result = await db.execute(
        select(Setting).where(Setting.key == default_key)
    )
    default_setting = result.scalar_one_or_none()
    
    # Get or create active setting
    result = await db.execute(
        select(Setting).where(Setting.key == f"system_prompt_{module_key}")
    )
    setting = result.scalar_one_or_none()
    
    now = datetime.now(UTC)
    
    if setting:
        setting.value = {"content": prompt_data.content}
        setting.updated_at = now
    else:
        setting = Setting(
            key=f"system_prompt_{module_key}",
            value={"content": prompt_data.content},
            updated_at=now
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    
    # Check if content matches default
    is_default = False
    if default_setting:
        default_content = default_setting.value.get("content", "")
        is_default = (prompt_data.content == default_content)
    
    return {
        "key": module_key,
        "content": setting.value["content"],
        "is_default": is_default,
        "last_modified": setting.updated_at
    }


@router.post("/settings/system-prompt-modules/{module_key}/reset", response_model=SystemPromptModuleResponse)
async def reset_system_prompt_module(
    module_key: str,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Reset a system prompt module to default.
    
    Uses the immutable default stored in database (from _default setting).
    This ensures the reset uses the current code default, not an old one.
    
    Args:
        module_key: Module key to reset
        db: Database session
        
    Returns:
        Reset module with default content
        
    Raises:
        HTTPException: 404 if module key is invalid or default not found
        
    Example:
        >>> module = await reset_system_prompt("base")
        >>> module["is_default"]
        True
    """
    if module_key not in DEFAULT_SYSTEM_PROMPTS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"System prompt module '{module_key}' not found"
        )
    
    # Get default from database (immutable default, always synced with code)
    default_key = f"system_prompt_{module_key}_default"
    result = await db.execute(
        select(Setting).where(Setting.key == default_key)
    )
    default_setting = result.scalar_one_or_none()
    
    if not default_setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Default prompt for '{module_key}' not found. Please restart the server."
        )
    
    default_content = default_setting.value.get("content", "")
    
    # Update or create active setting with default content
    setting_key = f"system_prompt_{module_key}"
    result = await db.execute(
        select(Setting).where(Setting.key == setting_key)
    )
    setting = result.scalar_one_or_none()
    
    now = datetime.now(UTC)
    
    if setting:
        setting.value = {"content": default_content}
        setting.updated_at = now
        attributes.flag_modified(setting, "value")
    else:
        setting = Setting(
            key=setting_key,
            value={"content": default_content},
            updated_at=now
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    
    return {
        "key": module_key,
        "content": default_content,
        "is_default": True,
        "last_modified": setting.updated_at
    }


# --- System Roles ---

@router.get("/settings/roles", response_model=list[SystemRoleResponse])
async def get_system_roles(
    db: AsyncSession = Depends(get_db)
) -> list[SystemRole]:
    """Get all system roles.
    
    Args:
        db: Database session
        
    Returns:
        List of all system roles
        
    Example:
        >>> roles = await get_system_roles()
        >>> len(roles)
        5
    """
    result = await db.execute(select(SystemRole))
    roles = result.scalars().all()
    return list(roles)


@router.post("/settings/roles", response_model=SystemRoleResponse, status_code=status.HTTP_201_CREATED)
async def create_system_role(
    role_data: SystemRoleCreate,
    db: AsyncSession = Depends(get_db)
) -> SystemRole:
    """Create a new system role.
    
    Args:
        role_data: Role data
        db: Database session
        
    Returns:
        Newly created role
        
    Example:
        >>> role = await create_system_role(
        ...     SystemRoleCreate(
        ...         title="Custom Verifier",
        ...         content="You verify facts...",
        ...         category="verify"
        ...     )
        ... )
        >>> role.category
        'verify'
    """
    now = datetime.now(UTC)
    
    role = SystemRole(
        title=role_data.title,
        content=role_data.content,
        category=role_data.category,
        is_default=role_data.is_default,
        created_at=now,
        updated_at=now
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


@router.get("/settings/roles/{role_id}", response_model=SystemRoleResponse)
async def get_system_role(
    role_id: str,
    db: AsyncSession = Depends(get_db)
) -> SystemRole:
    """Get a single system role.
    
    Args:
        role_id: Role UUID
        db: Database session
        
    Returns:
        System role
        
    Raises:
        HTTPException: 404 if role not found
        
    Example:
        >>> role = await get_system_role("abc-123")
        >>> role.title
        'Fact-Checker'
    """
    result = await db.execute(select(SystemRole).where(SystemRole.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"System role with id {role_id} not found"
        )
    
    return role


@router.patch("/settings/roles/{role_id}", response_model=SystemRoleResponse)
async def update_system_role(
    role_id: str,
    role_data: SystemRoleUpdate,
    db: AsyncSession = Depends(get_db)
) -> SystemRole:
    """Update a system role.
    
    Args:
        role_id: Role UUID
        role_data: Update data
        db: Database session
        
    Returns:
        Updated role
        
    Raises:
        HTTPException: 404 if role not found
        
    Example:
        >>> role = await update_system_role(
        ...     "abc-123",
        ...     SystemRoleUpdate(title="Updated Title")
        ... )
        >>> role.title
        'Updated Title'
    """
    result = await db.execute(select(SystemRole).where(SystemRole.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"System role with id {role_id} not found"
        )
    
    # Update fields
    update_data = role_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)
    
    role.updated_at = datetime.now(UTC)
    
    await db.commit()
    await db.refresh(role)
    return role


@router.delete("/settings/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system_role(
    role_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a system role.
    
    Args:
        role_id: Role UUID
        db: Database session
        
    Raises:
        HTTPException: 404 if role not found
        
    Example:
        >>> await delete_system_role("abc-123")
        # Role deleted
    """
    result = await db.execute(select(SystemRole).where(SystemRole.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"System role with id {role_id} not found"
        )
    
    await db.delete(role)
    await db.commit()


# --- Tool Use Settings ---

@router.get("/settings/tool-use", response_model=ToolUseSettingsResponse)
async def get_tool_use_settings(
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Get tool use settings.
    
    Args:
        db: Database session
        
    Returns:
        Tool use settings with enabled tools and auto-confirm
        
    Example:
        >>> settings = await get_tool_use_settings()
        >>> settings["auto_confirm"]
        False
    """
    # Get settings from database
    result = await db.execute(select(Setting).where(Setting.key == "tool_use_settings"))
    setting = result.scalar_one_or_none()
    
    if not setting:
        # Return defaults (all tools enabled, no auto-confirm)
        return {
            "enabled_tools": {
                "web_search": True,
                "create_draft": True,
                "update_status": True,
                "create_library_item": True,
            },
            "auto_confirm": False
        }
    
    return setting.value


@router.patch("/settings/tool-use", response_model=ToolUseSettingsResponse)
async def update_tool_use_settings(
    settings_data: ToolUseSettingsUpdate,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Update tool use settings.
    
    Args:
        settings_data: Settings to update
        db: Database session
        
    Returns:
        Updated settings
        
    Example:
        >>> settings = await update_tool_use_settings(
        ...     ToolUseSettingsUpdate(auto_confirm=True)
        ... )
        >>> settings["auto_confirm"]
        True
    """
    # Get current settings
    result = await db.execute(select(Setting).where(Setting.key == "tool_use_settings"))
    setting = result.scalar_one_or_none()
    
    if not setting:
        # Create new settings with defaults
        current = {
            "enabled_tools": {
                "web_search": True,
                "create_draft": True,
                "update_status": True,
                "create_library_item": True,
            },
            "auto_confirm": False
        }
    else:
        current = setting.value
    
    # Update with new values
    update_data = settings_data.model_dump(exclude_unset=True)
    
    if "enabled_tools" in update_data:
        current["enabled_tools"].update(update_data["enabled_tools"])
    
    if "auto_confirm" in update_data:
        current["auto_confirm"] = update_data["auto_confirm"]
    
    if setting:
        setting.value = current
        setting.updated_at = datetime.now(UTC)
        # Mark value as modified for SQLAlchemy
        attributes.flag_modified(setting, "value")
    else:
        setting = Setting(
            key="tool_use_settings",
            value=current,
            updated_at=datetime.now(UTC)
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    
    return setting.value


# --- System Prompts Management ---

@router.get("/settings/system-prompts", response_model=SystemPromptsListResponse)
async def get_system_prompts(
    db: AsyncSession = Depends(get_db)
) -> SystemPromptsListResponse:
    """Get all manageable system prompts (summary, verify, audit).
    
    Returns the current content and metadata for each prompt type.
    These are global prompts used across the application.
    
    Args:
        db: Database session
        
    Returns:
        List of system prompts with type, content, default status, timestamp
        
    Example:
        >>> prompts = await get_system_prompts()
        >>> len(prompts.prompts)
        3
        >>> prompts.prompts[0].type
        'summary'
    """
    prompt_types = ["summary", "verify", "audit"]
    prompts = []
    
    for prompt_type in prompt_types:
        # Get current prompt
        result = await db.execute(
            select(Setting).where(Setting.key == f"system_prompt_{prompt_type}")
        )
        setting = result.scalar_one_or_none()
        
        # Get default prompt for comparison
        result = await db.execute(
            select(Setting).where(Setting.key == f"system_prompt_{prompt_type}_default")
        )
        default = result.scalar_one_or_none()
        
        if setting:
            content = setting.value.get("content", "")
            last_modified = setting.updated_at
            
            # Check if it matches the default
            is_default = False
            if default:
                default_content = default.value.get("content", "")
                is_default = (content == default_content)
            
            prompts.append(SystemPromptResponse(
                type=prompt_type,
                content=content,
                is_default=is_default,
                last_modified=last_modified
            ))
        elif default:
            # Fallback to default if active not found
            content = default.value.get("content", "")
            prompts.append(SystemPromptResponse(
                type=prompt_type,
                content=content,
                is_default=True,
                last_modified=default.updated_at
            ))
    
    return SystemPromptsListResponse(prompts=prompts)


@router.put("/settings/system-prompts/{prompt_type}", response_model=SystemPromptResponse)
async def update_system_prompt(
    prompt_type: str,
    prompt_data: SystemPromptUpdate,
    db: AsyncSession = Depends(get_db)
) -> SystemPromptResponse:
    """Update a system prompt.
    
    Updates the content of a specific system prompt (summary, verify, audit).
    
    Args:
        prompt_type: Type of prompt to update (summary, verify, audit)
        prompt_data: New prompt content
        db: Database session
        
    Returns:
        Updated system prompt
        
    Raises:
        HTTPException: If prompt_type is invalid
        
    Example:
        >>> prompt = await update_system_prompt(
        ...     "summary",
        ...     SystemPromptUpdate(content="New summary prompt...")
        ... )
        >>> prompt.type
        'summary'
    """
    # Validate prompt type
    valid_types = ["summary", "verify", "audit"]
    if prompt_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid prompt type. Must be one of: {', '.join(valid_types)}"
        )
    
    setting_key = f"system_prompt_{prompt_type}"
    
    # Get or create setting
    result = await db.execute(
        select(Setting).where(Setting.key == setting_key)
    )
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = {"content": prompt_data.content}
        setting.updated_at = datetime.now(UTC)
        attributes.flag_modified(setting, "value")
    else:
        setting = Setting(
            key=setting_key,
            value={"content": prompt_data.content},
            updated_at=datetime.now(UTC)
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    
    # Check if it's the default
    result = await db.execute(
        select(Setting).where(Setting.key == f"{setting_key}_default")
    )
    default = result.scalar_one_or_none()
    
    is_default = False
    if default:
        default_content = default.value.get("content", "")
        is_default = (prompt_data.content == default_content)
    
    return SystemPromptResponse(
        type=prompt_type,
        content=prompt_data.content,
        is_default=is_default,
        last_modified=setting.updated_at
    )


@router.post("/settings/system-prompts/{prompt_type}/reset", response_model=SystemPromptResponse)
async def reset_system_prompt(
    prompt_type: str,
    db: AsyncSession = Depends(get_db)
) -> SystemPromptResponse:
    """Reset a system prompt to its factory default.
    
    Restores the prompt to the immutable default stored in the database.
    
    Args:
        prompt_type: Type of prompt to reset (summary, verify, audit)
        db: Database session
        
    Returns:
        Reset system prompt
        
    Raises:
        HTTPException: If prompt_type is invalid or default not found
        
    Example:
        >>> prompt = await reset_system_prompt("summary")
        >>> prompt.is_default
        True
    """
    # Validate prompt type
    valid_types = ["summary", "verify", "audit"]
    if prompt_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid prompt type. Must be one of: {', '.join(valid_types)}"
        )
    
    # Get default prompt
    result = await db.execute(
        select(Setting).where(Setting.key == f"system_prompt_{prompt_type}_default")
    )
    default = result.scalar_one_or_none()
    
    if not default:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Default prompt for {prompt_type} not found"
        )
    
    default_content = default.value.get("content", "")
    
    # Update or create active setting with default content
    setting_key = f"system_prompt_{prompt_type}"
    result = await db.execute(
        select(Setting).where(Setting.key == setting_key)
    )
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = {"content": default_content}
        setting.updated_at = datetime.now(UTC)
        attributes.flag_modified(setting, "value")
    else:
        setting = Setting(
            key=setting_key,
            value={"content": default_content},
            updated_at=datetime.now(UTC)
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    
    return SystemPromptResponse(
        type=prompt_type,
        content=default_content,
        is_default=True,
        last_modified=setting.updated_at
    )


@router.post("/settings/system-prompts/reset-all", response_model=SystemPromptsListResponse)
async def reset_all_system_prompts(
    db: AsyncSession = Depends(get_db)
) -> SystemPromptsListResponse:
    """Reset all system prompts to their factory defaults.
    
    Restores all prompts (summary, verify, audit) to immutable defaults.
    
    Args:
        db: Database session
        
    Returns:
        List of all reset system prompts
        
    Example:
        >>> prompts = await reset_all_system_prompts()
        >>> all(p.is_default for p in prompts.prompts)
        True
    """
    prompt_types = ["summary", "verify", "audit"]
    prompts = []
    
    for prompt_type in prompt_types:
        # Reset each prompt
        try:
            reset_prompt = await reset_system_prompt(prompt_type, db)
            prompts.append(reset_prompt)
        except HTTPException:
            # Skip if default not found, but continue with others
            continue
    
    return SystemPromptsListResponse(prompts=prompts)

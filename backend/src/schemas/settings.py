"""Pydantic schemas for Settings endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class AppSettingsResponse(BaseModel):
    """Schema for app settings responses.
    
    Attributes:
        font_size: Font size (12-20)
        animations_enabled: Whether animations are enabled
        summary_trigger_mode: How summaries are triggered (automatic, manual, disabled)
        summary_keep_message_pairs: Number of message pairs to keep active after summary (default 5)
        model_ids_hidden: List of model IDs to hide from chat model selection
        summary_model_mode: 'current' = use chat model, 'fixed' = use summary_model_id
        summary_model_id: Model ID for summaries when summary_model_mode is 'fixed'
    """
    
    font_size: int = Field(default=14, ge=12, le=20)
    animations_enabled: bool = Field(default=True)
    summary_trigger_mode: str = Field(default="manual")
    summary_keep_message_pairs: int = Field(default=5, ge=1, le=20)
    model_ids_hidden: list[str] = Field(default_factory=list)
    summary_model_mode: str = Field(default="current")
    summary_model_id: str | None = Field(default=None)
    search_past_sessions_scope: str = Field(default="cross_project")  # cross_project | project_only | session_only
    
    model_config = {"from_attributes": True}


class AppSettingsUpdate(BaseModel):
    """Schema for updating app settings.
    
    Attributes:
        font_size: Font size (12-20)
        animations_enabled: Whether animations are enabled
        summary_trigger_mode: How summaries are triggered
        summary_keep_message_pairs: Number of message pairs to keep after summary
        model_ids_hidden: List of model IDs to hide from selection
        summary_model_mode: 'current' or 'fixed'
        summary_model_id: Model for summaries when mode is 'fixed'
    """
    
    font_size: int | None = Field(None, ge=12, le=20)
    animations_enabled: bool | None = None
    summary_trigger_mode: str | None = None
    summary_keep_message_pairs: int | None = Field(None, ge=1, le=20)
    model_ids_hidden: list[str] | None = None
    summary_model_mode: str | None = None
    summary_model_id: str | None = None
    search_past_sessions_scope: str | None = None


class SystemPromptModuleResponse(BaseModel):
    """Schema for system prompt module responses.
    
    Attributes:
        key: Module key (e.g., 'base', 'expertise', 'context_handling')
        content: Current prompt content
        is_default: Whether using default content
        last_modified: Last modification timestamp
    """
    
    key: str
    content: str
    is_default: bool
    last_modified: datetime
    
    model_config = {"from_attributes": True}


class SystemPromptModuleUpdate(BaseModel):
    """Schema for updating a system prompt module.
    
    Attributes:
        content: New prompt content
    """
    
    content: str = Field(..., min_length=1)


class SystemRoleResponse(BaseModel):
    """Schema for system role responses.
    
    Attributes:
        id: Unique role identifier
        title: Role title
        content: Role prompt content
        category: Role category (chat, audit, verify)
        is_default: Whether this is a default role
        created_at: Creation timestamp
        updated_at: Last modification timestamp
    """
    
    id: str
    title: str
    content: str
    category: str
    is_default: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class SystemRoleCreate(BaseModel):
    """Schema for creating a system role.
    
    Attributes:
        title: Role title
        content: Role prompt content
        category: Role category (chat, audit, verify)
        is_default: Whether this is a default role
    """
    
    title: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1)
    category: str = Field(default="chat")
    is_default: bool = Field(default=False)


class SystemRoleUpdate(BaseModel):
    """Schema for updating a system role.
    
    Attributes:
        title: New title
        content: New content
        category: New category
        is_default: Whether this is a default role
    """
    
    title: str | None = Field(None, min_length=1, max_length=100)
    content: str | None = Field(None, min_length=1)
    category: str | None = None
    is_default: bool | None = None


class ToolUseSettingsResponse(BaseModel):
    """Schema for tool use settings responses.
    
    Attributes:
        enabled_tools: Dictionary of tool name -> enabled status
        auto_confirm: Whether tools are auto-confirmed
    """
    
    enabled_tools: dict[str, bool]
    auto_confirm: bool
    
    model_config = {"from_attributes": True}


class ToolUseSettingsUpdate(BaseModel):
    """Schema for updating tool use settings.
    
    Attributes:
        enabled_tools: Dictionary of tool name -> enabled status
        auto_confirm: Whether tools are auto-confirmed
    """
    
    enabled_tools: dict[str, bool] | None = None
    auto_confirm: bool | None = None


class SystemPromptResponse(BaseModel):
    """Schema for a single system prompt response.
    
    Attributes:
        type: Prompt type (summary, verify, audit)
        content: Current prompt content
        is_default: Whether using default content (not modified)
        last_modified: Last modification timestamp
    """
    
    type: str
    content: str
    is_default: bool
    last_modified: datetime
    
    model_config = {"from_attributes": True}


class SystemPromptUpdate(BaseModel):
    """Schema for updating a system prompt.
    
    Attributes:
        content: New prompt content
    """
    
    content: str = Field(..., min_length=1)


class SystemPromptsListResponse(BaseModel):
    """Schema for listing all manageable system prompts.
    
    Attributes:
        prompts: List of system prompts (summary, verify, audit)
    """
    
    prompts: list[SystemPromptResponse]

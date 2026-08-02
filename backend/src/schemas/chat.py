"""Pydantic schemas for Chat endpoints."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatContextDocument(BaseModel):
    """Document for context (from frontend)."""
    id: str
    title: str
    content: str


class ChatContextStatusTopic(BaseModel):
    """Status topic for context (from frontend)."""
    id: str
    title: str
    content: str


class ChatContext(BaseModel):
    """Frontend-provided context for chat.

    Not all fields are LLM authority:
    - system_prompt / implicit_context: taken from request (UI/editor)
    - documents / status_topics: ignored when backend loads Library/Status from DB
    """
    system_prompt: str = Field("", description="Combined system prompt from modules")
    documents: list[ChatContextDocument] = Field(
        default_factory=list,
        description="Legacy/optional; chat/send prefers DB library items",
    )
    status_topics: list[ChatContextStatusTopic] = Field(
        default_factory=list,
        description="Legacy/optional; chat/send prefers DB status for the project",
    )
    implicit_context: str | None = Field(None, description="Workshop draft content (for edit_draft tool)")


class ChatSendRequest(BaseModel):
    """Schema for sending a chat message.
    
    Attributes:
        session_id: Session UUID
        message: User message content
        model: Model to use (e.g., "gemini-3-pro-preview", "claude-sonnet-4-5")
        temperature: Sampling temperature (0-2)
        include_summaries: Optional list of session IDs for cross-session context
        use_tools: Whether to enable tool calling (default: True)
        context: Optional frontend-provided context (overrides DB)
    """
    
    session_id: str = Field(..., description="Session UUID")
    message: str = Field(..., min_length=1, description="User message")
    model: str = Field(default="gemini-3-flash-preview", description="Model identifier")
    temperature: float = Field(default=1.0, ge=0.0, le=2.0, description="Sampling temperature (1.0 recommended for Gemini 3)")
    include_summaries: list[str] | None = Field(None, description="Session IDs for cross-session context")
    use_tools: bool = Field(default=False, description="Enable tool calling (disabled for now)")
    context: ChatContext | None = Field(None, description="Frontend-provided context (overrides DB)")


class ToolCallInfo(BaseModel):
    """Information about a tool call.
    
    Attributes:
        tool_name: Name of the tool that was called
        arguments: Arguments passed to the tool
        result: Result from tool execution
        action: Optional action signal for frontend (e.g., "open_workshop")
    """
    tool_name: str
    arguments: dict[str, Any]
    result: dict[str, Any]
    action: str | None = None


class DraftData(BaseModel):
    """Draft data when create_draft tool was called.
    
    Attributes:
        title: Draft title
        content: Full draft content (Markdown supported)
        reason: Optional reason for creation
    """
    title: str
    content: str
    reason: str | None = None


class SingleEdit(BaseModel):
    """Single edit operation."""
    old_text: str
    new_text: str


class EditData(BaseModel):
    """Edit data when edit_draft tool was called.
    
    Contains a list of edits to apply as ONE new version.
    
    Attributes:
        edits: List of edits (old_text → new_text)
        edit_count: Number of edits
        reason: Optional reason for edits
    """
    edits: list[SingleEdit]
    edit_count: int
    reason: str | None = None


class ChatResponse(BaseModel):
    """Schema for chat response.
    
    Attributes:
        content: AI response content
        model: Model that generated the response
        usage: Token usage statistics
        cache_info: Optional cache information for cost tracking
        user_message_id: ID of the user message in database (optional for non-chat endpoints)
        ai_message_id: ID of the AI message in database (optional for non-chat endpoints)
        tool_calls: List of tool calls made during response generation
        draft_data: Draft data if create_draft tool was called
        edit_data_list: List of edits if edit_draft was called (can be multiple)
    """
    
    content: str
    model: str
    usage: dict[str, int]
    cache_info: dict[str, Any] | None = None  # Optional cache info
    user_message_id: str | None = None
    ai_message_id: str | None = None
    tool_calls: list[ToolCallInfo] | None = None  # Tool calls made
    turn_summary: str | None = None  # Ground-truth turn summary (Tool-Log only)
    turn_ok: bool | None = None  # False when tools failed or claim guard fired
    draft_data: DraftData | None = None  # Draft data if create_draft was called
    edit_data_list: list[EditData] | None = None  # List of edits if edit_draft was called


class ChatAuditRequest(BaseModel):
    """Schema for auditing a draft.
    
    Attributes:
        session_id: Session UUID
        draft_content: Draft text to audit
        draft_version: Draft version number (for display in Chat B)
        model: Model to use for audit
        include_summaries: Optional list of session IDs for context
    """
    
    session_id: str = Field(..., description="Session UUID")
    draft_content: str = Field(..., min_length=1, description="Draft to audit")
    draft_version: int = Field(default=1, description="Draft version number")
    model: str = Field(default="claude-sonnet-4-5", description="Model identifier")
    include_summaries: list[str] | None = Field(None, description="Session IDs for context")


class ChatVerifyRequest(BaseModel):
    """Schema for verifying an answer.
    
    Attributes:
        session_id: Session UUID
        answer_to_verify: The answer to verify
        model: Model to use (should be different from original)
        include_summaries: Optional list of session IDs for context
    """
    
    session_id: str = Field(..., description="Session UUID")
    answer_to_verify: str = Field(..., min_length=1, description="Answer to verify")
    model: str = Field(default="claude-sonnet-4-5", description="Model identifier")
    include_summaries: list[str] | None = Field(None, description="Session IDs for context")


class ChatBHistoryMessage(BaseModel):
    """Single message in Chat B's ephemeral history (sent from frontend)."""
    role: str  # 'user' or 'assistant'
    content: str


class ChatBSendRequest(BaseModel):
    """Schema for sending a message in Chat B (Reviewer/Auditor).

    Context is sent from frontend (decoupled copy of Chat A context).
    Messages are ephemeral – no DB persistence for Chat B history.
    No tools available in Chat B.
    """

    session_id: str = Field(..., description="Session UUID (for Chat A history + user facts)")
    message: str = Field(..., min_length=1, description="User question/prompt")
    model: str = Field(default="claude-sonnet-4-5", description="Model identifier")
    mode: Literal["verify", "audit"] = Field(..., description="verify=chat review, audit=draft review")
    documents: list[ChatContextDocument] = Field(
        default_factory=list, description="Chat B's own document copy (decoupled from Chat A)"
    )
    status_topics: list[ChatContextStatusTopic] = Field(
        default_factory=list, description="Chat B's own status copy (decoupled from Chat A)"
    )
    workshop_content: str | None = Field(None, description="Draft/workshop content (audit mode)")
    answer_to_verify: str | None = Field(None, description="Last Chat A answer to review (verify mode)")
    chat_b_history: list[ChatBHistoryMessage] = Field(
        default_factory=list, description="Ephemeral Chat B history (user/assistant only)"
    )
    summaries: list[str] = Field(default_factory=list, description="Session IDs for cross-session summaries")


class ChatSummaryRequest(BaseModel):
    """Schema for generating a session summary.
    
    Attributes:
        session_id: Session UUID
        model: Model to use for summary generation
        max_tokens: Maximum tokens for summary
        active_message_ids: Optional list of message IDs to include (for filtering archived)
    """
    
    session_id: str = Field(..., description="Session UUID")
    model: str = Field(default="gemini-3-flash-preview", description="Model identifier")
    max_tokens: int | None = Field(None, ge=100, le=4000, description="Max summary length")
    active_message_ids: list[str] | None = Field(None, description="Message IDs to include (filters out archived)")

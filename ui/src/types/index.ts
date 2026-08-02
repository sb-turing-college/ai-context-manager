// Core Types
export type View = 'dashboard' | 'workspace'
export type LeftTab = 'sessions' | 'context'
export type StatusTopic = string | null
export type SessionId = string // Changed to string for dynamic session IDs (e.g., audit sessions)
export type LibraryItemType = 'text' | 'markdown' | 'pdf'
export type ArtifactMode = 'draft' | 'summary'
export type SettingsTab = 'app' | 'intelligence' | 'systemprompts' | 'costs'
export type ExportTarget = 'project' | 'file'
export type ImportTab = 'file' | 'project'
export type SummaryStatus = 'none' | 'stale' | 'fresh' // Traffic Light System

/**
 * Summary trigger mode - Controls how automatic summaries are handled
 * - automatic: Execute summary when token threshold reached (with brief UI hint)
 * - manual: Show hint + require manual confirmation (default)
 * - disabled: No automatic summary suggestions
 */
export type SummaryTriggerMode = 'automatic' | 'manual' | 'disabled'

// Data Structures
export interface Project {
  id: string
  title: string
  sessionCount: number
  lastModified: string
}

export interface LibraryFolder {
  id: string
  name: string
  projectId: string
  parentId: string | null
}

export interface LibraryItem {
  id: string
  title: string
  timestamp: string
  content: string
  version: number
  type: LibraryItemType
  projectId: string
  folderId: string | null
  history?: { version: number, timestamp: string, content: string }[]
  isAudited?: boolean // Marks item as frozen after audit
}

export interface Session {
  id: SessionId
  title: string
  messageCount: number
  active: boolean
  projectId: string // Sessions belong to a project
  summaryStatus?: 'none' | 'outdated' | 'current' // 🔴🟡🟢 Ampel
  /** Other session IDs whose summaries are attached as cross-session context */
  attachedSummaryIds?: SessionId[]
  summary?: {
    content: string
    timestamp: string
    messageCountAtCreation: number // To detect staleness
  }
}

// ============================================================================
// TOOL-USE TYPES (Phase 7)
// ============================================================================

/**
 * Available tools for AI to use
 * - Status tools: CRUD operations on status topics
 * - Document tools: Read-only access to library
 * - Workshop tools: Draft creation
 */
export type ToolName =
  | 'create_status'
  | 'read_status'
  | 'update_status'
  | 'delete_status'
  | 'search_documents'
  | 'read_document'
  | 'create_draft'

/**
 * A single tool call made by the AI
 */
export interface ToolCall {
  id: string
  tool: ToolName
  params: Record<string, unknown>
  timestamp: string
}

/**
 * Result of a tool call, displayed in chat
 */
export interface ToolCallResult {
  toolCall: ToolCall
  success: boolean
  result?: unknown
  error?: string
  reason?: string // AI's explanation for why this tool was called
  // For status updates: track changes
  previousValue?: unknown
  newValue?: unknown
  // Version history for this specific topic
  history?: ToolCallHistoryEntry[]
  isExpanded: boolean
}

/**
 * History entry for tool call versioning
 */
export interface ToolCallHistoryEntry {
  version: number
  timestamp: string
  previousValue: unknown
  newValue: unknown
  reason?: string
}

/**
 * Auto-check mode for tool use
 * - always: Check status on every message
 * - on_request: Only when user explicitly asks
 * - ai_decides: AI determines when to check (default)
 */
export type ToolAutoCheckMode = 'always' | 'on_request' | 'ai_decides'

/**
 * Settings for tool use behavior
 */
export interface ToolUseSettings {
  autoCheckMode: ToolAutoCheckMode
  enabledTools: {
    create_status: boolean
    read_status: boolean
    update_status: boolean
    delete_status: boolean
    search_documents: boolean
    read_document: boolean
    create_draft: boolean
  }
}

/**
 * System prompt module IDs
 */
export type SystemPromptModuleId = 'general_rules' | 'tool_use' | 'role'

/**
 * A single module in the system prompt
 */
export interface SystemPromptModule {
  id: SystemPromptModuleId
  title: string
  content: string
  defaultContent: string // For reset functionality
  isExpanded: boolean
  isDefault?: boolean // From backend: true if content matches default
}

// ============================================================================
// VERSION HISTORY (Generic, reusable)
// ============================================================================

/**
 * Generic version entry for any versionable content
 */
export interface VersionEntry<T = string> {
  version: number
  content: T
  timestamp?: string
}

export interface ChatMessage {
  id: string // Added ID for selection/tags
  role: 'user' | 'ai' | 'feedback' | 'tool' | 'archive' | 'summary' | 'verify' | 'draft' // draft = draft block (in Chat B)
  content: string
  // Metadata
  timestamp: string
  model?: string // e.g. 'sonnet-4.5'
  isEdited?: boolean
  /** Token usage from API (AI messages only), shown in tags/metadata */
  inputTokens?: number
  outputTokens?: number
  // Only for role='feedback': Embedded FeedbackBlock data
  feedbackData?: {
    feedbackNumber: number
    messages: ChatMessage[] // The actual Chat B messages
    isExpanded: boolean
  }
  // Only for role='archive': Archived messages (not sent to AI)
  archiveData?: {
    messages: ChatMessage[] // The archived messages
    isExpanded: boolean
  }
  // Only for role='summary': Session summary data
  summaryData?: {
    isExpanded: boolean
    model?: string
    createdAt?: string
    inputTokens?: number
    outputTokens?: number
  }
  // Only for role='verify': Verify request block data (in Chat B)
  verifyData?: {
    answerToVerify: string // The answer being verified
    isExpanded: boolean
  }
  // Only for role='draft': Draft block data (in Chat B)
  draftData?: {
    draftVersion: number
    isExpanded: boolean
  }
  // Only for role='tool': Tool call data (first call, for inline display)
  toolCallData?: ToolCallResult
  /** All tool calls from this message (for Tool-Log drawer) */
  toolCalls?: Array<{ tool: string; params: Record<string, unknown>; result: unknown; success: boolean }>
  /** Ground-truth turn summary (Tool-Log only, not chat prose) */
  turnSummary?: string
  /** Explicit turn outcome from backend (false = red in Tool-Log) */
  turnOk?: boolean
}

export interface ItemActionSuccess {
  itemId: string
  action: 'export' | 'remove'
}

// Note: FeedbackBlock and ArchiveBlock data are embedded in ChatMessage
// This allows them to maintain fixed position in chat history
// Archive messages (role='archive') are UI-only and never sent to AI backend

export type SystemRoleCategory = 'chat' | 'audit' | 'verify'

/**
 * Chat B Mode
 * - audit: Draft review with sparse context (documents + draft only)
 * - verify: Answer verification with full context (everything Chat A has)
 */
export type ChatBMode = 'audit' | 'verify'

export interface SystemRole {
  id: string
  title: string
  content: string
  category: SystemRoleCategory
  isDefault: boolean
  lastModified: string
}

/** One audit entry on a status topic (previous state + metadata). */
export interface StatusHistoryEntry {
  content: string
  reason: string
  timestamp: string
  source?: string
  session_id?: string
  session_title?: string
  previous_title?: string
  new_title?: string
}

export interface StatusTopicItem {
  id: string
  title: string
  content: string
  projectId: string
  order: number
  /** Project-wide change audit (from API); optional for legacy/local mocks. */
  history?: StatusHistoryEntry[]
}

export type UserFactCategory = 'style' | 'expertise' | 'preference' | 'context'

export interface UserFactItem {
  id: string
  category: UserFactCategory
  title: string
  content: string
  order: number
  history: { content: string; timestamp: string; reason: string }[]
}

/**
 * Send State Machine
 * 
 * Single source of truth for async operations (chat, summary, draft).
 * Replaces multiple boolean flags with explicit state transitions.
 * 
 * Flow:
 * idle → sending → idle (success) OR error
 * error → idle (user dismisses or retries)
 */
export type SendState = 
  | { status: 'idle' }
  | { status: 'sending'; content: string; optimisticId: string }
  | { status: 'error'; content: string; errorMessage?: string }

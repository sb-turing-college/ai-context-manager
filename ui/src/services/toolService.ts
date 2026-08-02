/**
 * Tool Service - Abstraction Layer for AI Tool Operations
 * 
 * This service handles tool calls from the AI assistant.
 * Currently: Mock implementation for UI demonstration
 * Future: Will proxy to REST API for actual tool execution
 * 
 * Tools available:
 * - Status: create, read, update, delete (CRUD)
 * - Documents: search, read (Read-only)
 */

import type {
  ToolName,
  ToolCall,
  ToolCallResult,
  ToolCallHistoryEntry,
  StatusTopicItem,
  LibraryItem
} from '../types'

// --- Types for Tool Parameters ---

interface CreateStatusParams {
  title: string
  content: string
}

interface ReadStatusParams {
  title: string
}

interface UpdateStatusParams {
  title: string
  newContent: string
  reason?: string
}

interface DeleteStatusParams {
  title: string
}

interface SearchDocumentsParams {
  query: string
}

interface ReadDocumentParams {
  title: string
}

interface CreateDraftParams {
  title: string
  content: string
  reason?: string
}

// --- Mock Data Store (simulates backend state) ---

// In-memory history for status topics (would be in DB in real backend)
const statusHistory: Map<string, ToolCallHistoryEntry[]> = new Map()

// --- Tool Execution ---

/**
 * Execute a tool call and return the result
 * This is the main entry point for the AI to call tools
 */
export async function executeToolCall(
  call: ToolCall,
  // Dependencies injected for testability
  deps: {
    getStatusTopics: () => StatusTopicItem[]
    setStatusTopics: (topics: StatusTopicItem[]) => void
    getLibraryItems: () => LibraryItem[]
    projectId: string
  }
): Promise<ToolCallResult> {
  const { tool, params } = call

  try {
    switch (tool) {
      case 'create_status':
        return await executeCreateStatus(call, params as unknown as CreateStatusParams, deps)
      case 'read_status':
        return await executeReadStatus(call, params as unknown as ReadStatusParams, deps)
      case 'update_status':
        return await executeUpdateStatus(call, params as unknown as UpdateStatusParams, deps)
      case 'delete_status':
        return await executeDeleteStatus(call, params as unknown as DeleteStatusParams, deps)
      case 'search_documents':
        return await executeSearchDocuments(call, params as unknown as SearchDocumentsParams, deps)
      case 'read_document':
        return await executeReadDocument(call, params as unknown as ReadDocumentParams, deps)
      case 'create_draft':
        return await executeCreateDraft(call, params as unknown as CreateDraftParams)
      default:
        return createErrorResult(call, `Unknown tool: ${tool}`)
    }
  } catch (error) {
    return createErrorResult(
      call,
      error instanceof Error ? error.message : 'Unknown error occurred'
    )
  }
}

// --- Status Tool Implementations ---

async function executeCreateStatus(
  call: ToolCall,
  params: CreateStatusParams,
  deps: { getStatusTopics: () => StatusTopicItem[]; setStatusTopics: (t: StatusTopicItem[]) => void; projectId: string }
): Promise<ToolCallResult> {
  const { title, content } = params
  const topics = deps.getStatusTopics()

  // Check if topic already exists
  const existing = topics.find(t => t.title.toLowerCase() === title.toLowerCase())
  if (existing) {
    return createErrorResult(call, `Status topic "${title}" already exists.`)
  }

  // Create new topic
  const newTopic: StatusTopicItem = {
    id: `status-${Date.now()}`,
    title,
    content,
    projectId: deps.projectId,
    order: topics.length
  }

  deps.setStatusTopics([...topics, newTopic])

  // Initialize history
  const historyEntry: ToolCallHistoryEntry = {
    version: 1,
    timestamp: new Date().toISOString(),
    previousValue: null,
    newValue: content,
    reason: call.params.reason as string | undefined
  }
  statusHistory.set(newTopic.id, [historyEntry])

  return {
    toolCall: call,
    success: true,
    result: { created: true, topicId: newTopic.id },
    reason: call.params.reason as string | undefined,
    previousValue: null,
    newValue: content,
    history: [historyEntry],
    isExpanded: false
  }
}

async function executeReadStatus(
  call: ToolCall,
  params: ReadStatusParams,
  deps: { getStatusTopics: () => StatusTopicItem[] }
): Promise<ToolCallResult> {
  const { title } = params
  const topics = deps.getStatusTopics()

  const topic = topics.find(t => t.title.toLowerCase() === title.toLowerCase())
  if (!topic) {
    return createErrorResult(call, `Status topic "${title}" not found.`)
  }

  return {
    toolCall: call,
    success: true,
    result: { title: topic.title, content: topic.content },
    reason: call.params.reason as string | undefined,
    newValue: topic.content,
    history: statusHistory.get(topic.id) || [],
    isExpanded: false
  }
}

async function executeUpdateStatus(
  call: ToolCall,
  params: UpdateStatusParams,
  deps: { getStatusTopics: () => StatusTopicItem[]; setStatusTopics: (t: StatusTopicItem[]) => void }
): Promise<ToolCallResult> {
  const { title, newContent, reason } = params
  const topics = deps.getStatusTopics()

  const topicIndex = topics.findIndex(t => t.title.toLowerCase() === title.toLowerCase())
  if (topicIndex === -1) {
    return createErrorResult(call, `Status topic "${title}" not found.`)
  }

  const topic = topics[topicIndex]
  const previousContent = topic.content

  // Update topic
  const updatedTopics = [...topics]
  updatedTopics[topicIndex] = { ...topic, content: newContent }
  deps.setStatusTopics(updatedTopics)

  // Add to history
  const history = statusHistory.get(topic.id) || []
  const historyEntry: ToolCallHistoryEntry = {
    version: history.length + 1,
    timestamp: new Date().toISOString(),
    previousValue: previousContent,
    newValue: newContent,
    reason
  }
  statusHistory.set(topic.id, [...history, historyEntry])

  return {
    toolCall: call,
    success: true,
    result: { updated: true },
    reason,
    previousValue: previousContent,
    newValue: newContent,
    history: statusHistory.get(topic.id) || [],
    isExpanded: false
  }
}

async function executeDeleteStatus(
  call: ToolCall,
  params: DeleteStatusParams,
  deps: { getStatusTopics: () => StatusTopicItem[]; setStatusTopics: (t: StatusTopicItem[]) => void }
): Promise<ToolCallResult> {
  const { title } = params
  const topics = deps.getStatusTopics()

  const topic = topics.find(t => t.title.toLowerCase() === title.toLowerCase())
  if (!topic) {
    return createErrorResult(call, `Status topic "${title}" not found.`)
  }

  const previousContent = topic.content

  // Delete topic
  const updatedTopics = topics.filter(t => t.id !== topic.id)
  deps.setStatusTopics(updatedTopics)

  // Clear history
  statusHistory.delete(topic.id)

  return {
    toolCall: call,
    success: true,
    result: { deleted: true },
    reason: call.params.reason as string | undefined,
    previousValue: previousContent,
    newValue: null,
    history: [],
    isExpanded: false
  }
}

// --- Workshop Tool Implementations ---

async function executeCreateDraft(
  call: ToolCall,
  params: CreateDraftParams
): Promise<ToolCallResult> {
  const { title, content, reason } = params

  // Mock implementation: In real backend, this would create a draft in the workshop
  // For now, just return success (UI will handle the actual draft creation)
  
  return {
    toolCall: call,
    success: true,
    result: {
      created: true,
      title,
      contentLength: content.length
    },
    reason,
    newValue: content,
    isExpanded: false
  }
}

// --- Document Tool Implementations ---

async function executeSearchDocuments(
  call: ToolCall,
  params: SearchDocumentsParams,
  deps: { getLibraryItems: () => LibraryItem[] }
): Promise<ToolCallResult> {
  const { query } = params
  const items = deps.getLibraryItems()

  // Simple search: title or content contains query (case-insensitive)
  const queryLower = query.toLowerCase()
  const matches = items.filter(
    item =>
      item.title.toLowerCase().includes(queryLower) ||
      item.content.toLowerCase().includes(queryLower)
  )

  return {
    toolCall: call,
    success: true,
    result: {
      query,
      matches: matches.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        preview: item.content.substring(0, 100) + (item.content.length > 100 ? '...' : '')
      })),
      totalResults: matches.length
    },
    reason: call.params.reason as string | undefined,
    isExpanded: false
  }
}

async function executeReadDocument(
  call: ToolCall,
  params: ReadDocumentParams,
  deps: { getLibraryItems: () => LibraryItem[] }
): Promise<ToolCallResult> {
  const { title } = params
  const items = deps.getLibraryItems()

  const item = items.find(i => i.title.toLowerCase() === title.toLowerCase())
  if (!item) {
    return createErrorResult(call, `Document "${title}" not found.`)
  }

  return {
    toolCall: call,
    success: true,
    result: {
      id: item.id,
      title: item.title,
      type: item.type,
      content: item.content,
      version: item.version
    },
    reason: call.params.reason as string | undefined,
    newValue: item.content,
    isExpanded: false
  }
}

// --- Helper Functions ---

function createErrorResult(call: ToolCall, error: string): ToolCallResult {
  return {
    toolCall: call,
    success: false,
    error,
    isExpanded: true // Show errors expanded by default
  }
}

// --- Tool Metadata (for UI and prompt generation) ---

export interface ToolDefinition {
  name: ToolName
  displayName: string
  description: string
  icon: string
  category: 'status' | 'documents' | 'workshop'
  parameters: {
    name: string
    type: 'string' | 'number' | 'boolean'
    required: boolean
    description: string
  }[]
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'create_status',
    displayName: 'Create status',
    description: 'Creates a new status topic',
    icon: '➕',
    category: 'status',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Topic title' },
      { name: 'content', type: 'string', required: true, description: 'Initial content' }
    ]
  },
  {
    name: 'read_status',
    displayName: 'Read status',
    description: 'Reads the current value of a status topic',
    icon: '📖',
    category: 'status',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Topic title' }
    ]
  },
  {
    name: 'update_status',
    displayName: 'Update status',
    description: 'Updates the value of a status topic',
    icon: '📝',
    category: 'status',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Topic title' },
      { name: 'newContent', type: 'string', required: true, description: 'New content' },
      { name: 'reason', type: 'string', required: false, description: 'Reason for the change' }
    ]
  },
  {
    name: 'delete_status',
    displayName: 'Delete status',
    description: 'Deletes a status topic',
    icon: '🗑️',
    category: 'status',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Topic title' }
    ]
  },
  {
    name: 'search_documents',
    displayName: 'Search documents',
    description: 'Searches the library for relevant documents',
    icon: '🔍',
    category: 'documents',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search query' }
    ]
  },
  {
    name: 'read_document',
    displayName: 'Read document',
    description: 'Reads the full content of a document',
    icon: '📄',
    category: 'documents',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Document title' }
    ]
  },
  {
    name: 'create_draft',
    displayName: 'Create draft',
    description: 'Creates a new draft in the workshop',
    icon: '✏️',
    category: 'workshop',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Draft title' },
      { name: 'content', type: 'string', required: true, description: 'Full draft content' },
      { name: 'reason', type: 'string', required: false, description: 'Reason for creation' }
    ]
  }
]

/**
 * Get tool definitions for enabled tools only
 * Used to generate tool descriptions for the AI prompt
 */
export function getEnabledToolDefinitions(
  enabledTools: Record<ToolName, boolean>
): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter(def => enabledTools[def.name])
}

/**
 * Generate tool use instructions for system prompt
 * This text is injected into the "Tool-Nutzung" module
 */
export function generateToolUsePromptSection(
  enabledTools: Record<ToolName, boolean>
): string {
  const enabled = getEnabledToolDefinitions(enabledTools)
  
  if (enabled.length === 0) {
    return 'No tools enabled.'
  }

  const statusTools = enabled.filter(t => t.category === 'status')
  const docTools = enabled.filter(t => t.category === 'documents')
  const workshopTools = enabled.filter(t => t.category === 'workshop')

  let prompt = 'You have access to the following tools:\n\n'

  if (statusTools.length > 0) {
    prompt += '**Status tools (CRUD):**\n'
    statusTools.forEach(tool => {
      const params = tool.parameters.map(p => `${p.name}: ${p.type}`).join(', ')
      prompt += `- \`${tool.name}(${params})\`: ${tool.description}\n`
    })
    prompt += '\n'
  }

  if (docTools.length > 0) {
    prompt += '**Document tools (read-only):**\n'
    docTools.forEach(tool => {
      const params = tool.parameters.map(p => `${p.name}: ${p.type}`).join(', ')
      prompt += `- \`${tool.name}(${params})\`: ${tool.description}\n`
    })
    prompt += '\n'
  }

  if (workshopTools.length > 0) {
    prompt += '**Workshop tools:**\n'
    workshopTools.forEach(tool => {
      const params = tool.parameters.map(p => `${p.name}: ${p.type}`).join(', ')
      prompt += `- \`${tool.name}(${params})\`: ${tool.description}\n`
    })
    prompt += '\n'
  }

  prompt += '**Rules:**\n'
  prompt += '- Always provide a reason for status updates.\n'
  prompt += '- Keep status up to date when relevant information appears in chat.\n'
  prompt += '- Be transparent about tool calls.\n'

  return prompt
}

// --- History Management ---

/**
 * Get history for a specific status topic
 */
export function getStatusHistory(topicId: string): ToolCallHistoryEntry[] {
  return statusHistory.get(topicId) || []
}

/**
 * Clear all history (for testing/reset)
 */
export function clearAllHistory(): void {
  statusHistory.clear()
}

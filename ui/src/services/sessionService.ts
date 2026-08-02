/**
 * Session Service - Abstraction Layer for Session Management
 *
 * REST API is always enabled (portfolio path).
 */

import type { Session, ChatMessage, SessionId } from '../types'
import { STORAGE_KEYS } from './settingsService'
import { API_BASE, USE_API } from '../config/api'

const SESSIONS_KEY = STORAGE_KEYS.sessions
const CHATS_KEY = STORAGE_KEYS.chats

// --- Helper: Convert API response to frontend format ---
function convertApiSession(apiSession: any): Session {
  return {
    id: apiSession.id,
    title: apiSession.title,
    messageCount: apiSession.message_count,
    active: apiSession.active,
    projectId: apiSession.project_id,
    summaryStatus: apiSession.summary_status || 'none', // 🔴🟡🟢 Ampel
    attachedSummaryIds: Array.isArray(apiSession.attached_summary_ids)
      ? apiSession.attached_summary_ids
      : [],
    summary: undefined // Will be loaded separately if needed
  }
}

function convertApiMessage(apiMessage: any): ChatMessage {
  // Convert tool_call_data from backend format to frontend format
  let toolCallData = undefined
  let toolCalls: Array<{ tool: string; params: Record<string, unknown>; result: unknown; success: boolean }> | undefined
  let turnSummary: string | undefined
  let turnOk: boolean | undefined
  if (apiMessage.tool_call_data) {
    if (typeof apiMessage.tool_call_data.turn_summary === 'string') {
      turnSummary = apiMessage.tool_call_data.turn_summary
    }
    if (typeof apiMessage.tool_call_data.turn_ok === 'boolean') {
      turnOk = apiMessage.tool_call_data.turn_ok
    }
    if (apiMessage.tool_call_data.tool_calls) {
      const rawCalls = apiMessage.tool_call_data.tool_calls
      toolCalls = rawCalls.map((c: { tool_name: string; arguments?: Record<string, unknown>; result?: { success?: boolean } }) => ({
        tool: c.tool_name,
        params: c.arguments || {},
        result: c.result,
        success: c.result?.success ?? false
      }))
      if (rawCalls.length > 0) {
        const firstCall = rawCalls[0]
        toolCallData = {
          toolCall: {
            tool: firstCall.tool_name,
            params: firstCall.arguments || {}
          },
          success: firstCall.result?.success || false,
          result: firstCall.result,
          reason: firstCall.result?.reason || firstCall.arguments?.reason,
          previousValue: firstCall.result?.old_content,
          newValue: firstCall.result?.new_content || firstCall.result?.content,
          history: [],
          isExpanded: false
        }
      }
    }
  }
  
  // CRITICAL: Backend now returns created_at as ISO string (from Pydantic field_serializer)
  // created_at is the authoritative timestamp for sorting
  // timestamp is the human-readable display timestamp
  return {
    id: apiMessage.id,
    role: (apiMessage.role === 'assistant' ? 'ai' : apiMessage.role) as 'user' | 'ai' | 'feedback' | 'tool',
    content: apiMessage.content,
    timestamp: apiMessage.timestamp, // Human-readable timestamp for display
    model: apiMessage.model || undefined,
    toolCallData: toolCallData,
    toolCalls: toolCalls,
    turnSummary,
    turnOk,
    feedbackData: apiMessage.feedback_data || undefined,
    inputTokens: apiMessage.input_tokens ?? undefined,
    outputTokens: apiMessage.output_tokens ?? undefined,
    // Store created_at for accurate chronological sorting (ISO string from backend)
    created_at: apiMessage.created_at || undefined
  } as ChatMessage & { created_at?: string }
}

function convertFrontendMessage(message: ChatMessage): any {
  return {
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    model: message.model || null,
    tool_call_data: message.toolCallData || null,
    feedback_data: message.feedbackData || null
  }
}

// --- Service Functions ---

export async function getSessions(): Promise<Session[]> {
  if (USE_API) {
    // API mode not yet implemented - needs project context
    // Will be implemented when we add project switching to UI
    return getSessionsFromStorage()
  }
  
  return getSessionsFromStorage()
}

export async function getSessionsByProject(projectId: string): Promise<Session[]> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/sessions`)
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      const data = await response.json()
      return data.map(convertApiSession)
    } catch (error) {
      console.error('Failed to fetch sessions from API:', error)
      throw error  // Don't hide API errors
    }
  }
  
  return getSessionsFromStorage()
}

function getSessionsFromStorage(): Session[] {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const sessions = await getSessions()
  return sessions.find(s => s.id === sessionId) || null
}

export async function createSession(projectId: string, title: string): Promise<Session> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, title })
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      return convertApiSession(data)
    } catch (error) {
      console.error('Failed to create session via API:', error)
      throw error
    }
  }
  
  // localStorage fallback
  const newSession: Session = {
    id: `session-${Date.now()}`,
    title,
    messageCount: 0,
    active: false,
    projectId,
    attachedSummaryIds: [],
  }
  
  const sessions = await getSessions()
  const updated = [newSession, ...sessions]
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated))
  
  return newSession
}

/**
 * Duplicate a session with all its messages (API mode only).
 * Creates new session in backend and copies user/ai/feedback/tool messages.
 * Returns the new session. In non-API mode, throws (caller should use local logic).
 */
export async function duplicateSession(
  projectId: string,
  sourceTitle: string,
  sourceMessages: ChatMessage[]
): Promise<Session> {
  if (!USE_API) {
    throw new Error('duplicateSession requires API mode')
  }
  const newSession = await createSession(projectId, `${sourceTitle} (Kopie)`)
  const copyableRoles = new Set(['user', 'ai', 'feedback', 'tool'])
  for (const msg of sourceMessages) {
    if (copyableRoles.has(msg.role)) {
      await addChatMessage(newSession.id, msg)
    }
  }
  return newSession
}

export async function updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | null> {
  if (USE_API && (updates.title !== undefined || updates.attachedSummaryIds !== undefined)) {
    try {
      const body: Record<string, unknown> = {}
      if (updates.title !== undefined) body.title = updates.title
      if (updates.attachedSummaryIds !== undefined) {
        body.attached_summary_ids = updates.attachedSummaryIds
      }

      const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      return convertApiSession(data)
    } catch (error) {
      console.error('Failed to update session via API:', error)
      throw error
    }
  }
  
  // localStorage fallback
  const sessions = await getSessions()
  const index = sessions.findIndex(s => s.id === sessionId)
  
  if (index === -1) return null
  
  const updated = { ...sessions[index], ...updates }
  sessions[index] = updated
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  
  return updated
}

export async function setActiveSession(sessionId: string): Promise<void> {
  const sessions = await getSessions()
  const updated = sessions.map(s => ({
    ...s,
    active: s.id === sessionId
  }))
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated))
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}`, {
        method: 'DELETE'
      })
      
      if (response.status === 404) return false
      if (response.status === 204) return true
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      return true
    } catch (error) {
      console.error('Failed to delete session via API:', error)
      throw error
    }
  }
  
  // localStorage fallback
  const sessions = await getSessions()
  const filtered = sessions.filter(s => s.id !== sessionId)
  
  if (filtered.length === sessions.length) return false
  
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered))
  
  // Also delete associated chats
  const chats = getChatsBySessionSync()
  delete chats[sessionId]
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
  
  return true
}

// --- Chat Messages ---

export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/messages`)
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      const data = await response.json()
      return data.map(convertApiMessage)
    } catch (error) {
      console.error('Failed to fetch messages from API:', error)
      throw error  // Don't hide API errors
    }
  }
  
  return getChatMessagesFromStorage(sessionId)
}

function getChatMessagesFromStorage(sessionId: string): ChatMessage[] {
  const chats = getChatsBySessionSync()
  return chats[sessionId] || []
}

export async function addChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(convertFrontendMessage(message))
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      // Message successfully stored in backend
      return
    } catch (error) {
      console.error('Failed to add message via API:', error)
      throw error  // Don't hide API errors
    }
  } else {
    addChatMessageToStorage(sessionId, message)
  }
}

function addChatMessageToStorage(sessionId: string, message: ChatMessage): void {
  const chats = getChatsBySessionSync()
  chats[sessionId] = [...(chats[sessionId] || []), message]
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
}

export async function setChatMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
  if (USE_API) {
    // For now, use localStorage for bulk updates
    // TODO: Implement batch API endpoint if needed
    setChatMessagesToStorage(sessionId, messages)
  } else {
    setChatMessagesToStorage(sessionId, messages)
  }
}

function setChatMessagesToStorage(sessionId: string, messages: ChatMessage[]): void {
  const chats = getChatsBySessionSync()
  chats[sessionId] = messages
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
}

// --- Session Summary ---

export async function getSessionSummary(sessionId: string): Promise<string | null> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/summary`)
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      const data = await response.json()
      return data.content
    } catch (error) {
      console.error('Failed to fetch summary from API:', error)
      return null
    }
  }
  
  // localStorage fallback - summaries stored in session object
  const sessions = await getSessions()
  const session = sessions.find(s => s.id === sessionId)
  return session?.summary?.content || null
}

export async function saveSessionSummary(
  sessionId: string,
  content: string,
  tokenCount?: number,
  messageCountAtCreation?: number
): Promise<void> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          token_count: tokenCount || null,
          message_count_at_creation: messageCountAtCreation || null
        })
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      return
    } catch (error) {
      console.error('Failed to save summary via API:', error)
      throw error  // Don't hide API errors
    }
  } else {
    saveSummaryToStorage(sessionId, content, messageCountAtCreation)
  }
}

function saveSummaryToStorage(sessionId: string, content: string, messageCountAtCreation?: number): void {
  const sessions = getSessionsFromStorage()
  const index = sessions.findIndex(s => s.id === sessionId)
  if (index !== -1) {
    sessions[index].summary = {
      content,
      timestamp: new Date().toISOString(),
      messageCountAtCreation: messageCountAtCreation ?? sessions[index].messageCount
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  }
}

// --- Sync versions for immediate state updates ---

export function getSessionsSync(): Session[] {
  try {
    const stored = localStorage.getItem(SESSIONS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveSessionsSync(sessions: Session[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function getChatsBySessionSync(): Record<SessionId, ChatMessage[]> {
  try {
    const stored = localStorage.getItem(CHATS_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function saveChatsBySessionSync(chats: Record<SessionId, ChatMessage[]>): void {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
}

// --- Create a message directly via API ---

export interface CreateMessageData {
  role: 'user' | 'ai' | 'feedback' | 'tool'
  content: string
  timestamp?: string  // Optional - Backend generates if not provided
  model?: string
  tool_call_data?: Record<string, any>
  feedback_data?: {
    feedbackNumber: number
    messages: ChatMessage[]
    isExpanded: boolean
  }
}

export async function createMessage(sessionId: string, data: CreateMessageData): Promise<ChatMessage> {
  if (!USE_API) {
    throw new Error('createMessage requires API mode')
  }
  
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create message')
  }
  
  const apiMessage = await response.json()
  
  // Convert to frontend format
  return {
    id: apiMessage.id,
    role: apiMessage.role,
    content: apiMessage.content,
    timestamp: apiMessage.timestamp,
    model: apiMessage.model,
    feedbackData: apiMessage.feedback_data
  }
}

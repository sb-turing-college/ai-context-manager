/**
 * Chat Service - Abstraction Layer for AI Chat Communication
 * 
 * Handles all chat-related API calls including:
 * - Regular chat messages (streaming and non-streaming)
 * - Draft auditing (Chat B sparse context)
 * - Answer verification (Chat B full context)
 * - Session summary generation
 */

import type { ChatMessage } from '../types'
import { API_BASE, USE_API } from '../config/api'

// --- Types for API Communication ---

export interface ChatContext {
  system_prompt: string  // Backend expects snake_case
  documents: Array<{id: string; title: string; content: string}>
  status_topics: Array<{id: string; title: string; content: string}>
  implicit_context?: string // Workshop draft for edit_draft tool
}

export interface ChatRequest {
  message: string
  context: ChatContext
  model: string
  sessionId: string
  includeSummaries?: string[] // Session IDs for cross-session summaries
}

export interface ToolCallInfo {
  tool_name: string
  arguments: Record<string, any>
  result: Record<string, any>
  action?: string
}

export interface DraftData {
  title: string
  content: string
  reason?: string
}

export interface SingleEdit {
  old_text: string
  new_text: string
}

export interface EditData {
  edits: SingleEdit[]
  edit_count: number
  reason?: string
}

export interface ChatResponse {
  content: string
  model: string
  usage: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  cache_info?: Record<string, any> | null
  user_message_id?: string
  ai_message_id?: string
  tool_calls?: ToolCallInfo[]
  turn_summary?: string | null
  turn_ok?: boolean | null
  draft_data?: DraftData
  edit_data_list?: EditData[]  // List of edits (can be multiple)
}

// --- Helper Functions ---

/**
 * Transform messages for API: Convert 'feedback' role to 'user' with prefix
 * LLM APIs only understand: system, user, assistant
 * Feedback from Chat B audit is sent as user message with [AUDIT-FEEDBACK] prefix
 */
export function transformMessagesForAPI(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter(msg => msg.role !== 'feedback' || msg.feedbackData) // Skip invalid feedback without data
    .map(msg => {
      if (msg.role === 'feedback' && msg.feedbackData) {
        // Transform feedback to user message with prefix
        const feedbackContent = msg.feedbackData.messages
          .map(m => `${m.role === 'user' ? 'USER' : 'AUDITOR'}: ${m.content}`)
          .join('\n\n')
        
        return {
          role: 'user' as const,
          content: `[AUDIT-FEEDBACK #${msg.feedbackData.feedbackNumber}]\n\nThe following conversation comes from an audit chat in which the current draft was critically reviewed:\n\n${feedbackContent}`
        }
      }
      
      // Normal messages: map 'ai' to 'assistant'
      return {
        role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }
    })
}

// --- Service Functions ---

/**
 * Send a chat message and receive AI response
 * 
 * @param request - The chat request with message and context
 * @returns Promise<ChatResponse> - The AI response
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  if (!USE_API) {
    throw new Error('API mode unexpectedly disabled')
  }

  // Real API call
  try {
    const response = await fetch(`${API_BASE}/api/v1/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: request.sessionId,
        message: request.message,
        model: request.model,
        temperature: 1.0,
        include_summaries: request.includeSummaries || [], // Cross-session summaries
        use_tools: true, // Enable tool-use
        context: request.context // Pass context from frontend
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to send message')
    }

    const data = await response.json()
    
    // Return backend response as-is (matches ChatResponse interface)
    return {
      content: data.content,
      model: data.model,
      usage: data.usage || {},
      cache_info: data.cache_info || null,
      user_message_id: data.user_message_id,
      ai_message_id: data.ai_message_id,
      tool_calls: data.tool_calls,          // Tool calls made by AI
      turn_summary: data.turn_summary ?? null,
      turn_ok: typeof data.turn_ok === 'boolean' ? data.turn_ok : null,
      draft_data: data.draft_data,          // Draft data if create_draft was called
      edit_data_list: data.edit_data_list   // List of edits if edit_draft was called
    }
  } catch (error) {
    console.error('Chat API error:', error)
    throw error
  }
}

// --- Chat B Types ---

export interface ChatBHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatBSendRequest {
  sessionId: string
  message: string
  model: string
  mode: 'verify' | 'audit'
  documents: Array<{ id: string; title: string; content: string }>
  statusTopics: Array<{ id: string; title: string; content: string }>
  workshopContent?: string
  answerToVerify?: string
  chatBHistory: ChatBHistoryMessage[]
  summaries?: string[]
}

/**
 * Send a message in Chat B (Reviewer) – fully decoupled from Chat A.
 * Context is frontend-controlled; history is ephemeral (not persisted).
 * No tools available in Chat B.
 */
export async function sendChatBMessage(request: ChatBSendRequest): Promise<ChatResponse> {
  if (!USE_API) {
    throw new Error('API mode unexpectedly disabled')
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/audit/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: request.sessionId,
        message: request.message,
        model: request.model,
        mode: request.mode,
        documents: request.documents,
        status_topics: request.statusTopics,
        workshop_content: request.workshopContent ?? null,
        answer_to_verify: request.answerToVerify ?? null,
        chat_b_history: request.chatBHistory,
        summaries: request.summaries ?? []
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to send Chat B message')
    }

    const data = await response.json()
    return {
      content: data.content,
      model: data.model,
      usage: data.usage || {}
    }
  } catch (error) {
    console.error('Chat B API error:', error)
    throw error
  }
}

/**
 * Get Chat B (Auditor) history for a session
 * Transforms messages with [DRAFT V{n}] prefix to draft role with draftData
 */
export async function getAuditMessages(sessionId: string): Promise<ChatMessage[]> {
  if (!USE_API) {
    return []
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/audit-messages`)
    
    if (!response.ok) {
      throw new Error('Failed to load audit messages')
    }

    const messages = await response.json()
    
    // Convert to frontend format, detect draft messages by prefix
    return messages.map((msg: any) => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      
      // Check if this is a draft message (has [DRAFT V{n}] prefix)
      const draftMatch = msg.content.match(/^\[DRAFT V(\d+)\]\n\n/)
      if (draftMatch && msg.role === 'user') {
        const version = parseInt(draftMatch[1], 10)
        const draftContent = msg.content.replace(/^\[DRAFT V\d+\]\n\n/, '')
        return {
          id: msg.id,
          role: 'draft' as const,
          content: draftContent,
          timestamp,
          draftData: {
            draftVersion: version,
            isExpanded: false
          }
        }
      }
      
      // Normal message
      return {
        id: msg.id,
        role: msg.role === 'assistant' ? 'ai' : 'user',
        content: msg.content,
        timestamp
      }
    })
  } catch (error) {
    console.error('Failed to load audit messages:', error)
    return []
  }
}

/**
 * Clear Chat B (Auditor) history for a session
 */
export async function clearAuditMessages(sessionId: string): Promise<void> {
  if (!USE_API) {
    return
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/audit-messages`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      throw new Error('Failed to clear audit messages')
    }
  } catch (error) {
    console.error('Failed to clear audit messages:', error)
    throw error
  }
}

/**
 * Save a user message to audit_messages without triggering AI response
 * Used for follow-up audits where user manually adds draft
 */
export async function saveAuditUserMessage(
  sessionId: string,
  content: string,
  asDraft?: { version: number } // If provided, saves as draft with version prefix
): Promise<void> {
  if (!USE_API) {
    return
  }

  // If saving as draft, add version prefix
  const finalContent = asDraft 
    ? `[DRAFT V${asDraft.version}]\n\n${content}`
    : content

  try {
    const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/audit-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'user',
        content: finalContent
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to save audit message')
    }
  } catch (error) {
    console.error('Failed to save audit message:', error)
    throw error
  }
}

/**
 * Generate a summary of a chat session
 * Used by "Konsolidieren" feature
 */
export async function generateSummary(
  sessionId: string,
  model: string = 'gemini-3-flash-preview',
  activeMessageIds?: string[]
): Promise<ChatResponse> {
  if (!USE_API) {
    throw new Error('API mode unexpectedly disabled')
  }

  // Real API call
  try {
    const response = await fetch(`${API_BASE}/api/v1/chat/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        model: model,
        max_tokens: 4000,
        active_message_ids: activeMessageIds // Send only active message IDs
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to generate summary')
    }

    const data: ChatResponse = await response.json()
    return data
  } catch (error) {
    console.error('Summary API error:', error)
    throw error
  }
}

/**
 * Load archived (soft-deleted) messages for a session from the backend.
 * Replaces the former localStorage-based archive loading.
 */
export async function getArchivedMessages(sessionId: string): Promise<{
  id: string
  role: string
  content: string
  timestamp: string
  created_at: string | null
  archived_at: string | null
}[]> {
  const response = await fetch(
    `${API_BASE}/api/v1/chat/sessions/${sessionId}/archived-messages`
  )
  if (!response.ok) {
    throw new Error(`Failed to load archived messages: ${response.status}`)
  }
  return response.json()
}

/**
 * Restore all archived messages of a session back into active AI context.
 * Returns the number of restored messages.
 */
export async function restoreArchivedMessages(sessionId: string): Promise<number> {
  const response = await fetch(
    `${API_BASE}/api/v1/chat/sessions/${sessionId}/restore-archived`,
    { method: 'POST' }
  )
  if (!response.ok) {
    throw new Error(`Failed to restore archived messages: ${response.status}`)
  }
  const data: { restored: number } = await response.json()
  return data.restored
}

// --- Streaming Support (Server-Sent Events) ---

/**
 * Stream a chat message with real-time response
 * Uses fetch with ReadableStream for Server-Sent Events (SSE)
 * 
 * @param request - The chat request
 * @param onChunk - Callback for each chunk of text
 * @param onComplete - Callback when streaming is complete
 * @param onError - Callback for errors
 * @returns Cleanup function to abort the stream
 */
export function streamChatMessage(
  request: ChatRequest,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: Error) => void
): () => void {
  if (!USE_API) {
    onError(new Error('API mode unexpectedly disabled'))
    return () => {} // No-op cleanup
  }

  // Real API streaming with fetch
  let fullText = ''
  const abortController = new AbortController()
  
  const startStreaming = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/chat/send?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: request.sessionId,
          message: request.message,
          model: request.model,
          temperature: 1.0, // Required for Gemini 3 models (safe default for all models)
          use_tools: false // Tools not supported in streaming yet
        }),
        signal: abortController.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          onComplete(fullText)
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6) // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              onComplete(fullText)
              return
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullText += parsed.content
                onChunk(parsed.content)
              }
              if (parsed.error) {
                throw new Error(parsed.error)
              }
            } catch (err) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        onError(err)
      }
    }
  }

  startStreaming()
  
  return () => {
    abortController.abort()
  }
}


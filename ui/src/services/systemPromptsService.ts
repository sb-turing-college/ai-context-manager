/**
 * System Prompts Service
 *
 * Handles CRUD operations for system prompts (summary, verify, audit).
 * These are global prompts used across the application.
 */

import { API_BASE, USE_API } from '../config/api'

/**
 * System Prompt type definition
 */
export interface SystemPrompt {
  type: 'summary' | 'verify' | 'audit'
  content: string
  is_default: boolean
  last_modified: string
}

/**
 * Response for list of system prompts
 */
export interface SystemPromptsListResponse {
  prompts: SystemPrompt[]
}

/**
 * Get all system prompts (summary, verify, audit)
 */
export async function getSystemPrompts(): Promise<SystemPrompt[]> {
  if (!USE_API) {
    throw new Error('API mode unexpectedly disabled')
  }

  const response = await fetch(`${API_BASE}/api/v1/settings/system-prompts`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch system prompts: ${errorText}`)
  }

  const data: SystemPromptsListResponse = await response.json()
  return data.prompts
}

/**
 * Update a system prompt
 */
export async function updateSystemPrompt(
  type: 'summary' | 'verify' | 'audit',
  content: string
): Promise<SystemPrompt> {
  if (!USE_API) {
    throw new Error('API mode unexpectedly disabled')
  }

  const response = await fetch(`${API_BASE}/api/v1/settings/system-prompts/${type}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to update system prompt: ${errorText}`)
  }

  return await response.json()
}

/**
 * Reset a system prompt to factory default
 */
export async function resetSystemPrompt(
  type: 'summary' | 'verify' | 'audit'
): Promise<SystemPrompt> {
  if (!USE_API) {
    throw new Error('API mode unexpectedly disabled')
  }

  const response = await fetch(`${API_BASE}/api/v1/settings/system-prompts/${type}/reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to reset system prompt: ${errorText}`)
  }

  return await response.json()
}

/**
 * Reset all system prompts to factory defaults
 */
export async function resetAllSystemPrompts(): Promise<SystemPrompt[]> {
  if (!USE_API) {
    throw new Error('API mode unexpectedly disabled')
  }

  const response = await fetch(`${API_BASE}/api/v1/settings/system-prompts/reset-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to reset all system prompts: ${errorText}`)
  }

  const data: SystemPromptsListResponse = await response.json()
  return data.prompts
}

/**
 * Get human-readable label for prompt type
 */
export function getPromptTypeLabel(type: 'summary' | 'verify' | 'audit'): string {
  const labels = {
    summary: 'Summary',
    verify: 'Verify (chat history reviewer)',
    audit: 'Audit (draft reviewer)'
  }
  return labels[type]
}

/**
 * Get description for prompt type
 */
export function getPromptTypeDescription(type: 'summary' | 'verify' | 'audit'): string {
  const descriptions = {
    summary: 'System prompt for creating session summaries. Defines format, style, and content of automatically generated summaries.',
    verify: 'System prompt for Chat B in Verify mode (chat history review). Defines the role as an external critic who reviews Chat A answers.',
    audit: 'System prompt for Chat B in Audit mode (draft review). Defines the role as an independent auditor who reviews drafts substantively.'
  }
  return descriptions[type]
}

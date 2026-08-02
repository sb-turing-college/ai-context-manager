/**
 * Draft Service - API for workshop draft persistence
 *
 * Drafts are auto-saved and persist across app restarts.
 */

import { API_BASE } from '../config/api'

export interface DraftHistoryEntry {
  version: number
  content: string
}

export interface Draft {
  id: string
  session_id: string
  title: string
  content: string
  history: DraftHistoryEntry[]
  current_version: number
  created_at: string
  updated_at: string
}

export interface DraftUpdate {
  title?: string
  content?: string
  history?: DraftHistoryEntry[]
  current_version?: number
}

/**
 * Get draft for a session
 * @returns Draft or null if none exists
 */
export async function getDraft(sessionId: string): Promise<Draft | null> {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/draft`)
  
  if (response.status === 404 || response.status === 204) {
    return null
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch draft: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data || null
}

/**
 * Save or update draft (upsert)
 */
export async function saveDraft(sessionId: string, data: DraftUpdate): Promise<Draft> {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    throw new Error(`Failed to save draft: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Delete draft for a session
 */
export async function deleteDraft(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/draft`, {
    method: 'DELETE'
  })
  
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete draft: ${response.statusText}`)
  }
}

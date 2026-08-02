/**
 * UserFact Service – global, project-independent user profile facts.
 */

import type { UserFactItem, UserFactCategory } from '../types'
import { API_BASE } from '../config/api'


export async function getUserFacts(): Promise<UserFactItem[]> {
  const response = await fetch(`${API_BASE}/api/v1/user-facts`)
  if (!response.ok) throw new Error(`Failed to fetch user facts: ${response.statusText}`)
  const data = await response.json()
  return data.map(convertApiFactToFrontend)
}

export async function createUserFact(
  title: string,
  content: string,
  category: UserFactCategory = 'preference'
): Promise<UserFactItem> {
  const response = await fetch(`${API_BASE}/api/v1/user-facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, category })
  })
  if (!response.ok) throw new Error(`Failed to create user fact: ${response.statusText}`)
  return convertApiFactToFrontend(await response.json())
}

export async function updateUserFact(
  factId: string,
  updates: { title?: string; content?: string; category?: UserFactCategory; reason?: string }
): Promise<UserFactItem> {
  const response = await fetch(`${API_BASE}/api/v1/user-facts/${factId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  if (!response.ok) throw new Error(`Failed to update user fact: ${response.statusText}`)
  return convertApiFactToFrontend(await response.json())
}

export async function deleteUserFact(factId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/user-facts/${factId}`, {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error(`Failed to delete user fact: ${response.status}`)
}

// --- Conversion helper ---

function convertApiFactToFrontend(api: Record<string, unknown>): UserFactItem {
  return {
    id: api.id as string,
    category: (api.category as UserFactCategory) ?? 'preference',
    title: api.title as string,
    content: api.content as string,
    order: (api.order_index as number) ?? 0,
    history: (api.history as UserFactItem['history']) ?? []
  }
}

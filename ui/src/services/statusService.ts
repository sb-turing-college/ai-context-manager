/**
 * Status Topics Service - API-Only
 * 
 * Manages status topics via backend API.
 */

import type { StatusTopicItem } from '../types'
import { API_BASE } from '../config/api'


/**
 * Get all status topics for a project
 */
export async function getStatusTopics(projectId: string): Promise<StatusTopicItem[]> {
  const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/status`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch status topics: ${response.statusText}`)
  }
  
  const data = await response.json()
  return convertApiTopicsToFrontend(data)
}

/**
 * Create a new status topic
 */
export async function createStatusTopic(
  projectId: string,
  title: string,
  content: string
): Promise<StatusTopicItem> {
  const response = await fetch(`${API_BASE}/api/v1/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      title,
      content
    })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to create status topic: ${response.statusText}`)
  }
  
  const data = await response.json()
  return convertApiTopicToFrontend(data)
}

/**
 * Update a status topic
 */
export async function updateStatusTopic(
  topicId: string,
  updates: { title?: string; content?: string; reason?: string }
): Promise<StatusTopicItem> {
  const response = await fetch(`${API_BASE}/api/v1/status/${topicId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  
  if (!response.ok) {
    throw new Error(`Failed to update status topic: ${response.statusText}`)
  }
  
  const data = await response.json()
  return convertApiTopicToFrontend(data)
}

/**
 * Delete a status topic
 */
export async function deleteStatusTopic(topicId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/status/${topicId}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`StatusService: Delete failed:`, errorText)
    throw new Error(`Failed to delete status topic: ${response.status} ${errorText}`)
  }
}

/**
 * Get history for a status topic
 */
export async function getStatusTopicHistory(topicId: string): Promise<any[]> {
  const response = await fetch(`${API_BASE}/api/v1/status/${topicId}/history`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch status topic history: ${response.statusText}`)
  }
  
  return response.json()
}

// --- Conversion helpers ---

function convertApiTopicToFrontend(apiTopic: any): StatusTopicItem {
  return {
    id: apiTopic.id,
    projectId: apiTopic.project_id,
    title: apiTopic.title,
    content: apiTopic.content,
    order: apiTopic.order_index,
    history: apiTopic.history || []
  }
}

function convertApiTopicsToFrontend(apiTopics: any[]): StatusTopicItem[] {
  return apiTopics.map(convertApiTopicToFrontend)
}

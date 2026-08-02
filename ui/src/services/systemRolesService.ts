/**
 * System Roles Service
 * 
 * Manages system roles for Workshop feature (AI personas/behaviors).
 */

import type { SystemRole } from '../types'
import { API_BASE, USE_API } from '../config/api'

/**
 * Get all system roles
 */
export async function getSystemRoles(): Promise<SystemRole[]> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/system-roles`)
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      return response.json()
    } catch (error) {
      console.error('Failed to fetch system roles from API:', error)
      throw error
    }
  }
  
  console.warn('Using localStorage fallback for system roles')
  return []
}

/**
 * Create a new system role
 */
export async function createSystemRole(title: string, prompt: string): Promise<SystemRole> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/system-roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, prompt })
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      return response.json()
    } catch (error) {
      console.error('Failed to create system role via API:', error)
      throw error
    }
  }
  
  throw new Error('API mode required for system roles')
}

/**
 * Update a system role
 */
export async function updateSystemRole(
  roleId: string,
  updates: { title?: string; prompt?: string }
): Promise<SystemRole> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/system-roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      return response.json()
    } catch (error) {
      console.error('Failed to update system role via API:', error)
      throw error
    }
  }
  
  throw new Error('API mode required for system roles')
}

/**
 * Delete a system role
 */
export async function deleteSystemRole(roleId: string): Promise<boolean> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/system-roles/${roleId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      return true
    } catch (error) {
      console.error('Failed to delete system role via API:', error)
      throw error
    }
  }
  
  throw new Error('API mode required for system roles')
}

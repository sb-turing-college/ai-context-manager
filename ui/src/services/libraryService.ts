/**
 * Library Service - API-Only
 * 
 * Manages documents and folders via backend API.
 */

import type { LibraryItem, LibraryFolder, LibraryItemType } from '../types'
import { API_BASE } from '../config/api'


// --- Type Mappers ---

interface APILibraryItem {
  id: string
  project_id: string
  folder_id: string | null
  title: string
  content: string
  item_type: string
  version: number
  history: Array<{ version: number; content: string; timestamp: string }>
  created_at: string
  updated_at: string
}

interface APILibraryFolder {
  id: string
  project_id: string
  parent_id: string | null
  name: string
  created_at: string
}

function mapAPIItemToFrontend(apiItem: APILibraryItem): LibraryItem {
  return {
    id: apiItem.id,
    projectId: apiItem.project_id,
    folderId: apiItem.folder_id,
    title: apiItem.title,
    content: apiItem.content,
    type: apiItem.item_type as LibraryItemType,
    version: apiItem.version,
    history: apiItem.history,
    timestamp: apiItem.updated_at
  }
}

function mapAPIFolderToFrontend(apiFolder: APILibraryFolder): LibraryFolder {
  return {
    id: apiFolder.id,
    name: apiFolder.name,
    projectId: apiFolder.project_id,
    parentId: apiFolder.parent_id
  }
}

// --- Library Items ---

export async function getLibraryItems(projectId: string): Promise<LibraryItem[]> {
  const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/library/items`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch library items: ${response.statusText}`)
  }
  
  const data: APILibraryItem[] = await response.json()
  return data.map(mapAPIItemToFrontend)
}

export async function createLibraryItem(item: Omit<LibraryItem, 'id'>): Promise<LibraryItem> {
  const response = await fetch(`${API_BASE}/api/v1/library/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: item.projectId,
      folder_id: item.folderId,
      title: item.title,
      content: item.content,
      item_type: item.type
    })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to create library item: ${response.statusText}`)
  }
  
  const data: APILibraryItem = await response.json()
  return mapAPIItemToFrontend(data)
}

export async function updateLibraryItem(
  itemId: string, 
  updates: Partial<LibraryItem>
): Promise<LibraryItem> {
  const updateData: Record<string, unknown> = {}
  
  if (updates.title !== undefined) updateData.title = updates.title
  if (updates.content !== undefined) updateData.content = updates.content
  if (updates.folderId !== undefined) updateData.folder_id = updates.folderId
  
  const response = await fetch(`${API_BASE}/api/v1/library/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  })
  
  if (!response.ok) {
    throw new Error(`Failed to update library item: ${response.statusText}`)
  }
  
  const data: APILibraryItem = await response.json()
  return mapAPIItemToFrontend(data)
}

export async function deleteLibraryItem(itemId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/library/items/${itemId}`, {
    method: 'DELETE'
  })
  
  if (!response.ok) {
    throw new Error(`Failed to delete library item: ${response.statusText}`)
  }
}

export async function moveItemToFolder(itemId: string, folderId: string | null): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/library/items/${itemId}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to move library item: ${response.statusText}`)
  }
}

export async function getItemHistory(itemId: string): Promise<any[]> {
  const response = await fetch(`${API_BASE}/api/v1/library/items/${itemId}/history`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch item history: ${response.statusText}`)
  }
  
  return response.json()
}

/** Download all project library items as a ZIP of .md or .txt files. */
export async function downloadLibraryZip(
  projectId: string,
  format: 'md' | 'txt' = 'md'
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/v1/projects/${projectId}/library/export.zip?format=${format}`
  )

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = await response.json()
      if (body?.detail) detail = body.detail
    } catch {
      // keep statusText
    }
    throw new Error(detail || `Failed to export library ZIP: ${response.status}`)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `library-export.${format}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// --- Library Folders ---

export async function getLibraryFolders(projectId: string): Promise<LibraryFolder[]> {
  const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/library/folders`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch library folders: ${response.statusText}`)
  }
  
  const data: APILibraryFolder[] = await response.json()
  return data.map(mapAPIFolderToFrontend)
}

export async function createFolder(name: string, projectId: string, parentId: string | null = null): Promise<LibraryFolder> {
  const response = await fetch(`${API_BASE}/api/v1/library/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      parent_id: parentId,
      name
    })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to create folder: ${response.statusText}`)
  }
  
  const data: APILibraryFolder = await response.json()
  return mapAPIFolderToFrontend(data)
}

export async function renameFolder(folderId: string, newName: string): Promise<LibraryFolder> {
  const response = await fetch(`${API_BASE}/api/v1/library/folders/${folderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to rename folder: ${response.statusText}`)
  }
  
  const data: APILibraryFolder = await response.json()
  return mapAPIFolderToFrontend(data)
}

export async function deleteFolder(folderId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/library/folders/${folderId}`, {
    method: 'DELETE'
  })
  
  if (!response.ok) {
    throw new Error(`Failed to delete folder: ${response.statusText}`)
  }
}

/**
 * Project Service - Abstraction Layer for Project Management
 *
 * REST API is always enabled (portfolio path). Optional localStorage
 * helpers remain only as legacy fallbacks inside individual methods.
 */

import type { Project } from '../types'
import { STORAGE_KEYS } from './settingsService'
import { API_BASE, USE_API } from '../config/api'

const STORAGE_KEY = STORAGE_KEYS.projects

// --- Helper: Convert API response to frontend format ---
function convertApiProject(apiProject: any): Project {
  return {
    id: apiProject.id,
    title: apiProject.title,
    sessionCount: apiProject.session_count || 0,
    lastModified: formatTimestamp(apiProject.updated_at)
  }
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  
  return date.toLocaleDateString('en-US')
}

// --- Service Functions ---

export async function getProjects(): Promise<Project[]> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects`)
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      const data = await response.json()
      return data.map(convertApiProject)
    } catch (error) {
      console.error('Failed to fetch projects from API:', error)
      throw error  // Don't hide API errors
    }
  }
  
  return getProjectsFromStorage()
}

function getProjectsFromStorage(): Project[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []  // Empty array, no mock fallback
  } catch {
    return []
  }
}

export async function createProject(title: string): Promise<Project> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      return convertApiProject(data)
    } catch (error) {
      console.error('Failed to create project via API:', error)
      throw error
    }
  }
  
  // localStorage fallback
  const newProject: Project = {
    id: Date.now().toString(),
    title,
    sessionCount: 0,
    lastModified: 'just now'
  }
  
  const projects = await getProjects()
  const updated = [newProject, ...projects]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  
  return newProject
}

export async function updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: updates.title })
      })
      
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      return convertApiProject(data)
    } catch (error) {
      console.error('Failed to update project via API:', error)
      throw error
    }
  }
  
  // localStorage fallback
  const projects = await getProjects()
  const index = projects.findIndex(p => p.id === projectId)
  
  if (index === -1) return null
  
  const updated = { ...projects[index], ...updates }
  projects[index] = updated
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  
  return updated
}

export async function deleteProject(projectId: string): Promise<boolean> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
        method: 'DELETE'
      })
      
      if (response.status === 404) return false
      if (response.status === 204) return true
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      return true
    } catch (error) {
      console.error('Failed to delete project via API:', error)
      throw error
    }
  }
  
  // localStorage fallback
  const projects = await getProjects()
  const filtered = projects.filter(p => p.id !== projectId)
  
  if (filtered.length === projects.length) return false
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  return true
}

// --- Sync versions for immediate state updates (current implementation) ---

export function getProjectsSync(): Project[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []  // Empty array, no mock fallback
  } catch {
    return []
  }
}

export function saveProjectsSync(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

/** Export project data as JSON (project, sessions, status, library). */
export async function exportProject(projectId: string): Promise<void> {
  const project = (await getProjects()).find(p => p.id === projectId)
  if (!project) throw new Error('Project not found')

  if (USE_API) {
    const [sessionsRes, statusRes, foldersRes, itemsRes] = await Promise.all([
      fetch(`${API_BASE}/api/v1/projects/${projectId}/sessions`),
      fetch(`${API_BASE}/api/v1/projects/${projectId}/status`),
      fetch(`${API_BASE}/api/v1/projects/${projectId}/library/folders`),
      fetch(`${API_BASE}/api/v1/projects/${projectId}/library/items`)
    ])
    if (!sessionsRes.ok) throw new Error('Failed to load sessions')
    if (!statusRes.ok) throw new Error('Failed to load status')
    if (!foldersRes.ok) throw new Error('Failed to load folders')
    if (!itemsRes.ok) throw new Error('Failed to load documents')

    const [sessions, status, folders, items] = await Promise.all([
      sessionsRes.json(),
      statusRes.json(),
      foldersRes.json(),
      itemsRes.json()
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      project: { id: project.id, title: project.title },
      sessions,
      status,
      library: { folders, items }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } else {
    // localStorage: aggregate from storage
    const projects = getProjectsFromStorage()
    const proj = projects.find((p: Project) => p.id === projectId)
    if (!proj) throw new Error('Project not found')
    const stored: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      project: proj,
      sessions: [],
      status: [],
      library: { folders: [], items: [] }
    }
    try {
      const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessions) || '[]').filter((s: { projectId: string }) => s.projectId === projectId)
      const allStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.statusTopics) || '[]')
      const status = allStatus.filter((t: { projectId?: string; project_id?: string }) => (t.projectId ?? t.project_id) === projectId)
      const folders = JSON.parse(localStorage.getItem('ai-workstation-folders') || '[]').filter((f: { projectId: string }) => f.projectId === projectId)
      const items = JSON.parse(localStorage.getItem('ai-workstation-items') || '[]').filter((i: { projectId: string }) => i.projectId === projectId)
      stored.sessions = sessions
      stored.status = status
      stored.library = { folders, items }
    } catch (_) { /* ignore */ }
    const blob = new Blob([JSON.stringify(stored, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project-${proj.title.replace(/[^a-zA-Z0-9_-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
}

/** Expected structure from exportProject (JSON). */
export interface ProjectExportData {
  exportedAt?: string
  project: { id?: string; title: string }
  sessions: Array<{ id?: string; title: string; [k: string]: unknown }>
  status: Array<{ id?: string; title: string; content: string; order_index?: number; [k: string]: unknown }>
  library: {
    folders: Array<{ id?: string; name: string; parent_id?: string | null; [k: string]: unknown }>
    items: Array<{ id?: string; title: string; content: string; folder_id?: string | null; item_type?: string; [k: string]: unknown }>
  }
}

/** Import project from JSON (same structure as export). Returns new project. */
export async function importProject(jsonData: ProjectExportData): Promise<Project> {
  const { project: proj, sessions, status, library } = jsonData
  if (!proj?.title) throw new Error('Invalid export file: project title missing')

  if (USE_API) {
    const newProject = await createProject(proj.title)
    const projectId = newProject.id

    for (const s of sessions || []) {
      if (s.title) {
        await fetch(`${API_BASE}/api/v1/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId, title: s.title })
        })
      }
    }

    for (let i = 0; i < (status || []).length; i++) {
      const t = status[i]
      if (t.title != null) {
        await fetch(`${API_BASE}/api/v1/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            title: t.title,
            content: t.content ?? '',
            order_index: t.order_index ?? i
          })
        })
      }
    }

    const folders = library?.folders || []
    const folderMap: Record<string, string> = {}
    const folderIds = new Set((folders as { id?: string }[]).map(f => f.id).filter(Boolean))
    let remaining = [...folders]
    while (remaining.length > 0) {
      const batch = remaining.filter((f: { parent_id?: string | null }) => {
        const pid = f.parent_id
        if (!pid) return true
        return folderMap[pid] != null || !folderIds.has(pid)
      })
      if (batch.length === 0) break
      for (const f of batch) {
        const parentId = f.parent_id ? folderMap[f.parent_id] ?? null : null
        const res = await fetch(`${API_BASE}/api/v1/library/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            parent_id: parentId,
            name: f.name || 'Folder'
          })
        })
        if (res.ok) {
          const created = await res.json()
          if (f.id) folderMap[f.id] = created.id
        }
      }
      remaining = remaining.filter(f => !batch.includes(f))
    }

    for (const item of library?.items || []) {
      const folderId = item.folder_id && folderMap[item.folder_id] ? folderMap[item.folder_id] : null
      await fetch(`${API_BASE}/api/v1/library/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          folder_id: folderId,
          title: item.title || 'Document',
          content: item.content ?? '',
          item_type: item.item_type || 'text'
        })
      })
    }

    const updated = (await getProjects()).find(p => p.id === projectId)
    return updated ?? newProject
  }

  const projects = getProjectsFromStorage()
  const newProj: Project = {
    id: Date.now().toString(),
    title: proj.title,
    sessionCount: sessions?.length ?? 0,
    lastModified: 'just now'
  }
  projects.unshift(newProj)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))

  const sessKey = STORAGE_KEYS.sessions
  const sess = JSON.parse(localStorage.getItem(sessKey) || '[]')
  for (const s of sessions || []) {
    if (s.title) {
      sess.push({
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: s.title,
        messageCount: 0,
        active: false,
        projectId: newProj.id
      })
    }
  }
  localStorage.setItem(sessKey, JSON.stringify(sess))

  const statusKey = STORAGE_KEYS.statusTopics
  const topics = JSON.parse(localStorage.getItem(statusKey) || '[]')
  for (const t of status || []) {
    if (t.title != null) {
      topics.push({
        id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: t.title,
        content: t.content ?? '',
        order: t.order_index ?? t.order ?? topics.length,
        projectId: newProj.id
      })
    }
  }
  localStorage.setItem(statusKey, JSON.stringify(topics))

  const folderMap: Record<string, string> = {}
  const foldersData = JSON.parse(localStorage.getItem('ai-workstation-folders') || '[]')
  const libFolders = library?.folders || []
  const libFolderIds = new Set(libFolders.map((x: { id?: string }) => x.id).filter(Boolean))
  let libRemaining = [...libFolders]
  while (libRemaining.length > 0) {
    const libBatch = libRemaining.filter((f: { parent_id?: string | null }) => {
      const pid = f.parent_id
      if (!pid) return true
      return folderMap[pid] != null || !libFolderIds.has(pid)
    })
    if (libBatch.length === 0) break
    for (const f of libBatch) {
      const newId = `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const parentId = f.parent_id && folderMap[f.parent_id] ? folderMap[f.parent_id] : null
      foldersData.push({
        id: newId,
        name: f.name || 'Folder',
        projectId: newProj.id,
        parentId
      })
      if (f.id) folderMap[f.id] = newId
    }
    libRemaining = libRemaining.filter(x => !libBatch.includes(x))
  }
  localStorage.setItem('ai-workstation-folders', JSON.stringify(foldersData))

  const itemsData = JSON.parse(localStorage.getItem('ai-workstation-items') || '[]')
  for (const item of library?.items || []) {
    const folderId = item.folder_id && folderMap[item.folder_id] ? folderMap[item.folder_id] : null
    itemsData.push({
      id: `i-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: item.title || 'Document',
      content: item.content ?? '',
      type: item.item_type || 'text',
      projectId: newProj.id,
      folderId,
      version: 1,
      timestamp: new Date().toISOString()
    })
  }
  localStorage.setItem('ai-workstation-items', JSON.stringify(itemsData))

  newProj.sessionCount = sessions?.length ?? 0
  return newProj
}

/**
 * Project / session / chat list state and loaders extracted from App.tsx (Chunk yellow 5C).
 *
 * Left in App (tangled with other hooks): library/status/userFacts loads,
 * sessionChat wiring, artifact drafts, summary import dialogs.
 */

import { useState, useEffect, useCallback } from 'react'
import type { Project, Session, ChatMessage } from '../types'
import { createProject, getProjects, deleteProject, updateProject } from '../services/projectService'
import {
  createSession,
  getSessionsByProject,
  updateSession,
} from '../services/sessionService'

export function useProjectSessionState(currentProject: string | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [chatsBySession, setChatsBySession] = useState<Record<string, ChatMessage[]>>({})
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [chatsLoading, setChatsLoading] = useState(false)

  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectValue, setEditingProjectValue] = useState('')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingSessionValue, setEditingSessionValue] = useState('')

  useEffect(() => {
    setProjectsLoading(true)
    getProjects()
      .then(setProjects)
      .catch((error) => {
        console.error('Failed to load projects:', error)
        setProjects([])
      })
      .finally(() => setProjectsLoading(false))
  }, [])

  useEffect(() => {
    if (!currentProject) {
      setSessions([])
      return
    }
    setSessionsLoading(true)
    getSessionsByProject(currentProject)
      .then(setSessions)
      .catch((error) => {
        console.error('Failed to load sessions:', error)
        setSessions([])
      })
      .finally(() => setSessionsLoading(false))
  }, [currentProject])

  const refreshSessions = useCallback(async () => {
    if (!currentProject) return
    try {
      setSessions(await getSessionsByProject(currentProject))
    } catch (error) {
      console.error('Failed to refresh sessions:', error)
    }
  }, [currentProject])

  const handleStartEditProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    setEditingProjectId(projectId)
    setEditingProjectValue(project.title)
  }

  const handleConfirmEditProject = async () => {
    if (!editingProjectId || !editingProjectValue.trim()) {
      setEditingProjectId(null)
      setEditingProjectValue('')
      return
    }
    try {
      const updated = await updateProject(editingProjectId, { title: editingProjectValue.trim() })
      if (updated) {
        setProjects((prev) => prev.map((p) => (p.id === editingProjectId ? updated : p)))
      }
    } catch (error) {
      console.error('Failed to update project:', error)
    } finally {
      setEditingProjectId(null)
      setEditingProjectValue('')
    }
  }

  const handleCancelEditProject = () => {
    setEditingProjectId(null)
    setEditingProjectValue('')
  }

  const handleStartEditSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return
    setEditingSessionId(sessionId)
    setEditingSessionValue(session.title)
  }

  const handleConfirmEditSession = async () => {
    if (!editingSessionId || !editingSessionValue.trim()) {
      setEditingSessionId(null)
      setEditingSessionValue('')
      return
    }
    try {
      const updated = await updateSession(editingSessionId, { title: editingSessionValue.trim() })
      if (updated) {
        setSessions((prev) =>
          prev.map((s) => (s.id === editingSessionId ? { ...s, ...updated } : s))
        )
      }
    } catch (error) {
      console.error('Failed to rename session:', error)
    } finally {
      setEditingSessionId(null)
      setEditingSessionValue('')
    }
  }

  const handleCancelEditSession = () => {
    setEditingSessionId(null)
    setEditingSessionValue('')
  }

  const handleConfirmCreateProject = async (title: string) => {
    const newProject = await createProject(title)
    setProjects((prev) => [...prev, newProject])
    return newProject
  }

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId)
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    setDeleteConfirmProjectId(null)
  }

  const handleConfirmCreateSession = async (projectId: string, title: string) => {
    const newSession = await createSession(projectId, title)
    setSessions((prev) => [
      ...prev.map((s) => ({
        ...s,
        active: s.projectId === projectId ? false : s.active,
      })),
      { ...newSession, active: true },
    ])
    return newSession
  }

  const projectSessions = sessions.filter((s) => s.projectId === currentProject)

  return {
    projects,
    setProjects,
    sessions,
    setSessions,
    chatsBySession,
    setChatsBySession,
    projectsLoading,
    sessionsLoading,
    chatsLoading,
    setChatsLoading,
    deleteConfirmProjectId,
    setDeleteConfirmProjectId,
    editingProjectId,
    editingProjectValue,
    setEditingProjectValue,
    editingSessionId,
    editingSessionValue,
    setEditingSessionValue,
    projectSessions,
    refreshSessions,
    handleStartEditProject,
    handleConfirmEditProject,
    handleCancelEditProject,
    handleStartEditSession,
    handleConfirmEditSession,
    handleCancelEditSession,
    handleConfirmCreateProject,
    handleDeleteProject,
    handleConfirmCreateSession,
  }
}

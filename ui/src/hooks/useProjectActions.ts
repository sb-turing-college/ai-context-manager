/**
 * Project navigation + CRUD/import/export extracted from App.tsx (SoC Phase 1).
 */

import { useRef, useState, type ChangeEvent, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import type { View, Project, LibraryFolder, LibraryItem, SessionId } from '../types'
import {
  createProject,
  getProjects,
  deleteProject,
  exportProject,
  importProject,
  type ProjectExportData,
} from '../services/projectService'

type SetProjects = Dispatch<SetStateAction<Project[]>>
type SetFolders = Dispatch<SetStateAction<LibraryFolder[]>>
type SetItems = Dispatch<SetStateAction<LibraryItem[]>>

export function useProjectActions(opts: {
  currentProject: string | null
  setCurrentProject: (id: string | null) => void
  setCurrentView: (view: View) => void
  projects: Project[]
  setProjects: SetProjects
  deleteConfirmProjectId: string | null
  setDeleteConfirmProjectId: (id: string | null) => void
  setActiveSession: (id: SessionId | null) => void
  setAllLibraryFolders: SetFolders
  setAllLibraryItems: SetItems
}) {
  const {
    currentProject,
    setCurrentProject,
    setCurrentView,
    projects,
    setProjects,
    deleteConfirmProjectId,
    setDeleteConfirmProjectId,
    setActiveSession,
    setAllLibraryFolders,
    setAllLibraryItems,
  } = opts

  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false)
  const importProjectInputRef = useRef<HTMLInputElement>(null)

  const handleOpenProject = (projectId: string) => {
    setCurrentProject(projectId)
    setCurrentView('workspace')
    setActiveSession(null)
  }

  const handleBackToDashboard = () => {
    setCurrentView('dashboard')
    setCurrentProject(null)
    setActiveSession(null)
  }

  const handleNewProject = () => {
    setCreateProjectDialogOpen(true)
  }

  const handleImportProjectClick = () => {
    importProjectInputRef.current?.click()
  }

  const handleImportProjectFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text) as ProjectExportData
      const newProject = await importProject(data)
      const updated = await getProjects()
      setProjects(updated)
      setCurrentProject(newProject.id)
      setCurrentView('workspace')
    } catch (err) {
      console.error('Project import failed:', err)
    }
  }

  const handleConfirmCreateProject = async (title: string) => {
    try {
      const newProject = await createProject(title)
      setProjects([newProject, ...projects])
      setCreateProjectDialogOpen(false)
      setCurrentProject(newProject.id)
      setCurrentView('workspace')
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const handleDeleteProject = async (projectId: string, e?: MouseEvent) => {
    if (e) e.stopPropagation()

    if (deleteConfirmProjectId !== projectId) {
      setDeleteConfirmProjectId(projectId)
      return
    }

    try {
      await deleteProject(projectId)
      setProjects(projects.filter((p) => p.id !== projectId))
      setAllLibraryFolders((folders) => folders.filter((f) => f.projectId !== projectId))
      setAllLibraryItems((items) => items.filter((item) => item.projectId !== projectId))

      if (currentProject === projectId) {
        setCurrentView('dashboard')
        setCurrentProject(null)
      }

      setDeleteConfirmProjectId(null)
    } catch (error) {
      console.error('Failed to delete project:', error)
      setDeleteConfirmProjectId(null)
    }
  }

  const handleCancelDeleteProject = () => {
    setDeleteConfirmProjectId(null)
  }

  const handleExportProject = async (projectId: string) => {
    try {
      await exportProject(projectId)
    } catch (error) {
      console.error('Failed to export project:', error)
    }
  }

  return {
    createProjectDialogOpen,
    setCreateProjectDialogOpen,
    importProjectInputRef,
    handleOpenProject,
    handleBackToDashboard,
    handleNewProject,
    handleImportProjectClick,
    handleImportProjectFile,
    handleConfirmCreateProject,
    handleDeleteProject,
    handleCancelDeleteProject,
    handleExportProject,
  }
}

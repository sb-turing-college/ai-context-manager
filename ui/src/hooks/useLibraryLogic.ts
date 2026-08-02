import { useState } from 'react'
import type { LibraryItem, LibraryFolder } from '../types'
import * as libraryService from '../services/libraryService'

export function useLibraryLogic(
  currentProject: string | null,
  allLibraryItems: LibraryItem[],
  setAllLibraryItems: React.Dispatch<React.SetStateAction<LibraryItem[]>>,
  allLibraryFolders: LibraryFolder[],
  setAllLibraryFolders: React.Dispatch<React.SetStateAction<LibraryFolder[]>>,
  setArtifactStep: React.Dispatch<React.SetStateAction<number>>,
  setArtifactContent: React.Dispatch<React.SetStateAction<string>>,
  setArtifactHistory: React.Dispatch<React.SetStateAction<{ version: number; content: string }[]>>,
  setArtifactVersion: React.Dispatch<React.SetStateAction<number>>,
  setArtifactMode: React.Dispatch<React.SetStateAction<'draft' | 'summary'>>,
  setOriginLibraryId: React.Dispatch<React.SetStateAction<string | null>>,
  setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>
) {
  const [libraryModalOpen, setLibraryModalOpen] = useState(false)
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<LibraryItem | null>(null)
  const [libraryCopySuccess, setLibraryCopySuccess] = useState(false)
  const [libraryImportModalOpen, setLibraryImportModalOpen] = useState(false)
  const [createDocumentModalOpen, setCreateDocumentModalOpen] = useState(false)
  const [importTab, setImportTab] = useState<'file' | 'project'>('file')
  const [libraryExportModalOpen, setLibraryExportModalOpen] = useState(false)
  const [exportMode, setExportMode] = useState<'single' | 'all'>('single')
  const [exportItem, setExportItem] = useState<LibraryItem | null>(null)
  const [exportTarget, setExportTarget] = useState<'project' | 'file'>('project')
  const [itemActionSuccess, setItemActionSuccess] = useState<{itemId: string, action: 'export' | 'remove'} | null>(null)

  const projectLibraryItems = allLibraryItems.filter(
    (item) => item.projectId === currentProject
  )
  const [removeConfirmItemId, setRemoveConfirmItemId] = useState<string | null>(null)
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isFlying, setIsFlying] = useState(false)
  const [flyingTitle, setFlyingTitle] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameFolderValue, setRenameFolderValue] = useState('')
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null)
  const [renameItemValue, setRenameItemValue] = useState('')
  const [deleteFolderConfirmId, setDeleteFolderConfirmId] = useState<string | null>(null)

  const handleOpenLibraryItem = (item: LibraryItem) => {
    setSelectedLibraryItem(item)
    setLibraryModalOpen(true)
  }

  const handleCopyLibraryItem = () => {
    setLibraryCopySuccess(true)
    setTimeout(() => setLibraryCopySuccess(false), 1000)
  }

  const handleExportLibraryItem = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const item = allLibraryItems.find(i => i.id === itemId)
    if (!item) return

    setExportMode('single')
    setExportItem(item)
    setLibraryExportModalOpen(true)
  }

  const handleExportAll = () => {
    if (!currentProject || projectLibraryItems.length === 0) {
      alert('Library is empty — nothing to export.')
      return
    }
    setExportMode('all')
    setExportItem(null)
    setLibraryExportModalOpen(true)
  }

  const handleExportToProject = async (targetProjectId: string) => {
    const itemsToCopy =
      exportMode === 'all'
        ? projectLibraryItems
        : exportItem
          ? [exportItem]
          : []

    if (itemsToCopy.length === 0) return

    const created: LibraryItem[] = []
    const failedTitles: string[] = []

    for (const source of itemsToCopy) {
      try {
        const newItem = await libraryService.createLibraryItem({
          title: source.title,
          content: source.content,
          type: source.type,
          projectId: targetProjectId,
          folderId: null,
          version: 1,
          timestamp: new Date().toISOString(),
        })
        created.push(newItem)
      } catch (error) {
        console.error('Failed to export library item to project:', source.title, error)
        failedTitles.push(source.title)
      }
    }

    if (created.length > 0) {
      setAllLibraryItems((items) => [...created, ...items])
    }

    if (exportMode === 'single' && exportItem && created.length === 1) {
      setItemActionSuccess({ itemId: exportItem.id, action: 'export' })
      setTimeout(() => setItemActionSuccess(null), 1000)
    }

    if (failedTitles.length > 0) {
      const okCount = created.length
      const failList = failedTitles.join(', ')
      alert(
        `Export finished with errors.\n\nCopied: ${okCount}\nFailed (${failedTitles.length}): ${failList}`
      )
    } else if (exportMode === 'all' && created.length > 0) {
      alert(`Copied ${created.length} document(s) to the target project.`)
    }

    setLibraryExportModalOpen(false)
  }

  const handleExportToFile = async (format: 'txt' | 'md' | 'pdf' = 'md') => {
    if (format === 'pdf') {
      alert('PDF export will be implemented in a future version.\n\nCurrently you can export .txt or .md.')
      return
    }

    if (exportMode === 'all') {
      if (!currentProject) return
      try {
        await libraryService.downloadLibraryZip(currentProject, format)
        setLibraryExportModalOpen(false)
      } catch (error) {
        console.error('Failed to export library ZIP:', error)
        alert(error instanceof Error ? error.message : 'Failed to export library ZIP.')
      }
      return
    }

    if (!exportItem) return

    const content = exportItem.content
    const fileName = `${exportItem.title}.${format}`
    const mimeType = format === 'md' ? 'text/markdown' : 'text/plain'
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setItemActionSuccess({ itemId: exportItem.id, action: 'export' })
    setTimeout(() => setItemActionSuccess(null), 1000)
    setLibraryExportModalOpen(false)
  }

  const handleEditLibraryItem = () => {
    if (!selectedLibraryItem) return
    
    const item = selectedLibraryItem
    const prevHistory = (item.history || [])
      .map(h => ({ version: h.version, content: h.content }))
      .sort((a, b) => a.version - b.version)
    const latestVersion = prevHistory.length + 1
    const fullHistory = [...prevHistory, { version: latestVersion, content: item.content }]
    const step = fullHistory.length
    
    setOriginLibraryId(item.id)
    setArtifactMode('draft')
    setArtifactStep(step)
    setArtifactContent(item.content)
    setArtifactHistory(fullHistory)
    setArtifactVersion(step)
    setRightCollapsed(false)
    setLibraryModalOpen(false)
  }

  const handleRemoveLibraryItem = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    
    if (removeConfirmItemId !== itemId) {
      setRemoveConfirmItemId(itemId)
      return
    }
    
    try {
      // Delete from backend via API
      await libraryService.deleteLibraryItem(itemId)
      
      // Update local state
      setAllLibraryItems(items => items.filter(item => item.id !== itemId))
      setItemActionSuccess({ itemId, action: 'remove' })
      setTimeout(() => setItemActionSuccess(null), 1000)
      setRemoveConfirmItemId(null)
    } catch (error) {
      console.error('Failed to delete library item:', error)
      // TODO: Show error toast to user
      setRemoveConfirmItemId(null)
    }
  }

  const getActiveFolderId = (): string | null => {
    const folderId = [...expandedFolders][0] ?? null
    if (!folderId || !currentProject) return null
    const exists = allLibraryFolders.some(
      (folder) => folder.id === folderId && folder.projectId === currentProject
    )
    return exists ? folderId : null
  }

  const handleImportFile = async (files: FileList | null) => {
    if (!files || files.length === 0 || !currentProject) return

    const targetFolderId = getActiveFolderId()

    // Process each file
    const importPromises = Array.from(files).map(async (file) => {
      // Check file type
      const fileName = file.name
      const extension = fileName.split('.').pop()?.toLowerCase()
      
      if (!extension || !['txt', 'md', 'markdown'].includes(extension)) {
        console.warn(`Unsupported file type: ${fileName}`)
        return null
      }

      // Determine library item type
      const itemType: 'text' | 'markdown' = ['md', 'markdown'].includes(extension) ? 'markdown' : 'text'

      // Read file content
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => reject(new Error(`Error reading file: ${fileName}`))
        reader.readAsText(file)
      })
      
      // Create via API (same as handleCreateDocument)
      const newItem = await libraryService.createLibraryItem({
        title: fileName.replace(/\.(txt|md|markdown)$/i, ''),
        content,
        type: itemType,
        projectId: currentProject,
        folderId: targetFolderId,
        version: 1,
        timestamp: new Date().toISOString()
      })
      
      return newItem
    })
    
    try {
      const newItems = (await Promise.all(importPromises)).filter((item): item is LibraryItem => item !== null)
      setAllLibraryItems(items => [...newItems, ...items])
    } catch (error) {
      console.error('Failed to import files:', error)
      // TODO: Show error toast to user
    }
    
    setLibraryImportModalOpen(false)
  }

  const handleImportFromProject = async (projectId: string, itemIds: string[]) => {
    if (!currentProject || itemIds.length === 0) return

    const itemsToCopy = allLibraryItems.filter(
      (item) => item.projectId === projectId && itemIds.includes(item.id)
    )
    if (itemsToCopy.length === 0) return

    const targetFolderId = getActiveFolderId()
    const created: LibraryItem[] = []
    const failedTitles: string[] = []

    for (const source of itemsToCopy) {
      try {
        const newItem = await libraryService.createLibraryItem({
          title: source.title,
          content: source.content,
          type: source.type,
          projectId: currentProject,
          folderId: targetFolderId,
          version: 1,
          timestamp: new Date().toISOString(),
        })
        created.push(newItem)
      } catch (error) {
        console.error('Failed to import library item from project:', source.title, error)
        failedTitles.push(source.title)
      }
    }

    if (created.length > 0) {
      setAllLibraryItems((items) => [...created, ...items])
    }

    if (failedTitles.length > 0) {
      alert(
        `Import finished with errors.\n\nCopied: ${created.length}\nFailed (${failedTitles.length}): ${failedTitles.join(', ')}`
      )
    }

    setLibraryImportModalOpen(false)
  }

  const handleCreateDocument = async (title: string, content: string) => {
    if (!currentProject) {
      throw new Error('No project selected')
    }

    const newItem = await libraryService.createLibraryItem({
      title,
      content,
      type: 'text',
      projectId: currentProject,
      folderId: getActiveFolderId(),
      version: 1,
      timestamp: new Date().toISOString()
    })

    setAllLibraryItems(items => [newItem, ...items])
    setItemActionSuccess({ itemId: newItem.id, action: 'export' })
    setTimeout(() => setItemActionSuccess(null), 1000)
  }

  const handleToggleFolder = (folderId: string) => {
    // Accordion: at most one folder open
    setExpandedFolders((prev) => {
      if (prev.has(folderId)) {
        return new Set()
      }
      return new Set([folderId])
    })
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !currentProject) return

    try {
      const newFolder = await libraryService.createFolder(
        newFolderName.trim(),
        currentProject,
        null
      )
      setAllLibraryFolders((folders) => [...folders, newFolder])
      setNewFolderDialogOpen(false)
      setNewFolderName('')
    } catch (error) {
      console.error('Failed to create folder:', error)
      alert(error instanceof Error ? error.message : 'Failed to create folder.')
    }
  }

  const handleMoveToFolder = async (itemId: string, folderId: string | null) => {
    try {
      await libraryService.moveItemToFolder(itemId, folderId)
      setAllLibraryItems((items) =>
        items.map((item) => (item.id === itemId ? { ...item, folderId } : item))
      )
    } catch (error) {
      console.error('Failed to move library item:', error)
      alert(error instanceof Error ? error.message : 'Failed to move document.')
    }
  }

  const handleStartRenameFolder = (folderId: string, currentName: string) => {
    setRenamingItemId(null)
    setDeleteFolderConfirmId(null)
    setRenamingFolderId(folderId)
    setRenameFolderValue(currentName)
  }

  const handleConfirmRenameFolder = async () => {
    if (!renamingFolderId || !renameFolderValue.trim()) {
      setRenamingFolderId(null)
      return
    }

    const newName = renameFolderValue.trim()
    try {
      const updated = await libraryService.renameFolder(renamingFolderId, newName)
      setAllLibraryFolders((folders) =>
        folders.map((folder) => (folder.id === renamingFolderId ? updated : folder))
      )
      setRenamingFolderId(null)
      setRenameFolderValue('')
    } catch (error) {
      console.error('Failed to rename folder:', error)
      alert(error instanceof Error ? error.message : 'Failed to rename folder.')
    }
  }

  const handleCancelRenameFolder = () => {
    setRenamingFolderId(null)
    setRenameFolderValue('')
  }

  const handleStartRenameItem = (itemId: string, currentTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setRenamingFolderId(null)
    setRemoveConfirmItemId(null)
    setRenamingItemId(itemId)
    setRenameItemValue(currentTitle)
  }

  const handleConfirmRenameItem = async () => {
    if (!renamingItemId || !renameItemValue.trim()) {
      setRenamingItemId(null)
      setRenameItemValue('')
      return
    }

    const newTitle = renameItemValue.trim()
    try {
      const updated = await libraryService.updateLibraryItem(renamingItemId, { title: newTitle })
      setAllLibraryItems((items) =>
        items.map((item) => (item.id === renamingItemId ? updated : item))
      )
      if (selectedLibraryItem?.id === renamingItemId) {
        setSelectedLibraryItem(updated)
      }
      if (exportItem?.id === renamingItemId) {
        setExportItem(updated)
      }
    } catch (error) {
      console.error('Failed to rename library item:', error)
      alert(error instanceof Error ? error.message : 'Failed to rename document.')
    }

    setRenamingItemId(null)
    setRenameItemValue('')
  }

  const handleCancelRenameItem = () => {
    setRenamingItemId(null)
    setRenameItemValue('')
  }

  /** Rename from view modal (no list inline state required). */
  const handleRenameLibraryItem = async (itemId: string, newTitle: string) => {
    const title = newTitle.trim()
    if (!title) return

    try {
      const updated = await libraryService.updateLibraryItem(itemId, { title })
      setAllLibraryItems((items) =>
        items.map((item) => (item.id === itemId ? updated : item))
      )
      if (selectedLibraryItem?.id === itemId) {
        setSelectedLibraryItem(updated)
      }
      if (exportItem?.id === itemId) {
        setExportItem(updated)
      }
      if (renamingItemId === itemId) {
        setRenamingItemId(null)
        setRenameItemValue('')
      }
    } catch (error) {
      console.error('Failed to rename library item:', error)
      alert(error instanceof Error ? error.message : 'Failed to rename document.')
      throw error
    }
  }

  /** Open confirm UI for folder delete (does not delete yet). */
  const handleRequestDeleteFolder = (folderId: string) => {
    setRenamingFolderId(null)
    setDeleteFolderConfirmId(folderId)
  }

  /**
   * Delete folder only; keep documents (backend moves them to root).
   * Matches DELETE /library/folders/{id}.
   */
  const handleConfirmDeleteFolderKeepFiles = async (folderId: string) => {
    try {
      await libraryService.deleteFolder(folderId)
      setAllLibraryItems((items) =>
        items.map((item) =>
          item.folderId === folderId ? { ...item, folderId: null } : item
        )
      )
      setAllLibraryFolders((folders) => folders.filter((folder) => folder.id !== folderId))
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        next.delete(folderId)
        return next
      })
      setDeleteFolderConfirmId(null)
    } catch (error) {
      console.error('Failed to delete folder:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete folder.')
    }
  }

  const handleCancelDeleteFolder = () => {
    setDeleteFolderConfirmId(null)
  }

  return {
    libraryModalOpen,
    selectedLibraryItem,
    libraryCopySuccess,
    libraryImportModalOpen,
    createDocumentModalOpen,
    importTab,
    libraryExportModalOpen,
    exportMode,
    exportItem,
    exportItemCount: projectLibraryItems.length,
    exportTarget,
    itemActionSuccess,
    removeConfirmItemId,
    newFolderDialogOpen,
    newFolderName,
    expandedFolders,
    isFlying,
    flyingTitle,
    setLibraryModalOpen,
    setLibraryImportModalOpen,
    setCreateDocumentModalOpen,
    setLibraryExportModalOpen,
    setImportTab,
    setExportTarget,
    setRemoveConfirmItemId,
    setNewFolderDialogOpen,
    setNewFolderName,
    setIsFlying,
    setFlyingTitle,
    handleOpenLibraryItem,
    handleCopyLibraryItem,
    handleExportLibraryItem,
    handleExportAll,
    handleExportToProject,
    handleExportToFile,
    handleEditLibraryItem,
    handleRemoveLibraryItem,
    handleImportFile,
    handleImportFromProject,
    handleCreateDocument,
    handleToggleFolder,
    handleCreateFolder,
    handleMoveToFolder,
    renamingFolderId,
    renameFolderValue,
    renamingItemId,
    renameItemValue,
    deleteFolderConfirmId,
    setRenameFolderValue,
    setRenameItemValue,
    handleStartRenameFolder,
    handleConfirmRenameFolder,
    handleCancelRenameFolder,
    handleStartRenameItem,
    handleConfirmRenameItem,
    handleCancelRenameItem,
    handleRenameLibraryItem,
    handleRequestDeleteFolder,
    handleConfirmDeleteFolderKeepFiles,
    handleCancelDeleteFolder
  }
}

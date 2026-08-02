import { useState, useEffect, useRef } from 'react'
import type { LibraryItem, Session, ArtifactMode } from '../types'
import { saveDraft, getDraft, deleteDraft } from '../services/draftService'
import { createLibraryItem, updateLibraryItem } from '../services/libraryService'

export function useArtifactLogic(
  currentProject: string | null,
  currentSession: Session | undefined,
  allLibraryItems: LibraryItem[],
  setAllLibraryItems: React.Dispatch<React.SetStateAction<LibraryItem[]>>,
  setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>,
  triggerLibraryFlyingAnimation: (title: string) => void
) {
  const [artifactStep, setArtifactStep] = useState(0)
  const [artifactVersion, setArtifactVersion] = useState(1)
  const [artifactContent, setArtifactContent] = useState('')
  const [artifactHistory, setArtifactHistory] = useState<{ version: number, content: string }[]>([])
  const [artifactMode, setArtifactMode] = useState<ArtifactMode>('draft')
  const [originLibraryId, setOriginLibraryId] = useState<string | null>(null)
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [showCommitSuccess, setShowCommitSuccess] = useState(false)
  const [showSummarySuccess, setShowSummarySuccess] = useState(false)
  const [showDraftSuccess, setShowDraftSuccess] = useState(false)
  const [showVersionSaveSuccess, setShowVersionSaveSuccess] = useState(false)
  const [isFlyingSummary, setIsFlyingSummary] = useState(false)
  // NOTE: never set to true anywhere (no trigger wired up yet) - the flying-draft
  // animation in FlyingAnimations.tsx is currently unreachable dead UI state.
  const [isFlyingDraft] = useState(false)
  const [isAudited, setIsAudited] = useState(false)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadingDraftRef = useRef(false)
  const loadIdRef = useRef(0)

  // Auto-Save: Debounced save when content/history/version changes
  useEffect(() => {
    if (!currentSession?.id || !artifactContent || artifactStep === 0 || isLoadingDraftRef.current) {
      return
    }
    
    // Clear pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce: Save after 1s of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveDraft(currentSession.id, {
          content: artifactContent,
          history: artifactHistory,
          current_version: artifactVersion
        })
      } catch (error) {
        console.error('Draft auto-save failed:', error)
      }
    }, 1000)
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [currentSession?.id, artifactContent, artifactHistory, artifactVersion, artifactStep])
  
  // Load draft when session changes
  useEffect(() => {
    if (!currentSession?.id) {
      // Clear draft state when no session
      setArtifactStep(0)
      setArtifactContent('')
      setArtifactHistory([])
      setArtifactVersion(1)
      setOriginLibraryId(null)
      return
    }
    
    const thisLoadId = ++loadIdRef.current
    const loadDraft = async () => {
      isLoadingDraftRef.current = true
      try {
        const draft = await getDraft(currentSession.id)
        // Ignore stale response (z.B. Strict Mode Remount oder schneller Session-Wechsel)
        if (thisLoadId !== loadIdRef.current) return
        if (draft && draft.content) {
          const rawHistory = draft.history || []
          const history = [...rawHistory].sort((a, b) => (a.version ?? 0) - (b.version ?? 0))
          const step = history.length || 1
          const version = (draft.current_version && draft.current_version >= 1 && draft.current_version <= step)
            ? draft.current_version
            : step
          const content = history[version - 1]?.content ?? draft.content
          setArtifactHistory(history)
          setArtifactStep(step)
          setArtifactVersion(version)
          setArtifactContent(content)
          setArtifactMode('draft')
          // Auto-expand workshop when draft exists
          setRightCollapsed(false)
        } else {
          // No draft exists - clear state
          setArtifactStep(0)
          setArtifactContent('')
          setArtifactHistory([])
          setArtifactVersion(1)
        }
      } catch (error) {
        if (thisLoadId !== loadIdRef.current) return
        console.error('❌ Failed to load draft:', error)
      } finally {
        if (thisLoadId === loadIdRef.current) {
          isLoadingDraftRef.current = false
        }
      }
    }
    
    loadDraft()
  }, [currentSession?.id])

  const handleCreateNewIteration = () => {
    // Create new version based on current content, unfreeze
    const currentContent = artifactContent
    const newStep = artifactStep + 1
    const newHistory = [...artifactHistory, { version: newStep, content: currentContent }]
    
    setArtifactStep(newStep)
    setArtifactVersion(newStep)
    setArtifactHistory(newHistory)
    setIsAudited(false)
    setOriginLibraryId(null) // New iteration, no origin
  }

  /**
   * @deprecated Draft creation now happens via AI tool (create_draft)
   * The draft is automatically opened via onDraftCreated callback in App.tsx
   */
  const handleCreateArtifact = () => {
    console.warn('handleCreateArtifact is deprecated. Drafts are now created via AI tool.')
  }

  const handleCreateSummary = () => {
    setArtifactMode('summary')
    setIsThinking(true)
    
    setTimeout(() => {
      // Check if we're updating an existing summary
      const isUpdate = artifactMode === 'summary' && artifactStep > 0
      
      const existingSummary = allLibraryItems.find(
        item => item.projectId === currentProject && item.title.includes(`${currentSession?.title} - Summary`)
      )
      
      const summaryContent = `# Session Summary: ${currentSession?.title}\n\nDiskutierte Themen:\n- Energiezellen-Handelskette\n- ROI-Kalkulation\n- Skalierung\n\nWichtige Entscheidungen:\n- Startkapital: 5 Mio\n- Standort: Argon Prime`
      
      setIsFlyingSummary(true)
      setShowSummarySuccess(true)
      
      setTimeout(() => {
        if (isUpdate) {
          // Update existing summary - create new version
          const newStep = artifactStep + 1
          const newHistory = [...artifactHistory]
          newHistory[newStep - 1] = { version: newStep, content: summaryContent }
          
          setArtifactStep(newStep)
          setArtifactContent(summaryContent)
          setArtifactHistory(newHistory)
          setArtifactVersion(newStep)
        } else {
          // Create new summary
          if (existingSummary) {
            setOriginLibraryId(existingSummary.id)
          }
          setArtifactStep(1)
          setArtifactContent(summaryContent)
          setArtifactHistory([{ version: 1, content: summaryContent }])
          setArtifactVersion(1)
        }
        
        setRightCollapsed(false)
        setIsFlyingSummary(false)
      }, 800)
      
      setTimeout(() => setShowSummarySuccess(false), 1000)
      setIsThinking(false)
    }, 1500)
  }

  // Internal: Direct discard without confirmation
  const discardArtifactDirect = () => {
    setArtifactStep(0)
    setArtifactContent('')
    setArtifactHistory([{ version: 1, content: '' }])
    setArtifactVersion(1)
    setArtifactMode('draft')
    setOriginLibraryId(null)
    setDiscardConfirm(false)
    // Persist discard: delete draft from backend so it doesn't reappear on session reopen
    if (currentSession?.id) {
      void deleteDraft(currentSession.id).catch(err =>
        console.warn('Failed to delete draft on discard:', err)
      )
    }
  }

  // Public: Discard with confirmation
  const handleDiscardArtifact = () => {
    if (!discardConfirm) {
      setDiscardConfirm(true)
      return
    }
    
    discardArtifactDirect()
  }

  const handleNavigateVersion = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && artifactVersion > 1) {
      const newVersion = artifactVersion - 1
      setArtifactVersion(newVersion)
      setArtifactContent(artifactHistory[newVersion - 1]?.content || '')
    } else if (direction === 'next' && artifactVersion < artifactStep) {
      const newVersion = artifactVersion + 1
      setArtifactVersion(newVersion)
      setArtifactContent(artifactHistory[newVersion - 1]?.content || '')
    }
  }

  const handleArtifactEdit = (newContent: string) => {
    // Only update working copy - history stays immutable until explicit save
    setArtifactContent(newContent)
  }

  const handleSaveVersion = () => {
    // Create a new version checkpoint manually (without AI)
    const newStep = artifactStep + 1
    const newHistory = [...artifactHistory, { version: newStep, content: artifactContent }]
    
    // Cancel pending auto-save so a stale save does not overwrite the version
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    
    setArtifactStep(newStep)
    setArtifactVersion(newStep)
    setArtifactHistory(newHistory)
    
    // Sofort auf neueste Version wechseln + Draft persistieren (kein Warten auf Debounce)
    if (currentSession?.id) {
      saveDraft(currentSession.id, {
        content: artifactContent,
        history: newHistory,
        current_version: newStep
      }).catch(err => console.warn('Draft save after version:', err))
    }
    
    // Show success feedback
    setShowVersionSaveSuccess(true)
    setTimeout(() => setShowVersionSaveSuccess(false), 1000)
  }

  const handleDeleteVersion = () => {
    if (artifactStep <= 1) return // Can't delete if only one version
    
    // Delete current version and jump to previous
    const newHistory = artifactHistory.filter((_, idx) => idx !== artifactVersion - 1)
    
    // Reindex versions
    const reindexed = newHistory.map((entry, idx) => ({
      version: idx + 1,
      content: entry.content
    }))
    
    const newStep = artifactStep - 1
    const newVersion = Math.min(artifactVersion, newStep)
    
    setArtifactHistory(reindexed)
    setArtifactStep(newStep)
    setArtifactVersion(newVersion)
    setArtifactContent(reindexed[newVersion - 1]?.content || '')
  }

  const handleCommitToLibrary = () => {
    if (originLibraryId) {
      // Check if origin item is audited (frozen)
      const originItem = allLibraryItems.find(item => item.id === originLibraryId)
      if (originItem?.isAudited) {
        // Frozen items always create new, never update
        performLibraryCommit('new')
      } else {
        setCommitDialogOpen(true)
      }
    } else {
      performLibraryCommit('new')
    }
  }

  const performLibraryCommit = async (action: 'update' | 'new') => {
    // Extract title from content (first heading or first line)
    const extractTitle = (content: string): string => {
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('#')) {
          return trimmed.replace(/^#+\s*/, '')
        }
        if (trimmed.length > 0) {
          return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed
        }
      }
      return 'Draft'
    }
    
    const itemTitle = artifactMode === 'summary' 
      ? `${currentSession?.title} - Summary` 
      : extractTitle(artifactContent)
    
    // Trigger flying animation
    triggerLibraryFlyingAnimation(itemTitle)
    
    setTimeout(async () => {
      try {
        if (action === 'update' && originLibraryId) {
          // Update existing item via API
          const updatedItem = await updateLibraryItem(originLibraryId, {
            content: artifactContent
          })
          setAllLibraryItems(items => items.map(item =>
            item.id === originLibraryId ? updatedItem : item
          ))
        } else {
          // Create new item via API
          const newItem = await createLibraryItem({
            title: itemTitle,
            content: artifactContent,
            type: 'markdown',
            projectId: currentProject!,
            folderId: null,
            timestamp: new Date().toISOString(),
            version: 1
          })
          setAllLibraryItems(items => [newItem, ...items])
        }
        
        // Delete draft from DB after successful commit
        if (currentSession?.id) {
          await deleteDraft(currentSession.id).catch(err => {
            console.warn('Failed to delete draft after commit:', err)
          })
        }
        
        setShowCommitSuccess(true)
        setTimeout(() => setShowCommitSuccess(false), 1000)
        setCommitDialogOpen(false)
        discardArtifactDirect()
      } catch (error) {
        console.error('Failed to commit to library:', error)
        // TODO: Show error toast to user
      }
    }, 800)
  }

  return {
    artifactStep,
    artifactVersion,
    artifactContent,
    artifactHistory,  // <-- THIS WAS MISSING!
    artifactMode,
    originLibraryId,
    commitDialogOpen,
    discardConfirm,
    isThinking,
    showCommitSuccess,
    showSummarySuccess,
    showDraftSuccess,
    showVersionSaveSuccess,
    isFlyingSummary,
    isFlyingDraft,
    isAudited,
    setCommitDialogOpen,
    setDiscardConfirm,
    setArtifactStep,
    setArtifactContent,
    setArtifactHistory,
    setArtifactVersion,
    setArtifactMode,
    setOriginLibraryId,
    setIsAudited,
    handleCreateArtifact,
    handleCreateSummary,
    handleDiscardArtifact,
    handleNavigateVersion,
    handleArtifactEdit,
    handleSaveVersion,
    handleDeleteVersion,
    handleCommitToLibrary,
    handleCreateNewIteration,
    performLibraryCommit,
    setIsThinking, // Exposed for Konsolidieren workflow
    setShowDraftSuccess // Exposed for handleDraftCreated
  }
}

import { useState, useEffect, useRef } from 'react'
import { MotionConfig } from 'framer-motion'
import './App.css'
import type { View, StatusTopic, LibraryFolder, LibraryItem, Session, SessionId, SummaryStatus, SystemRole, SummaryTriggerMode, SettingsTab } from './types'
import { SessionSidebar, ProjectWorkspace, FlyingAnimations, AppModals } from './components/workspace'
import { DashboardView } from './components/dashboard'
import { useArtifactLogic } from './hooks/useArtifactLogic'
import { useLibraryLogic } from './hooks/useLibraryLogic'
import { useSessionChatLogic } from './hooks/useSessionChatLogic'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useSystemRoleLogic } from './hooks/useSystemRoleLogic'
import { useChatBLogic } from './hooks/useChatBLogic'
import { useFeedbackLogic } from './hooks/useFeedbackLogic'
import { useSystemPromptModules } from './hooks/useSystemPromptModules'
import { useToolUseSettings } from './hooks/useToolUseSettings'
import { useProjectSessionState } from './hooks/useProjectSessionState'
import { useDualChatOrchestration } from './hooks/useDualChatOrchestration'
import { useStatusAndUserFacts } from './hooks/useStatusAndUserFacts'
import { useProjectActions } from './hooks/useProjectActions'
import { useSessionContextActions } from './hooks/useSessionContextActions'
import { useChatMessageActions } from './hooks/useChatMessageActions'
import { useAuditVerifyWorkflow } from './hooks/useAuditVerifyWorkflow'
import { useActiveSessionMessages } from './hooks/useActiveSessionMessages'
import { STORAGE_KEYS, getSummaryTriggerModeSync, setSummaryTriggerModeSync, getAppSettings } from './services/settingsService'
import type { DraftData, EditData } from './services/chatService'
import { duplicateSession } from './services/sessionService'
import * as libraryService from './services/libraryService'
import * as systemRolesService from './services/systemRolesService'

function App() {
  // View & Navigation State
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [openTopic, setOpenTopic] = useState<StatusTopic>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false) // Session sidebar
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false) // Context drawer above Commander Box
  const [toolLogDrawerOpen, setToolLogDrawerOpen] = useState(false)
  const [openContextSection, setOpenContextSection] = useState<'systemPrompt' | 'documents' | 'summaries' | 'status' | 'userProfile'>('systemPrompt')
  const [selectedSummaries, setSelectedSummaries] = useState<SessionId[]>([])
  const [rightCollapsed, setRightCollapsed] = useState(true) // Workshop
  const {
    dualMode, setDualMode,
    auditActive, setAuditActive,
    chatBMode, setChatBMode,
    chatBCloseConfirm, setChatBCloseConfirm,
    verifyConfirm, setVerifyConfirm,
    chatBResetConfirm, setChatBResetConfirm,
    lastFeedbackMessageId, setLastFeedbackMessageId,
    openAuditMode, openVerifyMode, closeDualChat,
  } = useDualChatOrchestration()
  
  // Chat B (Critic) - Using custom hook
  const chatB = useChatBLogic()
  
  // Feedback Blocks (transferred from Chat B to Chat A) - Using custom hook
  const feedback = useFeedbackLogic()
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('app')
  const [showTags, setShowTags] = useState(false)
  
  // Project / session / chat list state (extracted hook)
  const {
    projects, setProjects,
    sessions, setSessions,
    chatsBySession, setChatsBySession,
    setChatsLoading,
    deleteConfirmProjectId, setDeleteConfirmProjectId,
    editingProjectId,
    editingProjectValue, setEditingProjectValue,
    editingSessionId,
    editingSessionValue, setEditingSessionValue,
    projectSessions,
    refreshSessions,
    handleStartEditProject,
    handleConfirmEditProject,
    handleCancelEditProject,
    handleStartEditSession,
    handleConfirmEditSession,
    handleCancelEditSession,
  } = useProjectSessionState(currentProject)

  const {
    userFacts,
    statusTopics,
    refreshStatus,
    refreshUserFacts,
    handleCreateStatusTopic,
    handleUpdateStatusTopic,
    handleDeleteStatusTopic,
    handleCreateUserFact,
    handleUpdateUserFact,
    handleDeleteUserFact,
  } = useStatusAndUserFacts(currentProject)
  const [systemRoles, setSystemRoles] = useState<SystemRole[]>([])
  const [, setSystemRolesLoading] = useState(false)
  
  // Library & Status from API
  const [allLibraryFolders, setAllLibraryFolders] = useState<LibraryFolder[]>([])
  const [allLibraryItems, setAllLibraryItems] = useState<LibraryItem[]>([])
  const [, setLibraryLoading] = useState(false)
  const [fontSize, setFontSize] = useLocalStorage<number>(STORAGE_KEYS.fontSize, 100)
  const [animationsEnabled, setAnimationsEnabled] = useLocalStorage<boolean>(STORAGE_KEYS.animations, true)
  const [showSendButton, setShowSendButton] = useLocalStorage<boolean>(STORAGE_KEYS.showSendButton, false)
  const [appSettings, setAppSettings] = useState<Awaited<ReturnType<typeof getAppSettings>> | null>(null)
  
  // Apply font size to document root
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`
  }, [fontSize])
  
  // Load app settings from API (for model filter, summary settings)
  useEffect(() => {
    getAppSettings().then(setAppSettings).catch(() => setAppSettings(null))
  }, [settingsModalOpen]) // Refetch when settings modal opens/closes

  // Note: projects/sessions load via useProjectSessionState; system prompts via useSystemPromptModules
 
  // Load library data when project changes
  useEffect(() => {
    if (!currentProject) {
      setAllLibraryFolders([])
      setAllLibraryItems([])
      return
    }
    
    setLibraryLoading(true)
    
    Promise.all([
      libraryService.getLibraryFolders(currentProject),
      libraryService.getLibraryItems(currentProject)
    ])
      .then(([folders, items]) => {
        setAllLibraryFolders(folders)
        setAllLibraryItems(items)
      })
      .catch(error => {
        console.error('Failed to load library data:', error)
      })
      .finally(() => {
        setLibraryLoading(false)
      })
  }, [currentProject])
  
  

  // Load system roles on startup (Workshop feature)
  useEffect(() => {
    setSystemRolesLoading(true)
    systemRolesService.getSystemRoles()
      .then(setSystemRoles)
      .catch(error => {
        console.error('Failed to load system roles:', error)
        setSystemRoles([])
      })
      .finally(() => {
        setSystemRolesLoading(false)
      })
  }, [])
  
  // Filtered for current project
  const libraryFolders = allLibraryFolders.filter(f => f.projectId === currentProject)
  const libraryItems = allLibraryItems.filter(item => item.projectId === currentProject)
  
  // useState for flying animation (shared between hooks)
  const [libraryIsFlying, setLibraryIsFlying] = useState(false)
  const [libraryFlyingTitle, setLibraryFlyingTitle] = useState('')
  
  // System Prompt Modules (must be before sessionChat to pass as props)
  const systemPromptModules = useSystemPromptModules()
  
  // Refs for draft handlers (to break circular dependency with artifact)
  const draftHandlersRef = useRef<{
    onDraftCreated?: (draft: DraftData) => void
    onDraftEdited?: (edit: EditData) => void
    workshopContent?: string
  }>({})
  
  // Custom Hooks - Order matters! sessionChat must come before currentSession
  // Callback to refresh status after tool calls
  const handleStatusRefresh = () => {
    refreshStatus()
  }

  const handleLibraryRefresh = () => {
    if (!currentProject) return
    Promise.all([
      libraryService.getLibraryFolders(currentProject),
      libraryService.getLibraryItems(currentProject),
    ])
      .then(([folders, items]) => {
        setAllLibraryFolders(folders)
        setAllLibraryItems(items)
      })
      .catch((error) => console.error('Failed to refresh library:', error))
  }
  
  // Callback to refresh sessions after message sent (to update summary_status ampel)
  const handleSessionsRefresh = async () => {
    await refreshSessions()
  }
  
  const sessionChat = useSessionChatLogic({
    sessions,
    setSessions,
    setOpenTopic,
    chatsBySession,
    setChatsBySession,
    systemPromptModules: systemPromptModules.modules,
    libraryItems,
    statusTopics,
    selectedSummaries, // Cross-session summaries
    onStatusRefresh: handleStatusRefresh,
    onUserFactsRefresh: refreshUserFacts,
    onLibraryRefresh: handleLibraryRefresh,
    onSessionsRefresh: handleSessionsRefresh,
    // Use ref wrappers to break circular dependency (handlers defined after artifact)
    onDraftCreated: (draft) => draftHandlersRef.current.onDraftCreated?.(draft),
    onDraftEdited: (edit) => draftHandlersRef.current.onDraftEdited?.(edit),
    // Getter function to get current workshop content at send time (not at hook init)
    getWorkshopContent: () => draftHandlersRef.current.workshopContent,
    // Session duplication via API (only when API mode enabled)
    onCopySession: true
      ? async (sessionId) => {
          const sourceSession = sessions.find(s => s.id === sessionId)
          if (!sourceSession?.projectId) return null
          const sourceMessages = chatsBySession[sessionId] || []
          return duplicateSession(sourceSession.projectId, sourceSession.title, sourceMessages)
        }
      : undefined
  })
  
  // IMPORTANT: currentSession must follow sessionChat.activeSession, not s.active.
  const currentSession = projectSessions.find(s => s.id === sessionChat.activeSession)

  const {
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
  } = useProjectActions({
    currentProject,
    setCurrentProject,
    setCurrentView,
    projects,
    setProjects,
    deleteConfirmProjectId,
    setDeleteConfirmProjectId,
    setActiveSession: sessionChat.setActiveSession,
    setAllLibraryFolders,
    setAllLibraryItems,
  })
  
  // Update Chat B sessionId when current session changes
  useEffect(() => {
    if (currentSession?.id) {
      chatB.setSessionId(currentSession.id)
    }
  }, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useActiveSessionMessages({
    activeSessionId: sessionChat.activeSession,
    chatsBySession,
    setChatsBySession,
    setChatsLoading,
  })
  
  const artifact = useArtifactLogic(
    currentProject,
    currentSession,
    allLibraryItems,
    setAllLibraryItems,
    setRightCollapsed,
    (title: string) => {
      setLibraryFlyingTitle(title)
      setLibraryIsFlying(true)
      setTimeout(() => setLibraryIsFlying(false), 800)
    }
  )
  
  // Update draft handlers ref after artifact is initialized
  // Only the currently selected version is passed as context (artifactContent), not the full history
  draftHandlersRef.current.workshopContent = artifact.artifactContent
  draftHandlersRef.current.onDraftCreated = (draft: { title: string; content: string; reason?: string }) => {
    artifact.setArtifactMode('draft')
    
    // Check if there's already a draft in the workshop
    if (artifact.artifactStep > 0 && artifact.artifactContent) {
      // Add as new version to existing draft
      const newStep = artifact.artifactStep + 1
      const newHistory = [...artifact.artifactHistory, { version: newStep, content: draft.content }]
      
      artifact.setArtifactStep(newStep)
      artifact.setArtifactVersion(newStep)
      artifact.setArtifactHistory(newHistory)
      artifact.setArtifactContent(draft.content)
    } else {
      // First draft - create new history
      artifact.setArtifactStep(1)
      artifact.setArtifactVersion(1)
      artifact.setArtifactHistory([{ version: 1, content: draft.content }])
      artifact.setArtifactContent(draft.content)
    }
    
    // Expand workshop panel
    setRightCollapsed(false)
    
    // Success Feedback
    artifact.setShowDraftSuccess(true)
    setTimeout(() => artifact.setShowDraftSuccess(false), 1000)
  }
  draftHandlersRef.current.onDraftEdited = (editData: { edits: Array<{ old_text: string; new_text: string }>; edit_count: number; reason?: string }) => {
    // Only apply if workshop is open with content
    if (artifact.artifactStep === 0 || !artifact.artifactContent) {
      console.warn('Cannot edit draft: No draft in workshop')
      alert('Draft edit could not be applied: no draft is open in the Workshop.')
      return
    }
    
    // Apply ALL edits in-memory first
    let newContent = artifact.artifactContent
    let appliedCount = 0
    const skipped: string[] = []
    
    for (const edit of editData.edits) {
      if (newContent.includes(edit.old_text)) {
        newContent = newContent.replace(edit.old_text, edit.new_text)
        appliedCount++
      } else {
        const preview = edit.old_text.substring(0, 60).replace(/\n/g, '\\n')
        skipped.push(preview)
        console.warn(`Edit skipped: old_text not found: "${preview}..."`)
      }
    }
    
    if (appliedCount === 0) {
      console.error('No edits were applied - none of the old_text values were found')
      alert(
        'Draft edit failed: none of the AI edit snippets matched the current Workshop text exactly.\n\n'
        + 'The chat may have claimed success earlier — the draft was not changed.',
      )
      return
    }

    if (skipped.length > 0) {
      alert(
        `Draft partially updated: ${appliedCount}/${editData.edits.length} edits applied.\n`
        + `${skipped.length} snippet(s) did not match and were skipped.`,
      )
    }

    // Create ONE new version with all edits applied
    const newStep = artifact.artifactStep + 1
    const newHistory = [...artifact.artifactHistory, { version: newStep, content: newContent }]
    
    artifact.setArtifactStep(newStep)
    artifact.setArtifactVersion(newStep)
    artifact.setArtifactHistory(newHistory)
    artifact.setArtifactContent(newContent)
    
    // Success Feedback
    artifact.setShowDraftSuccess(true)
    setTimeout(() => artifact.setShowDraftSuccess(false), 1000)
  }
  
  const library = useLibraryLogic(
    currentProject,
    allLibraryItems,
    setAllLibraryItems,
    allLibraryFolders,
    setAllLibraryFolders,
    (step) => artifact.setArtifactStep(step),
    (content) => artifact.setArtifactContent(content),
    (history) => artifact.setArtifactHistory(history),
    (version) => artifact.setArtifactVersion(version),
    (mode) => artifact.setArtifactMode(mode),
    (id) => artifact.setOriginLibraryId(id),
    setRightCollapsed
  )

  const systemRoleManager = useSystemRoleLogic(systemRoles, setSystemRoles)
  
  // Tool-Use Settings (auto-check mode, enabled tools)
  const toolUseSettings = useToolUseSettings()
  
  // Summary Trigger Settings
  const [summaryTriggerMode, setSummaryTriggerMode] = useState<SummaryTriggerMode>(() => getSummaryTriggerModeSync())
  
  // Persist summary trigger mode when it changes
  useEffect(() => {
    setSummaryTriggerModeSync(summaryTriggerMode)
  }, [summaryTriggerMode])
  
  // Helper: Calculate Summary Status (Traffic Light)
  const getSummaryStatus = (session: Session): SummaryStatus => {
    // Use backend-provided summary_status (single source of truth)
    if (!session.summaryStatus || session.summaryStatus === 'none') return 'none'
    if (session.summaryStatus === 'outdated') return 'stale'
    return 'fresh' // 'current' from backend = 'fresh' in UI
  }



  const {
    createSessionDialogOpen,
    setCreateSessionDialogOpen,
    summaryImportDialogOpen,
    setSummaryImportDialogOpen,
    summaryExportSuccessId,
    handleAddSummary,
    handleRemoveSummary,
    handleOpenNewSessionDialog,
    handleConfirmCreateSession,
    handleExportSummary,
  } = useSessionContextActions({
    currentProject,
    activeSession: sessionChat.activeSession,
    sessions,
    setSessions,
    selectedSummaries,
    setSelectedSummaries,
    setActiveSession: sessionChat.setActiveSession,
    setShowNewSessionSuccess: sessionChat.setShowNewSessionSuccess,
  })

  // Restore per-session attached summaries (avoid wiping while sessions still loading)
  useEffect(() => {
    const id = sessionChat.activeSession
    if (!id) {
      setSelectedSummaries([])
      return
    }
    const session = sessions.find((s) => s.id === id)
    if (!session) return // don't clear selection before session list is ready
    const ids = session.attachedSummaryIds || []
    setSelectedSummaries((prev) => {
      if (prev.length === ids.length && prev.every((x, i) => x === ids[i])) {
        return prev
      }
      return ids
    })
  }, [sessionChat.activeSession, sessions])

  const {
    showSummaryHint,
    showKonsolidierenSuccess,
    handleToggleFeedbackExpand,
    handleToggleArchiveExpand,
    handleRestoreArchive,
    handleToggleSummaryExpand,
    handleToggleToolExpand,
    handleDismissSummaryHint,
    handleDeleteMessages,
    handleKonsolidieren,
  } = useChatMessageActions({
    currentSession,
    chatsBySession,
    setChatsBySession,
    setSessions,
    getSelectionCount: sessionChat.getSelectionCount,
    getSelectedMessages: sessionChat.getSelectedMessages,
    clearSelection: sessionChat.clearSelection,
    selectedModel: sessionChat.selectedModel,
    appSettings,
    setIsThinking: artifact.setIsThinking,
  })

  const {
    auditingItemId,
    setAuditingItemId,
    auditModalOpen,
    setAuditModalOpen,
    handleNewIteration,
    handleStartAudit,
    handleTransferFeedback,
    handleResetChatB,
    handleConfirmResetChatB,
    handleCancelResetChatB,
    handleStartVerify,
    handleCommitToLibraryWithCleanup,
    handleDiscardWithCleanup,
    handleExecuteAudit,
  } = useAuditVerifyWorkflow({
    currentProject,
    currentSession,
    chatsBySession,
    setChatsBySession,
    sessions,
    setSessions,
    allLibraryItems,
    setAllLibraryItems,
    libraryItems,
    statusTopics,
    selectedSummaries,
    draftHandlersRef,
    artifact,
    chatB,
    feedback,
    dualMode,
    auditActive,
    verifyConfirm,
    setVerifyConfirm,
    setChatBResetConfirm,
    lastFeedbackMessageId,
    setLastFeedbackMessageId,
    setAuditActive,
    openAuditMode,
    openVerifyMode,
    closeDualChat,
    setLeftCollapsed,
    setRightCollapsed,
    setActiveSession: sessionChat.setActiveSession,
  })

  const handleChatASendWithDraft = () => {
    sessionChat.handleSendMessage()
  }

  const currentChat = (sessionChat.activeSession ? chatsBySession[sessionChat.activeSession] : undefined) || []
  const selectedProject = projects.find(p => p.id === currentProject)

  return (
    <MotionConfig reducedMotion={animationsEnabled ? 'never' : 'always'}>
    <div className="h-screen w-screen flex bg-slate-900 relative overflow-hidden">
      <FlyingAnimations
        leftCollapsed={leftCollapsed}
        libraryIsFlying={libraryIsFlying}
        libraryFlyingTitle={libraryFlyingTitle}
        isFlyingStatus={sessionChat.isFlyingStatus}
        isFlyingSummary={artifact.isFlyingSummary}
        isFlyingDraft={artifact.isFlyingDraft}
      />

      {/* Hidden file input for project import */}
      <input
        ref={importProjectInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportProjectFile}
      />

      {/* DASHBOARD VIEW */}
      {currentView === 'dashboard' && (
        <DashboardView
          projects={projects}
          onOpenProject={handleOpenProject}
          onNewProject={handleNewProject}
          onImportProject={handleImportProjectClick}
          onEditProject={handleStartEditProject}
          onExportProject={handleExportProject}
          onDeleteProject={handleDeleteProject}
          onCancelDelete={handleCancelDeleteProject}
          deleteConfirmProjectId={deleteConfirmProjectId}
          editingProjectId={editingProjectId}
          editingProjectValue={editingProjectValue}
          onEditingProjectValueChange={setEditingProjectValue}
          onConfirmEditProject={handleConfirmEditProject}
          onCancelEditProject={handleCancelEditProject}
        />
      )}

      {/* WORKSPACE VIEW - SYNTHESIS CENTER LAYOUT */}
      {currentView === 'workspace' && (
        <>
          {/* LEFT SIDEBAR (Session Anchor) */}
          <SessionSidebar
            leftCollapsed={leftCollapsed}
            setLeftCollapsed={setLeftCollapsed}
            selectedProjectTitle={selectedProject?.title}
            projectSessions={projectSessions}
            getSummaryStatus={getSummaryStatus}
            showKonsolidierenSuccess={showKonsolidierenSuccess}
            showTags={showTags}
            activeSession={sessionChat.activeSession}
            getSelectionCount={sessionChat.getSelectionCount}
            handleSessionClick={sessionChat.handleSessionClick}
            moveToSession={sessionChat.moveToSession}
            copyToSession={sessionChat.copyToSession}
            sessionDeleteConfirmId={sessionChat.sessionDeleteConfirmId}
            handleDeleteSingleSession={sessionChat.handleDeleteSingleSession}
            cancelSessionDelete={sessionChat.cancelSessionDelete}
            handleCopySession={sessionChat.handleCopySession}
            clearSelection={sessionChat.clearSelection}
            showNewSessionSuccess={sessionChat.showNewSessionSuccess}
            moveToNewSession={sessionChat.moveToNewSession}
            copyToNewSession={sessionChat.copyToNewSession}
            editingSessionId={editingSessionId}
            editingSessionValue={editingSessionValue}
            setEditingSessionValue={setEditingSessionValue}
            handleConfirmEditSession={handleConfirmEditSession}
            handleCancelEditSession={handleCancelEditSession}
            handleStartEditSession={handleStartEditSession}
            handleBackToDashboard={handleBackToDashboard}
            setSettingsModalOpen={setSettingsModalOpen}
            handleOpenNewSessionDialog={handleOpenNewSessionDialog}
          />

          <ProjectWorkspace
            contextDrawerOpen={contextDrawerOpen}
            openContextSection={openContextSection}
            setOpenContextSection={setOpenContextSection}
            systemRoleManager={systemRoleManager}
            systemPromptModules={systemPromptModules}
            libraryItems={libraryItems}
            libraryFolders={libraryFolders}
            library={library}
            sessions={sessions}
            selectedSummaries={selectedSummaries}
            handleAddSummary={handleAddSummary}
            handleRemoveSummary={handleRemoveSummary}
            handleExportSummary={handleExportSummary}
            setSummaryImportDialogOpen={setSummaryImportDialogOpen}
            summaryExportSuccessId={summaryExportSuccessId}
            openTopic={openTopic}
            statusTopics={statusTopics}
            setOpenTopic={setOpenTopic}
            handleCreateStatusTopic={handleCreateStatusTopic}
            handleUpdateStatusTopic={handleUpdateStatusTopic}
            handleDeleteStatusTopic={handleDeleteStatusTopic}
            userFacts={userFacts}
            handleCreateUserFact={handleCreateUserFact}
            handleUpdateUserFact={handleUpdateUserFact}
            handleDeleteUserFact={handleDeleteUserFact}
            currentSession={currentSession}
            selectedProject={selectedProject}
            currentChat={currentChat}
            artifact={artifact}
            sessionChat={sessionChat}
            appSettings={appSettings}
            showTags={showTags}
            showKonsolidierenSuccess={showKonsolidierenSuccess}
            rightCollapsed={rightCollapsed}
            handleChatASendWithDraft={handleChatASendWithDraft}
            handleDeleteMessages={handleDeleteMessages}
            setShowTags={setShowTags}
            setContextDrawerOpen={setContextDrawerOpen}
            toolLogDrawerOpen={toolLogDrawerOpen}
            setToolLogDrawerOpen={setToolLogDrawerOpen}
            handleKonsolidieren={handleKonsolidieren}
            handleStartVerify={handleStartVerify}
            setVerifyConfirm={setVerifyConfirm}
            verifyConfirm={verifyConfirm}
            showSendButton={showSendButton}
            handleToggleFeedbackExpand={handleToggleFeedbackExpand}
            handleToggleArchiveExpand={handleToggleArchiveExpand}
            handleRestoreArchive={handleRestoreArchive}
            handleToggleSummaryExpand={handleToggleSummaryExpand}
            handleToggleToolExpand={handleToggleToolExpand}
            summaryTriggerMode={summaryTriggerMode}
            showSummaryHint={showSummaryHint}
            handleDismissSummaryHint={handleDismissSummaryHint}
            auditActive={auditActive}
            handleStartAudit={handleStartAudit}
            handleTransferFeedback={handleTransferFeedback}
            setRightCollapsed={setRightCollapsed}
            handleCommitToLibraryWithCleanup={handleCommitToLibraryWithCleanup}
            handleDiscardWithCleanup={handleDiscardWithCleanup}
            handleNewIteration={handleNewIteration}
            dualMode={dualMode}
            chatBMode={chatBMode}
            chatBCloseConfirm={chatBCloseConfirm}
            setChatBCloseConfirm={setChatBCloseConfirm}
            setDualMode={setDualMode}
            setAuditActive={setAuditActive}
            setChatBMode={setChatBMode}
            chatB={chatB}
            handleResetChatB={handleResetChatB}
            chatBResetConfirm={chatBResetConfirm}
            handleConfirmResetChatB={handleConfirmResetChatB}
            handleCancelResetChatB={handleCancelResetChatB}
            libraryIsFlying={libraryIsFlying}
          />
        </>
      )}

      <AppModals
        sessionChat={sessionChat}
        artifact={artifact}
        library={library}
        systemRoleManager={systemRoleManager}
        systemPromptModules={systemPromptModules}
        toolUseSettings={toolUseSettings}
        settingsModalOpen={settingsModalOpen}
        setSettingsModalOpen={setSettingsModalOpen}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        fontSize={fontSize}
        setFontSize={setFontSize}
        animationsEnabled={animationsEnabled}
        setAnimationsEnabled={setAnimationsEnabled}
        showSendButton={showSendButton}
        setShowSendButton={setShowSendButton}
        summaryTriggerMode={summaryTriggerMode}
        setSummaryTriggerMode={setSummaryTriggerMode}
        appSettings={appSettings}
        setAppSettings={setAppSettings}
        projects={projects}
        currentProject={currentProject}
        allLibraryItems={allLibraryItems}
        libraryItems={libraryItems}
        auditModalOpen={auditModalOpen}
        setAuditModalOpen={setAuditModalOpen}
        auditingItemId={auditingItemId}
        setAuditingItemId={setAuditingItemId}
        handleExecuteAudit={handleExecuteAudit}
        sessions={sessions}
        summaryImportDialogOpen={summaryImportDialogOpen}
        setSummaryImportDialogOpen={setSummaryImportDialogOpen}
        selectedSummaries={selectedSummaries}
        handleAddSummary={handleAddSummary}
        handleRemoveSummary={handleRemoveSummary}
        createProjectDialogOpen={createProjectDialogOpen}
        setCreateProjectDialogOpen={setCreateProjectDialogOpen}
        handleConfirmCreateProject={handleConfirmCreateProject}
        createSessionDialogOpen={createSessionDialogOpen}
        setCreateSessionDialogOpen={setCreateSessionDialogOpen}
        handleConfirmCreateSession={handleConfirmCreateSession}
      />
    </div>
    </MotionConfig>
  )
}

export default App

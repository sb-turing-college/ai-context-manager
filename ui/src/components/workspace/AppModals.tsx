import {
  SettingsModal,
  NewFolderDialog,
  PruneDialog,
  ImportModal,
  CreateDocumentModal,
  LibraryViewModal,
  ExportModal,
  AuditModal,
  SystemRoleManagerModal,
  ContextSelectionDialog,
  CreateProjectDialog,
  CreateSessionDialog,
} from '../modals'
import { getAppSettings } from '../../services/settingsService'
import type { Session, SessionId, LibraryItem, Project, SettingsTab, SummaryTriggerMode } from '../../types'

/** Props bag for modal shell — extracted JSX from App (SoC Phase 1). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppModalsProps = {
  sessionChat: any
  artifact: any
  library: any
  systemRoleManager: any
  systemPromptModules: any
  toolUseSettings: any
  settingsModalOpen: boolean
  setSettingsModalOpen: (v: boolean) => void
  settingsTab: SettingsTab
  setSettingsTab: (t: SettingsTab) => void
  fontSize: number
  setFontSize: (n: number) => void
  animationsEnabled: boolean
  setAnimationsEnabled: (v: boolean) => void
  showSendButton: boolean
  setShowSendButton: (v: boolean) => void
  summaryTriggerMode: SummaryTriggerMode
  setSummaryTriggerMode: (m: SummaryTriggerMode) => void
  appSettings: Awaited<ReturnType<typeof getAppSettings>> | null
  setAppSettings: (s: Awaited<ReturnType<typeof getAppSettings>> | null) => void
  projects: Project[]
  currentProject: string | null
  allLibraryItems: LibraryItem[]
  libraryItems: LibraryItem[]
  auditModalOpen: boolean
  setAuditModalOpen: (v: boolean) => void
  auditingItemId: string | null
  setAuditingItemId: (id: string | null) => void
  handleExecuteAudit: (persona: string, model: string, selectedItems: string[]) => void
  sessions: Session[]
  summaryImportDialogOpen: boolean
  setSummaryImportDialogOpen: (v: boolean) => void
  selectedSummaries: SessionId[]
  handleAddSummary: (sessionId: SessionId) => void
  handleRemoveSummary: (sessionId: SessionId) => void
  createProjectDialogOpen: boolean
  setCreateProjectDialogOpen: (v: boolean) => void
  handleConfirmCreateProject: (title: string) => void | Promise<void>
  createSessionDialogOpen: boolean
  setCreateSessionDialogOpen: (v: boolean) => void
  handleConfirmCreateSession: (title: string) => void | Promise<void>
}

/** All app-level dialogs/modals (JSX extract from App). */
export function AppModals(props: AppModalsProps) {
  const {
    sessionChat,
    artifact,
    library,
    systemRoleManager,
    systemPromptModules,
    toolUseSettings,
    settingsModalOpen,
    setSettingsModalOpen,
    settingsTab,
    setSettingsTab,
    fontSize,
    setFontSize,
    animationsEnabled,
    setAnimationsEnabled,
    showSendButton,
    setShowSendButton,
    summaryTriggerMode,
    setSummaryTriggerMode,
    appSettings,
    setAppSettings,
    projects,
    currentProject,
    allLibraryItems,
    libraryItems,
    auditModalOpen,
    setAuditModalOpen,
    auditingItemId,
    setAuditingItemId,
    handleExecuteAudit,
    sessions,
    summaryImportDialogOpen,
    setSummaryImportDialogOpen,
    selectedSummaries,
    handleAddSummary,
    handleRemoveSummary,
    createProjectDialogOpen,
    setCreateProjectDialogOpen,
    handleConfirmCreateProject,
    createSessionDialogOpen,
    setCreateSessionDialogOpen,
    handleConfirmCreateSession,
  } = props

  return (
    <>
      <PruneDialog
        isOpen={sessionChat.pruneDialogOpen}
        onClose={() => sessionChat.setPruneDialogOpen(false)}
        keepLastMessages={sessionChat.keepLastMessages}
        onKeepLastMessagesChange={sessionChat.setKeepLastMessages}
        onPrune={sessionChat.handlePruneChat}
        isThinking={artifact.isThinking}
      />

      <NewFolderDialog
        isOpen={library.newFolderDialogOpen}
        onClose={() => library.setNewFolderDialogOpen(false)}
        folderName={library.newFolderName}
        onFolderNameChange={library.setNewFolderName}
        onCreate={library.handleCreateFolder}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        currentTab={settingsTab}
        onTabChange={setSettingsTab}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        animationsEnabled={animationsEnabled}
        onAnimationsChange={setAnimationsEnabled}
        showSendButton={showSendButton}
        onShowSendButtonChange={setShowSendButton}
        toolUseSettings={{
          autoCheckMode: toolUseSettings.autoCheckMode,
          enabledTools: toolUseSettings.enabledTools,
          onAutoCheckModeChange: toolUseSettings.setAutoCheckMode,
          onToggleTool: toolUseSettings.toggleTool,
          onEnableAll: toolUseSettings.enableAllTools,
          onDisableAll: toolUseSettings.disableAllTools,
        }}
        summaryTriggerMode={summaryTriggerMode}
        onSummaryTriggerModeChange={setSummaryTriggerMode}
        appSettings={appSettings}
        onAppSettingsRefresh={() => getAppSettings().then(setAppSettings)}
      />

      <LibraryViewModal
        key={library.selectedLibraryItem?.id}
        isOpen={library.libraryModalOpen}
        onClose={() => library.setLibraryModalOpen(false)}
        item={library.selectedLibraryItem}
        onEditItem={library.handleEditLibraryItem}
        onCopyItem={library.handleCopyLibraryItem}
        onExportAsPDF={library.handleExportLibraryItem}
        onRenameItem={library.handleRenameLibraryItem}
        copySuccess={library.libraryCopySuccess}
        artifactFallback={artifact.artifactContent || 'No content available.'}
      />

      <ExportModal
        isOpen={library.libraryExportModalOpen}
        onClose={() => library.setLibraryExportModalOpen(false)}
        mode={library.exportMode}
        item={library.exportItem}
        itemCount={library.exportItemCount}
        currentTarget={library.exportTarget}
        onTargetChange={library.setExportTarget}
        projects={projects}
        currentProject={currentProject}
        onExportToProject={library.handleExportToProject}
        onExportToFile={library.handleExportToFile}
      />

      <ImportModal
        isOpen={library.libraryImportModalOpen}
        onClose={() => library.setLibraryImportModalOpen(false)}
        currentTab={library.importTab}
        onTabChange={library.setImportTab}
        currentProject={currentProject}
        projects={projects}
        allLibraryItems={allLibraryItems}
        onImportFile={library.handleImportFile}
        onImportFromProject={library.handleImportFromProject}
      />

      <CreateDocumentModal
        isOpen={library.createDocumentModalOpen}
        onClose={() => library.setCreateDocumentModalOpen(false)}
        onCreateDocument={library.handleCreateDocument}
      />

      <SystemRoleManagerModal
        isOpen={systemRoleManager.systemRoleModalOpen}
        onClose={systemRoleManager.handleCloseSystemRoleManager}
        selectedCategory={systemRoleManager.selectedCategory}
        onCategoryChange={systemRoleManager.setSelectedCategory}
        chatRoles={systemRoleManager.getRolesByCategory('chat')}
        auditRoles={systemRoleManager.getRolesByCategory('audit')}
        editingRole={systemRoleManager.editingRole}
        editingTitle={systemRoleManager.editingTitle}
        editingContent={systemRoleManager.editingContent}
        onEditTitleChange={systemRoleManager.setEditingTitle}
        onEditContentChange={systemRoleManager.setEditingContent}
        onStartEdit={systemRoleManager.handleStartEdit}
        onCancelEdit={systemRoleManager.handleCancelEdit}
        onSaveEdit={systemRoleManager.handleUpdateRole}
        onCreate={systemRoleManager.handleCreateRole}
        onDelete={systemRoleManager.handleDeleteRole}
        onSetDefault={systemRoleManager.handleSetDefault}
        deleteConfirmRoleId={systemRoleManager.deleteConfirmRoleId}
        onDeleteConfirmChange={systemRoleManager.setDeleteConfirmRoleId}
        onApplyRole={(role) => {
          if (role.category === 'chat') {
            systemPromptModules.startEditing('role')
            systemPromptModules.setEditBuffer(role.content)
            setTimeout(() => systemPromptModules.saveEditing(), 0)
          }
        }}
      />

      <AuditModal
        isOpen={auditModalOpen}
        onClose={() => {
          setAuditModalOpen(false)
          setAuditingItemId(null)
        }}
        artifactTitle={allLibraryItems.find((item) => item.id === auditingItemId)?.title || 'Draft'}
        libraryItems={libraryItems}
        onStartAudit={handleExecuteAudit}
      />

      {summaryImportDialogOpen && (
        <ContextSelectionDialog
          allSessions={sessions}
          currentSessionId={sessionChat.activeSession}
          selectedSummaries={selectedSummaries}
          onToggleSummary={(sessionId) => {
            if (selectedSummaries.includes(sessionId)) {
              handleRemoveSummary(sessionId)
            } else {
              handleAddSummary(sessionId)
            }
          }}
          onConfirm={() => setSummaryImportDialogOpen(false)}
          onCancel={() => setSummaryImportDialogOpen(false)}
        />
      )}

      {artifact.commitDialogOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
          onClick={() => artifact.setCommitDialogOpen(false)}
        >
          <div
            className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Save artifact</h3>
            <p className="text-slate-300 text-sm mb-6">
              This artifact is based on an existing library item. How do you want to save it?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => artifact.performLibraryCommit('update')}
                className="w-full px-4 py-3 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Save as new version
              </button>
              <button
                onClick={() => artifact.performLibraryCommit('new')}
                className="w-full px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Save as new artifact
              </button>
              <button
                onClick={() => artifact.setCommitDialogOpen(false)}
                className="w-full px-4 py-2 text-slate-400 hover:text-slate-200 text-sm mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateProjectDialog
        isOpen={createProjectDialogOpen}
        onClose={() => setCreateProjectDialogOpen(false)}
        onConfirm={handleConfirmCreateProject}
      />

      <CreateSessionDialog
        isOpen={createSessionDialogOpen}
        onClose={() => setCreateSessionDialogOpen(false)}
        onConfirm={handleConfirmCreateSession}
      />
    </>
  )
}

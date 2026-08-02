import { AnimatePresence, motion } from 'framer-motion'
import { ChatPanel, ToolLogDrawer } from '../chat'
import { WorkshopPanel } from '../workshop'
import { ContextDrawer } from '../context'
import { ALL_MODELS } from '../../config/models'
import type { ChatMessage } from '../../types'

/** Props mirror App.tsx workspace locals — pure JSX extract for SoC. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProjectWorkspaceProps = Record<string, any>

/** Chat A + Workshop + Chat B workspace (JSX extract from App). */
export function ProjectWorkspace(props: ProjectWorkspaceProps) {
  const {
    contextDrawerOpen,
    openContextSection,
    setOpenContextSection,
    systemRoleManager,
    systemPromptModules,
    libraryItems,
    libraryFolders,
    library,
    sessions,
    selectedSummaries,
    handleAddSummary,
    handleRemoveSummary,
    handleExportSummary,
    setSummaryImportDialogOpen,
    summaryExportSuccessId,
    openTopic,
    statusTopics,
    setOpenTopic,
    handleCreateStatusTopic,
    handleUpdateStatusTopic,
    handleDeleteStatusTopic,
    userFacts,
    handleCreateUserFact,
    handleUpdateUserFact,
    handleDeleteUserFact,
    currentSession,
    selectedProject,
    currentChat,
    artifact,
    sessionChat,
    appSettings,
    showTags,
    showKonsolidierenSuccess,
    rightCollapsed,
    handleChatASendWithDraft,
    handleDeleteMessages,
    setShowTags,
    setContextDrawerOpen,
    toolLogDrawerOpen,
    setToolLogDrawerOpen,
    handleKonsolidieren,
    handleStartVerify,
    setVerifyConfirm,
    verifyConfirm,
    showSendButton,
    handleToggleFeedbackExpand,
    handleToggleArchiveExpand,
    handleRestoreArchive,
    handleToggleSummaryExpand,
    handleToggleToolExpand,
    summaryTriggerMode,
    showSummaryHint,
    handleDismissSummaryHint,
    auditActive,
    handleStartAudit,
    handleTransferFeedback,
    setRightCollapsed,
    handleCommitToLibraryWithCleanup,
    handleDiscardWithCleanup,
    handleNewIteration,
    dualMode,
    chatBMode,
    chatBCloseConfirm,
    setChatBCloseConfirm,
    setDualMode,
    setAuditActive,
    setChatBMode,
    chatB,
    handleResetChatB,
    chatBResetConfirm,
    handleConfirmResetChatB,
    handleCancelResetChatB,
    libraryIsFlying,
  } = props

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
  {/* MAIN WORKSPACE (Horizontal Stream) */}
  <div className="flex-1 flex overflow-hidden relative">
    {/* CHAT A (Architect) */}
    <div className="flex-1 min-w-0 h-full flex flex-col relative">
      {/* CONTEXT DRAWER (Above Commander Box, Chat-width only) */}
      <AnimatePresence>
        {contextDrawerOpen && (
          <ContextDrawer
            variant="chatA"
            openSection={openContextSection}
            onSectionChange={setOpenContextSection}
            onOpenRoleManager={systemRoleManager.handleOpenSystemRoleManager}
            systemPromptModulesProps={{
              modules: systemPromptModules.modules,
              editingModuleId: systemPromptModules.editingModuleId,
              editBuffer: systemPromptModules.editBuffer,
              onStartEditing: systemPromptModules.startEditing,
              onCancelEditing: systemPromptModules.cancelEditing,
              onSaveEditing: systemPromptModules.saveEditing,
              onEditBufferChange: systemPromptModules.setEditBuffer,
              onResetModule: systemPromptModules.resetModule,
              isModuleModified: systemPromptModules.isModuleModified
            }}
            libraryItems={libraryItems}
            libraryFolders={libraryFolders}
            libraryProps={{
              expandedFolders: library.expandedFolders,
              itemActionSuccess: library.itemActionSuccess,
              removeConfirmItemId: library.removeConfirmItemId,
              renamingFolderId: library.renamingFolderId,
              renameFolderValue: library.renameFolderValue,
              renamingItemId: library.renamingItemId,
              renameItemValue: library.renameItemValue,
              deleteFolderConfirmId: library.deleteFolderConfirmId,
              onToggleFolder: library.handleToggleFolder,
              onOpenLibraryItem: library.handleOpenLibraryItem,
              onExportLibraryItem: library.handleExportLibraryItem,
              onRemoveLibraryItem: library.handleRemoveLibraryItem,
              onCancelRemove: () => library.setRemoveConfirmItemId(null),
              onOpenImportModal: () => library.setLibraryImportModalOpen(true),
              onOpenCreateDocumentModal: () => library.setCreateDocumentModalOpen(true),
              onOpenNewFolderDialog: () => library.setNewFolderDialogOpen(true),
              onExportAll: library.handleExportAll,
              onMoveToFolder: library.handleMoveToFolder,
              onRenameFolderValueChange: library.setRenameFolderValue,
              onStartRenameFolder: library.handleStartRenameFolder,
              onConfirmRenameFolder: library.handleConfirmRenameFolder,
              onCancelRenameFolder: library.handleCancelRenameFolder,
              onRenameItemValueChange: library.setRenameItemValue,
              onStartRenameItem: library.handleStartRenameItem,
              onConfirmRenameItem: library.handleConfirmRenameItem,
              onCancelRenameItem: library.handleCancelRenameItem,
              onRequestDeleteFolder: library.handleRequestDeleteFolder,
              onConfirmDeleteFolderKeepFiles: library.handleConfirmDeleteFolderKeepFiles,
              onCancelDeleteFolder: library.handleCancelDeleteFolder
            }}
            summariesProps={{
              currentSessionId: sessionChat.activeSession,
              allSessions: sessions,
              selectedSummaries: selectedSummaries,
              onAddSummary: handleAddSummary,
              onRemoveSummary: handleRemoveSummary,
              onExportSummary: handleExportSummary,
              onOpenImportDialog: () => setSummaryImportDialogOpen(true),
              exportSuccessId: summaryExportSuccessId
            }}
            statusProps={{
              openTopic: openTopic,
              statusTopics: statusTopics,
              onToggleTopic: setOpenTopic,
              onCreateTopic: handleCreateStatusTopic,
              onUpdateTopic: handleUpdateStatusTopic,
              onDeleteTopic: handleDeleteStatusTopic
            }}
            userFactsProps={{
              facts: userFacts,
              onCreateFact: handleCreateUserFact,
              onUpdateFact: handleUpdateUserFact,
              onDeleteFact: handleDeleteUserFact
            }}
          />
        )}
      </AnimatePresence>
      <ChatPanel
        currentSession={currentSession}
        projectTitle={selectedProject?.title || ''}
        currentChat={currentChat}
        isThinking={artifact.isThinking}
        isAITyping={sessionChat.isAITyping}
        chatInput={sessionChat.chatInput}
        selectedModel={sessionChat.selectedModel}
        onModelChange={sessionChat.setSelectedModel}
        models={appSettings?.modelIdsHidden?.length ? ALL_MODELS.filter(m => !appSettings!.modelIdsHidden!.includes(m.id)) : undefined}
        showTags={showTags}
        contextDrawerOpen={contextDrawerOpen}
        showKonsolidierenSuccess={showKonsolidierenSuccess}
        showDraftSuccess={artifact.showDraftSuccess}
        rightCollapsed={rightCollapsed}
        copySuccess={sessionChat.chatCopySuccess}
        totalSelectionCount={sessionChat.getSelectionCount()}
        onChatInputChange={sessionChat.setChatInput}
        onSendMessage={handleChatASendWithDraft}
        onToggleMessage={(messageId) => sessionChat.handleToggleMessageSelection(sessionChat.activeSession, messageId)}
        onSelectFromHere={(idx) => sessionChat.handleSelectFromHere(sessionChat.activeSession, idx)}
        onCopyToClipboard={sessionChat.copyToClipboard}
        onDeleteMessages={handleDeleteMessages}
        isMessageSelected={(messageId) => sessionChat.isMessageSelected(sessionChat.activeSession, messageId)}
        onToggleTags={() => setShowTags(!showTags)}
        onOpenContext={() => setContextDrawerOpen(!contextDrawerOpen)}
        onOpenToolLog={() => setToolLogDrawerOpen(!toolLogDrawerOpen)}
        toolLogDrawerOpen={toolLogDrawerOpen}
        onKonsolidieren={handleKonsolidieren}
        onStartVerify={handleStartVerify}
        onCancelVerify={() => setVerifyConfirm(false)}
        verifyConfirm={verifyConfirm}
        onCreateDraft={() => {
          if (rightCollapsed) {
            artifact.handleCreateArtifact()
          } else {
            // Workshop is open - just keep it open or focus it
            // For now, do nothing (it's already visible)
          }
        }}
        showSendButton={showSendButton}
        onToggleFeedbackExpand={handleToggleFeedbackExpand}
        onToggleArchiveExpand={handleToggleArchiveExpand}
        onRestoreArchive={handleRestoreArchive}
        onToggleSummaryExpand={handleToggleSummaryExpand}
        onToggleToolExpand={handleToggleToolExpand}
        summaryTriggerMode={summaryTriggerMode}
        showSummaryHint={showSummaryHint}
        summaryTokenCount={15000}
        summaryTokenThreshold={12000}
        onDismissSummaryHint={handleDismissSummaryHint}
      />

      {/* Tool-Log Drawer */}
      <ToolLogDrawer
        isOpen={toolLogDrawerOpen}
        onClose={() => setToolLogDrawerOpen(false)}
        messages={currentChat}
        sessionTitle={currentSession?.title}
      />
    </div>

    {/* WORKSHOP (Draft) - Always present, animates width - ALWAYS 33% when open */}
    <motion.div
      initial={false}
      animate={{ width: rightCollapsed ? '48px' : '33%' }}
      transition={{ duration: 0.3 }}
      className="border-l border-slate-700 shrink-0 bg-slate-800"
    >
      <WorkshopPanel
        isCollapsed={rightCollapsed}
        artifactMode={artifact.artifactMode}
        artifactStep={artifact.artifactStep}
        artifactVersion={artifact.artifactVersion}
        artifactContent={artifact.artifactContent}
        artifactHistory={artifact.artifactHistory}
        isThinking={artifact.isThinking}
        showCommitSuccess={artifact.showCommitSuccess}
        showVersionSaveSuccess={artifact.showVersionSaveSuccess}
        isFlying={libraryIsFlying}
        discardConfirm={artifact.discardConfirm}
        isAudited={artifact.isAudited}
        auditActive={auditActive}
        onStartAudit={handleStartAudit}
        onTransferFeedback={handleTransferFeedback}
        onToggleCollapse={() => setRightCollapsed(!rightCollapsed)}
        onNavigateVersion={artifact.handleNavigateVersion}
        onEditArtifact={artifact.handleArtifactEdit}
        onSaveVersion={artifact.handleSaveVersion}
        onDeleteVersion={artifact.handleDeleteVersion}
        onCommitToLibrary={handleCommitToLibraryWithCleanup}
        onDiscard={handleDiscardWithCleanup}
        onCancelDiscard={() => artifact.setDiscardConfirm(false)}
        onNewIteration={handleNewIteration}
      />
    </motion.div>

    {/* CHAT B (Critic) - Optional - 33.5% when open (Chat A also 33.5%, Workshop 33%) */}
    {dualMode && (
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: '33.5%', opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="border-l border-slate-700 shrink-0 bg-slate-850 h-full flex flex-col relative"
      >
        {/* Chat B Header */}
        <div className="p-3 border-b border-slate-700 flex items-center justify-between shrink-0">
          <span className="text-sm font-medium text-slate-200">
            {chatBMode === 'verify' ? '🔍 Verify-Modus' : '🛡️ Audit-Modus'}
          </span>
          {/* Close Button with 2-Step Confirmation */}
          {!chatBCloseConfirm ? (
            <button
              onClick={() => setChatBCloseConfirm(true)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Close Chat B"
            >
              ✕
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setDualMode(false)
                  setAuditActive(false)
                  setChatBMode(null)
                  chatB.clearMessages()
                  setChatBCloseConfirm(false)
                  setVerifyConfirm(false)
                }}
                className="px-2 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-medium transition-colors"
              >
                ⚠️ Close?
              </button>
              <button
                onClick={() => setChatBCloseConfirm(false)}
                className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-[10px] transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Chat B Panel - Reuse ChatPanel component */}
        <ChatPanel
          currentSession={undefined} // Chat B has no session concept
          sessionRequired={false} // Chat B doesn't need a session
          projectTitle="Chat B (Auditor)"
          currentChat={chatB.messages}
          isThinking={false}
          isAITyping={chatB.isTyping}
          chatInput={chatB.input}
          selectedModel={chatB.model}
          onModelChange={chatB.setModel}
          models={appSettings?.modelIdsHidden?.length ? ALL_MODELS.filter(m => !appSettings!.modelIdsHidden!.includes(m.id)) : undefined}
          showTags={chatB.showTags}
          contextDrawerOpen={chatB.contextOpen}
          showKonsolidierenSuccess={false}
          showDraftSuccess={false}
          rightCollapsed={true}
          copySuccess={false}
          totalSelectionCount={chatB.selectionCount}
          showSendButton={showSendButton}
          verifyConfirm={false}
          onChatInputChange={chatB.setInput}
          onSendMessage={chatB.handleSend}
          onToggleMessage={chatB.handleToggleMessage}
          onSelectFromHere={chatB.handleSelectFromHere}
          onCopyToClipboard={chatB.handleCopyToClipboard}
          onDeleteMessages={chatB.handleDeleteMessages}
          isMessageSelected={chatB.isMessageSelected}
          onToggleTags={() => chatB.setShowTags(!chatB.showTags)}
          onOpenContext={() => chatB.setContextOpen(!chatB.contextOpen)}
          onKonsolidieren={() => {}} // Not applicable to Chat B
          onStartVerify={() => {}} // Not applicable to Chat B
          onCancelVerify={() => {}} // Not applicable to Chat B
          onCreateDraft={() => {}} // Not applicable to Chat B
          onToggleFeedbackExpand={() => {}} // Not applicable to Chat B
          onTransferFeedback={handleTransferFeedback} // Transfer Chat B conversation to Chat A
          onResetChatB={handleResetChatB} // "New round" button
          chatBResetConfirm={chatBResetConfirm}
          onConfirmResetChatB={handleConfirmResetChatB}
          onCancelResetChatB={handleCancelResetChatB}
          onToggleVerifyExpand={(messageId: string) => {
            // Toggle verify block expand state in Chat B messages
            chatB.setMessages((prev: ChatMessage[]) => prev.map((msg: ChatMessage) =>
              msg.id === messageId && msg.verifyData
                ? { ...msg, verifyData: { ...msg.verifyData, isExpanded: !msg.verifyData.isExpanded } }
                : msg
            ))
          }}
          onToggleDraftExpand={(messageId: string) => {
            // Toggle draft block expand state in Chat B messages
            chatB.setMessages((prev: ChatMessage[]) => prev.map((msg: ChatMessage) =>
              msg.id === messageId && msg.draftData
                ? { ...msg, draftData: { ...msg.draftData, isExpanded: !msg.draftData.isExpanded } }
                : msg
            ))
          }}
        />

        {/* Chat B Context Drawer - documents only, no system prompt (critic uses audit workflow) */}
        <AnimatePresence>
          {chatB.contextOpen && (
            <ContextDrawer
              variant="chatB"
              openSection={openContextSection}
              onSectionChange={setOpenContextSection}
              onOpenRoleManager={systemRoleManager.handleOpenSystemRoleManager}
              libraryItems={libraryItems}
              libraryFolders={libraryFolders}
            />
          )}
        </AnimatePresence>
      </motion.div>
    )}
  </div>
    </div>
  )
}

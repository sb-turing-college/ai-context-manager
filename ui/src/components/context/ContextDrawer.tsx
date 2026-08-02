import { motion } from 'framer-motion'
import type { LibraryItem, LibraryFolder, StatusTopicItem, UserFactItem, UserFactCategory, ItemActionSuccess, SystemPromptModule, SystemPromptModuleId, Session, SessionId } from '../../types'
import { LibraryPanel } from '../library'
import { StatusPanel } from '../status'
import { SystemPromptModules } from './SystemPromptModules'
import { SummariesPanel } from './SummariesPanel'
import { UserFactsPanel } from './UserFactsPanel'

type ContextSection = 'systemPrompt' | 'documents' | 'summaries' | 'status' | 'userProfile'

interface ContextDrawerProps {
  variant: 'chatA' | 'chatB'
  openSection: ContextSection
  onSectionChange: (section: ContextSection) => void
  
  // Role Manager (for opening the SystemRoleManagerModal)
  onOpenRoleManager: () => void
  
  // System Prompt Modules (modular version with 3 sections)
  // If not provided, the System Prompt section will not be shown (Chat B case)
  systemPromptModulesProps?: {
    modules: SystemPromptModule[]
    editingModuleId: SystemPromptModuleId | null
    editBuffer: string
    onStartEditing: (moduleId: SystemPromptModuleId) => void
    onCancelEditing: () => void
    onSaveEditing: () => void
    onEditBufferChange: (value: string) => void
    onResetModule: (moduleId: SystemPromptModuleId) => void
    isModuleModified: (moduleId: SystemPromptModuleId) => boolean
  }
  
  // Summaries (Cross-Session) - Chat A only
  summariesProps?: {
    currentSessionId: SessionId
    allSessions: Session[]
    selectedSummaries: SessionId[]
    onAddSummary: (sessionId: SessionId) => void
    onRemoveSummary: (sessionId: SessionId) => void
    onExportSummary: (sessionId: SessionId) => void
    onOpenImportDialog: () => void
    exportSuccessId: SessionId | null
  }
  
  // Library - Full (Chat A only)
  libraryItems: LibraryItem[]
  libraryFolders: LibraryFolder[]
  libraryProps?: {
    expandedFolders: Set<string>
    itemActionSuccess: ItemActionSuccess | null
    removeConfirmItemId: string | null
    renamingFolderId: string | null
    renameFolderValue: string
    renamingItemId: string | null
    renameItemValue: string
    deleteFolderConfirmId: string | null
    onToggleFolder: (folderId: string) => void
    onOpenLibraryItem: (item: LibraryItem) => void
    onExportLibraryItem: (itemId: string, e?: React.MouseEvent) => void
    onRemoveLibraryItem: (itemId: string, e?: React.MouseEvent) => void
    onCancelRemove: () => void
    onOpenImportModal: () => void
    onOpenCreateDocumentModal: () => void
    onOpenNewFolderDialog: () => void
    onExportAll: () => void
    onMoveToFolder: (itemId: string, folderId: string) => void
    onRenameFolderValueChange: (value: string) => void
    onStartRenameFolder: (folderId: string, currentName: string) => void
    onConfirmRenameFolder: () => void
    onCancelRenameFolder: () => void
    onRenameItemValueChange: (value: string) => void
    onStartRenameItem: (itemId: string, currentTitle: string, e?: React.MouseEvent) => void
    onConfirmRenameItem: () => void
    onCancelRenameItem: () => void
    onRequestDeleteFolder: (folderId: string) => void
    onConfirmDeleteFolderKeepFiles: (folderId: string) => void
    onCancelDeleteFolder: () => void
  }
  
  // Status (Chat A only)
  statusProps?: {
    openTopic: string | null
    statusTopics: StatusTopicItem[]
    onToggleTopic: (topic: string | null) => void
    onCreateTopic: (title: string, content: string) => void
    onUpdateTopic: (topicId: string, title: string, content: string) => void
    onDeleteTopic: (topicId: string) => void
  }

  // User Facts (global profile, Chat A only – shown in own tab)
  userFactsProps?: {
    facts: UserFactItem[]
    onCreateFact: (title: string, content: string, category: UserFactCategory) => void
    onUpdateFact: (factId: string, title: string, content: string, category: UserFactCategory) => void
    onDeleteFact: (factId: string) => void
  }
}

export function ContextDrawer({
  variant,
  openSection,
  onSectionChange,
  onOpenRoleManager,
  systemPromptModulesProps,
  libraryItems,
  libraryFolders,
  libraryProps,
  summariesProps,
  statusProps,
  userFactsProps
}: ContextDrawerProps) {
  const isChatA = variant === 'chatA'
  const focusRingColor = isChatA ? 'focus:ring-blue-500' : 'focus:ring-purple-500'
  
  // Show System Prompt section only if modular props are provided
  const showSystemPrompt = !!systemPromptModulesProps

  return (
    <motion.div
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      exit={{ scaleY: 0 }}
      transition={{ duration: 0.2 }}
      style={{ transformOrigin: 'bottom' }}
      className="bg-slate-800 absolute bottom-[12.5rem] left-0 right-0 top-[2.5rem] z-40 shadow-2xl overflow-hidden flex flex-col"
    >
      <div className="flex flex-col overflow-hidden flex-1 space-y-1">
        {/* System Prompt - Only shown if modular props are provided */}
        {showSystemPrompt && (
          <div className={`border-b border-slate-700 flex flex-col ${openSection === 'systemPrompt' ? 'flex-1 min-h-0' : ''}`}>
            <button
              onClick={() => onSectionChange('systemPrompt')}
              className={`w-full px-3 py-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider transition-colors shrink-0 ${
                openSection === 'systemPrompt' ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              <span>System Prompt</span>
              {openSection !== 'systemPrompt' && <span className="text-slate-500">+</span>}
            </button>
            {openSection === 'systemPrompt' && (
              <div className="flex-1 min-h-0 overflow-auto">
                <SystemPromptModules
                  modules={systemPromptModulesProps.modules}
                  editingModuleId={systemPromptModulesProps.editingModuleId}
                  editBuffer={systemPromptModulesProps.editBuffer}
                  focusRingColor={focusRingColor}
                  onStartEditing={systemPromptModulesProps.onStartEditing}
                  onCancelEditing={systemPromptModulesProps.onCancelEditing}
                  onSaveEditing={systemPromptModulesProps.onSaveEditing}
                  onEditBufferChange={systemPromptModulesProps.onEditBufferChange}
                  onResetModule={systemPromptModulesProps.onResetModule}
                  isModuleModified={systemPromptModulesProps.isModuleModified}
                  onOpenRoleManager={onOpenRoleManager}
                />
              </div>
            )}
          </div>
        )}

        {/* Documents */}
        <div className="border-b border-slate-700 flex flex-col" style={openSection === 'documents' ? {flex: 1, minHeight: 0} : {}}>
          <button
            onClick={() => onSectionChange('documents')}
            className={`w-full px-3 py-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider transition-colors shrink-0 ${
              openSection === 'documents' ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
            }`}
          >
            <span>
              Documents{libraryItems.length > 0 ? ` (${libraryItems.length})` : ''}
            </span>
            {openSection !== 'documents' && <span className="text-slate-500">+</span>}
          </button>
          {openSection === 'documents' && (
            <div className="flex-1 min-h-0 overflow-hidden">
              {isChatA && libraryProps ? (
                // Chat A: Full Library Panel with all actions
                <LibraryPanel
                  libraryItems={libraryItems}
                  libraryFolders={libraryFolders}
                  expandedFolders={libraryProps.expandedFolders}
                  itemActionSuccess={libraryProps.itemActionSuccess}
                  removeConfirmItemId={libraryProps.removeConfirmItemId}
                  renamingFolderId={libraryProps.renamingFolderId}
                  renameFolderValue={libraryProps.renameFolderValue}
                  renamingItemId={libraryProps.renamingItemId}
                  renameItemValue={libraryProps.renameItemValue}
                  deleteFolderConfirmId={libraryProps.deleteFolderConfirmId}
                  onToggleFolder={libraryProps.onToggleFolder}
                  onOpenLibraryItem={libraryProps.onOpenLibraryItem}
                  onExportLibraryItem={libraryProps.onExportLibraryItem}
                  onRemoveLibraryItem={libraryProps.onRemoveLibraryItem}
                  onCancelRemove={libraryProps.onCancelRemove}
                  onOpenImportModal={libraryProps.onOpenImportModal}
                  onOpenCreateDocumentModal={libraryProps.onOpenCreateDocumentModal}
                  onOpenNewFolderDialog={libraryProps.onOpenNewFolderDialog}
                  onExportAll={libraryProps.onExportAll}
                  onMoveToFolder={libraryProps.onMoveToFolder}
                  onRenameFolderValueChange={libraryProps.onRenameFolderValueChange}
                  onStartRenameFolder={libraryProps.onStartRenameFolder}
                  onConfirmRenameFolder={libraryProps.onConfirmRenameFolder}
                  onCancelRenameFolder={libraryProps.onCancelRenameFolder}
                  onRenameItemValueChange={libraryProps.onRenameItemValueChange}
                  onStartRenameItem={libraryProps.onStartRenameItem}
                  onConfirmRenameItem={libraryProps.onConfirmRenameItem}
                  onCancelRenameItem={libraryProps.onCancelRenameItem}
                  onRequestDeleteFolder={libraryProps.onRequestDeleteFolder}
                  onConfirmDeleteFolderKeepFiles={libraryProps.onConfirmDeleteFolderKeepFiles}
                  onCancelDeleteFolder={libraryProps.onCancelDeleteFolder}
                />
              ) : (
                // Chat B: Read-only document list
                <div className="h-full overflow-auto p-3 space-y-2">
                  {libraryItems.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">
                      No documents in the library yet
                    </p>
                  ) : (
                    libraryItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                      >
                        <span className="text-xs text-slate-300 truncate">
                          📄 {item.title}.{item.type === 'pdf' ? 'pdf' : item.type === 'markdown' ? 'md' : 'txt'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summaries (Cross-Session) - Chat A only */}
        {isChatA && summariesProps && (
          <div className={`border-b border-slate-700 flex flex-col ${openSection === 'summaries' ? 'flex-1 min-h-0' : ''}`}>
            <button
              onClick={() => onSectionChange('summaries')}
              className={`w-full px-3 py-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider transition-colors shrink-0 ${
                openSection === 'summaries' ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              <span>Summaries{summariesProps.selectedSummaries.length > 0 && ` (${summariesProps.selectedSummaries.length})`}</span>
              {openSection !== 'summaries' && <span className="text-slate-500">+</span>}
            </button>
            {openSection === 'summaries' && (
              <div className="flex-1 min-h-0 overflow-auto">
                <SummariesPanel
                  currentSessionId={summariesProps.currentSessionId}
                  allSessions={summariesProps.allSessions}
                  selectedSummaries={summariesProps.selectedSummaries}
                  onAddSummary={summariesProps.onAddSummary}
                  onRemoveSummary={summariesProps.onRemoveSummary}
                  onExportSummary={summariesProps.onExportSummary}
                  onOpenImportDialog={summariesProps.onOpenImportDialog}
                  exportSuccessId={summariesProps.exportSuccessId}
                />
              </div>
            )}
          </div>
        )}

        {/* Status - Chat A only */}
        {isChatA && statusProps && (
          <div className={`border-b border-slate-700 flex flex-col ${openSection === 'status' ? 'flex-1 min-h-0' : ''}`}>
            <button
              onClick={() => onSectionChange('status')}
              className={`w-full px-3 py-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider transition-colors shrink-0 ${
                openSection === 'status' ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              <span>
                Status
                {statusProps.statusTopics.length > 0
                  ? ` (${statusProps.statusTopics.length})`
                  : ''}
              </span>
              {openSection !== 'status' && <span className="text-slate-500">+</span>}
            </button>
            {openSection === 'status' && (
              <div className="flex-1 min-h-0 overflow-auto">
                <StatusPanel
                  openTopic={statusProps.openTopic}
                  statusTopics={statusProps.statusTopics}
                  onToggleTopic={statusProps.onToggleTopic}
                  onCreateTopic={statusProps.onCreateTopic}
                  onUpdateTopic={statusProps.onUpdateTopic}
                  onDeleteTopic={statusProps.onDeleteTopic}
                />
              </div>
            )}
          </div>
        )}

        {/* User profile - Chat A only */}
        {isChatA && userFactsProps && (
          <div className={`flex flex-col ${openSection === 'userProfile' ? 'flex-1 min-h-0' : ''}`}>
            <button
              onClick={() => onSectionChange('userProfile')}
              className={`w-full px-3 py-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider transition-colors shrink-0 ${
                openSection === 'userProfile' ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              <span>
                User profile
                {userFactsProps.facts.length > 0
                  ? ` (${userFactsProps.facts.length})`
                  : ''}
              </span>
              {openSection !== 'userProfile' && <span className="text-slate-500">+</span>}
            </button>
            {openSection === 'userProfile' && (
              <div className="flex-1 min-h-0 overflow-auto">
                <UserFactsPanel
                  facts={userFactsProps.facts}
                  onCreateFact={userFactsProps.onCreateFact}
                  onUpdateFact={userFactsProps.onUpdateFact}
                  onDeleteFact={userFactsProps.onDeleteFact}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

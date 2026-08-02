import type { Session, SessionId, SummaryStatus } from '../../types'

export interface SessionSidebarProps {
  leftCollapsed: boolean
  setLeftCollapsed: (v: boolean) => void
  selectedProjectTitle?: string
  projectSessions: Session[]
  getSummaryStatus: (session: Session) => SummaryStatus
  showKonsolidierenSuccess: boolean
  showTags: boolean
  activeSession: SessionId | null
  getSelectionCount: () => number
  handleSessionClick: (id: SessionId) => void
  moveToSession: (id: SessionId) => void
  copyToSession: (id: SessionId) => void
  sessionDeleteConfirmId: SessionId | null
  handleDeleteSingleSession: (id: SessionId) => void
  cancelSessionDelete: () => void
  handleCopySession: (id: SessionId) => void
  clearSelection: () => void
  showNewSessionSuccess: boolean
  moveToNewSession: () => void
  copyToNewSession: () => void
  editingSessionId: SessionId | null
  editingSessionValue: string
  setEditingSessionValue: (v: string) => void
  handleConfirmEditSession: () => void | Promise<void>
  handleCancelEditSession: () => void
  handleStartEditSession: (id: SessionId) => void
  handleBackToDashboard: () => void
  setSettingsModalOpen: (v: boolean) => void
  handleOpenNewSessionDialog: () => void
}

/** Left session list / navigation for the workspace view (JSX extract from App). */
export function SessionSidebar(props: SessionSidebarProps) {
  const {
    leftCollapsed,
    setLeftCollapsed,
    selectedProjectTitle,
    projectSessions,
    getSummaryStatus,
    showKonsolidierenSuccess,
    showTags,
    activeSession,
    getSelectionCount,
    handleSessionClick,
    moveToSession,
    copyToSession,
    sessionDeleteConfirmId,
    handleDeleteSingleSession,
    cancelSessionDelete,
    handleCopySession,
    clearSelection,
    showNewSessionSuccess,
    moveToNewSession,
    copyToNewSession,
    editingSessionId,
    editingSessionValue,
    setEditingSessionValue,
    handleConfirmEditSession,
    handleCancelEditSession,
    handleStartEditSession,
    handleBackToDashboard,
    setSettingsModalOpen,
    handleOpenNewSessionDialog,
  } = props

  return (
    <div className={`${leftCollapsed ? 'w-12' : 'w-64'} flex flex-col bg-slate-800 border-r border-slate-700 transition-all duration-300 shrink-0 z-20`}>
  {/* Top Navigation Bar */}
  <div className="p-3 border-b border-slate-700">
    {!leftCollapsed ? (
      <div className="flex items-center gap-2">
        <button
          onClick={handleBackToDashboard}
          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-medium transition-colors"
          title="Back to dashboard"
        >
          Dashboard
        </button>
        <button
          onClick={() => setSettingsModalOpen(true)}
          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-medium transition-colors"
          title="Settings"
        >
          Settings
        </button>
        <button
          onClick={() => setLeftCollapsed(true)}
          className="ml-auto p-1 text-slate-400 hover:text-slate-100 transition-colors"
          title="Collapse"
        >
          ←
        </button>
      </div>
    ) : (
      <button
        onClick={() => setLeftCollapsed(false)}
        className="p-1 text-slate-400 hover:text-slate-100 transition-colors"
        title="Expand"
      >
        →
      </button>
    )}
  </div>
  
  {/* Project Name */}
  {!leftCollapsed && (
    <div className="px-3 py-2 border-b border-slate-700">
      <div className="font-medium text-slate-100 truncate text-sm">
        {selectedProjectTitle}
      </div>
    </div>
  )}

  {/* Session List */}
  <div className="flex-1 overflow-auto p-3 space-y-2">
    {!leftCollapsed && (
      <>
        {projectSessions.map(session => {
          const summaryStatus = getSummaryStatus(session)
          const ampelColor = summaryStatus === 'none' ? 'bg-red-500' : summaryStatus === 'stale' ? 'bg-yellow-500' : 'bg-green-500'
          const hasSelection = getSelectionCount() > 0
          const isCurrentSession = session.id === activeSession
          // Show traffic light: on hover, when Tags active, or after Summary action (for current session)
          const showAmpelFeedback = showKonsolidierenSuccess && isCurrentSession
          const ampelVisible = showTags || showAmpelFeedback
          
          return (
            <div
              key={session.id}
              onClick={() => handleSessionClick(session.id)}
              draggable={!!session.summary}
              onDragStart={(e) => {
                if (session.summary) {
                  e.dataTransfer.setData('sessionId', session.id)
                  e.dataTransfer.effectAllowed = 'copy'
                } else {
                  e.preventDefault()
                }
              }}
              className={`p-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2 group ${
                isCurrentSession
                  ? 'bg-slate-700 border-2 border-blue-500'
                  : 'bg-slate-800 border-2 border-transparent hover:bg-slate-700'
              } ${session.summary ? 'cursor-move' : ''}`}
            >
              {/* Traffic Light - Hidden by default, visible on hover/tags/feedback */}
              <div 
                className={`w-2 h-2 rounded-full ${ampelColor} shrink-0 transition-opacity duration-200 ${
                  ampelVisible 
                    ? 'opacity-100' 
                    : 'opacity-0 group-hover:opacity-100'
                } ${showAmpelFeedback ? 'animate-pulse' : ''}`}
                title={
                  summaryStatus === 'none' ? 'No summary' :
                  summaryStatus === 'stale' ? 'Summary outdated' :
                  'Summary up to date'
                }
              />
              
              {/* Session Info / inline rename */}
              <div className="flex-1 min-w-0">
                {editingSessionId === session.id ? (
                  <input
                    autoFocus
                    value={editingSessionValue}
                    onChange={(e) => setEditingSessionValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleConfirmEditSession()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        handleCancelEditSession()
                      }
                    }}
                    onBlur={() => void handleConfirmEditSession()}
                    className="w-full bg-slate-900 border border-blue-500 rounded px-1.5 py-0.5 text-sm text-slate-100 focus:outline-none"
                  />
                ) : (
                  <>
                    <div
                      className="text-sm font-medium text-slate-100 truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        handleStartEditSession(session.id)
                      }}
                      title="Double-click to rename"
                    >
                      {session.title}
                    </div>
                    <div className="text-xs text-slate-400">{session.messageCount} msgs</div>
                  </>
                )}
              </div>
              
              {/* Move/Copy Buttons (inline, right side) - when selection active */}
              {hasSelection && !isCurrentSession && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      moveToSession(session.id)
                    }}
                    className="p-1 bg-slate-600 hover:bg-slate-500 rounded transition-colors active:scale-95"
                    title="Move here"
                  >
                    <svg className="w-4 h-4 text-orange-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h14M7 12l4 4m-4-4l4-4"/>
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      copyToSession(session.id)
                    }}
                    className="p-1 bg-slate-600 hover:bg-slate-500 rounded transition-colors active:scale-95"
                    title="Copy here"
                  >
                    <svg className="w-4 h-4 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 12l8-7v4h8v6h-8v4l-8-7z"/>
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Session Actions (hover) - Rename, Duplicate, Delete */}
              {!hasSelection && editingSessionId !== session.id && (
                sessionDeleteConfirmId === session.id ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSingleSession(session.id)
                      }}
                      className="px-2 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-medium transition-colors whitespace-nowrap active:scale-95"
                    >
                      ⚠️ Delete?
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        cancelSessionDelete()
                      }}
                      className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-[10px] transition-colors active:scale-95"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartEditSession(session.id)
                      }}
                      className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
                      title="Rename session"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M4 20h4.586a1 1 0 00.707-.293l9.414-9.414a2 2 0 000-2.828l-2.172-2.172a2 2 0 00-2.828 0L4.293 14.707A1 1 0 004 15.414V20z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopySession(session.id)
                      }}
                      className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
                      title="Duplicate session"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7v10M7 7a2 2 0 100-4 2 2 0 000 4zM7 17a2 2 0 100 4 2 2 0 000-4zM17 7a2 2 0 100-4 2 2 0 000 4zM17 7v4a2 2 0 01-2 2H9" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSingleSession(session.id)
                      }}
                      className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-red-900 text-slate-300 hover:text-white transition-colors active:scale-95"
                      title="Delete session"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )
              )}
            </div>
          )
        })}
      </>
    )}
  </div>

  {/* Selection Info (above New Session) */}
  {!leftCollapsed && getSelectionCount() > 0 && (
    <div className="px-3 py-2 bg-yellow-700 text-white border-t border-yellow-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">
          {getSelectionCount()} selected
        </span>
        <button
          onClick={() => clearSelection()}
          className="text-xs hover:text-yellow-300 transition-colors"
          title="Clear selection"
        >
          Clear ✕
        </button>
      </div>
    </div>
  )}

  {/* New Session Button at Bottom */}
  {!leftCollapsed && (
    <div className="p-3 border-t border-slate-700">
      <div className="flex gap-1">
        <button
          onClick={handleOpenNewSessionDialog}
          className={`flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors ${
            showNewSessionSuccess ? 'ring-2 ring-green-500' : ''
          }`}
        >
          {showNewSessionSuccess ? '✓ ' : ''}New session
        </button>
        {getSelectionCount() > 0 && (
          <>
            {/* Move to new: Outline arrow */}
            <button
              onClick={() => moveToNewSession()}
              className="px-2 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors active:scale-95"
              title="Move selection to new session"
            >
              <svg className="w-4 h-4 text-orange-300" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h14M7 12l4 4m-4-4l4-4"/>
              </svg>
            </button>
            {/* Copy to new: Filled arrow */}
            <button
              onClick={() => copyToNewSession()}
              className="px-2 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors active:scale-95"
              title="Copy selection to new session"
            >
              <svg className="w-4 h-4 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 12l8-7v4h8v6h-8v4l-8-7z"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )}
    </div>
  )
}

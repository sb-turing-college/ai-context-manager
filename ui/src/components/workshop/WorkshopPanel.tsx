import { useState } from 'react'
import type { ArtifactMode } from '../../types'
import { InlineDiffViewer } from '../InlineDiffViewer'

interface WorkshopPanelProps {
  isCollapsed: boolean
  artifactMode: ArtifactMode | null
  artifactStep: number
  artifactVersion: number
  artifactContent: string
  artifactHistory: { version: number, content: string }[]
  isThinking: boolean
  showCommitSuccess: boolean
  showVersionSaveSuccess: boolean
  isFlying: boolean
  discardConfirm: boolean
  isAudited: boolean
  // Audit workflow
  auditActive: boolean
  onStartAudit: () => void
  onTransferFeedback: () => void
  onToggleCollapse: () => void
  onNavigateVersion: (direction: 'prev' | 'next') => void
  onEditArtifact: (content: string) => void
  onSaveVersion: () => void
  onDeleteVersion: () => void
  onCommitToLibrary: () => void
  onDiscard: () => void
  onCancelDiscard: () => void
  onNewIteration?: () => void
}

export function WorkshopPanel({
  isCollapsed,
  artifactMode,
  artifactStep,
  artifactVersion,
  artifactContent,
  artifactHistory,
  isThinking,
  showCommitSuccess,
  showVersionSaveSuccess,
  isFlying,
  discardConfirm,
  isAudited,
  auditActive,
  onStartAudit,
  onTransferFeedback,
  onToggleCollapse,
  onNavigateVersion,
  onEditArtifact,
  onSaveVersion,
  onDeleteVersion,
  onCommitToLibrary,
  onDiscard,
  onCancelDiscard,
  onNewIteration
}: WorkshopPanelProps) {
  const isLocked = isThinking || isFlying
  const isReadOnly = isAudited
  const [showDiff, setShowDiff] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [commitConfirm, setCommitConfirm] = useState(false)

  // Derive filename from content (first heading or first line)
  const deriveFilename = (): string => {
    if (!artifactContent.trim()) return 'Draft'
    const lines = artifactContent.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#')) {
        const title = trimmed.replace(/^#+\s*/, '').trim()
        return title ? sanitizeFilename(title) : 'Draft'
      }
      if (trimmed.length > 0) {
        return sanitizeFilename(trimmed.length > 50 ? trimmed.substring(0, 50) : trimmed)
      }
    }
    return 'Draft'
  }
  const sanitizeFilename = (s: string): string =>
    s.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '').slice(0, 50) || 'Draft'
  
  return (
    <div className="h-full flex flex-col bg-slate-800 transition-all duration-300 relative overflow-hidden">
      {/* Workshop Header */}
      <div className={`border-b border-slate-700 bg-slate-800 flex items-center shrink-0 ${isCollapsed ? 'justify-center py-4' : 'h-11 px-4 gap-3'}`}>
        <button
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-slate-100 transition-colors text-lg"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '←' : '→'}
        </button>
        {!isCollapsed && (
          <>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">
                  Workshop {artifactMode === 'summary' && artifactStep > 0 ? '(Summary)' : artifactMode === 'draft' && artifactStep > 0 ? '(Draft)' : ''}
                </span>
                {isAudited && <span className="text-orange-400 text-xs" title="Draft is frozen (after audit)">🔒 Read-only</span>}
              </div>
              {/* New Iteration Button */}
              {isAudited && onNewIteration && (
                <button
                  onClick={onNewIteration}
                  className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                  title="Start a new iteration based on this draft"
                >
                  <span>🔄</span>
                  <span>New iteration</span>
                </button>
              )}
            </div>
            {/* Version Navigation & Actions - All in ONE row */}
            {artifactStep > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Checkpoint Button - LEFT of version navigation */}
                {!isAudited && !isThinking && !deleteConfirm && (
                  <button
                    onClick={onSaveVersion}
                    className={`px-2 py-1 rounded text-xs transition-all whitespace-nowrap bg-slate-700 hover:bg-slate-600 text-slate-200 ${
                      showVersionSaveSuccess ? 'ring-2 ring-green-500' : ''
                    }`}
                    title="Save current changes as a new version"
                  >
                    {showVersionSaveSuccess ? '✓ ' : ''}Save version
                  </button>
                )}
                
                {/* Version Navigation */}
                <button
                  onClick={() => onNavigateVersion('prev')}
                  disabled={artifactVersion === 1}
                  className={`px-1 ${artifactVersion === 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-slate-100'}`}
                  title="Previous version"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
                  v{artifactVersion}/{artifactStep}
                </span>
                <button
                  onClick={() => onNavigateVersion('next')}
                  disabled={artifactVersion === artifactStep}
                  className={`px-1 ${artifactVersion === artifactStep ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-slate-100'}`}
                  title="Next version"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Delete Button */}
                {artifactStep > 1 && !isAudited && !deleteConfirm && (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="px-2 py-1 bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-white rounded text-xs transition-colors whitespace-nowrap"
                    title="Delete version"
                  >
                    🗑️
                  </button>
                )}
                
                {/* Delete Confirmation */}
                {artifactStep > 1 && !isAudited && deleteConfirm && (
                  <>
                    <button
                      onClick={() => {
                        onDeleteVersion()
                        setDeleteConfirm(false)
                      }}
                      className="px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white rounded text-xs transition-colors whitespace-nowrap"
                      title="Really delete?"
                    >
                      ⚠️
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs transition-colors whitespace-nowrap"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </>
                )}
                
                {/* Diff Button - Always visible to prevent layout shift */}
                <button
                  onClick={() => setShowDiff(!showDiff)}
                  disabled={artifactVersion <= 1}
                  className={`px-2 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                    artifactVersion <= 1
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : showDiff 
                        ? 'bg-slate-600 text-white' 
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                  title={artifactVersion <= 1 
                    ? 'No previous version to compare' 
                    : showDiff 
                      ? 'Hide changes' 
                      : 'Show changes from previous version'}
                >
                  Diff
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Editor Area - Summary indicator is in chat, not here */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-4">
          <div className="h-full bg-slate-800 rounded-lg border border-slate-600 p-4">
            {artifactStep > 0 && (
              <div className="text-xs font-mono text-slate-400 mb-2">
                {deriveFilename()}_v{artifactVersion}.md
              </div>
            )}
            {showDiff && artifactVersion > 1 ? (
              <InlineDiffViewer
                oldContent={artifactHistory?.[artifactVersion - 2]?.content || ''}
                newContent={
                  artifactVersion === artifactStep
                    ? artifactContent
                    : (artifactHistory?.[artifactVersion - 1]?.content || '')
                }
                oldLabel={`Version ${artifactVersion - 1}`}
                newLabel={`Version ${artifactVersion}${artifactVersion === artifactStep ? ' (Live)' : ''}`}
              />
            ) : (
              <textarea
                  className={`w-full h-[calc(100%-2rem)] bg-slate-700 border border-slate-600 rounded p-3 text-sm text-slate-200 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-opacity ${
                    (artifactStep === 0 || isLocked || isReadOnly) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  placeholder={isReadOnly ? "This draft is frozen. Click 'New iteration' to continue working." : "Your draft will appear here..."}
                  value={artifactContent}
                  onChange={(e) => onEditArtifact(e.target.value)}
                  disabled={artifactStep === 0 || isLocked || isReadOnly}
                  readOnly={isReadOnly}
                />
              )}
            </div>
          </div>
      )}

      {/* Action Buttons */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-700 bg-slate-800 space-y-2">
          {/* Button 1: Audit / Transfer feedback (Toggle) */}
          <button 
            onClick={auditActive ? onTransferFeedback : onStartAudit}
            disabled={artifactStep === 0 || isLocked}
            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              artifactStep === 0 || isLocked
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : auditActive
                  ? 'bg-blue-900 hover:bg-blue-800 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {auditActive ? (
              <>
                <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7 7-7M21 12H3" />
                </svg>
                Transfer feedback
              </>
            ) : (
              <>
                Audit
                <svg className="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7-7 7M3 12h18" />
                </svg>
              </>
            )}
          </button>

          {/* Button 2: Save to documents (with 2-step confirmation) */}
          {!commitConfirm ? (
            <button 
              onClick={() => setCommitConfirm(true)}
              disabled={artifactStep === 0 || isLocked || isReadOnly}
              className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                artifactStep === 0 || isLocked || isReadOnly
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              } ${showCommitSuccess ? 'ring-2 ring-green-500' : ''}`}
            >
              <span>{showCommitSuccess ? '✓' : ''}</span>
              <span>Save to documents</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  onCommitToLibrary()
                  setCommitConfirm(false)
                }}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ⚠️ Save?
              </button>
              <button 
                onClick={() => setCommitConfirm(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {/* Button 3: Discard (with 2-Step Confirmation) */}
          {!discardConfirm ? (
            <button 
              onClick={onDiscard}
              disabled={artifactStep === 0 || isLocked || isReadOnly}
              className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                artifactStep === 0 || isLocked || isReadOnly
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              Discard
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={onDiscard}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ⚠️ Really discard?
              </button>
              <button 
                onClick={onCancelDiscard}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

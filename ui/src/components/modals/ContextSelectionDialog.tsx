import { useState } from 'react'
import type { Session, SessionId } from '../../types'
import { ContentViewModal } from './ContentViewModal'
import { getSessionSummary } from '../../services/sessionService'

interface ContextSelectionDialogProps {
  allSessions: Session[]
  currentSessionId: SessionId
  selectedSummaries: SessionId[]
  onToggleSummary: (sessionId: SessionId) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ContextSelectionDialog({
  allSessions,
  currentSessionId,
  selectedSummaries,
  onToggleSummary,
  onConfirm,
  onCancel
}: ContextSelectionDialogProps) {
  // Summary preview modal state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSession, setPreviewSession] = useState<Session | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Get summary status (🔴🟡🟢)
  const getSummaryStatus = (session: Session): '🔴' | '🟡' | '🟢' => {
    if (!session.summaryStatus || session.summaryStatus === 'none') return '🔴'
    if (session.summaryStatus === 'outdated') return '🟡'
    return '🟢' // 'current'
  }
  
  // Check if session has a summary
  const hasSummary = (session: Session): boolean => {
    return session.summaryStatus !== undefined && session.summaryStatus !== 'none'
  }

  // Available sessions (have summaries, not current session)
  const availableSessions = allSessions.filter(
    s => s.id !== currentSessionId && hasSummary(s)
  )

  const selectedCount = selectedSummaries.length

  // Handle preview click
  const handlePreviewClick = async (session: Session, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setPreviewSession(session)
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewContent('')
    
    try {
      const content = await getSessionSummary(session.id)
      setPreviewContent(content || 'No content available.')
    } catch (error) {
      console.error('Failed to load summary:', error)
      setPreviewContent('Error loading the summary.')
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-slate-700">
          {/* Header */}
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">
              Import summaries as context
            </h2>
            <p className="text-sm text-slate-400">
              Select summaries from other sessions to attach to this session as context.
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {availableSessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">
                  No summaries available in other sessions
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  Erstelle Summaries in anderen Sessions via "Summary" Button
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableSessions.map((session) => {
                  const isSelected = selectedSummaries.includes(session.id)
                  const status = getSummaryStatus(session)
                  
                  return (
                    <div
                      key={session.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-blue-900/30 border-blue-700'
                          : 'bg-slate-750 border-slate-700'
                      }`}
                    >
                      <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSummary(session.id)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">
                              {status} {session.title}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({session.messageCount} messages)
                            </span>
                          </div>
                        </div>
                      </label>
                      {/* Preview Button */}
                      <button
                        onClick={(e) => handlePreviewClick(session, e)}
                        className="px-2 py-1 text-xs text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                        title="Show preview"
                      >
                        Ansehen
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-700 flex items-center justify-between">
            <div className="text-sm text-slate-400">
              {selectedCount > 0 ? (
                <span>{selectedCount} summar{selectedCount !== 1 ? 'ies' : 'y'} selected</span>
              ) : (
                <span>No summaries selected</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Preview Modal */}
      <ContentViewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewSession ? `Summary: ${previewSession.title}` : 'Summary'}
        subtitle={previewSession ? `Status: ${getSummaryStatus(previewSession)} ${previewSession.summaryStatus === 'outdated' ? '(outdated)' : previewSession.summaryStatus === 'current' ? '(current)' : ''}` : undefined}
        content={previewLoading ? 'Loading...' : previewContent}
      />
    </>
  )
}

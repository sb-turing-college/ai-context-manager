import { useState, useRef } from 'react'
import type { Session, SessionId } from '../../types'
import { ContentViewModal } from '../modals/ContentViewModal'
import { getSessionSummary } from '../../services/sessionService'

interface SummariesPanelProps {
  currentSessionId: SessionId
  allSessions: Session[]
  selectedSummaries: SessionId[]
  onAddSummary: (sessionId: SessionId) => void
  onRemoveSummary: (sessionId: SessionId) => void
  onExportSummary: (sessionId: SessionId) => void
  onOpenImportDialog: () => void
  exportSuccessId: SessionId | null
}

export function SummariesPanel({
  currentSessionId,
  allSessions,
  selectedSummaries,
  onAddSummary,
  onRemoveSummary,
  onExportSummary,
  onOpenImportDialog,
  exportSuccessId
}: SummariesPanelProps) {
  const [removeConfirmId, setRemoveConfirmId] = useState<SessionId | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)
  
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
  
  // Check if session has a summary (for filtering available sessions)
  const hasSummary = (session: Session): boolean => {
    return session.summaryStatus !== undefined && session.summaryStatus !== 'none'
  }

  // Get selected sessions data
  const selectedSessionsData = allSessions.filter(s => selectedSummaries.includes(s.id))

  // Flexible width (rem-based, scales with font size) - same as LibraryPanel
  const CONTENT_MAX_WIDTH = 'max-w-64'  // 16rem

  // Handle click on summary item to open preview
  const handleSummaryClick = async (session: Session) => {
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

  const handleRemoveClick = (sessionId: SessionId, e: React.MouseEvent) => {
    e.stopPropagation()
    if (removeConfirmId === sessionId) {
      // Second click - actually remove
      onRemoveSummary(sessionId)
      setRemoveConfirmId(null)
    } else {
      // First click - show confirmation
      setRemoveConfirmId(sessionId)
    }
  }

  const handleCancelRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRemoveConfirmId(null)
  }

  const handleExportClick = (sessionId: SessionId, e: React.MouseEvent) => {
    e.stopPropagation()
    onExportSummary(sessionId)
  }

  // Drag & Drop handlers with counter to handle nested elements
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    dragCounter.current++
    
    const sessionId = e.dataTransfer.types.includes('sessionid') || e.dataTransfer.types.includes('text/plain')
    if (sessionId) {
      e.dataTransfer.dropEffect = 'copy'
      setDragOver(true)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    dragCounter.current--
    
    // Only hide if we've left all nested elements
    if (dragCounter.current === 0) {
      setDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    dragCounter.current = 0
    setDragOver(false)

    const sessionId = e.dataTransfer.getData('sessionId')
    if (!sessionId) return

    const session = allSessions.find(s => s.id === sessionId)
    
    // Only allow sessions with summaries
    if (session && hasSummary(session) && session.id !== currentSessionId) {
      // Don't add if already selected
      if (!selectedSummaries.includes(sessionId as SessionId)) {
        onAddSummary(sessionId as SessionId)
      }
    }
  }

  const renderSummaryItem = (session: Session) => {
    const status = getSummaryStatus(session)
    
    return (
      <div 
        key={session.id} 
        className={`flex items-center gap-1 ${CONTENT_MAX_WIDTH}`}
      >
        {removeConfirmId === session.id ? (
          // Delete Confirmation Mode
          <div className="flex items-center gap-1">
            <span className="text-xs text-orange-400">
              ⚠️ Remove?
            </span>
            <button
              onClick={(e) => handleRemoveClick(session.id, e)}
              className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] transition-colors"
            >
              Remove
            </button>
            <button
              onClick={handleCancelRemove}
              className="px-2 py-0.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-[10px] transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          // Normal Mode - clickable to open preview
          <>
            <button 
              onClick={() => handleSummaryClick(session)}
              className="flex-1 flex items-center px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-left cursor-pointer"
              title="Click to show"
            >
              <span className="text-xs text-slate-300 truncate">
                {status} {session.title}
              </span>
            </button>
            {/* Action Links - same style as library */}
            <button
              onClick={(e) => handleExportClick(session.id, e)}
              className={`text-xs text-slate-400 hover:text-blue-400 transition-colors ${
                exportSuccessId === session.id ? 'text-green-400' : ''
              }`}
            >
              {exportSuccessId === session.id ? '✓ Export' : 'Export'}
            </button>
            <button
              onClick={(e) => handleRemoveClick(session.id, e)}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div 
        className="p-3 space-y-2 relative min-h-[200px]"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drop Zone Indicator - Overlay */}
        {dragOver && (
          <div className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-lg bg-blue-900/20 flex items-center justify-center pointer-events-none z-10">
            <p className="text-xs text-blue-400 font-medium">
              📄 Drop session here to import
            </p>
          </div>
        )}

        {/* Import Button - same style as library */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={onOpenImportDialog}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-300 transition-colors"
          >
            Summaries import
          </button>
        </div>

        {/* Horizontal line separator */}
        {selectedSessionsData.length > 0 && (
          <div className="border-t border-slate-700 my-2"></div>
        )}

        {/* Selected Summaries */}
        <div className="space-y-1">
          {selectedSessionsData.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">
              No summaries imported yet
            </p>
          ) : (
            selectedSessionsData.map(renderSummaryItem)
          )}
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

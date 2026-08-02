import { useState } from 'react'
import type { ToolCallResult } from '../../types'
import { VersionNavigator } from '../common'
import { InlineDiffViewer } from '../InlineDiffViewer'

interface ToolCallBlockProps {
  messageId: string
  toolCallData: ToolCallResult
  onToggleExpand: (messageId: string) => void
  onCreateDraft?: (title: string, content: string) => void
}

/**
 * Displays a tool call result in the chat
 * 
 * Features:
 * - Collapsible (default: collapsed, shows one line)
 * - Shows current value when expanded
 * - Version history navigation
 * - Diff view between versions
 * - AI reason displayed
 */
export function ToolCallBlock({
  messageId,
  toolCallData,
  onToggleExpand,
  onCreateDraft
}: ToolCallBlockProps) {
  const { toolCall, success, reason, previousValue, newValue, history = [], isExpanded } = toolCallData
  
  // Handle create_draft tool automatically
  const isDraftTool = toolCall.tool === 'create_draft'
  const draftTitle = isDraftTool && typeof toolCall.params.title === 'string' 
    ? toolCall.params.title 
    : ''
  const draftContent = isDraftTool && typeof toolCall.params.content === 'string' 
    ? toolCall.params.content 
    : ''
  
  // Local version navigation state
  const [currentVersion, setCurrentVersion] = useState(history.length || 1)
  const [showDiff, setShowDiff] = useState(false)
  
  const totalVersions = history.length || 1
  const isAtFirst = currentVersion === 1
  const isAtLast = currentVersion === totalVersions
  
  // Get tool display info
  const toolInfo = getToolDisplayInfo(toolCall.tool)
  const topicName = getTopicName(toolCall)
  
  // Get content for current version
  const getCurrentContent = (): string => {
    if (history.length === 0) {
      return formatValue(newValue)
    }
    const entry = history[currentVersion - 1]
    return entry ? formatValue(entry.newValue) : formatValue(newValue)
  }
  
  // Get previous content for diff
  const getPreviousContent = (): string => {
    if (currentVersion <= 1) {
      return formatValue(previousValue)
    }
    if (history.length === 0) {
      return formatValue(previousValue)
    }
    const prevEntry = history[currentVersion - 2]
    return prevEntry ? formatValue(prevEntry.newValue) : formatValue(previousValue)
  }

  return (
    <div className="my-2">
      {/* Collapsed Header (always visible) */}
      <button
        onClick={() => onToggleExpand(messageId)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          success
            ? 'bg-slate-700 hover:bg-slate-600 border border-slate-600'
            : 'bg-red-900/30 hover:bg-red-900/40 border border-red-800'
        }`}
      >
        {/* Tool Icon */}
        <span className="text-sm">{toolInfo.icon}</span>
        
        {/* Tool Label + Topic */}
        <span className="text-xs text-slate-300 flex-1 text-left truncate">
          <span className="font-medium">{toolInfo.label}:</span>
          <span className="text-slate-400 ml-1">"{topicName}"</span>
        </span>
        
        {/* Expand/Collapse Indicator */}
        <span className="text-slate-500 text-xs">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-1 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
          {/* Current Value Header with Version Navigation */}
          <div className="p-3 border-b border-slate-700">
            {/* Title row with version controls - stable position */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    Current value
              </span>
              
              {/* Version Navigation in title row (stable, doesn't jump) */}
              {totalVersions > 1 && (
                <VersionNavigator
                  currentVersion={currentVersion}
                  totalVersions={totalVersions}
                  showDiff={showDiff}
                  onPrevious={() => !isAtFirst && setCurrentVersion(v => v - 1)}
                  onNext={() => !isAtLast && setCurrentVersion(v => v + 1)}
                  onToggleDiff={() => setShowDiff(!showDiff)}
                  size="sm"
                />
              )}
            </div>
            
            {/* Content area - FIXED HEIGHT to prevent jumping */}
            <div className="max-h-32 overflow-auto">
              {showDiff && currentVersion > 1 ? (
                <InlineDiffViewer
                  oldContent={getPreviousContent()}
                  newContent={getCurrentContent()}
                  oldLabel={`v${currentVersion - 1}`}
                  newLabel={`v${currentVersion}`}
                />
              ) : (
                <div className="bg-slate-900 rounded p-2 text-sm text-slate-200 font-mono">
                  {getCurrentContent()}
                </div>
              )}
            </div>
          </div>

          {/* Create Draft Button (for create_draft tool) */}
          {isDraftTool && success && onCreateDraft && (
            <div className="p-3 border-t border-slate-700">
              <button
                onClick={() => onCreateDraft(draftTitle, draftContent)}
                className="w-full px-3 py-2 bg-blue-900 hover:bg-blue-800 border border-blue-800 rounded-lg text-xs text-slate-200 transition-colors"
              >
                📝 Open draft in workshop
              </button>
            </div>
          )}

          {/* Reason (AI's explanation) */}
          {reason && (
            <div className="p-3 bg-slate-850">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                📝 Reason
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {reason}
              </p>
            </div>
          )}
          
          {/* Error message if failed */}
          {!success && toolCallData.error && (
            <div className="p-3 bg-red-900/20 border-t border-red-800">
              <div className="text-[10px] uppercase tracking-wider text-red-400 mb-1">
                ⚠️ Error
              </div>
              <p className="text-xs text-red-300">
                {toolCallData.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Display icon/label for a tool name (shared with LiveProgressBubble). */
export function getToolDisplayInfo(tool: string): { icon: string; label: string } {
  switch (tool) {
    case 'create_status':
      return { icon: '🔧', label: 'Status created' }
    case 'update_status':
      return { icon: '🔧', label: 'Status update' }
    case 'delete_status':
      return { icon: '🗑️', label: 'Status deleted' }
    case 'read_status':
      return { icon: '📖', label: 'Status read' }
    case 'search_documents':
      return { icon: '🔍', label: 'Documents searched' }
    case 'read_document':
      return { icon: '📄', label: 'Document read' }
    case 'create_draft':
      return { icon: '📝', label: 'Draft created' }
    case 'edit_draft':
      return { icon: '✏️', label: 'Draft edit' }
    case 'upsert_user_fact':
      return { icon: '👤', label: 'User fact' }
    case 'delete_user_fact':
      return { icon: '👤', label: 'User fact deleted' }
    case 'search_past_sessions':
      return { icon: '🔎', label: 'Session search' }
    default:
      return { icon: '🔧', label: tool.replace(/_/g, ' ') }
  }
}

// Helper: Extract topic name from tool call params
function getTopicName(toolCall: { tool: string; params: Record<string, unknown> }): string {
  const { params } = toolCall
  
  // Try common param names
  if (params.title && typeof params.title === 'string') return params.title
  if (params.topicName && typeof params.topicName === 'string') return params.topicName
  if (params.name && typeof params.name === 'string') return params.name
  if (params.query && typeof params.query === 'string') return params.query
  if (params.documentTitle && typeof params.documentTitle === 'string') return params.documentTitle
  
  // Fallback
  return 'Unknown'
}

// Helper: Format value for display
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toLocaleString('en-US')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

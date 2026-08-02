import { useState } from 'react'

interface DraftBlockProps {
  messageId: string
  draftVersion: number
  content: string
  timestamp: string
  isExpanded: boolean
  onToggleExpand: (messageId: string) => void
  // Selection props (same as messages)
  showTags: boolean
  isSelected: boolean
  selectionActive: boolean
  onToggleSelect: () => void
  onSelectFromHere: () => void
  onCopyToClipboard: () => void
  onDeleteMessage: () => void
  index: number
}

export function DraftBlock({ 
  messageId, 
  draftVersion, 
  content, 
  timestamp, 
  isExpanded, 
  onToggleExpand,
  showTags: _showTags,
  isSelected,
  selectionActive,
  onToggleSelect,
  onSelectFromHere,
  onCopyToClipboard,
  onDeleteMessage
}: DraftBlockProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopy = () => {
    if (selectionActive) {
      onCopyToClipboard()
    } else {
      navigator.clipboard.writeText(`[Draft V${draftVersion}]\n\n${content}`)
    }
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 1000)
  }

  // Extract title from content (first line or "Draft")
  const getTitle = () => {
    const firstLine = content.split('\n')[0]
    if (firstLine.startsWith('#')) {
      return firstLine.replace(/^#+\s*/, '')
    }
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine
  }

  return (
    <div className="flex gap-3 justify-start group my-4">
      <div className={`relative max-w-[80%] ml-2 ${isSelected ? 'ring-2 ring-yellow-600 rounded-lg' : ''}`}>
        {/* Header - Clickable to expand/collapse */}
        <button
          onClick={() => onToggleExpand(messageId)}
          className="w-full px-4 py-3 bg-emerald-900/30 hover:bg-emerald-900/40 border border-emerald-700/50 rounded-lg transition-colors flex items-center justify-between select-none"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-emerald-200">
              📝 Draft V{draftVersion}
            </span>
            <span className="text-xs text-slate-400 truncate max-w-[200px]">
              {getTitle()}
            </span>
            <span className="text-xs text-slate-500">
              {timestamp}
            </span>
          </div>
          <span className="text-slate-500 text-xs">
            {isExpanded ? '−' : '+'}
          </span>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-2 border border-emerald-700/30 rounded-lg bg-slate-800/50 overflow-hidden select-text">
            <div className="max-h-96 overflow-auto p-4 text-sm text-slate-200">
              <pre className="whitespace-pre-wrap font-sans">{content}</pre>
            </div>
          </div>
        )}

        {/* Hover Action Toolbar */}
        <div className="absolute -bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {!deleteConfirm ? (
            <>
              {/* Select Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSelect()
                }}
                className={`p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 transition-colors active:scale-95 ${
                  isSelected ? 'text-yellow-600 border-yellow-600' : 'text-slate-300'
                }`}
                title={isSelected ? 'Deselect' : 'Select'}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isSelected ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <rect x="4" y="4" width="16" height="16" strokeWidth={2} rx="2" />
                  )}
                </svg>
              </button>

              {/* Select from here */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectFromHere()
                }}
                className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
                title="Select from here (toggle)"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Copy */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopy()
                }}
                className={`p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95 ${
                  copySuccess ? 'ring-2 ring-green-500' : ''
                }`}
                title={selectionActive ? 'Copy all selected' : 'Copy draft'}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>

              {/* Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirm(true)
                }}
                className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-red-900 text-slate-300 hover:text-white transition-colors active:scale-95"
                title="Delete draft block"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          ) : (
            <>
              {/* Confirm Delete */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteMessage()
                  setDeleteConfirm(false)
                }}
                className="px-2 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-medium transition-colors whitespace-nowrap active:scale-95"
              >
                ⚠️ Delete?
              </button>
              {/* Cancel */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirm(false)
                }}
                className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-[10px] transition-colors active:scale-95"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

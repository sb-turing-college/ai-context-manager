import { useState, useEffect } from 'react'
import type { LibraryItem } from '../../types'
import { InlineDiffViewer } from '../InlineDiffViewer'

interface LibraryViewModalProps {
  isOpen: boolean
  onClose: () => void
  item: LibraryItem | null
  onEditItem: () => void
  onCopyItem: () => void
  onExportAsPDF: (itemId: string) => void
  onRenameItem: (itemId: string, newTitle: string) => void | Promise<void>
  copySuccess: boolean
  artifactFallback?: string
}

export function LibraryViewModal({
  isOpen,
  onClose,
  item,
  onEditItem,
  onCopyItem,
  onExportAsPDF,
  onRenameItem,
  copySuccess,
  artifactFallback = 'No content available.'
}: LibraryViewModalProps) {
  const totalVersions = item ? (item.history?.length || 0) + 1 : 1
  const [currentVersion, setCurrentVersion] = useState(() => totalVersions)
  const [showDiff, setShowDiff] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)

  // On open/item change: always show newest version (v4/4 instead of v1/4)
  useEffect(() => {
    if (item && isOpen) {
      setCurrentVersion(totalVersions)
      setShowDiff(false)
      setIsRenaming(false)
      setRenameValue(item.title)
    }
  }, [item?.id, item?.title, isOpen, totalVersions])
  
  if (!isOpen || !item) return null
  const displayContent = currentVersion === totalVersions 
    ? item.content 
    : item.history?.[currentVersion - 1]?.content || item.content

  const confirmRename = async () => {
    const next = renameValue.trim()
    if (!next || next === item.title) {
      setIsRenaming(false)
      setRenameValue(item.title)
      return
    }
    setRenameBusy(true)
    try {
      await onRenameItem(item.id, next)
      setIsRenaming(false)
    } catch {
      // Parent shows alert; keep rename UI open
    } finally {
      setRenameBusy(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-3xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0 flex-1 mr-4">
            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void confirmRename()
                      if (e.key === 'Escape') {
                        setIsRenaming(false)
                        setRenameValue(item.title)
                      }
                    }}
                    autoFocus
                    disabled={renameBusy}
                    className="flex-1 px-2 py-1 bg-slate-700 border border-blue-600 rounded text-lg font-semibold text-slate-100 focus:outline-none"
                  />
                  <button
                    onClick={() => void confirmRename()}
                    disabled={renameBusy}
                    className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-xs transition-colors disabled:opacity-50"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => {
                      setIsRenaming(false)
                      setRenameValue(item.title)
                    }}
                    disabled={renameBusy}
                    className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs transition-colors disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 min-w-0">
                  <h3 className="text-lg font-semibold text-slate-100 truncate">{item.title}</h3>
                  <button
                    onClick={() => {
                      setRenameValue(item.title)
                      setIsRenaming(true)
                    }}
                    className="shrink-0 text-xs text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    Rename
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">{item.timestamp}</p>
            </div>
            
            {/* Version Navigation */}
            {totalVersions > 1 && (
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button
                  onClick={() => setCurrentVersion(Math.max(1, currentVersion - 1))}
                  disabled={currentVersion === 1}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous version"
                >
                  ◀
                </button>
                <span className="text-xs text-slate-400 font-mono">
                  v{currentVersion}/{totalVersions}
                </span>
                <button
                  onClick={() => setCurrentVersion(Math.min(totalVersions, currentVersion + 1))}
                  disabled={currentVersion === totalVersions}
                  className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next version"
                >
                  ▶
                </button>
                
                {/* Diff Button - Always visible to prevent layout shift */}
                <button
                  onClick={() => setShowDiff(!showDiff)}
                  disabled={currentVersion <= 1}
                  className={`ml-2 px-2 py-1 rounded text-xs transition-colors ${
                    currentVersion <= 1
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : showDiff 
                        ? 'bg-blue-900 text-white' 
                        : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                  }`}
                  title={currentVersion <= 1 
                    ? 'No previous version to compare' 
                    : showDiff 
                      ? 'Show text' 
                      : 'Show changes from previous version'}
                >
                  {showDiff ? 'Show text' : 'Changes'}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-2xl shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto p-6">
          {showDiff && currentVersion > 1 ? (
            <InlineDiffViewer
              oldContent={item.history?.[currentVersion - 2]?.content || ''}
              newContent={displayContent || artifactFallback}
              oldLabel={`Version ${currentVersion - 1}`}
              newLabel={`Version ${currentVersion}`}
            />
          ) : (
            <pre className="bg-slate-800 border border-slate-600 rounded-lg p-4 text-sm text-slate-200 font-mono whitespace-pre-wrap">
              {displayContent || artifactFallback}
            </pre>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800">
          <div className="flex gap-3 mb-3">
            {item.type !== 'pdf' && (
              <button
                onClick={onEditItem}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
              >
                Edit in workshop
              </button>
            )}
            <button
              onClick={onCopyItem}
              className={`flex-1 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors ${
                copySuccess ? 'ring-2 ring-green-500' : ''
              }`}
            >
              {copySuccess ? '✓ ' : ''}Copy
            </button>
          </div>
          <div className="flex gap-3">
            {item.type !== 'pdf' && (
              <button
                onClick={() => onExportAsPDF(item.id)}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
              >
                Export
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'

interface ContentViewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  content: string
  onCopy?: () => void
  copySuccess?: boolean
}

/**
 * Generic modal for viewing text content (Summaries, etc.)
 * Simplified version of LibraryViewModal without versioning.
 */
export function ContentViewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  content,
  onCopy,
  copySuccess = false
}: ContentViewModalProps) {
  const [localCopySuccess, setLocalCopySuccess] = useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    if (onCopy) {
      onCopy()
    } else {
      navigator.clipboard.writeText(content)
      setLocalCopySuccess(true)
      setTimeout(() => setLocalCopySuccess(false), 1500)
    }
  }

  const showCopySuccess = copySuccess || localCopySuccess

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
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto p-6">
          <pre className="bg-slate-800 border border-slate-600 rounded-lg p-4 text-sm text-slate-200 font-mono whitespace-pre-wrap">
            {content || 'No content available.'}
          </pre>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800 flex gap-3">
          <button
            onClick={handleCopy}
            className={`flex-1 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors ${
              showCopySuccess ? 'ring-2 ring-green-500' : ''
            }`}
          >
            {showCopySuccess ? '✓ Copied!' : 'Copy'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'

interface CreateDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateDocument: (title: string, content: string) => Promise<void>
}

export function CreateDocumentModal({
  isOpen,
  onClose,
  onCreateDocument
}: CreateDocumentModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('')
      setContent('')
      setError(null)
      setIsCreating(false)
    }
  }, [isOpen])

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Please enter a title.')
      return
    }

    if (!content.trim()) {
      setError('Please enter content.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      await onCreateDocument(title.trim(), content.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating the document')
    } finally {
      setIsCreating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
    // Ctrl/Cmd + Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleCreate()
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">New document</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-2xl transition-colors"
            disabled={isCreating}
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="px-4 py-3 bg-red-900 bg-opacity-50 border border-red-700 rounded text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Project plan, notes, ..."
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              disabled={isCreating}
              autoFocus
            />
          </div>

          {/* Content Textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Content *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your document here..."
              rows={12}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y font-mono text-sm"
              disabled={isCreating}
            />
            <p className="text-xs text-slate-500 mt-1">
              Markdown is supported. Ctrl/Cmd + Enter to save.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isCreating || !title.trim() || !content.trim()}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

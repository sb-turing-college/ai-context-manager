import { useState } from 'react'
import type { UserFactItem, UserFactCategory } from '../../types'

const CATEGORY_OPTIONS: { value: UserFactCategory; label: string }[] = [
  { value: 'preference', label: 'Preferences' },
  { value: 'style', label: 'Kommunikationsstil' },
  { value: 'expertise', label: 'Expertise' },
  { value: 'context', label: 'Context & role' }
]

interface UserFactsPanelProps {
  facts: UserFactItem[]
  onCreateFact: (title: string, content: string, category: UserFactCategory) => void
  onUpdateFact: (factId: string, title: string, content: string, category: UserFactCategory) => void
  onDeleteFact: (factId: string) => void
}

export function UserFactsPanel({
  facts,
  onCreateFact,
  onUpdateFact,
  onDeleteFact
}: UserFactsPanelProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingFactId, setEditingFactId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [expandedFactId, setExpandedFactId] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<UserFactCategory>('preference')

  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState<UserFactCategory>('preference')

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) return
    onCreateFact(newTitle, newContent, newCategory)
    setIsCreating(false)
    setNewTitle('')
    setNewContent('')
    setNewCategory('preference')
  }

  const handleStartEdit = (fact: UserFactItem) => {
    setEditingFactId(fact.id)
    setEditTitle(fact.title)
    setEditContent(fact.content)
    setEditCategory(fact.category)
    setExpandedFactId(null)
  }

  const handleSaveEdit = (factId: string) => {
    if (!editTitle.trim() || !editContent.trim()) return
    onUpdateFact(factId, editTitle, editContent, editCategory)
    setEditingFactId(null)
  }

  const handleCancelEdit = () => {
    setEditingFactId(null)
  }

  return (
    <div>
      <div className="px-3 py-2 flex justify-end">
        {!isCreating && !editingFactId && (
          <button
            onClick={() => setIsCreating(true)}
            className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
            title="Add new fact"
          >
            + Neu
          </button>
        )}
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Create Form */}
        {isCreating && (
          <div className="border border-slate-600 rounded p-3 bg-slate-800 space-y-2">
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as UserFactCategory)}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Title (e.g. communication style)..."
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100"
              autoFocus
            />
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Content..."
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100 resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || !newContent.trim()}
                className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-xs font-medium transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewTitle('')
                  setNewContent('')
                  setNewCategory('preference')
                }}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Facts */}
        <div className="space-y-1">
          {facts.map(fact => (
                <div key={fact.id}>
                  {editingFactId === fact.id ? (
                    <div className="p-3 bg-slate-800 border border-slate-600 rounded space-y-2">
                      <select
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value as UserFactCategory)}
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100"
                      >
                        {CATEGORY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        placeholder="Title..."
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100"
                        autoFocus
                      />
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        placeholder="Content..."
                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100 resize-none"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(fact.id)}
                          disabled={!editTitle.trim() || !editContent.trim()}
                          className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-xs font-medium transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 group">
                        <button
                          onClick={() => setExpandedFactId(expandedFactId === fact.id ? null : fact.id)}
                          className="flex-1 flex items-center px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-left"
                        >
                          <span className="text-xs text-slate-300 truncate">{fact.title}</span>
                        </button>
                        <button
                          onClick={() => handleStartEdit(fact)}
                          className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          Edit
                        </button>
                        {deleteConfirmId === fact.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                onDeleteFact(fact.id)
                                setDeleteConfirmId(null)
                              }}
                              className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-medium transition-colors whitespace-nowrap"
                            >
                              Delete?
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-[10px] font-medium transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(fact.id)}
                            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      {expandedFactId === fact.id && (
                        <div className="ml-4 mt-1 p-2 bg-slate-800/50 rounded border-l-2 border-slate-600">
                          <div className="text-xs text-slate-200 whitespace-pre-wrap">{fact.content}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
          ))}
        </div>

        {facts.length === 0 && !isCreating && (
          <p className="text-center text-slate-500 text-xs py-3">
            No user facts saved yet.
          </p>
        )}
      </div>
    </div>
  )
}

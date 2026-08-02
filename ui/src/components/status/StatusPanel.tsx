import { useState } from 'react'
import type { StatusTopic, StatusTopicItem } from '../../types'
import { StatusHistoryModal } from '../modals/StatusHistoryModal'

interface StatusPanelProps {
  openTopic: StatusTopic
  statusTopics: StatusTopicItem[]
  onToggleTopic: (topicId: string | null) => void
  onCreateTopic: (title: string, content: string) => void
  onUpdateTopic: (topicId: string, title: string, content: string) => void
  onDeleteTopic: (topicId: string) => void
}

export function StatusPanel({ 
  openTopic, 
  statusTopics,
  onToggleTopic,
  onCreateTopic,
  onUpdateTopic,
  onDeleteTopic
}: StatusPanelProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) return
    onCreateTopic(newTitle, newContent)
    setIsCreating(false)
    setNewTitle('')
    setNewContent('')
  }

  const handleStartEdit = (topic: StatusTopicItem) => {
    setEditingTopicId(topic.id)
    setEditTitle(topic.title)
    setEditContent(topic.content)
  }

  const handleSaveEdit = (topicId: string) => {
    if (!editTitle.trim() || !editContent.trim()) return
    onUpdateTopic(topicId, editTitle, editContent)
    setEditingTopicId(null)
    setEditTitle('')
    setEditContent('')
  }

  const handleCancelEdit = () => {
    setEditingTopicId(null)
    setEditTitle('')
    setEditContent('')
  }

  return (
    <div className="p-3 space-y-2">
      {/* Create / History — panel-level actions */}
      {!isCreating && !editingTopicId && (
        <div className="flex gap-2">
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-300 transition-colors"
          >
            New topic
          </button>
          <button
            onClick={() => setHistoryOpen(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-300 transition-colors"
          >
            History
          </button>
        </div>
      )}

      <StatusHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        statusTopics={statusTopics}
      />

      {/* Create Form */}
      {isCreating && (
        <div className="border border-slate-600 rounded p-3 bg-slate-800 space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title..."
            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100"
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
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
              }}
              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Topic Items - same style as Library items */}
      {statusTopics.map((topic) => (
        <div key={topic.id}>
          {editingTopicId === topic.id ? (
            // Edit Mode - full width form
            <div className="p-3 bg-slate-800 border border-slate-600 rounded space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title..."
                className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100"
                autoFocus
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Content..."
                className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-100 resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEdit(topic.id)}
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
            // View Mode - same style as Library items
            <div className="flex items-center gap-2 group">
              {/* Title Button - expandable */}
              <button
                onClick={() => onToggleTopic(openTopic === topic.id ? null : topic.id)}
                className="flex-1 flex items-center px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-left"
              >
                <span className="text-xs text-slate-300 truncate">
                  {topic.title}
                </span>
              </button>
              
              {/* Text Action Links - same style as Library */}
              <button
                onClick={() => handleStartEdit(topic)}
                className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
              >
                Edit
              </button>
              {deleteConfirmId === topic.id ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      onDeleteTopic(topic.id)
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
                  onClick={() => setDeleteConfirmId(topic.id)}
                  className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          )}
          
          {/* Expanded Content - only when expanded and not editing */}
          {openTopic === topic.id && editingTopicId !== topic.id && (
            <div className="ml-4 mt-1 p-2 bg-slate-800/50 rounded border-l-2 border-slate-600">
              <div className="text-xs text-slate-200 whitespace-pre-wrap">
                {topic.content}
              </div>
            </div>
          )}
        </div>
      ))}

      {statusTopics.length === 0 && !isCreating && (
        <p className="text-center text-slate-500 text-xs py-4">
          No topics yet.
        </p>
      )}
    </div>
  )
}

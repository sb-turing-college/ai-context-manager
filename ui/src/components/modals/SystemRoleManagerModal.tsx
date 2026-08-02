import React from 'react'
import type { SystemRole, SystemRoleCategory } from '../../types'

interface SystemRoleManagerModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCategory: SystemRoleCategory
  onCategoryChange: (category: SystemRoleCategory) => void
  chatRoles: SystemRole[]
  auditRoles: SystemRole[]
  editingRole: SystemRole | null
  editingTitle: string
  editingContent: string
  onEditTitleChange: (value: string) => void
  onEditContentChange: (value: string) => void
  onStartEdit: (role: SystemRole) => void
  onCancelEdit: () => void
  onSaveEdit: (roleId: string, title: string, content: string) => void
  onCreate: (title: string, content: string, category: SystemRoleCategory) => void
  onDelete: (roleId: string) => void
  onSetDefault: (roleId: string, category: SystemRoleCategory) => void
  deleteConfirmRoleId: string | null
  onDeleteConfirmChange: (roleId: string | null) => void
  onApplyRole: (role: SystemRole) => void
}

export function SystemRoleManagerModal({
  isOpen,
  onClose,
  selectedCategory,
  onCategoryChange,
  chatRoles,
  auditRoles,
  editingRole,
  editingTitle,
  editingContent,
  onEditTitleChange,
  onEditContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onCreate,
  onDelete,
  onSetDefault,
  deleteConfirmRoleId,
  onDeleteConfirmChange,
  onApplyRole
}: SystemRoleManagerModalProps) {
  const [isCreating, setIsCreating] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState('')
  const [newContent, setNewContent] = React.useState('')
  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null)

  if (!isOpen) return null

  const currentRoles = selectedCategory === 'chat' ? chatRoles : auditRoles

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) return
    onCreate(newTitle, newContent, selectedCategory)
    setIsCreating(false)
    setNewTitle('')
    setNewContent('')
  }

  const handleCancelCreate = () => {
    setIsCreating(false)
    setNewTitle('')
    setNewContent('')
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-4xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">System Roles Manager</h3>
            <p className="text-xs text-slate-400 mt-1">Manage preset prompts for Chat A and Audit chat</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => onCategoryChange('chat')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              selectedCategory === 'chat'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            Chat (Architect)
          </button>
          <button
            onClick={() => onCategoryChange('audit')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              selectedCategory === 'audit'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            Audit (Kritiker)
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-3">
            {/* Create New Role Button */}
            {!isCreating && !editingRole && (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-lg border border-dashed border-slate-600 transition-colors text-slate-400 hover:text-slate-200 text-sm"
              >
                Create new role
              </button>
            )}

            {/* Create Form */}
            {isCreating && (
              <div className="p-4 bg-slate-800 rounded-lg border border-slate-600">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Role title..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm mb-3"
                  autoFocus
                />
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="System prompt content..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm resize-none"
                  rows={6}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleCreate}
                    disabled={!newTitle.trim() || !newContent.trim()}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-sm font-medium transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={handleCancelCreate}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Role List */}
            {currentRoles.map(role => (
              <div
                key={role.id}
                onClick={() => !editingRole && !isCreating && setSelectedRoleId(role.id)}
                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                  editingRole?.id === role.id
                    ? 'bg-slate-800 border-blue-600'
                    : selectedRoleId === role.id
                    ? 'bg-blue-900 border-blue-700'
                    : 'bg-slate-800 border-slate-600 hover:bg-blue-900 hover:border-blue-700'
                }`}
              >
                {editingRole?.id === role.id ? (
                  // Edit Mode
                  <>
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => onEditTitleChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm mb-3"
                      autoFocus
                    />
                    <textarea
                      value={editingContent}
                      onChange={(e) => onEditContentChange(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm resize-none"
                      rows={6}
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => onSaveEdit(role.id, editingTitle, editingContent)}
                        disabled={!editingTitle.trim() || !editingContent.trim()}
                        className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded text-sm font-medium transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  // View Mode
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-slate-100">{role.title}</h4>
                        {role.isDefault && (
                          <span className="px-2 py-0.5 bg-green-900 text-green-200 text-xs rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!role.isDefault && (
                          <button
                            onClick={() => onSetDefault(role.id, selectedCategory)}
                            className="text-xs text-slate-400 hover:text-green-400 transition-colors"
                          >
                            Set as default
                          </button>
                        )}
                        <button
                          onClick={() => onStartEdit(role)}
                          className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                          disabled={isCreating}
                        >
                          Edit
                        </button>
                        {deleteConfirmRoleId === role.id ? (
                          <div className="flex gap-1">
                            {/* Confirm - LEFT (away from original click) */}
                            <button
                              onClick={() => onDelete(role.id)}
                              className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-medium transition-colors whitespace-nowrap"
                            >
                              ⚠️ Delete?
                            </button>
                            {/* Cancel - RIGHT (where mouse was) */}
                            <button
                              onClick={() => onDeleteConfirmChange(null)}
                              className="px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-[10px] font-medium transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => onDeleteConfirmChange(role.id)}
                            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                            disabled={isCreating}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 whitespace-pre-wrap line-clamp-3">
                      {role.content}
                    </p>
                  </>
                )}
              </div>
            ))}

            {currentRoles.length === 0 && !isCreating && (
              <p className="text-center text-slate-500 text-sm py-8">
                No roles yet.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800 flex gap-2">
          <button
            onClick={() => {
              if (selectedRoleId) {
                const role = currentRoles.find(r => r.id === selectedRoleId)
                if (role) {
                  onApplyRole(role)
                  onClose()
                }
              }
            }}
            disabled={!selectedRoleId}
            className="flex-1 px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Apply
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

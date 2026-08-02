import { useState } from 'react'
import type { SystemPromptModule, SystemPromptModuleId } from '../../types'

interface SystemPromptModuleModalProps {
  isOpen: boolean
  onClose: () => void
  module: SystemPromptModule | null
  editingModuleId: SystemPromptModuleId | null
  editBuffer: string
  focusRingColor?: string
  onStartEditing: (moduleId: SystemPromptModuleId) => void
  onCancelEditing: () => void
  onSaveEditing: () => void
  onEditBufferChange: (value: string) => void
  onResetModule: (moduleId: SystemPromptModuleId) => void
  isModuleModified: (moduleId: SystemPromptModuleId) => boolean
  onOpenRoleManager?: () => void
}

export function SystemPromptModuleModal({
  isOpen,
  onClose,
  module,
  editingModuleId,
  editBuffer,
  focusRingColor = 'focus:ring-blue-500',
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onEditBufferChange,
  onResetModule,
  isModuleModified,
  onOpenRoleManager
}: SystemPromptModuleModalProps) {
  const [resetConfirmId, setResetConfirmId] = useState<SystemPromptModuleId | null>(null)

  if (!isOpen || !module) return null

  const isEditing = editingModuleId === module.id
  const isModified = isModuleModified(module.id)
  const isResetConfirming = resetConfirmId === module.id

  const handleResetClick = () => {
    if (isResetConfirming) {
      onResetModule(module.id)
      setResetConfirmId(null)
    } else {
      setResetConfirmId(module.id)
    }
  }

  const cancelReset = () => setResetConfirmId(null)

  const handleClose = () => {
    if (isEditing) onCancelEditing()
    setResetConfirmId(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={handleClose}
    >
      <div
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-3xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-100">{module.title}</h3>
            {isModified && (
              <span className="text-yellow-500 text-sm" title="Customized (differs from default)">●</span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-100 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isEditing ? (
            <textarea
              value={editBuffer}
              onChange={(e) => onEditBufferChange(e.target.value)}
              className={`w-full min-h-[400px] h-full bg-slate-900 border border-blue-600 rounded-lg p-4 text-sm text-slate-200 font-mono resize-none focus:outline-none focus:ring-2 ${focusRingColor}`}
              autoFocus
            />
          ) : (
            <pre className="bg-slate-800 border border-slate-600 rounded-lg p-4 text-sm text-slate-200 font-mono whitespace-pre-wrap">
              {module.content}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
            {/* Role Manager Button (role module only, view mode) */}
            {module.id === 'role' && onOpenRoleManager && !isEditing && (
              <button
                onClick={onOpenRoleManager}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
              >
                Manage roles
              </button>
            )}

            {/* Edit / Save / Cancel */}
            {!isEditing ? (
              <button
                onClick={() => onStartEditing(module.id)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={onSaveEditing}
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={onCancelEditing}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Reset (2-step) – right-aligned, view mode only */}
            {!isEditing && (
              <div className="ml-auto flex gap-2">
                {!isResetConfirming ? (
                  <button
                    onClick={handleResetClick}
                    disabled={!isModified}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-400 hover:text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isModified ? 'Reset to default value' : 'Already at default value'}
                  >
                    Reset
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleResetClick}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      ⚠️ Reset?
                    </button>
                    <button
                      onClick={cancelReset}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { SystemPromptModule, SystemPromptModuleId } from '../../types'
import { SystemPromptModuleModal } from './SystemPromptModuleModal'

interface SystemPromptModulesProps {
  modules: SystemPromptModule[]
  editingModuleId: SystemPromptModuleId | null
  editBuffer: string
  focusRingColor?: string

  // Editing
  onStartEditing: (moduleId: SystemPromptModuleId) => void
  onCancelEditing: () => void
  onSaveEditing: () => void
  onEditBufferChange: (value: string) => void

  // Reset
  onResetModule: (moduleId: SystemPromptModuleId) => void
  isModuleModified: (moduleId: SystemPromptModuleId) => boolean

  // External actions
  onOpenRoleManager?: () => void
}

export function SystemPromptModules({
  modules,
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
}: SystemPromptModulesProps) {
  const [openModuleId, setOpenModuleId] = useState<SystemPromptModuleId | null>(null)

  const openModule = (moduleId: SystemPromptModuleId) => {
    setOpenModuleId(moduleId)
  }

  const closeModal = () => {
    setOpenModuleId(null)
    onCancelEditing()
  }

  const openModuleObj = modules.find((m) => m.id === openModuleId) ?? null

  return (
    <>
      <div className="p-3 space-y-2">
        {modules.map((module) => {
          const isModified = isModuleModified(module.id)
          return (
            <button
              key={module.id}
              onClick={() => openModule(module.id)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-left border border-slate-700 hover:border-slate-600"
            >
              <span className="flex items-center gap-2 text-xs text-slate-300">
                {module.title}
                {isModified && (
                  <span className="text-yellow-500" title="Customized (differs from default)">●</span>
                )}
              </span>
              <span className="text-xs text-slate-500">Open</span>
            </button>
          )
        })}
      </div>

      <SystemPromptModuleModal
        isOpen={openModuleId !== null}
        onClose={closeModal}
        module={openModuleObj}
        editingModuleId={editingModuleId}
        editBuffer={editBuffer}
        focusRingColor={focusRingColor}
        onStartEditing={onStartEditing}
        onCancelEditing={onCancelEditing}
        onSaveEditing={onSaveEditing}
        onEditBufferChange={onEditBufferChange}
        onResetModule={onResetModule}
        isModuleModified={isModuleModified}
        onOpenRoleManager={onOpenRoleManager}
      />
    </>
  )
}

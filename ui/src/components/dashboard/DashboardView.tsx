import type { Project } from '../../types'

interface DashboardViewProps {
  projects: Project[]
  onOpenProject: (projectId: string) => void
  onNewProject: () => void
  onImportProject: () => void
  onEditProject: (projectId: string) => void
  onExportProject: (projectId: string) => void
  onDeleteProject: (projectId: string, e?: React.MouseEvent) => void
  onCancelDelete: () => void
  deleteConfirmProjectId: string | null
  editingProjectId: string | null
  editingProjectValue: string
  onEditingProjectValueChange: (value: string) => void
  onConfirmEditProject: () => void
  onCancelEditProject: () => void
}

export function DashboardView({ 
  projects, 
  onOpenProject, 
  onNewProject,
  onImportProject,
  onEditProject,
  onExportProject,
  onDeleteProject,
  onCancelDelete,
  deleteConfirmProjectId,
  editingProjectId,
  editingProjectValue,
  onEditingProjectValueChange,
  onConfirmEditProject,
  onCancelEditProject
}: DashboardViewProps) {
  return (
    <div className="flex-1 flex flex-col bg-slate-900 p-8 overflow-hidden">
      <div className="max-w-4xl w-full mx-auto flex flex-col h-full">
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Projects</h1>
        <p className="text-slate-400 mb-8">Select a project or create a new one</p>
        
        {/* Projects List - one per row - scrollable */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-2">
          {projects.map(project => {
            const isEditing = editingProjectId === project.id
            const isDeleting = deleteConfirmProjectId === project.id
            
            return (
              <div
                key={project.id}
                className="flex items-center gap-1"
              >
                {isEditing ? (
                  // Edit Mode
                  <>
                    <input
                      type="text"
                      value={editingProjectValue}
                      onChange={(e) => onEditingProjectValueChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onConfirmEditProject()
                        if (e.key === 'Escape') onCancelEditProject()
                      }}
                      autoFocus
                      className="flex-1 px-2 py-1 bg-slate-700 border border-blue-600 rounded text-xs text-slate-100 focus:outline-none"
                    />
                    <button
                      onClick={onConfirmEditProject}
                      className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-[10px] transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={onCancelEditProject}
                      className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-[10px] transition-colors"
                    >
                      ✕
                    </button>
                  </>
                ) : isDeleting ? (
                  // Delete Confirmation Mode
                  <>
                    <button
                      onClick={() => onOpenProject(project.id)}
                      className="flex-1 flex items-center justify-between px-2 py-1 bg-slate-800 rounded text-left"
                    >
                      <span className="text-xs text-slate-300">{project.title}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{project.sessionCount} Sessions</span>
                        <span>{project.lastModified}</span>
                      </div>
                    </button>
                    <span className="text-xs text-orange-400">
                      ⚠️ Delete?
                    </span>
                    <button
                      onClick={(e) => onDeleteProject(project.id, e)}
                      className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onCancelDelete()
                      }}
                      className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-[10px] transition-colors"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  // Normal Mode
                  <>
                    <button
                      onClick={() => onOpenProject(project.id)}
                      className="flex-1 flex items-center justify-between px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-left"
                    >
                      <span className="text-xs text-slate-300">{project.title}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{project.sessionCount} Sessions</span>
                        <span>{project.lastModified}</span>
                      </div>
                    </button>
                    {/* Action Buttons - same style as library items */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditProject(project.id)
                      }}
                      className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                    >
                      Umbenennen
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onExportProject(project.id)
                      }}
                      className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                    >
                      Export
                    </button>
                    <button
                      onClick={(e) => onDeleteProject(project.id, e)}
                      className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
        
        {/* New Project + Import - fixed at bottom */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onNewProject}
            className="flex-1 px-6 py-4 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>New project</span>
          </button>
          <button
            onClick={onImportProject}
            className="flex-1 px-6 py-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span>Import project</span>
          </button>
        </div>
      </div>
    </div>
  )
}

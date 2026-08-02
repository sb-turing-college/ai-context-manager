import type { LibraryItem, Project, ExportTarget } from '../../types'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'single' | 'all'
  item: LibraryItem | null
  itemCount: number
  currentTarget: ExportTarget
  onTargetChange: (target: ExportTarget) => void
  projects: Project[]
  currentProject: string | null
  onExportToProject: (projectId: string) => void
  onExportToFile: (format: 'txt' | 'md' | 'pdf') => void
}

export function ExportModal({
  isOpen,
  onClose,
  mode,
  item,
  itemCount,
  currentTarget,
  onTargetChange,
  projects,
  currentProject,
  onExportToProject,
  onExportToFile
}: ExportModalProps) {
  if (!isOpen) return null
  if (mode === 'single' && !item) return null
  if (mode === 'all' && itemCount < 1) return null

  const heading =
    mode === 'all'
      ? `Export all (${itemCount} document${itemCount === 1 ? '' : 's'})`
      : `Export: ${item!.title}`

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{heading}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'all'
                  ? 'Where should these documents be exported?'
                  : 'Where should the item be exported?'}
              </p>
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
            onClick={() => onTargetChange('project')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentTarget === 'project'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            To another project
          </button>
          <button
            onClick={() => onTargetChange('file')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentTarget === 'file'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
                Save as file
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          {currentTarget === 'project' && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm mb-4">
                Select the target project:
              </p>
              {projects.filter(p => p.id !== currentProject).map(project => (
                <button
                  key={project.id}
                  onClick={() => onExportToProject(project.id)}
                  className="w-full text-left p-4 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors"
                >
                  <div className="text-sm font-medium text-slate-200">📂 {project.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{project.sessionCount} Sessions</div>
                </button>
              ))}
              {projects.filter(p => p.id !== currentProject).length === 0 && (
                <p className="text-center text-slate-500 text-sm py-8">
                  No other projects available.
                </p>
              )}
            </div>
          )}

          {currentTarget === 'file' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm mb-4">
                {mode === 'all'
                  ? 'Select the file format for the ZIP archive (one file per document):'
                  : 'Select the file format:'}
              </p>
              <button
                onClick={() => onExportToFile('md')}
                className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors text-left"
              >
                <div className="text-sm font-medium text-slate-200">
                  {mode === 'all' ? '📄 As .md ZIP (Markdown)' : '📄 As .md (Markdown)'}
                </div>
                  <div className="text-xs text-slate-400 mt-1">Editable, compatible with all text editors</div>
              </button>
              <button
                onClick={() => onExportToFile('txt')}
                className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors text-left"
              >
                <div className="text-sm font-medium text-slate-200">
                  {mode === 'all' ? '📄 As .txt ZIP (Plain Text)' : '📄 As .txt (Plain Text)'}
                </div>
                  <div className="text-xs text-slate-400 mt-1">Universally compatible</div>
              </button>
              {mode === 'single' && item?.type !== 'pdf' && (
                <button
                  onClick={() => onExportToFile('pdf')}
                  className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors text-left opacity-50"
                >
                  <div className="text-sm font-medium text-slate-200">📕 As .pdf (coming soon)</div>
                  <div className="text-xs text-slate-400 mt-1">For printing and archiving</div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

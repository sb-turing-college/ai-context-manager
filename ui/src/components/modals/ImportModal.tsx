import { useState, useRef } from 'react'
import type { Project, LibraryItem, ImportTab } from '../../types'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  currentTab: ImportTab
  onTabChange: (tab: ImportTab) => void
  currentProject: string | null
  projects: Project[]
  allLibraryItems: LibraryItem[]
  onImportFile: (files: FileList | null) => void
  onImportFromProject: (projectId: string, itemIds: string[]) => void | Promise<void>
}

export function ImportModal({
  isOpen,
  onClose,
  currentTab,
  onTabChange,
  currentProject,
  projects,
  allLibraryItems,
  onImportFile,
  onImportFromProject
}: ImportModalProps) {
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onImportFile(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImportFile(e.target.files)
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
          <h3 className="text-lg font-semibold text-slate-100">Import documents</h3>
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
            onClick={() => onTabChange('file')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentTab === 'file'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            From file
          </button>
          <button
            onClick={() => onTabChange('project')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentTab === 'project'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            From another project
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          {currentTab === 'file' && (
            <div className="space-y-4">
              {/* Drag & Drop Zone */}
              <div 
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-500 bg-opacity-10' 
                    : 'border-slate-600 bg-slate-800'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <p className="text-slate-400 mb-2">📁 Drag & drop files here</p>
                <p className="text-xs text-slate-500">Supported: .txt, .md</p>
              </div>
              
              {/* File Input Button */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".txt,.md,.markdown"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleFileButtonClick}
                  className="block w-full px-4 py-3 bg-blue-900 text-white rounded-lg text-sm font-medium text-center cursor-pointer transition-colors hover:bg-blue-800"
                >
                  Select file(s)
                </button>
              </div>
              
              <p className="text-xs text-slate-500 text-center">
                You can select multiple files at once or add them via drag & drop
              </p>
            </div>
          )}

          {currentTab === 'project' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-sm mb-4">
                Select documents from other projects to import here:
              </p>
              {projects.filter(p => p.id !== currentProject).map(project => {
                const itemsInProject = allLibraryItems.filter(item => item.projectId === project.id)
                if (itemsInProject.length === 0) return null
                
                return (
                  <details key={project.id} className="border border-slate-700 rounded-lg overflow-hidden">
                    <summary className="px-4 py-3 bg-slate-800 cursor-pointer text-sm font-medium text-slate-200 hover:bg-slate-700">
                      📂 {project.title} ({itemsInProject.length} Items)
                    </summary>
                    <div className="p-4 bg-slate-800 space-y-2">
                      {itemsInProject.map(item => {
                        const icon = item.type === 'pdf' ? '📕' : item.type === 'markdown' ? '📘' : '📄'
                        return (
                          <button
                            key={item.id}
                            onClick={() => onImportFromProject(project.id, [item.id])}
                            className="w-full text-left p-3 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 transition-colors"
                          >
                            <div className="text-sm text-slate-200">{icon} {item.title}</div>
                            <div className="text-xs text-slate-400 mt-1">{item.timestamp}</div>
                          </button>
                        )
                      })}
                    </div>
                  </details>
                )
              })}
              {projects.filter(p => p.id !== currentProject).every(p => 
                allLibraryItems.filter(item => item.projectId === p.id).length === 0
              ) && (
                <p className="text-center text-slate-500 text-sm py-8">
                  No library entries found in other projects.
                </p>
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
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

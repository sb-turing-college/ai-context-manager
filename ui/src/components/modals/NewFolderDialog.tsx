interface NewFolderDialogProps {
  isOpen: boolean
  onClose: () => void
  folderName: string
  onFolderNameChange: (name: string) => void
  onCreate: () => void
}

export function NewFolderDialog({ 
  isOpen, 
  onClose, 
  folderName, 
  onFolderNameChange, 
  onCreate 
}: NewFolderDialogProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-100 mb-4">New folder</h3>
        <input
          type="text"
          value={folderName}
          onChange={(e) => onFolderNameChange(e.target.value)}
          placeholder="Folder name..."
          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          onKeyDown={(e) => e.key === 'Enter' && onCreate()}
        />
        <div className="flex gap-3">
          <button
            onClick={onCreate}
            disabled={!folderName.trim()}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              folderName.trim()
                ? 'bg-blue-900 hover:bg-blue-800 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Create
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

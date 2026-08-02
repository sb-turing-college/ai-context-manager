import type { LibraryItem, LibraryFolder, ItemActionSuccess } from '../../types'

interface LibraryPanelProps {
  libraryItems: LibraryItem[]
  libraryFolders: LibraryFolder[]
  expandedFolders: Set<string>
  itemActionSuccess: ItemActionSuccess | null
  removeConfirmItemId: string | null
  renamingFolderId: string | null
  renameFolderValue: string
  renamingItemId: string | null
  renameItemValue: string
  deleteFolderConfirmId: string | null
  onToggleFolder: (folderId: string) => void
  onOpenLibraryItem: (item: LibraryItem) => void
  onExportLibraryItem: (itemId: string, e?: React.MouseEvent) => void
  onRemoveLibraryItem: (itemId: string, e?: React.MouseEvent) => void
  onCancelRemove: () => void
  onOpenImportModal: () => void
  onOpenCreateDocumentModal: () => void
  onOpenNewFolderDialog: () => void
  onExportAll: () => void
  onMoveToFolder: (itemId: string, folderId: string) => void
  onRenameFolderValueChange: (value: string) => void
  onStartRenameFolder: (folderId: string, currentName: string) => void
  onConfirmRenameFolder: () => void
  onCancelRenameFolder: () => void
  onRenameItemValueChange: (value: string) => void
  onStartRenameItem: (itemId: string, currentTitle: string, e?: React.MouseEvent) => void
  onConfirmRenameItem: () => void
  onCancelRenameItem: () => void
  onRequestDeleteFolder: (folderId: string) => void
  onConfirmDeleteFolderKeepFiles: (folderId: string) => void
  onCancelDeleteFolder: () => void
}

export function LibraryPanel({
  libraryItems,
  libraryFolders,
  expandedFolders,
  itemActionSuccess,
  removeConfirmItemId,
  renamingFolderId,
  renameFolderValue,
  renamingItemId,
  renameItemValue,
  deleteFolderConfirmId,
  onToggleFolder,
  onOpenLibraryItem,
  onExportLibraryItem,
  onRemoveLibraryItem,
  onCancelRemove,
  onOpenImportModal,
  onOpenCreateDocumentModal,
  onOpenNewFolderDialog,
  onExportAll,
  onMoveToFolder,
  onRenameFolderValueChange,
  onStartRenameFolder,
  onConfirmRenameFolder,
  onCancelRenameFolder,
  onRenameItemValueChange,
  onStartRenameItem,
  onConfirmRenameItem,
  onCancelRenameItem,
  onRequestDeleteFolder,
  onConfirmDeleteFolderKeepFiles,
  onCancelDeleteFolder
}: LibraryPanelProps) {
  // Flexible width (rem-based, scales with font size)
  const CONTENT_MAX_WIDTH = 'max-w-64'  // 16rem

  const rootItems = libraryItems.filter((item) => !item.folderId)
  
  const renderLibraryItem = (item: LibraryItem) => {
    const extension = item.type === 'pdf' ? '.pdf' : item.type === 'markdown' ? '.md' : '.txt'
    const isRenaming = renamingItemId === item.id
    
    return (
      <div 
        key={item.id} 
        className={`flex items-center gap-1 ${CONTENT_MAX_WIDTH}`}
      >
        {removeConfirmItemId === item.id ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-orange-400">
              ⚠️ Delete?
            </span>
            <button
              onClick={(e) => onRemoveLibraryItem(item.id, e)}
              className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] transition-colors"
            >
              Delete
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancelRemove()
              }}
              className="px-2 py-0.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-[10px] transition-colors"
            >
              ✕
            </button>
          </div>
        ) : isRenaming ? (
          <div className="flex items-center gap-1 w-full">
            <input
              type="text"
              value={renameItemValue}
              onChange={(e) => onRenameItemValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirmRenameItem()
                if (e.key === 'Escape') onCancelRenameItem()
              }}
              autoFocus
              className="flex-1 px-2 py-1 bg-slate-700 border border-blue-600 rounded text-xs text-slate-100 focus:outline-none"
            />
            <button
              onClick={onConfirmRenameItem}
              className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-[10px] transition-colors"
            >
              ✓
            </button>
            <button
              onClick={onCancelRenameItem}
              className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-[10px] transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <button 
              onClick={() => onOpenLibraryItem(item)}
              className="flex-1 flex items-center px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-left"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('itemId', item.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
            >
              <span className="text-xs text-slate-300 truncate">
                📄 {item.title}{extension}
                {item.isAudited && <span className="text-yellow-400 ml-1" title="Audited (Frozen)">🔒</span>}
              </span>
            </button>
            <button
              onClick={(e) => onStartRenameItem(item.id, item.title, e)}
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
            >
              Rename
            </button>
            <button
              onClick={(e) => onExportLibraryItem(item.id, e)}
              className={`text-xs text-slate-400 hover:text-blue-400 transition-colors ${
                itemActionSuccess?.itemId === item.id && itemActionSuccess?.action === 'export' ? 'text-green-400' : ''
              }`}
            >
              {itemActionSuccess?.itemId === item.id && itemActionSuccess?.action === 'export' ? '✓ Export' : 'Export'}
            </button>
            <button
              onClick={(e) => onRemoveLibraryItem(item.id, e)}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          </>
        )}
      </div>
    )
  }

  const renderFolderRow = (folder: LibraryFolder) => {
    const itemCount = libraryItems.filter((item) => item.folderId === folder.id).length
    const isRenaming = renamingFolderId === folder.id
    const isDeleting = deleteFolderConfirmId === folder.id
    const entryLabel = itemCount === 1 ? '1 document' : `${itemCount} documents`

    if (isRenaming) {
      return (
        <div key={folder.id} className={`flex items-center gap-1 ${CONTENT_MAX_WIDTH}`}>
          <input
            type="text"
            value={renameFolderValue}
            onChange={(e) => onRenameFolderValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmRenameFolder()
              if (e.key === 'Escape') onCancelRenameFolder()
            }}
            autoFocus
            className="flex-1 px-2 py-1 bg-slate-700 border border-blue-600 rounded text-xs text-slate-100 focus:outline-none"
          />
          <button
            onClick={onConfirmRenameFolder}
            className="px-2 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded text-[10px] transition-colors"
          >
            ✓
          </button>
          <button
            onClick={onCancelRenameFolder}
            className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-[10px] transition-colors"
          >
            ✕
          </button>
        </div>
      )
    }

    if (isDeleting) {
      return (
        <div key={folder.id} className={`space-y-2 ${CONTENT_MAX_WIDTH}`}>
          <p className="px-2 py-1 bg-slate-800 rounded text-xs text-orange-400">
            {itemCount > 0
              ? `Delete folder "${folder.name}"? It contains ${entryLabel}. Documents will be kept in the library root.`
              : `Delete folder "${folder.name}"?`}
          </p>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => onConfirmDeleteFolderKeepFiles(folder.id)}
              className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] transition-colors"
            >
              Delete folder, keep files
            </button>
            <button
              onClick={onCancelDeleteFolder}
              className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-[10px] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    return (
      <div key={folder.id} className={`flex items-center gap-1 ${CONTENT_MAX_WIDTH}`}>
        <button
          onClick={() => onToggleFolder(folder.id)}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('bg-blue-900')
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('bg-blue-900')
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('bg-blue-900')
            const itemId = e.dataTransfer.getData('itemId')
            if (itemId) {
              onMoveToFolder(itemId, folder.id)
            }
          }}
          className="flex-1 flex items-center justify-between px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-left"
        >
          <span className="text-xs font-medium text-slate-300">
            {expandedFolders.has(folder.id) ? '📂' : '📁'} {folder.name}
            {itemCount > 0 && <span className="text-slate-500 ml-1">({itemCount})</span>}
          </span>
        </button>
        <button
          onClick={() => onStartRenameFolder(folder.id, folder.name)}
          className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
        >
          Rename
        </button>
        <button
          onClick={() => onRequestDeleteFolder(folder.id)}
          className="text-xs text-slate-400 hover:text-red-400 transition-colors"
        >
          Delete
        </button>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Action Buttons — always visible */}
      <div className="shrink-0 p-3 pb-2 space-y-2">
        <div className="flex gap-2 pb-2 border-b border-slate-700" id="library-action-buttons">
          <button
            onClick={onOpenCreateDocumentModal}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-300 transition-colors"
          >
            New document
          </button>
          <button
            onClick={onOpenImportModal}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-300 transition-colors"
          >
            Import
          </button>
          <button
            onClick={onOpenNewFolderDialog}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-300 transition-colors"
          >
            New folder
          </button>
          <button
            onClick={onExportAll}
            disabled={libraryItems.length === 0}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700"
          >
            Export all
          </button>
        </div>

        {/* Folder rows pinned above the document list (drop targets stay visible) */}
        {libraryFolders.length > 0 && (
          <div className="space-y-2 pb-2 border-b border-slate-700">
            {libraryFolders.map(renderFolderRow)}
          </div>
        )}
      </div>

      {/* Documents — scrollable */}
      <div className="flex-1 min-h-0 overflow-auto px-3 pb-3 space-y-3">
        {libraryItems.length === 0 && libraryFolders.length === 0 && (
          <div className="text-center text-slate-500 text-xs py-2">
            No entries.
          </div>
        )}

        {libraryFolders.map((folder) => {
          if (!expandedFolders.has(folder.id)) return null
          if (renamingFolderId === folder.id || deleteFolderConfirmId === folder.id) return null
          const folderItems = libraryItems.filter((item) => item.folderId === folder.id)
          if (folderItems.length === 0) {
            return (
              <div key={`empty-${folder.id}`} className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  {folder.name}
                </p>
                <p className="text-xs text-slate-500 pl-2">Empty folder</p>
              </div>
            )
          }
          return (
            <div key={`items-${folder.id}`} className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                {folder.name}
              </p>
              <div className="ml-2 space-y-2">
                {folderItems.map(renderLibraryItem)}
              </div>
            </div>
          )
        })}

        {rootItems.length > 0 && (
          <div className="space-y-2">
            {libraryFolders.length > 0 && (
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Library root
              </p>
            )}
            {rootItems.map(renderLibraryItem)}
          </div>
        )}
      </div>
    </div>
  )
}

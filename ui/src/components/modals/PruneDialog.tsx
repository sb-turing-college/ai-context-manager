interface PruneDialogProps {
  isOpen: boolean
  onClose: () => void
  keepLastMessages: number
  onKeepLastMessagesChange: (count: number) => void
  onPrune: () => void
  isThinking: boolean
}

export function PruneDialog({ 
  isOpen, 
  onClose, 
  keepLastMessages, 
  onKeepLastMessagesChange, 
  onPrune,
  isThinking 
}: PruneDialogProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-100 mb-4">🧹 Clean up session</h3>
        <p className="text-slate-300 text-sm mb-6">
          The chat history will be summarized and old messages removed. The summary is saved in the library (versioned).
        </p>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm text-slate-300 block mb-2">
              Number of recent messages to keep:
            </label>
            <input
              type="number"
              value={keepLastMessages}
              onChange={(e) => onKeepLastMessagesChange(parseInt(e.target.value) || 5)}
              min="0"
              max="20"
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="bg-slate-800 border border-slate-600 rounded p-3">
            <div className="text-xs text-slate-400 space-y-1">
              <div>✓ Alte Versionen bleiben erhalten</div>
              <div>✓ Backup is created automatically</div>
              <div>✓ System message will be inserted</div>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onPrune}
            disabled={isThinking}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              isThinking
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-900 hover:bg-blue-800 text-white'
            }`}
          >
            {isThinking ? 'Processing...' : 'Clean up'}
          </button>
          <button
            onClick={onClose}
            disabled={isThinking}
            className="flex-1 px-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

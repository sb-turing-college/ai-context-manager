/**
 * VerifyRequestBlock Component
 * 
 * Displays a collapsible block showing the EXACT verify request sent to the AI.
 * Shows the full prompt that the backend sends - no discrepancy between UI and backend.
 * 
 * @module components/chat/VerifyRequestBlock
 */

/**
 * Builds the EXACT same prompt that the backend sends to the AI.
 * IMPORTANT: Keep this in sync with context_builder.py build_verify_context()!
 * 
 * Note: Chat B also receives the chat history as FLATTENED USER CONTENT
 * (not shown here, but sent by backend as "[CONTEXT FROM CHAT A]...").
 * This way the AI sees it as external context, not its own answers.
 */
function buildVerifyPrompt(answerToVerify: string): string {
  return `[VERIFY-REQUEST]

You are an EXTERNAL CRITIC (Chat B). The last answer from AI-A (see context above) should be reviewed.

IMPORTANT:
- You are NOT AI-A, but a separate instance (Chat B)
- The context above shows you the conversation of ANOTHER AI
- You should critically review the following answer as an independent reviewer

--- ANSWER TO REVIEW FROM AI-A ---

${answerToVerify}

--- END OF ANSWER TO REVIEW ---

Analyze this answer now as an external critic:
1. Is it substantively correct?
2. Is it complete?
3. Are there gaps or errors?
4. What could be improved?`
}

interface VerifyRequestBlockProps {
  messageId: string
  answerToVerify: string
  timestamp?: string
  isExpanded: boolean
  onToggleExpand: (messageId: string) => void
  showTags?: boolean
  // Selection/Action props (same as other blocks)
  isSelected?: boolean
  selectionActive?: boolean
  onToggleSelect?: () => void
  onSelectFromHere?: () => void
  onCopyToClipboard?: () => void
  onDeleteMessage?: () => void
  index?: number
}

export function VerifyRequestBlock({
  messageId,
  answerToVerify,
  timestamp,
  isExpanded,
  onToggleExpand,
  showTags,
  isSelected = false,
  selectionActive = false,
  onToggleSelect,
  onSelectFromHere,
  onCopyToClipboard,
  onDeleteMessage,
}: VerifyRequestBlockProps) {
  // Build the EXACT prompt that was sent to the AI
  const fullPrompt = buildVerifyPrompt(answerToVerify)
  
  return (
    <div className="flex justify-start group relative">
      <div className={`max-w-[85%] rounded-lg border transition-all ${
        isSelected 
          ? 'border-blue-500 bg-blue-900/20' 
          : 'border-slate-600 bg-slate-800/50'
      }`}>
        {/* Header - always visible */}
        <button
          onClick={() => onToggleExpand(messageId)}
          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors rounded-t-lg select-none"
        >
          <span className="text-xs font-medium text-slate-400">
            Review request (sent to AI)
          </span>
          <span className="text-slate-500 text-xs">
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>

        {/* Content - collapsible, shows FULL prompt */}
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-slate-700">
            <div className="mt-2 text-sm text-slate-300 whitespace-pre-line select-text bg-slate-900/50 rounded p-3 max-h-60 overflow-y-auto">
              {fullPrompt}
            </div>
            
            {/* Timestamp Tag */}
            {showTags && timestamp && (
              <div className="mt-2 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
                🕒 {timestamp}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hover Action Toolbar - Same as other blocks */}
      <div className="absolute -bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {/* Selection checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect?.()
          }}
          className={`p-1 rounded border transition-colors active:scale-95 ${
            isSelected
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-slate-800 border-slate-600 hover:bg-slate-700 text-slate-300'
          }`}
          title={isSelected ? 'Deselect' : 'Select'}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSelected ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
            )}
          </svg>
        </button>
        
        {/* Select from here */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelectFromHere?.()
          }}
          className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
          title="Select from here"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
        
        {/* Copy */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (selectionActive && onCopyToClipboard) {
              onCopyToClipboard()
            } else {
              // Copy the FULL prompt (same as what AI sees)
              navigator.clipboard.writeText(fullPrompt)
            }
          }}
          className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
          title={selectionActive ? 'Copy selection' : 'Copy full prompt'}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        
        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDeleteMessage?.()
          }}
          className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-red-900/50 hover:border-red-700 text-slate-300 hover:text-red-300 transition-colors active:scale-95"
          title="Delete"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

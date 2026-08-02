import type { ChatMessage } from '../../types'

interface ChatMinimapProps {
  messages: ChatMessage[]
  onScrollToMessage: (messageId: string) => void
}

export function ChatMinimap({ messages, onScrollToMessage }: ChatMinimapProps) {
  if (messages.length === 0) return null

  return (
    <div className="w-16 h-full bg-slate-900 border-l border-slate-800 flex flex-col items-center py-4 relative shrink-0">
      {/* Track Line */}
      <div className="absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-0.5 bg-slate-800 rounded-full" />

      {/* Message Dots */}
      <div className="w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hide relative">
        <div className="flex flex-col gap-1 items-center py-2 h-full justify-start">
            {messages.map((msg) => {
              // Simple heuristic to distribute dots visually 
              // In a real implementation, this would map to scroll position percentage
              // For now, we stack them but give them semantic colors
              
              let color = 'bg-slate-600' // Default AI
              if (msg.role === 'user') color = 'bg-blue-500'
              
              // Detect specific events/content for special dots
              const isSummary = msg.content.includes('Summary erstellt') || msg.content.includes('Summary created') || msg.content.includes('[Summary]')
              const isDraft = msg.content.includes('Draft created')
              
              if (isSummary) color = 'bg-purple-500 ring-2 ring-purple-900'
              if (isDraft) color = 'bg-yellow-500 ring-2 ring-yellow-900'

              return (
                <button
                  key={msg.id}
                  onClick={() => onScrollToMessage(msg.id)}
                  className={`relative z-10 w-3 h-3 rounded-full transition-all hover:scale-150 hover:z-20 group ${color}`}
                  title={`${msg.role === 'user' ? 'User' : 'AI'} - ${msg.timestamp}`}
                >
                    {/* Tooltip on hover */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-200 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none border border-slate-700 z-50 transition-opacity">
                        {msg.role === 'user' ? 'Du' : 'AI'} {isDraft ? '(Draft)' : ''}
                    </div>
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}

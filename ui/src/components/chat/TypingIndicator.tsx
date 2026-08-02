/**
 * Typing Indicator Component
 * 
 * Animated "..." indicator showing AI is generating a response.
 * Used in Chat (for AI response) and Workshop (for draft generation).
 * 
 * Design: Appears where the content will appear (not as separate banner).
 */

import { useEffect, useState } from 'react'

interface TypingIndicatorProps {
  /** Label to show (e.g., "AI generating...", "Creating draft...") */
  label?: string
  /** Variant: 'chat' for message-style, 'workshop' for full-width */
  variant?: 'chat' | 'workshop'
}

export function TypingIndicator({ 
  label = 'AI generating', 
  variant = 'chat' 
}: TypingIndicatorProps) {
  const [dots, setDots] = useState(1)

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev % 3) + 1)
    }, 400)
    return () => clearInterval(interval)
  }, [])

  if (variant === 'workshop') {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-lg">{label}</span>
          <span className="text-lg font-bold w-6">{'.'.repeat(dots)}</span>
        </div>
      </div>
    )
  }

  // Chat variant - looks like an AI message
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] bg-slate-700 border border-slate-600 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 text-slate-300">
          <span>{label}</span>
          <span className="font-bold w-6">{'.'.repeat(dots)}</span>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SummaryHintProps {
  /** Whether the hint should be visible */
  isVisible: boolean
  /** Current token count that triggered the hint */
  tokenCount?: number
  /** Token threshold that was exceeded */
  tokenThreshold?: number
  /** Mode: 'automatic' shows brief confirmation, 'manual' shows action buttons */
  mode: 'automatic' | 'manual'
  /** Called when user clicks "Create summary" (manual mode) */
  onCreateSummary: () => void
  /** Called when user dismisses the hint (manual mode) */
  onDismiss: () => void
  /** Called when auto-hint should disappear (automatic mode, after timeout) */
  onAutoClose?: () => void
}

export function SummaryHint({
  isVisible,
  tokenCount,
  tokenThreshold,
  mode,
  onCreateSummary,
  onDismiss,
  onAutoClose
}: SummaryHintProps) {
  const [autoCloseProgress, setAutoCloseProgress] = useState(100)

  // Auto-close timer for automatic mode
  useEffect(() => {
    if (!isVisible || mode !== 'automatic') return

    const duration = 3000 // 3 seconds
    const interval = 50 // Update every 50ms
    const decrement = (interval / duration) * 100

    setAutoCloseProgress(100)

    const timer = setInterval(() => {
      setAutoCloseProgress(prev => {
        const next = prev - decrement
        if (next <= 0) {
          clearInterval(timer)
          onAutoClose?.()
          return 0
        }
        return next
      })
    }, interval)

    return () => clearInterval(timer)
  }, [isVisible, mode, onAutoClose])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20"
        >
          {/* Dezentes Design wie Message-Boxen, nur Rand in Orange */}
          <div className={`rounded-lg shadow-lg border-2 ${
            mode === 'automatic'
              ? 'bg-slate-800 border-green-700'
              : 'bg-slate-800 border-orange-800'
          }`}>
            {/* Content */}
            <div className="px-4 py-3">
              {mode === 'automatic' ? (
                // Automatic mode: Brief confirmation
                <div className="flex items-center gap-3">
                  <span className="text-green-500 text-lg">✓</span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Creating summary...
                    </p>
                    {tokenCount && tokenThreshold && (
                      <p className="text-xs text-slate-400">
                        {tokenCount.toLocaleString()} / {tokenThreshold.toLocaleString()} Tokens
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                // Manual mode: Hint with action buttons
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-orange-500 text-lg mt-0.5">⚡</span>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        Token limit reached
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        A summary is recommended to compress context.
                      </p>
                      {tokenCount && tokenThreshold && (
                        <p className="text-xs text-slate-500 mt-1">
                          {tokenCount.toLocaleString()} / {tokenThreshold.toLocaleString()} Tokens
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onCreateSummary}
                      className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-medium transition-colors"
                    >
                      Create summary
                    </button>
                    <button
                      onClick={onDismiss}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition-colors"
                    >
                      Later
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-close progress bar (automatic mode only) */}
            {mode === 'automatic' && (
              <div className="h-1 bg-slate-900 rounded-b-lg overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all duration-50 ease-linear"
                  style={{ width: `${autoCloseProgress}%` }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '../../types'

interface ToolLogDrawerProps {
  isOpen: boolean
  onClose: () => void
  messages: ChatMessage[]
  sessionTitle?: string
}

const TOOL_LABELS: Record<string, string> = {
  create_status: 'Status created',
  update_status: 'Status update',
  delete_status: 'Status deleted',
  read_status: 'Status read',
  search_documents: 'Documents searched',
  read_document: 'Document read',
  create_draft: 'Draft created',
  edit_draft: 'Draft edited',
  search_past_sessions: 'Past sessions searched',
  claim_guard: 'Claim guard'
}

function getToolLabel(tool: string): string {
  return TOOL_LABELS[tool] || tool
}

interface ToolEntry {
  id: string
  tool: string
  params: Record<string, unknown>
  result: unknown
  success: boolean
}

interface TurnGroup {
  messageId: string
  timestamp: string
  turnSummary?: string
  turnOk?: boolean
  tools: ToolEntry[]
}

export function ToolLogDrawer({ isOpen, onClose, messages, sessionTitle }: ToolLogDrawerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [summaryExpanded, setSummaryExpanded] = useState<Record<string, boolean>>({})

  const turns: TurnGroup[] = []
  messages.forEach((msg) => {
    if (!msg.toolCalls?.length && !msg.turnSummary) return
    turns.push({
      messageId: msg.id,
      timestamp: msg.timestamp,
      turnSummary: msg.turnSummary,
      turnOk: msg.turnOk,
      tools: (msg.toolCalls || []).map((tc, idx) => ({
        id: `${msg.id}-${idx}`,
        tool: tc.tool,
        params: tc.params,
        result: tc.result,
        success: tc.success
      }))
    })
  })
  const reversed = [...turns].reverse()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed right-0 top-0 bottom-0 w-96 max-w-[90vw] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-xl"
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-slate-200">
                Tool Log {sessionTitle ? `· ${sessionTitle}` : ''}
              </h3>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-100 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-4">
              {reversed.length === 0 ? (
                <p className="text-sm text-slate-500">No tool calls in this session.</p>
              ) : (
                reversed.map((turn) => {
                  const summaryOpen = summaryExpanded[turn.messageId] ?? true
                  // Prefer backend turn_ok; else any failed tool (empty ≠ green)
                  const turnOk =
                    typeof turn.turnOk === 'boolean'
                      ? turn.turnOk
                      : turn.tools.length > 0 && turn.tools.every((t) => t.success)
                  const summaryShell = turnOk
                    ? 'border-emerald-800/60 bg-emerald-950/25'
                    : 'border-red-800/70 bg-red-950/30'
                  const summaryHover = turnOk
                    ? 'hover:bg-emerald-900/25'
                    : 'hover:bg-red-900/25'
                  const summaryAccent = turnOk
                    ? 'text-emerald-200/90'
                    : 'text-red-200/90'
                  const summaryBody = turnOk
                    ? 'text-emerald-50/90 border-t border-emerald-800/40'
                    : 'text-red-50/90 border-t border-red-800/40'
                  return (
                    <div key={turn.messageId} className="space-y-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 px-1">
                        Turn · {turn.timestamp}
                      </div>

                      {turn.turnSummary && (
                        <div className={`rounded-lg border overflow-hidden ${summaryShell}`}>
                          <button
                            onClick={() =>
                              setSummaryExpanded((prev) => ({
                                ...prev,
                                [turn.messageId]: !summaryOpen
                              }))
                            }
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${summaryHover}`}
                          >
                            <span className={`text-xs font-semibold ${summaryAccent}`}>
                              {turnOk ? '✓' : '✗'}
                            </span>
                            <span className={`text-xs font-medium truncate flex-1 ${summaryAccent}`}>
                              Turn Summary
                            </span>
                            <span className="text-slate-500">{summaryOpen ? '▼' : '▶'}</span>
                          </button>
                          {summaryOpen && (
                            <pre className={`px-3 pb-3 text-xs whitespace-pre-wrap font-mono leading-relaxed pt-2 ${summaryBody}`}>
                              {turn.turnSummary}
                            </pre>
                          )}
                        </div>
                      )}

                      {turn.tools.map((entry) => {
                        const isExpanded = expandedId === entry.id
                        return (
                          <div
                            key={entry.id}
                            className={`rounded-lg border overflow-hidden ${
                              entry.success
                                ? 'border-slate-600 bg-slate-700/50'
                                : 'border-red-800 bg-red-900/20'
                            }`}
                          >
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/50 transition-colors"
                            >
                              <span className="text-sm">{entry.success ? '✓' : '✗'}</span>
                              <span className="text-xs font-medium text-slate-200 truncate flex-1">
                                {getToolLabel(entry.tool)}
                              </span>
                              <span className="text-slate-500">{isExpanded ? '▼' : '▶'}</span>
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2 border-t border-slate-600 pt-2">
                                <div>
                                  <div className="text-[10px] uppercase text-slate-500 mb-1">
                                    Parameters
                                  </div>
                                  <pre className="text-xs text-slate-300 bg-slate-900 rounded p-2 overflow-auto max-h-24">
                                    {JSON.stringify(entry.params, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase text-slate-500 mb-1">
                                    Result
                                  </div>
                                  <pre className="text-xs text-slate-300 bg-slate-900 rounded p-2 overflow-auto max-h-32">
                                    {typeof entry.result === 'object' && entry.result !== null
                                      ? JSON.stringify(entry.result, null, 2)
                                      : String(entry.result ?? '—')}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

import type { StatusHistoryEntry, StatusTopicItem } from '../../types'

interface StatusHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  statusTopics: StatusTopicItem[]
}

type HistoryAction = 'Created' | 'Updated' | 'Renamed'

interface TimelineRow {
  key: string
  topicTitle: string
  action: HistoryAction
  entry: StatusHistoryEntry
  sortTs: number
}

function formatTimestamp(iso: string): string {
  if (!iso) return '—'
  const trimmed = iso.slice(0, 19).replace('T', ' ')
  return `${trimmed} UTC`
}

function deriveAction(entry: StatusHistoryEntry): HistoryAction {
  const prevTitle = entry.previous_title
  const nextTitle = entry.new_title
  if (prevTitle && nextTitle && prevTitle !== nextTitle) {
    return 'Renamed'
  }
  // Create entries store empty previous content and no title rename fields.
  if (!entry.content && !prevTitle) {
    return 'Created'
  }
  return 'Updated'
}

function buildTimeline(topics: StatusTopicItem[]): TimelineRow[] {
  const rows: TimelineRow[] = []
  for (const topic of topics) {
    const history = topic.history || []
    history.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return
      const ts = Date.parse(entry.timestamp || '') || 0
      rows.push({
        key: `${topic.id}-${index}-${entry.timestamp || index}`,
        topicTitle: topic.title,
        action: deriveAction(entry),
        entry,
        sortTs: ts,
      })
    })
  }
  rows.sort((a, b) => b.sortTs - a.sortTs)
  return rows
}

function previewValue(value: string, max = 240): string {
  const text = (value || '').replace(/\n/g, ' / ')
  if (!text) return '(empty)'
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

/**
 * Project-wide status change audit (chronological).
 * Shell matches ContentViewModal / LibraryViewModal; body is a flat event list.
 */
export function StatusHistoryModal({
  isOpen,
  onClose,
  statusTopics,
}: StatusHistoryModalProps) {
  if (!isOpen) return null

  const timeline = buildTimeline(statusTopics)

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-3xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Status history</h3>
            <p className="text-xs text-slate-400 mt-1">
              Project-wide change audit (newest first)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {timeline.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">
              No history yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-700 border border-slate-600 rounded-lg overflow-hidden">
              {timeline.map((row) => {
                const { entry, action, topicTitle } = row
                const renamed =
                  entry.previous_title &&
                  entry.new_title &&
                  entry.previous_title !== entry.new_title
                const sourceLabel = entry.source || 'unknown'
                const sessionBit = entry.session_title
                  ? `session "${entry.session_title}"`
                  : null

                return (
                  <li key={row.key} className="px-4 py-3 bg-slate-800">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-xs text-slate-400 font-mono shrink-0">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <span className="text-xs text-slate-300 shrink-0">
                        {action}
                      </span>
                      <span className="text-xs text-slate-100 font-medium truncate">
                        {topicTitle}
                      </span>
                    </div>

                    {entry.reason && (
                      <p className="text-xs text-slate-300 mt-1.5">
                        <span className="text-slate-500">Reason: </span>
                        {entry.reason}
                      </p>
                    )}

                    <p className="text-[11px] text-slate-500 mt-1">
                      {sessionBit ? `${sessionBit} · ` : ''}
                      source: {sourceLabel}
                    </p>

                    {renamed && (
                      <p className="text-xs text-slate-400 mt-1.5 font-mono">
                        Title: &quot;{entry.previous_title}&quot; → &quot;{entry.new_title}&quot;
                      </p>
                    )}

                    {action !== 'Created' && (
                      <p className="text-xs text-slate-400 mt-1 font-mono whitespace-pre-wrap break-words">
                        Previous: {previewValue(entry.content)}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

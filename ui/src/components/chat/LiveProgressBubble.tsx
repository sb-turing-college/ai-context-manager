import { getToolDisplayInfo } from './ToolCallBlock'

export type LiveProgressStage = 'thinking' | 'generating'

export interface LiveProgressTool {
  tool: string
  status: 'running' | 'done' | 'failed'
  summary?: string
}

export interface LiveProgressState {
  stage: LiveProgressStage | null
  tools: LiveProgressTool[]
}

interface LiveProgressBubbleProps {
  progress: LiveProgressState
}

function stageLabel(stage: LiveProgressStage | null): string {
  if (stage === 'generating') return 'Writing response'
  return 'Thinking'
}

function statusMark(status: LiveProgressTool['status']): string {
  if (status === 'running') return '…'
  if (status === 'failed') return '✗'
  return '✓'
}

export function LiveProgressBubble({ progress }: LiveProgressBubbleProps) {
  const { stage, tools } = progress
  const active = tools.find((t) => t.status === 'running')
  const headline = active
    ? `${getToolDisplayInfo(active.tool).icon} ${getToolDisplayInfo(active.tool).label}`
    : stageLabel(stage)

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="h-1 w-1 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1 w-1 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1 w-1 rounded-full bg-slate-400 animate-bounce" />
          </span>
          <span className="font-medium">{headline}</span>
        </div>
        {tools.length > 0 && (
          <ul className="space-y-0.5 pl-1">
            {tools.map((t, i) => {
              const info = getToolDisplayInfo(t.tool)
              return (
                <li
                  key={`${t.tool}-${i}`}
                  className={`text-[11px] flex items-start gap-1.5 ${
                    t.status === 'failed'
                      ? 'text-orange-400'
                      : t.status === 'running'
                        ? 'text-slate-200'
                        : 'text-slate-500'
                  }`}
                >
                  <span className="shrink-0 w-3 text-center">{statusMark(t.status)}</span>
                  <span className="min-w-0">
                    <span className="mr-1">{info.icon}</span>
                    {info.label}
                    {t.summary ? (
                      <span className="text-slate-500 ml-1 truncate">— {t.summary}</span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export const EMPTY_LIVE_PROGRESS: LiveProgressState = {
  stage: 'thinking',
  tools: [],
}

export function applyProgressEvent(
  prev: LiveProgressState,
  event: {
    type: string
    stage?: string
    tool?: string
    status?: string
    summary?: string
  }
): LiveProgressState {
  if (event.type === 'stage' && (event.stage === 'thinking' || event.stage === 'generating')) {
    return { ...prev, stage: event.stage }
  }
  if (
    event.type === 'tool' &&
    event.tool &&
    (event.status === 'running' || event.status === 'done' || event.status === 'failed')
  ) {
    const tools = [...prev.tools]
    const idx = tools.findIndex(
      (t) => t.tool === event.tool && t.status === 'running'
    )
    const entry: LiveProgressTool = {
      tool: event.tool,
      status: event.status,
      summary: event.summary,
    }
    if (event.status === 'running') {
      tools.push(entry)
    } else if (idx >= 0) {
      tools[idx] = entry
    } else {
      tools.push(entry)
    }
    return { ...prev, tools }
  }
  return prev
}

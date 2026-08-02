import { diffWords } from 'diff'

interface Change {
  value: string
  added?: boolean
  removed?: boolean
}

interface InlineDiffViewerProps {
  oldContent: string
  newContent: string
  oldLabel: string
  newLabel: string
}

export function InlineDiffViewer({
  oldContent,
  newContent,
  oldLabel,
  newLabel
}: InlineDiffViewerProps) {
  const diff = diffWords(oldContent || '', newContent || '')
  
  return (
    <div className="h-full bg-slate-900 rounded-lg border border-slate-600 p-4 overflow-auto">
      {/* Legend */}
      <div className="flex gap-4 mb-4 pb-3 border-b border-slate-600 text-xs">
        <div className="text-slate-300">
          <span className="text-red-400">{oldLabel}</span> → <span className="text-green-400">{newLabel}</span>
        </div>
        <div className="flex gap-3 ml-auto">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 bg-red-500/20 border border-red-500 rounded"></span>
            <span className="text-slate-400">Removed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 bg-green-500/20 border border-green-500 rounded"></span>
            <span className="text-slate-400">Added</span>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      {diff.length === 1 && !diff[0].added && !diff[0].removed ? (
        <div className="text-center text-slate-400 py-12">
          No changes between versions
        </div>
      ) : (
        <div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
          {diff.map((part: Change, index: number) => {
            const className = part.added
              ? 'bg-green-900 text-green-300 border-b-2 border-green-600'
              : part.removed
              ? 'bg-red-900 text-red-300 border-b-2 border-red-600 line-through decoration-red-500/50'
              : 'text-slate-400'
            
            return (
              <span key={index} className={className}>
                {part.value}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

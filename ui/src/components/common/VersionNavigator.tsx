/**
 * VersionNavigator - Reusable version navigation component
 * 
 * Used in:
 * - WorkshopPanel (artifact versions)
 * - LibraryViewModal (document versions)
 * - ToolCallBlock (status update versions)
 */

interface VersionNavigatorProps {
  currentVersion: number
  totalVersions: number
  showDiff: boolean
  onPrevious: () => void
  onNext: () => void
  onToggleDiff: () => void
  // Optional customization
  size?: 'sm' | 'md'
  diffLabel?: string
  textLabel?: string
  showDiffButton?: boolean
  disabled?: boolean
}

export function VersionNavigator({
  currentVersion,
  totalVersions,
  showDiff,
  onPrevious,
  onNext,
  onToggleDiff,
  size = 'sm',
  diffLabel = 'Diff',
  textLabel = 'Text',
  showDiffButton = true,
  disabled = false
}: VersionNavigatorProps) {
  const isAtFirst = currentVersion === 1
  const isAtLast = currentVersion === totalVersions
  const hasPreviousVersion = currentVersion > 1

  // Size-based styles
  const buttonSize = size === 'sm' ? 'px-1' : 'px-2 py-1'
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const diffButtonPadding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5'

  return (
    <div className="flex items-center gap-2">
      {/* Previous Button */}
      <button
        onClick={onPrevious}
        disabled={isAtFirst || disabled}
        className={`${buttonSize} ${
          isAtFirst || disabled
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-400 hover:text-slate-100'
        } transition-colors`}
        title="Previous version"
      >
        <svg className={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Version Counter */}
      <span className={`${textSize} text-slate-400 font-mono whitespace-nowrap`}>
        v{currentVersion}/{totalVersions}
      </span>

      {/* Next Button */}
      <button
        onClick={onNext}
        disabled={isAtLast || disabled}
        className={`${buttonSize} ${
          isAtLast || disabled
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-400 hover:text-slate-100'
        } transition-colors`}
        title="Next version"
      >
        <svg className={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Diff Toggle Button - Always visible to prevent layout shift */}
      {showDiffButton && (
        <button
          onClick={onToggleDiff}
          disabled={disabled || !hasPreviousVersion}
          className={`${diffButtonPadding} rounded ${textSize} transition-colors whitespace-nowrap ${
            disabled || !hasPreviousVersion
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : showDiff
                ? 'bg-slate-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
          title={!hasPreviousVersion 
            ? 'No previous version to compare' 
            : showDiff 
              ? 'Show text view' 
              : 'Show changes from previous version'}
        >
          {showDiff ? textLabel : diffLabel}
        </button>
      )}
    </div>
  )
}

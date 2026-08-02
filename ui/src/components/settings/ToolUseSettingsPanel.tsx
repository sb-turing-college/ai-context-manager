import type { ToolAutoCheckMode, ToolName } from '../../types'

import type { SearchPastSessionsScope } from '../../services/settingsService'

interface ToolUseSettingsPanelProps {
  autoCheckMode: ToolAutoCheckMode
  enabledTools: Record<ToolName, boolean>
  onAutoCheckModeChange: (mode: ToolAutoCheckMode) => void
  onToggleTool: (tool: ToolName) => void
  onEnableAll: () => void
  onDisableAll: () => void
  searchPastSessionsScope?: SearchPastSessionsScope
  onSearchPastSessionsScopeChange?: (scope: SearchPastSessionsScope) => void
}

// Tool definitions with display info
const TOOL_DEFINITIONS: { tool: ToolName; label: string; category: 'status' | 'documents' }[] = [
  { tool: 'create_status', label: 'Create status', category: 'status' },
  { tool: 'read_status', label: 'Read status', category: 'status' },
  { tool: 'update_status', label: 'Update status', category: 'status' },
  { tool: 'delete_status', label: 'Delete status', category: 'status' },
  { tool: 'search_documents', label: 'Search documents', category: 'documents' },
  { tool: 'read_document', label: 'Read document', category: 'documents' }
]

// Auto-check mode definitions (always = implemented, others = placeholder)
const AUTO_CHECK_MODES: { mode: ToolAutoCheckMode; label: string; description: string; disabled?: boolean }[] = [
  { 
    mode: 'always', 
    label: 'Always check', 
    description: 'AI checks status on every message' 
  },
  { 
    mode: 'on_request', 
    label: 'On request only', 
    description: 'AI checks only when explicitly requested',
    disabled: true 
  },
  { 
    mode: 'ai_decides', 
    label: 'AI decides', 
    description: 'AI decides based on context',
    disabled: true 
  }
]

/**
 * Settings panel for tool use configuration
 * 
 * Features:
 * - Auto-check mode selection (radio buttons)
 * - Per-tool enable/disable (checkboxes)
 * - Grouped by category (Status, Documents)
 */
const SEARCH_SCOPE_OPTIONS: { value: SearchPastSessionsScope; label: string; description: string }[] = [
  { value: 'cross_project', label: 'Cross-project', description: 'Search across all projects (default)' },
  { value: 'project_only', label: 'Project-bound', description: 'Only sessions of the current project' },
  { value: 'session_only', label: 'Current session only', description: 'Only messages of the current session' }
]

export function ToolUseSettingsPanel({
  autoCheckMode,
  enabledTools,
  onAutoCheckModeChange,
  onToggleTool,
  onEnableAll,
  onDisableAll,
  searchPastSessionsScope = 'cross_project',
  onSearchPastSessionsScopeChange
}: ToolUseSettingsPanelProps) {
  const statusTools = TOOL_DEFINITIONS.filter(t => t.category === 'status')
  const documentTools = TOOL_DEFINITIONS.filter(t => t.category === 'documents')
  
  const allEnabled = Object.values(enabledTools).every(Boolean)
  const noneEnabled = Object.values(enabledTools).every(v => !v)

  return (
    <div className="space-y-6">
      {/* Section: Auto-Check Mode */}
      <div>
        <label className="text-sm font-medium text-slate-300 block mb-3">
          Automatic status check
        </label>
        <div className="space-y-2">
          {AUTO_CHECK_MODES.map(({ mode, label, description, disabled }) => (
            <label
              key={mode}
              className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                disabled
                  ? 'bg-slate-700/60 border border-slate-600 opacity-60 cursor-not-allowed'
                  : autoCheckMode === mode
                    ? 'bg-blue-900/30 border border-blue-700 cursor-pointer'
                    : 'bg-slate-700 border border-slate-600 hover:bg-slate-600 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="autoCheckMode"
                value={mode}
                checked={autoCheckMode === mode}
                onChange={() => !disabled && onAutoCheckModeChange(mode)}
                disabled={disabled}
                className="mt-0.5 accent-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm text-slate-200 font-medium">{label}</div>
                <div className="text-xs text-slate-400">{description}</div>
                {disabled && (
                  <div className="text-xs text-slate-500 mt-1">Not yet implemented</div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Section: Search Past Sessions Scope */}
      {onSearchPastSessionsScopeChange && (
        <div>
          <label className="text-sm font-medium text-slate-300 block mb-3">
            Semantic search (search_past_sessions)
          </label>
          <div className="space-y-2">
            {SEARCH_SCOPE_OPTIONS.map(({ value, label, description }) => (
              <label
                key={value}
                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  searchPastSessionsScope === value
                    ? 'bg-blue-900/30 border border-blue-700'
                    : 'bg-slate-700 border border-slate-600 hover:bg-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="searchScope"
                  value={value}
                  checked={searchPastSessionsScope === value}
                  onChange={() => onSearchPastSessionsScopeChange(value)}
                  className="mt-0.5 accent-blue-500"
                />
                <div className="flex-1">
                  <div className="text-sm text-slate-200 font-medium">{label}</div>
                  <div className="text-xs text-slate-400">{description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Section: Enabled Tools */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-300">
            Enabled tools
          </label>
          <div className="flex gap-2">
            <button
              onClick={onEnableAll}
              disabled={allEnabled}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                allEnabled
                  ? 'text-slate-500 cursor-not-allowed'
                  : 'text-blue-400 hover:text-blue-300 hover:bg-slate-700'
              }`}
            >
              All on
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={onDisableAll}
              disabled={noneEnabled}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                noneEnabled
                  ? 'text-slate-500 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
              }`}
            >
              All off
            </button>
          </div>
        </div>

        {/* Status Tools */}
        <div className="mb-4">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            Status (CRUD)
          </div>
          <div className="space-y-1">
            {statusTools.map(({ tool, label }) => (
              <label
                key={tool}
                className="flex items-center gap-3 p-2 rounded hover:bg-slate-700 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={enabledTools[tool]}
                  onChange={() => onToggleTool(tool)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Document Tools */}
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
            Documents (read-only)
          </div>
          <div className="space-y-1">
            {documentTools.map(({ tool, label }) => (
              <label
                key={tool}
                className="flex items-center gap-3 p-2 rounded hover:bg-slate-700 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={enabledTools[tool]}
                  onChange={() => onToggleTool(tool)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
        <p className="text-xs text-slate-400 leading-relaxed">
          <strong className="text-slate-300">Tip:</strong> The AI uses these tools to track dynamic facts 
          (e.g. balances, inventory) automatically. Disabled tools are not made available 
          to the AI.
        </p>
      </div>
    </div>
  )
}

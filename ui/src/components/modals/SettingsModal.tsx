import { useState } from 'react'
import type { SettingsTab, ToolAutoCheckMode, ToolName, SummaryTriggerMode } from '../../types'
import { ToolUseSettingsPanel, CostDashboard, SystemPromptsManager } from '../settings'
import { clearAllData, updateAppSettings } from '../../services/settingsService'
import { ALL_MODELS } from '../../config/models'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  animationsEnabled: boolean
  onAnimationsChange: (enabled: boolean) => void
  showSendButton: boolean
  onShowSendButtonChange: (show: boolean) => void
  // Tool-Use Settings
  toolUseSettings?: {
    autoCheckMode: ToolAutoCheckMode
    enabledTools: Record<ToolName, boolean>
    onAutoCheckModeChange: (mode: ToolAutoCheckMode) => void
    onToggleTool: (tool: ToolName) => void
    onEnableAll: () => void
    onDisableAll: () => void
  }
  // Summary Trigger Settings
  summaryTriggerMode?: SummaryTriggerMode
  onSummaryTriggerModeChange?: (mode: SummaryTriggerMode) => void
  // App settings from API (for Intelligence tab)
  appSettings?: {
    summaryKeepMessagePairs?: number
    modelIdsHidden?: string[]
    summaryModelMode?: 'current' | 'fixed'
    summaryModelId?: string | null
    searchPastSessionsScope?: 'cross_project' | 'project_only' | 'session_only'
  } | null
  onAppSettingsRefresh?: () => void
}

// Available font size steps
const FONT_SIZE_STEPS = [80, 90, 100, 110, 120, 130, 140, 150, 175, 200]

export function SettingsModal({ 
  isOpen, 
  onClose, 
  currentTab, 
  onTabChange,
  fontSize,
  onFontSizeChange,
  animationsEnabled,
  onAnimationsChange,
  showSendButton,
  onShowSendButtonChange,
  toolUseSettings,
  summaryTriggerMode = 'manual',
  onSummaryTriggerModeChange,
  appSettings,
  onAppSettingsRefresh
}: SettingsModalProps) {
  const [resetConfirm, setResetConfirm] = useState(false)
  
  if (!isOpen) return null

  const handleClearAllData = () => {
    if (!resetConfirm) {
      setResetConfirm(true)
      return
    }
    
    // Use service to clear all localStorage data
    clearAllData()
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-8"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Settings</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => onTabChange('app')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentTab === 'app'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            App
          </button>
          <button
            onClick={() => onTabChange('intelligence')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentTab === 'intelligence'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            Intelligence
          </button>
          <button
            onClick={() => onTabChange('systemprompts')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentTab === 'systemprompts'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            System prompts
          </button>
          <button
            onClick={() => onTabChange('costs')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentTab === 'costs'
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            Kosten
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          {currentTab === 'app' && (
            <div className="space-y-4">
              {/* Font size */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-3">
                  Font size: {fontSize}%
                </label>
                <div className="space-y-1">
                    {/* Slider with visual snap points */}
                  <div className="relative h-5">
                    {/* Horizontale Verbindungslinie (Hintergrund grau) */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-slate-600 rounded-full pointer-events-none" />
                    
                    {/* Horizontale Verbindungslinie (Fortschritt blau) */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-blue-500 rounded-full pointer-events-none transition-all"
                      style={{ width: `${(FONT_SIZE_STEPS.indexOf(fontSize) / (FONT_SIZE_STEPS.length - 1)) * 100}%` }}
                    />
                    
                    {/* Visual snap points - absolute positioning for each point */}
                    {FONT_SIZE_STEPS.map((step, i) => {
                      const percent = (i / (FONT_SIZE_STEPS.length - 1)) * 100
                      return (
                        <div
                          key={step}
                          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border transition-all pointer-events-none ${
                            i <= FONT_SIZE_STEPS.indexOf(fontSize)
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-slate-700 border-slate-500'
                          }`}
                          style={{ left: `${percent}%` }}
                        />
                      )
                    })}
                    
                    {/* Native range slider (transparent, for drag functionality) */}
                    <input
                      type="range"
                      min="0"
                      max={FONT_SIZE_STEPS.length - 1}
                      value={FONT_SIZE_STEPS.indexOf(fontSize)}
                      onChange={(e) => onFontSizeChange(FONT_SIZE_STEPS[parseInt(e.target.value)])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    {/* Active point (larger, on top) */}
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 border-2 border-blue-400 rounded-full shadow-lg pointer-events-none transition-all"
                      style={{ left: `${(FONT_SIZE_STEPS.indexOf(fontSize) / (FONT_SIZE_STEPS.length - 1)) * 100}%` }}
                    />
                  </div>
                  
                  {/* Labels */}
                  <div className="relative h-4 text-[10px] text-slate-500">
                    {FONT_SIZE_STEPS.map((step, i) => {
                      const percent = (i / (FONT_SIZE_STEPS.length - 1)) * 100
                      return (
                        <span 
                          key={step} 
                          className={`absolute -translate-x-1/2 cursor-pointer hover:text-slate-300 transition-colors ${
                            step === fontSize ? 'text-blue-400 font-medium' : ''
                          }`}
                          style={{ left: `${percent}%` }}
                          onClick={() => onFontSizeChange(step)}
                        >
                          {step}%
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Animationen</label>
                <select 
                  value={animationsEnabled ? 'enabled' : 'disabled'}
                  onChange={(e) => onAnimationsChange(e.target.value === 'enabled')}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="enabled">Enabled (default)</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Show send button</label>
                <select 
                  value={showSendButton ? 'show' : 'hide'}
                  onChange={(e) => onShowSendButtonChange(e.target.value === 'show')}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="hide">Hidden (Enter to send)</option>
                  <option value="show">Angezeigt</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Tip: Press Enter to send, Shift+Enter for a new line</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Theme</label>
                <select className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Dark (default)</option>
                  <option>Light</option>
                  <option>System</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Benachrichtigungen</label>
                <select className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Sound</option>
                  <option>Silent</option>
                </select>
              </div>

              {/* Development Tools */}
              <div className="border-t border-slate-700 pt-4 mt-6">
                <p className="text-xs font-medium text-slate-400 mb-2">Development Tools</p>
                <p className="text-xs text-slate-500 mb-3">For testing and development purposes</p>
                {!resetConfirm ? (
                  <button 
                    onClick={handleClearAllData}
                    className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete all data (localStorage)
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button 
                      onClick={handleClearAllData}
                      className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      ⚠️ Really delete all localStorage data?
                    </button>
                    <button 
                      onClick={() => setResetConfirm(false)}
                      className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'intelligence' && (
            <div className="space-y-6">
              {/* Summary: keep message pairs */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Message pairs after summary</label>
                <p className="text-xs text-slate-400 mb-2">Number of recent user/AI pairs that stay active after a summary (rest is archived).</p>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={appSettings?.summaryKeepMessagePairs ?? 5}
                  onChange={async (e) => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v) && v >= 1 && v <= 20) {
                      await updateAppSettings({ summaryKeepMessagePairs: v })
                      onAppSettingsRefresh?.()
                    }
                  }}
                  className="w-full max-w-[120px] bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Summary Model */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Summary-Modell</label>
                <p className="text-xs text-slate-400 mb-2">Which model should be used for summaries?</p>
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="summaryModelMode"
                      checked={(appSettings?.summaryModelMode ?? 'current') === 'current'}
                      onChange={async () => {
                        await updateAppSettings({ summaryModelMode: 'current' })
                        onAppSettingsRefresh?.()
                      }}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-slate-200">Current chat model</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="summaryModelMode"
                      checked={(appSettings?.summaryModelMode ?? 'current') === 'fixed'}
                      onChange={async () => {
                        await updateAppSettings({ summaryModelMode: 'fixed', summaryModelId: appSettings?.summaryModelId || ALL_MODELS[0]?.id })
                        onAppSettingsRefresh?.()
                      }}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-slate-200">Bestimmtes Modell</span>
                  </label>
                </div>
                {(appSettings?.summaryModelMode ?? 'current') === 'fixed' && (
                  <select
                    value={appSettings?.summaryModelId ?? ALL_MODELS[0]?.id ?? ''}
                    onChange={async (e) => {
                      await updateAppSettings({ summaryModelId: e.target.value })
                      onAppSettingsRefresh?.()
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ALL_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Hide models */}
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">Visible models</label>
                <p className="text-xs text-slate-400 mb-3">Models that should be hidden in the model picker (not deleted, only hidden).</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {ALL_MODELS.map(model => {
                    const isHidden = (appSettings?.modelIdsHidden ?? []).includes(model.id)
                    return (
                      <label key={model.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          onChange={async () => {
                            const hidden = appSettings?.modelIdsHidden ?? []
                            const next = isHidden ? hidden.filter(id => id !== model.id) : [...hidden, model.id]
                            await updateAppSettings({ modelIdsHidden: next })
                            onAppSettingsRefresh?.()
                          }}
                          className="accent-blue-500"
                        />
                        <span className="text-sm text-slate-200">{model.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Summary Trigger Settings */}
              <div className="border-t border-slate-700 pt-6">
                <h4 className="text-sm font-semibold text-slate-200 mb-4">
                  Automatic summary
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  Controls how the app reacts when the token limit for a summary is reached.
                </p>
                <div className="space-y-2">
                  {[
                    { 
                      mode: 'automatic' as SummaryTriggerMode, 
                      label: 'Automatisch', 
                      description: 'Summary is created automatically (brief UI hint)' 
                    },
                    { 
                      mode: 'manual' as SummaryTriggerMode, 
                      label: 'Hint + Manual', 
                      description: 'Hint is shown, user confirms manually (default)' 
                    },
                    { 
                      mode: 'disabled' as SummaryTriggerMode, 
                      label: 'Aus', 
                      description: 'No automatic summary suggestions' 
                    }
                  ].map(({ mode, label, description }) => (
                    <label
                      key={mode}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        summaryTriggerMode === mode
                          ? 'bg-blue-900/30 border border-blue-700'
                          : 'bg-slate-700 border border-slate-600 hover:bg-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="summaryTriggerMode"
                        value={mode}
                        checked={summaryTriggerMode === mode}
                        onChange={() => onSummaryTriggerModeChange?.(mode)}
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

              {/* Tool-Use Settings */}
              {toolUseSettings && (
                <div className="border-t border-slate-700 pt-6">
                  <h4 className="text-sm font-semibold text-slate-200 mb-4">
                    Tool-Nutzung
                  </h4>
                  <ToolUseSettingsPanel
                    autoCheckMode={toolUseSettings.autoCheckMode}
                    enabledTools={toolUseSettings.enabledTools}
                    onAutoCheckModeChange={toolUseSettings.onAutoCheckModeChange}
                    onToggleTool={toolUseSettings.onToggleTool}
                    onEnableAll={toolUseSettings.onEnableAll}
                    onDisableAll={toolUseSettings.onDisableAll}
                    searchPastSessionsScope={appSettings?.searchPastSessionsScope ?? 'cross_project'}
                    onSearchPastSessionsScopeChange={async (scope) => {
                      await updateAppSettings({ searchPastSessionsScope: scope })
                      onAppSettingsRefresh?.()
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {currentTab === 'systemprompts' && (
            <SystemPromptsManager />
          )}

          {currentTab === 'costs' && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-4">
                Token-Nutzung & Kosten
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                Real token counts from API responses. Should match provider consoles.
              </p>
              <CostDashboard />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

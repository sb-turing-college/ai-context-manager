import { useState, useCallback, useEffect } from 'react'
import type { ToolUseSettings, ToolAutoCheckMode, ToolName } from '../types'
import {
  getToolUseSettingsSync,
  setToolUseSettingsSync
} from '../services/settingsService'

/**
 * Hook for managing tool use settings
 * 
 * Uses settingsService as single source of truth for localStorage access.
 * 
 * Features:
 * - Auto-check mode (always, on_request, ai_decides)
 * - Per-tool enable/disable
 * - Persisted via settingsService
 */
export function useToolUseSettings() {
  const [settings, setSettings] = useState<ToolUseSettings>(getToolUseSettingsSync)

  // Persist changes via service
  useEffect(() => {
    setToolUseSettingsSync(settings)
  }, [settings])

  // Set auto-check mode
  const setAutoCheckMode = useCallback((mode: ToolAutoCheckMode) => {
    setSettings(prev => ({ ...prev, autoCheckMode: mode }))
  }, [])

  // Toggle a specific tool
  const toggleTool = useCallback((tool: ToolName) => {
    setSettings(prev => ({
      ...prev,
      enabledTools: {
        ...prev.enabledTools,
        [tool]: !prev.enabledTools[tool]
      }
    }))
  }, [])

  // Enable/disable a specific tool
  const setToolEnabled = useCallback((tool: ToolName, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      enabledTools: {
        ...prev.enabledTools,
        [tool]: enabled
      }
    }))
  }, [])

  // Enable all tools
  const enableAllTools = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      enabledTools: {
        create_status: true,
        read_status: true,
        update_status: true,
        delete_status: true,
        search_documents: true,
        read_document: true,
        create_draft: true
      }
    }))
  }, [])

  // Disable all tools
  const disableAllTools = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      enabledTools: {
        create_status: false,
        read_status: false,
        update_status: false,
        delete_status: false,
        search_documents: false,
        read_document: false,
        create_draft: false
      }
    }))
  }, [])

  // Reset to defaults (reload from service)
  const resetToDefaults = useCallback(() => {
    // Clear localStorage and reload defaults
    setSettings(getToolUseSettingsSync())
  }, [])

  // Check if a tool is enabled
  const isToolEnabled = useCallback((tool: ToolName): boolean => {
    return settings.enabledTools[tool]
  }, [settings.enabledTools])

  // Get count of enabled tools
  const enabledToolCount = Object.values(settings.enabledTools).filter(Boolean).length
  const totalToolCount = Object.keys(settings.enabledTools).length

  return {
    // State
    settings,
    autoCheckMode: settings.autoCheckMode,
    enabledTools: settings.enabledTools,
    enabledToolCount,
    totalToolCount,

    // Actions
    setAutoCheckMode,
    toggleTool,
    setToolEnabled,
    enableAllTools,
    disableAllTools,
    resetToDefaults,
    isToolEnabled
  }
}

export type UseToolUseSettingsReturn = ReturnType<typeof useToolUseSettings>

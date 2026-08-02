/**
 * Settings Service - Abstraction Layer for User Settings
 *
 * REST API is always enabled (portfolio path).
 *
 * IMPORTANT: This is the SINGLE source of truth for all settings.
 * All hooks should use this service, not direct localStorage access.
 */

import type {
  SystemRole,
  StatusTopicItem,
  ToolUseSettings,
  SystemPromptModule,
  ToolAutoCheckMode,
  ToolName,
  SummaryTriggerMode
} from '../types'
import {
  DEFAULT_GENERAL_RULES,
  DEFAULT_TOOL_USE_RULES,
  DEFAULT_ROLE_CHAT
} from '../data/defaultSystemPrompts'
import { API_BASE, USE_API } from '../config/api'

// --- Storage Keys ---
// All localStorage keys used by the app - single source of truth
export const STORAGE_KEYS = {
  // App Settings
  fontSize: 'ai-workstation-font-size',
  animations: 'ai-workstation-animations',
  showSendButton: 'ai-workstation-show-send-button',
  
  // Data (managed by useLocalStorage in App.tsx)
  projects: 'ai-workstation-projects',
  folders: 'ai-workstation-folders',
  items: 'ai-workstation-items',
  sessions: 'ai-workstation-sessions',
  chats: 'ai-workstation-chats',
  
  // Settings
  systemRoles: 'ai-workstation-system-roles',
  statusTopics: 'ai-workstation-status-topics',
  toolUseSettings: 'ai-workstation-tool-use-settings',
  systemPromptModules: 'ai-workstation-system-prompt-modules',
  summaryTriggerMode: 'ai-workstation-summary-trigger-mode',
  chatBModel: 'ai-workstation-chat-b-model',
  chatAModel: 'ai-workstation-chat-a-model'
}

// Internal alias for backward compatibility
const KEYS = STORAGE_KEYS

// --- Type Converters ---

function convertApiRole(apiRole: any): SystemRole {
  return {
    id: apiRole.id,
    title: apiRole.title,
    content: apiRole.content,
    category: apiRole.category as 'chat' | 'audit' | 'verify',
    isDefault: apiRole.is_default,
    lastModified: apiRole.updated_at
  }
}

function convertApiStatusTopic(apiTopic: any): StatusTopicItem {
  return {
    id: apiTopic.id,
    title: apiTopic.title,
    content: apiTopic.content,
    projectId: apiTopic.project_id,
    order: apiTopic.order_index
  }
}

// --- App Settings ---

export type SearchPastSessionsScope = 'cross_project' | 'project_only' | 'session_only'

export interface AppSettings {
  fontSize: number
  animationsEnabled: boolean
  summaryTriggerMode: SummaryTriggerMode
  summaryKeepMessagePairs?: number
  modelIdsHidden?: string[]
  summaryModelMode?: 'current' | 'fixed'
  summaryModelId?: string | null
  searchPastSessionsScope?: SearchPastSessionsScope
}

export async function getAppSettings(): Promise<AppSettings> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings`)
      if (!response.ok) throw new Error('Failed to fetch app settings')
      
      const data = await response.json()
      return {
        fontSize: data.font_size,
        animationsEnabled: data.animations_enabled,
        summaryTriggerMode: data.summary_trigger_mode as SummaryTriggerMode,
        summaryKeepMessagePairs: data.summary_keep_message_pairs ?? 5,
        modelIdsHidden: data.model_ids_hidden ?? [],
        summaryModelMode: (data.summary_model_mode || 'current') as 'current' | 'fixed',
        summaryModelId: data.summary_model_id ?? null,
        searchPastSessionsScope: (data.search_past_sessions_scope || 'cross_project') as SearchPastSessionsScope
      }
    } catch (error) {
      console.error('Failed to fetch app settings from API:', error)
      return getAppSettingsFromStorage()
    }
  }
  
  return getAppSettingsFromStorage()
}

function getAppSettingsFromStorage(): AppSettings {
  return {
    fontSize: getSettingSync<number>(KEYS.fontSize, 100),
    animationsEnabled: getSettingSync<boolean>(KEYS.animations, true),
    summaryTriggerMode: getSettingSync<SummaryTriggerMode>(KEYS.summaryTriggerMode, 'manual')
  }
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
  if (USE_API) {
    try {
      const updateData: Record<string, unknown> = {}
      if (settings.fontSize !== undefined) updateData.font_size = settings.fontSize
      if (settings.animationsEnabled !== undefined) updateData.animations_enabled = settings.animationsEnabled
      if (settings.summaryTriggerMode !== undefined) updateData.summary_trigger_mode = settings.summaryTriggerMode
      if (settings.summaryKeepMessagePairs !== undefined) updateData.summary_keep_message_pairs = settings.summaryKeepMessagePairs
      if (settings.modelIdsHidden !== undefined) updateData.model_ids_hidden = settings.modelIdsHidden
      if (settings.summaryModelMode !== undefined) updateData.summary_model_mode = settings.summaryModelMode
      if (settings.summaryModelId !== undefined) updateData.summary_model_id = settings.summaryModelId
      if (settings.searchPastSessionsScope !== undefined) updateData.search_past_sessions_scope = settings.searchPastSessionsScope
      
      const response = await fetch(`${API_BASE}/api/v1/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      if (!response.ok) throw new Error('Failed to update app settings')
      
      // Also update localStorage as cache
      updateAppSettingsInStorage(settings)
    } catch (error) {
      console.error('Failed to update app settings via API:', error)
      updateAppSettingsInStorage(settings)
    }
  } else {
    updateAppSettingsInStorage(settings)
  }
}

function updateAppSettingsInStorage(settings: Partial<AppSettings>): void {
  if (settings.fontSize !== undefined) {
    setSettingSync(KEYS.fontSize, settings.fontSize)
  }
  if (settings.animationsEnabled !== undefined) {
    setSettingSync(KEYS.animations, settings.animationsEnabled)
  }
  if (settings.summaryTriggerMode !== undefined) {
    setSettingSync(KEYS.summaryTriggerMode, settings.summaryTriggerMode)
  }
}

// --- System Roles ---

export async function getSystemRoles(): Promise<SystemRole[]> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings/roles`)
      if (!response.ok) throw new Error('Failed to fetch system roles')
      
      const data = await response.json()
      return data.map(convertApiRole)
    } catch (error) {
      console.error('Failed to fetch system roles from API:', error)
      return getSystemRolesFromStorage()
    }
  }
  
  return getSystemRolesFromStorage()
}

function getSystemRolesFromStorage(): SystemRole[] {
  return getSettingSync<SystemRole[]>(KEYS.systemRoles, [])
}

export async function saveSystemRoles(roles: SystemRole[]): Promise<void> {
  setSettingSync(KEYS.systemRoles, roles)
}

export async function createSystemRole(role: Omit<SystemRole, 'id' | 'lastModified'>): Promise<SystemRole> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: role.title,
          content: role.content,
          category: role.category,
          is_default: role.isDefault
        })
      })
      
      if (!response.ok) throw new Error('Failed to create system role')
      
      const data = await response.json()
      return convertApiRole(data)
    } catch (error) {
      console.error('Failed to create system role via API:', error)
      throw error
    }
  }
  
  // localStorage fallback
  const newRole: SystemRole = {
    id: `role-${Date.now()}`,
    ...role,
    lastModified: new Date().toISOString()
  }
  
  const roles = getSystemRolesFromStorage()
  saveSystemRoles([...roles, newRole])
  
  return newRole
}

export async function updateSystemRole(roleId: string, updates: Partial<Omit<SystemRole, 'id' | 'lastModified'>>): Promise<SystemRole | null> {
  if (USE_API) {
    try {
      const updateData: Record<string, unknown> = {}
      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.content !== undefined) updateData.content = updates.content
      if (updates.category !== undefined) updateData.category = updates.category
      if (updates.isDefault !== undefined) updateData.is_default = updates.isDefault
      
      const response = await fetch(`${API_BASE}/api/v1/settings/roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      if (response.status === 404) return null
      if (!response.ok) throw new Error('Failed to update system role')
      
      const data = await response.json()
      return convertApiRole(data)
    } catch (error) {
      console.error('Failed to update system role via API:', error)
      return null
    }
  }
  
  // localStorage fallback
  const roles = getSystemRolesFromStorage()
  const index = roles.findIndex(r => r.id === roleId)
  
  if (index === -1) return null
  
  const updated = {
    ...roles[index],
    ...updates,
    lastModified: new Date().toISOString()
  }
  
  roles[index] = updated
  saveSystemRoles(roles)
  
  return updated
}

export async function deleteSystemRole(roleId: string): Promise<boolean> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings/roles/${roleId}`, {
        method: 'DELETE'
      })
      
      return response.status === 204
    } catch (error) {
      console.error('Failed to delete system role via API:', error)
      return false
    }
  }
  
  // localStorage fallback
  const roles = getSystemRolesFromStorage()
  const filtered = roles.filter(r => r.id !== roleId)
  
  if (filtered.length === roles.length) return false
  
  saveSystemRoles(filtered)
  return true
}

// --- Status Topics ---

export async function getStatusTopics(projectId: string): Promise<StatusTopicItem[]> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/status`)
      if (!response.ok) throw new Error('Failed to fetch status topics')
      
      const data = await response.json()
      return data.map(convertApiStatusTopic)
    } catch (error) {
      console.error('Failed to fetch status topics from API:', error)
      return getStatusTopicsFromStorage()
    }
  }
  
  return getStatusTopicsFromStorage()
}

function getStatusTopicsFromStorage(): StatusTopicItem[] {
  return getSettingSync<StatusTopicItem[]>(KEYS.statusTopics, [])
}

export async function saveStatusTopics(topics: StatusTopicItem[]): Promise<void> {
  setSettingSync(KEYS.statusTopics, topics)
}

export async function createStatusTopic(projectId: string, topic: Omit<StatusTopicItem, 'id'>): Promise<StatusTopicItem> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title: topic.title,
          content: topic.content,
          order_index: topic.order
        })
      })
      
      if (!response.ok) throw new Error('Failed to create status topic')
      
      const data = await response.json()
      return convertApiStatusTopic(data)
    } catch (error) {
      console.error('Failed to create status topic via API:', error)
      throw error
    }
  }
  
  // localStorage fallback
  const newTopic: StatusTopicItem = {
    id: `status-${Date.now()}`,
    ...topic
  }
  
  const topics = getStatusTopicsFromStorage()
  saveStatusTopics([...topics, newTopic])
  
  return newTopic
}

export async function updateStatusTopic(topicId: string, updates: Partial<Omit<StatusTopicItem, 'id'>>, reason?: string): Promise<StatusTopicItem | null> {
  if (USE_API) {
    try {
      const updateData: Record<string, unknown> = {}
      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.content !== undefined) updateData.content = updates.content
      if (updates.order !== undefined) updateData.order_index = updates.order
      if (reason !== undefined) updateData.reason = reason
      
      const response = await fetch(`${API_BASE}/api/v1/status/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      
      if (response.status === 404) return null
      if (!response.ok) throw new Error('Failed to update status topic')
      
      const data = await response.json()
      return convertApiStatusTopic(data)
    } catch (error) {
      console.error('Failed to update status topic via API:', error)
      return null
    }
  }
  
  // localStorage fallback
  const topics = getStatusTopicsFromStorage()
  const index = topics.findIndex(t => t.id === topicId)
  
  if (index === -1) return null
  
  const updated = {
    ...topics[index],
    ...updates
  }
  
  topics[index] = updated
  saveStatusTopics(topics)
  
  return updated
}

export async function deleteStatusTopic(topicId: string): Promise<boolean> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/status/${topicId}`, {
        method: 'DELETE'
      })
      
      return response.status === 204
    } catch (error) {
      console.error('Failed to delete status topic via API:', error)
      return false
    }
  }
  
  // localStorage fallback
  const topics = getStatusTopicsFromStorage()
  const filtered = topics.filter(t => t.id !== topicId)
  
  if (filtered.length === topics.length) return false
  
  saveStatusTopics(filtered)
  return true
}

// --- Generic Settings Helpers ---

function getSettingSync<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

function setSettingSync<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// --- Sync versions for immediate state updates ---

export function getFontSizeSync(): number {
  return getSettingSync<number>(KEYS.fontSize, 100)
}

export function setFontSizeSync(size: number): void {
  setSettingSync(KEYS.fontSize, size)
}

export function getAnimationsEnabledSync(): boolean {
  return getSettingSync<boolean>(KEYS.animations, true)
}

export function setAnimationsEnabledSync(enabled: boolean): void {
  setSettingSync(KEYS.animations, enabled)
}

export function getSystemRolesSync(): SystemRole[] {
  return getSettingSync<SystemRole[]>(KEYS.systemRoles, [])
}

export function saveSystemRolesSync(roles: SystemRole[]): void {
  setSettingSync(KEYS.systemRoles, roles)
}

// --- Tool Use Settings ---

const DEFAULT_TOOL_USE_SETTINGS: ToolUseSettings = {
  autoCheckMode: 'always',
  enabledTools: {
    create_status: true,
    read_status: true,
    update_status: true,
    delete_status: true,
    search_documents: true,
    read_document: true,
    create_draft: true
  }
}

export async function getToolUseSettings(): Promise<ToolUseSettings> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings/tool-use`)
      if (!response.ok) throw new Error('Failed to fetch tool use settings')
      
      const data = await response.json()
      return {
        autoCheckMode: (data.auto_check_mode as ToolAutoCheckMode | undefined) ?? 'always',
        enabledTools: data.enabled_tools
      }
    } catch (error) {
      console.error('Failed to fetch tool use settings from API:', error)
      return getToolUseSettingsSync()
    }
  }
  
  return getToolUseSettingsSync()
}

export async function saveToolUseSettings(settings: ToolUseSettings): Promise<void> {
  if (USE_API) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings/tool-use`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_confirm: false,
          enabled_tools: settings.enabledTools
        })
      })
      
      if (!response.ok) throw new Error('Failed to update tool use settings')
      
      // Also update localStorage as cache
      setSettingSync(KEYS.toolUseSettings, settings)
    } catch (error) {
      console.error('Failed to update tool use settings via API:', error)
      setSettingSync(KEYS.toolUseSettings, settings)
    }
  } else {
    setSettingSync(KEYS.toolUseSettings, settings)
  }
}

export function getToolUseSettingsSync(): ToolUseSettings {
  const stored = getSettingSync<ToolUseSettings | null>(KEYS.toolUseSettings, null)
  if (!stored) return DEFAULT_TOOL_USE_SETTINGS
  
  // Merge with defaults to handle new tools added in future versions
  return {
    ...DEFAULT_TOOL_USE_SETTINGS,
    ...stored,
    enabledTools: {
      ...DEFAULT_TOOL_USE_SETTINGS.enabledTools,
      ...stored.enabledTools
    }
  }
}

export function setToolUseSettingsSync(settings: ToolUseSettings): void {
  setSettingSync(KEYS.toolUseSettings, settings)
}

export function setAutoCheckModeSync(mode: ToolAutoCheckMode): void {
  const current = getToolUseSettingsSync()
  setToolUseSettingsSync({ ...current, autoCheckMode: mode })
}

export function setToolEnabledSync(toolName: ToolName, enabled: boolean): void {
  const current = getToolUseSettingsSync()
  setToolUseSettingsSync({
    ...current,
    enabledTools: {
      ...current.enabledTools,
      [toolName]: enabled
    }
  })
}

// --- System Prompt Modules ---
// Defaults imported from data/defaultSystemPrompts.ts (single source of truth)

const DEFAULT_SYSTEM_PROMPT_MODULES: SystemPromptModule[] = [
  {
    id: 'general_rules',
    title: 'General Rules',
    content: DEFAULT_GENERAL_RULES,
    defaultContent: DEFAULT_GENERAL_RULES,
    isExpanded: false
  },
  {
    id: 'tool_use',
    title: 'Tool Use',
    content: DEFAULT_TOOL_USE_RULES,
    defaultContent: DEFAULT_TOOL_USE_RULES,
    isExpanded: false
  },
  {
    id: 'role',
    title: 'Role',
    content: DEFAULT_ROLE_CHAT,
    defaultContent: DEFAULT_ROLE_CHAT,
    isExpanded: true // Role expanded by default
  }
]

// Note: 'summary' is NOT included here - it's only used by the backend /chat/summary endpoint
const BACKEND_MODULE_MAP: Record<string, string> = {
  'general_rules': 'base',
  'tool_use': 'tool_use',
  'role': 'expertise'
}

export async function getSystemPromptModules(): Promise<SystemPromptModule[]> {
  const response = await fetch(`${API_BASE}/api/v1/settings/system-prompt-modules`)
  if (!response.ok) {
    throw new Error(`Failed to fetch system prompt modules: ${response.statusText}`)
  }
  
  const data = await response.json()
  
  // Convert backend modules to frontend format
  return DEFAULT_SYSTEM_PROMPT_MODULES.map(defaultModule => {
    const backendKey = BACKEND_MODULE_MAP[defaultModule.id]
    const apiModule = data.find((m: any) => m.key === backendKey)
    
    if (apiModule) {
      return {
        ...defaultModule,
        content: apiModule.content,
        isExpanded: defaultModule.isExpanded,
        isDefault: apiModule.is_default || false  // Use backend's is_default flag for accurate comparison
      }
    }
    
    return defaultModule
  })
}

// Removed: localStorage functions replaced by API-only approach

export async function updateSystemPromptModule(
  moduleId: SystemPromptModule['id'], 
  content: string
): Promise<void> {
  const backendKey = BACKEND_MODULE_MAP[moduleId]
  if (!backendKey) throw new Error(`Unknown module ID: ${moduleId}`)
  
  const response = await fetch(`${API_BASE}/api/v1/settings/system-prompt-modules/${backendKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to update system prompt: ${response.statusText}`)
  }
}

export async function resetSystemPromptModule(moduleId: SystemPromptModule['id']): Promise<void> {
  const backendKey = BACKEND_MODULE_MAP[moduleId]
  if (!backendKey) throw new Error(`Unknown module ID: ${moduleId}`)
  
  const response = await fetch(`${API_BASE}/api/v1/settings/system-prompt-modules/${backendKey}/reset`, {
    method: 'POST'
  })
  
  if (!response.ok) {
    throw new Error(`Failed to reset system prompt: ${response.statusText}`)
  }
}

// --- Summary Trigger Settings ---

const DEFAULT_SUMMARY_TRIGGER_MODE: SummaryTriggerMode = 'manual'

export function getSummaryTriggerModeSync(): SummaryTriggerMode {
  return getSettingSync<SummaryTriggerMode>(KEYS.summaryTriggerMode, DEFAULT_SUMMARY_TRIGGER_MODE)
}

export function setSummaryTriggerModeSync(mode: SummaryTriggerMode): void {
  setSettingSync(KEYS.summaryTriggerMode, mode)
}

// --- Chat A Model (last used, persisted like Chat B) ---

export function getChatAModelSync(): string {
  return getSettingSync<string>(KEYS.chatAModel, '')
}

export function setChatAModelSync(modelId: string): void {
  setSettingSync(KEYS.chatAModel, modelId)
}

// --- Reset Functions ---

/**
 * Clear all app localStorage data and reload
 * Used for development/testing purposes
 */
export function clearAllData(): void {
  // Clear all localStorage data
  localStorage.removeItem(KEYS.projects)
  localStorage.removeItem(KEYS.folders)
  localStorage.removeItem(KEYS.items)
  localStorage.removeItem(KEYS.sessions)
  localStorage.removeItem(KEYS.chats)
  localStorage.removeItem(KEYS.statusTopics)
  localStorage.removeItem(KEYS.systemRoles)
  localStorage.removeItem(KEYS.toolUseSettings)
  localStorage.removeItem(KEYS.systemPromptModules)
  localStorage.removeItem(KEYS.summaryTriggerMode)
  localStorage.removeItem(KEYS.chatAModel)
  localStorage.removeItem(KEYS.chatBModel)
  
  // Reload page to start fresh
  window.location.reload()
}

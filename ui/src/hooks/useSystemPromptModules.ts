import { useState, useCallback, useEffect } from 'react'
import type { SystemPromptModule, SystemPromptModuleId } from '../types'
import {
  getSystemPromptModules,
  updateSystemPromptModule,
  resetSystemPromptModule
} from '../services/settingsService'

/**
 * Hook for managing system prompt modules via API
 * 
 * Features:
 * - Loads modules from backend on mount
 * - 3 modules: Allgemeine Regeln, Tool-Nutzung, Rolle
 * - Accordion behavior (one expanded at a time, or none)
 * - Editable content with Reset functionality
 * - All changes synced to backend
 */
export function useSystemPromptModules() {
  const [modules, setModules] = useState<SystemPromptModule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingModuleId, setEditingModuleId] = useState<SystemPromptModuleId | null>(null)
  const [editBuffer, setEditBuffer] = useState('')

  // Load modules from API on mount
  useEffect(() => {
    let mounted = true
    
    getSystemPromptModules()
      .then(data => {
        if (mounted) {
          setModules(data)
          setIsLoading(false)
        }
      })
      .catch(err => {
        if (mounted) {
          console.error('Failed to load system prompt modules:', err)
          setError(err.message)
          setIsLoading(false)
        }
      })
    
    return () => { mounted = false }
  }, [])

  // Toggle module expansion (accordion behavior)
  const toggleModule = useCallback((moduleId: SystemPromptModuleId) => {
    setModules(prev => prev.map(m => ({
      ...m,
      isExpanded: m.id === moduleId ? !m.isExpanded : false
    })))
  }, [])

  // Start editing a module
  const startEditing = useCallback((moduleId: SystemPromptModuleId) => {
    const module = modules.find(m => m.id === moduleId)
    if (module) {
      setEditingModuleId(moduleId)
      setEditBuffer(module.content)
    }
  }, [modules])

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingModuleId(null)
    setEditBuffer('')
  }, [])

  // Save edited content to API
  const saveEditing = useCallback(async () => {
    if (!editingModuleId) return
    
    try {
      await updateSystemPromptModule(editingModuleId, editBuffer)
      
      // Reload modules from API to get fresh is_default status
      const freshModules = await getSystemPromptModules()
      
      // Preserve current isExpanded state (don't reset to defaults)
      setModules(prev => freshModules.map(freshModule => {
        const currentModule = prev.find(m => m.id === freshModule.id)
        return {
          ...freshModule,
          isExpanded: currentModule ? currentModule.isExpanded : freshModule.isExpanded
        }
      }))
      
      setEditingModuleId(null)
      setEditBuffer('')
      setError(null)
    } catch (err: any) {
      console.error('Failed to save system prompt module:', err)
      setError(err.message)
    }
  }, [editingModuleId, editBuffer])

  // Reset module to default content
  const resetModule = useCallback(async (moduleId: SystemPromptModuleId) => {
    try {
      await resetSystemPromptModule(moduleId)
      
      // Reload modules from API to get fresh defaults
      const freshModules = await getSystemPromptModules()
      
      // Preserve current isExpanded state (don't reset to defaults)
      setModules(prev => freshModules.map(freshModule => {
        const currentModule = prev.find(m => m.id === freshModule.id)
        return {
          ...freshModule,
          isExpanded: currentModule ? currentModule.isExpanded : freshModule.isExpanded
        }
      }))
      
      // If currently editing this module, update buffer too
      if (editingModuleId === moduleId) {
        const freshModule = freshModules.find(m => m.id === moduleId)
        if (freshModule) {
          setEditBuffer(freshModule.content)
        }
      }
      
      setError(null)
    } catch (err: any) {
      console.error('Failed to reset system prompt module:', err)
      setError(err.message)
    }
  }, [editingModuleId])

  // Check if module content differs from default
  // Use isDefault flag from backend if available, otherwise compare with defaultContent
  const isModuleModified = useCallback((moduleId: SystemPromptModuleId): boolean => {
    const module = modules.find(m => m.id === moduleId)
    if (!module) return false
    
    // If isDefault flag is available, use it (most reliable)
    if ('isDefault' in module && typeof module.isDefault === 'boolean') {
      return !module.isDefault
    }
    
    // Fallback: compare content with defaultContent (for cases where isDefault not set)
    // This handles the case where user edits but backend hasn't updated isDefault yet
    return module.content !== module.defaultContent
  }, [modules])

  // Get combined system prompt (all modules concatenated)
  const getCombinedPrompt = useCallback((): string => {
    return modules
      .map(m => m.content)
      .filter(Boolean)
      .join('\n\n---\n\n')
  }, [modules])

  // Get a specific module
  const getModule = useCallback((moduleId: SystemPromptModuleId): SystemPromptModule | undefined => {
    return modules.find(m => m.id === moduleId)
  }, [modules])

  return {
    // State
    modules,
    isLoading,
    error,
    editingModuleId,
    editBuffer,
    
    // Accordion
    toggleModule,
    
    // Editing
    startEditing,
    cancelEditing,
    saveEditing,
    setEditBuffer,
    
    // Reset
    resetModule,
    isModuleModified,
    
    // Utilities
    getCombinedPrompt,
    getModule
  }
}

export type UseSystemPromptModulesReturn = ReturnType<typeof useSystemPromptModules>

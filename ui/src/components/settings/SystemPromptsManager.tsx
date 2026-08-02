/**
 * System Prompts Manager Component
 * 
 * Allows editing of global system prompts (summary, verify, audit) with reset functionality.
 */

import { useState, useEffect } from 'react'
import { 
  getSystemPrompts, 
  updateSystemPrompt, 
  resetSystemPrompt,
  resetAllSystemPrompts,
  getPromptTypeLabel,
  getPromptTypeDescription,
  type SystemPrompt 
} from '../../services/systemPromptsService'

export function SystemPromptsManager() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // Track which prompt is being saved
  const [resetting, setResetting] = useState<string | null>(null) // Track which prompt is being reset
  const [error, setError] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null)

  // Load prompts on mount
  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getSystemPrompts()
      // Ensure data is always an array
      setPrompts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load system prompts:', err)
      setError(err instanceof Error ? err.message : 'Error loading system prompts')
      // Keep prompts as empty array on error
      setPrompts([])
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (prompt: SystemPrompt) => {
    setEditingPrompt({ ...prompt })
  }

  const handleSave = async () => {
    if (!editingPrompt) return

    try {
      setSaving(editingPrompt.type)
      setError(null)
      
      const updated = await updateSystemPrompt(editingPrompt.type, editingPrompt.content)
      
      // Update prompts list
      setPrompts(prompts.map(p => 
        p.type === updated.type ? updated : p
      ))
      
      setEditingPrompt(null)
    } catch (err) {
      console.error('Failed to save system prompt:', err)
      setError(err instanceof Error ? err.message : 'Error saving')
    } finally {
      setSaving(null)
    }
  }

  const handleReset = async (type: 'summary' | 'verify' | 'audit') => {
    if (!confirm(`Reset system prompt "${getPromptTypeLabel(type)}" to factory default?`)) {
      return
    }

    try {
      setResetting(type)
      setError(null)
      
      const reset = await resetSystemPrompt(type)
      
      // Update prompts list
      setPrompts(prompts.map(p => 
        p.type === reset.type ? reset : p
      ))
      
      // If we're editing this prompt, update the editing state
      if (editingPrompt?.type === type) {
        setEditingPrompt(reset)
      }
    } catch (err) {
      console.error('Failed to reset system prompt:', err)
      setError(err instanceof Error ? err.message : 'Error resetting')
    } finally {
      setResetting(null)
    }
  }

  const handleResetAll = async () => {
    if (!confirm('Reset all system prompts to factory defaults?')) {
      return
    }

    try {
      setResetting('all')
      setError(null)
      
      const reset = await resetAllSystemPrompts()
      setPrompts(reset)
      
      // Clear editing state
      setEditingPrompt(null)
    } catch (err) {
      console.error('Failed to reset all system prompts:', err)
      setError(err instanceof Error ? err.message : 'Error resetting')
    } finally {
      setResetting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading system prompts...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-200">System prompts</h3>
          <p className="text-sm text-slate-400 mt-1">
            Global prompts for Summary, Verify, and Audit
          </p>
        </div>
        
        <button
          onClick={handleResetAll}
          disabled={resetting === 'all'}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resetting === 'all' ? 'Resetting...' : 'Reset all'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Prompts List */}
      <div className="space-y-4">
        {prompts.length === 0 && !loading && !error && (
          <div className="text-center py-8 text-slate-400">
            No system prompts found. Please restart the backend.
          </div>
        )}
        
        {prompts.map((prompt) => (
          <div 
            key={prompt.type}
            className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h4 className="text-slate-200 font-medium">
                  {getPromptTypeLabel(prompt.type)}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {getPromptTypeDescription(prompt.type)}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Default badge */}
                {prompt.is_default && (
                  <span className="px-2 py-1 bg-slate-700/50 text-slate-400 text-xs rounded">
                    Default
                  </span>
                )}
                
                {/* Edit/Save buttons */}
                {editingPrompt?.type === prompt.type ? (
                  <>
                    <button
                      onClick={() => setEditingPrompt(null)}
                      className="px-3 py-1 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving === prompt.type}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving === prompt.type ? 'Speichere...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleReset(prompt.type)}
                      disabled={resetting === prompt.type || prompt.is_default}
                      className="px-3 py-1 text-sm text-slate-400 hover:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={prompt.is_default ? 'Already at factory default' : 'Reset to factory default'}
                    >
                      {resetting === prompt.type ? 'Reset...' : 'Reset'}
                    </button>
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content (editable or read-only) */}
            <div className="p-4">
              {editingPrompt?.type === prompt.type ? (
                <textarea
                  value={editingPrompt.content}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                  className="w-full h-64 bg-slate-900/50 text-slate-200 rounded-lg px-3 py-2 text-sm font-mono border border-slate-600 focus:border-blue-500 focus:outline-none resize-y"
                  placeholder="System prompt..."
                />
              ) : (
                <div className="bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-700">
                  <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap">
                    {prompt.content}
                  </pre>
                </div>
              )}
              
              {/* Last modified */}
              <div className="mt-2 text-xs text-slate-500">
                Last modified: {new Date(prompt.last_modified).toLocaleString('en-US')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-300 text-sm">
          <strong>Note:</strong> These system prompts apply globally to all sessions and projects. 
          The Chat A system prompt can be customized per session.
        </p>
      </div>
    </div>
  )
}

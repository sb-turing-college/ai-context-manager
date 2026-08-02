/**
 * Cost Dashboard Component
 * 
 * Displays usage statistics and costs for Google Gemini and Anthropic Claude.
 * Two-column layout: Gemini (left) | Claude (right)
 */

import { useState, useEffect } from 'react'
import { API_BASE } from '../../config/api'

interface ModelUsage {
  input_tokens: number
  output_tokens: number
  cost: number
  calls: number
}

interface ProviderStats {
  models: Record<string, ModelUsage>
  total_input_tokens: number
  total_output_tokens: number
  total_cost: number
  total_calls: number
}

interface UsageStats {
  google: ProviderStats
  anthropic: ProviderStats
  total: {
    input_tokens: number
    output_tokens: number
    cost: number
    calls: number
  }
}


// Model display names
const MODEL_NAMES: Record<string, string> = {
  'gemini-3-flash-preview': 'Gemini 3 Flash',
  'gemini-3-pro-preview': 'Gemini 3 Pro',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-opus-4-5': 'Claude Opus 4.5'
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M'
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K'
  }
  return num.toString()
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return '$' + cost.toFixed(4)
  }
  return '$' + cost.toFixed(2)
}

export function CostDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/api/v1/usage/stats`)
      if (!response.ok) {
        throw new Error('Failed to fetch usage stats')
      }
      const data = await response.json()
      setStats(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    try {
      setResetting(true)
      const response = await fetch(`${API_BASE}/api/v1/usage/reset?confirm=true`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to reset stats')
      }
      await fetchStats()
      setShowResetConfirm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="p-4 text-slate-400 text-sm">
        Loading statistics...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-400 text-sm">
        Error: {error}
        <button 
          onClick={fetchStats}
          className="ml-2 text-blue-400 hover:text-blue-300"
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  if (!stats) return null

  const renderProviderColumn = (
    provider: ProviderStats,
    title: string,
    models: string[]
  ) => (
    <div className="flex-1">
      <h4 className="text-sm font-medium text-slate-200 mb-3 pb-2 border-b border-slate-600">
        {title}
      </h4>
      
      {/* Per-Model Breakdown */}
      <div className="space-y-2 mb-4">
        {models.map(modelId => {
          const usage = provider.models[modelId]
          if (!usage || usage.calls === 0) {
            return (
              <div key={modelId} className="text-xs text-slate-500">
                {MODEL_NAMES[modelId] || modelId}: -
              </div>
            )
          }
          return (
            <div key={modelId} className="text-xs">
              <div className="text-slate-300 font-medium">
                {MODEL_NAMES[modelId] || modelId}
              </div>
              <div className="text-slate-400 pl-2">
                {formatNumber(usage.input_tokens)} in / {formatNumber(usage.output_tokens)} out
                <span className="text-slate-300 ml-2">{formatCost(usage.cost)}</span>
                <span className="text-slate-500 ml-2">({usage.calls} Calls)</span>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Provider Total */}
      <div className="pt-2 border-t border-slate-700">
        <div className="text-xs text-slate-400">
          Gesamt: {formatNumber(provider.total_input_tokens)} in / {formatNumber(provider.total_output_tokens)} out
        </div>
        <div className="text-sm font-medium text-slate-200">
          {formatCost(provider.total_cost)}
          <span className="text-slate-500 text-xs ml-2">({provider.total_calls} Calls)</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Two-Column Layout */}
      <div className="flex gap-6">
        {/* Google Gemini (Left) */}
        {renderProviderColumn(
          stats.google,
          'Google Gemini',
          ['gemini-3-flash-preview', 'gemini-3-pro-preview']
        )}
        
        {/* Divider */}
        <div className="w-px bg-slate-600" />
        
        {/* Anthropic Claude (Right) */}
        {renderProviderColumn(
          stats.anthropic,
          'Anthropic Claude',
          ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5']
        )}
      </div>
      
      {/* Grand Total */}
      <div className="pt-3 border-t border-slate-600">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-slate-400">
              Gesamtkosten: {formatNumber(stats.total.input_tokens)} in / {formatNumber(stats.total.output_tokens)} out
            </div>
            <div className="text-lg font-medium text-slate-100">
              {formatCost(stats.total.cost)}
              <span className="text-slate-500 text-sm ml-2">({stats.total.calls} Calls)</span>
            </div>
          </div>
          
          {/* Reset Button */}
          {showResetConfirm ? (
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
              >
                {resetting ? 'Resetting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs font-medium transition-colors"
            >
              Reset stats
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

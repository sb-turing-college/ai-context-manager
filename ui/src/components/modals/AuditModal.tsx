import { useState } from 'react'
import type { LibraryItem } from '../../types'

interface AuditModalProps {
  isOpen: boolean
  onClose: () => void
  artifactTitle: string
  libraryItems: LibraryItem[]
  onStartAudit: (persona: string, model: string, selectedItems: string[]) => void
}

const PERSONAS = [
  {
    id: 'devil',
    name: "👹 Devil's advocate",
    description: 'Aggressively looks for weaknesses and counterarguments',
    systemPrompt: 'You are an aggressive opponent. Find every weakness, every logic error, every inaccuracy.'
  },
  {
    id: 'judge',
    name: '⚖️ Neutral judge',
    description: 'Factually reviews facts and legal coherence',
    systemPrompt: 'You are a neutral judge. Objectively review the facts and legal argumentation.'
  },
  {
    id: 'skeptic',
    name: '🔍 Critical skeptic',
    description: 'Reviews formalities, logic, and internal consistency',
    systemPrompt: 'You are a pedantic reviewer. Look for formal errors, logic gaps, and inconsistencies.'
  }
]

const MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o (OpenAI)' },
  { id: 'sonnet-4.5', name: 'Sonnet 4.5' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus (Anthropic)' },
  { id: 'gemini-pro', name: 'Gemini Pro (Google)' }
]

export function AuditModal({
  isOpen,
  onClose,
  artifactTitle,
  libraryItems,
  onStartAudit
}: AuditModalProps) {
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0].id)
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  if (!isOpen) return null

  const handleToggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleStart = () => {
    onStartAudit(selectedPersona, selectedModel, Array.from(selectedItems))
    onClose()
  }

  const currentPersona = PERSONAS.find(p => p.id === selectedPersona)

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-800 rounded-lg border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">⚖️ Start audit</h2>
            <p className="text-xs text-slate-400 mt-1">Clean room review for: "{artifactTitle}"</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
          {/* Persona Selection */}
          <div>
            <h3 className="text-sm font-medium text-slate-200 mb-3">1. Choose the reviewer personality</h3>
            <div className="space-y-2">
              {PERSONAS.map(persona => (
                <button
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedPersona === persona.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                  }`}
                >
                  <div className="font-medium text-slate-100 mb-1">{persona.name}</div>
                  <div className="text-xs text-slate-400">{persona.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <h3 className="text-sm font-medium text-slate-200 mb-3">2. Choose the AI model</h3>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {MODELS.map(model => (
                <option key={model.id} value={model.id} className="bg-slate-800 text-slate-100">
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-2">
              💡 Tip: Use a different model than for the draft for an independent view
            </p>
          </div>

          {/* Context Selection */}
          <div>
            <h3 className="text-sm font-medium text-slate-200 mb-3">3. Choose context (optional)</h3>
            <p className="text-xs text-slate-400 mb-3">
              The draft is sent automatically. Select additional library items:
            </p>
            <div className="space-y-2 max-h-48 overflow-auto border border-slate-600 rounded-lg p-3 bg-slate-800">
              {libraryItems.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No library items available</p>
              ) : (
                libraryItems.map(item => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 p-2 hover:bg-slate-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleToggleItem(item.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{item.title}</div>
                      <div className="text-xs text-slate-400">
                        {item.type === 'pdf' ? '📕' : item.type === 'markdown' ? '📘' : '📄'} {item.type}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
            <h4 className="text-xs font-medium text-slate-300 mb-2">📋 Audit configuration</h4>
            <div className="space-y-1 text-xs text-slate-400">
              <div>Persona: <span className="text-slate-200">{currentPersona?.name}</span></div>
              <div>Model: <span className="text-slate-200">{MODELS.find(m => m.id === selectedModel)?.name}</span></div>
              <div>Context: <span className="text-slate-200">Draft + {selectedItems.size} library items</span></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Start audit
          </button>
        </div>
      </div>
    </div>
  )
}

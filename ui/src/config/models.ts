/**
 * Central Model Configuration
 * 
 * Single source of truth for all available AI models.
 * Both Chat A and Chat B can use any model.
 */

export interface ModelOption {
  id: string
  name: string
  provider: 'google' | 'anthropic'
  /** Price per 1M input tokens in USD */
  inputPrice: number
  /** Price per 1M output tokens in USD */
  outputPrice: number
}

/**
 * All available models - used by both Chat A and Chat B
 */
export const ALL_MODELS: ModelOption[] = [
  // Google Gemini
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'google',
    inputPrice: 0.50,   // $0.50 per 1M input tokens
    outputPrice: 3.00   // $3.00 per 1M output tokens (incl. thinking)
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'google',
    inputPrice: 1.50,
    outputPrice: 7.50
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    provider: 'google',
    inputPrice: 0.30,
    outputPrice: 2.50
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    provider: 'google',
    inputPrice: 2.00,   // $2.00 per 1M input tokens (<200k)
    outputPrice: 12.00  // $12.00 per 1M output tokens (<200k)
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'google',
    inputPrice: 2.00,
    outputPrice: 12.00
  },
  // Anthropic Claude
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    inputPrice: 1.00,   // $1.00 per 1M input tokens
    outputPrice: 5.00   // $5.00 per 1M output tokens
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    inputPrice: 3.00,   // $3.00 per 1M input tokens
    outputPrice: 15.00  // $15.00 per 1M output tokens
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    inputPrice: 3.00,   // $3.00 per 1M input tokens
    outputPrice: 15.00  // $15.00 per 1M output tokens
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'anthropic',
    // Intro pricing through 2026-08-31; then $3 / $15
    inputPrice: 2.00,
    outputPrice: 10.00
  },
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    inputPrice: 15.00,  // $15.00 per 1M input tokens
    outputPrice: 75.00  // $75.00 per 1M output tokens
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    inputPrice: 5.00,   // $5.00 per 1M input tokens
    outputPrice: 25.00  // $25.00 per 1M output tokens
  },
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    provider: 'anthropic',
    inputPrice: 5.00,
    outputPrice: 25.00
  }
]

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: 'google' | 'anthropic'): ModelOption[] {
  return ALL_MODELS.filter(m => m.provider === provider)
}

/**
 * Get model by ID
 */
export function getModelById(id: string): ModelOption | undefined {
  return ALL_MODELS.find(m => m.id === id)
}

/**
 * Get display name for model ID
 */
export function getModelDisplayName(id: string): string {
  return getModelById(id)?.name || id
}

/**
 * Calculate cost for token usage
 */
export function calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = getModelById(modelId)
  if (!model) return 0
  
  const inputCost = (inputTokens / 1_000_000) * model.inputPrice
  const outputCost = (outputTokens / 1_000_000) * model.outputPrice
  return inputCost + outputCost
}

// Legacy exports for backwards compatibility
export const AVAILABLE_MODELS = ALL_MODELS
export const CHAT_A_MODELS = ALL_MODELS
export const CHAT_B_MODELS = ALL_MODELS

// Default models (can be overridden in settings)
export const DEFAULT_MODEL_CHAT_A = 'gemini-3-flash-preview'
export const DEFAULT_MODEL_CHAT_B = 'claude-haiku-4-5'

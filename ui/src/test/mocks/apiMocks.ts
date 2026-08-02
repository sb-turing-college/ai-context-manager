/**
 * API Mock Helpers
 * 
 * CRITICAL: These mocks prevent real API calls to AI providers (costs!)
 * All fetch() calls must be mocked in tests.
 */

import { vi } from 'vitest'

/**
 * Mock a successful API response
 */
export function mockApiSuccess(data: any, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response)
}

/**
 * Mock an API error response
 */
export function mockApiError(message: string, status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ detail: message }),
    text: async () => JSON.stringify({ detail: message }),
  } as Response)
}

/**
 * Mock AI Chat Response (Chat A)
 * CRITICAL: This prevents real calls to Gemini/Claude APIs
 */
export function mockChatResponse(overrides: Partial<{
  content: string
  model: string
  tool_calls: any[]
  draft_data: any
  edit_data_list: any[]
}> = {}) {
  return mockApiSuccess({
    content: overrides.content || 'Test AI response',
    model: overrides.model || 'gemini-2.5-flash',
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
    cache_info: null,
    user_message_id: 'user-msg-123',
    ai_message_id: 'ai-msg-456',
    tool_calls: overrides.tool_calls || null,
    draft_data: overrides.draft_data || null,
    edit_data_list: overrides.edit_data_list || null,
  })
}

/**
 * Mock Audit Response (Chat B)
 * CRITICAL: This prevents real calls to AI providers
 */
export function mockAuditResponse(overrides: Partial<{
  content: string
  model: string
}> = {}) {
  return mockApiSuccess({
    content: overrides.content || 'Test audit feedback',
    model: overrides.model || 'claude-3-5-haiku',
    usage: {
      prompt_tokens: 80,
      completion_tokens: 40,
      total_tokens: 120,
    },
  })
}

/**
 * Mock Verify Response (Chat B)
 * CRITICAL: This prevents real calls to AI providers
 */
export function mockVerifyResponse(overrides: Partial<{
  content: string
  model: string
}> = {}) {
  return mockApiSuccess({
    content: overrides.content || 'Test verification feedback',
    model: overrides.model || 'claude-3-5-haiku',
    usage: {
      prompt_tokens: 90,
      completion_tokens: 45,
      total_tokens: 135,
    },
  })
}

/**
 * Mock Summary Response
 * CRITICAL: This prevents real calls to AI providers
 */
export function mockSummaryResponse(overrides: Partial<{
  content: string
  summary: string
}> = {}) {
  return mockApiSuccess({
    content: overrides.content || overrides.summary || 'Test session summary',
    model: 'gemini-3-flash-preview',
    usage: {
      prompt_tokens: 200,
      completion_tokens: 100,
      total_tokens: 300,
    },
    cache_info: null,
    user_message_id: 'user-msg-123',
    ai_message_id: 'ai-msg-456',
  })
}

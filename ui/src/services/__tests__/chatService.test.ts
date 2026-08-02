/**
 * Chat Service Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  sendChatMessage,
  sendChatBMessage,
  getAuditMessages,
  clearAuditMessages,
  generateSummary,
  type ChatRequest,
  type ChatBSendRequest,
} from '../chatService'
import { mockChatResponse, mockAuditResponse, mockVerifyResponse, mockSummaryResponse, mockApiError } from '../../test/mocks/apiMocks'
import { mockChatRequest } from '../../test/fixtures/chatFixtures'

// Mock environment variables
vi.mock('../../config/models', () => ({
  DEFAULT_MODEL_CHAT_A: 'gemini-2.5-flash',
}))

// NOTE: API_BASE (ui/src/config/api.ts) is evaluated once at module load time
// and defaults to http://127.0.0.1:8000 (deliberately IPv4, not "localhost",
// to avoid IPv4/IPv6 resolution mismatches against the backend's bind address).
// vi.stubEnv() here cannot retroactively change that already-evaluated constant,
// so assertions below target the real default instead of a stubbed override.
const EXPECTED_API_BASE = 'http://127.0.0.1:8000'

describe('chatService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendChatMessage', () => {
    it('should send chat message and return AI response', async () => {
      const mockResponse = mockChatResponse({
        content: 'Hello, how can I help you?',
        model: 'gemini-2.5-flash',
      })
      global.fetch = mockResponse

      const request: ChatRequest = {
        message: 'Hello',
        context: {
          system_prompt: 'You are a helpful assistant',
          documents: [],
          status_topics: [],
        },
        model: 'gemini-2.5-flash',
        sessionId: 'session-123',
      }

      const result = await sendChatMessage(request)

      expect(result.content).toBe('Hello, how can I help you?')
      expect(result.model).toBe('gemini-2.5-flash')
      expect(result.usage).toBeDefined()
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        `${EXPECTED_API_BASE}/api/v1/chat/send`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should handle tool calls in response', async () => {
      const mockResponse = mockChatResponse({
        content: 'I will create a status topic.',
        tool_calls: [
          {
            tool_name: 'create_status',
            arguments: {
              project_id: 'proj-123',
              title: 'Test Status',
              content: 'Test content',
            },
            result: {
              success: true,
              topic_id: 'status-1',
            },
          },
        ],
      })
      global.fetch = mockResponse

      const result = await sendChatMessage(mockChatRequest)

      expect(result.tool_calls).toBeDefined()
      expect(result.tool_calls?.length).toBe(1)
      expect(result.tool_calls?.[0].tool_name).toBe('create_status')
      // CRITICAL: Verify no real AI API call was made
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle draft creation in response', async () => {
      const mockResponse = mockChatResponse({
        content: 'I have created a draft for you.',
        draft_data: {
          title: 'Test Draft',
          content: 'Test draft content',
          reason: 'Test reason',
        },
      })
      global.fetch = mockResponse

      const result = await sendChatMessage(mockChatRequest)

      expect(result.draft_data).toBeDefined()
      expect(result.draft_data?.title).toBe('Test Draft')
      expect(result.draft_data?.content).toBe('Test draft content')
      // CRITICAL: Verify no real AI API call was made
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should include context in request body', async () => {
      const mockResponse = mockChatResponse()
      global.fetch = mockResponse

      const request: ChatRequest = {
        message: 'Test message',
        context: {
          system_prompt: 'Test prompt',
          documents: [{ id: 'doc-1', title: 'Doc 1', content: 'Content 1' }],
          status_topics: [{ id: 'status-1', title: 'Status 1', content: 'Status content' }],
        },
        model: 'gemini-2.5-flash',
        sessionId: 'session-123',
        includeSummaries: ['session-456'],
      }

      await sendChatMessage(request)

      const callArgs = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody.message).toBe('Test message')
      expect(requestBody.model).toBe('gemini-2.5-flash')
      expect(requestBody.session_id).toBe('session-123')
      expect(requestBody.context).toBeDefined()
      expect(requestBody.context.system_prompt).toBe('Test prompt')
      expect(requestBody.include_summaries).toEqual(['session-456'])
      expect(requestBody.use_tools).toBe(true)
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Internal server error', 500)
      global.fetch = mockResponse

      await expect(sendChatMessage(mockChatRequest)).rejects.toThrow('Internal server error')
      // CRITICAL: Verify no real AI API call was made
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // Note: USE_API is evaluated at module load time, so we can't easily test this
    // without dynamic imports. Skipping for now as it's a configuration issue.
    it.skip('should throw error when USE_API is false', async () => {
      // This test would require dynamic imports to work properly
      // USE_API is evaluated at module load, not at runtime
    })
  })

  describe('sendChatBMessage', () => {
    const baseRequest: ChatBSendRequest = {
      sessionId: 'session-123',
      message: 'Review this draft',
      model: 'claude-3-5-haiku',
      mode: 'audit',
      documents: [],
      statusTopics: [],
      chatBHistory: [],
    }

    it('should send an audit-mode message and return a flat ChatResponse', async () => {
      const mockResponse = mockAuditResponse({
        content: 'This draft needs improvement.',
        model: 'claude-3-5-haiku',
      })
      global.fetch = mockResponse

      const result = await sendChatBMessage(baseRequest)

      expect(result.content).toBe('This draft needs improvement.')
      expect(result.model).toBe('claude-3-5-haiku')
      // CRITICAL: Verify no real AI API call was made
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        `${EXPECTED_API_BASE}/api/v1/audit/send`,
        expect.objectContaining({ method: 'POST' })
      )

      const callArgs = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      expect(requestBody.mode).toBe('audit')
      expect(requestBody.session_id).toBe('session-123')
    })

    it('should send a verify-mode message with answerToVerify', async () => {
      const mockResponse = mockVerifyResponse({
        content: 'The answer is correct.',
        model: 'claude-3-5-haiku',
      })
      global.fetch = mockResponse

      const result = await sendChatBMessage({
        ...baseRequest,
        mode: 'verify',
        answerToVerify: 'Some answer',
      })

      expect(result.content).toBe('The answer is correct.')
      expect(result.model).toBe('claude-3-5-haiku')

      const callArgs = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      expect(requestBody.mode).toBe('verify')
      expect(requestBody.answer_to_verify).toBe('Some answer')
    })

    it('should handle Chat B API errors', async () => {
      const mockResponse = mockApiError('Audit failed', 500)
      global.fetch = mockResponse

      await expect(sendChatBMessage(baseRequest)).rejects.toThrow('Audit failed')
      // CRITICAL: Verify no real AI API call was made
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('generateSummary', () => {
    it('should generate session summary', async () => {
      const mockResponse = mockSummaryResponse({
        summary: 'Test session summary',
      })
      global.fetch = mockResponse

      const result = await generateSummary('session-123', 'gemini-3-flash-preview')

      expect(result.content).toBeDefined()
      // CRITICAL: Verify no real AI API call was made
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledWith(
        `${EXPECTED_API_BASE}/api/v1/chat/summary`,
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should handle summary API errors', async () => {
      const mockResponse = mockApiError('Summary failed', 500)
      global.fetch = mockResponse

      await expect(generateSummary('session-123')).rejects.toThrow('Summary failed')
      // CRITICAL: Verify no real AI API call was made
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getAuditMessages', () => {
    it('should fetch audit messages', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'User message',
          timestamp: '2024-01-01T10:00:00Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'AI response',
          timestamp: '2024-01-01T10:01:00Z',
        },
      ]

      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMessages,
      } as Response)
      global.fetch = mockResponse

      const result = await getAuditMessages('session-123')

      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('user')
      expect(result[1].role).toBe('ai')
      expect(global.fetch).toHaveBeenCalledWith(
        `${EXPECTED_API_BASE}/api/v1/sessions/session-123/audit-messages`
      )
    })

    it('should handle draft messages with version prefix', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: '[DRAFT V1]\n\nDraft content here',
          timestamp: '2024-01-01T10:00:00Z',
        },
      ]

      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMessages,
      } as Response)
      global.fetch = mockResponse

      const result = await getAuditMessages('session-123')

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe('draft')
      expect(result[0].content).toBe('Draft content here')
      expect(result[0].draftData?.draftVersion).toBe(1)
    })

    it('should return empty array on error', async () => {
      const mockResponse = mockApiError('Failed to load', 500)
      global.fetch = mockResponse

      const result = await getAuditMessages('session-123')

      expect(result).toEqual([])
    })
  })

  describe('clearAuditMessages', () => {
    it('should clear audit messages', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await clearAuditMessages('session-123')

      expect(global.fetch).toHaveBeenCalledWith(
        `${EXPECTED_API_BASE}/api/v1/sessions/session-123/audit-messages`,
        { method: 'DELETE' }
      )
    })

    it('should throw error on failure', async () => {
      const mockResponse = mockApiError('Failed to clear', 500)
      global.fetch = mockResponse

      await expect(clearAuditMessages('session-123')).rejects.toThrow('Failed to clear')
    })
  })
})

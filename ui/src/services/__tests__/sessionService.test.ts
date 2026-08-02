/**
 * Session Service Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSessionsByProject,
  createSession,
  updateSession,
  deleteSession,
  getChatMessages,
  addChatMessage,
  getSessionSummary,
  saveSessionSummary,
  createMessage,
} from '../sessionService'
import { mockApiSuccess, mockApiError } from '../../test/mocks/apiMocks'

// NOTE: API_BASE (ui/src/config/api.ts) is evaluated once at module load
// time and defaults to http://127.0.0.1:8000 (deliberately IPv4, not
// "localhost", to avoid IPv4/IPv6 resolution mismatches against the
// backend's bind address). Assertions below target that real default.
describe('sessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSessionsByProject', () => {
    it('should fetch sessions for a project', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          project_id: 'proj-123',
          title: 'Session 1',
          message_count: 5,
          active: false,
          summary_status: 'none',
        },
        {
          id: 'session-2',
          project_id: 'proj-123',
          title: 'Session 2',
          message_count: 10,
          active: true,
          summary_status: 'green',
        },
      ]

      const mockResponse = mockApiSuccess(mockSessions)
      global.fetch = mockResponse

      const result = await getSessionsByProject('proj-123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('session-1')
      expect(result[0].title).toBe('Session 1')
      expect(result[0].messageCount).toBe(5)
      expect(result[1].summaryStatus).toBe('green')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/projects/proj-123/sessions'
      )
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      await expect(getSessionsByProject('proj-123')).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createSession', () => {
    it('should create a new session', async () => {
      const mockSession = {
        id: 'session-new',
        project_id: 'proj-123',
        title: 'New Session',
        message_count: 0,
        active: false,
        summary_status: 'none',
      }

      const mockResponse = mockApiSuccess(mockSession)
      global.fetch = mockResponse

      const result = await createSession('proj-123', 'New Session')

      expect(result.id).toBe('session-new')
      expect(result.title).toBe('New Session')
      expect(result.projectId).toBe('proj-123')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: 'proj-123',
            title: 'New Session',
          }),
        })
      )
    })

    it('should handle creation errors', async () => {
      const mockResponse = mockApiError('Creation failed', 400)
      global.fetch = mockResponse

      await expect(createSession('proj-123', 'New Session')).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateSession', () => {
    it('should update a session', async () => {
      const mockUpdatedSession = {
        id: 'session-1',
        project_id: 'proj-123',
        title: 'Updated Session',
        message_count: 5,
        active: false,
        summary_status: 'none',
      }

      const mockResponse = mockApiSuccess(mockUpdatedSession)
      global.fetch = mockResponse

      const result = await updateSession('session-1', { title: 'Updated Session' })

      expect(result?.title).toBe('Updated Session')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated Session' }),
        })
      )
    })

    it('should return null for 404', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)
      global.fetch = mockResponse

      const result = await updateSession('session-999', { title: 'Updated' })

      expect(result).toBeNull()
    })

    it('should handle update errors', async () => {
      const mockResponse = mockApiError('Update failed', 500)
      global.fetch = mockResponse

      await expect(updateSession('session-1', { title: 'Updated' })).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      } as Response)
      global.fetch = mockResponse

      const result = await deleteSession('session-1')

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-1',
        { method: 'DELETE' }
      )
    })

    it('should return false for 404', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)
      global.fetch = mockResponse

      const result = await deleteSession('session-999')

      expect(result).toBe(false)
    })

    it('should handle delete errors', async () => {
      const mockResponse = mockApiError('Delete failed', 500)
      global.fetch = mockResponse

      await expect(deleteSession('session-1')).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getChatMessages', () => {
    it('should fetch chat messages for a session', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: '2024-01-01T10:00:00Z',
          model: null,
          tool_call_data: null,
          feedback_data: null,
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: '2024-01-01T10:01:00Z',
          model: 'gemini-2.5-flash',
          tool_call_data: null,
          feedback_data: null,
        },
      ]

      const mockResponse = mockApiSuccess(mockMessages)
      global.fetch = mockResponse

      const result = await getChatMessages('session-1')

      expect(result).toHaveLength(2)
      expect(result[0].role).toBe('user')
      expect(result[0].content).toBe('Hello')
      // Backend returns 'assistant'; service normalizes it to 'ai' (ChatMessage.role
      // never includes 'assistant' - see convertApiMessage in sessionService.ts)
      expect(result[1].role).toBe('ai')
      expect(result[1].model).toBe('gemini-2.5-flash')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-1/messages'
      )
    })

    it('should handle messages with tool calls', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'I will create a status topic.',
          timestamp: '2024-01-01T10:00:00Z',
          model: 'gemini-2.5-flash',
          tool_call_data: {
            tool_calls: [
              {
                tool_name: 'create_status',
                arguments: {
                  project_id: 'proj-123',
                  title: 'Budget',
                  content: '5000 EUR',
                },
                result: {
                  success: true,
                  topic_id: 'status-1',
                },
              },
            ],
          },
          feedback_data: null,
        },
      ]

      const mockResponse = mockApiSuccess(mockMessages)
      global.fetch = mockResponse

      const result = await getChatMessages('session-1')

      expect(result[0].toolCallData).toBeDefined()
      expect(result[0].toolCallData?.toolCall.tool).toBe('create_status')
      expect(result[0].toolCallData?.success).toBe(true)
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      await expect(getChatMessages('session-1')).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('addChatMessage', () => {
    it('should add a chat message', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      const message = {
        id: 'msg-new',
        role: 'user' as const,
        content: 'New message',
        timestamp: '2024-01-01T12:00:00Z',
      }

      await addChatMessage('session-1', message)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should handle add message errors', async () => {
      const mockResponse = mockApiError('Add failed', 500)
      global.fetch = mockResponse

      await expect(
        addChatMessage('session-1', {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp: '2024-01-01T12:00:00Z',
        })
      ).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getSessionSummary', () => {
    it('should fetch session summary', async () => {
      const mockSummary = {
        content: 'This is a session summary.',
      }

      const mockResponse = mockApiSuccess(mockSummary)
      global.fetch = mockResponse

      const result = await getSessionSummary('session-1')

      expect(result).toBe('This is a session summary.')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-1/summary'
      )
    })

    it('should return null for 404', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)
      global.fetch = mockResponse

      const result = await getSessionSummary('session-1')

      expect(result).toBeNull()
    })

    it('should handle API errors gracefully', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      const result = await getSessionSummary('session-1')

      // Should return null on error (not throw)
      expect(result).toBeNull()
    })
  })

  describe('saveSessionSummary', () => {
    it('should save session summary', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await saveSessionSummary('session-1', 'Summary content', 100, 5)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-1/summary',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'Summary content',
            token_count: 100,
            message_count_at_creation: 5,
          }),
        })
      )
    })

    it('should handle save errors', async () => {
      const mockResponse = mockApiError('Save failed', 500)
      global.fetch = mockResponse

      await expect(saveSessionSummary('session-1', 'Summary')).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createMessage', () => {
    it('should create a message via API', async () => {
      const mockMessage = {
        id: 'msg-new',
        role: 'user',
        content: 'New message',
        timestamp: '2024-01-01T12:00:00Z',
        model: null,
        feedback_data: null,
      }

      const mockResponse = mockApiSuccess(mockMessage)
      global.fetch = mockResponse

      const result = await createMessage('session-1', {
        role: 'user',
        content: 'New message',
      })

      expect(result.id).toBe('msg-new')
      expect(result.content).toBe('New message')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should handle creation errors', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Creation failed' }),
      } as Response)
      global.fetch = mockResponse

      await expect(
        createMessage('session-1', {
          role: 'user',
          content: 'Test',
        })
      ).rejects.toThrow('Creation failed')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

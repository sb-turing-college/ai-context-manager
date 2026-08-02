/**
 * useChatBLogic Hook Tests
 *
 * Chat B is fully decoupled from Chat A: no session-summary auto-loading,
 * no tools, ephemeral (non-persisted) history. All API access goes through
 * sendChatBMessage(); startVerifyWithAnswer/startAuditWithDraft/addDraftForAudit
 * are purely local state transitions (no API calls).
 *
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatBLogic } from '../useChatBLogic'
import * as chatService from '../../services/chatService'
import { STORAGE_KEYS } from '../../services/settingsService'
import type { LibraryItem, StatusTopicItem } from '../../types'

// Mock chatService - only sendChatBMessage is used by this hook
vi.mock('../../services/chatService', () => ({
  sendChatBMessage: vi.fn(),
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

const mockDocs: LibraryItem[] = [
  { id: 'doc-1', title: 'Doc 1', content: 'Doc content', timestamp: '10:00', version: 1, type: 'text', projectId: 'proj-1', folderId: null },
]

const mockStatusTopics: StatusTopicItem[] = [
  { id: 'status-1', title: 'Status 1', content: 'Status content', projectId: 'proj-1', order: 0 },
]

describe('useChatBLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
  })

  describe('initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useChatBLogic())

      expect(result.current.messages).toEqual([])
      expect(result.current.input).toBe('')
      expect(result.current.isTyping).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.sessionId).toBeNull()
      expect(result.current.pendingContext).toBeNull()
    })

    it('should load model from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('gemini-2.0-flash')

      const { result } = renderHook(() => useChatBLogic())

      expect(result.current.model).toBe('gemini-2.0-flash')
      expect(localStorageMock.getItem).toHaveBeenCalledWith(STORAGE_KEYS.chatBModel)
    })
  })

  describe('message management', () => {
    it('should add message', () => {
      const { result } = renderHook(() => useChatBLogic())

      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Test message',
        timestamp: '10:00',
      }

      act(() => {
        result.current.addMessage(message)
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0]).toEqual(message)
    })

    it('should clear messages, input, pendingContext and selection', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.addMessage({
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp: '10:00',
        })
        result.current.setInput('draft input')
        result.current.handleToggleMessage('msg-1')
      })

      act(() => {
        result.current.clearMessages()
      })

      expect(result.current.messages).toHaveLength(0)
      expect(result.current.input).toBe('')
      expect(result.current.pendingContext).toBeNull()
      expect(result.current.selectionCount).toBe(0)
    })
  })

  describe('startVerifyWithAnswer', () => {
    it('should set up verify context locally without any API call', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.startVerifyWithAnswer(
          'Last AI answer',
          'gemini-2.0-flash',
          ['session-456'],
          mockDocs,
          mockStatusTopics,
          'workshop draft'
        )
      })

      expect(result.current.model).toBe('gemini-2.0-flash')
      expect(result.current.chatBDocs).toEqual(mockDocs)
      expect(result.current.chatBStatusTopics).toEqual(mockStatusTopics)
      expect(result.current.pendingContext).toEqual({
        mode: 'verify',
        answerToVerify: 'Last AI answer',
        workshopContent: 'workshop draft',
        summaries: ['session-456'],
      })
      // No draft/message is added and no API call happens - user asks their own question
      expect(result.current.messages).toHaveLength(0)
      expect(chatService.sendChatBMessage).not.toHaveBeenCalled()
    })
  })

  describe('startAuditWithDraft', () => {
    it('should set up audit context and add a visible draft block, without any API call', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.startAuditWithDraft(
          'Draft content',
          'gemini-2.0-flash',
          ['session-456'],
          1,
          mockDocs,
          mockStatusTopics,
          'workshop draft'
        )
      })

      expect(result.current.model).toBe('gemini-2.0-flash')
      expect(result.current.chatBDocs).toEqual(mockDocs)
      expect(result.current.chatBStatusTopics).toEqual(mockStatusTopics)
      expect(result.current.pendingContext).toEqual({
        mode: 'audit',
        workshopContent: 'Draft content',
        summaries: ['session-456'],
      })
      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].role).toBe('draft')
      expect(result.current.messages[0].content).toBe('Draft content')
      expect(result.current.messages[0].draftData).toEqual({
        draftVersion: 1,
        isExpanded: false,
      })
      expect(chatService.sendChatBMessage).not.toHaveBeenCalled()
    })
  })

  describe('addDraftForAudit', () => {
    it('should update pendingContext workshopContent and append a new draft block', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.startAuditWithDraft('Draft v1', 'gemini-2.0-flash', [], 1, mockDocs, mockStatusTopics)
      })

      act(() => {
        result.current.addDraftForAudit('Draft v2', 2, mockDocs, mockStatusTopics)
      })

      expect(result.current.pendingContext?.workshopContent).toBe('Draft v2')
      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[1].content).toBe('Draft v2')
      expect(result.current.messages[1].draftData?.draftVersion).toBe(2)
    })
  })

  describe('handleSend', () => {
    it('should send message via sendChatBMessage and append the AI response', async () => {
      vi.mocked(chatService.sendChatBMessage).mockResolvedValue({
        content: 'Reviewer response',
        model: 'gemini-2.0-flash',
        usage: {},
      })

      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.setSessionId('session-123')
        result.current.startVerifyWithAnswer('Last answer', 'gemini-2.0-flash', [], mockDocs, mockStatusTopics)
        result.current.setInput('User question')
      })

      await act(async () => {
        await result.current.handleSend()
      })

      expect(chatService.sendChatBMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          message: 'User question',
          model: 'gemini-2.0-flash',
          mode: 'verify',
          answerToVerify: 'Last answer',
        })
      )
      // User message added immediately, AI response appended after resolution
      expect(result.current.messages.map((m) => m.role)).toEqual(['user', 'ai'])
      expect(result.current.messages[1].content).toBe('Reviewer response')
      expect(result.current.input).toBe('')
      expect(result.current.isTyping).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should not send if input is empty', async () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.setSessionId('session-123')
        result.current.startVerifyWithAnswer('Last answer', 'gemini-2.0-flash', [], mockDocs, mockStatusTopics)
      })

      await act(async () => {
        await result.current.handleSend()
      })

      expect(chatService.sendChatBMessage).not.toHaveBeenCalled()
    })

    it('should not send if no sessionId', async () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.startVerifyWithAnswer('Last answer', 'gemini-2.0-flash', [], mockDocs, mockStatusTopics)
        result.current.setInput('User question')
      })

      await act(async () => {
        await result.current.handleSend()
      })

      expect(chatService.sendChatBMessage).not.toHaveBeenCalled()
    })

    it('should not send if there is no pending context', async () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.setSessionId('session-123')
        result.current.setInput('User question')
      })

      await act(async () => {
        await result.current.handleSend()
      })

      expect(chatService.sendChatBMessage).not.toHaveBeenCalled()
    })

    it('should set an error message and stop typing on API failure', async () => {
      vi.mocked(chatService.sendChatBMessage).mockRejectedValue(new Error('API error'))

      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.setSessionId('session-123')
        result.current.startVerifyWithAnswer('Last answer', 'gemini-2.0-flash', [], mockDocs, mockStatusTopics)
        result.current.setInput('User question')
      })

      await act(async () => {
        await result.current.handleSend()
      })

      expect(result.current.error).toBe('API error')
      expect(result.current.isTyping).toBe(false)
    })
  })

  describe('selection handlers', () => {
    it('should toggle message selection', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.handleToggleMessage('msg-1')
      })

      expect(result.current.isMessageSelected('msg-1')).toBe(true)

      act(() => {
        result.current.handleToggleMessage('msg-1')
      })

      expect(result.current.isMessageSelected('msg-1')).toBe(false)
    })

    it('should select from here', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.setMessages([
          { id: 'msg-1', role: 'user', content: 'Msg 1', timestamp: '10:00' },
          { id: 'msg-2', role: 'user', content: 'Msg 2', timestamp: '10:01' },
          { id: 'msg-3', role: 'user', content: 'Msg 3', timestamp: '10:02' },
        ])
      })

      act(() => {
        result.current.handleSelectFromHere(1)
      })

      // handleSelectFromHere toggles based on first message selection state
      // If first message is not selected, it selects all from index
      expect(result.current.isMessageSelected('msg-2')).toBe(true)
      expect(result.current.isMessageSelected('msg-3')).toBe(true)
    })

    it('should clear selection', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.handleToggleMessage('msg-1')
      })

      expect(result.current.selectionCount).toBe(1)

      act(() => {
        result.current.clearSelection()
      })

      expect(result.current.selectionCount).toBe(0)
    })

    it('should delete selected messages', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.setMessages([
          { id: 'msg-1', role: 'user', content: 'Msg 1', timestamp: '10:00' },
          { id: 'msg-2', role: 'user', content: 'Msg 2', timestamp: '10:01' },
        ])
        result.current.handleToggleMessage('msg-1')
      })

      act(() => {
        result.current.handleDeleteMessages()
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].id).toBe('msg-2')
    })

    it('should delete single message by ID', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.setMessages([
          { id: 'msg-1', role: 'user', content: 'Msg 1', timestamp: '10:00' },
          { id: 'msg-2', role: 'user', content: 'Msg 2', timestamp: '10:01' },
        ])
      })

      act(() => {
        result.current.handleDeleteMessages('msg-1')
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].id).toBe('msg-2')
    })
  })

  describe('model persistence', () => {
    it('should persist model to localStorage', () => {
      const { result } = renderHook(() => useChatBLogic())

      act(() => {
        result.current.setModel('gemini-2.0-flash')
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.chatBModel,
        'gemini-2.0-flash'
      )
      expect(result.current.model).toBe('gemini-2.0-flash')
    })
  })
})

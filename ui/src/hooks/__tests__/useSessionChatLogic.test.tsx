/**
 * useSessionChatLogic Hook Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionChatLogic } from '../useSessionChatLogic'
import * as chatService from '../../services/chatService'
import type { Session, ChatMessage, SystemPromptModule, LibraryItem, StatusTopicItem } from '../../types'

// Mock chatService
vi.mock('../../services/chatService', () => ({
  sendChatMessageWithProgress: vi.fn(),
}))

// Mock sessionService (deleteSession needed for session deletion)
vi.mock('../../services/sessionService', () => ({
  deleteSession: vi.fn().mockResolvedValue(true),
}))

describe('useSessionChatLogic', () => {
  const mockSetSessions = vi.fn()
  const mockSetOpenTopic = vi.fn()
  const mockSetChatsBySession = vi.fn()
  const mockOnStatusRefresh = vi.fn()
  const mockOnSessionsRefresh = vi.fn()
  const mockOnDraftCreated = vi.fn()
  const mockOnDraftEdited = vi.fn()
  const mockGetWorkshopContent = vi.fn()

  const defaultSessions: Session[] = [
    {
      id: 'session-1',
      title: 'Session 1',
      messageCount: 0,
      active: true,
      projectId: 'proj-1',
    },
  ]

  const defaultChatsBySession: Record<string, ChatMessage[]> = {
    'session-1': [],
  }

  const defaultProps = {
    sessions: defaultSessions,
    setSessions: mockSetSessions,
    setOpenTopic: mockSetOpenTopic,
    chatsBySession: defaultChatsBySession,
    setChatsBySession: mockSetChatsBySession,
    systemPromptModules: [] as SystemPromptModule[],
    libraryItems: [] as LibraryItem[],
    statusTopics: [] as StatusTopicItem[],
    selectedSummaries: [] as string[],
    onStatusRefresh: mockOnStatusRefresh,
    onSessionsRefresh: mockOnSessionsRefresh,
    onDraftCreated: mockOnDraftCreated,
    onDraftEdited: mockOnDraftEdited,
    getWorkshopContent: mockGetWorkshopContent,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="root"></div>'
  })

  describe('handleNewSession', () => {
    it('should create a new session', () => {
      const { result } = renderHook(() => useSessionChatLogic(defaultProps))

      act(() => {
        result.current.handleNewSession()
      })

      expect(mockSetSessions).toHaveBeenCalled()
      // setSessions is called with a function or array
      const callArg = mockSetSessions.mock.calls[0][0]
      if (typeof callArg === 'function') {
        const newSessions = callArg(defaultSessions)
        expect(newSessions.length).toBeGreaterThanOrEqual(2)
      } else {
        expect(callArg.length).toBeGreaterThanOrEqual(2)
      }
      expect(result.current.activeSession).toBeTruthy()
    })
  })

  describe('handleSessionClick', () => {
    it('should activate clicked session', () => {
      const sessions: Session[] = [
        { id: 'session-1', title: 'Session 1', messageCount: 0, active: true, projectId: 'proj-1' },
        { id: 'session-2', title: 'Session 2', messageCount: 0, active: false, projectId: 'proj-1' },
      ]

      const props = {
        ...defaultProps,
        sessions,
      }

      const { result } = renderHook(() => useSessionChatLogic(props))

      act(() => {
        result.current.handleSessionClick('session-2')
      })

      expect(result.current.activeSession).toBe('session-2')
      expect(mockSetSessions).toHaveBeenCalled()
    })
  })

  describe('handleDeleteSingleSession', () => {
    it('should show confirmation on first click', () => {
      const { result } = renderHook(() => useSessionChatLogic(defaultProps))

      act(() => {
        result.current.handleDeleteSingleSession('session-1')
      })

      expect(result.current.sessionDeleteConfirmId).toBe('session-1')
    })

    it('should delete session on confirmation', async () => {
      const sessions: Session[] = [
        { id: 'session-1', title: 'Session 1', messageCount: 0, active: true, projectId: 'proj-1' },
        { id: 'session-2', title: 'Session 2', messageCount: 0, active: false, projectId: 'proj-1' },
      ]

      const props = {
        ...defaultProps,
        sessions,
      }

      const { result } = renderHook(() => useSessionChatLogic(props))

      act(() => {
        result.current.handleDeleteSingleSession('session-1')
      })

      await act(async () => {
        await result.current.handleDeleteSingleSession('session-1') // Confirm (async)
      })

      expect(mockSetSessions).toHaveBeenCalled()
      expect(result.current.sessionDeleteConfirmId).toBeNull()
    })
  })

  describe('handleCopySession', () => {
    it('should copy a session with messages', () => {
      const sessions: Session[] = [
        { id: 'session-1', title: 'Session 1', messageCount: 2, active: true, projectId: 'proj-1' },
      ]

      const chatsBySession: Record<string, ChatMessage[]> = {
        'session-1': [
          { id: 'msg-1', role: 'user', content: 'Message 1', timestamp: '10:00' },
          { id: 'msg-2', role: 'ai', content: 'Response 1', timestamp: '10:01' },
        ],
      }

      const props = {
        ...defaultProps,
        sessions,
        chatsBySession,
      }

      const { result } = renderHook(() => useSessionChatLogic(props))

      act(() => {
        result.current.handleCopySession('session-1')
      })

      expect(mockSetSessions).toHaveBeenCalled()
      expect(mockSetChatsBySession).toHaveBeenCalled()
    })
  })

  describe('message selection', () => {
    it('should toggle message selection', () => {
      const chatsBySession: Record<string, ChatMessage[]> = {
        'session-1': [
          { id: 'msg-1', role: 'user', content: 'Message 1', timestamp: '10:00' },
        ],
      }

      const props = {
        ...defaultProps,
        chatsBySession,
      }

      const { result } = renderHook(() => useSessionChatLogic(props))

      act(() => {
        result.current.handleToggleMessageSelection('session-1', 'msg-1')
      })

      expect(result.current.isMessageSelected('session-1', 'msg-1')).toBe(true)

      act(() => {
        result.current.handleToggleMessageSelection('session-1', 'msg-1')
      })

      expect(result.current.isMessageSelected('session-1', 'msg-1')).toBe(false)
    })

    it('should select from here', () => {
      const chatsBySession: Record<string, ChatMessage[]> = {
        'session-1': [
          { id: 'msg-1', role: 'user', content: 'Message 1', timestamp: '10:00' },
          { id: 'msg-2', role: 'user', content: 'Message 2', timestamp: '10:01' },
          { id: 'msg-3', role: 'user', content: 'Message 3', timestamp: '10:02' },
        ],
      }

      const props = {
        ...defaultProps,
        chatsBySession,
      }

      const { result } = renderHook(() => useSessionChatLogic(props))

      act(() => {
        result.current.handleSelectFromHere('session-1', 1)
      })

      expect(result.current.isMessageSelected('session-1', 'msg-2')).toBe(true)
      expect(result.current.isMessageSelected('session-1', 'msg-3')).toBe(true)
    })
  })

  describe('handleSendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        content: 'AI response',
        user_message_id: 'user-msg-1',
        ai_message_id: 'ai-msg-1',
        model: 'gemini-2.0-flash',
        toolCalls: [],
        usage: {},
      }

      vi.mocked(chatService.sendChatMessageWithProgress).mockResolvedValue(mockResponse)

      const props = {
        ...defaultProps,
        sessions: [{ id: 'session-1', title: 'Session 1', messageCount: 0, active: true, projectId: 'proj-1' }],
      }

      const { result } = renderHook(() => useSessionChatLogic(props))

      act(() => {
        result.current.setActiveSession('session-1')
        result.current.setChatInput('User message')
      })

      await act(async () => {
        await result.current.handleSendMessage()
      })

      expect(chatService.sendChatMessageWithProgress).toHaveBeenCalled()
      // Input is cleared after sending
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })
      expect(result.current.chatSendState.status).toBe('idle')
    })

    it('should not send if input is empty', async () => {
      const { result } = renderHook(() => useSessionChatLogic(defaultProps))

      act(() => {
        result.current.setActiveSession('session-1')
        result.current.setChatInput('')
      })

      await act(async () => {
        await result.current.handleSendMessage()
      })

      expect(chatService.sendChatMessageWithProgress).not.toHaveBeenCalled()
    })

    it('should handle errors', async () => {
      vi.mocked(chatService.sendChatMessageWithProgress).mockRejectedValue(new Error('API error'))

      const props = {
        ...defaultProps,
        sessions: [{ id: 'session-1', title: 'Session 1', messageCount: 0, active: true, projectId: 'proj-1' }],
      }

      const { result } = renderHook(() => useSessionChatLogic(props))

      act(() => {
        result.current.setActiveSession('session-1')
        result.current.setChatInput('User message')
      })

      await act(async () => {
        await result.current.handleSendMessage()
      })

      expect(result.current.chatSendState.status).toBe('error')
    })
  })

  describe('handleUpdateStatus', () => {
    it('should update status and show success', () => {
      const { result } = renderHook(() => useSessionChatLogic(defaultProps))

      act(() => {
        result.current.handleUpdateStatus()
      })

      expect(result.current.isFlyingStatus).toBe(true)
      expect(result.current.showUpdateSuccess).toBe(true)
    })
  })

  describe('handleToggleSessionEditMode', () => {
    it('should toggle edit mode', () => {
      const { result } = renderHook(() => useSessionChatLogic(defaultProps))

      act(() => {
        result.current.handleToggleSessionEditMode()
      })

      expect(result.current.sessionEditMode).toBe(true)

      act(() => {
        result.current.handleToggleSessionEditMode()
      })

      expect(result.current.sessionEditMode).toBe(false)
    })
  })
})

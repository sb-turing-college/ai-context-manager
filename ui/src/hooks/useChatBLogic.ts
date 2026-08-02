import { useState, useCallback } from 'react'
import type { ChatMessage, LibraryItem, StatusTopicItem } from '../types'
import { sendChatBMessage, type ChatBHistoryMessage } from '../services/chatService'
import { DEFAULT_MODEL_CHAT_B } from '../config/models'
import { STORAGE_KEYS } from '../services/settingsService'

interface ChatBPendingContext {
  mode: 'verify' | 'audit'
  answerToVerify?: string   // verify mode: last Chat A answer
  workshopContent?: string  // audit mode: draft/workshop content
  summaries: string[]
}

export function useChatBLogic() {
  // Ephemeral message history (not persisted to DB)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [model, setModel] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.chatBModel)
    return stored || DEFAULT_MODEL_CHAT_B
  })
  const [isTyping, setIsTyping] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Decoupled context (own copy, independent from Chat A)
  const [chatBDocs, setChatBDocs] = useState<LibraryItem[]>([])
  const [chatBStatusTopics, setChatBStatusTopics] = useState<StatusTopicItem[]>([])
  const [pendingContext, setPendingContext] = useState<ChatBPendingContext | null>(null)

  // Selection state for Chat B
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())

  const clearMessages = () => {
    setMessages([])
    setInput('')
    setPendingContext(null)
    setSelectedMessages(new Set())
  }

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }

  // Custom setModel that persists to localStorage
  const handleSetModel = (newModel: string) => {
    setModel(newModel)
    localStorage.setItem(STORAGE_KEYS.chatBModel, newModel)
  }

  // Selection handlers
  const handleToggleMessage = useCallback((messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }, [])

  const handleSelectFromHere = useCallback((index: number) => {
    const firstMsg = messages[index]
    if (!firstMsg) return
    const firstIsSelected = selectedMessages.has(firstMsg.id)
    setSelectedMessages(prev => {
      const newSet = new Set(prev)
      for (let i = index; i < messages.length; i++) {
        const msg = messages[i]
        if (msg) {
          if (firstIsSelected) {
            newSet.delete(msg.id)
          } else {
            newSet.add(msg.id)
          }
        }
      }
      return newSet
    })
  }, [messages, selectedMessages])

  const isMessageSelected = useCallback((messageId: string) => {
    return selectedMessages.has(messageId)
  }, [selectedMessages])

  const clearSelection = useCallback(() => {
    setSelectedMessages(new Set())
  }, [])

  const handleCopyToClipboard = useCallback(() => {
    const selectedMsgs = messages.filter(m => selectedMessages.has(m.id))
    const text = selectedMsgs.map(m => {
      const role = m.role === 'user' ? 'User' : 'Reviewer'
      return `${role}: ${m.content}`
    }).join('\n\n')
    navigator.clipboard.writeText(text)
    clearSelection()
  }, [messages, selectedMessages, clearSelection])

  const handleDeleteMessages = useCallback((messageId?: string) => {
    if (messageId) {
      setMessages(prev => prev.filter(m => m.id !== messageId))
      setSelectedMessages(prev => {
        const newSet = new Set(prev)
        newSet.delete(messageId)
        return newSet
      })
    } else {
      setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)))
      clearSelection()
    }
  }, [selectedMessages, clearSelection])

  /**
   * Build Chat B history for the API request.
   * Only includes real user/AI messages (no draft blocks, verify blocks, etc.)
   */
  const buildChatBHistory = (): ChatBHistoryMessage[] => {
    return messages
      .filter(m => m.role === 'user' || m.role === 'ai')
      .map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content
      }))
  }

  /**
   * Send a message in Chat B with full decoupled context.
   * Every message sends the complete context (docs, status, chat A history from DB).
   */
  const handleSend = async () => {
    if (!input.trim() || isTyping || !sessionId || !pendingContext) return

    const userMessage: ChatMessage = {
      id: `chatb-user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)
    setError(null)

    try {
      const history = buildChatBHistory()

      const response = await sendChatBMessage({
        sessionId,
        message: input.trim(),
        model,
        mode: pendingContext.mode,
        documents: chatBDocs.map(d => ({ id: d.id, title: d.title, content: d.content })),
        statusTopics: chatBStatusTopics.map(t => ({ id: t.id, title: t.title, content: t.content })),
        workshopContent: pendingContext.workshopContent,
        answerToVerify: pendingContext.answerToVerify,
        chatBHistory: history,
        summaries: pendingContext.summaries
      })

      const aiMessage: ChatMessage = {
        id: `chatb-ai-${Date.now()}`,
        role: 'ai',
        content: response.content,
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        model: response.model || model
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      console.error('Failed to send Chat B message:', err)
      setError(err instanceof Error ? err.message : 'Error sending')
    } finally {
      setIsTyping(false)
    }
  }

  /**
   * Prepare Chat B for verify mode (no API call).
   * Opens Chat B with a copy of Chat A's context, ready for user questions.
   */
  const startVerifyWithAnswer = (
    lastAIAnswer: string,
    verifyModel: string,
    summaries: string[],
    docs: LibraryItem[],
    statusTopics: StatusTopicItem[],
    workshopContent?: string
  ) => {
    handleSetModel(verifyModel)
    setChatBDocs([...docs])
    setChatBStatusTopics([...statusTopics])
    setPendingContext({
      mode: 'verify',
      answerToVerify: lastAIAnswer,
      workshopContent,
      summaries
    })
    // No LLM call – user formulates their own question
  }

  /**
   * Prepare Chat B for audit mode (no API call).
   * Shows draft as block in Chat B, ready for user questions.
   */
  const startAuditWithDraft = (
    draftContent: string,
    auditModel: string,
    summaries: string[],
    draftVersion: number,
    docs: LibraryItem[],
    statusTopics: StatusTopicItem[],
    // Accepted for call-signature symmetry with startVerifyWithAnswer, but unused here:
    // in audit mode the draft itself IS the workshop content (see below).
    _workshopContent?: string
  ) => {
    handleSetModel(auditModel)
    setChatBDocs([...docs])
    setChatBStatusTopics([...statusTopics])
    setPendingContext({
      mode: 'audit',
      workshopContent: draftContent, // draft IS the workshop content for audit
      summaries
    })

    // Add draft as visible block in Chat B (no API call)
    const draftMessage: ChatMessage = {
      id: `chatb-draft-${Date.now()}`,
      role: 'draft',
      content: draftContent,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      draftData: {
        draftVersion,
        isExpanded: false
      }
    }
    setMessages(prev => [...prev, draftMessage])
  }

  /**
   * Add a new draft version to Chat B (follow-up audit, no API call).
   * Updates the pending context with the new draft content.
   */
  const addDraftForAudit = (
    draftContent: string,
    draftVersion: number,
    docs: LibraryItem[],
    statusTopics: StatusTopicItem[]
  ) => {
    setChatBDocs([...docs])
    setChatBStatusTopics([...statusTopics])
    setPendingContext(prev => prev
      ? { ...prev, workshopContent: draftContent }
      : { mode: 'audit', workshopContent: draftContent, summaries: [] }
    )

    const draftMessage: ChatMessage = {
      id: `chatb-draft-${Date.now()}`,
      role: 'draft',
      content: draftContent,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      draftData: {
        draftVersion,
        isExpanded: false
      }
    }
    setMessages(prev => [...prev, draftMessage])
  }

  return {
    // State
    messages,
    input,
    model,
    isTyping,
    contextOpen,
    showTags,
    error,
    sessionId,
    selectedMessages,
    chatBDocs,
    chatBStatusTopics,
    pendingContext,

    // Setters
    setInput,
    setModel: handleSetModel,
    setContextOpen,
    setShowTags,
    setMessages,
    setSessionId,
    setChatBDocs,
    setChatBStatusTopics,

    // Handlers
    handleSend,
    clearMessages,
    addMessage,
    startVerifyWithAnswer,
    startAuditWithDraft,
    addDraftForAudit,

    // Selection handlers
    handleToggleMessage,
    handleSelectFromHere,
    isMessageSelected,
    clearSelection,
    handleCopyToClipboard,
    handleDeleteMessages,
    selectionCount: selectedMessages.size
  }
}

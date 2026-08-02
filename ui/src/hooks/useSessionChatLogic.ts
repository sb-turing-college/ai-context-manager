import { useState } from 'react'
import type { Session, SessionId, StatusTopic, ChatMessage, SendState, SystemPromptModule, LibraryItem, StatusTopicItem } from '../types'
import { sendChatMessage, type DraftData, type EditData } from '../services/chatService'
import { deleteSession } from '../services/sessionService'
import { DEFAULT_MODEL_CHAT_A } from '../config/models'
import { getChatAModelSync, setChatAModelSync } from '../services/settingsService'

interface UseSessionChatLogicProps {
  sessions: Session[]
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
  setOpenTopic: React.Dispatch<React.SetStateAction<StatusTopic>>
  chatsBySession: Record<SessionId, ChatMessage[]>
  setChatsBySession: React.Dispatch<React.SetStateAction<Record<SessionId, ChatMessage[]>>>
  // Context data for AI
  systemPromptModules: SystemPromptModule[]
  libraryItems: LibraryItem[]
  statusTopics: StatusTopicItem[]
  selectedSummaries: SessionId[] // Cross-session summaries
  // Callbacks
  onStatusRefresh?: () => void // Called when status needs refresh after tool calls
  onUserFactsRefresh?: () => void // Called when user facts need refresh after tool calls
  onLibraryRefresh?: () => void // Keep Library panel in sync with DB SSOT used by LLM
  onSessionsRefresh?: () => Promise<void> // Called after message sent to update summary_status
  onDraftCreated?: (draft: DraftData) => void // Called when draft is created via tool
  onDraftEdited?: (edit: EditData) => void // Called when draft is edited via tool
  // Workshop context (for edit_draft tool) - getter function to get current value at send time
  getWorkshopContent?: () => string | undefined
  // Session duplication via API (when provided, used instead of local-only copy)
  onCopySession?: (sessionId: SessionId) => Promise<Session | null>
}

export function useSessionChatLogic({
  sessions,
  setSessions,
  setOpenTopic,
  chatsBySession,
  setChatsBySession,
  systemPromptModules,
  libraryItems,
  statusTopics,
  selectedSummaries,
  onStatusRefresh,
  onUserFactsRefresh,
  onLibraryRefresh,
  onSessionsRefresh,
  onDraftCreated,
  onDraftEdited,
  getWorkshopContent,
  onCopySession
}: UseSessionChatLogicProps) {
  const [activeSession, setActiveSession] = useState<SessionId | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [selectedModel, setSelectedModel] = useState(() => {
    const stored = getChatAModelSync()
    return stored || DEFAULT_MODEL_CHAT_A
  })
  const [pruneDialogOpen, setPruneDialogOpen] = useState(false)
  const [keepLastMessages, setKeepLastMessages] = useState(5)
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false)
  const [showPruneSuccess, setShowPruneSuccess] = useState(false)
  const [isFlyingStatus, setIsFlyingStatus] = useState(false)
  // Single state machine for send operations (replaces multiple boolean flags)
  const [chatSendState, setChatSendState] = useState<SendState>({ status: 'idle' })
  
  // Derived state for backwards compatibility
  const isAITyping = chatSendState.status === 'sending'
  
  // Error recovery: content to restore to input on failure
  const restoreMessage = chatSendState.status === 'error' ? chatSendState.content : null
  
  // Clear error state (after user acknowledges or retries)
  const clearSendError = () => setChatSendState({ status: 'idle' })
  const [sessionEditMode, setSessionEditMode] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<Set<SessionId>>(new Set())
  const [sessionDeleteConfirm, setSessionDeleteConfirm] = useState(false)
  const [sessionDeleteSuccess, setSessionDeleteSuccess] = useState(false)
  const [sessionDeleteConfirmId, setSessionDeleteConfirmId] = useState<SessionId | null>(null)
  const [sessionMoveSuccess, setSessionMoveSuccess] = useState(false)
  const [chatEditMode, setChatEditMode] = useState(false)
  // Cross-Session Selection: Map<SessionId, Set<MessageId>>
  const [globalSelection, setGlobalSelection] = useState<Record<SessionId, Set<string>>>({})
  const [chatDeleteConfirm, setChatDeleteConfirm] = useState(false)
  const [chatMoveNewSuccess, setChatMoveNewSuccess] = useState(false)
  const [chatMoveExistingSuccess, setChatMoveExistingSuccess] = useState(false)
  const [chatCopySuccess, setChatCopySuccess] = useState(false)
  const [showNewSessionSuccess, setShowNewSessionSuccess] = useState(false)

  // New sessions inherit the project of the currently active session
  // (there is no cross-project session move/copy/creation in this flow).
  const getCurrentProjectId = (): string =>
    sessions.find(s => s.id === activeSession)?.projectId ?? ''

  const handleNewSession = () => {
    const newSessionId = `session-${Date.now()}` as SessionId
    const newSession: Session = {
      id: newSessionId,
      title: 'New session',
      messageCount: 0,
      active: true,
      projectId: getCurrentProjectId()
    }
    // Deactivate all other sessions
    setSessions([...sessions.map(s => ({ ...s, active: false })), newSession])
    setActiveSession(newSessionId)
    
    // Show success feedback
    setShowNewSessionSuccess(true)
    setTimeout(() => setShowNewSessionSuccess(false), 1000)
  }

  const handleSessionClick = (sessionId: SessionId) => {
    setActiveSession(sessionId)
    setSessions(sessions.map(s => ({ ...s, active: s.id === sessionId })))
    // NOTE: Do NOT clear selection - we want cross-session selection!
  }

  const handleUpdateStatus = () => {
    setIsFlyingStatus(true)
    setShowUpdateSuccess(true)
    
    setTimeout(() => {
      setOpenTopic('missions')
      setIsFlyingStatus(false)
    }, 800)
    
    setTimeout(() => setShowUpdateSuccess(false), 1000)
  }

  const handlePruneChat = () => {
    setShowPruneSuccess(true)
    setTimeout(() => setShowPruneSuccess(false), 1000)
    setPruneDialogOpen(false)
  }

  const handleToggleSessionEditMode = () => {
    setSessionEditMode(!sessionEditMode)
    setSelectedSessions(new Set())
  }

  const handleSelectSession = (sessionId: SessionId) => {
    const newSelected = new Set(selectedSessions)
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId)
    } else {
      newSelected.add(sessionId)
    }
    setSelectedSessions(newSelected)
  }

  const handleDeleteSessions = async () => {
    if (selectedSessions.size === 0) return
    if (!sessionDeleteConfirm) {
      setSessionDeleteConfirm(true)
      return
    }
    try {
      for (const sessionId of selectedSessions) {
        await deleteSession(sessionId)
      }
      setSessions(sessions.filter(s => !selectedSessions.has(s.id)))
      setChatsBySession(prev => {
        const next = { ...prev }
        for (const id of selectedSessions) delete next[id]
        return next
      })
      setSelectedSessions(new Set())
      setSessionEditMode(false)
      setSessionDeleteConfirm(false)
      setSessionDeleteSuccess(true)
      setTimeout(() => setSessionDeleteSuccess(false), 1000)
    } catch (error) {
      console.error('Failed to delete sessions:', error)
    }
  }

  // Delete single session (with 2-step confirmation via sessionDeleteConfirmId)
  const handleDeleteSingleSession = async (sessionId: SessionId) => {
    if (sessionDeleteConfirmId !== sessionId) {
      // First click: show confirmation
      setSessionDeleteConfirmId(sessionId)
      return
    }
    try {
      await deleteSession(sessionId)
      const remainingSessions = sessions.filter(s => s.id !== sessionId)
      setSessions(remainingSessions)
      setChatsBySession(prev => {
        const next = { ...prev }
        delete next[sessionId]
        return next
      })
      setSessionDeleteConfirmId(null)

      // If deleted session was active, switch to first remaining session
      if (activeSession === sessionId && remainingSessions.length > 0) {
        const newActive = remainingSessions[0]
        setActiveSession(newActive.id)
        setSessions(remainingSessions.map(s => ({ ...s, active: s.id === newActive.id })))
      }

      setSessionDeleteSuccess(true)
      setTimeout(() => setSessionDeleteSuccess(false), 1000)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const cancelSessionDelete = () => {
    setSessionDeleteConfirmId(null)
  }

  // Copy (duplicate) a session
  const handleCopySession = async (sessionId: SessionId) => {
    const sourceSession = sessions.find(s => s.id === sessionId)
    const sourceMessages = chatsBySession[sessionId] || []

    if (!sourceSession) return

    if (onCopySession) {
      try {
        const newSession = await onCopySession(sessionId)
        if (newSession) {
          setSessions(prev => [...prev, newSession])
          setActiveSession(newSession.id)
          setSessionDeleteSuccess(true)
          setTimeout(() => setSessionDeleteSuccess(false), 1000)
        }
      } catch (err) {
        console.error('Failed to duplicate session:', err)
      }
      return
    }

    // Local-only fallback (non-API mode)
    const newSessionId = `session-${Date.now()}` as SessionId
    const newSession: Session = {
      ...sourceSession,
      id: newSessionId,
      title: `${sourceSession.title} (Kopie)`,
      active: false,
      messageCount: sourceMessages.length
    }

    setSessions(prev => [...prev, newSession])
    setChatsBySession(prev => ({
      ...prev,
      [newSessionId]: [...sourceMessages.map(m => ({ ...m, id: `${m.id}-copy-${Date.now()}` }))]
    }))

    setSessionDeleteSuccess(true)
    setTimeout(() => setSessionDeleteSuccess(false), 1000)
  }

  const handleMoveSessions = () => {
    if (selectedSessions.size === 0) return
    setSessionMoveSuccess(true)
    setTimeout(() => setSessionMoveSuccess(false), 1000)
  }

  const handleToggleChatEditMode = () => {
    setChatEditMode(!chatEditMode)
    setGlobalSelection({})
  }

  // Toggle single message selection (by ID, cross-session safe)
  const handleToggleMessageSelection = (sessionId: SessionId, messageId: string) => {
    setGlobalSelection(prev => {
      const sessionSet = new Set(prev[sessionId] || [])
      if (sessionSet.has(messageId)) {
        sessionSet.delete(messageId)
      } else {
        sessionSet.add(messageId)
      }
      // Clean up empty sets
      if (sessionSet.size === 0) {
        const newState = { ...prev }
        delete newState[sessionId]
        return newState
      }
      return { ...prev, [sessionId]: sessionSet }
    })
  }

  // Select all messages from index to end (within current session)
  const handleSelectFromHere = (sessionId: SessionId, startIndex: number) => {
    const sessionMessages = chatsBySession[sessionId] || []
    setGlobalSelection(prev => {
      const sessionSet = new Set(prev[sessionId] || [])
      // Check if first message is selected -> toggle behavior
      const firstMsg = sessionMessages[startIndex]
      const firstIsSelected = firstMsg && sessionSet.has(firstMsg.id)
      
      for (let i = startIndex; i < sessionMessages.length; i++) {
        const msg = sessionMessages[i]
        if (msg) {
          if (firstIsSelected) {
            sessionSet.delete(msg.id)
          } else {
            sessionSet.add(msg.id)
          }
        }
      }
      
      if (sessionSet.size === 0) {
        const newState = { ...prev }
        delete newState[sessionId]
        return newState
      }
      return { ...prev, [sessionId]: sessionSet }
    })
  }

  // Check if a message is selected
  const isMessageSelected = (sessionId: SessionId, messageId: string): boolean => {
    return globalSelection[sessionId]?.has(messageId) || false
  }

  // Get total selection count across all sessions
  const getSelectionCount = (): number => {
    return Object.values(globalSelection).reduce((sum, set) => sum + set.size, 0)
  }

  // Get selected messages as array (for operations)
  const getSelectedMessages = (): Array<{ sessionId: SessionId; message: ChatMessage }> => {
    const result: Array<{ sessionId: SessionId; message: ChatMessage }> = []
    for (const [sessionId, messageIds] of Object.entries(globalSelection)) {
      const sessionMessages = chatsBySession[sessionId as SessionId] || []
      for (const msgId of messageIds) {
        const msg = sessionMessages.find(m => m.id === msgId)
        if (msg) {
          result.push({ sessionId: sessionId as SessionId, message: msg })
        }
      }
    }
    return result
  }

  // Clear all selections
  const clearSelection = () => {
    setGlobalSelection({})
  }

  // Copy selected messages to target session
  const copyToSession = (targetSessionId: SessionId, keepSelection: boolean = false) => {
    const selectedMsgs = getSelectedMessages()
    if (selectedMsgs.length === 0) return

    // Create copies with new IDs
    const copiedMessages: ChatMessage[] = selectedMsgs.map(({ message }) => ({
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }))

    // Add to target session
    setChatsBySession(prev => ({
      ...prev,
      [targetSessionId]: [...(prev[targetSessionId] || []), ...copiedMessages]
    }))

    // Update message count
    setSessions(prev => prev.map(s =>
      s.id === targetSessionId
        ? { ...s, messageCount: (s.messageCount || 0) + copiedMessages.length }
        : s
    ))

    // Clear selection (default behavior, can be disabled via settings)
    if (!keepSelection) {
      setGlobalSelection({})
    }

    setChatCopySuccess(true)
    setTimeout(() => setChatCopySuccess(false), 1000)
  }

  // Move selected messages to target session (copy + delete from source)
  const moveToSession = (targetSessionId: SessionId) => {
    const selectedMsgs = getSelectedMessages()
    if (selectedMsgs.length === 0) return

    // Group by source session for deletion
    const bySourceSession: Record<SessionId, string[]> = {}
    for (const { sessionId, message } of selectedMsgs) {
      if (!bySourceSession[sessionId]) {
        bySourceSession[sessionId] = []
      }
      bySourceSession[sessionId].push(message.id)
    }

    // Create copies with new IDs for target
    const movedMessages: ChatMessage[] = selectedMsgs.map(({ message }) => ({
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }))

    // Update chats: remove from sources, add to target
    setChatsBySession(prev => {
      const updated = { ...prev }
      
      // Remove from source sessions
      for (const [sourceId, msgIds] of Object.entries(bySourceSession)) {
        const sourceMessages = updated[sourceId as SessionId] || []
        updated[sourceId as SessionId] = sourceMessages.filter(m => !msgIds.includes(m.id))
      }
      
      // Add to target
      updated[targetSessionId] = [...(updated[targetSessionId] || []), ...movedMessages]
      
      return updated
    })

    // Update message counts
    setSessions(prev => prev.map(s => {
      const removedCount = bySourceSession[s.id]?.length || 0
      const addedCount = s.id === targetSessionId ? movedMessages.length : 0
      return {
        ...s,
        messageCount: (s.messageCount || 0) - removedCount + addedCount
      }
    }))

    // Clear selection and show success
    setGlobalSelection({})
    setChatMoveExistingSuccess(true)
    setTimeout(() => setChatMoveExistingSuccess(false), 1000)
  }

  // Move to new session
  const moveToNewSession = () => {
    const selectedMsgs = getSelectedMessages()
    if (selectedMsgs.length === 0) return

    const newSessionId = `session-${Date.now()}` as SessionId
    const newSession: Session = {
      id: newSessionId,
      title: 'New session',
      messageCount: 0,
      active: false, // Don't switch to it
      projectId: getCurrentProjectId()
    }

    setSessions(prev => [...prev, newSession])
    
    // Use setTimeout to ensure new session exists before moving
    setTimeout(() => {
      moveToSession(newSessionId)
      setChatMoveNewSuccess(true)
      setTimeout(() => setChatMoveNewSuccess(false), 1000)
    }, 50)
  }

  // Copy to new session
  const copyToNewSession = () => {
    const selectedMsgs = getSelectedMessages()
    if (selectedMsgs.length === 0) return

    const newSessionId = `session-${Date.now()}` as SessionId
    const newSession: Session = {
      id: newSessionId,
      title: 'New session',
      messageCount: 0,
      active: false, // Don't switch to it
      projectId: getCurrentProjectId()
    }

    setSessions(prev => [...prev, newSession])
    
    // Use setTimeout to ensure new session exists before copying
    setTimeout(() => {
      copyToSession(newSessionId)
    }, 50)
  }

  // Copy to clipboard (text format)
  const copyToClipboard = () => {
    const selectedMsgs = getSelectedMessages()
    if (selectedMsgs.length === 0) return

    const text = selectedMsgs
      .map(({ message }) => `${message.role === 'user' ? 'User' : 'AI'}: ${message.content}`)
      .join('\n\n')
    
    navigator.clipboard.writeText(text)
    setChatCopySuccess(true)
    setTimeout(() => setChatCopySuccess(false), 1000)
  }

  // NOTE: When backend is connected, add implicitContext parameter for draft content
  const handleSendMessage = async () => {
    if (!activeSession || !chatInput.trim() || chatSendState.status === 'sending') return

    const messageContent = chatInput.trim()
    const optimisticId = `msg-${Date.now()}`
    
    // Add user message immediately (optimistic update)
    const userMessage: ChatMessage = {
      id: optimisticId,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }

    setChatsBySession(prev => ({
      ...prev,
      [activeSession]: [...(prev[activeSession] || []), userMessage]
    }))

    // Update session message count (use prev to avoid stale closure!)
    setSessions(prev => prev.map(s => 
      s.id === activeSession 
        ? { ...s, messageCount: s.messageCount + 1 }
        : s
    ))

    setChatInput('')
    
    // State Machine: idle → sending
    setChatSendState({ 
      status: 'sending', 
      content: messageContent, 
      optimisticId 
    })

    // Real API call to backend
    try {
      // Merge session DB assignment + UI state (survives refresh races)
      const fromSession = sessions.find((s) => s.id === activeSession)?.attachedSummaryIds || []
      const attachedIds = [...new Set([...fromSession, ...selectedSummaries])]

      const response = await sendChatMessage({
        message: messageContent,
        sessionId: activeSession,
        model: selectedModel,
        includeSummaries: attachedIds,
        context: {
          system_prompt: systemPromptModules
            .map(m => m.content)
            .filter(Boolean)
            .join('\n\n---\n\n'),
          documents: libraryItems.map(item => ({
            id: item.id,
            title: item.title,
            content: item.content
          })),
          status_topics: statusTopics.map(topic => ({
            id: topic.id,
            title: topic.title,
            content: topic.content
          })),
          implicit_context: getWorkshopContent?.()
        }
      })

      // Success: Validate response has content
      if (!response.content || response.content.trim() === '') {
        throw new Error('AI response is empty. Please try again.')
      }
      
      // Replace optimistic user message with real one, add AI response
      const realUserMessage: ChatMessage = {
        id: response.user_message_id || optimisticId, // Fallback to optimistic if not provided
        role: 'user',
        content: messageContent,
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      }
      
      const aiMessage: ChatMessage = {
        id: response.ai_message_id || `ai-${Date.now()}`, // Fallback to generated ID
        role: 'ai',
        content: response.content,
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        model: response.model || selectedModel,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        toolCalls: response.tool_calls?.map((c) => ({
          tool: c.tool_name,
          params: c.arguments || {},
          result: c.result,
          success: c.result?.success ?? false
        })),
        turnSummary: response.turn_summary || undefined,
        turnOk: typeof response.turn_ok === 'boolean' ? response.turn_ok : undefined
      }

      // Replace optimistic message with real messages from backend
      setChatsBySession(prev => ({
        ...prev,
        [activeSession]: [
          ...(prev[activeSession] || []).filter(m => m.id !== optimisticId),
          realUserMessage,
          aiMessage
        ]
      }))

      setSessions(prev => prev.map(s => 
        s.id === activeSession 
          ? { ...s, messageCount: s.messageCount + 1 }
          : s
      ))
      
      // Refresh panels from DB (same SSOT the LLM just used)
      if (onStatusRefresh) {
        onStatusRefresh()
      }
      if (onUserFactsRefresh) {
        onUserFactsRefresh()
      }
      if (onLibraryRefresh) {
        onLibraryRefresh()
      }
      
      // Refresh sessions from backend to update summary_status (ampel logic)
      if (onSessionsRefresh) {
        await onSessionsRefresh()
      }
      
      // Check if draft was created and notify App
      if (response.draft_data && onDraftCreated) {
        try {
          onDraftCreated(response.draft_data)
        } catch (draftError) {
          console.error('Error in onDraftCreated callback:', draftError)
          // Don't let draft callback errors affect the chat flow
        }
      }
      
      // Check if draft was edited and notify App
      // Each EditData contains a LIST of edits to apply as ONE new version
      if (response.edit_data_list && response.edit_data_list.length > 0 && onDraftEdited) {
        try {
          // Each EditData in the list represents one tool call
          // Normally there's only one, but if multiple, apply each as separate version
          for (const editData of response.edit_data_list) {
            onDraftEdited(editData)
          }
        } catch (editError) {
          console.error('Error in onDraftEdited callback:', editError)
          // Don't let edit callback errors affect the chat flow
        }
      }

      // Persist last-used model (belt-and-suspenders: also on send, not only on dropdown change)
      setChatAModelSync(selectedModel)

      // State Machine: sending → idle
      setChatSendState({ status: 'idle' })

      // Auto-scroll to bottom
      setTimeout(() => {
        const container = document.getElementById('chat-container')
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }, 100)
    } catch (error) {
      // State Machine: sending → error
      // Rollback: Remove optimistic user message
      setChatsBySession(prev => ({
        ...prev,
        [activeSession]: (prev[activeSession] || []).filter(m => m.id !== optimisticId)
      }))
      setSessions(prev => prev.map(s => 
        s.id === activeSession 
          ? { ...s, messageCount: Math.max(0, s.messageCount - 1) }
          : s
      ))
      
      // UX: Restore message to input so user can easily retry
      setChatInput(messageContent)
      
      setChatSendState({ 
        status: 'error', 
        content: messageContent,
        errorMessage: error instanceof Error ? error.message : 'Message could not be sent'
      })
    }
  }

  const handleSetSelectedModel = (modelId: string) => {
    setSelectedModel(modelId)
    setChatAModelSync(modelId)
  }

  return {
    activeSession,
    chatInput,
    selectedModel,
    setSelectedModel: handleSetSelectedModel,
    isAITyping,
    chatSendState,
    restoreMessage,
    clearSendError,
    pruneDialogOpen,
    keepLastMessages,
    showUpdateSuccess,
    showPruneSuccess,
    isFlyingStatus,
    sessionEditMode,
    selectedSessions,
    sessionDeleteConfirm,
    sessionDeleteSuccess,
    sessionDeleteConfirmId,
    sessionMoveSuccess,
    chatEditMode,
    globalSelection,
    chatDeleteConfirm,
    chatMoveNewSuccess,
    chatMoveExistingSuccess,
    chatCopySuccess,
    showNewSessionSuccess,
    setShowNewSessionSuccess,
    setActiveSession,
    setChatInput,
    setPruneDialogOpen,
    setKeepLastMessages,
    setChatDeleteConfirm,
    setSessionDeleteConfirm,
    handleNewSession,
    handleSessionClick,
    handleUpdateStatus,
    handlePruneChat,
    handleSendMessage,
    handleToggleSessionEditMode,
    handleSelectSession,
    handleDeleteSessions,
    handleDeleteSingleSession,
    handleCopySession,
    cancelSessionDelete,
    handleMoveSessions,
    handleToggleChatEditMode,
    // Cross-session selection
    handleToggleMessageSelection,
    handleSelectFromHere,
    isMessageSelected,
    getSelectionCount,
    getSelectedMessages,
    clearSelection,
    copyToSession,
    moveToSession,
    moveToNewSession,
    copyToNewSession,
    copyToClipboard
  }
}

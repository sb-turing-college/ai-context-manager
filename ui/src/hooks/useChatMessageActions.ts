/**
 * Chat A message expand/delete/archive/summary actions (SoC Phase 2).
 */

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Session, SessionId, ChatMessage } from '../types'
import {
  generateSummary,
  getArchivedMessages,
  restoreArchivedMessages,
} from '../services/chatService'
import { getSessionsByProject, getChatMessages } from '../services/sessionService'
import type { getAppSettings } from '../services/settingsService'
import { API_BASE } from '../config/api'

type SetChats = Dispatch<SetStateAction<Record<string, ChatMessage[]>>>
type SetSessions = Dispatch<SetStateAction<Session[]>>

export function useChatMessageActions(opts: {
  currentSession: Session | undefined
  chatsBySession: Record<string, ChatMessage[]>
  setChatsBySession: SetChats
  setSessions: SetSessions
  getSelectionCount: () => number
  getSelectedMessages: () => Array<{ sessionId: SessionId; message: ChatMessage }>
  clearSelection: () => void
  selectedModel: string
  appSettings: Awaited<ReturnType<typeof getAppSettings>> | null
  setIsThinking: (v: boolean) => void
}) {
  const {
    currentSession,
    chatsBySession,
    setChatsBySession,
    setSessions,
    getSelectionCount,
    getSelectedMessages,
    clearSelection,
    selectedModel,
    appSettings,
    setIsThinking,
  } = opts

  const [showSummaryHint, setShowSummaryHint] = useState(false)
  const [summarySnoozeUntilCount, setSummarySnoozeUntilCount] = useState<number | null>(null)
  const [showKonsolidierenSuccess, setShowKonsolidierenSuccess] = useState(false)

  const handleToggleFeedbackExpand = (messageId: string) => {
    if (!currentSession) return
    setChatsBySession((prev) => ({
      ...prev,
      [currentSession.id]: (prev[currentSession.id] || []).map((msg) =>
        msg.id === messageId && msg.feedbackData
          ? { ...msg, feedbackData: { ...msg.feedbackData, isExpanded: !msg.feedbackData.isExpanded } }
          : msg,
      ),
    }))
  }

  const handleToggleArchiveExpand = (messageId: string) => {
    if (!currentSession) return
    setChatsBySession((prev) => ({
      ...prev,
      [currentSession.id]: (prev[currentSession.id] || []).map((msg) =>
        msg.id === messageId && msg.archiveData
          ? { ...msg, archiveData: { ...msg.archiveData, isExpanded: !msg.archiveData.isExpanded } }
          : msg,
      ),
    }))
  }

  const handleRestoreArchive = async () => {
    if (!currentSession) return
    try {
      await restoreArchivedMessages(currentSession.id)
      const reloadedMessages = await getChatMessages(currentSession.id)
      const currentMsgs = chatsBySession[currentSession.id] || []
      const summaryMsg = currentMsgs.find((msg) => msg.role === 'summary')
      const finalMessages: ChatMessage[] = summaryMsg
        ? [...reloadedMessages, summaryMsg]
        : reloadedMessages
      setChatsBySession((prev) => ({ ...prev, [currentSession.id]: finalMessages }))
    } catch (err) {
      console.error('Failed to restore archived messages:', err)
    }
  }

  const handleToggleSummaryExpand = (messageId: string) => {
    if (!currentSession) return
    setChatsBySession((prev) => ({
      ...prev,
      [currentSession.id]: (prev[currentSession.id] || []).map((msg) =>
        msg.id === messageId && msg.summaryData
          ? { ...msg, summaryData: { ...msg.summaryData, isExpanded: !msg.summaryData.isExpanded } }
          : msg,
      ),
    }))
  }

  const handleToggleToolExpand = (messageId: string) => {
    if (!currentSession) return
    setChatsBySession((prev) => ({
      ...prev,
      [currentSession.id]: (prev[currentSession.id] || []).map((msg) =>
        msg.id === messageId && msg.toolCallData
          ? { ...msg, toolCallData: { ...msg.toolCallData, isExpanded: !msg.toolCallData.isExpanded } }
          : msg,
      ),
    }))
  }

  const handleDismissSummaryHint = () => {
    setShowSummaryHint(false)
    if (currentSession) {
      const currentMessageCount = chatsBySession[currentSession.id]?.length || 0
      const snoozeTarget = currentMessageCount + 6
      setSummarySnoozeUntilCount(snoozeTarget)
    }
  }

  const handleDeleteMessages = (messageId?: string) => {
    if (!currentSession) return

    const sessionId = currentSession.id
    const messages = chatsBySession[sessionId] || []

    if (getSelectionCount() > 0) {
      const selectedMsgs = getSelectedMessages()
      const toDeleteBySession: Record<SessionId, Set<string>> = {}
      for (const { sessionId: srcId, message } of selectedMsgs) {
        if (!toDeleteBySession[srcId]) {
          toDeleteBySession[srcId] = new Set()
        }
        toDeleteBySession[srcId].add(message.id)
      }

      setChatsBySession((prev) => {
        const updated = { ...prev }
        for (const [sessId, msgIds] of Object.entries(toDeleteBySession)) {
          const sessMessages = updated[sessId as SessionId] || []
          updated[sessId as SessionId] = sessMessages.filter((m) => !msgIds.has(m.id))
        }
        return updated
      })

      setSessions((prev) =>
        prev.map((s) => {
          const deletedCount = toDeleteBySession[s.id]?.size || 0
          return deletedCount > 0
            ? { ...s, messageCount: (s.messageCount || 0) - deletedCount }
            : s
        }),
      )

      clearSelection()
    } else if (messageId) {
      const newMessages = messages.filter((m) => m.id !== messageId)
      setChatsBySession((prev) => ({
        ...prev,
        [sessionId]: newMessages,
      }))
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messageCount: newMessages.length } : s,
        ),
      )
    }
  }

  const handleKonsolidieren = async () => {
    if (!currentSession) return

    setSummarySnoozeUntilCount(null)
    setShowSummaryHint(false)
    setIsThinking(true)

    try {
      const currentMessages = chatsBySession[currentSession.id] || []
      const activeMessageIds = currentMessages
        .filter((msg) => msg.role !== 'archive')
        .map((msg) => msg.id)

      const summaryModel =
        appSettings?.summaryModelMode === 'fixed' && appSettings?.summaryModelId
          ? appSettings.summaryModelId
          : selectedModel
      await generateSummary(currentSession.id, summaryModel, activeMessageIds)

      const updatedSessions = await getSessionsByProject(currentSession.projectId)
      setSessions(updatedSessions)

      const prunedMessages = await getChatMessages(currentSession.id)

      const summaryResponse = await fetch(
        `${API_BASE}/api/v1/sessions/${currentSession.id}/summary`,
      )
      let summaryMessage: ChatMessage | null = null

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        summaryMessage = {
          id: `summary-${currentSession.id}`,
          role: 'summary',
          content: summaryData.content,
          timestamp: summaryData.created_at,
          summaryData: {
            isExpanded: false,
            model: summaryData.model ?? undefined,
            createdAt: summaryData.created_at,
            inputTokens: summaryData.input_tokens ?? undefined,
            outputTokens: summaryData.output_tokens ?? undefined,
          },
        }
      }

      let archiveBlock: ChatMessage | null = null
      try {
        const rawArchived = await getArchivedMessages(currentSession.id)
        if (rawArchived.length > 0) {
          const archivedMsgs: ChatMessage[] = rawArchived.map((m) => ({
            id: m.id,
            role: m.role as ChatMessage['role'],
            content: m.content,
            timestamp: m.timestamp,
          }))
          archiveBlock = {
            id: `archive-${currentSession.id}`,
            role: 'archive',
            content: '',
            timestamp: new Date().toISOString(),
            archiveData: { messages: archivedMsgs, isExpanded: false },
          }
        }
      } catch (_) {
        // Graceful: archive block stays null
      }

      const finalMessages: ChatMessage[] = []
      if (archiveBlock) finalMessages.push(archiveBlock)
      finalMessages.push(...prunedMessages)
      if (summaryMessage) finalMessages.push(summaryMessage)

      setChatsBySession({
        ...chatsBySession,
        [currentSession.id]: finalMessages,
      })

      setIsThinking(false)
      setShowKonsolidierenSuccess(true)
      setTimeout(() => setShowKonsolidierenSuccess(false), 1000)
    } catch (error) {
      console.error('Failed to create summary:', error)
      setIsThinking(false)
    }
  }

  return {
    showSummaryHint,
    setShowSummaryHint,
    summarySnoozeUntilCount,
    setSummarySnoozeUntilCount,
    showKonsolidierenSuccess,
    handleToggleFeedbackExpand,
    handleToggleArchiveExpand,
    handleRestoreArchive,
    handleToggleSummaryExpand,
    handleToggleToolExpand,
    handleDismissSummaryHint,
    handleDeleteMessages,
    handleKonsolidieren,
  }
}

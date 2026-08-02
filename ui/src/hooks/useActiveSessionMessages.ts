/**
 * Load/cache chat messages when the active session changes (SoC Phase 2).
 */

import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { ChatMessage, SessionId } from '../types'
import { getArchivedMessages } from '../services/chatService'
import { getChatMessages } from '../services/sessionService'
import { API_BASE } from '../config/api'

type SetChats = Dispatch<SetStateAction<Record<string, ChatMessage[]>>>

function parseTimestamp(ts: string | undefined): number {
  if (!ts) return 0

  let normalized = ts.trim()

  if (normalized.includes(' ') && !normalized.includes('T')) {
    const dateTimeMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/)
    if (dateTimeMatch) {
      normalized = `${dateTimeMatch[1]}T${dateTimeMatch[2]}${normalized.substring(dateTimeMatch[0].length)}`
    } else {
      normalized = normalized.replace(' ', 'T')
    }
  }

  const date = new Date(normalized)
  if (!isNaN(date.getTime())) {
    return date.getTime()
  }

  const timeMatch = ts.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const [, hours, minutes] = timeMatch
    const d = new Date()
    d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
    return d.getTime()
  }

  return 0
}

export function useActiveSessionMessages(opts: {
  activeSessionId: SessionId | null
  chatsBySession: Record<string, ChatMessage[]>
  setChatsBySession: SetChats
  setChatsLoading: (v: boolean) => void
}) {
  const { activeSessionId, chatsBySession, setChatsBySession, setChatsLoading } = opts

  useEffect(() => {
    if (!activeSessionId) {
      return
    }

    const existingMessages = chatsBySession[activeSessionId]
    if (existingMessages && existingMessages.length > 0) {
      const hasRealMessages = existingMessages.some(
        (msg) => !msg.id.startsWith('msg-') && !msg.id.startsWith('critic-'),
      )
      if (hasRealMessages) {
        return
      }
    }

    setChatsLoading(true)
    getChatMessages(activeSessionId)
      .then(async (messages) => {
        let archivedMsgs: ChatMessage[] = []
        try {
          const raw = await getArchivedMessages(activeSessionId)
          archivedMsgs = raw.map((m) => ({
            id: m.id,
            role: m.role as ChatMessage['role'],
            content: m.content,
            timestamp: m.timestamp,
          }))
        } catch (_) {
          // graceful degradation
        }

        const currentMessages = chatsBySession[activeSessionId] || []
        const existingSummary = currentMessages.find((msg) => msg.role === 'summary')
        const preservedSummaryExpanded = existingSummary?.summaryData?.isExpanded || false

        let summaryMessage: ChatMessage | null = null
        try {
          const summaryResponse = await fetch(
            `${API_BASE}/api/v1/sessions/${activeSessionId}/summary`,
          )
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json()

            summaryMessage = {
              id: `summary-${activeSessionId}`,
              role: 'summary',
              content: summaryData.content,
              timestamp: summaryData.created_at,
              summaryData: {
                isExpanded: preservedSummaryExpanded,
                model: summaryData.model ?? undefined,
                createdAt: summaryData.created_at,
                inputTokens: summaryData.input_tokens ?? undefined,
                outputTokens: summaryData.output_tokens ?? undefined,
              },
            }
          }
        } catch (_) {
          // No summary exists yet
        }

        const finalMessages: ChatMessage[] = []
        const archiveBlock: ChatMessage | null =
          archivedMsgs.length > 0
            ? {
                id: `archive-${activeSessionId}`,
                role: 'archive',
                content: '',
                timestamp: '',
                archiveData: { messages: archivedMsgs, isExpanded: false },
              }
            : null

        const sortedMessages: ChatMessage[] = [...messages]

        if (summaryMessage) {
          const summaryTime = parseTimestamp(summaryMessage.timestamp)

          if (summaryTime > 0) {
            let insertIndex = sortedMessages.length

            for (let i = 0; i < sortedMessages.length; i++) {
              const msg = sortedMessages[i]
              const msgTimestamp = (msg as ChatMessage & { created_at?: string }).created_at || msg.timestamp
              const msgTime = parseTimestamp(msgTimestamp)

              if (msgTime > 0 && summaryTime < msgTime) {
                insertIndex = i
                break
              }
            }

            sortedMessages.splice(insertIndex, 0, summaryMessage)
          } else {
            sortedMessages.push(summaryMessage)
          }
        }

        if (archiveBlock) {
          finalMessages.push(archiveBlock)
        }
        finalMessages.push(...sortedMessages)

        setChatsBySession((prev) => ({
          ...prev,
          [activeSessionId]: finalMessages,
        }))
      })
      .catch((error) => {
        console.error('Failed to load chat messages:', error)
        setChatsBySession((prev) => ({
          ...prev,
          [activeSessionId]: [],
        }))
      })
      .finally(() => {
        setChatsLoading(false)
      })
    // chatsBySession intentionally omitted to prevent reload loops (same as App)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId])
}

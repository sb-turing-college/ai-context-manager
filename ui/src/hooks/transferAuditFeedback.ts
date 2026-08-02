/** Persist Chat B delta as a Chat A feedback message. */

import type { ChatMessage, SessionId } from '../types'
import { createMessage } from '../services/sessionService'

export async function transferAuditFeedback(opts: {
  sessionId: SessionId
  chatBMessages: ChatMessage[]
  lastFeedbackMessageId: string | null
  feedbackCounter: number
  onNoNewMessages: () => void
  appendFeedback: (msg: ChatMessage) => void
  onTransferred: (lastChatBMessageId: string | null) => void
}): Promise<void> {
  const {
    sessionId,
    chatBMessages,
    lastFeedbackMessageId,
    feedbackCounter,
    onNoNewMessages,
    appendFeedback,
    onTransferred,
  } = opts

  if (chatBMessages.length === 0) {
    onNoNewMessages()
    return
  }

  let messagesToTransfer: ChatMessage[]
  if (lastFeedbackMessageId) {
    const lastIdx = chatBMessages.findIndex((m) => m.id === lastFeedbackMessageId)
    if (lastIdx !== -1 && lastIdx < chatBMessages.length - 1) {
      messagesToTransfer = chatBMessages.slice(lastIdx + 1)
    } else {
      onNoNewMessages()
      return
    }
  } else {
    messagesToTransfer = [...chatBMessages]
  }

  if (messagesToTransfer.length === 0) {
    onNoNewMessages()
    return
  }

  const feedbackData = {
    feedbackNumber: feedbackCounter,
    messages: messagesToTransfer,
    isExpanded: false,
  }

  try {
    const savedMessage = await createMessage(sessionId, {
      role: 'feedback',
      content: `[AUDIT-FEEDBACK #${feedbackCounter}]`,
      feedback_data: feedbackData,
    })

    appendFeedback({
      id: savedMessage.id,
      role: 'feedback',
      content: savedMessage.content,
      timestamp: savedMessage.timestamp,
      feedbackData,
    })
  } catch (error) {
    console.error('Failed to save feedback:', error)
    appendFeedback({
      id: `feedback-${Date.now()}`,
      role: 'feedback',
      content: `[AUDIT-FEEDBACK #${feedbackCounter}]`,
      timestamp: new Date().toISOString(),
      feedbackData,
    })
  }

  onTransferred(chatBMessages[chatBMessages.length - 1]?.id || null)
}

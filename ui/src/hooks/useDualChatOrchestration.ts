/**
 * Dual-chat / audit / verify UI orchestration extracted from App.tsx (Chunk yellow 5C).
 *
 * LLM send paths and Chat B message content stay in useChatBLogic.
 * Transfer-feedback / verify that need artifact + chatsBySession remain callable
 * via the returned setters + thin handlers below; App still wires heavy deps.
 */

import { useState } from 'react'

export type ChatBMode = 'audit' | 'verify' | null

export function useDualChatOrchestration() {
  const [dualMode, setDualMode] = useState(false)
  const [auditActive, setAuditActive] = useState(false)
  const [chatBMode, setChatBMode] = useState<ChatBMode>(null)
  const [chatBCloseConfirm, setChatBCloseConfirm] = useState(false)
  const [verifyConfirm, setVerifyConfirm] = useState(false)
  const [chatBResetConfirm, setChatBResetConfirm] = useState(false)
  const [lastFeedbackMessageId, setLastFeedbackMessageId] = useState<string | null>(null)

  const openAuditMode = () => {
    setChatBMode('audit')
    setDualMode(true)
    setAuditActive(true)
  }

  const openVerifyMode = () => {
    setChatBMode('verify')
    setDualMode(true)
    setAuditActive(false)
  }

  const closeDualChat = () => {
    setDualMode(false)
    setAuditActive(false)
    setChatBMode(null)
    setChatBCloseConfirm(false)
    setVerifyConfirm(false)
  }

  const requestCloseChatB = () => {
    if (!chatBCloseConfirm) {
      setChatBCloseConfirm(true)
      return false
    }
    closeDualChat()
    return true
  }

  const cancelCloseChatB = () => setChatBCloseConfirm(false)

  const requestVerifyConfirm = () => {
    if (dualMode && !verifyConfirm) {
      setVerifyConfirm(true)
      return false
    }
    setVerifyConfirm(false)
    return true
  }

  return {
    dualMode,
    setDualMode,
    auditActive,
    setAuditActive,
    chatBMode,
    setChatBMode,
    chatBCloseConfirm,
    setChatBCloseConfirm,
    verifyConfirm,
    setVerifyConfirm,
    chatBResetConfirm,
    setChatBResetConfirm,
    lastFeedbackMessageId,
    setLastFeedbackMessageId,
    openAuditMode,
    openVerifyMode,
    closeDualChat,
    requestCloseChatB,
    cancelCloseChatB,
    requestVerifyConfirm,
  }
}

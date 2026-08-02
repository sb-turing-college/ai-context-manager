/**
 * Audit / verify / Chat B transfer workflow extracted from App.tsx (SoC Phase 2).
 */

import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type {
  Session,
  SessionId,
  ChatMessage,
  LibraryItem,
  StatusTopicItem,
} from '../types'
import { clearAuditMessages, type DraftData, type EditData } from '../services/chatService'
import { buildLibraryAuditSession } from './runLibraryAuditSession'
import { transferAuditFeedback } from './transferAuditFeedback'

type SetChats = Dispatch<SetStateAction<Record<string, ChatMessage[]>>>
type SetSessions = Dispatch<SetStateAction<Session[]>>
type SetLibraryItems = Dispatch<SetStateAction<LibraryItem[]>>

type DraftHandlersRef = MutableRefObject<{
  onDraftCreated?: (draft: DraftData) => void
  onDraftEdited?: (edit: EditData) => void
  workshopContent?: string
}>

export function useAuditVerifyWorkflow(opts: {
  currentProject: string | null
  currentSession: Session | undefined
  chatsBySession: Record<string, ChatMessage[]>
  setChatsBySession: SetChats
  sessions: Session[]
  setSessions: SetSessions
  allLibraryItems: LibraryItem[]
  setAllLibraryItems: SetLibraryItems
  libraryItems: LibraryItem[]
  statusTopics: StatusTopicItem[]
  selectedSummaries: SessionId[]
  draftHandlersRef: DraftHandlersRef
  artifact: {
    artifactContent: string
    artifactStep: number
    handleCreateNewIteration: () => void
    handleCommitToLibrary: () => void
    handleDiscardArtifact: () => void
    discardConfirm: boolean
  }
  chatB: {
    messages: ChatMessage[]
    model: string
    startAuditWithDraft: (...args: any[]) => void
    addDraftForAudit: (...args: any[]) => void
    startVerifyWithAnswer: (...args: any[]) => void
    clearMessages: () => void
  }
  feedback: {
    feedbackCounter: number
    incrementCounter: () => void
  }
  dualMode: boolean
  auditActive: boolean
  verifyConfirm: boolean
  setVerifyConfirm: (v: boolean) => void
  setChatBResetConfirm: (v: boolean) => void
  lastFeedbackMessageId: string | null
  setLastFeedbackMessageId: (id: string | null) => void
  setAuditActive: (v: boolean) => void
  openAuditMode: () => void
  openVerifyMode: () => void
  closeDualChat: () => void
  setLeftCollapsed: (v: boolean) => void
  setRightCollapsed: (v: boolean) => void
  setActiveSession: (id: SessionId | null) => void
}) {
  const {
    currentProject,
    currentSession,
    chatsBySession,
    setChatsBySession,
    sessions,
    setSessions,
    allLibraryItems,
    setAllLibraryItems,
    libraryItems,
    statusTopics,
    selectedSummaries,
    draftHandlersRef,
    artifact,
    chatB,
    feedback,
    dualMode,
    auditActive,
    verifyConfirm,
    setVerifyConfirm,
    setChatBResetConfirm,
    lastFeedbackMessageId,
    setLastFeedbackMessageId,
    setAuditActive,
    openAuditMode,
    openVerifyMode,
    closeDualChat,
    setLeftCollapsed,
    setRightCollapsed,
    setActiveSession,
  } = opts

  const [auditingItemId, setAuditingItemId] = useState<string | null>(null)
  const [auditModalOpen, setAuditModalOpen] = useState(false)

  const handleNewIteration = () => {
    artifact.handleCreateNewIteration()
  }

  const handleStartAudit = () => {
    openAuditMode()
    setLeftCollapsed(true)

    if (!artifact.artifactContent || !currentSession) return

    const draftVersion = artifact.artifactStep || 1
    const workshopContent = draftHandlersRef.current.workshopContent
    const isInitialAudit = chatB.messages.length === 0

    if (isInitialAudit) {
      chatB.startAuditWithDraft(
        artifact.artifactContent,
        chatB.model,
        selectedSummaries,
        draftVersion,
        libraryItems,
        statusTopics,
        workshopContent,
      )
    } else {
      chatB.addDraftForAudit(
        artifact.artifactContent,
        draftVersion,
        libraryItems,
        statusTopics,
      )
    }
  }

  const handleTransferFeedback = async () => {
    if (!currentSession) {
      setAuditActive(false)
      return
    }

    await transferAuditFeedback({
      sessionId: currentSession.id,
      chatBMessages: chatB.messages,
      lastFeedbackMessageId,
      feedbackCounter: feedback.feedbackCounter,
      onNoNewMessages: () => setAuditActive(false),
      appendFeedback: (feedbackMessage) => {
        setChatsBySession((prev) => ({
          ...prev,
          [currentSession.id]: [...(prev[currentSession.id] || []), feedbackMessage],
        }))
        feedback.incrementCounter()
      },
      onTransferred: (lastId) => {
        setLastFeedbackMessageId(lastId)
        setAuditActive(false)
      },
    })
  }

  const handleResetChatB = () => {
    setChatBResetConfirm(true)
  }

  const handleConfirmResetChatB = () => {
    chatB.clearMessages()
    setLastFeedbackMessageId(null)

    if (currentSession) {
      clearAuditMessages(currentSession.id).catch((err) => {
        console.error('Failed to clear audit messages from DB:', err)
      })
    }

    setChatBResetConfirm(false)
  }

  const handleCancelResetChatB = () => {
    setChatBResetConfirm(false)
  }

  const handleStartVerify = () => {
    if (!currentSession) return

    const currentChat = chatsBySession[currentSession.id] || []
    const lastAIMessage = currentChat.slice().reverse().find((msg) => msg.role === 'ai')
    if (!lastAIMessage) return

    if (dualMode && !verifyConfirm) {
      setVerifyConfirm(true)
      return
    }

    setVerifyConfirm(false)
    openVerifyMode()
    setLeftCollapsed(true)

    chatB.startVerifyWithAnswer(
      lastAIMessage.content,
      chatB.model,
      selectedSummaries,
      libraryItems,
      statusTopics,
      draftHandlersRef.current.workshopContent,
    )
  }

  const handleCommitToLibraryWithCleanup = () => {
    artifact.handleCommitToLibrary()
    setRightCollapsed(true)
    closeDualChat()
  }

  const handleDiscardWithCleanup = () => {
    if (!artifact.discardConfirm) {
      artifact.handleDiscardArtifact()
      return
    }

    artifact.handleDiscardArtifact()

    if (auditActive || dualMode) {
      closeDualChat()
    }
  }

  const handleExecuteAudit = (persona: string, model: string, selectedItems: string[]) => {
    if (!currentProject || !auditingItemId) return

    setAllLibraryItems((items) =>
      items.map((item) =>
        item.id === auditingItemId ? { ...item, isAudited: true } : item,
      ),
    )

    const { newSession, initialMessages, newSessionId } = buildLibraryAuditSession({
      auditingItemId,
      allLibraryItems,
      artifactContent: artifact.artifactContent,
      persona,
      model,
      selectedItems,
    })

    setSessions([...sessions.map((s) => ({ ...s, active: false })), newSession])
    setChatsBySession({
      ...chatsBySession,
      [newSessionId]: initialMessages,
    })
    setActiveSession(newSessionId)
    setAuditModalOpen(false)
    setAuditingItemId(null)
  }

  return {
    auditingItemId,
    setAuditingItemId,
    auditModalOpen,
    setAuditModalOpen,
    handleNewIteration,
    handleStartAudit,
    handleTransferFeedback,
    handleResetChatB,
    handleConfirmResetChatB,
    handleCancelResetChatB,
    handleStartVerify,
    handleCommitToLibraryWithCleanup,
    handleDiscardWithCleanup,
    handleExecuteAudit,
  }
}

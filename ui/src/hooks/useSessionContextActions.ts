/**
 * Cross-session summaries + new-session dialogs extracted from App.tsx (SoC Phase 2).
 */

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Session, SessionId } from '../types'
import { createSession, updateSession } from '../services/sessionService'

type SetSessions = Dispatch<SetStateAction<Session[]>>

export function useSessionContextActions(opts: {
  currentProject: string | null
  activeSession: SessionId | null
  sessions: Session[]
  setSessions: SetSessions
  selectedSummaries: SessionId[]
  setSelectedSummaries: Dispatch<SetStateAction<SessionId[]>>
  setActiveSession: (id: SessionId | null) => void
  setShowNewSessionSuccess: (v: boolean) => void
}) {
  const {
    currentProject,
    activeSession,
    sessions,
    setSessions,
    selectedSummaries,
    setSelectedSummaries,
    setActiveSession,
    setShowNewSessionSuccess,
  } = opts

  const [createSessionDialogOpen, setCreateSessionDialogOpen] = useState(false)
  const [summaryImportDialogOpen, setSummaryImportDialogOpen] = useState(false)
  const [summaryExportSuccessId, setSummaryExportSuccessId] = useState<SessionId | null>(null)

  const persistAttachedSummaries = async (nextIds: SessionId[]) => {
    if (!activeSession) {
      setSelectedSummaries(nextIds)
      return
    }

    setSelectedSummaries(nextIds)
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession ? { ...s, attachedSummaryIds: nextIds } : s,
      ),
    )

    try {
      const updated = await updateSession(activeSession, {
        attachedSummaryIds: nextIds,
      })
      if (updated) {
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSession ? { ...s, ...updated } : s)),
        )
      }
    } catch (error) {
      console.error('Failed to persist attached summaries:', error)
    }
  }

  const handleAddSummary = (sessionId: SessionId) => {
    if (selectedSummaries.includes(sessionId)) return
    void persistAttachedSummaries([...selectedSummaries, sessionId])
  }

  const handleRemoveSummary = (sessionId: SessionId) => {
    void persistAttachedSummaries(selectedSummaries.filter((id) => id !== sessionId))
  }

  const handleOpenNewSessionDialog = () => {
    setCreateSessionDialogOpen(true)
  }

  const handleConfirmCreateSession = async (title: string) => {
    if (!currentProject) return

    try {
      const newSession = await createSession(currentProject, title)

      setSessions([
        ...sessions.map((s) => ({
          ...s,
          active: s.projectId === currentProject ? false : s.active,
        })),
        { ...newSession, active: true },
      ])
      setActiveSession(newSession.id)
      setSelectedSummaries(newSession.attachedSummaryIds || [])
      setCreateSessionDialogOpen(false)

      setShowNewSessionSuccess(true)
      setTimeout(() => setShowNewSessionSuccess(false), 1000)

      setTimeout(() => {
        const chatInput = document.querySelector(
          'textarea[placeholder*="message"]',
        ) as HTMLTextAreaElement
        chatInput?.focus()
      }, 100)
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleExportSummary = (sessionId: SessionId) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session || !session.summary) return

    const content = `# Session Summary: ${session.title}\n\nCreated: ${session.summary.timestamp}\nMessages: ${session.summary.messageCountAtCreation}\n\n---\n\n${session.summary.content}`

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `summary-${session.title.replace(/\s+/g, '-').toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setSummaryExportSuccessId(sessionId)
    setTimeout(() => setSummaryExportSuccessId(null), 1000)
  }

  return {
    createSessionDialogOpen,
    setCreateSessionDialogOpen,
    summaryImportDialogOpen,
    setSummaryImportDialogOpen,
    summaryExportSuccessId,
    handleAddSummary,
    handleRemoveSummary,
    handleOpenNewSessionDialog,
    handleConfirmCreateSession,
    handleExportSummary,
  }
}

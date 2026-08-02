/** Build demo audit session from library-item modal (legacy path). */

import type { Session, SessionId, ChatMessage, LibraryItem } from '../types'
import { MOCK_AUDIT_CRITIQUES } from './auditCritiques'

export function buildLibraryAuditSession(opts: {
  auditingItemId: string
  allLibraryItems: LibraryItem[]
  artifactContent: string
  persona: string
  model: string
  selectedItems: string[]
}): { newSession: Session; initialMessages: ChatMessage[]; newSessionId: SessionId } {
  const { auditingItemId, allLibraryItems, artifactContent, persona, model, selectedItems } = opts

  const libraryItem = allLibraryItems.find((item) => item.id === auditingItemId)
  const artifactTitle = libraryItem?.title || 'Draft'
  const newSessionId = `audit-${Date.now()}` as SessionId

  const newSession: Session = {
    id: newSessionId,
    title: `🛡️ AUDIT: ${artifactTitle}`,
    messageCount: 2,
    active: true,
    projectId: libraryItem?.projectId ?? '',
  }

  const initialMessages: ChatMessage[] = [
    {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: `Please critically review this draft:\n\n---\n${artifactContent}\n---\n\n${selectedItems.length > 0 ? `\nAdditional context: ${selectedItems.length} library items were provided.` : ''}`,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
    {
      id: `msg-${Date.now() + 1}`,
      role: 'ai',
      content:
        MOCK_AUDIT_CRITIQUES[persona as keyof typeof MOCK_AUDIT_CRITIQUES] ||
        MOCK_AUDIT_CRITIQUES.devil,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      model,
    },
  ]

  return { newSession, initialMessages, newSessionId }
}

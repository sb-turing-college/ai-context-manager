import { useState } from 'react'
import type { ChatMessage, Session, SummaryTriggerMode } from '../../types'
import { ALL_MODELS, type ModelOption } from '../../config/models'
import { TypingIndicator } from './TypingIndicator'
import { LiveProgressBubble, type LiveProgressState } from './LiveProgressBubble'
import { FeedbackBlock } from './FeedbackBlock'
import { ArchiveBlock } from './ArchiveBlock'
import { SummaryBlock } from './SummaryBlock'
import { ToolCallBlock } from './ToolCallBlock'
import { VerifyRequestBlock } from './VerifyRequestBlock'
import { DraftBlock } from './DraftBlock'
import { SummaryHint } from './SummaryHint'

interface ChatPanelProps {
  currentSession: Session | undefined
  projectTitle: string
  currentChat: ChatMessage[]
  isThinking: boolean
  isAITyping: boolean
  /** Live tool/stage progress for Chat A (null when idle) */
  liveProgress?: LiveProgressState | null
  chatInput: string
  selectedModel: string
  onModelChange: (model: string) => void
  /** Models to show in dropdown (filtered by user preference). Defaults to all if not provided. */
  models?: ModelOption[]
  showTags: boolean
  contextDrawerOpen: boolean
  showKonsolidierenSuccess: boolean
  showDraftSuccess: boolean
  rightCollapsed: boolean
  copySuccess: boolean
  totalSelectionCount: number
  showSendButton: boolean
  verifyConfirm: boolean
  onChatInputChange: (value: string) => void
  onSendMessage: () => void
  onToggleMessage: (messageId: string) => void
  onSelectFromHere: (index: number) => void
  onCopyToClipboard: () => void
  onDeleteMessages: (messageId?: string) => void
  isMessageSelected: (messageId: string) => boolean
  onToggleTags: () => void
  onOpenContext: () => void
  onOpenToolLog?: () => void
  toolLogDrawerOpen?: boolean
  onKonsolidieren: () => void
  onStartVerify: () => void
  onCancelVerify: () => void
  onCreateDraft: () => void
  onToggleFeedbackExpand: (messageId: string) => void
  onToggleArchiveExpand?: (messageId: string) => void
  onRestoreArchive?: () => void
  onToggleSummaryExpand?: (messageId: string) => void
  onToggleToolExpand?: (messageId: string) => void
  onToggleVerifyExpand?: (messageId: string) => void
  onToggleDraftExpand?: (messageId: string) => void
  // Chat B specific
  onTransferFeedback?: () => void // Transfer Chat B conversation to Chat A as feedback block
  onResetChatB?: () => void // Reset Chat B ("New round")
  chatBResetConfirm?: boolean // Confirmation dialog state
  onConfirmResetChatB?: () => void // Confirm reset
  onCancelResetChatB?: () => void // Cancel reset
  // Summary Hint feature
  summaryTriggerMode?: SummaryTriggerMode
  showSummaryHint?: boolean
  summaryTokenCount?: number
  summaryTokenThreshold?: number
  onDismissSummaryHint?: () => void
  // Chat B specific - no session required
  sessionRequired?: boolean // default: true - if false, skips session checks (for Chat B)
}

export function ChatPanel({
  currentSession,
  selectedModel,
  onModelChange,
  models,
  projectTitle,
  currentChat,
  isThinking,
  isAITyping,
  liveProgress = null,
  chatInput,
  showTags,
  contextDrawerOpen,
  showKonsolidierenSuccess,
  showDraftSuccess: _showDraftSuccess,
  rightCollapsed: _rightCollapsed,
  copySuccess,
  totalSelectionCount,
  showSendButton,
  verifyConfirm,
  onChatInputChange,
  onSendMessage,
  onToggleMessage,
  onSelectFromHere,
  onCopyToClipboard,
  onDeleteMessages,
  isMessageSelected,
  onToggleTags,
  onOpenContext,
  onOpenToolLog,
  toolLogDrawerOpen = false,
  onKonsolidieren,
  onStartVerify,
  onCancelVerify,
  onCreateDraft,
  onToggleFeedbackExpand,
  onToggleArchiveExpand,
  onRestoreArchive,
  onToggleSummaryExpand,
  onToggleToolExpand,
  onToggleVerifyExpand,
  onToggleDraftExpand,
  onTransferFeedback,
  onResetChatB,
  chatBResetConfirm = false,
  onConfirmResetChatB,
  onCancelResetChatB,
  summaryTriggerMode = 'manual',
  showSummaryHint = false,
  summaryTokenCount,
  summaryTokenThreshold,
  onDismissSummaryHint,
  sessionRequired = true
}: ChatPanelProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const selectionActive = totalSelectionCount > 0
  const visibleModels = models ?? ALL_MODELS
  return (
    <div className="h-full flex flex-col bg-slate-850 relative">
      {/* Chat Header */}
      <div className="p-3 border-b border-slate-700 shrink-0 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">
          {sessionRequired 
            ? `${projectTitle} - ${currentSession?.title || 'No session'}`
            : projectTitle
          }
        </span>
        
        {/* "New round" Button - only for Chat B (sessionRequired=false) */}
        {!sessionRequired && onResetChatB && (
          <div className="relative">
            {chatBResetConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Delete chat?</span>
                <button
                  onClick={onConfirmResetChatB}
                  className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={onCancelResetChatB}
                  className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={onResetChatB}
                disabled={currentChat.length === 0}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  currentChat.length === 0
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
                title="Start new feedback round"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New round
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary Hint (floating above chat) */}
      {summaryTriggerMode !== 'disabled' && (
        <SummaryHint
          isVisible={showSummaryHint}
          tokenCount={summaryTokenCount}
          tokenThreshold={summaryTokenThreshold}
          mode={summaryTriggerMode === 'automatic' ? 'automatic' : 'manual'}
          onCreateSummary={onKonsolidieren}
          onDismiss={onDismissSummaryHint || (() => {})}
          onAutoClose={onDismissSummaryHint}
        />
      )}
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4 relative" id="chat-container">
        {currentChat.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            {sessionRequired 
              ? 'New session - Start a conversation'
              : 'Ready for review requests'
            }
          </div>
        ) : (
          currentChat.map((msg, idx) => {
            // Render Feedback messages as FeedbackBlock component
            if (msg.role === 'feedback' && msg.feedbackData) {
              return (
                <FeedbackBlock
                  key={msg.id}
                  messageId={msg.id}
                  feedbackNumber={msg.feedbackData.feedbackNumber}
                  messages={msg.feedbackData.messages}
                  timestamp={msg.timestamp}
                  isExpanded={msg.feedbackData.isExpanded}
                  onToggleExpand={onToggleFeedbackExpand}
                  showTags={showTags}
                  isSelected={isMessageSelected(msg.id)}
                  selectionActive={selectionActive}
                  onToggleSelect={() => onToggleMessage(msg.id)}
                  onSelectFromHere={() => onSelectFromHere(idx)}
                  onCopyToClipboard={onCopyToClipboard}
                  onDeleteMessage={() => onDeleteMessages(msg.id)}
                  index={idx}
                />
              )
            }
            
            // Render Archive messages as ArchiveBlock component
            if (msg.role === 'archive' && msg.archiveData) {
              return (
                <ArchiveBlock
                  key={msg.id}
                  messageId={msg.id}
                  messages={msg.archiveData.messages}
                  timestamp={msg.timestamp}
                  isExpanded={msg.archiveData.isExpanded}
                  onToggleExpand={onToggleArchiveExpand || (() => {})}
                  onRestore={onRestoreArchive}
                  showTags={showTags}
                  isSelected={isMessageSelected(msg.id)}
                  selectionActive={selectionActive}
                  onToggleSelect={() => onToggleMessage(msg.id)}
                  onSelectFromHere={() => onSelectFromHere(idx)}
                  onCopyToClipboard={onCopyToClipboard}
                  onDeleteMessage={() => onDeleteMessages(msg.id)}
                  index={idx}
                />
              )
            }
            
            // Render Summary messages as SummaryBlock component
            if (msg.role === 'summary' && msg.summaryData) {
              return (
                <SummaryBlock
                  key={msg.id}
                  messageId={msg.id}
                  content={msg.content}
                  isExpanded={msg.summaryData.isExpanded}
                  model={msg.summaryData.model}
                  createdAt={msg.summaryData.createdAt}
                  inputTokens={msg.summaryData.inputTokens}
                  outputTokens={msg.summaryData.outputTokens}
                  onToggleExpand={onToggleSummaryExpand || (() => {})}
                  showTags={showTags}
                  isSelected={isMessageSelected(msg.id)}
                  selectionActive={selectionActive}
                  onToggleSelect={() => onToggleMessage(msg.id)}
                  onSelectFromHere={() => onSelectFromHere(idx)}
                  onCopyToClipboard={onCopyToClipboard}
                  onDeleteMessage={() => onDeleteMessages(msg.id)}
                  index={idx}
                />
              )
            }
            
            // Render Tool call messages as ToolCallBlock component
            if (msg.role === 'tool' && msg.toolCallData) {
              return (
                <ToolCallBlock
                  key={msg.id}
                  messageId={msg.id}
                  toolCallData={msg.toolCallData}
                  onToggleExpand={onToggleToolExpand || (() => {})}
                  onCreateDraft={onCreateDraft}
                />
              )
            }
            
            // Render Verify request messages as VerifyRequestBlock component
            if (msg.role === 'verify' && msg.verifyData) {
              return (
                <VerifyRequestBlock
                  key={msg.id}
                  messageId={msg.id}
                  answerToVerify={msg.verifyData.answerToVerify}
                  timestamp={msg.timestamp}
                  isExpanded={msg.verifyData.isExpanded}
                  onToggleExpand={onToggleVerifyExpand || (() => {})}
                  showTags={showTags}
                  isSelected={isMessageSelected(msg.id)}
                  selectionActive={selectionActive}
                  onToggleSelect={() => onToggleMessage(msg.id)}
                  onSelectFromHere={() => onSelectFromHere(idx)}
                  onCopyToClipboard={onCopyToClipboard}
                  onDeleteMessage={() => onDeleteMessages(msg.id)}
                  index={idx}
                />
              )
            }
            
            // Render Draft messages as DraftBlock component (in Chat B)
            if (msg.role === 'draft' && msg.draftData) {
              return (
                <DraftBlock
                  key={msg.id}
                  messageId={msg.id}
                  draftVersion={msg.draftData.draftVersion}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  isExpanded={msg.draftData.isExpanded}
                  onToggleExpand={onToggleDraftExpand || (() => {})}
                  showTags={showTags}
                  isSelected={isMessageSelected(msg.id)}
                  selectionActive={selectionActive}
                  onToggleSelect={() => onToggleMessage(msg.id)}
                  onSelectFromHere={() => onSelectFromHere(idx)}
                  onCopyToClipboard={onCopyToClipboard}
                  onDeleteMessage={() => onDeleteMessages(msg.id)}
                  index={idx}
                />
              )
            }
            
            // Render normal user/ai messages
            const isSelected = isMessageSelected(msg.id)
            return (
              <div 
                key={msg.id || idx} 
                id={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}
              >
                <div className={`relative max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-slate-800 text-white mr-2' 
                    : 'bg-slate-700 text-slate-100 ml-2'
                } ${isSelected ? 'ring-2 ring-yellow-600' : ''}`}>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                  
                  {/* Metadata Tags */}
                  {showTags && (msg.timestamp || msg.model || msg.id || (msg.role === 'ai' && (msg.inputTokens != null || msg.outputTokens != null))) && (
                    <div className={`mt-2 pt-2 border-t text-[10px] flex gap-2 flex-wrap items-center ${
                      msg.role === 'user' ? 'border-blue-500/30 text-blue-100' : 'border-slate-600 text-slate-400'
                    }`}>
                      {msg.timestamp && <span>🕒 {msg.timestamp}</span>}
                      {msg.model && <span>{msg.model}</span>}
                      {msg.role === 'ai' && (msg.inputTokens != null || msg.outputTokens != null) && (
                        <span>📊 {msg.inputTokens?.toLocaleString() ?? '?'} in / {msg.outputTokens?.toLocaleString() ?? '?'} out</span>
                      )}
                      {msg.id && <span className="opacity-50 text-[9px]">#{msg.id.slice(-8)}</span>}
                    </div>
                  )}

                  {/* Hover Action Toolbar */}
                  <div className="absolute -bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {deleteConfirmId !== msg.id ? (
                      <>
                        {/* Select Checkbox */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleMessage(msg.id)
                          }}
                          className={`p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 transition-colors active:scale-95 ${
                            isSelected ? 'text-yellow-600 border-yellow-600' : 'text-slate-300'
                          }`}
                          title={isSelected ? 'Deselect' : 'Select'}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isSelected ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            ) : (
                              <rect x="4" y="4" width="16" height="16" strokeWidth={2} rx="2" />
                            )}
                          </svg>
                        </button>

                        {/* Select from here */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectFromHere(idx)
                          }}
                          className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95"
                          title="Select from here (toggle)"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Copy */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (selectionActive) {
                              onCopyToClipboard()
                            } else {
                              // Copy single message
                              navigator.clipboard.writeText(`${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
                            }
                          }}
                          className={`p-1 rounded bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-300 transition-colors active:scale-95 ${
                            copySuccess ? 'ring-2 ring-green-500' : ''
                          }`}
                          title={selectionActive ? 'Copy all selected' : 'Copy this message'}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>

                        {/* Delete - First Click */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(msg.id)
                          }}
                          className="p-1 rounded bg-slate-800 border border-slate-600 hover:bg-red-900 text-slate-300 hover:text-white transition-colors active:scale-95"
                          title={selectionActive ? 'Delete all selected' : 'Delete this message'}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Confirm Delete - LEFT (requires mouse movement) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // If selection active, delete selection. Otherwise delete this single message.
                            if (selectionActive) {
                              onDeleteMessages()
                            } else {
                              onDeleteMessages(msg.id)
                            }
                            setDeleteConfirmId(null)
                          }}
                          className="px-2 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-medium transition-colors whitespace-nowrap active:scale-95"
                        >
                          ⚠️ Delete?
                        </button>
                        {/* Cancel - RIGHT (where mouse was) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(null)
                          }}
                          className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-[10px] transition-colors active:scale-95"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        
        {/* Live progress (Chat A) or typing indicator (summary / Chat B) */}
        {isAITyping && liveProgress && sessionRequired !== false ? (
          <LiveProgressBubble progress={liveProgress} />
        ) : (isAITyping || (isThinking && sessionRequired)) ? (
          <TypingIndicator
            label={isThinking && sessionRequired ? 'Creating summary' : 'AI generating'}
            variant="chat"
          />
        ) : null}
      </div>

      {/* Snap-to-Message Navigation */}
      {currentChat.length > 0 && !selectionActive && (
        <div className="absolute bottom-56 right-3 flex flex-col gap-1 z-10">
          <button
            onClick={() => {
              const container = document.getElementById('chat-container')
              if (container) container.scrollBy({ top: -300, behavior: 'smooth' })
            }}
            className="bg-slate-700 hover:bg-slate-600 text-slate-300 p-1 rounded shadow-lg border border-slate-600 text-xs"
            title="Scroll up"
          >
            ▲
          </button>
          <button
            onClick={() => {
              const container = document.getElementById('chat-container')
              if (container) container.scrollBy({ top: 300, behavior: 'smooth' })
            }}
            className="bg-slate-700 hover:bg-slate-600 text-slate-300 p-1 rounded shadow-lg border border-slate-600 text-xs"
            title="Scroll down"
          >
            ▼
          </button>
        </div>
      )}

      {/* COMMANDER BOX (Input + Toolbar) */}
      {(
        <div className="p-4 bg-slate-800 shrink-0 border-t border-slate-700">
          {/* Textarea */}
          <textarea
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => {
              // Allow send if session is not required (Chat B) OR session exists (Chat A)
              if (e.key === 'Enter' && !e.shiftKey && (!sessionRequired || currentSession)) {
                e.preventDefault()
                onSendMessage()
              }
            }}
            disabled={isAITyping || (sessionRequired && !currentSession)}
            placeholder={(sessionRequired && !currentSession) ? 'Create a session first...' : 'Write your message...'}
            rows={5}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-800 disabled:opacity-50 disabled:cursor-not-allowed resize-none mb-3"
          />
          
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Configuration */}
            <div className="flex items-center gap-2">
              {/* Model Selection */}
              <select
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {visibleModels.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>

              {/* Context Button - project-wide, always enabled */}
              <button
                onClick={onOpenContext}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  contextDrawerOpen
                    ? 'bg-blue-900 hover:bg-blue-800 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title="Context & documents"
              >
                Context
              </button>

              {/* Tool-Log Button - only for Chat A (sessionRequired=true) */}
              {sessionRequired && onOpenToolLog && (
                <button
                  onClick={onOpenToolLog}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    toolLogDrawerOpen
                      ? 'bg-blue-900 hover:bg-blue-800 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                  title="Show tool history"
                >
                  Tool-Log
                </button>
              )}

              {/* Tags Button */}
              <button
                onClick={onToggleTags}
                disabled={!currentSession}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showTags 
                    ? 'bg-blue-900 hover:bg-blue-800 text-white' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                } ${!currentSession ? 'opacity-30 cursor-not-allowed' : ''}`}
                title={showTags ? 'Hide metadata' : 'Show metadata'}
              >
                Tags
              </button>
            </div>

            {/* Center: Power Actions */}
            <div className="flex items-center gap-2">
              {/* Chat B: Show Transfer Feedback button instead of Summary/Verify */}
              {onTransferFeedback ? (
                <button
                  onClick={onTransferFeedback}
                  disabled={currentChat.length === 0}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    currentChat.length === 0
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-purple-700 hover:bg-purple-600 text-white'
                  }`}
                  title="Transfer insights as a feedback block to Chat A"
                >
                  Feedback →
                </button>
              ) : (
                <>
                  {/* Chat A: Summary button */}
                  <button
                    onClick={onKonsolidieren}
                    disabled={isThinking || (sessionRequired && !currentSession)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isThinking || (sessionRequired && !currentSession)
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    } ${showKonsolidierenSuccess ? 'ring-2 ring-green-500' : ''}`}
                    title="Consolidate session: create summary + update status + clean up chat"
                  >
                    {showKonsolidierenSuccess ? '✓ ' : ''}Summary
                  </button>

                  {/* Chat A: Verify button */}
                  {verifyConfirm ? (
                    // Confirmation Mode
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-orange-400">
                        ⚠️ Delete Chat B?
                      </span>
                      <button
                        onClick={onStartVerify}
                        className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] transition-colors"
                      >
                        Review
                      </button>
                      <button
                        onClick={onCancelVerify}
                        className="px-2 py-0.5 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-[10px] transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    // Normal Mode
                    <button
                      onClick={onStartVerify}
                      disabled={isThinking || (sessionRequired && !currentSession) || currentChat.length === 0}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isThinking || (sessionRequired && !currentSession) || currentChat.length === 0
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      }`}
                      title="Review last AI answer with another model (Verify mode)"
                    >
                      Review →
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Right: Send (optional based on settings) */}
            {showSendButton && (
              <button 
                onClick={onSendMessage}
                disabled={isAITyping || !chatInput.trim() || !currentSession}
                className="px-6 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                Send
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Test Fixtures for Chat-related tests
 */

import type { ChatRequest, ChatContext } from '../../services/chatService'

export const mockChatContext: ChatContext = {
  system_prompt: 'Test system prompt',
  documents: [
    {
      id: 'doc-1',
      title: 'Test Document',
      content: 'Test document content',
    },
  ],
  status_topics: [
    {
      id: 'status-1',
      title: 'Test Status',
      content: 'Test status content',
    },
  ],
}

export const mockChatRequest: ChatRequest = {
  message: 'Test message',
  context: mockChatContext,
  model: 'gemini-2.5-flash',
  sessionId: 'session-123',
  includeSummaries: [],
}

export const mockToolCallResponse = {
  content: 'I will create a status topic for you.',
  model: 'gemini-2.5-flash',
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
  cache_info: null,
  user_message_id: 'user-msg-123',
  ai_message_id: 'ai-msg-456',
  tool_calls: [
    {
      tool_name: 'create_status',
      arguments: {
        project_id: 'proj-123',
        title: 'Test Status',
        content: 'Test content',
        reason: 'Test reason',
      },
      result: {
        success: true,
        topic_id: 'status-1',
        title: 'Test Status',
      },
      action: null,
    },
  ],
  draft_data: null,
  edit_data_list: null,
}

export const mockDraftResponse = {
  content: 'I have created a draft for you.',
  model: 'gemini-2.5-flash',
  usage: {
    prompt_tokens: 120,
    completion_tokens: 60,
    total_tokens: 180,
  },
  cache_info: null,
  user_message_id: 'user-msg-123',
  ai_message_id: 'ai-msg-456',
  tool_calls: [
    {
      tool_name: 'create_draft',
      arguments: {
        title: 'Test Draft',
        content: 'Test draft content',
        reason: 'Test reason',
      },
      result: {
        success: true,
        draft: {
          title: 'Test Draft',
          content: 'Test draft content',
          reason: 'Test reason',
        },
        action: 'open_workshop',
      },
      action: 'open_workshop',
    },
  ],
  draft_data: {
    title: 'Test Draft',
    content: 'Test draft content',
    reason: 'Test reason',
  },
  edit_data_list: null,
}

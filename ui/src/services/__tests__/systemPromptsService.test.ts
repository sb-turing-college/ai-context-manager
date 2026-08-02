/**
 * System Prompts Service Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSystemPrompts,
  updateSystemPrompt,
  resetSystemPrompt,
  resetAllSystemPrompts,
  getPromptTypeLabel,
  getPromptTypeDescription,
} from '../systemPromptsService'
import { mockApiSuccess, mockApiError } from '../../test/mocks/apiMocks'

// NOTE: API_BASE (ui/src/config/api.ts) is evaluated once at module load
// time and defaults to http://127.0.0.1:8000 (deliberately IPv4, not
// "localhost", to avoid IPv4/IPv6 resolution mismatches against the
// backend's bind address). Assertions below target that real default.
describe('systemPromptsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSystemPrompts', () => {
    it('should fetch all system prompts', async () => {
      const mockPrompts = {
        prompts: [
          {
            type: 'summary',
            content: 'Summary prompt content',
            is_default: true,
            last_modified: '2024-01-01T10:00:00Z',
          },
          {
            type: 'verify',
            content: 'Verify prompt content',
            is_default: false,
            last_modified: '2024-01-01T11:00:00Z',
          },
          {
            type: 'audit',
            content: 'Audit prompt content',
            is_default: true,
            last_modified: '2024-01-01T12:00:00Z',
          },
        ],
      }

      const mockResponse = mockApiSuccess(mockPrompts)
      global.fetch = mockResponse

      const result = await getSystemPrompts()

      expect(result).toHaveLength(3)
      expect(result[0].type).toBe('summary')
      expect(result[0].is_default).toBe(true)
      expect(result[1].type).toBe('verify')
      expect(result[2].type).toBe('audit')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/settings/system-prompts',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      await expect(getSystemPrompts()).rejects.toThrow('Failed to fetch system prompts')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // Note: USE_API is evaluated at module load time, so we can't easily test this
    // without dynamic imports. Skipping for now as it's a configuration issue.
    it.skip('should throw error when USE_API is false', async () => {
      // This test would require dynamic imports to work properly
      // USE_API is evaluated at module load, not at runtime
    })
  })

  describe('updateSystemPrompt', () => {
    it('should update a system prompt', async () => {
      const mockUpdatedPrompt = {
        type: 'summary',
        content: 'Updated summary prompt',
        is_default: false,
        last_modified: '2024-01-01T13:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockUpdatedPrompt)
      global.fetch = mockResponse

      const result = await updateSystemPrompt('summary', 'Updated summary prompt')

      expect(result.type).toBe('summary')
      expect(result.content).toBe('Updated summary prompt')
      expect(result.is_default).toBe(false)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/settings/system-prompts/summary',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Updated summary prompt' }),
        })
      )
    })

    it('should handle update errors', async () => {
      const mockResponse = mockApiError('Update failed', 400)
      global.fetch = mockResponse

      await expect(updateSystemPrompt('summary', 'New content')).rejects.toThrow(
        'Failed to update system prompt'
      )
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it.skip('should throw error when USE_API is false', async () => {
      // USE_API is evaluated at module load time
    })
  })

  describe('resetSystemPrompt', () => {
    it('should reset a system prompt to default', async () => {
      const mockResetPrompt = {
        type: 'verify',
        content: 'Default verify prompt',
        is_default: true,
        last_modified: '2024-01-01T14:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockResetPrompt)
      global.fetch = mockResponse

      const result = await resetSystemPrompt('verify')

      expect(result.type).toBe('verify')
      expect(result.is_default).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/settings/system-prompts/verify/reset',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should handle reset errors', async () => {
      const mockResponse = mockApiError('Reset failed', 500)
      global.fetch = mockResponse

      await expect(resetSystemPrompt('audit')).rejects.toThrow('Failed to reset system prompt')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it.skip('should throw error when USE_API is false', async () => {
      // USE_API is evaluated at module load time
    })
  })

  describe('resetAllSystemPrompts', () => {
    it('should reset all system prompts', async () => {
      const mockResetPrompts = {
        prompts: [
          {
            type: 'summary',
            content: 'Default summary',
            is_default: true,
            last_modified: '2024-01-01T15:00:00Z',
          },
          {
            type: 'verify',
            content: 'Default verify',
            is_default: true,
            last_modified: '2024-01-01T15:00:00Z',
          },
          {
            type: 'audit',
            content: 'Default audit',
            is_default: true,
            last_modified: '2024-01-01T15:00:00Z',
          },
        ],
      }

      const mockResponse = mockApiSuccess(mockResetPrompts)
      global.fetch = mockResponse

      const result = await resetAllSystemPrompts()

      expect(result).toHaveLength(3)
      expect(result.every((p) => p.is_default)).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/settings/system-prompts/reset-all',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should handle reset all errors', async () => {
      const mockResponse = mockApiError('Reset all failed', 500)
      global.fetch = mockResponse

      await expect(resetAllSystemPrompts()).rejects.toThrow('Failed to reset all system prompts')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it.skip('should throw error when USE_API is false', async () => {
      // USE_API is evaluated at module load time
    })
  })

  describe('getPromptTypeLabel', () => {
    it('should return correct labels', () => {
      expect(getPromptTypeLabel('summary')).toBe('Summary')
      expect(getPromptTypeLabel('verify')).toBe('Verify (chat history reviewer)')
      expect(getPromptTypeLabel('audit')).toBe('Audit (draft reviewer)')
    })
  })

  describe('getPromptTypeDescription', () => {
    it('should return correct descriptions', () => {
      const summaryDesc = getPromptTypeDescription('summary')
      expect(summaryDesc).toContain('session summaries')

      const verifyDesc = getPromptTypeDescription('verify')
      expect(verifyDesc).toContain('chat history review')

      const auditDesc = getPromptTypeDescription('audit')
      expect(auditDesc).toContain('draft review')
    })
  })
})

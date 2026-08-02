/**
 * Draft Service Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getDraft,
  saveDraft,
  deleteDraft,
  type Draft,
  type DraftUpdate,
} from '../draftService'
import { mockApiSuccess, mockApiError } from '../../test/mocks/apiMocks'

// NOTE: API_BASE (ui/src/config/api.ts) is evaluated once at module load
// time and defaults to http://127.0.0.1:8000 (deliberately IPv4, not
// "localhost", to avoid IPv4/IPv6 resolution mismatches against the
// backend's bind address). Assertions below target that real default.
describe('draftService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDraft', () => {
    it('should fetch draft for a session', async () => {
      const mockDraft: Draft = {
        id: 'draft-1',
        session_id: 'session-123',
        title: 'Test Draft',
        content: 'Draft content here',
        history: [
          { version: 1, content: 'Initial content' },
          { version: 2, content: 'Draft content here' },
        ],
        current_version: 2,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T11:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockDraft)
      global.fetch = mockResponse

      const result = await getDraft('session-123')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('draft-1')
      expect(result?.title).toBe('Test Draft')
      expect(result?.content).toBe('Draft content here')
      expect(result?.current_version).toBe(2)
      expect(result?.history).toHaveLength(2)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-123/draft'
      )
    })

    it('should return null for 404', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)
      global.fetch = mockResponse

      const result = await getDraft('session-123')

      expect(result).toBeNull()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should return null for 204', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      } as Response)
      global.fetch = mockResponse

      const result = await getDraft('session-123')

      expect(result).toBeNull()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      await expect(getDraft('session-123')).rejects.toThrow('Failed to fetch draft')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('saveDraft', () => {
    it('should save a new draft', async () => {
      const mockDraft: Draft = {
        id: 'draft-1',
        session_id: 'session-123',
        title: 'New Draft',
        content: 'New content',
        history: [{ version: 1, content: 'New content' }],
        current_version: 1,
        created_at: '2024-01-01T12:00:00Z',
        updated_at: '2024-01-01T12:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockDraft)
      global.fetch = mockResponse

      const update: DraftUpdate = {
        title: 'New Draft',
        content: 'New content',
        history: [{ version: 1, content: 'New content' }],
        current_version: 1,
      }

      const result = await saveDraft('session-123', update)

      expect(result.id).toBe('draft-1')
      expect(result.title).toBe('New Draft')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-123/draft',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        })
      )
    })

    it('should update existing draft', async () => {
      const mockUpdatedDraft: Draft = {
        id: 'draft-1',
        session_id: 'session-123',
        title: 'Updated Draft',
        content: 'Updated content',
        history: [
          { version: 1, content: 'Initial' },
          { version: 2, content: 'Updated content' },
        ],
        current_version: 2,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T13:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockUpdatedDraft)
      global.fetch = mockResponse

      const update: DraftUpdate = {
        content: 'Updated content',
        current_version: 2,
      }

      const result = await saveDraft('session-123', update)

      expect(result.current_version).toBe(2)
      expect(result.content).toBe('Updated content')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle save errors', async () => {
      const mockResponse = mockApiError('Save failed', 500)
      global.fetch = mockResponse

      await expect(
        saveDraft('session-123', { content: 'Test' })
      ).rejects.toThrow('Failed to save draft')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteDraft', () => {
    it('should delete a draft', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await deleteDraft('session-123')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/sessions/session-123/draft',
        { method: 'DELETE' }
      )
    })

    it('should handle 404 gracefully', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)
      global.fetch = mockResponse

      // Should not throw on 404
      await expect(deleteDraft('session-123')).resolves.not.toThrow()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle other errors', async () => {
      const mockResponse = mockApiError('Delete failed', 500)
      global.fetch = mockResponse

      await expect(deleteDraft('session-123')).rejects.toThrow('Failed to delete draft')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

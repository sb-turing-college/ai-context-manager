/**
 * Status Service Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStatusTopics,
  createStatusTopic,
  updateStatusTopic,
  deleteStatusTopic,
  getStatusTopicHistory,
} from '../statusService'
import { mockApiSuccess, mockApiError } from '../../test/mocks/apiMocks'

// NOTE: API_BASE (ui/src/config/api.ts) is evaluated once at module load
// time and defaults to http://127.0.0.1:8000 (deliberately IPv4, not
// "localhost", to avoid IPv4/IPv6 resolution mismatches against the
// backend's bind address). Assertions below target that real default.
describe('statusService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getStatusTopics', () => {
    it('should fetch status topics for a project', async () => {
      const mockTopics = [
        {
          id: 'status-1',
          project_id: 'proj-123',
          title: 'Budget',
          content: '5000 EUR',
          order_index: 0,
          history: [],
        },
        {
          id: 'status-2',
          project_id: 'proj-123',
          title: 'Timeline',
          content: 'Q1 2024',
          order_index: 1,
          history: [],
        },
      ]

      const mockResponse = mockApiSuccess(mockTopics)
      global.fetch = mockResponse

      const result = await getStatusTopics('proj-123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('status-1')
      expect(result[0].title).toBe('Budget')
      expect(result[0].content).toBe('5000 EUR')
      expect(result[0].projectId).toBe('proj-123')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/projects/proj-123/status'
      )
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      await expect(getStatusTopics('proj-123')).rejects.toThrow('Failed to fetch status topics')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createStatusTopic', () => {
    it('should create a new status topic', async () => {
      const mockTopic = {
        id: 'status-new',
        project_id: 'proj-123',
        title: 'New Status',
        content: 'New content',
        order_index: 0,
        history: [],
      }

      const mockResponse = mockApiSuccess(mockTopic)
      global.fetch = mockResponse

      const result = await createStatusTopic('proj-123', 'New Status', 'New content')

      expect(result.id).toBe('status-new')
      expect(result.title).toBe('New Status')
      expect(result.content).toBe('New content')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/status',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: 'proj-123',
            title: 'New Status',
            content: 'New content',
          }),
        })
      )
    })

    it('should handle creation errors', async () => {
      const mockResponse = mockApiError('Creation failed', 400)
      global.fetch = mockResponse

      await expect(
        createStatusTopic('proj-123', 'New Status', 'New content')
      ).rejects.toThrow('Failed to create status topic')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateStatusTopic', () => {
    it('should update a status topic', async () => {
      const mockUpdatedTopic = {
        id: 'status-1',
        project_id: 'proj-123',
        title: 'Updated Status',
        content: 'Updated content',
        order_index: 0,
        history: [],
      }

      const mockResponse = mockApiSuccess(mockUpdatedTopic)
      global.fetch = mockResponse

      const result = await updateStatusTopic('status-1', {
        title: 'Updated Status',
        content: 'Updated content',
      })

      expect(result.title).toBe('Updated Status')
      expect(result.content).toBe('Updated content')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/status/status-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Updated Status',
            content: 'Updated content',
          }),
        })
      )
    })

    it('should update with reason', async () => {
      const mockUpdatedTopic = {
        id: 'status-1',
        project_id: 'proj-123',
        title: 'Status',
        content: 'New value',
        order_index: 0,
        history: [],
      }

      const mockResponse = mockApiSuccess(mockUpdatedTopic)
      global.fetch = mockResponse

      await updateStatusTopic('status-1', {
        content: 'New value',
        reason: 'User requested update',
      })

      const callArgs = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody.reason).toBe('User requested update')
    })

    it('should handle update errors', async () => {
      const mockResponse = mockApiError('Update failed', 404)
      global.fetch = mockResponse

      await expect(
        updateStatusTopic('status-1', { title: 'Updated' })
      ).rejects.toThrow('Failed to update status topic')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteStatusTopic', () => {
    it('should delete a status topic', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await deleteStatusTopic('status-1')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/status/status-1',
        { method: 'DELETE' }
      )
    })

    it('should handle delete errors', async () => {
      const mockResponse = mockApiError('Delete failed', 404)
      global.fetch = mockResponse

      await expect(deleteStatusTopic('status-1')).rejects.toThrow('Failed to delete status topic')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStatusTopicHistory', () => {
    it('should fetch status topic history', async () => {
      const mockHistory = [
        {
          version: 1,
          content: 'Old content',
          timestamp: '2024-01-01T10:00:00Z',
        },
        {
          version: 2,
          content: 'New content',
          timestamp: '2024-01-01T11:00:00Z',
        },
      ]

      const mockResponse = mockApiSuccess(mockHistory)
      global.fetch = mockResponse

      const result = await getStatusTopicHistory('status-1')

      expect(result).toHaveLength(2)
      expect(result[0].version).toBe(1)
      expect(result[1].version).toBe(2)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/status/status-1/history'
      )
    })

    it('should handle history fetch errors', async () => {
      const mockResponse = mockApiError('History fetch failed', 500)
      global.fetch = mockResponse

      await expect(getStatusTopicHistory('status-1')).rejects.toThrow(
        'Failed to fetch status topic history'
      )
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

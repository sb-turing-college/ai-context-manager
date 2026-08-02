/**
 * Project Service Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../projectService'
import { mockApiSuccess, mockApiError } from '../../test/mocks/apiMocks'

// NOTE: API_BASE (ui/src/config/api.ts) is evaluated once at module load
// time and defaults to http://127.0.0.1:8000 (deliberately IPv4, not
// "localhost", to avoid IPv4/IPv6 resolution mismatches against the
// backend's bind address). Assertions below target that real default.
describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProjects', () => {
    it('should fetch all projects', async () => {
      const mockProjects = [
        {
          id: 'proj-1',
          title: 'Project 1',
          session_count: 3,
          updated_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'proj-2',
          title: 'Project 2',
          session_count: 5,
          updated_at: '2024-01-01T11:00:00Z',
        },
      ]

      const mockResponse = mockApiSuccess(mockProjects)
      global.fetch = mockResponse

      const result = await getProjects()

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('proj-1')
      expect(result[0].title).toBe('Project 1')
      expect(result[0].sessionCount).toBe(3)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/projects'
      )
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      await expect(getProjects()).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createProject', () => {
    it('should create a new project', async () => {
      const mockProject = {
        id: 'proj-new',
        title: 'New Project',
        session_count: 0,
        updated_at: new Date().toISOString(),
      }

      const mockResponse = mockApiSuccess(mockProject)
      global.fetch = mockResponse

      const result = await createProject('New Project')

      expect(result.id).toBe('proj-new')
      expect(result.title).toBe('New Project')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/projects',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Project' }),
        })
      )
    })

    it('should handle creation errors', async () => {
      const mockResponse = mockApiError('Creation failed', 400)
      global.fetch = mockResponse

      await expect(createProject('New Project')).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateProject', () => {
    it('should update a project', async () => {
      const mockUpdatedProject = {
        id: 'proj-1',
        title: 'Updated Project',
        session_count: 3,
        updated_at: new Date().toISOString(),
      }

      const mockResponse = mockApiSuccess(mockUpdatedProject)
      global.fetch = mockResponse

      const result = await updateProject('proj-1', { title: 'Updated Project' })

      expect(result?.title).toBe('Updated Project')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/projects/proj-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated Project' }),
        })
      )
    })

    it('should return null for 404', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)
      global.fetch = mockResponse

      const result = await updateProject('proj-999', { title: 'Updated' })

      expect(result).toBeNull()
    })

    it('should handle update errors', async () => {
      const mockResponse = mockApiError('Update failed', 500)
      global.fetch = mockResponse

      await expect(updateProject('proj-1', { title: 'Updated' })).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteProject', () => {
    it('should delete a project', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      } as Response)
      global.fetch = mockResponse

      const result = await deleteProject('proj-1')

      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/projects/proj-1',
        { method: 'DELETE' }
      )
    })

    it('should return false for 404', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response)
      global.fetch = mockResponse

      const result = await deleteProject('proj-999')

      expect(result).toBe(false)
    })

    it('should handle delete errors', async () => {
      const mockResponse = mockApiError('Delete failed', 500)
      global.fetch = mockResponse

      await expect(deleteProject('proj-1')).rejects.toThrow('API error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

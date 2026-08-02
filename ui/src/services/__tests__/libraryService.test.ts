/**
 * Library Service Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getLibraryItems,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  moveItemToFolder,
  getItemHistory,
  getLibraryFolders,
  createFolder,
  renameFolder,
  deleteFolder,
} from '../libraryService'
import { mockApiSuccess, mockApiError } from '../../test/mocks/apiMocks'

// NOTE: API_BASE (ui/src/config/api.ts) is evaluated once at module load
// time and defaults to http://127.0.0.1:8000 (deliberately IPv4, not
// "localhost", to avoid IPv4/IPv6 resolution mismatches against the
// backend's bind address). Assertions below target that real default.
describe('libraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getLibraryItems', () => {
    it('should fetch library items for a project', async () => {
      const mockItems = [
        {
          id: 'item-1',
          project_id: 'proj-123',
          folder_id: null,
          title: 'Document 1',
          content: 'Content 1',
          item_type: 'markdown',
          version: 1,
          history: [],
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'item-2',
          project_id: 'proj-123',
          folder_id: 'folder-1',
          title: 'Document 2',
          content: 'Content 2',
          item_type: 'markdown',
          version: 1,
          history: [],
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:00:00Z',
        },
      ]

      const mockResponse = mockApiSuccess(mockItems)
      global.fetch = mockResponse

      const result = await getLibraryItems('proj-123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('item-1')
      expect(result[0].title).toBe('Document 1')
      expect(result[0].type).toBe('markdown')
      expect(result[0].projectId).toBe('proj-123')
      expect(result[1].folderId).toBe('folder-1')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/projects/proj-123/library/items'
      )
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      await expect(getLibraryItems('proj-123')).rejects.toThrow('Failed to fetch library items')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createLibraryItem', () => {
    it('should create a new library item', async () => {
      const mockItem = {
        id: 'item-new',
        project_id: 'proj-123',
        folder_id: null,
        title: 'New Document',
        content: 'New content',
        item_type: 'markdown',
        version: 1,
        history: [],
        created_at: '2024-01-01T12:00:00Z',
        updated_at: '2024-01-01T12:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockItem)
      global.fetch = mockResponse

      const result = await createLibraryItem({
        projectId: 'proj-123',
        folderId: null,
        title: 'New Document',
        content: 'New content',
        type: 'markdown',
        version: 1,
        history: [],
        timestamp: '',
      })

      expect(result.id).toBe('item-new')
      expect(result.title).toBe('New Document')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/library/items',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: 'proj-123',
            folder_id: null,
            title: 'New Document',
            content: 'New content',
            item_type: 'markdown',
          }),
        })
      )
    })

    it('should handle creation errors', async () => {
      const mockResponse = mockApiError('Creation failed', 400)
      global.fetch = mockResponse

      await expect(
        createLibraryItem({
          projectId: 'proj-123',
          folderId: null,
          title: 'New Document',
          content: 'Content',
          type: 'markdown',
          version: 1,
          history: [],
          timestamp: '',
        })
      ).rejects.toThrow('Failed to create library item')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateLibraryItem', () => {
    it('should update a library item', async () => {
      const mockUpdatedItem = {
        id: 'item-1',
        project_id: 'proj-123',
        folder_id: null,
        title: 'Updated Document',
        content: 'Updated content',
        item_type: 'markdown',
        version: 2,
        history: [],
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T13:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockUpdatedItem)
      global.fetch = mockResponse

      const result = await updateLibraryItem('item-1', {
        title: 'Updated Document',
        content: 'Updated content',
      })

      expect(result.title).toBe('Updated Document')
      expect(result.content).toBe('Updated content')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/library/items/item-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should update folder assignment', async () => {
      const mockUpdatedItem = {
        id: 'item-1',
        project_id: 'proj-123',
        folder_id: 'folder-1',
        title: 'Document',
        content: 'Content',
        item_type: 'markdown',
        version: 1,
        history: [],
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T13:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockUpdatedItem)
      global.fetch = mockResponse

      await updateLibraryItem('item-1', { folderId: 'folder-1' })

      const callArgs = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody.folder_id).toBe('folder-1')
    })

    it('should handle update errors', async () => {
      const mockResponse = mockApiError('Update failed', 404)
      global.fetch = mockResponse

      await expect(updateLibraryItem('item-1', { title: 'Updated' })).rejects.toThrow(
        'Failed to update library item'
      )
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteLibraryItem', () => {
    it('should delete a library item', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await deleteLibraryItem('item-1')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/library/items/item-1',
        { method: 'DELETE' }
      )
    })

    it('should handle delete errors', async () => {
      const mockResponse = mockApiError('Delete failed', 404)
      global.fetch = mockResponse

      await expect(deleteLibraryItem('item-1')).rejects.toThrow('Failed to delete library item')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('moveItemToFolder', () => {
    it('should move item to folder', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await moveItemToFolder('item-1', 'folder-1')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/library/items/item-1/move',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_id: 'folder-1' }),
        })
      )
    })

    it('should move item to root (null folder)', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await moveItemToFolder('item-1', null)

      const callArgs = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody.folder_id).toBeNull()
    })

    it('should handle move errors', async () => {
      const mockResponse = mockApiError('Move failed', 400)
      global.fetch = mockResponse

      await expect(moveItemToFolder('item-1', 'folder-1')).rejects.toThrow(
        'Failed to move library item'
      )
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getItemHistory', () => {
    it('should fetch item history', async () => {
      const mockHistory = [
        {
          version: 1,
          content: 'Version 1',
          timestamp: '2024-01-01T10:00:00Z',
        },
        {
          version: 2,
          content: 'Version 2',
          timestamp: '2024-01-01T11:00:00Z',
        },
      ]

      const mockResponse = mockApiSuccess(mockHistory)
      global.fetch = mockResponse

      const result = await getItemHistory('item-1')

      expect(result).toHaveLength(2)
      expect(result[0].version).toBe(1)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/library/items/item-1/history'
      )
    })

    it('should handle history fetch errors', async () => {
      const mockResponse = mockApiError('History fetch failed', 500)
      global.fetch = mockResponse

      await expect(getItemHistory('item-1')).rejects.toThrow('Failed to fetch item history')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getLibraryFolders', () => {
    it('should fetch library folders for a project', async () => {
      const mockFolders = [
        {
          id: 'folder-1',
          project_id: 'proj-123',
          parent_id: null,
          name: 'Folder 1',
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 'folder-2',
          project_id: 'proj-123',
          parent_id: 'folder-1',
          name: 'Subfolder',
          created_at: '2024-01-01T11:00:00Z',
        },
      ]

      const mockResponse = mockApiSuccess(mockFolders)
      global.fetch = mockResponse

      const result = await getLibraryFolders('proj-123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('folder-1')
      expect(result[0].name).toBe('Folder 1')
      expect(result[1].parentId).toBe('folder-1')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/projects/proj-123/library/folders'
      )
    })

    it('should handle API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      await expect(getLibraryFolders('proj-123')).rejects.toThrow('Failed to fetch library folders')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createFolder', () => {
    it('should create a new folder', async () => {
      const mockFolder = {
        id: 'folder-new',
        project_id: 'proj-123',
        parent_id: null,
        name: 'New Folder',
        created_at: '2024-01-01T12:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockFolder)
      global.fetch = mockResponse

      const result = await createFolder('New Folder', 'proj-123')

      expect(result.id).toBe('folder-new')
      expect(result.name).toBe('New Folder')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/library/folders',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: 'proj-123',
            parent_id: null,
            name: 'New Folder',
          }),
        })
      )
    })

    it('should create subfolder with parent_id', async () => {
      const mockFolder = {
        id: 'folder-new',
        project_id: 'proj-123',
        parent_id: 'folder-1',
        name: 'Subfolder',
        created_at: '2024-01-01T12:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockFolder)
      global.fetch = mockResponse

      await createFolder('Subfolder', 'proj-123', 'folder-1')

      const callArgs = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)

      expect(requestBody.parent_id).toBe('folder-1')
    })

    it('should handle creation errors', async () => {
      const mockResponse = mockApiError('Creation failed', 400)
      global.fetch = mockResponse

      await expect(createFolder('New Folder', 'proj-123')).rejects.toThrow(
        'Failed to create folder'
      )
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('renameFolder', () => {
    it('should rename a folder', async () => {
      const mockRenamedFolder = {
        id: 'folder-1',
        project_id: 'proj-123',
        parent_id: null,
        name: 'Renamed Folder',
        created_at: '2024-01-01T10:00:00Z',
      }

      const mockResponse = mockApiSuccess(mockRenamedFolder)
      global.fetch = mockResponse

      const result = await renameFolder('folder-1', 'Renamed Folder')

      expect(result.name).toBe('Renamed Folder')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/library/folders/folder-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Renamed Folder' }),
        })
      )
    })

    it('should handle rename errors', async () => {
      const mockResponse = mockApiError('Rename failed', 404)
      global.fetch = mockResponse

      await expect(renameFolder('folder-1', 'New Name')).rejects.toThrow('Failed to rename folder')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteFolder', () => {
    it('should delete a folder', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await deleteFolder('folder-1')

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/library/folders/folder-1',
        { method: 'DELETE' }
      )
    })

    it('should handle delete errors', async () => {
      const mockResponse = mockApiError('Delete failed', 404)
      global.fetch = mockResponse

      await expect(deleteFolder('folder-1')).rejects.toThrow('Failed to delete folder')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

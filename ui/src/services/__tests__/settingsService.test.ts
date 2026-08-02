/**
 * Settings Service Tests
 * 
 * CRITICAL RULES:
 * 1. NEVER modify production code for tests
 * 2. NEVER write to production database (app.db)
 * 3. NEVER make real API calls to AI providers (costs!) - all calls are mocked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAppSettings,
  updateAppSettings,
  getToolUseSettings,
  saveToolUseSettings,
} from '../settingsService'
import { mockApiSuccess, mockApiError } from '../../test/mocks/apiMocks'

// NOTE: API_BASE (ui/src/config/api.ts) is evaluated once at module load
// time and defaults to http://127.0.0.1:8000 (deliberately IPv4, not
// "localhost", to avoid IPv4/IPv6 resolution mismatches against the
// backend's bind address). Assertions below target that real default.
describe('settingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAppSettings', () => {
    it('should fetch app settings', async () => {
      const mockSettings = {
        font_size: 16,
        animations_enabled: true,
        summary_trigger_mode: 'manual',
      }

      const mockResponse = mockApiSuccess(mockSettings)
      global.fetch = mockResponse

      const result = await getAppSettings()

      expect(result.fontSize).toBe(16)
      expect(result.animationsEnabled).toBe(true)
      expect(result.summaryTriggerMode).toBe('manual')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/settings'
      )
    })

    it('should fallback to localStorage on API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      // Service falls back to localStorage, doesn't throw
      const result = await getAppSettings()
      
      // Should return default values from localStorage
      expect(result).toBeDefined()
      expect(result.fontSize).toBeDefined()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateAppSettings', () => {
    it('should update app settings', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      await updateAppSettings({
        fontSize: 18,
        animationsEnabled: false,
      })

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/settings',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            font_size: 18,
            animations_enabled: false,
          }),
        })
      )
    })

    it('should fallback to localStorage on update errors', async () => {
      const mockResponse = mockApiError('Update failed', 500)
      global.fetch = mockResponse

      // Service falls back to localStorage, doesn't throw
      await expect(updateAppSettings({ fontSize: 18 })).resolves.not.toThrow()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getToolUseSettings', () => {
    it('should fetch tool use settings', async () => {
      const mockSettings = {
        auto_confirm: false,
        enabled_tools: {
          create_status: true,
          read_status: true,
          update_status: true,
          delete_status: false,
          search_documents: true,
          read_document: true,
          create_draft: true,
        },
      }

      const mockResponse = mockApiSuccess(mockSettings)
      global.fetch = mockResponse

      const result = await getToolUseSettings()

      // Service uses auto_check_mode from API or defaults to 'always'
      expect(result.autoCheckMode).toBe('always')
      expect(result.enabledTools.create_status).toBe(true)
      expect(result.enabledTools.delete_status).toBe(false)
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/settings/tool-use'
      )
    })

    it('should fallback to localStorage on API errors', async () => {
      const mockResponse = mockApiError('Failed to fetch', 500)
      global.fetch = mockResponse

      // Service falls back to localStorage, doesn't throw
      const result = await getToolUseSettings()
      
      // Should return default values from localStorage
      expect(result).toBeDefined()
      expect(result.autoCheckMode).toBeDefined()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('saveToolUseSettings', () => {
    it('should save tool use settings', async () => {
      const mockResponse = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response)
      global.fetch = mockResponse

      const settings = {
        autoCheckMode: 'always' as const,
        enabledTools: {
          create_status: true,
          read_status: true,
          update_status: true,
          delete_status: false,
          search_documents: true,
          read_document: true,
          create_draft: true,
        },
      }

      await saveToolUseSettings(settings)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/settings/tool-use',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auto_confirm: false,
            enabled_tools: settings.enabledTools,
          }),
        })
      )
    })

    it('should fallback to localStorage on save errors', async () => {
      const mockResponse = mockApiError('Save failed', 500)
      global.fetch = mockResponse

      // Service falls back to localStorage, doesn't throw
      await expect(
        saveToolUseSettings({
          autoCheckMode: 'ai_decides',
          enabledTools: {
            create_status: true,
            read_status: true,
            update_status: true,
            delete_status: false,
            search_documents: true,
            read_document: true,
            create_draft: true,
          },
        })
      ).resolves.not.toThrow()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })
})

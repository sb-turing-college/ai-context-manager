import { useState, useCallback, useMemo } from 'react'
import type { VersionEntry } from '../types'

/**
 * Generic hook for managing version history
 * 
 * Used in:
 * - Workshop (artifact versions)
 * - Library items (document versions)
 * - Tool call blocks (status update versions)
 * 
 * @param initialHistory - Initial version entries
 * @param initialVersion - Starting version number (default: latest)
 */
export function useVersionHistory<T = string>(
  initialHistory: VersionEntry<T>[] = [],
  initialVersion?: number
) {
  const [history, setHistory] = useState<VersionEntry<T>[]>(initialHistory)
  const [currentVersion, setCurrentVersion] = useState(
    initialVersion ?? (initialHistory.length || 1)
  )
  const [showDiff, setShowDiff] = useState(false)

  // Computed values
  const totalVersions = history.length
  const isAtLatest = currentVersion === totalVersions
  const isAtFirst = currentVersion === 1
  const hasPreviousVersion = currentVersion > 1
  const hasMultipleVersions = totalVersions > 1

  // Get content for a specific version
  const getContent = useCallback((version: number): T | undefined => {
    const entry = history[version - 1]
    return entry?.content
  }, [history])

  // Get current content
  const currentContent = useMemo(() => {
    return getContent(currentVersion)
  }, [getContent, currentVersion])

  // Get previous content (for diff)
  const previousContent = useMemo(() => {
    if (currentVersion <= 1) return undefined
    return getContent(currentVersion - 1)
  }, [getContent, currentVersion])

  // Navigate to previous version
  const goToPrevious = useCallback(() => {
    if (currentVersion > 1) {
      setCurrentVersion(prev => prev - 1)
    }
  }, [currentVersion])

  // Navigate to next version
  const goToNext = useCallback(() => {
    if (currentVersion < totalVersions) {
      setCurrentVersion(prev => prev + 1)
    }
  }, [currentVersion, totalVersions])

  // Jump to specific version
  const goToVersion = useCallback((version: number) => {
    if (version >= 1 && version <= totalVersions) {
      setCurrentVersion(version)
    }
  }, [totalVersions])

  // Jump to latest version
  const goToLatest = useCallback(() => {
    setCurrentVersion(totalVersions)
  }, [totalVersions])

  // Add new version
  const addVersion = useCallback((content: T, timestamp?: string) => {
    const newVersion = totalVersions + 1
    const newEntry: VersionEntry<T> = {
      version: newVersion,
      content,
      timestamp: timestamp ?? new Date().toISOString()
    }
    setHistory(prev => [...prev, newEntry])
    setCurrentVersion(newVersion)
    return newVersion
  }, [totalVersions])

  // Update current version content (only if at latest)
  const updateCurrentContent = useCallback((content: T) => {
    if (!isAtLatest) return false
    
    setHistory(prev => {
      const updated = [...prev]
      if (updated[currentVersion - 1]) {
        updated[currentVersion - 1] = {
          ...updated[currentVersion - 1],
          content
        }
      }
      return updated
    })
    return true
  }, [currentVersion, isAtLatest])

  // Delete current version (if more than one exists)
  const deleteCurrentVersion = useCallback(() => {
    if (totalVersions <= 1) return false
    
    setHistory(prev => {
      const filtered = prev.filter((_, idx) => idx !== currentVersion - 1)
      // Reindex versions
      return filtered.map((entry, idx) => ({
        ...entry,
        version: idx + 1
      }))
    })
    
    // Jump to previous or stay at same index
    setCurrentVersion(prev => Math.min(prev, totalVersions - 1))
    return true
  }, [currentVersion, totalVersions])

  // Reset history
  const resetHistory = useCallback((newHistory: VersionEntry<T>[]) => {
    setHistory(newHistory)
    setCurrentVersion(newHistory.length || 1)
    setShowDiff(false)
  }, [])

  // Toggle diff view
  const toggleDiff = useCallback(() => {
    setShowDiff(prev => !prev)
  }, [])

  return {
    // State
    history,
    currentVersion,
    totalVersions,
    showDiff,
    
    // Computed
    currentContent,
    previousContent,
    isAtLatest,
    isAtFirst,
    hasPreviousVersion,
    hasMultipleVersions,
    
    // Navigation
    goToPrevious,
    goToNext,
    goToVersion,
    goToLatest,
    
    // Mutations
    addVersion,
    updateCurrentContent,
    deleteCurrentVersion,
    resetHistory,
    
    // UI
    toggleDiff,
    setShowDiff,
    
    // Direct access (for advanced use cases)
    setHistory,
    setCurrentVersion,
    getContent
  }
}

export type UseVersionHistoryReturn<T = string> = ReturnType<typeof useVersionHistory<T>>

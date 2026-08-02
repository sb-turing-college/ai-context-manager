/**
 * Service Layer - Abstraction for Backend Communication
 * 
 * This layer provides a clean interface between the UI and data sources.
 * Currently all services use localStorage. When the backend is ready,
 * only these service files need to be updated - the rest of the app
 * continues to work without changes.
 * 
 * Migration Strategy:
 * 1. Keep sync versions for immediate UI updates (optimistic updates)
 * 2. Call async API versions for actual persistence
 * 3. Handle errors and rollbacks when API calls fail
 */

export * from './projectService'
export * from './sessionService'
export * from './libraryService'
export * from './chatService'
export * from './settingsService'
export * from './toolService'

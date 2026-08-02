/**
 * Type declarations for Vitest test environment
 * 
 * Extends global types to support test mocking with global.fetch and global.localStorage
 * 
 * In jsdom test environments, 'global' is available as an alias for globalThis.
 * This declaration makes TypeScript aware of it.
 */

import type { Mock } from 'vitest'

// Declare 'global' variable for test environment (jsdom)
// TypeScript doesn't know about 'global' in jsdom, so we declare it here
declare global {
  // eslint-disable-next-line no-var
  var global: {
    fetch: Mock<Parameters<typeof fetch>, ReturnType<typeof fetch>>
    localStorage: Storage
  } & typeof globalThis
}

export {}

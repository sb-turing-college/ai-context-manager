/**
 * Backend API access (portfolio path).
 *
 * API mode is always on — no VITE_USE_API toggle / no ui/.env required.
 * Optional override: set VITE_API_URL in ui/.env (Docker / non-default host).
 */

export const USE_API = true

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

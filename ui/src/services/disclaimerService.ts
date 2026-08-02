/**
 * Disclaimer / API-terms acceptance API helpers.
 */

import { API_BASE } from '../config/api'

export async function fetchDisclaimerStatus(): Promise<{ accepted: boolean }> {
  const response = await fetch(`${API_BASE}/api/v1/disclaimer/status`)
  if (!response.ok) {
    throw new Error(`Disclaimer status failed (${response.status})`)
  }
  return response.json()
}

export async function acceptDisclaimer(): Promise<{ accepted: boolean }> {
  const response = await fetch(`${API_BASE}/api/v1/disclaimer/accept`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Disclaimer accept failed (${response.status})`)
  }
  return response.json()
}

export const DISCLAIMER_DOC_URL = `${API_BASE}/api/v1/disclaimer/doc`

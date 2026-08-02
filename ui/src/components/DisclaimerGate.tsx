import { useEffect, useState, type ReactNode } from 'react'
import { fetchDisclaimerStatus } from '../services/disclaimerService'
import { DisclaimerModal } from './DisclaimerModal'

export const DISCLAIMER_STORAGE_KEY = 'acs_disclaimer_accepted_v1'

interface DisclaimerGateProps {
  children: ReactNode
}

/**
 * Blocks the app until disclaimer/API terms are accepted (server-enforced too).
 * Always runs in the portfolio path (API mode). Capstone-style: status is
 * re-checked against the backend on every load.
 */
export function DisclaimerGate({ children }: DisclaimerGateProps) {
  const [checking, setChecking] = useState(true)
  const [accepted, setAccepted] = useState(
    () => window.localStorage.getItem(DISCLAIMER_STORAGE_KEY) === '1',
  )

  useEffect(() => {
    let cancelled = false

    void fetchDisclaimerStatus()
      .then(({ accepted: isAccepted }) => {
        if (cancelled) return
        if (isAccepted) {
          window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, '1')
          setAccepted(true)
        } else {
          window.localStorage.removeItem(DISCLAIMER_STORAGE_KEY)
          setAccepted(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          window.localStorage.removeItem(DISCLAIMER_STORAGE_KEY)
          setAccepted(false)
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleAccepted = () => {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, '1')
    setAccepted(true)
  }

  if (checking && !accepted) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-950 text-sm text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <>
      {children}
      {!accepted ? <DisclaimerModal onAccepted={handleAccepted} /> : null}
    </>
  )
}

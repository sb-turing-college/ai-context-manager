import { useState } from 'react'
import { acceptDisclaimer, DISCLAIMER_DOC_URL } from '../services/disclaimerService'

interface DisclaimerModalProps {
  onAccepted: () => void
}

export function DisclaimerModal({ onAccepted }: DisclaimerModalProps) {
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAccept = async () => {
    setAccepting(true)
    setError(null)
    try {
      await acceptDisclaimer()
      onAccepted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept disclaimer')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-600 bg-slate-900 p-6 shadow-xl">
        <h2 id="disclaimer-title" className="mb-3 text-lg font-semibold text-slate-100">
          Before using LLM features
        </h2>
        <div className="mb-4 space-y-2 text-sm leading-relaxed text-slate-300">
          <p>
            AI Context Manager calls <strong className="text-slate-100">third-party LLM APIs</strong>{' '}
            (e.g. Google Gemini, Anthropic Claude). That can incur{' '}
            <strong className="text-slate-100">token costs</strong> on your accounts.
          </p>
          <p>
            Outputs may be wrong or incomplete. There is{' '}
            <strong className="text-slate-100">no warranty</strong>. Provider terms of service apply.
            Optional Mistral moderation (if configured) is best-effort only.
          </p>
          <p>
            This is a <strong className="text-slate-100">local single-operator</strong> portfolio demo —
            not a multi-tenant commercial service.
          </p>
          <p>
            Read the full{' '}
            <a
              href={DISCLAIMER_DOC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline hover:text-blue-300"
            >
              disclaimer &amp; API terms
            </a>{' '}
            before accepting.
          </p>
        </div>
        {error ? (
          <p className="mb-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            onClick={() => void handleAccept()}
            disabled={accepting}
          >
            {accepting ? 'Accepting…' : 'I accept — enable LLM API calls'}
          </button>
        </div>
      </div>
    </div>
  )
}

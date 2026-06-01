'use client'

// One-click print trigger. Previously opened a modal with stop checkboxes,
// copies field, journal-override radios, preview/download buttons —
// every option has been removed. Clicking the button now POSTs to the
// print-pdf route with no body and triggers a browser download of the
// resulting PDF directly.

import { useState } from 'react'
import { downloadPrintPdf } from '@/lib/print/download'

interface Props {
  passport: {
    id: string
    title: string
    institution_id: string | null
  }
  /** Compact icon-button variant for card footers and toolbars. */
  compact?: boolean
}

const PrinterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
)

export function PrintPassportButton({ passport, compact = false }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (pending) return
    setPending(true)
    setError(null)
    const result = await downloadPrintPdf(passport.id, passport.title)
    if (!result.ok) setError(result.error)
    setPending(false)
  }

  return (
    <div className="relative inline-block">
      {compact ? (
        <button
          onClick={handleClick}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-panel border border-hairline px-2.5 py-1.5 text-xs font-medium text-muted hover:border-green hover:text-green transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        >
          <PrinterIcon />
          {pending ? 'Generating…' : 'Print'}
        </button>
      ) : (
        <button
          onClick={handleClick}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-panel border border-hairline bg-paper py-2 text-sm font-medium text-navy hover:border-green hover:bg-cream hover:text-green transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
        >
          <PrinterIcon />
          {pending ? 'Generating…' : 'Print for kids'}
        </button>
      )}
      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full z-10 mt-1 w-64 rounded-panel border border-accent/30 bg-white px-3 py-2 text-xs text-accent shadow-md"
        >
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  )
}

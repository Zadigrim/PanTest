'use client'

// Download-PDF button for the Explore detail page. Rendered ONLY by
// the server page when (loggedIn && isPublished && priceCents === 0).
// All three gates are enforced server-side too: the print-pdf route
// independently checks is_published and price_cents before returning
// a buffer. This component is a UX surface — it doesn't grant access.

import { useState } from 'react'
import { downloadPrintPdf } from '@/lib/print/download'
import { cn } from '@/lib/cn'

interface Props {
  passportId: string
  title:      string
}

export function DownloadFreePdfButton({ passportId, title }: Props) {
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (busy) return
          setBusy(true)
          setError(null)
          const r = await downloadPrintPdf(passportId, title)
          if (!r.ok) setError(r.error)
          setBusy(false)
        }}
        className={cn(
          'inline-flex h-11 items-center justify-center gap-2 rounded-panel px-6 text-sm font-semibold',
          'border border-green text-green hover:bg-green hover:text-white',
          'transition-colors disabled:pointer-events-none disabled:opacity-60',
        )}
      >
        {busy ? 'Generating…' : '🖨 Download printable PDF'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-accent">
          {error}{' '}
          <button type="button" onClick={() => setError(null)} className="underline">
            dismiss
          </button>
        </p>
      )}
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Program route error boundary. Catches any uncaught error in the
 * server render OR a client child (EmployeesPanel / PrizesPanel —
 * those are `'use client'` and can throw at hydration). Surfaces
 * the message + digest so Nathan can see something actionable
 * instead of the framework's generic "Application error … see
 * server logs" page. The digest is the same identifier Next.js
 * shows on the generic page; correlating it here helps trace the
 * underlying server log entry.
 */
export default function ProgramError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to the browser console so Nathan can copy-paste the
    // full stack when reporting. Server already logs at console.error.
    console.error('[program error.tsx]', error)
  }, [error])

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-[20px] font-bold text-red">Program couldn’t load</h1>
      <p className="mt-1 text-[12.5px] text-muted">
        The page hit an error rendering this surface. The rest of the app is fine.
      </p>
      <div className="mt-4 rounded-[8px] border border-red bg-red/[0.06] p-4">
        <p className="text-[11px] font-medium uppercase text-red" style={{ letterSpacing: '1.3px' }}>
          Message
        </p>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[12px] text-ink">
          {error.message || '(no message)'}
        </pre>
        {error.digest && (
          <>
            <p className="mt-3 text-[11px] font-medium uppercase text-red" style={{ letterSpacing: '1.3px' }}>
              Digest
            </p>
            <pre className="mt-1 text-[11px] text-muted">{error.digest}</pre>
          </>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-[6px] border-[1.5px] border-ink bg-white px-4 h-9 text-[13px] font-medium text-ink hover:bg-cream"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-[6px] border-[1.5px] border-ink bg-green px-4 h-9 inline-flex items-center text-[13px] font-semibold text-white"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}

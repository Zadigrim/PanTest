'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Paste-an-ID form for the admin inspection capability. The route
 * gate is already applied by the server component; this just
 * collects the UUID and navigates to /access/inspect/[id]. The
 * inspection page itself does the audit-log INSERT.
 */
export function InspectLanding() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = value.trim().toLowerCase()
    if (!UUID_RE.test(v)) {
      setError('Enter a valid passport UUID')
      return
    }
    setError(null)
    router.push(`/access/inspect/${v}`)
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[3px] text-muted">Admin</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Inspect passport</h1>
        <p className="mt-2 text-sm text-muted">
          Open any passport — published or draft, any creator — in a read-only view for
          content-safety review. Every inspection of another creator&apos;s content is logged
          (you, them, the time).
        </p>
        <p className="mt-1 text-xs text-muted">
          This view does not grant write access. Edits, publishes, transfers, and deletes
          are not exposed here and are not authorized on others&apos; passports by hitting the
          API directly.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-panel border border-hairline bg-white p-4">
        <label className="block">
          <span className="block text-xs font-medium text-ink">Passport ID</span>
          <input
            required
            autoFocus
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null) }}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="mt-1 w-full rounded-card border border-hairline px-3 py-2 font-mono text-xs"
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-xs text-accent">{error}</p>
        )}
        <button
          type="submit"
          disabled={!value.trim()}
          className="mt-3 rounded-card bg-green px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          Inspect
        </button>
      </form>
    </main>
  )
}

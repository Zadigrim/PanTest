'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * "New card" button — POSTs to /api/moichido/cards which creates
 * the passport row + one stamp page with the consumable
 * discriminators auto-set, then redirects the merchant into the
 * designer for the new card.
 *
 * The host-gated /api/moichido/* route is the first moichido API,
 * shipped per the M4.3 spec's "REQUIRED in this PR" line.
 */
export function NewCardButton({ className }: { className?: string }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/moichido/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body?.id) {
        setError(body?.error ?? `HTTP ${res.status}`)
        setCreating(false)
        return
      }
      router.push(`/moichido/cards/${body.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={creating}
        className={
          className ??
          'rounded-[8px] bg-moichido-teal px-4 py-2 text-xs font-semibold text-moichido-paper hover:opacity-90 disabled:opacity-40'
        }
      >
        {creating ? 'Creating…' : 'New card'}
      </button>
      {error && <p className="text-[11px] text-moichido-apricot">{error}</p>}
    </div>
  )
}

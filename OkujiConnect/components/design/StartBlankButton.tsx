'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * "Start blank" button on /design/new.
 *
 * POSTs to /api/design/create, then redirects to the new passport workspace.
 */
export function StartBlankButton() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/design/create', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const { id } = (await res.json()) as { id: string }
      router.push(`/design/${id}`)
    } catch {
      setError('Failed to create passport — please try again.')
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 self-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={creating}
        className="inline-flex items-center h-10 px-5 rounded-panel bg-okuji-teal text-white text-sm font-medium hover:bg-[#0F6E56] disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal"
      >
        {creating ? 'Creating…' : 'Start blank'}
      </button>
      {error && (
        <p className="text-xs text-okuji-coral" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

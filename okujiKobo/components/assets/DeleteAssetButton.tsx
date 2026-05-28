'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteAssetButton({
  assetId,
  assetName,
  canDelete,
}: {
  assetId: string
  assetName: string
  canDelete: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!canDelete) return null

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${assetName}"? This permanently removes the file. You can only delete assets that aren't used by any passport.`,
    )
    if (!confirmed) return

    setError(null)
    const res = await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.message ?? body.error ?? 'Delete failed')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={`Delete ${assetName}`}
        className="inline-flex items-center justify-center h-7 w-7 rounded-card text-muted hover:text-accent hover:bg-paper transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
      {error && (
        <div
          role="alert"
          className="absolute right-0 top-8 z-10 w-64 rounded-panel border border-accent/30 bg-white px-3 py-2 text-xs text-accent shadow-md"
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

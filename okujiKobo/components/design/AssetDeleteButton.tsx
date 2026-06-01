'use client'

// Small "✕" overlay for the designer's asset pickers (StampPicker,
// CustomBgPicker, ImageElementPicker). Reuses the existing
// /api/assets/[id] DELETE endpoint that:
//   - blocks built-in assets
//   - checks count_asset_references and returns 409 if the asset is in
//     use anywhere
//   - removes the storage object first, then the DB row
//
// Differs from the assets-page DeleteAssetButton (which calls
// router.refresh()) by taking an onDeleted callback so the parent picker
// can drop the row from its local list without a full page reload — the
// designer is a SPA-like surface where router.refresh() would discard
// the user's in-progress edits.

import { useState } from 'react'

interface Props {
  assetId: string
  assetName: string
  onDeleted: () => void
}

export function AssetDeleteButton({ assetId, assetName, onDeleted }: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    const ok = window.confirm(
      `Delete "${assetName}"? Removes the file permanently. Blocked if any passport still uses it.`,
    )
    if (!ok) return

    setError(null)
    setPending(true)
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message ?? body.error ?? 'Delete failed')
        return
      }
      onDeleted()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        aria-label={`Delete ${assetName}`}
        title={`Delete ${assetName}`}
        className="absolute right-0.5 top-0.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/85 text-muted shadow-sm opacity-0 transition-opacity hover:bg-accent hover:text-white group-hover:opacity-100 disabled:opacity-40 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {error && (
        <div
          role="alert"
          className="absolute right-0 top-7 z-20 w-56 rounded-panel border border-accent/30 bg-white px-2.5 py-1.5 text-xs text-accent shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}
    </>
  )
}

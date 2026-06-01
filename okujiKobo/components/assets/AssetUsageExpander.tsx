'use client'

// Inline "Used in N passports" expander for an asset on /assets/[type].
// Lazy: the GET /api/assets/[id]/usage call only fires on first expand
// (and won't refetch unless the user collapses + reopens). Keeps the
// assets page server-rendered while adding client-side detail-on-demand.
//
// The usage endpoint returns one row per (passport, reference_kind),
// grouped client-side so each passport shows once with the kinds of
// usage as small tags ("page background", "cover image", "stop stamp").

import { useState } from 'react'
import Link from 'next/link'

interface UsageRow {
  passport_id: string
  passport_title: string
  kinds: string[]
}

const KIND_LABELS: Record<string, string> = {
  page_background:    'page background',
  page_element:       'page image',
  stop_stamp:         'stop stamp',
  cover_image_legacy: 'cover',
  cover_data:         'cover',
}

export function AssetUsageExpander({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passports, setPassports] = useState<UsageRow[]>([])
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/assets/${assetId}/usage`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body.error ?? 'Could not load usage')
          return
        }
        const body = (await res.json()) as { passports: UsageRow[] }
        setPassports(body.passports ?? [])
        setLoaded(true)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="border-t border-hairline px-3 py-2">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between text-xs text-muted hover:text-navy transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green rounded-sm"
        aria-expanded={open}
      >
        <span>Used in passports</span>
        <span className="inline-block transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ›
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {loading && <p className="text-xs text-muted">Loading…</p>}
          {error && <p className="text-xs text-accent">{error}</p>}
          {loaded && !error && passports.length === 0 && (
            <p className="text-xs text-muted">Not used by any passport.</p>
          )}
          {loaded && passports.map((p) => (
            <div key={p.passport_id} className="flex items-start gap-2">
              <Link
                href={`/design/${p.passport_id}`}
                className="flex-1 truncate text-xs text-navy hover:text-green hover:underline"
                title={p.passport_title}
              >
                {p.passport_title || 'Untitled'}
              </Link>
              <div className="flex shrink-0 flex-wrap gap-1">
                {p.kinds.map((k) => (
                  <span key={k} className="rounded-card bg-cream px-1.5 py-0.5 text-[10px] text-muted">
                    {KIND_LABELS[k] ?? k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

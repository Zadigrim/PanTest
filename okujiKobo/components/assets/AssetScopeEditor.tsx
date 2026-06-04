'use client'

// Per-asset scope display + editor on /assets/[type].
//
// Scope is "where the asset shows up in the designer picker":
//   library         → shows in every passport's picker (null)
//   passport:<id>   → shows only when designing that passport
//
// Scope is a picker filter only — it never affects rendering of
// already-placed instances (see PageBackground.tsx etc.). So shrinking
// scope cannot break the look of any passport that's currently using
// the asset; it only hides the asset from those passports' future
// pickers, which we warn about before applying.
//
// The warning list is fetched on-demand from the existing usage
// endpoint (/api/assets/[id]/usage) the moment the user selects a
// shrinking change — only then; we don't preload usage for every
// asset on the page.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ScopeOption {
  id: string
  title: string
}

interface UsagePassport {
  passport_id: string
  passport_title: string
  kinds: string[]
}

const LIBRARY_VALUE = '__library__'

export function AssetScopeEditor({
  assetId,
  initialScopedPassportId,
  initialScopedPassportTitle,
  options,
}: {
  assetId: string
  initialScopedPassportId: string | null
  initialScopedPassportTitle: string | null
  options: ScopeOption[]
}) {
  const router = useRouter()
  const [scopedPassportId, setScopedPassportId] = useState(initialScopedPassportId)
  const [scopedPassportTitle, setScopedPassportTitle] = useState(initialScopedPassportTitle)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // When the user picks a shrinking change, we stage it here and
  // fetch usage to decide whether to confirm. The pending change
  // applies on confirm or clears on cancel.
  const [pending, setPending] = useState<{ nextId: string | null; nextTitle: string | null } | null>(null)
  const [pendingHidden, setPendingHidden] = useState<UsagePassport[]>([])
  const [loadingUsage, setLoadingUsage] = useState(false)

  async function apply(nextId: string | null, nextTitle: string | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoped_passport_id: nextId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Could not change scope')
        return
      }
      setScopedPassportId(nextId)
      setScopedPassportTitle(nextTitle)
      setOpen(false)
      setPending(null)
      setPendingHidden([])
      // Refresh the server-rendered list so other cards reflect any
      // state derived from this (none today, but cheap and correct).
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleSelect(value: string) {
    const nextId = value === LIBRARY_VALUE ? null : value
    const nextTitle = nextId === null
      ? null
      : options.find((o) => o.id === nextId)?.title ?? 'Untitled'

    if (nextId === scopedPassportId) {
      setOpen(false)
      return
    }

    // Determine if this is a shrinking change — i.e. whether the new
    // scope would hide the asset from any passport that currently uses
    // it. Library → passport: anything not the new passport is hidden.
    // Passport-A → passport-B: same, just narrower starting point.
    setLoadingUsage(true)
    setError(null)
    try {
      const res = await fetch(`/api/assets/${assetId}/usage`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Could not load usage')
        return
      }
      const body = (await res.json()) as { passports: UsagePassport[] }
      const usingPassports = body.passports ?? []
      const hidden = nextId === null
        ? []  // library-wide hides nothing
        : usingPassports.filter((p) => p.passport_id !== nextId)

      if (hidden.length === 0) {
        await apply(nextId, nextTitle)
      } else {
        setPending({ nextId, nextTitle })
        setPendingHidden(hidden)
      }
    } finally {
      setLoadingUsage(false)
    }
  }

  const chipLabel = scopedPassportId === null
    ? 'Library'
    : `Scoped: ${scopedPassportTitle ?? 'Untitled'}`
  const chipClass = scopedPassportId === null
    ? 'bg-cream text-navy'
    : 'bg-paper text-clay border border-clay/30'

  return (
    <div className="border-t border-hairline px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-navy transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green rounded-sm"
          aria-expanded={open}
        >
          <span>Scope</span>
          <span
            className={`inline-flex items-center rounded-card px-2 py-0.5 text-[10px] font-medium ${chipClass}`}
            title={chipLabel}
          >
            <span className="max-w-[140px] truncate">{chipLabel}</span>
          </span>
          <span className="inline-block transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ›
          </span>
        </button>
      </div>

      {open && !pending && (
        <div className="mt-2 space-y-1">
          {error && <p className="text-xs text-accent">{error}</p>}
          {loadingUsage && <p className="text-xs text-muted">Checking usage…</p>}
          <select
            value={scopedPassportId ?? LIBRARY_VALUE}
            onChange={(e) => void handleSelect(e.target.value)}
            disabled={saving || loadingUsage}
            className="h-7 w-full rounded-card border border-hairline bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-green disabled:opacity-60"
          >
            <option value={LIBRARY_VALUE}>Library (every passport)</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                Scoped to: {opt.title}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted">
            Scope controls which designer pickers show this asset. Placements that
            already use it keep working regardless.
          </p>
        </div>
      )}

      {open && pending && (
        <div className="mt-2 space-y-2 rounded-card border border-clay/30 bg-paper p-2">
          <p className="text-xs text-navy">
            This change will hide the asset from {pendingHidden.length} passport
            {pendingHidden.length === 1 ? '' : 's'} that currently use{' '}
            {pendingHidden.length === 1 ? 's' : ''} it. Existing placements stay,
            but creators won&apos;t see it in those pickers anymore.
          </p>
          <ul className="space-y-0.5">
            {pendingHidden.map((p) => (
              <li key={p.passport_id} className="text-[11px] text-muted truncate">
                · {p.passport_title || 'Untitled'}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void apply(pending.nextId, pending.nextTitle)}
              disabled={saving}
              className="rounded-card bg-green px-2 py-1 text-[11px] font-medium text-white hover:bg-green/90 disabled:opacity-60"
            >
              {saving ? 'Applying…' : 'Change scope anyway'}
            </button>
            <button
              type="button"
              onClick={() => { setPending(null); setPendingHidden([]) }}
              disabled={saving}
              className="rounded-card border border-hairline px-2 py-1 text-[11px] text-muted hover:text-navy"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

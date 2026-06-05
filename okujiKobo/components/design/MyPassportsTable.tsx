'use client'

// "My passports" list — sortable table replacing the old card grid.
//
// Built for managing many passports at a glance: one row per passport,
// row click opens the editor, ⋯ menu exposes secondary actions
// (Duplicate / Print / Preview / Archive). The cover still renders as
// a small 612×792 thumbnail on the left edge so a creator can scan by
// art instead of reading every title.
//
// All filtering / sorting / searching happens client-side over the
// passports the server already fetched (DesignIndexPage); the list
// scales fine for an individual creator's library.

import { useMemo, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { downloadPrintPdf } from '@/lib/print/download'
import { PassportCoverThumbnail } from './PassportCoverThumbnail'
import { passportTypeIconFromClassifiers } from '@/lib/design/passport-type-icon'
import { spendTierLabel } from '@/lib/design/spend-tiers'
import type { DesignerPassport, CoverSideData } from '@/lib/design/types'

// ── Row data shape ────────────────────────────────────────────────────────────
// Augments DesignerPassport with the per-row stats the server pre-computes.

export interface PassportRow {
  passport: DesignerPassport
  /** Distinct collectors who own a copy of this passport. */
  soldCount: number
  /** Prize-distributed completion tokens for this passport. */
  prizesCount: number
  /** How many of the six workshop steps (cover, pages, pins, theme,
   *  pricing, publish) are complete. Drafts surface this in the
   *  Performance cell instead of sold/prizes. */
  draftStepsDone: number
}

// ── Normalised status ────────────────────────────────────────────────────────
// We only model two real buckets — published / draft. Archived rows still
// appear in the "All" view with a muted pill, but they aren't counted in
// the breakdown and don't get their own filter chip (the Archive action in
// the ⋯ menu remains the only way to move a row out of an active state).

type RowStatus = 'published' | 'draft' | 'archived'

function normalisedStatus(raw: string | null | undefined): RowStatus {
  if (raw === 'published') return 'published'
  if (raw === 'archived') return 'archived'
  return 'draft'
}

// ── Sorting ───────────────────────────────────────────────────────────────────

type SortKey = 'updated' | 'status' | 'performance' | 'title'
type SortDir = 'asc' | 'desc'

function compareRows(a: PassportRow, b: PassportRow, key: SortKey, dir: SortDir): number {
  let cmp = 0
  switch (key) {
    case 'updated':
      cmp = new Date(a.passport.updated_at).getTime() - new Date(b.passport.updated_at).getTime()
      break
    case 'status':
      cmp = normalisedStatus(a.passport.status).localeCompare(normalisedStatus(b.passport.status))
      break
    case 'performance':
      cmp = a.soldCount - b.soldCount
      break
    case 'title':
      cmp = a.passport.title.localeCompare(b.passport.title)
      break
  }
  return dir === 'asc' ? cmp : -cmp
}

// ── Component ─────────────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: 'all' | 'published' | 'draft'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft',     label: 'Drafts' },
]

export function MyPassportsTable({ rows: initialRows }: { rows: PassportRow[] }) {
  const [rows, setRows] = useState<PassportRow[]>(initialRows)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Derived view: search → filter → sort.
  const view = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows
      .filter((r) => filter === 'all' || normalisedStatus(r.passport.status) === filter)
      .filter((r) => q === '' || r.passport.title.toLowerCase().includes(q))
    return [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDir))
  }, [rows, search, filter, sortKey, sortDir])

  // Status breakdown for the subheading — counts only published + drafts
  // over the full set. Archived rows are not bucketed here.
  const breakdown = useMemo(() => {
    let p = 0, d = 0
    for (const r of rows) {
      const s = normalisedStatus(r.passport.status)
      if (s === 'published') p++
      else if (s === 'draft') d++
    }
    return { total: rows.length, published: p, drafts: d }
  }, [rows])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Sensible default direction per column: most-recent / most-sold first.
      setSortDir(key === 'title' || key === 'status' ? 'asc' : 'desc')
    }
  }

  return (
    <>
      {/* ── Header row ───────────────────────────────────────────────── */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1
            className="text-[26px] font-bold text-ink"
            style={{ letterSpacing: '-0.01em' }}
          >
            My passports
          </h1>
          <p className="mt-1 text-sm text-muted">
            {breakdown.total === 0
              ? 'Create your first passport to get started.'
              : <Breakdown b={breakdown} />}
          </p>
        </div>
        <NewPassportLink />
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <label className="relative">
            <span className="sr-only">Search passports</span>
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            >
              ⌕
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search passports…"
              className="h-9 w-[280px] rounded-[8px] border-[1.5px] border-hairline bg-white pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </label>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5">
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`rounded-[8px] border-[1.5px] px-3 h-9 text-sm font-medium transition-colors ${
                    active
                      ? 'border-ink bg-ink text-cream'
                      : 'border-hairline bg-white text-muted hover:text-ink hover:border-ink/40'
                  }`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sort */}
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>Sort</span>
          <select
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(':') as [SortKey, SortDir]
              setSortKey(k)
              setSortDir(d)
            }}
            className="h-9 rounded-[8px] border-[1.5px] border-hairline bg-white px-2 text-sm text-ink focus:border-ink focus:outline-none"
          >
            <option value="updated:desc">Recently updated</option>
            <option value="updated:asc">Oldest updated</option>
            <option value="title:asc">Title A → Z</option>
            <option value="title:desc">Title Z → A</option>
            <option value="performance:desc">Most sold</option>
            <option value="status:asc">Status</option>
          </select>
        </label>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <EmptyState />
      ) : view.length === 0 ? (
        <NoMatchState onReset={() => { setSearch(''); setFilter('all') }} />
      ) : (
        <div className="space-y-2">
          {/* Column header row */}
          <div
            className="grid items-center gap-3 px-3 py-2 text-[9.5px] font-medium uppercase text-muted"
            style={{
              gridTemplateColumns: '60px 1fr 130px 200px 130px 110px',
              letterSpacing: '1.5px',
            }}
          >
            <span aria-hidden="true">&nbsp;</span>
            <SortHeader label="Passport"     active={sortKey === 'title'}       dir={sortDir} onClick={() => toggleSort('title')} />
            <SortHeader label="Status"       active={sortKey === 'status'}      dir={sortDir} onClick={() => toggleSort('status')} />
            <SortHeader label="Performance"  active={sortKey === 'performance'} dir={sortDir} onClick={() => toggleSort('performance')} />
            <SortHeader label="Updated"      active={sortKey === 'updated'}     dir={sortDir} onClick={() => toggleSort('updated')} />
            <span aria-hidden="true">&nbsp;</span>
          </div>

          {view.map((row) => (
            <Row
              key={row.passport.id}
              row={row}
              onArchived={(id) =>
                setRows((prev) =>
                  prev.map((r) => (r.passport.id === id ? { ...r, passport: { ...r.passport, status: 'archived' } } : r)),
                )
              }
            />
          ))}
        </div>
      )}
    </>
  )
}

// ── Subhead breakdown ────────────────────────────────────────────────────────

function Breakdown({ b }: { b: { total: number; published: number; drafts: number } }) {
  return (
    <>
      <span>{b.total} total</span>
      <span className="mx-1.5">·</span>
      <span className="font-semibold text-green">{b.published} published</span>
      <span className="mx-1.5">·</span>
      <span>{b.drafts} drafts</span>
    </>
  )
}

// ── Column header (sortable) ─────────────────────────────────────────────────

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 text-left transition-colors hover:text-ink ${active ? 'text-ink' : ''}`}
    >
      <span>{label}</span>
      {active && <span aria-hidden="true">{dir === 'asc' ? '▴' : '▾'}</span>}
    </button>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({ row, onArchived }: { row: PassportRow; onArchived: (id: string) => void }) {
  const router = useRouter()
  const { passport, soldCount, prizesCount, draftStepsDone } = row
  const status = normalisedStatus(passport.status)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classifiers = (passport as any).classifiers as string[] | null | undefined
  const typeIcon = passportTypeIconFromClassifiers(classifiers)

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/design/${passport.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(`/design/${passport.id}`)
        }
      }}
      className="grid cursor-pointer items-center gap-3 rounded-[8px] border border-surface-faintdiv bg-white px-3 py-2.5 transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      style={{ gridTemplateColumns: '60px 1fr 130px 200px 130px 110px' }}
    >
      {/* Cover. No border/radius — the artwork edge IS the edge. The
          type-icon badge that used to overlay the bottom-right has
          moved to the title cell as plain text so it stops covering
          the cover art. */}
      <div className="overflow-hidden" style={{ width: 41, height: 53 }}>
        <PassportCoverThumbnail
          title={passport.title}
          typeIcon={typeIcon}
          outsideData={passport.cover_outside_data as CoverSideData | null}
          coverImageUrl={passport.cover_image_url ?? null}
          coverThumbnail={passport.cover_thumbnail ?? null}
          fallbackBg={passport.cover_bg_color ?? '0D1B2A'}
          showTypeBadge={false}
        />
      </div>

      {/* Passport title + issuer + small meta */}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
          <span className="text-base leading-none text-muted" aria-hidden="true">{typeIcon}</span>
          <span className="truncate">{passport.title}</span>
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          <PassportMeta passport={passport} />
        </p>
      </div>

      {/* Status pill */}
      <div>
        <StatusPill status={status} />
      </div>

      {/* Performance. Free passports report "acquired" instead of "sold"
          — the row count is the same (collector_passports), only the
          verb shifts so the creator isn't told copies of a $0 passport
          were "sold". */}
      <div className="text-sm">
        {status === 'draft' ? (
          <span className="text-muted">{draftStepsDone}/6 steps</span>
        ) : (
          <span className="text-ink">
            <span className="font-semibold">{soldCount}</span>
            <span className="text-muted"> {(passport.price_cents ?? 0) > 0 ? 'sold' : 'acquired'}</span>
            <span className="mx-1.5 text-hairline">·</span>
            <span className="font-semibold">{prizesCount}</span>
            <span className="text-muted"> prizes</span>
          </span>
        )}
      </div>

      {/* Updated */}
      <div className="text-[11.5px] text-muted">
        Updated {new Date(passport.updated_at).toLocaleDateString()}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={`/design/${passport.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-8 items-center rounded-[8px] border-[1.5px] border-ink bg-white px-3 text-[12px] font-medium text-ink hover:bg-surface-workspace"
        >
          {status === 'draft' ? 'Continue' : 'Open'}
        </Link>
        <ActionsMenu passport={passport} onArchived={() => onArchived(passport.id)} />
      </div>
    </div>
  )
}

// ── Passport meta (replaces the dropped emoji row) ───────────────────────────

function PassportMeta({ passport }: { passport: DesignerPassport }) {
  const bits: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issuer = (passport as any).institution_name as string | null | undefined
  if (issuer) bits.push(issuer)
  if (passport.price_cents != null) {
    bits.push(passport.price_cents === 0 ? 'Free' : `$${(passport.price_cents / 100).toFixed(2)}`)
  } else {
    bits.push(spendTierLabel(passport.expected_spend_tier))
  }
  if (passport.transit_accessible) bits.push('transit')
  if (passport.wheelchair_accessible) bits.push('step-free')
  return <>{bits.join(' · ')}</>
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: RowStatus }) {
  const color =
    status === 'published' ? 'text-green border-green'
    : status === 'archived' ? 'text-accent border-accent'
    : 'text-muted border-muted'
  const dot =
    status === 'published' ? 'bg-green'
    : status === 'archived' ? 'bg-accent'
    : 'bg-muted'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] bg-white px-2 py-0.5 text-[10.5px] font-semibold ${color}`}
    >
      <span className={`h-[7px] w-[7px] rounded-full ${dot}`} aria-hidden="true" />
      {status.toUpperCase()}
    </span>
  )
}

// ── Actions menu (⋯) ──────────────────────────────────────────────────────────

function ActionsMenu({ passport, onArchived }: { passport: DesignerPassport; onArchived: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const isPublished = passport.is_published === true || passport.status === 'published'

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function handlePrint() {
    setBusy('print')
    try {
      await downloadPrintPdf(passport.id, passport.title)
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }

  async function handleUnpublish() {
    // Reads the holder count off the server response so the
    // confirm message is honest. Server is the source of
    // truth; this UI is just a thin shell.
    if (!confirm(
      `Unpublish "${passport.title}"?\n\nThis delists it from Explore, free-PDF, and new ` +
      `acquisitions. Existing holders KEEP access throughout. Republishing to holders later ` +
      `will require a verified critical justification.`,
    )) return
    setBusy('unpublish')
    setError(null)
    try {
      const res = await fetch(`/api/passports/${passport.id}/unpublish`, { method: 'POST' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Unpublish failed')
        return
      }
      onArchived()           // reuse the row-refresh callback
      router.refresh()
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }

  async function handleDelete() {
    // Two-phase confirm: title-typing when the passport is
    // "substantial" (>2 pages), plain confirm otherwise. The
    // server hard-enforces the zero-acquisition rule; this is
    // a UX safety, not a security gate.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageCount = (passport as any).page_count ?? 0
    if (pageCount > 2) {
      const typed = prompt(
        `Type the passport title to delete:\n\n"${passport.title}"`,
      )
      if (typed?.trim() !== passport.title.trim()) {
        if (typed !== null) alert('Title did not match — delete cancelled.')
        return
      }
    } else {
      if (!confirm(
        `Delete "${passport.title}"? This permanently removes the passport, its pages, and stops.`,
      )) return
    }
    setBusy('delete')
    setError(null)
    try {
      const res = await fetch(`/api/passports/${passport.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        if (res.status === 409) {
          alert(
            `This passport has ${j.holderCount ?? 'some'} holder${j.holderCount === 1 ? '' : 's'} and cannot be deleted. ` +
            `Unpublish it instead — holders keep access.`,
          )
        } else {
          setError(j.error ?? 'Delete failed')
        }
        return
      }
      onArchived()
      router.refresh()
    } finally {
      setBusy(null)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border-[1.5px] border-hairline bg-white text-ink hover:border-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-[8px] border-[1.5px] border-ink bg-white py-1 shadow-md"
        >
          <MenuItem label={busy === 'print' ? 'Generating…' : 'Print posters'} onClick={handlePrint} disabled={busy !== null} />
          <Link
            href={`/explore/${passport.id}`}
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            className="block px-3 py-1.5 text-sm text-ink hover:bg-surface-workspace"
            role="menuitem"
          >
            Preview
          </Link>
          <div className="my-1 border-t border-surface-faintdiv" />
          {isPublished ? (
            <MenuItem
              label={busy === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
              hint="holders keep access"
              onClick={handleUnpublish}
              disabled={busy !== null}
            />
          ) : (
            <MenuItem
              label={busy === 'delete' ? 'Deleting…' : 'Delete'}
              hint="drafts only"
              onClick={handleDelete}
              disabled={busy !== null}
              danger
            />
          )}
          {error && <p className="px-3 py-1 text-[10.5px] text-red">{error}</p>}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  label,
  hint,
  onClick,
  disabled,
  danger,
}: {
  label: string
  hint?: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
        disabled
          ? 'cursor-not-allowed text-hairline'
          : danger
          ? 'text-red hover:bg-surface-workspace'
          : 'text-ink hover:bg-surface-workspace'
      }`}
    >
      <span>{label}</span>
      {hint && <span className="text-[10px] text-muted">{hint}</span>}
    </button>
  )
}

// ── Empty + no-match states ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-[12px] border-2 border-dashed border-hairline py-20 text-center">
      <h2 className="text-base font-semibold text-ink">No passports yet</h2>
      <p className="mt-2 text-sm text-muted">
        Create your first passport to start building experiences.
      </p>
      <div className="mt-6 inline-flex">
        <NewPassportLink />
      </div>
    </div>
  )
}

function NoMatchState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-[8px] border border-surface-faintdiv bg-white py-12 text-center">
      <p className="text-sm text-muted">No passports match the current filter.</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-3 text-xs font-medium text-green hover:underline"
      >
        Clear filters
      </button>
    </div>
  )
}

// ── New passport — server-style link styled to match the toolbar ─────────────

function NewPassportLink() {
  return (
    <Link
      href="/design/new"
      className="inline-flex h-10 items-center rounded-[8px] border-[1.5px] border-ink bg-green px-4 text-sm font-semibold text-white hover:bg-green/90"
    >
      + New passport
    </Link>
  )
}

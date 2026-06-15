'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AssetScopeEditor, type ScopeOption } from './AssetScopeEditor'
import type { AssetCardModel } from './AssetCard'
import { KIND_RULES, formatBytes, formatTag, type AssetTypeDb } from '@/lib/assets/kinds'
import { assetDisplayTitle, prettifyFilename } from '@/lib/assets/friendly-name'

/**
 * Detail drawer for one asset — opens from any card click.
 *
 * Layout (right-side, ~400px, white panel, 2px ink left border):
 *   - Preview centered on a rail-bg mat at the asset's TRUE ratio
 *     (cover assets show the full 1252×869 spread, never a cropped
 *     front)
 *   - Title (renamable inline) + mono meta line (filename ·
 *     dimensions · format · size), degraded gracefully for legacy
 *     rows that don't have width/height/bytes
 *   - Chip row: scope + kind
 *   - SCOPE EDITOR — embeds the existing AssetScopeEditor component
 *     verbatim so the in-use warning + apply logic stay the same
 *     trusted code path
 *   - USAGE — fetched from /api/assets/[id]/usage on open; rows
 *     link into the designer at the consuming passport, with
 *     placement-kind chips
 *   - Actions — Rename · Download · Delete (delete blocked-with-
 *     reason when the asset is in use; the UI mirrors the server
 *     guard at /api/assets/[id], which is the actual enforcement)
 *
 * Built-in (Okuji presets) and institution-shared assets render
 * a READ-ONLY variant — preview + meta + usage where sensible,
 * no rename / delete / scope.
 */

export interface AssetDrawerExtras {
  /** Optional metadata captured at upload time. Nullable so legacy
   *  rows render a graceful meta line ("PNG · 412 KB" when WxH is
   *  unknown). */
  widthPx: number | null
  heightPx: number | null
  bytesSize: number | null
  fileFormat: string | null
}

export type UsageKind =
  | 'page_background'
  | 'page_element'
  | 'stop_stamp'
  | 'cover_image_legacy'
  | 'cover_data'

const USAGE_KIND_LABEL: Record<UsageKind, string> = {
  page_background:    'page background',
  page_element:       'page image',
  stop_stamp:         'stop stamp',
  cover_image_legacy: 'cover',
  cover_data:         'cover',
}

interface UsagePassport {
  passport_id: string
  passport_title: string
  kinds: UsageKind[]
}

export function AssetDrawer({
  asset,
  extras,
  scopeOptions,
  onClose,
  onDeleted,
  onRenamed,
}: {
  asset: AssetCardModel
  extras: AssetDrawerExtras
  scopeOptions: ScopeOption[]
  onClose: () => void
  /** Called after a successful delete so the orchestrator can
   *  drop the row from the list without a full refresh. */
  onDeleted: () => void
  /** Called after a successful rename so the orchestrator can
   *  update the card title without a full refresh. */
  onRenamed: (next: string | null) => void
}) {
  // ── Usage fetch ──────────────────────────────────────────────
  const [usage, setUsage] = useState<UsagePassport[] | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    // Built-in assets aren't tracked in design_assets — no usage call.
    if (asset.source === 'okuji') {
      setUsage([])
      return
    }
    void (async () => {
      try {
        const res = await fetch(`/api/assets/${asset.id}/usage`)
        if (!res.ok) throw new Error('failed')
        const body = await res.json()
        if (!cancelled) setUsage((body.passports ?? []) as UsagePassport[])
      } catch {
        if (!cancelled) setUsageError('Could not load usage')
      }
    })()
    return () => { cancelled = true }
  }, [asset.id, asset.source])

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const rules = KIND_RULES[asset.kind]
  const title = assetDisplayTitle({ display_name: asset.displayName, name: asset.filename })
  const filenameForMono = asset.filename ?? prettifyFilename(asset.filename)
  const isReadOnly = asset.source !== 'owned'

  // ── Meta-line bits, degrade gracefully ──────────────────────
  const dim = extras.widthPx && extras.heightPx ? `${extras.widthPx}×${extras.heightPx}` : null
  const fmt = formatTag(extras.fileFormat)
  const size = formatBytes(extras.bytesSize)
  const metaBits = [filenameForMono, dim, fmt, size].filter(Boolean) as string[]

  // ── Inline rename ────────────────────────────────────────────
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(asset.displayName ?? '')
  const [renameError, setRenameError] = useState<string | null>(null)

  async function commitRename() {
    setRenameError(null)
    try {
      const res = await fetch(`/api/assets/${asset.id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: renameValue }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setRenameError(body.error ?? 'Rename failed')
        return
      }
      const body = await res.json()
      onRenamed(body.display_name ?? null)
      setRenaming(false)
    } catch {
      setRenameError('Rename failed')
    }
  }

  // ── Delete (mirrors server 409 guard) ────────────────────────
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    if (!window.confirm(`Delete "${title}"? This permanently removes the file.`)) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setDeleteError(body.message ?? body.error ?? 'Delete failed')
        return
      }
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const usageCount = usage?.length ?? 0
  const canDelete = !isReadOnly && usageCount === 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />

      <aside
        className="relative z-10 flex h-full w-[400px] flex-col overflow-y-auto border-l-[2px] border-ink bg-white shadow-xl"
        role="dialog"
        aria-label="Asset detail"
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-white px-5 py-3">
          <p
            className="text-[10px] font-medium uppercase text-muted"
            style={{ letterSpacing: '2px' }}
          >
            Asset
          </p>
          <button
            onClick={onClose}
            className="text-lg text-muted hover:text-ink"
            aria-label="Close drawer"
          >
            ✕
          </button>
        </div>

        {/* ── Preview ────────────────────────────────────────── */}
        <div className="bg-surface-rail px-5 py-6">
          <div
            className="mx-auto overflow-hidden rounded-[6px] bg-white"
            style={
              rules.aspectRatio
                ? { aspectRatio: rules.aspectRatio, maxWidth: 360 }
                : { aspectRatio: '4 / 3', maxWidth: 360 }
            }
          >
            {asset.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.url}
                alt={title}
                className={`h-full w-full ${rules.aspectRatio ? 'object-cover' : 'object-contain'}`}
              />
            )}
          </div>
        </div>

        {/* ── Title + meta + chips ───────────────────────────── */}
        <section className="space-y-3 border-b border-surface-faintdiv px-5 py-4">
          {renaming ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                className="h-9 rounded-[6px] border-[1.5px] border-ink bg-white px-2 text-[14px] font-semibold text-ink focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void commitRename()
                  if (e.key === 'Escape') { setRenaming(false); setRenameValue(asset.displayName ?? '') }
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void commitRename()}
                  className="rounded-[6px] bg-green px-3 py-1 text-[11.5px] font-semibold text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setRenaming(false); setRenameValue(asset.displayName ?? '') }}
                  className="rounded-[6px] border border-hairline px-3 py-1 text-[11.5px] text-muted"
                >
                  Cancel
                </button>
                {renameError && <span className="text-[11px] text-red">{renameError}</span>}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-[16px] font-bold text-ink">{title}</h2>
              <p className="mt-1 font-mono text-[10.5px] text-muted">
                {metaBits.length > 0 ? metaBits.join('  ·  ') : '—'}
              </p>
              <p className="mt-1 text-[10.5px] text-muted">{rules.ratioLabel}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip>
              {asset.scopedPassportId === null
                ? 'Library'
                : `Passport: ${asset.scopedPassportTitle ?? 'Untitled'}`}
            </Chip>
            <Chip variant="muted">{rules.kindLabel}</Chip>
            {asset.source === 'institution' && <Chip variant="green">Institution shared</Chip>}
            {asset.source === 'okuji' && <Chip variant="muted">Okuji library</Chip>}
          </div>
        </section>

        {/* ── Scope editor (reuses existing component) ───────── */}
        {!isReadOnly && (
          <section className="border-b border-surface-faintdiv">
            <p
              className="px-5 pt-4 text-[9.5px] font-medium uppercase text-muted"
              style={{ letterSpacing: '1.5px' }}
            >
              Scope
            </p>
            <AssetScopeEditor
              assetId={asset.id}
              initialScopedPassportId={asset.scopedPassportId}
              initialScopedPassportTitle={asset.scopedPassportTitle}
              options={scopeOptions}
            />
          </section>
        )}

        {/* ── Usage ──────────────────────────────────────────── */}
        <section className="border-b border-surface-faintdiv px-5 py-4">
          <p
            className="text-[9.5px] font-medium uppercase text-muted"
            style={{ letterSpacing: '1.5px' }}
          >
            Used in
          </p>
          {renderUsage(usage, usageError)}
        </section>

        {/* ── Actions ────────────────────────────────────────── */}
        {!isReadOnly && (
          <section className="space-y-2 px-5 py-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRenaming(true)}
                disabled={renaming}
                className="inline-flex h-9 items-center rounded-[6px] border-[1.5px] border-hairline bg-white px-3 text-[12px] font-medium text-ink hover:border-ink"
              >
                Rename
              </button>
              {asset.url && (
                <a
                  href={asset.url}
                  download={asset.filename ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-[6px] border-[1.5px] border-hairline bg-white px-3 text-[12px] font-medium text-ink hover:border-ink"
                >
                  Download
                </a>
              )}
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="ml-auto inline-flex h-9 items-center rounded-[6px] border-[1.5px] border-red bg-white px-3 text-[12px] font-semibold text-red hover:bg-red hover:text-white"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              ) : null}
            </div>

            {/* In-use notice replaces the Delete button when the
                asset is in use. The server-side guard at
                /api/assets/[id] is the actual enforcement; this
                just mirrors it for the user. */}
            {!canDelete && !isReadOnly && (
              <p
                role="status"
                className="rounded-[6px] border border-dashed border-red/60 bg-red/[0.06] px-3 py-2 text-[12px] text-red"
              >
                <strong>Can&rsquo;t delete</strong> — in use. Used by {usageCount}{' '}
                passport{usageCount === 1 ? '' : 's'}. Remove it from them first.
              </p>
            )}

            {deleteError && (
              <p role="alert" className="text-[11.5px] text-red">{deleteError}</p>
            )}
          </section>
        )}
      </aside>
    </div>
  )
}

// ── Usage list renderer (extracted so TS narrowing reads cleanly) ───────────

function renderUsage(usage: UsagePassport[] | null, usageError: string | null) {
  if (usageError) {
    return <p className="mt-2 text-[12px] text-red">{usageError}</p>
  }
  if (usage === null) {
    return <p className="mt-2 text-[12px] text-muted">Loading…</p>
  }
  if (usage.length === 0) {
    return (
      <p className="mt-2 text-[12px] text-muted">
        Not used yet · Safe to delete.
      </p>
    )
  }
  return (
    <ul className="mt-2 space-y-1">
      {usage.slice(0, 8).map((p) => (
        <li key={p.passport_id}>
          <Link
            href={`/design/${p.passport_id}`}
            className="flex items-center justify-between gap-2 rounded-[6px] border border-surface-faintdiv px-2 py-1.5 text-[12px] text-ink hover:border-ink"
          >
            <span className="truncate">{p.passport_title || 'Untitled'}</span>
            <span className="shrink-0 text-[10px] text-muted">
              {p.kinds.map((k) => USAGE_KIND_LABEL[k] ?? k).join(' · ')}
            </span>
          </Link>
        </li>
      ))}
      {usage.length > 8 && (
        <li className="text-[11px] text-muted">+{usage.length - 8} more</li>
      )}
    </ul>
  )
}

// ── Chip helper ────────────────────────────────────────────────

function Chip({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'muted' | 'green'
}) {
  const cls =
    variant === 'green'
      ? 'border-green text-green'
      : variant === 'muted'
      ? 'border-hairline text-muted'
      : 'border-ink text-ink'
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-[10.5px] font-semibold ${cls}`}
    >
      {children}
    </span>
  )
}

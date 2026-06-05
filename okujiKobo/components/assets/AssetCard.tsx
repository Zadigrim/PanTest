'use client'

import { useState } from 'react'
import type { AssetTypeDb } from '@/lib/assets/kinds'
import { KIND_RULES } from '@/lib/assets/kinds'
import { assetDisplayTitle } from '@/lib/assets/friendly-name'

/**
 * One asset tile in the grid. Light card replacing the old
 * 3-row footer card:
 *   - thumbnail at the asset's TRUE aspect ratio
 *   - scope chip overlaid top-left (display only — editing happens
 *     in the drawer)
 *   - download + delete buttons revealed on hover top-right
 *     (delete UI mirrors the server-side guard — disabled with a
 *     tooltip when the asset is in use; the API still refuses
 *     409 if anything slips through)
 *   - footer = friendly display name over mono filename + usage
 *     count
 *
 * Whole card clicks → opens the drawer.
 */

export interface AssetCardModel {
  id: string
  /** Asset DB type — drives thumbnail ratio + the kind chip. */
  kind: AssetTypeDb
  /** Public storage URL of the asset file. */
  url: string | null
  /** Raw filename (the existing `name` column). */
  filename: string | null
  /** User-renamed friendly title (the new display_name col). */
  displayName: string | null
  /** Scope — null = library-wide, otherwise the scoped passport. */
  scopedPassportId: string | null
  scopedPassportTitle: string | null
  /** Source identifier — distinguishes built-in / institution / owned. */
  source: 'okuji' | 'institution' | 'owned'
  /** Usage count surfaced cheaply alongside the asset list (server
   *  pre-computes from list_asset_references); 0 = unused. */
  usageCount: number
}

export function AssetCard({
  model,
  onOpen,
  onDelete,
  onDownload,
}: {
  model: AssetCardModel
  onOpen: () => void
  /** Called when the user clicks the hover delete. The orchestrator
   *  performs the actual fetch — this keeps card state minimal. */
  onDelete: () => void
  onDownload: () => void
}) {
  const [hover, setHover] = useState(false)
  const rules = KIND_RULES[model.kind]
  const title = assetDisplayTitle({ display_name: model.displayName, name: model.filename })
  const canDelete = model.source === 'owned' && model.usageCount === 0
  const canEdit = model.source === 'owned'

  return (
    <article
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role="button"
      tabIndex={0}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[10px] border-[1.5px] border-hairline bg-white transition-shadow hover:border-ink hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
    >
      {/* ── Thumbnail at TRUE ratio ──────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden border-b border-surface-faintdiv bg-surface-rail"
        style={
          rules.aspectRatio
            ? { aspectRatio: rules.aspectRatio }
            : { aspectRatio: '4 / 3' }  // native-ratio assets use a 4:3 frame, image is letterboxed
        }
      >
        {model.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.url}
            alt={title}
            className={`absolute inset-0 h-full w-full ${
              rules.aspectRatio ? 'object-cover' : 'object-contain'
            }`}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[11px] text-muted">
            No preview
          </div>
        )}

        {/* Scope chip overlay (display only) */}
        <span
          className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-[6px] bg-white/85 px-2 py-0.5 text-[10.5px] font-semibold text-ink backdrop-blur-[2px]"
          aria-hidden="true"
        >
          <span
            className={`h-[6px] w-[6px] rounded-full ${
              model.scopedPassportId === null ? 'bg-accent' : 'bg-blue'
            }`}
          />
          {model.scopedPassportId === null ? 'Library' : 'Passport'}
        </span>

        {/* Hover actions */}
        {canEdit && hover && (
          <div
            className="absolute right-2 top-2 flex items-center gap-1"
            // Stop the row-click handler — these buttons are siblings
            // inside a clickable card.
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              label="Download"
              onClick={onDownload}
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              }
            />
            <IconButton
              label={
                model.usageCount > 0
                  ? `Used by ${model.usageCount} passport${model.usageCount === 1 ? '' : 's'}`
                  : 'Delete'
              }
              danger
              disabled={!canDelete}
              onClick={onDelete}
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              }
            />
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{title}</p>
          {model.filename && (
            <p className="truncate font-mono text-[10px] text-muted">{model.filename}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-muted">
          {model.usageCount > 0 ? `${model.usageCount} ↗` : '—'}
        </span>
      </div>
    </article>
  )
}

function IconButton({
  label,
  icon,
  onClick,
  danger,
  disabled,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onClick()
      }}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-[6px] border bg-white transition-colors ${
        disabled
          ? 'cursor-not-allowed border-hairline text-hairline'
          : danger
          ? 'border-hairline text-ink hover:border-red hover:text-red'
          : 'border-hairline text-ink hover:border-ink'
      }`}
    >
      {icon}
    </button>
  )
}

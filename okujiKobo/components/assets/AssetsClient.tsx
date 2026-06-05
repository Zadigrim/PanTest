'use client'

import { useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { AssetTypeDb } from '@/lib/assets/kinds'
import { KIND_RULES } from '@/lib/assets/kinds'
import { assetDisplayTitle } from '@/lib/assets/friendly-name'
import { AssetCard, type AssetCardModel } from './AssetCard'
import { AssetDrawer, type AssetDrawerExtras } from './AssetDrawer'
import type { ScopeOption } from './AssetScopeEditor'

/**
 * Assets-section orchestrator (one per tab).
 *
 * Owns:
 *   - the visible asset list (server-fed; we mutate locally on
 *     delete/rename so we don't have to round-trip the whole page)
 *   - search / filter / sort state
 *   - the selected asset for the drawer
 *   - drag-and-drop upload to /api/assets/upload (library-wide,
 *     matching the existing Assets-section scoping rule)
 *
 * Does NOT re-implement scope-change or delete logic — both are
 * delegated to the existing components / API routes that this
 * change set otherwise preserves.
 */

type FilterKey = 'all' | 'okuji' | 'mine' | 'inuse'
type SortKey = 'recent' | 'name'

// ── Server-fed model ─────────────────────────────────────────────────────────
// What the server hands us per row. The card view consumes the
// AssetCardModel projection; the drawer consumes the same plus
// AssetDrawerExtras for the meta line.

export interface ServerAsset {
  id: string
  url: string | null
  filename: string | null
  displayName: string | null
  scopedPassportId: string | null
  scopedPassportTitle: string | null
  source: 'okuji' | 'institution' | 'owned'
  usageCount: number
  // Drawer meta — null on legacy rows.
  widthPx: number | null
  heightPx: number | null
  bytesSize: number | null
  fileFormat: string | null
  /** ISO created_at; powers "Recently added" sort. */
  createdAt: string
}

export function AssetsClient({
  kind,
  assets,
  scopeOptions,
}: {
  kind: AssetTypeDb
  assets: ServerAsset[]
  scopeOptions: ScopeOption[]
}) {
  const router = useRouter()
  const [list, setList] = useState<ServerAsset[]>(assets)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const rules = KIND_RULES[kind]
  const selected = list.find((a) => a.id === selectedId) ?? null

  // ── Derived view: search → filter → sort ──────────────────────
  const view = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = list
      .filter((a) => {
        if (filter === 'okuji')  return a.source === 'okuji'
        if (filter === 'mine')   return a.source === 'owned'
        if (filter === 'inuse')  return a.usageCount > 0
        return true
      })
      .filter((a) => {
        if (q === '') return true
        const title = assetDisplayTitle({ display_name: a.displayName, name: a.filename }).toLowerCase()
        return title.includes(q) || (a.filename ?? '').toLowerCase().includes(q)
      })

    if (sort === 'name') {
      filtered.sort((a, b) =>
        assetDisplayTitle({ display_name: a.displayName, name: a.filename })
          .localeCompare(assetDisplayTitle({ display_name: b.displayName, name: b.filename })),
      )
    } else {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return filtered
  }, [list, filter, search, sort])

  // ── Groups within the tab ─────────────────────────────────────
  // The "Okuji library" group is always first; "Institution stamps"
  // only appears on the Stamps tab when there are shared assets;
  // "Your uploads" anchors the bottom. Filter-chip selections still
  // hide whole groups (e.g. selecting "Your uploads" hides the Okuji
  // group), which is what users intuit.
  const groups = useMemo(() => {
    const buckets: { key: string; label: string; subtitle?: string; rows: ServerAsset[] }[] = []
    const okuji = view.filter((a) => a.source === 'okuji')
    const institution = view.filter((a) => a.source === 'institution')
    const owned = view.filter((a) => a.source === 'owned')
    if (okuji.length > 0)
      buckets.push({ key: 'okuji', label: 'Okuji library', subtitle: 'paper grounds · system', rows: okuji })
    if (institution.length > 0)
      buckets.push({ key: 'institution', label: 'Institution stamps', rows: institution })
    if (owned.length > 0)
      buckets.push({ key: 'owned', label: 'Your uploads', rows: owned })
    return buckets
  }, [view])

  // ── Local mutations after server actions ──────────────────────
  function handleDeleted(id: string) {
    setList((prev) => prev.filter((a) => a.id !== id))
    setSelectedId(null)
    // The server also flushed the row; refresh keeps any other
    // counts (dashboard KPIs etc.) in sync on the next visit.
    router.refresh()
  }

  function handleRenamed(id: string, next: string | null) {
    setList((prev) => prev.map((a) => (a.id === id ? { ...a, displayName: next } : a)))
  }

  // ── Hover delete from a card — uses the SAME /api/assets/[id]
  //    DELETE route. The server's 409-on-in-use refusal stays the
  //    real enforcement; this is the UI mirror.
  async function deleteFromCard(asset: ServerAsset) {
    const title = assetDisplayTitle({ display_name: asset.displayName, name: asset.filename })
    if (!window.confirm(`Delete "${title}"? This permanently removes the file.`)) return
    const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      window.alert(body.message ?? body.error ?? 'Delete failed')
      return
    }
    handleDeleted(asset.id)
  }

  // ── Upload (toolbar button + drag-and-drop) ───────────────────
  async function uploadFile(file: File) {
    setUploadError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('asset_type', kind)
      form.append('name', file.name)
      const res = await fetch('/api/assets/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setUploadError(body.error ?? body.message ?? 'Upload failed')
        return
      }
      // Refresh the server payload so the new asset appears with
      // its real metadata (the upload route already captured
      // bytes_size + file_format).
      router.refresh()
    } finally {
      setUploading(false)
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    for (const f of arr) await uploadFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files)
    }
  }

  // ── Render ────────────────────────────────────────────────────
  const totalShown = view.length
  const totalAll = list.length

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative">
            <span className="sr-only">Search assets</span>
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
              placeholder="Search assets…"
              className="h-9 w-[300px] rounded-[8px] border-[1.5px] border-hairline bg-white pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            />
          </label>

          <div className="flex items-center gap-1.5">
            <FilterChip active={filter === 'all'}   onClick={() => setFilter('all')}>All</FilterChip>
            <FilterChip active={filter === 'okuji'} onClick={() => setFilter('okuji')}>Okuji library</FilterChip>
            <FilterChip active={filter === 'mine'}  onClick={() => setFilter('mine')}>Your uploads</FilterChip>
            <FilterChip active={filter === 'inuse'} onClick={() => setFilter('inuse')}>In use</FilterChip>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-[8px] border-[1.5px] border-hairline bg-white px-2 text-sm text-ink focus:border-ink focus:outline-none"
            >
              <option value="recent">Recently added</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center rounded-[8px] border-[1.5px] border-ink bg-green px-3 text-sm font-semibold text-white hover:bg-green/90 disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : '↑ Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && void handleFiles(e.target.files)}
            className="hidden"
          />
        </div>
      </div>

      {/* Result count + upload error */}
      <p className="mb-4 text-[12px] text-muted">
        {totalShown === totalAll
          ? `${totalAll} asset${totalAll === 1 ? '' : 's'}`
          : `${totalShown} of ${totalAll} shown`}
        {uploadError && (
          <span role="alert" className="ml-3 text-red">
            Upload error: {uploadError}
            <button type="button" onClick={() => setUploadError(null)} className="ml-1 underline">dismiss</button>
          </span>
        )}
      </p>

      {/* ── Drop zone + grid ────────────────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-[10px] ${
          dragging ? 'outline outline-2 outline-offset-4 outline-green' : ''
        }`}
      >
        {totalAll === 0 ? (
          <EmptyState kind={kind} />
        ) : totalShown === 0 ? (
          <NoMatchState onReset={() => { setSearch(''); setFilter('all') }} />
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.key}>
                <header className="mb-3">
                  <h3
                    className="text-[9.5px] font-medium uppercase text-muted"
                    style={{ letterSpacing: '1.5px' }}
                  >
                    {g.label} <span className="text-hairline">· {g.rows.length}</span>
                  </h3>
                  {g.subtitle && <p className="text-[11px] text-muted">{g.subtitle}</p>}
                </header>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {g.rows.map((a) => (
                    <AssetCard
                      key={a.id}
                      model={toCardModel(a, kind)}
                      onOpen={() => setSelectedId(a.id)}
                      onDelete={() => void deleteFromCard(a)}
                      onDownload={() => {
                        if (!a.url) return
                        const link = document.createElement('a')
                        link.href = a.url
                        link.download = a.filename ?? 'asset'
                        link.target = '_blank'
                        link.rel = 'noopener noreferrer'
                        document.body.appendChild(link)
                        link.click()
                        link.remove()
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Drop hint overlay */}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[10px] bg-cream/80 text-[14px] font-semibold text-green">
            Drop image{rules ? 's' : ''} to upload
          </div>
        )}
      </div>

      {/* ── Drawer ──────────────────────────────────────────── */}
      {selected && (
        <AssetDrawer
          asset={toCardModel(selected, kind)}
          extras={{
            widthPx:    selected.widthPx,
            heightPx:   selected.heightPx,
            bytesSize:  selected.bytesSize,
            fileFormat: selected.fileFormat,
          } satisfies AssetDrawerExtras}
          scopeOptions={scopeOptions}
          onClose={() => setSelectedId(null)}
          onDeleted={() => handleDeleted(selected.id)}
          onRenamed={(next) => handleRenamed(selected.id, next)}
        />
      )}
    </>
  )
}

// ── Projection helpers ──────────────────────────────────────────────────────

function toCardModel(a: ServerAsset, kind: AssetTypeDb): AssetCardModel {
  return {
    id:                  a.id,
    kind,
    url:                 a.url,
    filename:            a.filename,
    displayName:         a.displayName,
    scopedPassportId:    a.scopedPassportId,
    scopedPassportTitle: a.scopedPassportTitle,
    source:              a.source,
    usageCount:          a.usageCount,
  }
}

// ── Bits ────────────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 rounded-[8px] border-[1.5px] px-3 text-sm font-medium transition-colors ${
        active
          ? 'border-ink bg-ink text-cream'
          : 'border-hairline bg-white text-muted hover:text-ink hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyState({ kind }: { kind: AssetTypeDb }) {
  const rules = KIND_RULES[kind]
  return (
    <div className="rounded-[12px] border-2 border-dashed border-hairline px-6 py-16 text-center">
      <h2 className="text-base font-semibold text-ink">{rules.emptyHeading}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{rules.emptyBody}</p>
      <p className="mt-4 text-[11px] text-muted">Drag files here or use the Upload button.</p>
    </div>
  )
}

function NoMatchState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-[8px] border border-surface-faintdiv bg-white py-12 text-center">
      <p className="text-sm text-muted">No assets match the current filter.</p>
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

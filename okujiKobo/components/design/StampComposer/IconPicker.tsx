'use client'

import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  ICON_CATEGORIES,
  LUCIDE_SEED,
  renderLucideToInner,
  resolveCustomIcon,
  type IconCategory,
  type SeedEntry,
} from '@/lib/design/stamp-composer/icons'

/**
 * Icon picker — overlay above the stamp composer modal.
 *
 * Searchable + categorized; on pick, resolves the icon's inner
 * SVG markup (lucide render today, custom-folder SVG file later)
 * and hands back { iconKey, svgContent, viewBox } so the caller
 * can build a fully-self-contained IconElement.
 */
export function IconPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (icon: { iconKey: string; svgContent: string; viewBox: string }) => void
}) {
  const [query,    setQuery]    = useState('')
  const [category, setCategory] = useState<IconCategory | 'all'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LUCIDE_SEED.filter((e) => {
      if (category !== 'all' && e.category !== category) return false
      if (q === '') return true
      if (e.iconKey.includes(q) || e.label.toLowerCase().includes(q)) return true
      return (e.keywords ?? []).some((k) => k.includes(q))
    })
  }, [query, category])

  const groupedByCategory = useMemo(() => {
    const groups = new Map<IconCategory, SeedEntry[]>()
    for (const e of filtered) {
      const list = groups.get(e.category) ?? []
      list.push(e)
      groups.set(e.category, list)
    }
    return groups
  }, [filtered])

  async function handlePick(entry: SeedEntry) {
    // Prefer a custom folder SVG when one exists; fall back to
    // lucide. The split keeps the swap-in seamless when the
    // okuji set ships.
    const custom = await resolveCustomIcon(entry.iconKey)
    const resolved = custom ?? await renderLucideToInner(entry.iconKey, entry.Component)
    onPick({ iconKey: entry.iconKey, svgContent: resolved.inner, viewBox: resolved.viewBox })
    onClose()
  }

  if (!open) return null
  const root = typeof document !== 'undefined' ? document.body : null
  if (!root) return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[min(680px,100%)] w-[min(720px,100%)] flex-col overflow-hidden rounded-[12px] border border-hairline bg-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-hairline px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Pick an icon</p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nature · creatures · places…"
            autoFocus
            className="flex-1 rounded-[6px] border-[1.5px] border-hairline bg-white px-2 py-1 text-[13px] text-ink focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border-[1.5px] border-hairline bg-white px-3 py-1 text-[12px] font-semibold text-muted hover:text-ink"
          >
            Cancel
          </button>
        </header>

        <div className="flex items-center gap-1.5 border-b border-hairline px-4 py-2">
          <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>All</CategoryChip>
          {ICON_CATEGORIES.map((c) => (
            <CategoryChip key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
              {c.label}
            </CategoryChip>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-[12px] text-muted">No matches.</p>
          ) : (
            ICON_CATEGORIES.map((cat) => {
              const rows = groupedByCategory.get(cat.key)
              if (!rows || rows.length === 0) return null
              return (
                <section key={cat.key} className="mb-5 last:mb-0">
                  <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[1.5px] text-muted">
                    {cat.label} <span className="text-hairline">· {rows.length}</span>
                  </p>
                  <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                    {rows.map((e) => (
                      <IconTile key={e.iconKey} entry={e} onClick={() => void handlePick(e)} />
                    ))}
                  </div>
                </section>
              )
            })
          )}
          <p className="mt-4 text-[10px] text-muted">
            Seed: lucide-react. The custom okuji icon set is a drop-in swap to
            <code className="mx-1 rounded bg-surface-workspace px-1 py-0.5 text-[10px]">public/stamp-icons/</code>
            — no code change required.
          </p>
        </div>
      </div>
    </div>,
    root,
  )
}

function CategoryChip({
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
      className={`h-7 rounded-[6px] border-[1.5px] px-2 text-[11.5px] font-medium transition-colors ${
        active
          ? 'border-ink bg-ink text-cream'
          : 'border-hairline bg-white text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function IconTile({ entry, onClick }: { entry: SeedEntry; onClick: () => void }) {
  const Icon = entry.Component
  // Suppress hydration-mismatch warnings on the SVG aria
  // attributes that lucide-react adds.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <button
      type="button"
      onClick={onClick}
      title={entry.label}
      className="group flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[6px] border border-surface-faintdiv bg-white p-1.5 text-ink hover:border-ink/40 hover:bg-cream"
    >
      {mounted && <Icon className="h-5 w-5" strokeWidth={1.75} />}
      <span className="line-clamp-1 w-full text-center text-[8.5px] text-muted group-hover:text-ink">
        {entry.label}
      </span>
    </button>
  )
}

'use client'

import { type ActiveFilters, labelForFilter } from './FilterRail'

export type SortKey = 'newest' | 'name' | 'acknowledged'

export function StopsToolbar({
  shown,
  total,
  filters,
  onRemoveFilter,
  sort,
  onSort,
}: {
  shown: number
  total: number
  filters: ActiveFilters
  onRemoveFilter: (kind: keyof ActiveFilters, value: string) => void
  sort: SortKey
  onSort: (s: SortKey) => void
}) {
  // Flat list of active filters for chip rendering.
  const activeChips: { kind: keyof ActiveFilters; value: string; label: string }[] = []
  for (const k of ['themes', 'grades', 'subjects'] as const) {
    for (const v of Array.from(filters[k])) {
      activeChips.push({ kind: k, value: v, label: labelForFilter(k, v) })
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] text-muted">
          {shown === total ? `${total} stop${total === 1 ? '' : 's'}` : `${shown} of ${total} shown`}
        </p>
        {activeChips.map((c) => (
          <button
            key={`${c.kind}-${c.value}`}
            type="button"
            onClick={() => onRemoveFilter(c.kind, c.value)}
            title={`Remove ${c.label}`}
            className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-hairline bg-white px-2 py-0.5 text-[11px] text-ink hover:border-ink/40"
          >
            {c.label}
            <span aria-hidden="true" className="text-muted">×</span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as SortKey)}
          className="h-9 rounded-[8px] border-[1.5px] border-hairline bg-white px-2 text-sm text-ink focus:border-ink focus:outline-none"
        >
          <option value="newest">Newest</option>
          <option value="name">A–Z</option>
          <option value="acknowledged">Most acknowledged</option>
        </select>
      </label>
    </div>
  )
}

'use client'

import type { ReactNode } from 'react'

export type AccessFilter = 'all' | 'people' | 'institutions' | 'transfers'
export type AccessSort   = 'recent' | 'name' | 'tier' | 'expiry'

const SORT_OPTIONS: { value: AccessSort; label: string }[] = [
  { value: 'recent', label: 'Recently active' },
  { value: 'name',   label: 'Name A–Z' },
  { value: 'tier',   label: 'Tier' },
  { value: 'expiry', label: 'Expiring soonest' },
]

const FILTERS: { value: AccessFilter; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'people',       label: 'People' },
  { value: 'institutions', label: 'Institutions' },
  { value: 'transfers',    label: 'Pending transfers' },
]

/**
 * One compact toolbar for the master/detail rewrite.
 *
 * Layout: search ↔ filter chips ↔ sort ↔ primary "+ Grant comp".
 * For manager visits, the primary is disabled with a tooltip
 * naming the missing RLS — never hidden, so the affordance is
 * discoverable when it lights up.
 */
export function AccessToolbar({
  search,
  onSearch,
  filter,
  onFilter,
  sort,
  onSort,
  isAdmin,
  onGrantComp,
}: {
  search: string
  onSearch: (v: string) => void
  filter: AccessFilter
  onFilter: (v: AccessFilter) => void
  sort: AccessSort
  onSort: (v: AccessSort) => void
  isAdmin: boolean
  onGrantComp: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <span className="sr-only">Search</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">⌕</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search people & institutions…"
            className="h-9 w-[300px] rounded-[8px] border-[1.5px] border-hairline bg-white pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
          />
        </label>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <Chip key={f.value} active={filter === f.value} onClick={() => onFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => onSort(e.target.value as AccessSort)}
            className="h-9 rounded-[8px] border-[1.5px] border-hairline bg-white px-2 text-sm text-ink focus:border-ink focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {/* TODO: needs RLS change on comp_subscriptions if managers should grant comps */}
        <button
          type="button"
          onClick={onGrantComp}
          disabled={!isAdmin}
          title={isAdmin ? undefined : 'Comp grants are admin-only today'}
          className={`inline-flex h-9 items-center rounded-[8px] border-[1.5px] px-3 text-sm font-semibold transition-colors ${
            isAdmin
              ? 'border-ink bg-green text-white hover:bg-green/90'
              : 'cursor-not-allowed border-hairline bg-white text-hairline'
          }`}
        >
          + Grant comp
        </button>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
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

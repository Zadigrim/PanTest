'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterState {
  distanceMiles: number | null   // null = any distance
  budgets: string[]
  types: string[]
  accessibleOnly: boolean
  travelerType: string | null
  sortBy: 'quality' | 'distance' | 'newest' | 'most_completed' | 'price_asc' | 'price_desc'
}

export interface FilterBarProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

// ─── Option constants ─────────────────────────────────────────────────────────

const DISTANCE_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Near me (any)',  value: null },
  { label: 'Within 1 mi',   value: 1 },
  { label: 'Within 5 mi',   value: 5 },
  { label: 'Within 10 mi',  value: 10 },
  { label: 'Within 25 mi',  value: 25 },
  { label: 'Within 50 mi',  value: 50 },
]

const BUDGET_OPTIONS: { label: string; value: string }[] = [
  { label: 'Free',       value: 'free' },
  { label: 'Under $15',  value: 'under_15' },
  { label: '$15–$50',    value: '15_50' },
  { label: '$50–$150',   value: '50_150' },
  { label: '$150–$500',  value: '150_500' },
  { label: '$500+',      value: '500_plus' },
]

const TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Learning',        value: 'learning' },
  { label: 'Heritage',        value: 'heritage' },
  { label: 'Challenge',       value: 'challenge' },
  { label: 'Food & Drink',    value: 'food_drink' },
  { label: 'Nature',          value: 'nature' },
  { label: 'Arts & Culture',  value: 'arts_culture' },
  { label: 'Family',          value: 'family' },
  { label: 'Neighborhood',    value: 'neighborhood' },
  { label: 'Tour',            value: 'tour' },
]

const TRAVELER_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Solo',         value: 'solo' },
  { label: 'Couples',      value: 'couples' },
  { label: 'Families',     value: 'families' },
  { label: 'Groups',       value: 'groups' },
  { label: 'Students',     value: 'students' },
  { label: 'Seniors',      value: 'seniors' },
  { label: 'Accessibility needs', value: 'accessibility' },
]

const SORT_OPTIONS: { label: string; value: FilterState['sortBy'] }[] = [
  { label: 'Best quality',   value: 'quality' },
  { label: 'Distance',       value: 'distance' },
  { label: 'Newest',         value: 'newest' },
  { label: 'Most completed', value: 'most_completed' },
  { label: 'Price: low–high',value: 'price_asc' },
  { label: 'Price: high–low',value: 'price_desc' },
]

// ─── Shared select style ──────────────────────────────────────────────────────

const SELECT_BASE =
  'h-11 cursor-pointer appearance-none rounded-card border border-hairline bg-white ' +
  'pl-3 pr-7 text-xs text-navy transition-colors ' +
  'hover:border-green focus:outline-none focus:ring-2 focus:ring-green ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

// Wrapper that adds the chevron caret via a pseudo-element replacement (inline SVG bg)
const SELECT_WRAPPER = 'relative inline-flex shrink-0'
const SELECT_CARET =
  "pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted"

// ─── Multi-select pill helper ─────────────────────────────────────────────────

/** Returns a display label for a multi-select filter chip. */
function multiLabel(
  selected: string[],
  options: { label: string; value: string }[],
  placeholder: string
): string {
  if (selected.length === 0) return placeholder
  if (selected.length === 1) {
    return options.find(o => o.value === selected[0])?.label ?? placeholder
  }
  return `${selected.length} selected`
}

// ─── Multi-select popover ─────────────────────────────────────────────────────

interface MultiSelectProps {
  label: string
  options: { label: string; value: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}

function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const displayLabel = multiLabel(selected, options, label)
  const isActive = selected.length > 0

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev: boolean) => !prev)}
        className={cn(
          'flex h-11 items-center gap-1 rounded-card border px-3 text-xs transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-green',
          isActive
            ? 'border-green bg-cream text-green font-medium'
            : 'border-hairline bg-white text-navy hover:border-green'
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {displayLabel}
        <svg
          className={cn('ml-0.5 h-3 w-3 transition-transform', open && 'rotate-180')}
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className={cn(
            'absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-panel border border-hairline',
            'bg-white py-1 shadow-lg'
          )}
        >
          {options.map(opt => {
            const checked = selected.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(opt.value)}
                className={cn(
                  'flex min-h-[44px] w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                  'hover:bg-paper',
                  checked ? 'text-green font-medium' : 'text-navy'
                )}
              >
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                    checked
                      ? 'border-green bg-green text-white'
                      : 'border-muted'
                  )}
                  aria-hidden="true"
                >
                  {checked && (
                    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            )
          })}
          {selected.length > 0 && (
            <>
              <hr className="my-1 border-hairline" />
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false) }}
                className="flex min-h-[44px] w-full items-center px-3 py-1.5 text-left text-xs text-muted hover:text-accent transition-colors"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  // Distance select value as string for <select>
  const distanceValue = filters.distanceMiles === null ? '' : String(filters.distanceMiles)

  function handleDistanceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const raw = e.target.value
    set('distanceMiles', raw === '' ? null : Number(raw))
  }

  function handleTravelerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const raw = e.target.value
    set('travelerType', raw === '' ? null : raw)
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    set('sortBy', e.target.value as FilterState['sortBy'])
  }

  return (
    <div
      className={cn(
        'sticky top-0 z-30 bg-white border-b border-hairline',
        'overflow-x-auto scrollbar-none'
      )}
      role="search"
      aria-label="Passport filters"
    >
      <div className="flex items-center gap-2 px-4 py-2 min-w-max">

        {/* ── Near me ─────────────────────────────────────────────────────── */}
        <div className={SELECT_WRAPPER}>
          <select
            value={distanceValue}
            onChange={handleDistanceChange}
            className={SELECT_BASE}
            aria-label="Distance filter"
          >
            {DISTANCE_OPTIONS.map(opt => (
              <option key={String(opt.value)} value={opt.value === null ? '' : String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className={SELECT_CARET} aria-hidden="true">
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {/* ── Budget ──────────────────────────────────────────────────────── */}
        <MultiSelect
          label="Budget"
          options={BUDGET_OPTIONS}
          selected={filters.budgets}
          onChange={v => set('budgets', v)}
        />

        {/* ── Type ────────────────────────────────────────────────────────── */}
        <MultiSelect
          label="Type"
          options={TYPE_OPTIONS}
          selected={filters.types}
          onChange={v => set('types', v)}
        />

        {/* ── Accessible toggle ────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => set('accessibleOnly', !filters.accessibleOnly)}
          className={cn(
            'flex h-11 items-center gap-1.5 rounded-card border px-3 text-xs transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-green',
            filters.accessibleOnly
              ? 'border-green bg-cream text-green font-medium'
              : 'border-hairline bg-white text-navy hover:border-green'
          )}
          aria-pressed={filters.accessibleOnly}
        >
          <span aria-hidden="true">♿</span>
          Accessible
        </button>

        {/* ── Traveler type ────────────────────────────────────────────────── */}
        <div className={SELECT_WRAPPER}>
          <select
            value={filters.travelerType ?? ''}
            onChange={handleTravelerChange}
            className={cn(
              SELECT_BASE,
              filters.travelerType && 'border-green text-green font-medium'
            )}
            aria-label="Traveler type filter"
          >
            <option value="">Traveler type</option>
            {TRAVELER_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className={SELECT_CARET} aria-hidden="true">
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="h-5 w-px shrink-0 bg-hairline" aria-hidden="true" />

        {/* ── Sort ────────────────────────────────────────────────────────── */}
        <div className={SELECT_WRAPPER}>
          <select
            value={filters.sortBy}
            onChange={handleSortChange}
            className={SELECT_BASE}
            aria-label="Sort order"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className={SELECT_CARET} aria-hidden="true">
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}

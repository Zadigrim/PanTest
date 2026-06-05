'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { FilterRail, type ActiveFilters } from './FilterRail'
import { StopGrid } from './StopGrid'
import { StopDrawer } from './StopDrawer'
import { StopsToolbar, type SortKey } from './StopsToolbar'
import type { DraftPassport, StopCardData } from './types'

type TabKey = 'browse' | 'imports' | 'shared'

/**
 * Stop Library orchestrator.
 *
 * Owns: active tab, search + filters + sort, selected stop for
 * the drawer. URL-mirrors via ?tab=… and ?focus=… so the page
 * is shareable and back/forward navigate selection. The server
 * page does the heavy data work; this client just slices.
 */
export function StopsClient({
  stops,
  drafts,
  mySharedIds,
  myImportedSourceIds,
  isInstitutional,
  canWriteComments,
}: {
  stops: StopCardData[]
  drafts: DraftPassport[]
  mySharedIds: string[]
  myImportedSourceIds: string[]
  isInstitutional: boolean
  canWriteComments: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const sharedSet   = useMemo(() => new Set(mySharedIds), [mySharedIds])
  const importedSet = useMemo(() => new Set(myImportedSourceIds), [myImportedSourceIds])

  const [tab, setTab] = useState<TabKey>(() => {
    const t = searchParams.get('tab')
    if (t === 'imports' || t === 'shared') return t as TabKey
    return 'browse'
  })
  const [search,  setSearch]  = useState('')
  const [filters, setFilters] = useState<ActiveFilters>({
    themes: new Set(), grades: new Set(), subjects: new Set(),
  })
  const [sort,    setSort]    = useState<SortKey>('newest')
  const [focusedId, setFocusedId] = useState<string | null>(null)

  // URL sync — tab + focus.
  useEffect(() => {
    const t = searchParams.get('tab')
    const next: TabKey = t === 'imports' || t === 'shared' ? (t as TabKey) : 'browse'
    if (next !== tab) setTab(next)
    const f = searchParams.get('focus')
    if (f && f !== focusedId) setFocusedId(f)
    else if (!f && focusedId !== null) setFocusedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const writeUrl = useCallback((next: { tab?: TabKey; focus?: string | null }) => {
    const sp = new URLSearchParams(searchParams.toString())
    if (next.tab !== undefined) sp.set('tab', next.tab)
    if ('focus' in next) {
      if (next.focus) sp.set('focus', next.focus)
      else            sp.delete('focus')
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  // Tab counts derived from the full stop set.
  const tabCounts = useMemo(() => ({
    browse:  stops.length,
    imports: stops.filter((s) => importedSet.has(s.id)).length,
    shared:  stops.filter((s) => sharedSet.has(s.id)).length,
  }), [stops, importedSet, sharedSet])

  // Active set per tab, then filtered + sorted.
  const view = useMemo(() => {
    const base =
      tab === 'imports' ? stops.filter((s) => importedSet.has(s.id))
      : tab === 'shared'  ? stops.filter((s) => sharedSet.has(s.id))
      : stops
    const q = search.trim().toLowerCase()
    const filtered = base.filter((s) => {
      if (q && !matchesSearch(s, q)) return false
      if (filters.themes.size  > 0 && !arrayIntersects(s.classifiers,  filters.themes))   return false
      if (filters.grades.size  > 0 && !arrayIntersects(s.grade_levels, filters.grades))   return false
      if (filters.subjects.size > 0 && !arrayIntersects(s.subject_areas, filters.subjects)) return false
      return true
    })
    return [...filtered].sort((a, b) => compare(a, b, sort))
  }, [stops, tab, search, filters, sort, importedSet, sharedSet])

  const focused = useMemo(
    () => focusedId ? view.find((s) => s.id === focusedId) ?? stops.find((s) => s.id === focusedId) ?? null : null,
    [view, stops, focusedId],
  )

  const removeFilter = useCallback(
    (kind: 'themes' | 'grades' | 'subjects', value: string) => {
      setFilters((prev) => {
        const next = new Set(prev[kind])
        next.delete(value)
        return { ...prev, [kind]: next }
      })
    }, [],
  )

  return (
    <div>
      {/* Tabs */}
      <div role="tablist" aria-label="Stop Library tabs" className="mb-5 flex gap-6 border-b border-hairline">
        <TabHandle active={tab === 'browse'}  onClick={() => { setTab('browse');  writeUrl({ tab: 'browse'  }) }}>
          Browse <Count n={tabCounts.browse} />
        </TabHandle>
        <TabHandle
          active={tab === 'imports'}
          onClick={() => { setTab('imports'); writeUrl({ tab: 'imports' }) }}
        >
          My imports <Count n={tabCounts.imports} />
        </TabHandle>
        {isInstitutional && (
          <TabHandle
            active={tab === 'shared'}
            onClick={() => { setTab('shared'); writeUrl({ tab: 'shared' }) }}
          >
            Shared by me <Count n={tabCounts.shared} />
          </TabHandle>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <FilterRail
          search={search}
          onSearch={setSearch}
          filters={filters}
          onChange={setFilters}
        />

        <div>
          <StopsToolbar
            shown={view.length}
            total={tabCounts[tab]}
            filters={filters}
            onRemoveFilter={removeFilter}
            sort={sort}
            onSort={setSort}
          />

          <StopGrid
            stops={view}
            onOpen={(id) => { setFocusedId(id); writeUrl({ focus: id }) }}
            focusedId={focusedId}
          />
        </div>
      </div>

      <StopDrawer
        open={!!focused}
        stop={focused}
        drafts={drafts}
        canWriteComments={canWriteComments}
        onClose={() => { setFocusedId(null); writeUrl({ focus: null }) }}
      />
    </div>
  )
}

// ── Tab handle ──
function TabHandle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-1 pb-2 pt-1 text-[14px] font-semibold transition-colors ${
        active
          ? 'border-green text-ink'
          : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
function Count({ n }: { n: number }) {
  return <span className="ml-1.5 text-[11px] text-muted">{n}</span>
}

// ── Helpers ──
function matchesSearch(s: StopCardData, q: string): boolean {
  if (s.name.toLowerCase().includes(q)) return true
  if ((s.learning_objective ?? '').toLowerCase().includes(q)) return true
  if ((s.creator_name ?? '').toLowerCase().includes(q)) return true
  if ((s.institution_name ?? '').toLowerCase().includes(q)) return true
  if ((s.address_city ?? '').toLowerCase().includes(q)) return true
  return false
}
function arrayIntersects(arr: string[] | null | undefined, set: Set<string>): boolean {
  if (!arr || arr.length === 0) return false
  for (const v of arr) if (set.has(v)) return true
  return false
}
function compare(a: StopCardData, b: StopCardData, sort: SortKey): number {
  switch (sort) {
    case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    case 'name':   return a.name.localeCompare(b.name)
    case 'acknowledged':
      return (b.acknowledgment_count - a.acknowledgment_count) || a.name.localeCompare(b.name)
  }
}

'use client'

import { useMemo, useState } from 'react'
import type { AccessEntityRow, AccessKind } from './types'
import { AccessList } from './AccessList'
import { AccessToolbar, type AccessFilter, type AccessSort } from './AccessToolbar'
import { PersonDetailPanel } from './PersonDetailPanel'
import { InstitutionDetailPanel } from './InstitutionDetailPanel'
import { EmptyDetailPanel } from './EmptyDetailPanel'

/**
 * Master/detail orchestrator for /access.
 *
 * Owns:
 *   - search + filter + sort state
 *   - the selected entity (kind + id)
 *
 * Doesn't fetch — the server page hands it the full row set.
 * Detail panels do their own lazy data loads (history, transfers
 * with passport titles, etc.) so the initial server payload
 * stays small.
 */
export function AccessClient({
  rows,
  isAdmin,
  currentUserId,
  managedInstitutionIds,
}: {
  rows: AccessEntityRow[]
  isAdmin: boolean
  currentUserId: string
  managedInstitutionIds: string[]
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AccessFilter>('all')
  const [sort, setSort] = useState<AccessSort>('recent')
  const [selection, setSelection] = useState<{ kind: AccessKind; id: string } | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (filter === 'people'        && r.kind !== 'person')       return false
        if (filter === 'institutions'  && r.kind !== 'institution')  return false
        if (filter === 'transfers'     && r.transferCount === 0)     return false
        return true
      })
      .filter((r) => q === '' || r.name.toLowerCase().includes(q))
      .sort((a, b) => compare(a, b, sort))
  }, [rows, search, filter, sort])

  const selected = useMemo(
    () => selection ? rows.find((r) => r.kind === selection.kind && r.id === selection.id) ?? null : null,
    [rows, selection],
  )

  return (
    <div>
      <AccessToolbar
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
        sort={sort}
        onSort={setSort}
        isAdmin={isAdmin}
        onGrantComp={() => {
          // TODO: when manager comp-grant lands, drop the disabled
          // gate and route this to a small chooser if no one is
          // selected. Admin: open the grant flow inside the
          // currently-selected person's panel, or surface a chooser.
          if (selected?.kind === 'person') {
            // Selecting the person already shows the grant button
            // in their panel; we just scroll the panel into view.
            const panel = document.getElementById('access-detail-panel')
            panel?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } else {
            window.alert('Pick a person first to grant them a Pro / Studio comp.')
          }
        }}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <AccessList
          rows={filtered}
          selectedKey={selection ? `${selection.kind}:${selection.id}` : null}
          onSelect={(kind, id) => setSelection({ kind, id })}
          totalAll={rows.length}
        />

        <div
          id="access-detail-panel"
          className="min-h-[360px] rounded-[10px] border border-surface-faintdiv bg-white"
        >
          {!selected ? (
            <EmptyDetailPanel />
          ) : selected.kind === 'person' ? (
            <PersonDetailPanel
              row={selected}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
            />
          ) : (
            <InstitutionDetailPanel
              row={selected}
              isAdmin={isAdmin}
              managedInstitutionIds={managedInstitutionIds}
              currentUserId={currentUserId}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sort comparator ─────────────────────────────────────────────────────────

function compare(a: AccessEntityRow, b: AccessEntityRow, sort: AccessSort): number {
  switch (sort) {
    case 'recent':
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    case 'name':
      return a.name.localeCompare(b.name)
    case 'tier':
      // Studio first, then Pro, then institutions by their tier
      // (alpha — preserves order without baking in business
      // priority that may change).
      return tierWeight(a) - tierWeight(b) || a.name.localeCompare(b.name)
    case 'expiry':
      // Nulls last; soonest-expiring first.
      if (a.expiresAt === null && b.expiresAt === null) return 0
      if (a.expiresAt === null) return 1
      if (b.expiresAt === null) return -1
      return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
  }
}

function tierWeight(r: AccessEntityRow): number {
  if (r.kind === 'person') {
    if (r.tier === 'studio') return 0
    if (r.tier === 'pro') return 1
    return 4
  }
  // Institutions ranked roughly: paid commercial > regional > others > free.
  const inst = (r.tier ?? '').toLowerCase()
  if (inst.includes('enterprise')) return 2
  if (inst.includes('regional')) return 2.5
  if (inst.includes('community')) return 3
  return 3.5
}

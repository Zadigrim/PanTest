'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
 *   - search + filter + sort state (in-memory)
 *   - the selected entity (kind + id) — mirrored to ?focus=kind:id
 *     so links are shareable and back/forward navigation works
 *   - keyboard nav (↑ / ↓ within the visible list, Enter focuses
 *     the detail panel)
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AccessFilter>('all')
  const [sort, setSort] = useState<AccessSort>('recent')
  const [selection, setSelection] = useState<{ kind: AccessKind; id: string } | null>(null)

  // ── URL ←→ selection sync ──
  // Read once on mount and whenever the back/forward button fires
  // a new searchParams reference. Selection writes go through
  // setSelectionAndUrl which uses router.replace (no history
  // entries for transient clicks).
  useEffect(() => {
    const focus = searchParams.get('focus')
    if (!focus) {
      if (selection !== null) setSelection(null)
      return
    }
    const [kind, id] = focus.split(':')
    if ((kind === 'person' || kind === 'institution') && id) {
      const next = { kind: kind as AccessKind, id }
      if (selection?.kind !== next.kind || selection?.id !== next.id) {
        setSelection(next)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setSelectionAndUrl = useCallback(
    (next: { kind: AccessKind; id: string } | null) => {
      setSelection(next)
      const sp = new URLSearchParams(searchParams.toString())
      if (next) sp.set('focus', `${next.kind}:${next.id}`)
      else      sp.delete('focus')
      const qs = sp.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  // ── Filtering + sorting ──
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

  // ── Keyboard nav (↑ / ↓) ──
  // Scoped to the list region so typing in the search box
  // doesn't trigger row moves. The list region attaches its own
  // keydown handler via onKeyDown.
  const listRegionRef = useRef<HTMLDivElement>(null)
  const onListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filtered.length === 0) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()

      const currentIdx = selection
        ? filtered.findIndex((r) => r.kind === selection.kind && r.id === selection.id)
        : -1
      let nextIdx: number
      if (e.key === 'ArrowDown') nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, filtered.length - 1)
      else                        nextIdx = currentIdx <= 0 ? filtered.length - 1 : currentIdx - 1
      const next = filtered[nextIdx]
      setSelectionAndUrl({ kind: next.kind, id: next.id })
    },
    [filtered, selection, setSelectionAndUrl],
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
        onGrantComp={() => {
          // Anyone with a person selected can attempt to grant; RLS
          // gates the actual mutation per migration 054.
          if (selected?.kind === 'person') {
            const panel = document.getElementById('access-detail-panel')
            panel?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } else {
            window.alert('Pick a person first to grant them a Pro / Studio comp.')
          }
        }}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div
          ref={listRegionRef}
          role="region"
          aria-label="People and institutions"
          tabIndex={0}
          onKeyDown={onListKeyDown}
          className="focus:outline-none"
        >
          <AccessList
            rows={filtered}
            selectedKey={selection ? `${selection.kind}:${selection.id}` : null}
            onSelect={(kind, id) => setSelectionAndUrl({ kind, id })}
            totalAll={rows.length}
            anyRowsAtAll={rows.length > 0}
            activeFilter={filter}
            hasSearch={search.trim().length > 0}
          />
        </div>

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
      return tierWeight(a) - tierWeight(b) || a.name.localeCompare(b.name)
    case 'expiry':
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
  const inst = (r.tier ?? '').toLowerCase()
  if (inst.includes('enterprise')) return 2
  if (inst.includes('regional')) return 2.5
  if (inst.includes('community')) return 3
  return 3.5
}

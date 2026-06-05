'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { UsersToolbar, type UsersRoleFilter, type UsersPlanFilter } from './UsersToolbar'
import { UsersTable } from './UsersTable'
import { PersonDetailPanel } from './PersonDetailPanel'
import { EmptyDetailPanel } from './EmptyDetailPanel'
import type { PersonRow } from './types'

export function UsersTab({
  people,
  isAdmin,
  currentUserId,
}: {
  people: PersonRow[]
  isAdmin: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<UsersRoleFilter>('all')
  const [plan, setPlan] = useState<UsersPlanFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // URL ↔ selection sync. Encoded as ?focus=person:<id>.
  useEffect(() => {
    const f = searchParams.get('focus')
    if (!f) { if (selectedId !== null) setSelectedId(null); return }
    const [kind, id] = f.split(':')
    if (kind === 'person' && id && id !== selectedId) setSelectedId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setSelectedAndUrl = useCallback((id: string | null) => {
    setSelectedId(id)
    const sp = new URLSearchParams(searchParams.toString())
    if (id) sp.set('focus', `person:${id}`); else sp.delete('focus')
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return people.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (role === 'admin' && !p.isPlatformAdmin) return false
      if (role === 'creator' && (p.legacyRole ?? '').toLowerCase() !== 'creator') return false
      if (role === 'collector' && (p.legacyRole ?? '').toLowerCase() !== 'collector') return false
      if (plan === 'free' && p.tier !== null) return false
      if (plan === 'pro' && p.tier !== 'pro') return false
      if (plan === 'studio' && p.tier !== 'studio') return false
      if (plan === 'paid' && p.tierSource !== 'paid') return false
      if (plan === 'comp' && p.tierSource !== 'comp') return false
      return true
    })
  }, [people, search, role, plan])

  const selected = useMemo(
    () => selectedId ? people.find((p) => p.id === selectedId) ?? null : null,
    [people, selectedId],
  )

  // Keyboard nav — region-scoped to the list, doesn't fire while
  // typing in the search input.
  const onListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filtered.length === 0) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const idx = selectedId ? filtered.findIndex((p) => p.id === selectedId) : -1
    const next = e.key === 'ArrowDown'
      ? (idx < 0 ? 0 : Math.min(idx + 1, filtered.length - 1))
      : (idx <= 0 ? filtered.length - 1 : idx - 1)
    setSelectedAndUrl(filtered[next].id)
  }, [filtered, selectedId, setSelectedAndUrl])

  return (
    <div>
      <UsersToolbar
        search={search} onSearch={setSearch}
        role={role}     onRole={setRole}
        plan={plan}     onPlan={setPlan}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div
          role="region"
          aria-label="Users"
          tabIndex={0}
          onKeyDown={onListKeyDown}
          className="focus:outline-none"
        >
          <UsersTable
            rows={filtered}
            totalAll={people.length}
            selectedId={selectedId}
            onSelect={setSelectedAndUrl}
          />
        </div>

        <div className="min-h-[360px] rounded-[10px] border-l-[1.5px] border-l-ink border border-surface-faintdiv bg-white">
          {!selected
            ? <EmptyDetailPanel />
            : <PersonDetailPanel
                row={selected}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
              />}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { InstitutionsToolbar, type InstAccessFilter } from './InstitutionsToolbar'
import { InstitutionsTable } from './InstitutionsTable'
import { InstitutionDetailPanel } from './InstitutionDetailPanel'
import { EmptyDetailPanel } from './EmptyDetailPanel'
import type { InstitutionRow } from './types'

export function InstitutionsTab({
  institutions,
  isAdmin,
  managedInstitutionIds,
  currentUserId,
}: {
  institutions: InstitutionRow[]
  isAdmin: boolean
  managedInstitutionIds: string[]
  currentUserId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [access, setAccess] = useState<InstAccessFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const f = searchParams.get('focus')
    if (!f) { if (selectedId !== null) setSelectedId(null); return }
    const [kind, id] = f.split(':')
    if (kind === 'institution' && id && id !== selectedId) setSelectedId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setSelectedAndUrl = useCallback((id: string | null) => {
    setSelectedId(id)
    const sp = new URLSearchParams(searchParams.toString())
    if (id) sp.set('focus', `institution:${id}`); else sp.delete('focus')
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  // Distinct category list derived from the data — no hard-coded
  // enum, so adding a new institution_type lights up immediately.
  const categoryOptions = useMemo(() => {
    const s = new Set<string>()
    for (const i of institutions) if (i.institutionType) s.add(i.institutionType)
    return Array.from(s).sort()
  }, [institutions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return institutions.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false
      if (category !== 'all' && i.institutionType !== category) return false
      if (access === 'free-civic'  && i.accessKind !== 'free-civic')  return false
      if (access === 'commercial' && i.accessKind !== 'commercial') return false
      return true
    })
  }, [institutions, search, category, access])

  const selected = useMemo(
    () => selectedId ? institutions.find((i) => i.id === selectedId) ?? null : null,
    [institutions, selectedId],
  )

  const onListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filtered.length === 0) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const idx = selectedId ? filtered.findIndex((i) => i.id === selectedId) : -1
    const next = e.key === 'ArrowDown'
      ? (idx < 0 ? 0 : Math.min(idx + 1, filtered.length - 1))
      : (idx <= 0 ? filtered.length - 1 : idx - 1)
    setSelectedAndUrl(filtered[next].id)
  }, [filtered, selectedId, setSelectedAndUrl])

  return (
    <div>
      <InstitutionsToolbar
        search={search} onSearch={setSearch}
        category={category} onCategory={setCategory} categoryOptions={categoryOptions}
        access={access} onAccess={setAccess}
        isAdmin={isAdmin}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div
          role="region"
          aria-label="Institutions"
          tabIndex={0}
          onKeyDown={onListKeyDown}
          className="focus:outline-none"
        >
          <InstitutionsTable
            rows={filtered}
            totalAll={institutions.length}
            selectedId={selectedId}
            onSelect={setSelectedAndUrl}
          />
        </div>

        <div className="min-h-[360px] rounded-[10px] border-l-[1.5px] border-l-ink border border-surface-faintdiv bg-white">
          {!selected
            ? <EmptyDetailPanel />
            : <InstitutionDetailPanel
                row={selected}
                isAdmin={isAdmin}
                managedInstitutionIds={managedInstitutionIds}
                currentUserId={currentUserId}
              />}
        </div>
      </div>
    </div>
  )
}

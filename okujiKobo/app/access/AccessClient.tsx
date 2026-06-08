'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { UsersTab } from './UsersTab'
import { InstitutionsTab } from './InstitutionsTab'
import type { InstitutionRow, PersonRow } from './types'

type TabKey = 'institutions' | 'users'

/**
 * Two-tab Access Management orchestrator.
 *
 * Owns ONLY the active tab + URL state for it. Each tab owns its
 * own search / filter / selection state internally — the tabs
 * never co-mutate each other. URL parameter `tab` mirrors the
 * active tab; the focused row is encoded in the tab's own
 * `focus=person:<id>` / `focus=institution:<id>` parameter so
 * deep-links survive tab switches.
 */
export function AccessClient({
  people,
  institutions,
  isAdmin,
  currentUserId,
  managedInstitutionIds,
}: {
  people: PersonRow[]
  institutions: InstitutionRow[]
  isAdmin: boolean
  currentUserId: string
  managedInstitutionIds: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [tab, setTab] = useState<TabKey>(() => {
    const t = searchParams.get('tab')
    return t === 'users' ? 'users' : 'institutions'
  })

  useEffect(() => {
    const t = searchParams.get('tab')
    const next: TabKey = t === 'users' ? 'users' : 'institutions'
    if (next !== tab) setTab(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setTabAndUrl = useCallback(
    (next: TabKey) => {
      setTab(next)
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('tab', next)
      // Drop the focus param on tab change — it belongs to the
      // tab we're leaving, and re-applying it on a different
      // entity kind would be confusing.
      sp.delete('focus')
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  return (
    <div>
      <div role="tablist" aria-label="Access Management tabs" className="mb-4 flex items-center gap-6 border-b border-hairline">
        <TabHandle active={tab === 'institutions'} onClick={() => setTabAndUrl('institutions')}>
          Institutions <span className="ml-1.5 text-[11px] text-muted">{institutions.length}</span>
        </TabHandle>
        <TabHandle active={tab === 'users'} onClick={() => setTabAndUrl('users')}>
          Users <span className="ml-1.5 text-[11px] text-muted">{people.length}</span>
        </TabHandle>
        {/* Admin-only inspection entry. Read-only render of any
            passport for content-safety review; not linked from any
            non-admin chrome. */}
        {isAdmin && (
          <a
            href="/access/inspect"
            className="-mb-px ml-auto pb-2 pt-1 text-[12px] text-muted hover:text-ink"
          >
            Inspect passport →
          </a>
        )}
      </div>

      {tab === 'institutions' ? (
        <InstitutionsTab
          institutions={institutions}
          isAdmin={isAdmin}
          managedInstitutionIds={managedInstitutionIds}
          currentUserId={currentUserId}
        />
      ) : (
        <UsersTab
          people={people}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}

function TabHandle({
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

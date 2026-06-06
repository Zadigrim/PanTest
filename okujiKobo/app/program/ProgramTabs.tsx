'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

/**
 * Tab nav for the Program hub. Pure presentation — the tab state
 * lives in the URL (?tab=...) so deep links + back-button restore
 * the right view, and so the server can SSR each tab's content
 * directly.
 *
 * The Analytics tab additionally accepts ?passport=ID for the
 * drill-in mode (handled in AnalyticsTab); this nav doesn't surface
 * that state — clicking Analytics always lands on Aggregate, which
 * is the expected behavior when someone clicks the tab itself vs.
 * clicking a passport row.
 */

const TABS = [
  { key: 'overview',   label: 'Overview' },
  { key: 'passports',  label: 'Passports' },
  { key: 'employees',  label: 'Employees' },
  { key: 'prizes',     label: 'Prizes' },
  { key: 'analytics',  label: 'Analytics' },
  { key: 'terminal',   label: 'Terminal' },
] as const

export type ProgramTabKey = (typeof TABS)[number]['key']

export const PROGRAM_TAB_KEYS = TABS.map((t) => t.key) as readonly ProgramTabKey[]

export function ProgramTabs({ active }: { active: ProgramTabKey }) {
  const params = useSearchParams()
  void params  // not read; reserved for future filter-aware tabs

  return (
    <div className="border-b border-surface-faintdiv">
      <nav
        className="-mb-px flex flex-wrap gap-1 overflow-x-auto"
        aria-label="Program sections"
        role="tablist"
      >
        {TABS.map((t) => {
          const isActive = t.key === active
          return (
            <Link
              key={t.key}
              href={`/program?tab=${t.key}`}
              role="tab"
              aria-selected={isActive}
              className={`relative whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'text-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-green"
                />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

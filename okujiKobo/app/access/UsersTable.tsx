'use client'

import type { PersonRow } from './types'

/**
 * Users tab table.
 * Columns: Name · Role · Plan · Joined · ›
 */
export function UsersTable({
  rows,
  totalAll,
  selectedId,
  onSelect,
}: {
  rows: PersonRow[]
  totalAll: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11px] text-muted">
        {rows.length === totalAll ? `${totalAll} total` : `${rows.length} of ${totalAll} shown`}
      </p>

      <div className="overflow-hidden rounded-[10px] border border-surface-faintdiv bg-white">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-surface-faintdiv text-[10.5px] uppercase tracking-[1.5px] text-muted">
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Plan</Th>
              <Th>Joined</Th>
              <Th className="w-6 text-right" srLabel="Select" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[12px] text-muted">No matches.</td>
              </tr>
            ) : rows.map((r) => {
              const active = r.id === selectedId
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  aria-selected={active}
                  className={`cursor-pointer border-b border-surface-faintdiv last:border-0 transition-colors ${
                    active
                      ? 'bg-cream'
                      : 'hover:bg-surface-workspace'
                  }`}
                >
                  <Td className={active ? 'border-l-[3px] border-l-accent pl-2.5' : ''}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{r.name}</span>
                      {r.isPlatformAdmin && (
                        <span className="rounded-full border-[1.5px] border-navy bg-white px-1.5 text-[9.5px] font-semibold uppercase tracking-[1px] text-navy">
                          admin
                        </span>
                      )}
                      {r.transferCount > 0 && (
                        <span
                          title={`${r.transferCount} pending transfer${r.transferCount === 1 ? '' : 's'}`}
                          className="rounded-[6px] border-[1.5px] border-blue/40 bg-white px-1 text-[10px] font-semibold text-blue"
                        >
                          ↗{r.transferCount}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="text-muted">{r.legacyRole ?? '—'}</span>
                  </Td>
                  <Td>
                    <PlanChip row={r} />
                  </Td>
                  <Td>
                    <span className="text-muted">{fmt(r.joinedAt)}</span>
                  </Td>
                  <Td className="text-right text-muted">›</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Plan chip ─────────────────────────────────────────────────────────────────
// Free → muted; Studio → blue; Pro → accent (gold). `· comp` suffix
// for comp grants. Paid-source overrides into an amber/accent
// "Paid" tag with no revoke chrome — billing-managed.

function PlanChip({ row }: { row: PersonRow }) {
  if (row.tier === null) {
    return (
      <span className="inline-flex items-center rounded-full border-[1.5px] border-hairline bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted">
        Free
      </span>
    )
  }
  const isPaid = row.tierSource === 'paid'
  const tone = row.tier === 'studio'
    ? 'border-blue text-blue'
    : 'border-accent text-accent'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center rounded-full border-[1.5px] bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[1px] ${tone}`}>
        {row.tier === 'studio' ? 'Studio' : 'Pro'}
        {!isPaid && <span className="ml-1 normal-case tracking-normal text-muted">· comp</span>}
      </span>
      {isPaid && (
        <span className="inline-flex items-center rounded-full border-[1.5px] border-accent bg-accent/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[1px] text-accent">
          Paid
        </span>
      )}
    </span>
  )
}

// ── Cell helpers ──
function Th({ children, className = '', srLabel }: { children?: React.ReactNode; className?: string; srLabel?: string }) {
  return (
    <th className={`px-3 py-2 font-medium ${className}`}>
      {srLabel ? <span className="sr-only">{srLabel}</span> : children}
    </th>
  )
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

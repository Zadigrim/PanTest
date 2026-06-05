'use client'

import type { InstitutionRow } from './types'

/**
 * Institutions tab table.
 * Columns: Name · Category · Members · Passports · Access · ›
 *
 * No bare "—" cells: counts read as 0 explicitly; missing
 * category falls back to "—" only when truly null.
 */
export function InstitutionsTable({
  rows,
  totalAll,
  selectedId,
  onSelect,
}: {
  rows: InstitutionRow[]
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
              <Th>Category</Th>
              <Th className="text-right">Members</Th>
              <Th className="text-right">Passports</Th>
              <Th>Access</Th>
              <Th className="w-6 text-right" srLabel="Select" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-muted">No matches.</td>
              </tr>
            ) : rows.map((r) => {
              const active = r.id === selectedId
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  aria-selected={active}
                  className={`cursor-pointer border-b border-surface-faintdiv last:border-0 transition-colors ${
                    active ? 'bg-cream' : 'hover:bg-surface-workspace'
                  }`}
                >
                  <Td className={active ? 'border-l-[3px] border-l-accent pl-2.5' : ''}>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{r.name}</span>
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
                    <span className="text-muted">{r.institutionType ?? '—'}</span>
                  </Td>
                  <Td className="text-right tabular-nums text-ink">{r.memberCount}</Td>
                  <Td className="text-right tabular-nums text-ink">{r.passportCount}</Td>
                  <Td>
                    <AccessChip row={r} />
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

// ── Access chip ───────────────────────────────────────────────────────────────
// Free · civic (green) / commercial tier (blue) / unknown (muted).

function AccessChip({ row }: { row: InstitutionRow }) {
  if (row.accessKind === 'free-civic') {
    return (
      <span className="inline-flex items-center rounded-full border-[1.5px] border-green bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[1px] text-green">
        Free · civic
      </span>
    )
  }
  if (row.accessKind === 'commercial') {
    return (
      <span className="inline-flex items-center rounded-full border-[1.5px] border-blue bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[1px] text-blue">
        {row.tier ?? 'Commercial'}{row.pricingModel ? ` · ${row.pricingModel}` : ''}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border-[1.5px] border-hairline bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted">
      Unset
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

'use client'

import type { AccessEntityRow } from './types'

/**
 * Left column of the master/detail layout — merged list of
 * people + institutions. Active row gets an ink left border and
 * cream bg so the selection is unambiguous next to a busy
 * detail panel.
 */
export function AccessList({
  rows,
  selectedKey,
  onSelect,
  totalAll,
}: {
  rows: AccessEntityRow[]
  selectedKey: string | null
  onSelect: (kind: AccessEntityRow['kind'], id: string) => void
  totalAll: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11px] text-muted">
        {rows.length === totalAll
          ? `${totalAll} total`
          : `${rows.length} of ${totalAll} shown`}
      </p>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const key = `${row.kind}:${row.id}`
          const active = selectedKey === key
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(row.kind, row.id)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-[8px] border bg-white px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-l-[3px] border-l-ink border-surface-faintdiv bg-cream'
                    : 'border-surface-faintdiv hover:border-ink/40'
                }`}
              >
                <LetterChip row={row} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{row.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px]">
                    <KindPill row={row} />
                    <TierPill row={row} />
                  </p>
                </div>
                <RowTail row={row} />
              </button>
            </li>
          )
        })}
      </ul>
      {rows.length === 0 && (
        <p className="px-3 py-6 text-center text-[12px] text-muted">
          No matches.
        </p>
      )}
    </div>
  )
}

// ── Letter chip ────────────────────────────────────────────────────────────

function LetterChip({ row }: { row: AccessEntityRow }) {
  const letter = (row.name.trim().charAt(0) || '?').toUpperCase()
  const sq = row.kind === 'institution'
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center text-[13px] font-semibold ${
        sq
          ? 'rounded-[6px] border border-hairline bg-white text-ink'
          : 'rounded-full border border-hairline bg-white text-ink'
      }`}
      aria-hidden="true"
    >
      {letter}
    </span>
  )
}

// ── Kind pill ──────────────────────────────────────────────────────────────

function KindPill({ row }: { row: AccessEntityRow }) {
  if (row.kind === 'person') {
    return <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-muted">person</span>
  }
  return <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-blue">institution</span>
}

// ── Tier pill ──────────────────────────────────────────────────────────────

function TierPill({ row }: { row: AccessEntityRow }) {
  if (row.kind === 'person') {
    if (row.tier === null) return <span className="text-muted">— collector</span>
    const isPaid = row.tierSource === 'paid'
    const cls = row.tier === 'studio'
      ? (isPaid ? 'text-green' : 'text-accent')
      : (isPaid ? 'text-green/70' : 'text-accent/80')
    return (
      <span className={`font-semibold uppercase tracking-[1px] ${cls}`}>
        {row.tier} ({row.tierSource ?? '?'})
      </span>
    )
  }
  // institution
  const tier = row.tier ?? '—'
  return (
    <span className="font-semibold uppercase tracking-[1px] text-blue">
      {tier}{row.pricingModel ? ` · ${row.pricingModel}` : ''}
    </span>
  )
}

// ── Tail (expiry / transfer count) ─────────────────────────────────────────

function RowTail({ row }: { row: AccessEntityRow }) {
  const bits: { node: React.ReactNode; key: string }[] = []
  if (row.expiresAt) {
    const expDate = new Date(row.expiresAt)
    const daysOut = Math.round((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const expiringSoon = daysOut >= 0 && daysOut <= 14
    bits.push({
      key: 'exp',
      node: (
        <span className={`text-[10px] ${expiringSoon ? 'text-red' : 'text-muted'}`}>
          exp {expDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </span>
      ),
    })
  }
  if (row.transferCount > 0) {
    bits.push({
      key: 'xfer',
      node: (
        <span
          className="rounded-[6px] border border-blue/30 bg-white px-1.5 text-[10px] font-semibold text-blue"
          title={`${row.transferCount} pending transfer${row.transferCount === 1 ? '' : 's'}`}
        >
          ↗{row.transferCount}
        </span>
      ),
    })
  }
  if (bits.length === 0) return null
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {bits.map((b) => <span key={b.key}>{b.node}</span>)}
    </span>
  )
}

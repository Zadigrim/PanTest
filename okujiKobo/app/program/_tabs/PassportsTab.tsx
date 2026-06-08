import Link from 'next/link'
import {
  Card,
  Note,
  Pill,
  SectionLabel,
  InlineMetrics,
  EmptyState,
  statusToVariant,
  type Metric,
} from '@/components/program/ui'

/**
 * Program Passports tab — one Card per passport with the prize
 * text written on any page + per-passport acquisition + handed-out
 * counts. Data shape unchanged from the prior commit; this is a
 * pure restyle.
 *
 * Every link target and every counted number traces to the same
 * loader (`loadPassportsTabRows` in app/program/page.tsx).
 */

export interface PassportProgramRowData {
  id: string
  title: string
  status: string
  is_published: boolean
  prizeTexts: string[]
  acquisitionCount: number
  prizeDistributedCount: number
  /** Number of copies issued so far (next_copy_number - 1).
   *  When 0, no copies issued; renders the "no copies" treatment.
   *  M2 follow-up (migration 070 / 019). */
  copyIssuedCount: number
  /** Designer's expiry duration in days. NULL = never expires.
   *  M2 follow-up. Display only — no enforcement this PR. */
  expiryDurationDays: number | null
}

export function PassportsTab({ rows }: { rows: PassportProgramRowData[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState cta={{ label: 'Create a passport', href: '/design' }}>
        Once you publish a passport with a prize, it&rsquo;ll show up here.
      </EmptyState>
    )
  }

  const drafts    = rows.filter((r) => !r.is_published).length
  const published = rows.filter((r) =>  r.is_published).length

  return (
    <div className="space-y-6">
      {/* Honest-disclosure note — kept verbatim from the prior copy,
          restyled into the shared Note primitive. */}
      <Note>
        <span className="font-semibold text-ink">Coming later: </span>
        per-collector distribution tracking, a redemption record, and the
        employee terminal for handing prizes out in person. The counts on
        this tab reflect today&rsquo;s data — collectors who&rsquo;ve acquired the
        passport, and prizes a staff member has marked delivered.
      </Note>

      <section>
        <SectionLabel>
          Your passports · <b>{rows.length} total · {drafts} draft{drafts === 1 ? '' : 's'}</b>
        </SectionLabel>
        <div className="space-y-3">
          {rows.map((r) => (
            <PassportRow key={r.id} row={r} />
          ))}
        </div>
      </section>
    </div>
  )
}

function PassportRow({ row }: { row: PassportProgramRowData }) {
  const metrics: Metric[] = [
    { label: 'Collectors',         value: row.acquisitionCount },
    { label: 'Prizes handed out',  value: row.prizeDistributedCount, caption: 'staff-marked' },
    { label: 'Prize entries',      value: row.prizeTexts.length, caption: 'across all pages' },
    { label: 'Status',             value: row.is_published ? 'Live' : '—' },
  ]
  return (
    <Card>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-ink">{row.title}</h3>
            <Pill variant={statusToVariant(row.status)}>{row.status}</Pill>
          </div>
        </div>
        <Link
          href={`/design/${row.id}`}
          className="shrink-0 text-[12px] font-semibold text-green underline-offset-2 hover:underline"
        >
          Open in designer →
        </Link>
      </header>

      <div className="mt-3">
        <InlineMetrics metrics={metrics} />
      </div>

      {/* Copies + expiry — M2 follow-up. Honest copy: render the
          actual issued range; "No expiry" when the design has no
          duration set. No fabricated dates ever. */}
      <p className="mt-3 text-[11.5px] text-muted">
        <span className="font-mono uppercase text-muted" style={{ letterSpacing: '1.3px' }}>
          Copies ·
        </span>{' '}
        {row.copyIssuedCount === 0
          ? <>none issued yet</>
          : row.copyIssuedCount === 1
            ? <>#1 issued</>
            : <>#1&ndash;#{row.copyIssuedCount} issued</>}
        {' · '}
        <span className="font-mono uppercase text-muted" style={{ letterSpacing: '1.3px' }}>
          expiry ·
        </span>{' '}
        {row.expiryDurationDays == null
          ? <>copies never expire</>
          : <>each copy valid for {row.expiryDurationDays} days from acquisition</>}
      </p>

      {row.prizeTexts.length > 0 ? (
        <section className="mt-4 border-t border-hairline pt-3">
          <SectionLabel>Prize text on pages</SectionLabel>
          <ul className="mt-1.5 space-y-1.5">
            {row.prizeTexts.map((t, i) => (
              <li key={i} className="text-[12.5px] text-ink">{t}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-4 border-t border-hairline pt-3 text-[11.5px] text-muted">
          No prize text set on any page yet. Add it in the designer&rsquo;s page inspector → Prize.
        </p>
      )}
    </Card>
  )
}

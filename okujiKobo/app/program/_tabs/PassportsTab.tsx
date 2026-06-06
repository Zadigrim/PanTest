import Link from 'next/link'

/**
 * Program Passports tab — the existing /program v1 content lifted
 * unchanged. One row per passport with the prize text written on
 * any page + per-passport acquisition + handed-out counts.
 *
 * Data shape is identical to the old /program page so passports
 * surfaces don't differ between the tab and the URL bookmark.
 */

export interface PassportProgramRowData {
  id: string
  title: string
  status: string
  is_published: boolean
  prizeTexts: string[]
  acquisitionCount: number
  prizeDistributedCount: number
}

export function PassportsTab({ rows }: { rows: PassportProgramRowData[] }) {
  if (rows.length === 0) {
    return <EmptyState />
  }
  return (
    <div className="space-y-3">
      {/* Honest-disclosure banner — same intent as the old /program
          v1 had, kept verbatim so the operator sees the same voice
          on this tab as before. */}
      <div className="rounded-[8px] border border-surface-faintdiv bg-white px-4 py-3 text-[12px] text-muted">
        <span className="font-semibold text-ink">Coming later: </span>
        per-collector distribution tracking, a redemption record, and the
        employee terminal for handing prizes out in person. The counts on
        this tab reflect today&rsquo;s data — collectors who&rsquo;ve acquired the
        passport, and prizes a staff member has marked delivered.
      </div>
      {rows.map((r) => (
        <PassportProgramRow key={r.id} row={r} />
      ))}
    </div>
  )
}

function PassportProgramRow({ row }: { row: PassportProgramRowData }) {
  const statusPill =
    row.status === 'published' ? 'border-green text-green'
    : row.status === 'archived' ? 'border-accent text-accent'
    : 'border-muted text-muted'

  return (
    <article className="rounded-[10px] border border-surface-faintdiv bg-white p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold text-ink">{row.title}</h2>
            <span className={`inline-flex items-center rounded-full border-[1.5px] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase ${statusPill}`}>
              {row.status}
            </span>
          </div>
        </div>
        <Link
          href={`/design/${row.id}`}
          className="shrink-0 rounded-[6px] border-[1.5px] border-ink bg-white px-3 py-1.5 text-[11.5px] font-medium text-ink hover:bg-surface-workspace"
        >
          Open in designer →
        </Link>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-4">
        <Stat label="Collectors" value={row.acquisitionCount} />
        <Stat label="Prizes handed out" value={row.prizeDistributedCount} />
        <Stat label="Prize entries" value={row.prizeTexts.length} hint="across all pages" />
        <Stat label="Status" value={row.is_published ? 'Live' : '—'} />
      </dl>

      {row.prizeTexts.length > 0 ? (
        <section className="mt-3 border-t border-surface-faintdiv pt-3">
          <p className="text-[10px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
            Prize text on pages
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {row.prizeTexts.map((t, i) => (
              <li key={i} className="text-[12.5px] text-ink">{t}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-3 border-t border-surface-faintdiv pt-3 text-[12px] text-muted">
          No prize text set on any page yet. Add it in the designer&rsquo;s page inspector → Prize.
        </p>
      )}
    </article>
  )
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">
        {value}
        {hint && <span className="ml-1 text-[10px] font-normal text-muted">{hint}</span>}
      </dd>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-[10px] border border-dashed border-hairline bg-white px-6 py-12 text-center">
      <p className="text-[14px] font-semibold text-ink">No passports yet</p>
      <p className="mt-1 text-[12px] text-muted">
        Once you publish a passport with a prize, it&rsquo;ll show up here.
      </p>
      <Link
        href="/design"
        className="mt-4 inline-flex items-center rounded-[8px] border-[1.5px] border-ink bg-green px-4 h-9 text-[13px] font-semibold text-white"
      >
        Create a passport
      </Link>
    </div>
  )
}

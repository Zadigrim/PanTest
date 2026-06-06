import Link from 'next/link'
import type { ProgramOverview } from '@/lib/program/load'
import { Sparkline } from '@/components/program/Sparkline'

/**
 * Program Overview tab — institution-rollup KPIs + per-passport
 * rows + 12-week sparkline + Needs Attention.
 *
 * Every visible number traces to a query in lib/program/load.ts.
 * Honest zeros render at zero — the empty state is the truth.
 * Two KPI cards (Prizes Redeemed by collector, and any future
 * post-KI-02 cards) are NOT shown today; only the staff-marked
 * "Prizes Handed Out" + the live "Pending Distribution" surface.
 */
export function OverviewTab({ data }: { data: ProgramOverview }) {
  const {
    kpis,
    perPassport,
    trend,
    attention,
    totals,
  } = data

  const totalAcqIn12w = trend.weeklyAcquisitions.reduce((a, b) => a + b, 0)
  // Show sparkline only with enough signal — otherwise we'd render
  // a misleading flat line. Threshold: ≥12 acquisitions in window.
  const showSparkline = totalAcqIn12w >= 12 && trend.weeklyAcquisitions.some((v) => v > 0)

  return (
    <div className="space-y-8">
      {/* ── KPI band ────────────────────────────────────────────── */}
      <section aria-label="Institution KPIs">
        <h2 className="mb-3 text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
          This institution · last 30/90 days
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Active collectors" sub="30d" value={kpis.activeCollectors30d} />
          <KpiCard label="Acquisitions"      sub="90d" value={kpis.acquisitions90d} />
          <KpiCard label="Stamps placed"     sub="90d" value={kpis.stampsPlaced90d} />
          <KpiCard
            label="Completion rate"
            sub={kpis.completionRatePct == null ? 'no collectors yet' : 'overall'}
            value={kpis.completionRatePct == null ? '—' : `${kpis.completionRatePct}%`}
          />
          <KpiCard
            label="Prizes handed out"
            sub="staff-marked"
            value={kpis.prizesHandedOut}
          />
          <KpiCard
            label="Pending distribution"
            sub={kpis.pendingDistribution > 0 ? 'needs attention' : 'all clear'}
            value={kpis.pendingDistribution}
            warn={kpis.pendingDistribution > 0}
          />
        </div>
        {/* Honest disclosure about what's NOT here yet. The phrase
            "tracking coming soon" matches the main dashboard's
            two dormant cards so the user sees a consistent
            "we'll tell you when this exists" voice. */}
        <p className="mt-3 text-[11.5px] text-muted">
          Collector-side prize redemption tracking is coming later —
          today only staff-marked distribution shows here.
        </p>
      </section>

      {/* ── Trend ──────────────────────────────────────────────── */}
      <section aria-label="Acquisitions trend">
        <h2 className="mb-3 text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
          Acquisitions · last 12 weeks
        </h2>
        <div className="rounded-[10px] border border-surface-faintdiv bg-white px-5 py-4">
          {showSparkline ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[24px] font-bold tabular-nums text-ink">{totalAcqIn12w}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">acquisitions across the last 12 weeks</p>
              </div>
              <div className="text-green">
                <Sparkline values={trend.weeklyAcquisitions} />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[24px] font-bold tabular-nums text-ink">{totalAcqIn12w}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {trend.firstAcquisitionAt
                  ? <>acquisitions since {new Date(trend.firstAcquisitionAt).toLocaleDateString()}</>
                  : <>no acquisitions yet — the chart appears once there&rsquo;s enough activity to plot honestly</>}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Needs Attention ────────────────────────────────────── */}
      {attention.length > 0 && (
        <section aria-label="Needs attention">
          <h2 className="mb-3 text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
            Needs attention
          </h2>
          <ul className="space-y-2">
            {attention.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.ctaHref}
                  className={`flex items-start gap-3 rounded-[8px] border bg-white px-4 py-3 transition-shadow hover:shadow-sm ${
                    a.severity === 'error' ? 'border-red'
                    : a.severity === 'warn'  ? 'border-accent'
                    : 'border-surface-faintdiv'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                      a.severity === 'error' ? 'bg-red'
                      : a.severity === 'warn'  ? 'bg-accent'
                      : 'bg-muted'
                    }`}
                  >
                    {a.severity === 'error' ? '!' : a.severity === 'warn' ? '!' : 'i'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{a.title}</p>
                    <p className="truncate text-[11.5px] text-muted">{a.meta}</p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-muted">{a.ctaLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Per-passport performance ───────────────────────────── */}
      <section aria-label="Per-passport performance">
        <h2 className="mb-3 text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
          Per passport · {totals.publishedPassports} of {totals.ownedPassports} published
        </h2>
        {perPassport.length === 0 ? (
          <EmptyPerPassport />
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-surface-faintdiv bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface-rail">
                <tr className="text-left text-[10.5px] font-medium uppercase text-muted" style={{ letterSpacing: '1.3px' }}>
                  <th className="px-4 py-2">Passport</th>
                  <th className="px-3 py-2 text-right tabular-nums">Acquisitions</th>
                  <th className="px-3 py-2 text-right tabular-nums">Active · 30d</th>
                  <th className="px-3 py-2 text-right tabular-nums">Stamps · 90d</th>
                  <th className="px-3 py-2 text-right tabular-nums">Completion</th>
                  <th className="px-3 py-2 text-right">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {perPassport.map((p) => (
                  <tr key={p.id} className="border-t border-surface-faintdiv">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/program?tab=analytics&passport=${p.id}`} className="truncate text-[13px] font-semibold text-ink hover:underline">
                          {p.title}
                        </Link>
                        <span
                          className={`inline-flex items-center rounded-full border-[1.5px] bg-white px-1.5 text-[9px] font-semibold uppercase ${
                            p.isPublished ? 'border-green text-green' : 'border-muted text-muted'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">{p.acquisitions}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">{p.activeCollectors30d}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">{p.stampsPlaced90d}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink">
                      {p.completionPct == null ? '—' : `${p.completionPct}%`}
                    </td>
                    <td className="px-3 py-3 text-right text-[11.5px] text-muted">
                      {p.lastActivity ? new Date(p.lastActivity).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function KpiCard({
  label, sub, value, warn,
}: {
  label: string
  sub?: string
  value: number | string
  warn?: boolean
}) {
  return (
    <div className={`rounded-[8px] border bg-white px-3 py-3 ${warn ? 'border-accent' : 'border-surface-faintdiv'}`}>
      <p className="text-[10px] font-medium uppercase text-muted" style={{ letterSpacing: '1.3px' }}>{label}</p>
      <p className={`mt-1 text-[20px] font-bold tabular-nums ${warn ? 'text-accent' : 'text-ink'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10.5px] text-muted">{sub}</p>}
    </div>
  )
}

function EmptyPerPassport() {
  return (
    <div className="rounded-[10px] border border-dashed border-hairline bg-white px-6 py-10 text-center">
      <p className="text-[13.5px] font-semibold text-ink">No passports yet</p>
      <p className="mt-1 text-[12px] text-muted">
        Numbers here come straight from your passports&rsquo; activity. Create one to start.
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

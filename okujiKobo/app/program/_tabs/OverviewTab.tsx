import Link from 'next/link'
import type { ProgramOverview } from '@/lib/program/load'
import { Sparkline } from '@/components/program/Sparkline'
import {
  SectionLabel,
  Card,
  MetricStrip,
  EmptyState,
  DataTable,
  Pill,
  statusToVariant,
  type Metric,
  type Column,
} from '@/components/program/ui'

/**
 * Program Overview tab — institution-rollup KPIs + per-passport
 * rows + 12-week sparkline + Needs Attention.
 *
 * Every visible number traces to a query in lib/program/load.ts.
 * Honest zeros render at zero — the empty state is the truth.
 * Two KPI cards (Prizes Redeemed by collector, and any future
 * post-KI-02 cards) are NOT shown today; only the staff-marked
 * "Prizes Handed Out" + the live "Pending Distribution" surface.
 *
 * Restyle-only diff vs. prior commit: same fields, same six
 * metrics, same sparkline threshold, same drill-in URLs. All
 * vocabulary now flows through @/components/program/ui.
 */
export function OverviewTab({ data }: { data: ProgramOverview }) {
  const { kpis, perPassport, trend, attention, totals } = data

  const totalAcqIn12w = trend.weeklyAcquisitions.reduce((a, b) => a + b, 0)
  const showSparkline = totalAcqIn12w >= 12 && trend.weeklyAcquisitions.some((v) => v > 0)

  const kpiMetrics: Metric[] = [
    { label: 'Active collectors', value: kpis.activeCollectors30d, caption: '30d' },
    { label: 'Acquisitions',      value: kpis.acquisitions90d,     caption: '90d' },
    { label: 'Stamps placed',     value: kpis.stampsPlaced90d,     caption: '90d' },
    {
      label: 'Completion rate',
      value: kpis.completionRatePct == null ? null : `${kpis.completionRatePct}%`,
      caption: kpis.completionRatePct == null ? 'no collectors yet' : 'overall',
    },
    { label: 'Prizes handed out', value: kpis.prizesHandedOut, caption: 'staff-marked' },
    {
      label: 'Pending distribution',
      value: kpis.pendingDistribution,
      caption: kpis.pendingDistribution > 0 ? 'needs attention' : 'all clear',
    },
  ]

  const tableColumns: Column<(typeof perPassport)[number]>[] = [
    {
      key: 'title',
      label: 'Passport',
      render: (p) => (
        <div className="flex items-center gap-2">
          <span className="truncate">{p.title}</span>
          <Pill variant={statusToVariant(p.status)}>{p.status}</Pill>
        </div>
      ),
    },
    { key: 'acq',    label: 'Acquisitions',  align: 'right', render: (p) => p.acquisitions },
    { key: 'active', label: 'Active · 30d',  align: 'right', render: (p) => p.activeCollectors30d },
    { key: 'stamps', label: 'Stamps · 90d',  align: 'right', render: (p) => p.stampsPlaced90d },
    {
      key: 'comp',
      label: 'Completion',
      align: 'right',
      render: (p) => p.completionPct == null ? '—' : `${p.completionPct}%`,
    },
    {
      key: 'last',
      label: 'Last activity',
      align: 'right',
      render: (p) => p.lastActivity
        ? <span className="text-[11.5px] text-muted">{new Date(p.lastActivity).toLocaleDateString()}</span>
        : <span className="text-muted">—</span>,
    },
  ]

  return (
    <div className="space-y-8">
      {/* ── KPI band ────────────────────────────────────────────── */}
      <section aria-label="Institution KPIs">
        <SectionLabel>This institution · last 30/90 days</SectionLabel>
        <MetricStrip metrics={kpiMetrics} />
        <p className="mt-3 text-[11.5px] text-muted">
          Collector-side prize redemption tracking is coming later —
          today only staff-marked distribution shows here.
        </p>
      </section>

      {/* ── Trend ──────────────────────────────────────────────── */}
      <section aria-label="Acquisitions trend">
        <SectionLabel>Acquisitions · last 12 weeks</SectionLabel>
        <Card>
          {showSparkline ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[24px] font-semibold tabular-nums text-ink">{totalAcqIn12w}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">acquisitions across the last 12 weeks</p>
              </div>
              <div className="text-green">
                <Sparkline values={trend.weeklyAcquisitions} />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[24px] font-semibold tabular-nums text-ink">{totalAcqIn12w}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {trend.firstAcquisitionAt
                  ? <>acquisitions since {new Date(trend.firstAcquisitionAt).toLocaleDateString()}</>
                  : <>no acquisitions yet — the chart appears once there&rsquo;s enough activity to plot honestly</>}
              </p>
            </div>
          )}
        </Card>
      </section>

      {/* ── Needs Attention ────────────────────────────────────── */}
      {attention.length > 0 && (
        <section aria-label="Needs attention">
          <SectionLabel>Needs attention</SectionLabel>
          <ul className="space-y-2">
            {attention.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.ctaHref}
                  className="flex items-start gap-3 rounded-program-card border-[1.5px] border-hairline bg-cream px-4 py-3 transition-colors hover:bg-field"
                >
                  {/* Severity dot — gold (accent) for info, red for
                      error, clay for warn (announcement-flavored).
                      Replaces the prior red/accent filled badges with
                      one compact dot vocabulary. */}
                  <span
                    aria-hidden="true"
                    className={
                      'mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full '
                      + (a.severity === 'error' ? 'bg-red'
                        : a.severity === 'warn'  ? 'bg-clay'
                        : 'bg-accent')
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{a.title}</p>
                    <p className="truncate text-[11.5px] text-muted">{a.meta}</p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-green">{a.ctaLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Per-passport performance ───────────────────────────── */}
      <section aria-label="Per-passport performance">
        <SectionLabel>
          Per passport · <b>{totals.publishedPassports} of {totals.ownedPassports} published</b>
        </SectionLabel>
        {perPassport.length === 0 ? (
          <EmptyState cta={{ label: 'Create a passport', href: '/design' }}>
            Numbers here come straight from your passports&rsquo; activity. Create one to start.
          </EmptyState>
        ) : (
          <DataTable
            columns={tableColumns}
            rows={perPassport}
            rowKey={(p) => p.id}
            rowHref={(p) => `/program?tab=analytics&passport=${p.id}`}
          />
        )}
      </section>
    </div>
  )
}

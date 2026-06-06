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
  Segmented,
  statusToVariant,
  type Metric,
  type Column,
  type Segment,
} from '@/components/program/ui'

/**
 * Program Analytics tab. Two modes:
 *   - Aggregate (no ?passport param): institution rollup with the
 *     Overview KPIs + sparkline + per-passport table.
 *   - Drill-in (?passport=ID): single-passport detail, link out to
 *     the existing /manage/passport/[id] row-level view.
 *
 * Restyle-only diff: same fields, same six metrics, same drill-in
 * URLs, same /manage/passport/[id] deep-link. The black Aggregate
 * button becomes a Segmented control with byte-equivalent
 * navigation semantics.
 */
export function AnalyticsTab({
  data,
  selectedPassportId,
}: {
  data: ProgramOverview
  selectedPassportId: string | null
}) {
  const totalAcq12w = data.trend.weeklyAcquisitions.reduce((a, b) => a + b, 0)
  const showSparkline = totalAcq12w >= 12 && data.trend.weeklyAcquisitions.some((v) => v > 0)

  const drillRow = selectedPassportId
    ? data.perPassport.find((p) => p.id === selectedPassportId) ?? null
    : null

  // Segmented mode-switcher. When in drill mode we still surface
  // both segments so the user has a one-click escape back to
  // aggregate. The "By passport" segment is decorative when in
  // aggregate (it has no specific target without a drill id) — we
  // make it a link to the per-passport table anchor.
  const segments: Segment[] = [
    { key: 'aggregate', label: 'Aggregate',  href: '/program?tab=analytics' },
    { key: 'drill',     label: 'By passport', href: '/program?tab=analytics#by-passport' },
  ]
  const activeKey = drillRow ? 'drill' : 'aggregate'

  const aggregateMetrics: Metric[] = [
    { label: 'Active collectors', value: data.kpis.activeCollectors30d, caption: '30d' },
    { label: 'Acquisitions',      value: data.kpis.acquisitions90d,     caption: '90d' },
    { label: 'Stamps placed',     value: data.kpis.stampsPlaced90d,     caption: '90d' },
    {
      label: 'Completion rate',
      value: data.kpis.completionRatePct == null ? null : `${data.kpis.completionRatePct}%`,
      caption: data.kpis.completionRatePct == null ? 'no collectors yet' : 'overall',
    },
    { label: 'Prizes handed out', value: data.kpis.prizesHandedOut, caption: 'staff-marked' },
    {
      label: 'Pending distribution',
      value: data.kpis.pendingDistribution,
      caption: data.kpis.pendingDistribution > 0 ? 'needs attention' : 'all clear',
    },
  ]

  const tableColumns: Column<(typeof data.perPassport)[number]>[] = [
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
    { key: 'acq',    label: 'Acquisitions', align: 'right', render: (p) => p.acquisitions },
    { key: 'active', label: 'Active · 30d', align: 'right', render: (p) => p.activeCollectors30d },
    { key: 'stamps', label: 'Stamps · 90d', align: 'right', render: (p) => p.stampsPlaced90d },
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
      {/* ── Mode switcher ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented segments={segments} activeKey={activeKey} ariaLabel="Analytics mode" />
        {drillRow && (
          <Pill variant="live">{drillRow.title}</Pill>
        )}
        {selectedPassportId && !drillRow && (
          <span className="text-[11.5px] text-muted">
            That passport isn&rsquo;t in your inventory —{' '}
            <Link href="/program?tab=analytics" className="text-green underline-offset-2 hover:underline">back to aggregate</Link>.
          </span>
        )}
      </div>

      {/* ── Aggregate mode ─────────────────────────────────────── */}
      {!drillRow && (
        <>
          <section aria-label="Aggregate KPIs">
            <SectionLabel>This institution · last 30/90 days</SectionLabel>
            <MetricStrip metrics={aggregateMetrics} />
          </section>

          <section aria-label="Acquisitions trend">
            <SectionLabel>Acquisitions · trend</SectionLabel>
            {showSparkline ? (
              <Card>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[24px] font-semibold tabular-nums text-ink">{totalAcq12w}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted">acquisitions across the last 12 weeks</p>
                  </div>
                  <div className="text-green"><Sparkline values={data.trend.weeklyAcquisitions} /></div>
                </div>
              </Card>
            ) : (
              <EmptyState>
                {data.trend.firstAcquisitionAt
                  ? <><span className="font-semibold text-ink">{totalAcq12w}</span> acquisitions since {new Date(data.trend.firstAcquisitionAt).toLocaleDateString()}</>
                  : <>no acquisitions yet — chart appears once there&rsquo;s enough activity to plot honestly</>}
              </EmptyState>
            )}
          </section>

          <section id="by-passport" aria-label="Drill in to a passport">
            <SectionLabel>By passport · <b>click a row to drill in</b></SectionLabel>
            <DataTable
              columns={tableColumns}
              rows={data.perPassport}
              rowKey={(p) => p.id}
              rowHref={(p) => `/program?tab=analytics&passport=${p.id}`}
              empty="No passports in this institution yet."
            />
          </section>
        </>
      )}

      {/* ── Drill-in mode ──────────────────────────────────────── */}
      {drillRow && (
        <>
          <section aria-label={`${drillRow.title} KPIs`}>
            <SectionLabel>{drillRow.title}</SectionLabel>
            <MetricStrip
              metrics={[
                { label: 'Acquisitions',      value: drillRow.acquisitions,         caption: 'all-time' },
                { label: 'Active collectors', value: drillRow.activeCollectors30d,  caption: '30d' },
                { label: 'Stamps placed',     value: drillRow.stampsPlaced90d,      caption: '90d' },
                {
                  label: 'Completion',
                  value: drillRow.completionPct == null ? null : `${drillRow.completionPct}%`,
                  caption: drillRow.completionPct == null ? 'no collectors yet' : 'collectors with all stamps',
                },
              ]}
            />
          </section>

          <section>
            <SectionLabel>Last activity</SectionLabel>
            <Card>
              <p className="text-[15px] text-ink">
                {drillRow.lastActivity
                  ? new Date(drillRow.lastActivity).toLocaleString()
                  : <span className="text-muted">No stamps or acquisitions yet</span>}
              </p>
            </Card>
          </section>

          <section aria-label="Row-level detail">
            <SectionLabel>Row-level detail</SectionLabel>
            <Card>
              <Link
                href={`/manage/passport/${drillRow.id}`}
                className="inline-flex items-center text-[13px] font-semibold text-green underline-offset-2 hover:underline"
              >
                Open full per-passport view →
              </Link>
              <p className="mt-2 text-[11.5px] text-muted">
                Stop-level activity, completion tokens, distribution pending list.
              </p>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

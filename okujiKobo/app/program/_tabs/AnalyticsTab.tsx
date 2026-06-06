import Link from 'next/link'
import type { ProgramOverview } from '@/lib/program/load'
import { Sparkline } from '@/components/program/Sparkline'

/**
 * Program Analytics tab. Two modes:
 *   - Aggregate (no ?passport param): institution rollup with the
 *     Overview KPIs + sparkline + per-passport table. The view
 *     prioritizes the comparison across passports — the same data
 *     shape the institutional manage dashboard exposed but on the
 *     unified Program surface.
 *   - Drill-in (?passport=ID): single-passport detail. Acquisitions
 *     trend, completion %, last activity, deep link into the
 *     existing /manage/passport/[id] page for the full row-level
 *     view we don't want to rebuild this push.
 *
 * Every number from real queries (lib/program/load.ts). Drafts and
 * archived passports are reachable via the aggregate table so the
 * institution sees the full inventory.
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

  return (
    <div className="space-y-8">
      {/* ── Mode switcher: aggregate ↔ drill ─────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/program?tab=analytics"
          className={`rounded-[6px] border-[1.5px] px-3 py-1.5 text-[12px] font-medium ${
            !selectedPassportId
              ? 'border-ink bg-ink text-white'
              : 'border-hairline bg-white text-muted hover:border-ink hover:text-ink'
          }`}
        >
          Aggregate
        </Link>
        {drillRow && (
          <span className="rounded-[6px] border-[1.5px] border-ink bg-cream px-3 py-1.5 text-[12px] font-semibold text-ink">
            {drillRow.title}
          </span>
        )}
        {selectedPassportId && !drillRow && (
          <span className="text-[11.5px] text-muted">
            That passport isn&rsquo;t in your inventory —{' '}
            <Link href="/program?tab=analytics" className="underline">back to aggregate</Link>.
          </span>
        )}
      </div>

      {/* ── Aggregate mode ─────────────────────────────────────── */}
      {!drillRow && (
        <>
          <section aria-label="Aggregate KPIs">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Active collectors" sub="30d" value={data.kpis.activeCollectors30d} />
              <KpiCard label="Acquisitions"      sub="90d" value={data.kpis.acquisitions90d} />
              <KpiCard label="Stamps placed"     sub="90d" value={data.kpis.stampsPlaced90d} />
              <KpiCard
                label="Completion rate"
                sub={data.kpis.completionRatePct == null ? 'no collectors yet' : 'overall'}
                value={data.kpis.completionRatePct == null ? '—' : `${data.kpis.completionRatePct}%`}
              />
              <KpiCard label="Prizes handed out" sub="staff-marked" value={data.kpis.prizesHandedOut} />
              <KpiCard
                label="Pending distribution"
                sub={data.kpis.pendingDistribution > 0 ? 'needs attention' : 'all clear'}
                value={data.kpis.pendingDistribution}
                warn={data.kpis.pendingDistribution > 0}
              />
            </div>
          </section>

          <section aria-label="Acquisitions trend">
            <div className="rounded-[10px] border border-surface-faintdiv bg-white px-5 py-4">
              {showSparkline ? (
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.3px' }}>
                      Acquisitions · last 12 weeks
                    </p>
                    <p className="mt-1 text-[24px] font-bold tabular-nums text-ink">{totalAcq12w}</p>
                  </div>
                  <div className="text-green"><Sparkline values={data.trend.weeklyAcquisitions} /></div>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.3px' }}>
                    Acquisitions · trend
                  </p>
                  <p className="mt-1 text-[24px] font-bold tabular-nums text-ink">{totalAcq12w}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    {data.trend.firstAcquisitionAt
                      ? <>since {new Date(data.trend.firstAcquisitionAt).toLocaleDateString()}</>
                      : <>no acquisitions yet — chart appears once there&rsquo;s enough activity to plot honestly</>}
                  </p>
                </>
              )}
            </div>
          </section>

          <section aria-label="Drill in to a passport">
            <h2 className="mb-3 text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
              By passport · click a row to drill in
            </h2>
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
                  {data.perPassport.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-[12px] text-muted">No passports in this institution yet.</td></tr>
                  ) : data.perPassport.map((p) => (
                    <tr key={p.id} className="border-t border-surface-faintdiv hover:bg-paper/30">
                      <td className="px-4 py-3">
                        <Link href={`/program?tab=analytics&passport=${p.id}`} className="truncate text-[13px] font-semibold text-ink hover:underline">
                          {p.title}
                        </Link>
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
          </section>
        </>
      )}

      {/* ── Drill-in mode ──────────────────────────────────────── */}
      {drillRow && (
        <>
          <section aria-label={`${drillRow.title} KPIs`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <KpiCard label="Acquisitions" sub="all-time" value={drillRow.acquisitions} />
              <KpiCard label="Active collectors" sub="30d" value={drillRow.activeCollectors30d} />
              <KpiCard label="Stamps placed" sub="90d" value={drillRow.stampsPlaced90d} />
              <KpiCard
                label="Completion"
                sub={drillRow.completionPct == null ? 'no collectors yet' : 'collectors with all stamps'}
                value={drillRow.completionPct == null ? '—' : `${drillRow.completionPct}%`}
              />
            </div>
          </section>

          <section>
            <div className="rounded-[10px] border border-surface-faintdiv bg-white px-5 py-4">
              <p className="text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.3px' }}>
                Last activity
              </p>
              <p className="mt-1 text-[15px] text-ink">
                {drillRow.lastActivity
                  ? new Date(drillRow.lastActivity).toLocaleString()
                  : <span className="text-muted">No stamps or acquisitions yet</span>}
              </p>
            </div>
          </section>

          <section aria-label="Row-level detail">
            <h2 className="mb-3 text-[11px] font-medium uppercase text-muted" style={{ letterSpacing: '1.5px' }}>
              Row-level detail
            </h2>
            <Link
              href={`/manage/passport/${drillRow.id}`}
              className="inline-flex items-center rounded-[8px] border-[1.5px] border-ink bg-white px-4 h-9 text-[13px] font-semibold text-ink hover:bg-cream"
            >
              Open full per-passport view →
            </Link>
            <p className="mt-2 text-[11.5px] text-muted">
              Stop-level activity, completion tokens, distribution pending list.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function KpiCard({
  label, sub, value, warn,
}: { label: string; sub?: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`rounded-[8px] border bg-white px-3 py-3 ${warn ? 'border-accent' : 'border-surface-faintdiv'}`}>
      <p className="text-[10px] font-medium uppercase text-muted" style={{ letterSpacing: '1.3px' }}>{label}</p>
      <p className={`mt-1 text-[20px] font-bold tabular-nums ${warn ? 'text-accent' : 'text-ink'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10.5px] text-muted">{sub}</p>}
    </div>
  )
}

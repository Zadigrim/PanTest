import Link from 'next/link'
import type { DashboardKpi } from '@/lib/dashboard/load'

/**
 * Operator-dashboard KPI card. Pure presentational; the dashboard
 * loader emits the `kpi` shape, this just renders it.
 *
 * Variants:
 *   - default — white, hairline border
 *   - accent  — 3px accent top border (used by the dormant
 *               PENDING DISTRIBUTION KPI; lit by a flag)
 */
export function KpiCard({
  kpi,
  href,
  variant = 'default',
}: {
  kpi: DashboardKpi
  href?: string
  variant?: 'default' | 'accent'
}) {
  // h-full on the box + the link wrapper so every card in the KPI
  // grid row reaches the same height. Without it, cards lacking a
  // delta sub-line render shorter than their siblings (CSS grid
  // stretches the GRID CELL, but the inner div has to opt in to
  // fill that stretched cell). Visual symptom: Published (no delta)
  // sat shorter than Pending Distribution (delta = "tracking coming
  // soon"). Per Nathan's report on the dashboard screenshot.
  const inner = (
    <div
      className={
        (variant === 'accent'
          ? 'rounded-[10px] border-[1.5px] border-hairline border-t-[3px] border-t-accent bg-white p-5 transition-shadow hover:shadow-sm'
          : 'rounded-[10px] border-[1.5px] border-hairline bg-white p-5 transition-shadow hover:shadow-sm')
        + ' flex h-full flex-col'
      }
    >
      <p
        className="text-[9.5px] font-medium uppercase text-muted"
        style={{ letterSpacing: '1.5px' }}
      >
        {kpi.label}
      </p>
      <p className="mt-2 text-[30px] font-bold leading-none text-ink tabular-nums">
        {kpi.value}
      </p>
      {/* Delta lives in a fixed bottom slot — `mt-auto` pushes it to
          the card's bottom regardless of whether it's present. Cards
          without a delta keep the same total height because h-full
          stretches them to match. */}
      <p
        className={`mt-auto pt-2 text-[11px] ${
          kpi.delta?.sign === 'up' ? 'text-green'
          : kpi.delta?.sign === 'down' ? 'text-red'
          : 'text-muted'
        }`}
      >
        {kpi.delta?.text ?? ' ' /* nbsp keeps the line height */}
      </p>
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        {inner}
      </Link>
    )
  }
  return inner
}

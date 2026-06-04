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
  const inner = (
    <div
      className={
        variant === 'accent'
          ? 'rounded-[10px] border-[1.5px] border-hairline border-t-[3px] border-t-accent bg-white p-5 transition-shadow hover:shadow-sm'
          : 'rounded-[10px] border-[1.5px] border-hairline bg-white p-5 transition-shadow hover:shadow-sm'
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
      {kpi.delta && (
        <p
          className={`mt-2 text-[11px] ${
            kpi.delta.sign === 'up' ? 'text-green'
            : kpi.delta.sign === 'down' ? 'text-red'
            : 'text-muted'
          }`}
        >
          {kpi.delta.text}
        </p>
      )}
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green"
      >
        {inner}
      </Link>
    )
  }
  return inner
}

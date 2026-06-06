/**
 * The single metric presentation for the Program hub.
 *
 * MetricStrip   — one bordered Card holding 6 cells in a row,
 *                 separated by hairline vertical dividers. Used by
 *                 Overview + Analytics as the KPI band. Replaces
 *                 the prior 6-card grid.
 * InlineMetrics — same cell vocabulary WITHOUT outer card / inner
 *                 borders. Used inside per-passport rows on
 *                 PassportsTab + the drill-in pane.
 *
 * Cell vocabulary:
 *   - label   — mono uppercase, 11px, 2px tracking, muted
 *   - value   — large, tabular-nums, ink (or muted when zero so
 *               "0" doesn't grab attention)
 *   - caption — small muted line below the value
 *
 * Zero / N-A treatment:
 *   - value === 0           → muted text (de-emphasized, honest)
 *   - value === null/undef  → '—' rendered muted (honest unknown)
 *   - everything else        → ink
 */

import { cn } from '@/lib/cn'
import { Card } from './Card'

export interface Metric {
  label: string
  value: number | string | null
  caption?: string
}

function renderValue(v: Metric['value']) {
  if (v == null) return { display: '—', muted: true }
  if (v === 0)   return { display: '0',  muted: true }
  return { display: String(v), muted: false }
}

function Cell({ m }: { m: Metric }) {
  const { display, muted } = renderValue(m.value)
  return (
    <div className="flex flex-1 flex-col gap-1 px-4 py-3 min-w-0">
      <p
        className="font-mono text-[11px] uppercase text-muted"
        style={{ letterSpacing: '2px' }}
      >
        {m.label}
      </p>
      <p
        className={cn(
          'text-[26px] font-semibold leading-none tabular-nums',
          muted ? 'text-muted' : 'text-ink',
        )}
      >
        {display}
      </p>
      {m.caption && (
        <p className="text-[10.5px] leading-snug text-muted">{m.caption}</p>
      )}
    </div>
  )
}

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <Card padding="none">
      <div className="flex flex-wrap divide-x-[1px] divide-hairline">
        {metrics.map((m, i) => (
          <Cell key={i} m={m} />
        ))}
      </div>
    </Card>
  )
}

export function InlineMetrics({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
      {metrics.map((m, i) => {
        const { display, muted } = renderValue(m.value)
        return (
          <div key={i} className="min-w-0">
            <p
              className="font-mono text-[10.5px] uppercase text-muted"
              style={{ letterSpacing: '2px' }}
            >
              {m.label}
            </p>
            <p
              className={cn(
                'mt-0.5 text-[18px] font-semibold leading-none tabular-nums',
                muted ? 'text-muted' : 'text-ink',
              )}
            >
              {display}
            </p>
            {m.caption && (
              <p className="mt-0.5 text-[10px] leading-snug text-muted">{m.caption}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

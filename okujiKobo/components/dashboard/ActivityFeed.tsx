import type { DashboardActivityItem } from '@/lib/dashboard/load'

const DOT_BY_KIND = {
  acquire: 'bg-accent',
  stamp:   'bg-green',
  publish: 'bg-blue',
} as const

/**
 * Recent-activity feed. Single white card, mono timestamps so the
 * column reads cleanly; ~8–10 most recent events across acquisitions,
 * stamps, and publishes. Collector identity is intentionally not
 * surfaced (see DASHBOARD_REVIEW.md — privacy posture).
 */
export function ActivityFeed({ items }: { items: DashboardActivityItem[] }) {
  return (
    <section aria-labelledby="activity-heading">
      <h2
        id="activity-heading"
        className="mb-3 text-[9.5px] font-medium uppercase text-muted"
        style={{ letterSpacing: '1.5px' }}
      >
        Recent activity
      </h2>

      <div className="rounded-[8px] border border-surface-faintdiv bg-white">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-[12px] text-muted">No activity in the last 90 days.</p>
        ) : (
          <ul className="divide-y divide-surface-faintdiv">
            {items.map((it) => (
              <li key={it.id} className="flex items-start gap-3 px-3 py-2.5">
                <time
                  dateTime={it.ts}
                  className="mt-0.5 w-[58px] shrink-0 font-mono text-[10.5px] text-muted"
                >
                  {formatStamp(it.ts)}
                </time>
                <span
                  className={`mt-1.5 inline-block h-[7px] w-[7px] shrink-0 rounded-full ${DOT_BY_KIND[it.kind]}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-ink">{it.label}</p>
                  <p className="truncate text-[10.5px] text-muted">{it.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// Compact relative-ish timestamp: "now", "12m", "3h", "Mar 4". Mono
// so the column aligns regardless of the value.
function formatStamp(iso: string): string {
  const t = new Date(iso).getTime()
  const diffSec = (Date.now() - t) / 1000
  if (diffSec < 60) return 'now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

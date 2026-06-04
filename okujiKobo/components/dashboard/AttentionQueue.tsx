import Link from 'next/link'
import type { DashboardAttentionItem } from '@/lib/dashboard/load'

const BADGE_BY_SEVERITY = {
  error: 'bg-red',
  warn:  'bg-accent',
  info:  'bg-blue',
} as const

/**
 * Stacked queue of "what needs you" items. Empty state is a quiet
 * one-liner, not blank space.
 */
export function AttentionQueue({ items }: { items: DashboardAttentionItem[] }) {
  return (
    <section aria-labelledby="attn-heading">
      <h2
        id="attn-heading"
        className="mb-3 text-[9.5px] font-medium uppercase text-muted"
        style={{ letterSpacing: '1.5px' }}
      >
        Needs attention
      </h2>

      {items.length === 0 ? (
        <div className="rounded-[8px] border border-surface-faintdiv bg-white px-4 py-6 text-[12px] text-muted">
          Nothing needs you right now.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-[8px] border border-surface-faintdiv bg-white px-3 py-3"
            >
              <span
                className={`inline-block h-[9px] w-[9px] shrink-0 rounded-full ${BADGE_BY_SEVERITY[it.severity]}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{it.title}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-muted">{it.meta}</p>
              </div>
              <Link
                href={it.ctaHref}
                className="shrink-0 rounded-[6px] border-[1.5px] border-ink bg-white px-3 py-1.5 text-[11.5px] font-medium text-ink hover:bg-surface-workspace"
              >
                {it.ctaLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

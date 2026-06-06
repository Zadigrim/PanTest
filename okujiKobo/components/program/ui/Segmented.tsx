/**
 * Segmented control — pill-shaped track on `field`, active segment
 * lifts to `cream` chip with the ink border. Replaces the black
 * "Aggregate" button on Analytics + any future two/three-way mode
 * switchers.
 *
 * Server-friendly: each segment is a Link to the URL the parent
 * decides, so deep-link / back-button semantics are preserved.
 * No client state — `active` is decided by the URL on the server.
 *
 * The mock's behavior contract: clicking a segment navigates;
 * active segment is decided by props, not by click. This component
 * preserves that — the existing Analytics aggregate↔drill-in URL
 * shape (?passport=… for drill, omit for aggregate) round-trips
 * verbatim through `href` on each segment.
 */

import Link from 'next/link'
import { cn } from '@/lib/cn'

export interface Segment {
  key: string
  label: string
  href: string
}

export function Segmented({
  segments,
  activeKey,
  ariaLabel,
}: {
  segments: Segment[]
  activeKey: string
  ariaLabel: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-program-pill border-[1.5px] border-hairline bg-field p-1"
    >
      {segments.map((s) => {
        const active = s.key === activeKey
        return (
          <Link
            key={s.key}
            href={s.href}
            role="tab"
            aria-selected={active}
            className={cn(
              'rounded-program-pill px-3 py-1 text-[12px] font-medium transition-colors',
              active
                ? 'border-[1.5px] border-ink bg-cream text-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            {s.label}
          </Link>
        )
      })}
    </div>
  )
}

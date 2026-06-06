/**
 * Slim dashed-border row for empty sections — not a large empty
 * box. Replaces the prior centered "No X yet" Card-sized empty
 * states. Optional CTA renders as a text-link Button on the right;
 * caller passes the honest copy verbatim (per the scope guard
 * "keep every honest empty-state sentence verbatim").
 *
 * Optional faint sparkline visual will land here when needed — the
 * mock allows it; today we just need the row shape.
 */

import Link from 'next/link'
import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function EmptyState({
  children,
  cta,
  className,
}: {
  children: ReactNode
  cta?: { label: string; href: string }
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-program-card border border-dashed border-hairline px-4 py-3 text-[12.5px] text-muted',
        className,
      )}
    >
      <p className="leading-snug">{children}</p>
      {cta && (
        <Link
          href={cta.href}
          className="shrink-0 text-[12px] font-semibold text-green underline-offset-2 hover:underline"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  )
}

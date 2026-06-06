/**
 * Small muted single-line caveat with a faint leading dot. The
 * lighter sibling of `Note` — used for inline footnotes like the
 * "Phase 2 will wire enforcement" capability-flag caveat or a
 * card-foot disclaimer. Never visually competes with the content
 * it annotates.
 */

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function MicroNote({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-[11px] leading-snug text-muted',
        className,
      )}
    >
      <span aria-hidden="true" className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-hairline" />
      <span>{children}</span>
    </p>
  )
}

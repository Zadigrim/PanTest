/**
 * The single info/announcement style for the Program hub. Card body
 * with a 3px clay left border — replaces the prior "Coming later"
 * blue/muted banner and any ad-hoc italic notes. Clay is the warm
 * terracotta token added for this purpose, distinct from accent
 * (gold) and red (error), so an announcement reads as a note and
 * not as a warning.
 */

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function Note({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-program-card border-[1.5px] border-hairline border-l-[3px] border-l-clay bg-cream px-4 py-3 text-[12.5px] text-ink shadow-[0_1px_2px_rgba(31,29,26,0.04)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

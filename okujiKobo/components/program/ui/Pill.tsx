/**
 * Status pill — mono uppercase, small leading dot, the only chip
 * style for status indicators (passport.status, etc.). Two variants
 * cover today's needs: 'live' (green) and 'draft' (muted/hairline).
 * Add new variants here, never inline.
 */

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type Variant = 'live' | 'draft' | 'archived'

const VARIANT: Record<Variant, { dot: string; ring: string; text: string }> = {
  live:     { dot: 'bg-green',    ring: 'border-green',     text: 'text-green' },
  draft:    { dot: 'bg-muted',    ring: 'border-hairline',  text: 'text-muted' },
  archived: { dot: 'bg-clay',     ring: 'border-clay/60',   text: 'text-clay'  },
}

export function Pill({
  variant = 'draft',
  children,
}: {
  variant?: Variant
  children: ReactNode
}) {
  const v = VARIANT[variant]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-program-pill border-[1.5px] bg-cream px-2 py-0.5 font-mono text-[10px] uppercase',
        v.ring,
        v.text,
      )}
      style={{ letterSpacing: '1.2px' }}
    >
      <span aria-hidden="true" className={cn('inline-block h-1.5 w-1.5 rounded-full', v.dot)} />
      {children}
    </span>
  )
}

/** Convenience map for the status string a passport row carries.
 *  Centralizes the status→variant choice so callers don't reinvent
 *  the mapping. */
export function statusToVariant(status: string | null | undefined): Variant {
  const s = (status ?? '').toLowerCase()
  if (s === 'published' || s === 'live') return 'live'
  if (s === 'archived') return 'archived'
  return 'draft'
}

/**
 * The single Card primitive for the Program hub. 1.5px hairline
 * border, 14px radius (`rounded-program-card`), subtle shadow,
 * `cream` background. Every panel in Overview / Passports /
 * Employees / Analytics uses this — no other card shape.
 *
 * The padding default (`p-5`) matches the existing dashboard cards
 * so density carries over. Callers that need a tighter or wider
 * surface pass `padding="sm" | "lg"`.
 */

import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const PADDING = {
  none: '',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-6',
}

export function Card({ children, className, padding = 'md' }: Props) {
  return (
    <div
      className={cn(
        'rounded-program-card border-[1.5px] border-hairline bg-cream shadow-[0_1px_2px_rgba(31,29,26,0.04)]',
        PADDING[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}

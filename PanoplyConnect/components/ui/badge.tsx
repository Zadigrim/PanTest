import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-card px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:    'bg-panoply-gray-2 text-panoply-navy',
        free:       'bg-panoply-teal-lt text-panoply-teal-dk',
        accessible: 'bg-panoply-teal-lt text-panoply-teal-dk',
        certified:  'bg-amber-100 text-amber-800',
        award:      'bg-yellow-100 text-yellow-800',
        challenge:  'bg-red-100 text-panoply-coral',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {variant === 'accessible' && <span aria-hidden="true">♿</span>}
      {children}
    </span>
  )
}

'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

// Extended button with all variants used by the designer (danger, secondary, navy).
// The existing okujiKobo button at components/ui/button.tsx only has
// default/outline/ghost/danger. This version adds secondary and navy so designer
// components don't need to be modified.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-panel text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:   'bg-green text-white hover:bg-green',
        secondary: 'bg-hairline text-navy hover:bg-hairline/80',
        ghost:     'text-navy hover:bg-hairline',
        outline:   'border border-hairline bg-transparent text-navy hover:bg-paper',
        danger:    'bg-accent text-white hover:bg-accent/90',
        navy:      'bg-navy text-white hover:bg-navy/90',
        // Program-kit variants. The mock's "secondary" wants a 1.5px
        // ink border on transparent; the existing `outline` uses a
        // 1px hairline. Keeping both so designer surfaces aren't
        // disturbed.
        'outline-ink': 'border-[1.5px] border-ink bg-transparent text-ink hover:bg-cream',
        // The mock's "text-link" is a green inline call-to-action
        // ("Open in designer →"). Distinct from ghost — no chip
        // background, no padding hover.
        link:          'h-auto p-0 text-green underline-offset-2 hover:underline',
      },
      size: {
        sm:   'h-8 px-3 text-xs',
        md:   'h-9 px-4',
        lg:   'h-10 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

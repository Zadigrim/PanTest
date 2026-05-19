'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

// Extended button with all variants used by the designer (danger, secondary, navy).
// The existing OkujiConnect button at components/ui/button.tsx only has
// default/outline/ghost/danger. This version adds secondary and navy so designer
// components don't need to be modified.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-panel text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:   'bg-okuji-teal text-white hover:bg-okuji-teal-dk',
        secondary: 'bg-okuji-gray-2 text-okuji-navy hover:bg-okuji-gray-2/80',
        ghost:     'text-okuji-navy hover:bg-okuji-gray-2',
        outline:   'border border-okuji-gray-2 bg-transparent text-okuji-navy hover:bg-okuji-gray-1',
        danger:    'bg-okuji-coral text-white hover:bg-okuji-coral/90',
        navy:      'bg-okuji-navy text-white hover:bg-okuji-navy/90',
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

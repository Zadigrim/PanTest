import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-panel text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:   'bg-panoply-teal text-white hover:bg-panoply-teal-dk',
        secondary: 'bg-panoply-gray-2 text-panoply-navy hover:bg-panoply-gray-2/80',
        ghost:     'text-panoply-navy hover:bg-panoply-gray-2',
        outline:   'border border-panoply-gray-2 bg-transparent text-panoply-navy hover:bg-panoply-gray-1',
        danger:    'bg-panoply-coral text-white hover:bg-panoply-coral/90',
        navy:      'bg-panoply-navy text-white hover:bg-panoply-navy/90',
      },
      size: {
        sm:   'h-8 px-3 text-xs',
        md:   'h-9 px-4',
        lg:   'h-10 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
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
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

import * as React from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-panel border border-okuji-gray-2 bg-white px-3 py-1 text-sm text-okuji-navy',
        'placeholder:text-okuji-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'

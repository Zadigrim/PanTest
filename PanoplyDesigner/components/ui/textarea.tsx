import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-panel border border-panoply-gray-2 bg-white px-3 py-2 text-sm text-panoply-navy placeholder:text-panoply-gray-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panoply-teal disabled:cursor-not-allowed disabled:opacity-50 resize-none',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, type = 'text', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-black/20 px-3 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-white/20 sm:text-sm',
        className
      )}
      {...props}
    />
  )
}

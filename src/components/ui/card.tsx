import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, size, ...props }: HTMLAttributes<HTMLDivElement> & { size?: 'sm' | 'default' }) {
  return (
    <div
      data-size={size ?? 'default'}
      className={cn(
        'brand-glass group/card flex flex-col gap-4 rounded-xl py-5 text-card-foreground [--card-spacing:1.25rem] data-[size=sm]:gap-3 data-[size=sm]:py-4 data-[size=sm]:[--card-spacing:1rem]',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between gap-2 px-(--card-spacing)', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-base font-medium', className)} {...props} />
}

export function CardAction({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ml-auto', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-(--card-spacing)', className)} {...props} />
}

'use client'

import type { ComponentProps, HTMLAttributes } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'

export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />
}

export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Popup>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
      <DialogPrimitive.Popup
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl p-5 text-foreground outline-none',
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1', className)} {...props} />
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-base font-medium', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex justify-end gap-2', className)} {...props} />
}

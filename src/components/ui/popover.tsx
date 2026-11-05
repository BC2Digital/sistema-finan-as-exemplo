'use client'

import type { ComponentProps } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@/lib/utils'

export function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root {...props} />
}

export function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger {...props} />
}

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Popup> & { align?: 'start' | 'center' | 'end'; sideOffset?: number }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <PopoverPrimitive.Popup
          className={cn('brand-glass-menu rounded-xl text-popover-foreground outline-none', className)}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cn } from '@/lib/utils'

// Select da Base UI com 3 ajustes:
// - modal={false}: abrir a lista nao trava a rolagem da pagina (no celular
//   travava e cortava a lista)
// - a lista abre sempre pra baixo (sem virar pra cima perto do fim da tela)
// - altura maxima fixa com rolagem interna, sem prender a rolagem de fora

const COLISAO_SEMPRE_EMBAIXO = { side: 'none', align: 'shift', fallbackAxisSide: 'none' } as const

// Sempre com valor em texto: quando a Base UI devolve null (nada
// escolhido), vira string vazia.
export function Select({
  value,
  onValueChange,
  children,
}: {
  value: string
  onValueChange: (valor: string) => void
  children: ReactNode
}) {
  return (
    <SelectPrimitive.Root<string> modal={false} value={value} onValueChange={(v) => onValueChange(v ?? '')}>
      {children}
    </SelectPrimitive.Root>
  )
}

export function SelectTrigger({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-8 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-black/20 px-3 text-sm outline-none transition hover:border-white/15',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectValue({ className, ...props }: ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value className={cn('truncate text-left', className)} {...props} />
}

export function SelectContent({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Popup>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side="bottom"
        sideOffset={4}
        alignItemWithTrigger={false}
        collisionAvoidance={COLISAO_SEMPRE_EMBAIXO}
        className="z-50 outline-none"
      >
        <SelectPrimitive.Popup
          className={cn(
            'brand-glass-menu max-h-72 min-w-(--anchor-width) overflow-y-auto overscroll-contain rounded-lg p-1 text-sm text-popover-foreground outline-none',
            className
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn('flex cursor-pointer items-center rounded-md px-2.5 py-2 outline-none select-none', className)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

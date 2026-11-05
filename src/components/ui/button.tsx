import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variante = 'default' | 'outline' | 'ghost'
type Tamanho = 'default' | 'icon'

const VARIANTES: Record<Variante, string> = {
  default: 'brand-button-primary text-primary-foreground',
  outline: 'border border-white/10 bg-white/[0.02] hover:bg-white/[0.05]',
  ghost: 'hover:bg-white/5',
}

const TAMANHOS: Record<Tamanho, string> = {
  default: 'h-8 px-3',
  icon: 'size-8',
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variante; size?: Tamanho }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        VARIANTES[variant],
        TAMANHOS[size],
        className
      )}
      {...props}
    />
  )
}

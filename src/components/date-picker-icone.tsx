'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DIA_SEMANA_LABELS, MES_NOMES, diasNoMes, parseISO, primeiroDiaSemanaDoMes, toISO } from '@/lib/periodo'

// Icone que abre um mini calendario pra escolher a data. Substitui o
// <input type="date"> nativo, que no Safari do iPhone escreve a data por
// extenso e vaza pra fora da caixa.
export function DatePickerIcone({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [viewAno, setViewAno] = useState(() => (value ? parseISO(value) : new Date()).getFullYear())
  const [viewMes, setViewMes] = useState(() => (value ? parseISO(value) : new Date()).getMonth())

  function abrir(novoAberto: boolean) {
    if (novoAberto) {
      const d = value ? parseISO(value) : new Date()
      setViewAno(d.getFullYear())
      setViewMes(d.getMonth())
    }
    setAberto(novoAberto)
  }

  function mudarMes(delta: number) {
    const d = new Date(viewAno, viewMes + delta, 1)
    setViewAno(d.getFullYear())
    setViewMes(d.getMonth())
  }

  const offset = primeiroDiaSemanaDoMes(viewAno, viewMes)
  const celulas: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasNoMes(viewAno, viewMes) }, (_, i) => new Date(viewAno, viewMes, i + 1)),
  ]
  const [ano, mes, dia] = value ? value.split('-') : []
  const dataFormatada = value ? `${dia}/${mes}/${ano}` : 'Escolher data'

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger
        type="button"
        title={dataFormatada}
        aria-label={`Data: ${dataFormatada}`}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/5 bg-black/30 text-foreground backdrop-blur-md transition hover:border-white/10 hover:bg-black/40"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-4">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            aria-label="Mês anterior"
            className="brand-glass-tile flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            ‹
          </button>
          <span className="text-sm font-medium">
            {MES_NOMES[viewMes]} {viewAno}
          </span>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            aria-label="Próximo mês"
            className="brand-glass-tile flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            ›
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 border-b border-border/30 pb-2 text-center text-[11px] text-muted-foreground">
          {DIA_SEMANA_LABELS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {celulas.map((d, i) => {
            if (!d) return <div key={i} className="size-8" />
            const selecionado = value === toISO(d)
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onChange(toISO(d))
                  setAberto(false)
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md text-sm transition',
                  selecionado ? 'brand-solo-active-glass' : 'text-foreground/80 hover:bg-white/5'
                )}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

'use client'

import { MES_NOMES } from '@/lib/periodo'

export interface MesAno {
  mes: number // 0-11
  ano: number
}

export function mesAnoAtual(): MesAno {
  const hoje = new Date()
  return { mes: hoje.getMonth(), ano: hoje.getFullYear() }
}

// Setas pra andar um mes pra tras/frente. No celular o nome do mes some
// pra caber ao lado do titulo.
export function FiltroMes({ valor, onChange }: { valor: MesAno; onChange: (valor: MesAno) => void }) {
  function mudar(delta: number) {
    const d = new Date(valor.ano, valor.mes + delta, 1)
    onChange({ mes: d.getMonth(), ano: d.getFullYear() })
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => mudar(-1)}
        aria-label="Mês anterior"
        className="brand-glass-tile flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        ‹
      </button>
      <span className="hidden min-w-24 text-center text-sm font-medium sm:inline-block">
        {MES_NOMES[valor.mes]} {valor.ano}
      </span>
      <button
        type="button"
        onClick={() => mudar(1)}
        aria-label="Próximo mês"
        className="brand-glass-tile flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        ›
      </button>
    </div>
  )
}

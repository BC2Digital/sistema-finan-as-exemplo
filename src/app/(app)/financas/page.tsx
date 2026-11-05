'use client'

import { useState } from 'react'
import { FinanceiroPainel } from '@/components/financeiro-painel'
import { FiltroMes, mesAnoAtual } from '@/components/filtro-mes'

export default function MinhasFinancasPage() {
  const [mesAno, setMesAno] = useState(mesAnoAtual)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Minhas Finanças</h1>
          <p className="brand-subtitle text-sm">Controle de gastos pessoais</p>
          <span className="brand-accent-bar mt-3" />
        </div>
        <FiltroMes valor={mesAno} onChange={setMesAno} />
      </div>
      <FinanceiroPainel area="pessoal" mesAno={mesAno} />
    </div>
  )
}

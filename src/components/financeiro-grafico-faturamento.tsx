'use client'

import { formatBRL } from '@/lib/format'
import type { FaturamentoMes } from '@/lib/financas-extra'
import { MASCARA_VALOR, useOcultarValores } from '@/hooks/use-ocultar-valores'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

// Grafico de faturamento mes a mes do ano (Recebíveis), aberto pelo botao
// no canto superior direito do card de lançamentos. Soma de todas as
// entradas de cada mes (inclusive permuta), so os meses que ja chegaram.
// No computador as barras ficam em pe, no celular deitadas.
const COR_FATURAMENTO = '#3987e5'

// Valor sem centavos no rotulo da barra ("R$ 5.100"): com ate 12 colunas
// lado a lado no computador, o valor completo com centavos nao cabe sem
// encostar no rotulo vizinho. O tooltip mostra o valor exato.
function formatSemCentavos(valor: number): string {
  return `R$ ${Math.round(valor).toLocaleString('pt-BR')}`
}

function TooltipFaturamento({
  active,
  payload,
  ocultar,
}: {
  active?: boolean
  payload?: { payload: FaturamentoMes }[]
  ocultar?: boolean
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="brand-glass-menu rounded-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{item.mes}</p>
      <p className="text-muted-foreground">{ocultar ? MASCARA_VALOR : formatBRL(item.valor)}</p>
    </div>
  )
}

export function GraficoFaturamentoMensal({ dados }: { dados: FaturamentoMes[] }) {
  const ocultar = useOcultarValores()
  if (dados.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum faturamento neste ano.</p>
  }
  const alturaCelular = Math.max(160, dados.length * 40)
  return (
    <div className="flex flex-col gap-2">
      {/* computador: barras em pe, distribuidas na horizontal */}
      <div className="hidden h-72 sm:block">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="mes"
              interval={0}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<TooltipFaturamento ocultar={ocultar} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="valor" fill={COR_FATURAMENTO} radius={[4, 4, 0, 0]} maxBarSize={48}>
              <LabelList
                dataKey="valor"
                position="top"
                formatter={(valor) => (ocultar ? MASCARA_VALOR : formatSemCentavos(Number(valor)))}
                style={{ fill: 'var(--foreground)', fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* celular: barras deitadas, uma embaixo da outra */}
      <div className="sm:hidden" style={{ height: alturaCelular }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="mes"
              width={40}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<TooltipFaturamento ocultar={ocultar} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="valor" fill={COR_FATURAMENTO} radius={[0, 4, 4, 0]} maxBarSize={24}>
              <LabelList
                dataKey="valor"
                position="right"
                formatter={(valor) => (ocultar ? MASCARA_VALOR : formatBRL(Number(valor)))}
                style={{ fill: 'var(--foreground)', fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

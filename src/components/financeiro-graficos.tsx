'use client'

import type { FinanceiroLancamento } from '@/lib/financas-queries'
import { ehAjusteSaldo } from '@/lib/financas-fluxo'
import { formatBRL } from '@/lib/format'
import { MASCARA_PERCENTUAL, MASCARA_VALOR, useOcultarValores } from '@/hooks/use-ocultar-valores'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type PieLabelRenderProps,
} from 'recharts'

// Graficos "Categorias" (pizza, so %) e "Gastos" (barras, valor em reais)
// de Minhas Finanças. Usam todas as categorias que tiveram gasto no mes.
// Pizza: legenda na esquerda, circulo na direita. Barras: em pe no
// computador, deitadas no celular. Com o modo ocultar valores ativo, % e
// valores viram asteriscos.
//
// Cor fixa por categoria (pela ordem em Cadastros), nunca por ranking: a
// mesma categoria tem sempre a mesma cor em qualquer mes. A legenda sempre
// traz o nome ao lado da cor, entao a leitura nunca depende so da cor.
const PALETA = [
  '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300',
  '#9085e9', '#e66767', '#86b6ef', '#8a8a93', '#4fb3bf', '#b07cc6',
]

export interface DadoCategoria {
  categoria: string
  valor: number
  percentual: number
  cor: string
}

// categorias: nomes cadastrados, na ordem de Cadastros (define a cor)
export function agruparPorCategoria(lista: FinanceiroLancamento[], categorias: string[]): DadoCategoria[] {
  const totais = new Map<string, number>()
  for (const l of lista) {
    if (!l.categoria || ehAjusteSaldo(l)) continue
    totais.set(l.categoria, (totais.get(l.categoria) ?? 0) + l.valor)
  }

  const total = [...totais.values()].reduce((acc, v) => acc + v, 0)
  const extras = [...totais.keys()].filter((c) => !categorias.includes(c))
  const ordem = [...categorias, ...extras]

  return [...totais.entries()]
    .map(([categoria, valor]) => ({
      categoria,
      valor,
      percentual: total > 0 ? (valor / total) * 100 : 0,
      cor: PALETA[ordem.indexOf(categoria) % PALETA.length],
    }))
    .sort((a, b) => b.valor - a.valor)
}

// % com 1 casa so quando for menor que 10 (ex: "4,5%"), senao inteiro
// ("38%") -- fatia pequena com "0%" ou "1%" redondo enganaria.
function formatPercentual(p: number): string {
  const casas = p < 10 ? 1 : 0
  return `${p.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

// Tooltip da pizza: so categoria + % (pizza nao mostra valor).
function TooltipPercentual({
  active,
  payload,
  ocultar,
}: {
  active?: boolean
  payload?: { payload: DadoCategoria }[]
  ocultar?: boolean
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="brand-glass-menu rounded-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{item.categoria}</p>
      <p className="text-muted-foreground">{ocultar ? MASCARA_PERCENTUAL : formatPercentual(item.percentual)}</p>
    </div>
  )
}

// Tooltip das barras: categoria + valor em reais.
function TooltipValor({
  active,
  payload,
  ocultar,
}: {
  active?: boolean
  payload?: { payload: DadoCategoria }[]
  ocultar?: boolean
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="brand-glass-menu rounded-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{item.categoria}</p>
      <p className="text-muted-foreground">{ocultar ? MASCARA_VALOR : formatBRL(item.valor)}</p>
    </div>
  )
}

// Rotulo de % dentro da fatia. So desenha em fatia com 5% ou mais: abaixo
// disso o texto nao cabe sem sobrepor a vizinha -- o % de TODAS as fatias
// (inclusive as pequenas) continua na legenda ao lado.
const RADIANO = Math.PI / 180
function RotuloPercentual(props: PieLabelRenderProps, ocultar: boolean) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props
  if (percent === undefined || percent < 0.05) return null
  const centroX = Number(cx)
  const centroY = Number(cy)
  const raio = Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) / 2
  const angulo = -(midAngle ?? 0) * RADIANO
  return (
    <text
      x={centroX + raio * Math.cos(angulo)}
      y={centroY + raio * Math.sin(angulo)}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={500}
    >
      {ocultar ? MASCARA_PERCENTUAL : formatPercentual(percent * 100)}
    </text>
  )
}

export function GraficoPizzaCategorias({ dados }: { dados: DadoCategoria[] }) {
  const ocultar = useOcultarValores()
  if (dados.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum gasto neste mês.</p>
  }
  return (
    <div className="flex items-center gap-4 sm:gap-8">
      {/* topicos na esquerda: bolinha + categoria + % (sem valor) */}
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {dados.map((item) => (
          <li key={item.categoria} className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.cor }} />
            <span className="truncate text-foreground">{item.categoria}</span>
            <span className="ml-auto shrink-0 pl-2 text-muted-foreground">{ocultar ? MASCARA_PERCENTUAL : formatPercentual(item.percentual)}</span>
          </li>
        ))}
      </ul>

      {/* circulo na direita */}
      <div className="size-40 shrink-0 sm:size-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="valor"
              nameKey="categoria"
              innerRadius="40%"
              outerRadius="100%"
              paddingAngle={1}
              stroke="none"
              label={(props: PieLabelRenderProps) => RotuloPercentual(props, ocultar)}
              labelLine={false}
              isAnimationActive={false}
            >
              {dados.map((item) => (
                <Cell key={item.categoria} fill={item.cor} />
              ))}
            </Pie>
            <Tooltip content={<TooltipPercentual ocultar={ocultar} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function GraficoBarrasCategorias({ dados }: { dados: DadoCategoria[] }) {
  const ocultar = useOcultarValores()
  if (dados.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum gasto neste mês.</p>
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
              dataKey="categoria"
              interval={0}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<TooltipValor ocultar={ocultar} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {dados.map((item) => (
                <Cell key={item.categoria} fill={item.cor} />
              ))}
              <LabelList
                dataKey="valor"
                position="top"
                formatter={(valor) => (ocultar ? MASCARA_VALOR : formatBRL(Number(valor)))}
                style={{ fill: 'var(--foreground)', fontSize: 12 }}
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
              dataKey="categoria"
              width={88}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<TooltipValor ocultar={ocultar} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {dados.map((item) => (
                <Cell key={item.categoria} fill={item.cor} />
              ))}
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

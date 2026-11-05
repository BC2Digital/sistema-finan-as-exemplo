/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase as db } from '@/lib/supabase'
import { MES_ABREV } from '@/lib/periodo'

// ─── Exclusão com escopo (parcelado ou recorrente) ────────────
//
// "Só este": apaga so a linha clicada.
// "Este e próximos": apaga a linha e as seguintes da mesma serie. Num
//   recorrente, as que sobram deixam de ser recorrentes (pra serie nao
//   voltar a crescer sozinha).
// "Todos": apaga a serie inteira, inclusive as anteriores.

export type EscopoExclusao = 'este' | 'proximos' | 'todos'

export async function excluirLancamentoComEscopo(p: {
  id: string
  grupoId?: string | null
  data: string
  recorrente: boolean
  escopo: EscopoExclusao
}): Promise<boolean> {
  if (p.escopo === 'este' || !p.grupoId) {
    const { error } = await db.from('lancamentos').delete().eq('id', p.id)
    if (error) { console.error('excluir (este):', error); return false }
    return true
  }

  if (p.escopo === 'todos') {
    const { error } = await db.from('lancamentos').delete().eq('parcela_grupo_id', p.grupoId)
    if (error) { console.error('excluir (todos):', error); return false }
    return true
  }

  const { error } = await db.from('lancamentos').delete().eq('parcela_grupo_id', p.grupoId).gte('data', p.data)
  if (error) { console.error('excluir (proximos):', error); return false }
  if (p.recorrente) {
    await db.from('lancamentos').update({ parcela_indefinida: false }).eq('parcela_grupo_id', p.grupoId)
  }
  return true
}

// ─── Faturamento mes a mes (grafico de Recebíveis) ────────────
//
// Soma de todas as entradas de cada mes do ano (inclusive permuta). So os
// meses que ja chegaram, sem projecao.

export interface FaturamentoMes {
  mes: string
  valor: number
}

export async function getFaturamentoPorMes(ano: number): Promise<FaturamentoMes[]> {
  const { data, error } = await db
    .from('lancamentos')
    .select('valor, data')
    .eq('area', 'recebiveis')
    .eq('tipo', 'entrada')
    .gte('data', `${ano}-01-01`)
    .lte('data', `${ano}-12-31`)
  if (error) { console.error('getFaturamentoPorMes:', error); return [] }

  const totais = Array.from({ length: 12 }, () => 0)
  for (const row of (data as any[]) ?? []) {
    const mes = Number(String(row.data).slice(5, 7)) - 1
    totais[mes] += Number(row.valor ?? 0)
  }

  const hoje = new Date()
  const ultimoMes = ano < hoje.getFullYear() ? 11 : ano > hoje.getFullYear() ? -1 : hoje.getMonth()
  return totais
    .slice(0, ultimoMes + 1)
    .map((valor, i) => ({ mes: MES_ABREV[i], valor: Math.round(valor * 100) / 100 }))
}

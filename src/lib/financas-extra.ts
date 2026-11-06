/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase as db } from '@/lib/supabase'
import { MES_ABREV, somarMeses } from '@/lib/periodo'

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

// ─── Quantidade de parcelas (popup de editar) ────────────────
//
// - 0 (campo vazio): vira lançamento avulso, fica so a 1ª parcela.
// - Avulso com 1 ou mais: vira parcelado (ele e a 1ª parcela e as outras
//   nascem nos meses seguintes). Com 1 fica "1/1".
// - Parcelado com mais parcelas: cria as que faltam depois da ultima.
// - Parcelado com menos: apaga as do fim.
// Recorrente ("x") nao passa por aqui. Chamada depois do updateLancamento,
// entao as parcelas novas ja saem com os valores editados.

function copiarLinha(row: any) {
  return {
    area: row.area,
    tipo: row.tipo,
    descricao: row.descricao,
    categoria: row.categoria,
    valor: row.valor,
    cartao_id: row.cartao_id,
    permuta: row.permuta ?? false,
    programado: row.programado ?? false,
  }
}

export async function alterarQuantidadeParcelas(id: string, novoTotal: number): Promise<boolean> {
  const total = Math.max(0, Math.floor(novoTotal))

  const { data: linhaAtual, error: erroLinha } = await db.from('lancamentos').select('*').eq('id', id).single()
  if (erroLinha || !linhaAtual) { console.error('alterarQuantidadeParcelas:', erroLinha); return false }
  const linha = linhaAtual as any
  if (linha.parcela_indefinida) return false

  if (!linha.parcela_grupo_id) {
    if (total < 1) return true
    const grupoId = crypto.randomUUID()
    const { error } = await db
      .from('lancamentos')
      .update({ parcela_grupo_id: grupoId, parcela_numero: 1, parcela_total: total })
      .eq('id', id)
    if (error) { console.error('alterarQuantidadeParcelas (avulso):', error); return false }
    const novas = Array.from({ length: total - 1 }, (_, i) => ({
      ...copiarLinha(linha),
      data: somarMeses(linha.data, i + 1),
      parcela_grupo_id: grupoId,
      parcela_numero: i + 2,
      parcela_total: total,
    }))
    if (novas.length === 0) return true
    const { error: erroInsert } = await db.from('lancamentos').insert(novas)
    if (erroInsert) { console.error('alterarQuantidadeParcelas (insert):', erroInsert); return false }
    return true
  }

  const grupoId = linha.parcela_grupo_id as string
  const { data: doGrupo, error: erroGrupo } = await db
    .from('lancamentos')
    .select('*')
    .eq('parcela_grupo_id', grupoId)
    .order('parcela_numero', { ascending: true })
  if (erroGrupo) { console.error('alterarQuantidadeParcelas (grupo):', erroGrupo); return false }
  const parcelas = (doGrupo as any[]) ?? []
  const ultima = parcelas[parcelas.length - 1] ?? linha
  const ultimoNumero = Number(ultima.parcela_numero ?? parcelas.length)

  if (total < 1) {
    const primeira = parcelas[0] ?? linha
    await db.from('lancamentos').delete().eq('parcela_grupo_id', grupoId).neq('id', primeira.id)
    const { error } = await db
      .from('lancamentos')
      .update({ parcela_grupo_id: null, parcela_numero: null, parcela_total: null })
      .eq('id', primeira.id)
    if (error) { console.error('alterarQuantidadeParcelas (avulso):', error); return false }
    return true
  }

  if (total < ultimoNumero) {
    const { error } = await db.from('lancamentos').delete().eq('parcela_grupo_id', grupoId).gt('parcela_numero', total)
    if (error) { console.error('alterarQuantidadeParcelas (menos):', error); return false }
  } else if (total > ultimoNumero) {
    const novas = Array.from({ length: total - ultimoNumero }, (_, i) => ({
      ...copiarLinha(linha),
      data: somarMeses(ultima.data, i + 1),
      parcela_grupo_id: grupoId,
      parcela_numero: ultimoNumero + i + 1,
      parcela_total: total,
    }))
    const { error } = await db.from('lancamentos').insert(novas)
    if (error) { console.error('alterarQuantidadeParcelas (mais):', error); return false }
  }

  const { error } = await db.from('lancamentos').update({ parcela_total: total }).eq('parcela_grupo_id', grupoId)
  if (error) { console.error('alterarQuantidadeParcelas (total):', error); return false }
  return true
}

// ─── Ordem do grupo "Mês" ─────────────────────────────────────
//
// Prioridade opcional das contas fixas (tabela ordem_mes, ver schema.sql).
// Chave "cartao:<id>" pra fatura, "grupo:<parcela_grupo_id>" pra parcelado
// ou recorrente.

export async function getOrdemMes(): Promise<Map<string, number>> {
  const { data, error } = await db.from('ordem_mes').select('chave, ordem')
  const mapa = new Map<string, number>()
  if (error) { console.error('getOrdemMes:', error); return mapa }
  for (const row of (data as any[]) ?? []) mapa.set(row.chave, Number(row.ordem))
  return mapa
}

// Data e hora exatas do cadastro (o criadoEm dos lançamentos guarda so o
// dia), pra ordenar quem foi cadastrado por ultimo no grupo "Mês".
export async function getCadastradoEm(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (ids.length === 0) return mapa
  const { data, error } = await db.from('lancamentos').select('id, created_at').in('id', ids)
  if (error) { console.error('getCadastradoEm:', error); return mapa }
  for (const row of (data as any[]) ?? []) mapa.set(row.id, row.created_at ?? '')
  return mapa
}

// ─── Graficos de faturamento (Recebíveis) ─────────────────────
//
// Soma de todas as entradas (inclusive permuta), igual ao card Faturamento.

export interface FaturamentoMes {
  mes: string
  valor: number
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

// Os 12 meses do ano, inclusive os que ainda nao chegaram (com zero).
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
  for (const row of (data as any[]) ?? []) totais[Number(String(row.data).slice(5, 7)) - 1] += Number(row.valor ?? 0)
  return totais.map((valor, i) => ({ mes: MES_ABREV[i], valor: arredondar(valor) }))
}

// Faturamento total de cada ano, do primeiro ano com entrada ate o atual.
export async function getFaturamentoPorAno(): Promise<FaturamentoMes[]> {
  const { data, error } = await db.from('lancamentos').select('valor, data').eq('area', 'recebiveis').eq('tipo', 'entrada')
  if (error) { console.error('getFaturamentoPorAno:', error); return [] }
  const totais = new Map<number, number>()
  for (const row of (data as any[]) ?? []) {
    const ano = Number(String(row.data).slice(0, 4))
    totais.set(ano, (totais.get(ano) ?? 0) + Number(row.valor ?? 0))
  }
  const anoAtual = new Date().getFullYear()
  const anos = [...totais.keys()]
  if (anos.length === 0) return [{ mes: String(anoAtual), valor: 0 }]
  const primeiro = Math.min(...anos)
  const ultimo = Math.max(anoAtual, ...anos)
  return Array.from({ length: ultimo - primeiro + 1 }, (_, i) => {
    const ano = primeiro + i
    return { mes: String(ano), valor: arredondar(totais.get(ano) ?? 0) }
  })
}

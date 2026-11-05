/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase as db } from '@/lib/supabase'
import { diasNoMes, hojeISO, toISO } from '@/lib/periodo'
import { getCartoes, rowToLancamento, type FinanceiroCartao, type FinanceiroLancamento } from '@/lib/financas-queries'

// ─────────────────────────────────────────────────────────────
// Fluxo de caixa de Minhas Finanças
// ─────────────────────────────────────────────────────────────
//
// 1) Saldo que passa de um mes pro outro: saldo do fim do mes anterior +
//    o que entra no mes (entradas de Recebíveis sem permuta) - gastos a
//    vista - faturas de cartao que vencem no mes. Comeca no primeiro mes
//    que tem lançamento pessoal.
//
// 2) Ajuste de saldo: clicando no valor do Saldo a pessoa informa o saldo
//    real da conta. A diferença vira um lançamento escondido (categoria
//    CATEGORIA_AJUSTE_SALDO), entao o mes seguinte ja parte do valor certo.
//
// 3) Fatura de cartao em tempo real: cada compra no cartao de credito cai
//    no ciclo dela (ver cicloDaCompra) e a fatura do ciclo aparece no mes
//    do vencimento, somando as compras conforme sao cadastradas, e ja
//    desconta do Saldo daquele mes na data do vencimento.
//
// 4) Marcar fatura como paga: so visual (faturas_pagamentos), nao muda
//    Saldo nem Saídas.

export const CATEGORIA_AJUSTE_SALDO = 'Ajuste de saldo'

export interface FaturaCartao {
  id: string
  cartaoId: string
  cartaoNome: string
  fechamento: string
  vencimento: string
  // data em que a fatura foi marcada como paga (so visual)
  pagoEm: string | null
  valor: number
  // compras que compoem a fatura, por data
  compras: FinanceiroLancamento[]
}

export interface CompraEmAberto {
  valor: number
  cartaoNome: string
  categoria: string
}

export interface FluxoPessoalMes {
  // saldo acumulado no fim do mes
  saldo: number
  // o que sai da conta no mes: gastos a vista + faturas que vencem no mes
  saidasDoMes: number
  // faturas que vencem no mes
  faturasDoMes: FaturaCartao[]
  // compras no cartao que caem na fatura que vence no MES SEGUINTE (card
  // "Cartão de crédito"), seguindo o ciclo de cada cartao
  comprasProximaFatura: CompraEmAberto[]
}

function dataNoMes(ano: number, mes: number, dia: number): Date {
  const base = new Date(ano, mes, 1)
  const a = base.getFullYear()
  const m = base.getMonth()
  return new Date(a, m, Math.min(dia, diasNoMes(a, m)))
}

function inicioDoMesIso(mes: number, ano: number): string {
  return toISO(new Date(ano, mes, 1))
}

function fimDoMesIso(mes: number, ano: number): string {
  return toISO(new Date(ano, mes + 1, 0))
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

// Ciclo da fatura em que uma compra cai. Compra ANTES do dia de fechamento
// entra na fatura que fecha naquele mes; NO dia de fechamento ou depois ja
// vai pra fatura do mes seguinte (igual os bancos). Vencimento no mesmo
// mes do fechamento se o dia de vencimento vem depois (fecha 15, vence
// 22), senao no mes seguinte (fecha 28, vence 5).
export function cicloDaCompra(
  dataCompra: string,
  diaFechamento: number,
  diaVencimento: number,
): { fechamento: string; vencimento: string } {
  const [ano, mes, dia] = dataCompra.split('-').map(Number)
  const mes0 = mes - 1
  const fechamentoNoMes = Math.min(diaFechamento, diasNoMes(ano, mes0))
  const mesFechamento = dia >= fechamentoNoMes ? mes0 + 1 : mes0
  const fechamento = dataNoMes(ano, mesFechamento, diaFechamento)
  const mesVencimento = diaVencimento > diaFechamento ? fechamento.getMonth() : fechamento.getMonth() + 1
  const vencimento = dataNoMes(fechamento.getFullYear(), mesVencimento, diaVencimento)
  return { fechamento: toISO(fechamento), vencimento: toISO(vencimento) }
}

export function ehCompraNoCredito(l: FinanceiroLancamento): boolean {
  return l.area === 'pessoal' && l.tipo === 'saida' && l.cartaoTipo === 'credito'
}

export function ehAjusteSaldo(l: { categoria: string }): boolean {
  return l.categoria === CATEGORIA_AJUSTE_SALDO
}

async function buscarAncora(): Promise<string | null> {
  const { data, error } = await db
    .from('lancamentos')
    .select('data')
    .eq('area', 'pessoal')
    .order('data', { ascending: true })
    .limit(1)
  if (error) { console.error('buscarAncora:', error); return null }
  const primeira = (data as any[])?.[0]?.data as string | undefined
  return primeira ? `${primeira.slice(0, 7)}-01` : null
}

async function buscarPagamentos(): Promise<Map<string, string>> {
  const { data, error } = await db.from('faturas_pagamentos').select('cartao_id, vencimento, pago_em')
  const mapa = new Map<string, string>()
  if (error) { console.error('buscarPagamentos:', error); return mapa }
  for (const row of (data as any[]) ?? []) mapa.set(`${row.cartao_id}:${row.vencimento}`, row.pago_em)
  return mapa
}

async function buscarLancamentos(inicio: string, fim: string): Promise<FinanceiroLancamento[]> {
  const { data, error } = await db
    .from('lancamentos')
    .select('*, cartoes(nome, tipo)')
    .gte('data', inicio)
    .lte('data', fim)
  if (error) { console.error('buscarLancamentos (fluxo):', error); return [] }
  return ((data as any[]) ?? []).map(rowToLancamento)
}

// Agrupa as compras no cartao em faturas (uma por cartao + vencimento).
function montarFaturas(
  compras: FinanceiroLancamento[],
  cartoes: FinanceiroCartao[],
  pagamentos: Map<string, string>,
): { faturas: FaturaCartao[]; chaveDaCompra: Map<string, string> } {
  const cartaoPorId = new Map(cartoes.map((c) => [c.id, c]))
  const faturas = new Map<string, FaturaCartao>()
  const chaveDaCompra = new Map<string, string>()

  for (const l of compras) {
    const cartao = l.cartaoId ? cartaoPorId.get(l.cartaoId) : undefined
    if (!cartao || !cartao.diaFechamento || !cartao.diaVencimento) continue
    const { fechamento, vencimento } = cicloDaCompra(l.data, cartao.diaFechamento, cartao.diaVencimento)
    const chave = `${cartao.id}:${vencimento}`
    chaveDaCompra.set(l.id, chave)

    const existente = faturas.get(chave)
    if (existente) {
      existente.valor = arredondar(existente.valor + l.valor)
      existente.compras.push(l)
      continue
    }
    faturas.set(chave, {
      id: `fatura:${chave}`,
      cartaoId: cartao.id,
      cartaoNome: cartao.nome,
      fechamento,
      vencimento,
      pagoEm: pagamentos.get(chave) ?? null,
      valor: l.valor,
      compras: [l],
    })
  }

  for (const f of faturas.values()) f.compras.sort((a, b) => a.data.localeCompare(b.data))
  return { faturas: [...faturas.values()], chaveDaCompra }
}

// Compra no credito sem ciclo cadastrado (cartao sem dias de fechamento/
// vencimento) desconta na data da compra, como se fosse a vista.
function descontaNaHora(l: FinanceiroLancamento, chaveDaCompra: Map<string, string>): boolean {
  return !ehCompraNoCredito(l) || !chaveDaCompra.has(l.id)
}

// Soma o fluxo entre inicio e fim (inclusive).
function somarFluxo(
  lancamentos: FinanceiroLancamento[],
  faturas: FaturaCartao[],
  chaveDaCompra: Map<string, string>,
  inicio: string,
  fim: string,
): number {
  let total = 0
  for (const l of lancamentos) {
    if (l.data < inicio || l.data > fim) continue
    if (l.area === 'recebiveis') {
      if (l.tipo === 'entrada' && !l.permuta) total += l.valor
      continue
    }
    if (l.tipo === 'entrada') {
      total += l.valor
      continue
    }
    if (descontaNaHora(l, chaveDaCompra)) total -= l.valor
  }
  for (const f of faturas) {
    if (f.vencimento >= inicio && f.vencimento <= fim) total -= f.valor
  }
  return arredondar(total)
}

export async function calcularFluxoPessoal(mes: number, ano: number): Promise<FluxoPessoalMes> {
  const hoje = hojeISO()
  const inicioMes = inicioDoMesIso(mes, ano)
  const fimMes = fimDoMesIso(mes, ano)

  const ancora = await buscarAncora()
  const inicioSaldo = ancora && ancora <= inicioMes ? ancora : inicioMes
  // compras de ate ~2 meses antes podem ter fatura vencendo no mes
  const inicioBusca = toISO(new Date(Number(inicioSaldo.slice(0, 4)), Number(inicioSaldo.slice(5, 7)) - 3, 1))
  const proximoMes = new Date(ano, mes + 1, 1)
  const inicioProximoMes = inicioDoMesIso(proximoMes.getMonth(), proximoMes.getFullYear())
  const fimProximoMes = fimDoMesIso(proximoMes.getMonth(), proximoMes.getFullYear())
  const fimBusca = fimProximoMes > hoje ? fimProximoMes : hoje

  const [lancamentos, cartoes, pagamentos] = await Promise.all([
    buscarLancamentos(inicioBusca, fimBusca),
    getCartoes(),
    buscarPagamentos(),
  ])

  const compras = lancamentos.filter(ehCompraNoCredito)
  const { faturas, chaveDaCompra } = montarFaturas(compras, cartoes, pagamentos)

  const saldo = somarFluxo(lancamentos, faturas, chaveDaCompra, inicioSaldo, fimMes)

  const saidasAVista = lancamentos
    .filter(
      (l) =>
        l.area === 'pessoal' &&
        l.tipo === 'saida' &&
        l.data >= inicioMes &&
        l.data <= fimMes &&
        descontaNaHora(l, chaveDaCompra) &&
        !ehAjusteSaldo(l)
    )
    .reduce((acc, l) => acc + l.valor, 0)
  const faturasDoMes = faturas.filter((f) => f.vencimento >= inicioMes && f.vencimento <= fimMes)
  const saidasDoMes = arredondar(saidasAVista + faturasDoMes.reduce((acc, f) => acc + f.valor, 0))

  const comprasProximaFatura = compras
    .filter((l) => {
      const vencimento = chaveDaCompra.get(l.id)?.split(':')[1]
      return !!vencimento && vencimento >= inicioProximoMes && vencimento <= fimProximoMes
    })
    .map((l) => ({ valor: l.valor, cartaoNome: l.cartaoNome ?? '', categoria: l.categoria }))

  return { saldo, saidasDoMes, faturasDoMes, comprasProximaFatura }
}

// Grava a diferença entre o saldo informado e o calculado como um
// lançamento escondido. Data: hoje se for o mes atual, senao o ultimo dia
// do mes ajustado.
export async function ajustarSaldo(mes: number, ano: number, novoSaldo: number): Promise<boolean> {
  const fluxo = await calcularFluxoPessoal(mes, ano)
  const diferenca = arredondar(novoSaldo - fluxo.saldo)
  if (diferenca === 0) return true

  const hoje = hojeISO()
  const inicioMes = inicioDoMesIso(mes, ano)
  const fimMes = fimDoMesIso(mes, ano)
  const data = hoje >= inicioMes && hoje <= fimMes ? hoje : fimMes

  const { error } = await db.from('lancamentos').insert({
    area: 'pessoal',
    tipo: diferenca > 0 ? 'entrada' : 'saida',
    descricao: CATEGORIA_AJUSTE_SALDO,
    categoria: CATEGORIA_AJUSTE_SALDO,
    valor: Math.abs(diferenca),
    data,
  })
  if (error) { console.error('ajustarSaldo:', error); return false }
  return true
}

export async function marcarFaturaPaga(cartaoId: string, vencimento: string, pago: boolean): Promise<boolean> {
  const { error } = pago
    ? await db.from('faturas_pagamentos').upsert({ cartao_id: cartaoId, vencimento, pago_em: hojeISO() })
    : await db.from('faturas_pagamentos').delete().eq('cartao_id', cartaoId).eq('vencimento', vencimento)
  if (error) { console.error('marcarFaturaPaga:', error); return false }
  return true
}

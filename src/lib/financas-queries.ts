/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase as db } from '@/lib/supabase'
import { hojeISO, somarMeses, toISO } from '@/lib/periodo'

export type FinanceiroArea = 'recebiveis' | 'pessoal'
export type FinanceiroTipo = 'entrada' | 'saida'
export type TipoCartao = 'avista' | 'credito'

export interface FinanceiroCartao {
  id: string
  nome: string
  tipo: TipoCartao
  // so cartao de credito: dia que a fatura fecha e dia que ela vence
  diaFechamento: number | null
  diaVencimento: number | null
  criadoEm: string
}

export interface FinanceiroCategoria {
  id: string
  nome: string
}

export interface FinanceiroLancamento {
  id: string
  area: FinanceiroArea
  tipo: FinanceiroTipo
  // Recebíveis: descricao = cliente, categoria = descricao do servico.
  // Minhas Finanças: descricao = descricao do gasto, categoria = categoria.
  descricao: string
  categoria: string
  valor: number
  data: string
  cartaoId?: string | null
  cartaoNome?: string | null
  cartaoTipo?: TipoCartao | null
  // permuta: conta no faturamento, mas nao e dinheiro de verdade
  permuta?: boolean
  parcelaGrupoId?: string | null
  parcelaNumero?: number | null
  parcelaTotal?: number | null
  // recorrente (o "x" no campo Nº): sem total de parcelas
  parcelaIndefinida?: boolean
  // pagamento programado: vai pro grupo "Este mês" no fim da lista
  programado?: boolean
  // marcado como pago no grupo "Este mês" (so visual)
  pagoEm?: string | null
  criadoEm: string
}

// Recorrente nasce com 1 ano de linhas e a janela e completada aos poucos
// por estenderRecorrencias(), chamada toda vez que a tela carrega.
const MESES_RECORRENCIA_INICIAL = 12
const MESES_HORIZONTE_RECORRENCIA = 12

// Cadastros criados na primeira vez que a pessoa entra (ela pode editar ou
// apagar tudo depois em Cadastros).
const CATEGORIAS_INICIAIS = [
  'Casa', 'Mercado', 'Restaurante', 'Delivery', 'Transporte', 'Saúde',
  'Estudo', 'Pets', 'Lazer', 'Pessoal', 'Assinaturas', 'Empréstimo',
]

const SELECT_LANCAMENTO = '*, cartoes(nome, tipo)'

// ─── Cadastros iniciais ───────────────────────────────────────

export async function garantirCadastrosIniciais(): Promise<void> {
  const [{ count: qtdCartoes }, { count: qtdCategorias }] = await Promise.all([
    db.from('cartoes').select('id', { count: 'exact', head: true }),
    db.from('categorias').select('id', { count: 'exact', head: true }),
  ])
  const tarefas: PromiseLike<unknown>[] = []
  if (qtdCartoes === 0) tarefas.push(db.from('cartoes').insert({ nome: 'À vista', tipo: 'avista' }))
  if (qtdCategorias === 0) tarefas.push(db.from('categorias').insert(CATEGORIAS_INICIAIS.map((nome) => ({ nome }))))
  await Promise.all(tarefas)
}

// ─── Cartões / formas de pagamento ────────────────────────────

export async function getCartoes(): Promise<FinanceiroCartao[]> {
  const { data, error } = await db.from('cartoes').select('*').order('created_at', { ascending: true })
  if (error) { console.error('getCartoes:', error); return [] }
  return ((data as any[]) ?? []).map(rowToCartao)
}

export interface DadosCartao {
  nome: string
  tipo: TipoCartao
  diaFechamento: number | null
  diaVencimento: number | null
}

function cartaoParaRow(c: DadosCartao) {
  const credito = c.tipo === 'credito'
  return {
    nome: c.nome.trim(),
    tipo: c.tipo,
    dia_fechamento: credito ? c.diaFechamento : null,
    dia_vencimento: credito ? c.diaVencimento : null,
  }
}

export async function createCartao(c: DadosCartao): Promise<boolean> {
  const { error } = await db.from('cartoes').insert(cartaoParaRow(c))
  if (error) { console.error('createCartao:', error); return false }
  return true
}

export async function updateCartao(id: string, c: DadosCartao): Promise<boolean> {
  const { error } = await db.from('cartoes').update(cartaoParaRow(c)).eq('id', id)
  if (error) { console.error('updateCartao:', error); return false }
  return true
}

// Os lançamentos que usavam o cartao ficam sem forma de pagamento (contam
// como a vista).
export async function deleteCartao(id: string): Promise<boolean> {
  const { error } = await db.from('cartoes').delete().eq('id', id)
  if (error) { console.error('deleteCartao:', error); return false }
  return true
}

// ─── Categorias ───────────────────────────────────────────────

export async function getCategorias(): Promise<FinanceiroCategoria[]> {
  const { data, error } = await db.from('categorias').select('id, nome').order('created_at', { ascending: true })
  if (error) { console.error('getCategorias:', error); return [] }
  return ((data as any[]) ?? []).map((row) => ({ id: row.id, nome: row.nome ?? '' }))
}

export async function createCategoria(nome: string): Promise<boolean> {
  const { error } = await db.from('categorias').insert({ nome: nome.trim() })
  if (error) { console.error('createCategoria:', error); return false }
  return true
}

// Renomear tambem atualiza os lançamentos que ja usavam o nome antigo.
export async function renameCategoria(id: string, nomeAntigo: string, nomeNovo: string): Promise<boolean> {
  const nome = nomeNovo.trim()
  const { error } = await db.from('categorias').update({ nome }).eq('id', id)
  if (error) { console.error('renameCategoria:', error); return false }
  await db.from('lancamentos').update({ categoria: nome }).eq('area', 'pessoal').eq('categoria', nomeAntigo)
  return true
}

export async function deleteCategoria(id: string): Promise<boolean> {
  const { error } = await db.from('categorias').delete().eq('id', id)
  if (error) { console.error('deleteCategoria:', error); return false }
  return true
}

// ─── Lançamentos ──────────────────────────────────────────────

export interface NovoLancamento {
  area: FinanceiroArea
  tipo: FinanceiroTipo
  descricao: string
  categoria: string
  valor: number
  data: string
  cartaoId?: string | null
  permuta?: boolean
  programado?: boolean
}

function novoParaRow(n: NovoLancamento) {
  return {
    area: n.area,
    tipo: n.tipo,
    descricao: n.descricao.trim(),
    categoria: n.categoria,
    valor: n.valor,
    data: n.data,
    cartao_id: n.cartaoId || null,
    permuta: !!n.permuta,
    programado: !!n.programado,
  }
}

// Lançamentos de um mes. Minhas Finanças tambem recebe as entradas de
// Recebíveis (menos permuta): tudo que entra la conta como dinheiro aqui.
export async function getLancamentosDoMes(
  area: FinanceiroArea,
  mes: number,
  ano: number,
): Promise<FinanceiroLancamento[]> {
  const inicio = toISO(new Date(ano, mes, 1))
  const fim = toISO(new Date(ano, mes + 1, 0))
  const areasBusca = area === 'pessoal' ? ['pessoal', 'recebiveis'] : [area]

  const { data, error } = await db
    .from('lancamentos')
    .select(SELECT_LANCAMENTO)
    .in('area', areasBusca)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) { console.error('getLancamentosDoMes:', error); return [] }
  const linhas = ((data as any[]) ?? []).map(rowToLancamento)
  if (area === 'pessoal') return linhas.filter((l) => !(l.area === 'recebiveis' && l.permuta))
  return linhas
}

// Soma de todas as entradas (inclusive permuta) do ano civil.
export async function getFaturamentoAno(ano: number): Promise<number> {
  const { data, error } = await db
    .from('lancamentos')
    .select('valor')
    .eq('area', 'recebiveis')
    .eq('tipo', 'entrada')
    .gte('data', `${ano}-01-01`)
    .lte('data', `${ano}-12-31`)
  if (error) { console.error('getFaturamentoAno:', error); return 0 }
  return ((data as any[]) ?? []).reduce((acc, row) => acc + Number(row.valor ?? 0), 0)
}

export async function createLancamento(novo: NovoLancamento): Promise<boolean> {
  const { error } = await db.from('lancamentos').insert(novoParaRow(novo))
  if (error) { console.error('createLancamento:', error); return false }
  return true
}

// Parcelado: uma linha por mes, ja com a data de cada parcela.
export async function createLancamentoParcelado(
  novo: NovoLancamento,
  totalParcelas: number,
): Promise<boolean> {
  const grupoId = crypto.randomUUID()
  const linhas = Array.from({ length: totalParcelas }, (_, i) => ({
    ...novoParaRow(novo),
    data: somarMeses(novo.data, i),
    parcela_grupo_id: grupoId,
    parcela_numero: i + 1,
    parcela_total: totalParcelas,
  }))
  const { error } = await db.from('lancamentos').insert(linhas)
  if (error) { console.error('createLancamentoParcelado:', error); return false }
  return true
}

// Recorrente (o "x" no campo Nº): mensalidade sem data pra acabar.
export async function createLancamentoRecorrente(novo: NovoLancamento): Promise<boolean> {
  const grupoId = crypto.randomUUID()
  const linhas = Array.from({ length: MESES_RECORRENCIA_INICIAL }, (_, i) => ({
    ...novoParaRow(novo),
    data: somarMeses(novo.data, i),
    parcela_grupo_id: grupoId,
    parcela_numero: i + 1,
    parcela_total: null,
    parcela_indefinida: true,
  }))
  const { error } = await db.from('lancamentos').insert(linhas)
  if (error) { console.error('createLancamentoRecorrente:', error); return false }
  return true
}

// Mantem cada recorrente sempre com pelo menos 12 meses gerados pra frente.
export async function estenderRecorrencias(): Promise<void> {
  const { data, error } = await db
    .from('lancamentos')
    .select('*')
    .eq('parcela_indefinida', true)
    .order('data', { ascending: false })
  if (error) { console.error('estenderRecorrencias:', error); return }
  if (!data || data.length === 0) return

  const ultimaPorGrupo = new Map<string, any>()
  for (const row of data as any[]) {
    const atual = ultimaPorGrupo.get(row.parcela_grupo_id)
    if (!atual || row.data > atual.data) ultimaPorGrupo.set(row.parcela_grupo_id, row)
  }

  const limite = somarMeses(hojeISO(), MESES_HORIZONTE_RECORRENCIA)
  const linhasNovas: any[] = []
  for (const ultima of ultimaPorGrupo.values()) {
    let dataCursor: string = ultima.data
    let numero: number = ultima.parcela_numero ?? 1
    while (dataCursor < limite) {
      dataCursor = somarMeses(dataCursor, 1)
      numero += 1
      linhasNovas.push({
        area: ultima.area,
        tipo: ultima.tipo,
        descricao: ultima.descricao,
        categoria: ultima.categoria,
        valor: ultima.valor,
        data: dataCursor,
        cartao_id: ultima.cartao_id,
        permuta: ultima.permuta ?? false,
        programado: ultima.programado ?? false,
        parcela_grupo_id: ultima.parcela_grupo_id,
        parcela_numero: numero,
        parcela_total: null,
        parcela_indefinida: true,
      })
    }
  }
  if (linhasNovas.length === 0) return
  const { error: erroInsert } = await db.from('lancamentos').insert(linhasNovas)
  if (erroInsert) console.error('estenderRecorrencias insert:', erroInsert)
}

// Edita so a linha (parcela) clicada.
export async function updateLancamento(
  id: string,
  campos: { descricao?: string; categoria?: string; valor?: number; data?: string; cartaoId?: string | null },
): Promise<boolean> {
  const payload: Record<string, unknown> = {}
  if (campos.descricao !== undefined) payload.descricao = campos.descricao.trim()
  if (campos.categoria !== undefined) payload.categoria = campos.categoria
  if (campos.valor !== undefined) payload.valor = campos.valor
  if (campos.data !== undefined) payload.data = campos.data
  if (campos.cartaoId !== undefined) payload.cartao_id = campos.cartaoId
  const { error } = await db.from('lancamentos').update(payload).eq('id', id)
  if (error) { console.error('updateLancamento:', error); return false }
  return true
}

// Programado vale pra serie inteira (parcelado ou recorrente).
export async function definirProgramado(
  id: string,
  grupoId: string | null | undefined,
  programado: boolean,
): Promise<boolean> {
  const consulta = db.from('lancamentos').update({ programado })
  const { error } = grupoId ? await consulta.eq('parcela_grupo_id', grupoId) : await consulta.eq('id', id)
  if (error) { console.error('definirProgramado:', error); return false }
  return true
}

// Marcar como pago e so visual: nao muda Saldo nem Saídas.
export async function marcarLancamentoPago(id: string, pago: boolean): Promise<boolean> {
  const { error } = await db.from('lancamentos').update({ pago_em: pago ? hojeISO() : null }).eq('id', id)
  if (error) { console.error('marcarLancamentoPago:', error); return false }
  return true
}

// ─── Resumo ────────────────────────────────────────────────────

export interface FinanceiroResumo {
  entradas: number
  // entradas sem permuta (dinheiro de verdade)
  entradasReais: number
  // entradas sem permuta do mes seguinte
  aReceberProximoMes: number
}

export function calcularResumoDoMes(
  doMes: FinanceiroLancamento[],
  doProximoMes: FinanceiroLancamento[],
): FinanceiroResumo {
  const ehEntrada = (l: FinanceiroLancamento) => l.tipo === 'entrada' && l.area === 'recebiveis'
  const entradas = doMes.filter(ehEntrada).reduce((acc, l) => acc + l.valor, 0)
  const entradasReais = doMes.filter((l) => ehEntrada(l) && !l.permuta).reduce((acc, l) => acc + l.valor, 0)
  const aReceberProximoMes = doProximoMes
    .filter((l) => ehEntrada(l) && !l.permuta)
    .reduce((acc, l) => acc + l.valor, 0)
  return { entradas, entradasReais, aReceberProximoMes }
}

// ─── Conversores ──────────────────────────────────────────────

export function rowToCartao(row: any): FinanceiroCartao {
  return {
    id: row.id,
    nome: row.nome ?? '',
    tipo: row.tipo === 'credito' ? 'credito' : 'avista',
    diaFechamento: row.dia_fechamento ?? null,
    diaVencimento: row.dia_vencimento ?? null,
    criadoEm: row.created_at?.slice(0, 10) ?? '',
  }
}

export function rowToLancamento(row: any): FinanceiroLancamento {
  return {
    id: row.id,
    area: row.area,
    tipo: row.tipo,
    descricao: row.descricao ?? '',
    categoria: row.categoria ?? '',
    valor: Number(row.valor ?? 0),
    data: row.data ?? '',
    cartaoId: row.cartao_id ?? null,
    cartaoNome: row.cartoes?.nome ?? null,
    cartaoTipo: row.cartoes?.tipo ?? null,
    permuta: row.permuta ?? false,
    parcelaGrupoId: row.parcela_grupo_id ?? null,
    parcelaNumero: row.parcela_numero ?? null,
    parcelaTotal: row.parcela_total ?? null,
    parcelaIndefinida: row.parcela_indefinida ?? false,
    programado: row.programado ?? false,
    pagoEm: row.pago_em ?? null,
    criadoEm: row.created_at?.slice(0, 10) ?? '',
  }
}

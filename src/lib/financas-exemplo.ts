import type { FinanceiroArea, FinanceiroCartao, FinanceiroLancamento } from '@/lib/financas-queries'
import type { FaturaCartao } from '@/lib/financas-fluxo'
import type { FaturamentoMes as FaturamentoPeriodo } from '@/lib/financas-extra'

// Dados de demonstracao do financeiro (ver use-modo-exemplo.ts). Tudo sai
// de um gerador com semente fixa por mes, entao os mesmos numeros aparecem
// sempre que o modo e ligado. Usa os cartoes e categorias cadastrados, so
// os valores e os lançamentos sao inventados. Nada disso vai pro banco.

// Valores fixos dos cards de Minhas Finanças (Recebíveis sai da soma dos
// lançamentos de exemplo)
export const EXEMPLO_PESSOAL = {
  saldo: 84312.57,
  saidas: 23643.89,
  cartaoCredito: 8127.43,
  aReceber: 52418.36,
}

const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
// primeiro ano que aparece no grafico de faturamento por ano
const ANO_INICIAL = 2025

function gerador(semente: string): () => number {
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function centavos(v: number): number {
  return Math.round(v * 100) / 100
}

function dataIso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// ultimo dia que pode ter lançamento: hoje no mes atual, fim do mes nos outros
function ultimoDiaUtil(ano: number, mes: number): number {
  const fim = new Date(ano, mes + 1, 0).getDate()
  const agora = new Date()
  return agora.getFullYear() === ano && agora.getMonth() === mes ? agora.getDate() : fim
}

// divide um total em n partes quebradas que somam exatamente o total
function dividir(total: number, n: number, rnd: () => number): number[] {
  const pesos = Array.from({ length: n }, () => 0.4 + rnd())
  const soma = pesos.reduce((a, b) => a + b, 0)
  const partes = pesos.map((p) => centavos((total * p) / soma))
  partes[n - 1] = centavos(total - partes.slice(0, -1).reduce((a, b) => a + b, 0))
  return partes
}

function lancamento(base: Partial<FinanceiroLancamento> & Pick<FinanceiroLancamento, 'id' | 'descricao' | 'valor' | 'data'>, area: FinanceiroArea): FinanceiroLancamento {
  return {
    area,
    tipo: area === 'recebiveis' ? 'entrada' : 'saida',
    categoria: '',
    criadoEm: base.data,
    ...base,
  }
}

// ---- Recebíveis ----

const CLIENTES = [
  'Clínica Vitta', 'Studio Fit', 'Auto Center Silva', 'Imobiliária Prime', 'Odonto Sorriso',
  'Construtora Alfa', 'Pet Shop Amigo', 'Restaurante Sabor', 'Ótica Visão', 'Escola Saber',
  'Advocacia Lima', 'Estética Bella',
]
const SERVICOS = ['Consultoria', 'Projeto', 'Mensalidade', 'Manutenção', 'Treinamento']

// faturamento do mes entre 50 e 80 mil (zero nos meses que ainda nao chegaram)
function faturamentoDoMes(ano: number, mes: number): number {
  const agora = new Date()
  if (ano > agora.getFullYear() || (ano === agora.getFullYear() && mes > agora.getMonth())) return 0
  if (ano < ANO_INICIAL) return 0
  const rnd = gerador(`fat-${ano}-${mes}`)
  return centavos(50000 + rnd() * 30000)
}

export function lancamentosExemploRecebiveis(ano: number, mes: number): FinanceiroLancamento[] {
  // mes que ainda nao chegou (A receber): usa o valor que o mes teria
  const rndBase = gerador(`fat-${ano}-${mes}`)
  const total = faturamentoDoMes(ano, mes) || centavos(50000 + rndBase() * 30000)
  const rnd = gerador(`recebiveis-${ano}-${mes}`)
  const n = 9 + Math.floor(rnd() * 4)
  const valores = dividir(total, n, rnd)
  const ultimoDia = ultimoDiaUtil(ano, mes)
  return valores
    .map((valor, i) => {
      const permuta = i === n - 1
      return lancamento(
        {
          id: `exemplo-rec-${ano}-${mes}-${i}`,
          descricao: CLIENTES[(i + mes) % CLIENTES.length],
          categoria: SERVICOS[Math.floor(rnd() * SERVICOS.length)],
          valor,
          data: dataIso(ano, mes, 1 + Math.floor(rnd() * ultimoDia)),
          permuta,
        },
        'recebiveis'
      )
    })
    .sort((a, b) => b.data.localeCompare(a.data))
}

export function faturamentoExemploAno(ano: number): number {
  return centavos(Array.from({ length: 12 }, (_, m) => faturamentoDoMes(ano, m)).reduce((a, b) => a + b, 0))
}

export function faturamentoExemploMeses(ano: number): FaturamentoPeriodo[] {
  return MES_ABREV.map((mes, i) => ({ mes, valor: faturamentoDoMes(ano, i) }))
}

export function faturamentoExemploPorAno(): FaturamentoPeriodo[] {
  const anoAtual = new Date().getFullYear()
  return Array.from({ length: anoAtual - ANO_INICIAL + 1 }, (_, i) => ({
    mes: String(ANO_INICIAL + i),
    valor: faturamentoExemploAno(ANO_INICIAL + i),
  }))
}

// ---- Minhas Finanças ----

// nomes de exemplo por categoria (chave sem acento e minuscula); categoria
// sem lista usa o proprio nome
const DESCRICOES: Record<string, string[]> = {
  casa: ['Material de limpeza', 'Conserto chuveiro', 'Utilidades'],
  emprestimo: ['Parcela empréstimo'],
  restaurante: ['Restaurante', 'Pizzaria', 'Hamburgueria', 'Japonês'],
  delivery: ['Delivery', 'Delivery mercado'],
  ifood: ['iFood', 'iFood Mercado'],
  mercado: ['Supermercado', 'Hortifruti', 'Padaria', 'Atacado'],
  transporte: ['Combustível', 'Uber', 'Estacionamento', 'Pedágio'],
  saude: ['Farmácia', 'Consulta', 'Exames'],
  estudo: ['Curso online', 'Livros'],
  pets: ['Pet shop', 'Veterinário', 'Ração'],
  lazer: ['Cinema', 'Show', 'Passeio'],
  pessoal: ['Barbearia', 'Roupas', 'Academia'],
  assinaturas: ['Netflix', 'Spotify', 'Streaming', 'Nuvem'],
}

function chave(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function nomesPara(categoria: string): string[] {
  return DESCRICOES[chave(categoria)] ?? [categoria]
}

// acha a categoria cadastrada pelo nome padrao (ou a 1ª, se nao existir)
function categoriaParecida(categorias: string[], nome: string): string {
  return categorias.find((c) => chave(c) === chave(nome)) ?? categorias[0] ?? nome
}

export interface ExemploPessoal {
  lancamentos: FinanceiroLancamento[]
  faturas: FaturaCartao[]
  // ordem de prioridade dos programados de exemplo no grupo "Mês"
  ordem: Map<string, number>
}

export function exemploPessoal(
  ano: number,
  mes: number,
  cartoes: FinanceiroCartao[],
  categoriasCadastradas: string[]
): ExemploPessoal {
  const rnd = gerador(`pessoal-${ano}-${mes}`)
  const credito = cartoes.filter((c) => c.tipo === 'credito' && c.diaVencimento)
  const avista = cartoes.find((c) => c.tipo !== 'credito') ?? null
  const semEmprestimo = categoriasCadastradas.filter((c) => chave(c) !== 'emprestimo')
  const categorias = semEmprestimo.length > 0 ? semEmprestimo : ['Mercado', 'Restaurante', 'Transporte', 'Pessoal']
  const ultimoDia = ultimoDiaUtil(ano, mes)
  const lancamentos: FinanceiroLancamento[] = []

  // linha do tempo: gastos do mes, a vista e no cartao
  const quantidade = 22 + Math.floor(rnd() * 8)
  for (let i = 0; i < quantidade; i++) {
    const categoria = categorias[Math.floor(rnd() * categorias.length)]
    const nomes = nomesPara(categoria)
    const cartao = rnd() < 0.55 && credito.length > 0 ? credito[Math.floor(rnd() * credito.length)] : avista
    const c = chave(categoria)
    const faixa = c === 'mercado' ? 480 : c === 'restaurante' ? 260 : c === 'assinaturas' ? 60 : 190
    lancamentos.push(
      lancamento(
        {
          id: `exemplo-${ano}-${mes}-${i}`,
          descricao: nomes[Math.floor(rnd() * nomes.length)],
          categoria,
          valor: centavos(18 + rnd() * faixa),
          data: dataIso(ano, mes, 1 + Math.floor(rnd() * ultimoDia)),
          cartaoId: cartao?.id ?? null,
          cartaoNome: cartao?.nome ?? null,
          cartaoTipo: cartao?.tipo ?? null,
        },
        'pessoal'
      )
    )
  }
  lancamentos.sort((a, b) => b.data.localeCompare(a.data))

  // programados do grupo "Mês" (contas fixas e alguns pix)
  const programados: { chave: string; ordem?: number; descricao: string; categoria: string; valor: number; indefinida?: boolean; parcela?: [number, number] }[] = [
    { chave: 'exemplo-luz', ordem: 1, descricao: 'Conta de luz', categoria: 'Casa', valor: 287.43, indefinida: true },
    { chave: 'exemplo-agua', ordem: 2, descricao: 'Conta de água', categoria: 'Casa', valor: 134.62, indefinida: true },
    { chave: 'exemplo-internet', ordem: 6, descricao: 'Internet', categoria: 'Assinaturas', valor: 149.9, indefinida: true },
    { chave: 'exemplo-emprestimo', ordem: 7, descricao: 'Empréstimo', categoria: 'Empréstimo', valor: 1847.36, parcela: [9, 24] },
    { chave: 'exemplo-aluguel', descricao: 'Aluguel', categoria: 'Casa', valor: 3450 },
    { chave: 'exemplo-condominio', descricao: 'Condomínio', categoria: 'Casa', valor: 612.8 },
    { chave: 'exemplo-academia', descricao: 'Academia', categoria: 'Pessoal', valor: 189.9, parcela: [4, 12] },
  ]
  const ordem = new Map<string, number>()
  programados.forEach((p, i) => {
    if (p.ordem !== undefined) ordem.set(`grupo:${p.chave}`, p.ordem)
    lancamentos.push(
      lancamento(
        {
          id: `exemplo-prog-${ano}-${mes}-${i}`,
          descricao: p.descricao,
          categoria: categoriaParecida(categoriasCadastradas, p.categoria),
          valor: p.valor,
          data: dataIso(ano, mes, 5 + i),
          cartaoId: avista?.id ?? null,
          cartaoNome: avista?.nome ?? null,
          cartaoTipo: avista?.tipo ?? null,
          programado: true,
          parcelaGrupoId: p.chave,
          parcelaIndefinida: !!p.indefinida,
          parcelaNumero: p.parcela?.[0] ?? null,
          parcelaTotal: p.parcela?.[1] ?? null,
          // cadastro mais novo em cima: o ultimo da lista e o mais recente
          criadoEm: `2026-01-01T00:00:${String(i).padStart(2, '0')}`,
        },
        'pessoal'
      )
    )
  })

  // faturas dos cartoes de credito que vencem no mes
  const totaisFatura = dividir(6200 + rnd() * 1800, Math.max(1, credito.length), rnd)
  const faturas: FaturaCartao[] = credito.map((c, ci) => {
    const n = 5 + Math.floor(rnd() * 5)
    const valores = dividir(totaisFatura[ci], n, rnd)
    const vencimento = dataIso(ano, mes, Math.min(c.diaVencimento ?? 10, new Date(ano, mes + 1, 0).getDate()))
    const compras = valores.map((valor, i) => {
      const categoria = categorias[Math.floor(rnd() * categorias.length)]
      const nomes = nomesPara(categoria)
      const parcelado = rnd() < 0.3
      const total = 2 + Math.floor(rnd() * 10)
      return lancamento(
        {
          id: `exemplo-fat-${c.id}-${ano}-${mes}-${i}`,
          descricao: nomes[Math.floor(rnd() * nomes.length)],
          categoria,
          valor,
          data: dataIso(mes === 0 ? ano - 1 : ano, mes === 0 ? 11 : mes - 1, 1 + Math.floor(rnd() * 28)),
          cartaoId: c.id,
          cartaoNome: c.nome,
          cartaoTipo: c.tipo,
          parcelaNumero: parcelado ? 1 + Math.floor(rnd() * total) : null,
          parcelaTotal: parcelado ? total : null,
        },
        'pessoal'
      )
    })
    return {
      id: `exemplo-fatura-${c.id}-${ano}-${mes}`,
      cartaoId: c.id,
      cartaoNome: c.nome,
      fechamento: vencimento,
      vencimento,
      pagoEm: null,
      valor: totaisFatura[ci],
      compras,
    }
  })

  // faturas logo acima das contas de luz e agua
  credito.forEach((c, i) => ordem.set(`cartao:${c.id}`, 3 + i))
  // internet e emprestimo acima das faturas
  ordem.set('grupo:exemplo-internet', 3 + credito.length)
  ordem.set('grupo:exemplo-emprestimo', 4 + credito.length)

  return { lancamentos, faturas, ordem }
}

'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  calcularResumoDoMes,
  createLancamento,
  createLancamentoParcelado,
  createLancamentoRecorrente,
  definirProgramado,
  estenderRecorrencias,
  getCartoes,
  getCategorias,
  getFaturamentoAno,
  getLancamentosDoMes,
  marcarLancamentoPago,
  updateLancamento,
  type FinanceiroArea,
  type FinanceiroCartao,
  type FinanceiroCategoria,
  type FinanceiroLancamento,
  type FinanceiroTipo,
  type NovoLancamento,
} from '@/lib/financas-queries'
import {
  ajustarSaldo,
  calcularFluxoPessoal,
  ehAjusteSaldo,
  ehCompraNoCredito,
  marcarFaturaPaga,
  type FaturaCartao,
  type FluxoPessoalMes,
} from '@/lib/financas-fluxo'
import {
  excluirLancamentoComEscopo,
  getFaturamentoPorMes,
  type EscopoExclusao,
  type FaturamentoMes,
} from '@/lib/financas-extra'
import { cn } from '@/lib/utils'
import { MASCARA_VALOR, definirOcultarValores, useOcultarValores } from '@/hooks/use-ocultar-valores'
import { formatBRL } from '@/lib/format'
import { MES_ABREV, MES_NOMES } from '@/lib/periodo'
import type { MesAno } from '@/components/filtro-mes'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DatePickerIcone } from '@/components/date-picker-icone'
import {
  GraficoBarrasCategorias,
  GraficoPizzaCategorias,
  agruparPorCategoria,
} from '@/components/financeiro-graficos'
import { GraficoFaturamentoMensal } from '@/components/financeiro-grafico-faturamento'
import {
  IconArrowsExchange,
  IconBook2,
  IconCalendarRepeat,
  IconCash,
  IconChartBar,
  IconChartCandle,
  IconChartPie,
  IconCheck,
  IconChevronDown,
  IconConfetti,
  IconCreditCard,
  IconGasStation,
  IconHeartbeat,
  IconHome2,
  IconLoader2,
  IconMotorbike,
  IconPaw,
  IconReceipt2,
  IconRepeat,
  IconShoppingCart,
  IconToolsKitchen2,
  IconUser,
} from '@tabler/icons-react'

const ALTURA_CAMPO = 'h-11!'
const ALTURA_CAMPO_QUADRADA = 'h-11! w-11!'

function hoje() {
  const d = new Date()
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function sufixoParcela(l: FinanceiroLancamento) {
  if (l.parcelaIndefinida) return '∞'
  if (l.parcelaTotal && l.parcelaTotal > 1) return `${l.parcelaNumero}/${l.parcelaTotal}`
  return ''
}

function ehSerie(l: FinanceiroLancamento | null): boolean {
  if (!l || !l.parcelaGrupoId) return false
  return !!l.parcelaIndefinida || (l.parcelaTotal ?? 0) > 1
}

const OPCOES_ESCOPO: { valor: EscopoExclusao; rotulo: string }[] = [
  { valor: 'este', rotulo: 'Só este' },
  { valor: 'proximos', rotulo: 'Este e próximos' },
  { valor: 'todos', rotulo: 'Todos' },
]

function formatDataCurta(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

function subtituloFatura(f: FaturaCartao): string {
  const n = f.compras.length
  return `${f.cartaoNome} · ${n} ${n === 1 ? 'compra' : 'compras'}`
}

function estaPago(item: ItemLista): boolean {
  return item.fatura ? !!item.fatura.pagoEm : !!item.pagoEm
}

const ESTILO_PAGO: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(114, 9, 183, 0.3), rgba(247, 37, 133, 0.22))',
  borderColor: 'rgba(247, 37, 133, 0.28)',
}

type ItemLista = FinanceiroLancamento & { fatura?: FaturaCartao }

function faturaComoItem(f: FaturaCartao): ItemLista {
  return {
    id: f.id,
    area: 'pessoal',
    tipo: 'saida',
    descricao: `Fatura ${f.cartaoNome}`,
    categoria: '',
    valor: f.valor,
    data: f.vencimento,
    cartaoNome: f.cartaoNome,
    criadoEm: '',
    fatura: f,
  }
}

function mesSeguinte({ mes, ano }: MesAno): MesAno {
  return mes === 11 ? { mes: 0, ano: ano + 1 } : { mes: mes + 1, ano }
}

function formatarValorDigitado(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '')
  if (!digitos) return ''

  const comZerosMinimos = digitos.padStart(3, '0')
  const parteDecimal = comZerosMinimos.slice(-2)
  const parteInteiraBruta = comZerosMinimos.slice(0, -2).replace(/^0+(?=\d)/, '') || '0'
  const comMilhar = parteInteiraBruta.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${comMilhar},${parteDecimal}`
}

function paraNumero(valorFormatado: string): number {
  return Number(valorFormatado.replace(/\./g, '').replace(',', '.')) || 0
}

function formatarValorNumero(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function nomeDoCartao(cartoes: FinanceiroCartao[], id: string | null): string {
  if (!id) return 'Pagamento'
  return cartoes.find((c) => c.id === id)?.nome ?? 'Pagamento'
}

const ICONE_CATEGORIA: Record<string, typeof IconReceipt2> = {
  casa: IconHome2,
  restaurante: IconToolsKitchen2,
  delivery: IconMotorbike,
  ifood: IconMotorbike,
  mercado: IconShoppingCart,
  transporte: IconGasStation,
  estudo: IconBook2,
  pets: IconPaw,
  pessoal: IconUser,
  assinaturas: IconRepeat,
  saude: IconHeartbeat,
  lazer: IconConfetti,
  emprestimo: IconCash,
}

function iconeDaCategoria(categoria: string): typeof IconReceipt2 {
  const chave = categoria.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return ICONE_CATEGORIA[chave] ?? IconReceipt2
}

const CLASSE_CIRCULO =
  'flex size-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-black/20 text-foreground backdrop-blur-sm'

function IconeCategoria({
  categoria,
  fatura,
  pago,
  onAlternarPago,
}: {
  categoria: string
  fatura?: boolean
  pago?: boolean
  onAlternarPago?: () => void
}) {
  const Icone = fatura ? IconCreditCard : iconeDaCategoria(categoria)
  if (!onAlternarPago) {
    return (
      <div className={CLASSE_CIRCULO}>
        <Icone className="size-4" />
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onAlternarPago}
      aria-pressed={!!pago}
      aria-label={pago ? 'Marcar como não pago' : 'Marcar como pago'}
      className={cn(CLASSE_CIRCULO, 'cursor-pointer transition-[background,border-color] hover:border-white/15')}
      style={pago ? ESTILO_PAGO : undefined}
    >
      <Icone className="size-4" />
    </button>
  )
}

function formatCabecalhoData(dataIso: string): string {
  const [, mes, dia] = dataIso.split('-')
  return `${dia} ${MES_ABREV[Number(mes) - 1]}`
}

function agruparPorData<T extends { data: string }>(lista: T[]): { data: string; itens: T[] }[] {
  const grupos: { data: string; itens: T[] }[] = []
  for (const l of lista) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.data === l.data) {
      ultimo.itens.push(l)
    } else {
      grupos.push({ data: l.data, itens: [l] })
    }
  }
  return grupos
}

function CampoValor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (valor: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <span
        className={cn(
          'pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm',
          value ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        R$
      </span>
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder ?? '0,00'}
        value={value}
        onChange={(e) => onChange(formatarValorDigitado(e.target.value))}
        className={cn(ALTURA_CAMPO, 'w-full pl-9')}
      />
    </div>
  )
}

interface FinanceiroPainelProps {
  area: FinanceiroArea
  mesAno: MesAno
}

// Painel compartilhado entre Recebíveis e Minhas Finanças.
//
// Recebíveis: so ENTRADA. Descrição do servico + Cliente, valor, Nº de
// parcelas ("x" = recorrente), Permuta (troca sem dinheiro: conta no
// faturamento, mas nao vira dinheiro em Minhas Finanças) e data.
// Cards: Entradas, Recebido (sem permuta), A receber (mes seguinte) e
// Faturamento do ano.
//
// Minhas Finanças: so SAÍDA. Descrição, forma de pagamento e categoria
// (cadastradas em Cadastros), valor, Nº, Pix programado e data. Tudo que
// entra em Recebíveis (menos permuta) entra aqui como dinheiro. Cards:
// Saldo (acumulado mes a mes, clique pra ajustar), Saídas, Cartão de
// crédito (compras que caem na fatura do mes seguinte) e A receber.
//
// Lista: linha do tempo por dia com o que foi gasto no mes (sem os
// programados e sem as parcelas 2 em diante de compra no cartao, que ja
// estao dentro da fatura) e, no fim, o grupo "Este mês" com tudo que tem
// que ser pago no mes (faturas + programados) por data de pagamento. A
// fatura abre as compras dela pela setinha e o icone a esquerda marca como
// pago (so visual). Clicar no valor abre o popup de editar/excluir.
//
// Filtros de Pagamento e Categoria afetam Saídas, Cartão de crédito e a
// lista (com filtro as faturas saem). Saldo, A receber e graficos ignoram
// os filtros. Clicar no valor do 4º card liga/desliga o modo ocultar
// valores.
export function FinanceiroPainel({ area, mesAno }: FinanceiroPainelProps) {
  const tipo: FinanceiroTipo = area === 'recebiveis' ? 'entrada' : 'saida'
  const anoAtual = new Date().getFullYear()

  const ocultarValores = useOcultarValores()
  const brl = (v: number) => (ocultarValores ? MASCARA_VALOR : formatBRL(v))

  const [lancamentosDoMes, setLancamentosDoMes] = useState<FinanceiroLancamento[]>([])
  const [lancamentosProximoMes, setLancamentosProximoMes] = useState<FinanceiroLancamento[]>([])
  const [cartoes, setCartoes] = useState<FinanceiroCartao[]>([])
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([])
  const [faturamentoAno, setFaturamentoAno] = useState(0)
  const [faturamentoMensal, setFaturamentoMensal] = useState<FaturamentoMes[]>([])
  const [fluxo, setFluxo] = useState<FluxoPessoalMes | null>(null)
  const [carregando, setCarregando] = useState(true)

  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hoje())
  const [cartaoId, setCartaoId] = useState('')
  const [parcelas, setParcelas] = useState('')
  const [programado, setProgramado] = useState(false)
  const [permuta, setPermuta] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [filtroCartao, setFiltroCartao] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')

  const [visualizacao, setVisualizacao] = useState<'lista' | 'pizza' | 'categorias' | 'faturamento'>('lista')

  const [faturasAbertas, setFaturasAbertas] = useState<Set<string>>(new Set())

  const graficoRef = useRef<HTMLDivElement>(null)

  const [editando, setEditando] = useState<FinanceiroLancamento | null>(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editCategoria, setEditCategoria] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editData, setEditData] = useState('')
  const [editCartaoId, setEditCartaoId] = useState('')
  const [editProgramado, setEditProgramado] = useState(false)
  const [escopoExclusao, setEscopoExclusao] = useState<EscopoExclusao>('este')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  const [ajustandoSaldo, setAjustandoSaldo] = useState(false)
  const [valorAjuste, setValorAjuste] = useState('')
  const [salvandoAjuste, setSalvandoAjuste] = useState(false)

  const cartoesSelecionaveis = cartoes
  const nomesCategorias = categorias.map((c) => c.nome)

  const parcelasTrim = parcelas.trim().toLowerCase()
  const parcelasEhIndefinida = parcelasTrim === 'x'
  const parcelasTotalNumerico = Math.max(1, Number(parcelasTrim) || 1)

  useEffect(() => {
    carregar()
  }, [area, mesAno.mes, mesAno.ano])

  useEffect(() => {
    if (visualizacao === 'lista') return
    const id = window.setTimeout(() => {
      graficoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 80)
    return () => window.clearTimeout(id)
  }, [visualizacao])

  async function carregar() {
    setCarregando(true)
    await estenderRecorrencias()
    const proximo = mesSeguinte(mesAno)
    const [doMes, doProximo, cs, cats] = await Promise.all([
      getLancamentosDoMes(area, mesAno.mes, mesAno.ano),
      getLancamentosDoMes(area, proximo.mes, proximo.ano),
      getCartoes(),
      getCategorias(),
    ])
    setLancamentosDoMes(doMes)
    setLancamentosProximoMes(doProximo)
    setCartoes(cs)
    setCategorias(cats)

    if (area === 'recebiveis') {
      const [totalAno, porMes] = await Promise.all([
        getFaturamentoAno(anoAtual),
        getFaturamentoPorMes(mesAno.ano),
      ])
      setFaturamentoAno(totalAno)
      setFaturamentoMensal(porMes)
    } else {
      setFluxo(await calcularFluxoPessoal(mesAno.mes, mesAno.ano))
    }

    setCarregando(false)
  }

  function passaFiltro(l: { cartaoNome?: string | null; categoria: string }) {
    if (filtroCartao !== 'todos' && l.cartaoNome !== filtroCartao) return false
    if (filtroCategoria !== 'todos' && l.categoria !== filtroCategoria) return false
    return true
  }

  const temFiltroAtivo = area === 'pessoal' && (filtroCartao !== 'todos' || filtroCategoria !== 'todos')
  const doMesFiltrado = temFiltroAtivo ? lancamentosDoMes.filter(passaFiltro) : lancamentosDoMes

  const resumo = calcularResumoDoMes(lancamentosDoMes, lancamentosProximoMes)

  const saldoPessoal = fluxo?.saldo ?? 0
  const saidasPessoal = temFiltroAtivo
    ? doMesFiltrado
        .filter((l) => l.area === 'pessoal' && l.tipo === 'saida' && !ehAjusteSaldo(l))
        .reduce((acc, l) => acc + l.valor, 0)
    : (fluxo?.saidasDoMes ?? 0)
  const aReceberPessoal =
    area === 'pessoal' ? resumo.aReceberProximoMes : 0

  const comprasProximaFatura = fluxo?.comprasProximaFatura ?? []
  const totalFaturaAberta = (temFiltroAtivo ? comprasProximaFatura.filter(passaFiltro) : comprasProximaFatura)
    .reduce((acc, c) => acc + c.valor, 0)

  const saidasDoMesLista = doMesFiltrado.filter((l) => l.tipo !== 'entrada' && !ehAjusteSaldo(l))
  const linhaDoTempo: ItemLista[] =
    area === 'pessoal'
      ? saidasDoMesLista.filter(
          (l) => !l.programado && (temFiltroAtivo || !(ehCompraNoCredito(l) && (l.parcelaNumero ?? 1) > 1))
        )
      : doMesFiltrado
  const itensEsteMes: ItemLista[] =
    area === 'pessoal'
      ? [
          ...(temFiltroAtivo ? [] : (fluxo?.faturasDoMes ?? []).map(faturaComoItem)),
          ...saidasDoMesLista.filter((l) => l.programado),
        ].sort((a, b) => a.data.localeCompare(b.data))
      : []
  const gruposPorData = agruparPorData(linhaDoTempo)

  const dadosCategoria = agruparPorCategoria(lancamentosDoMes.filter((l) => l.tipo !== 'entrada'), nomesCategorias)

  const editandoEhSerie = ehSerie(editando)

  async function salvar() {
    const valorNumerico = paraNumero(valor)
    if (!descricao.trim() || !valorNumerico || valorNumerico <= 0) return

    setSalvando(true)

    const novo: NovoLancamento = {
      area,
      tipo,
      descricao,
      categoria,
      valor: valorNumerico,
      data,
      cartaoId: area === 'pessoal' ? cartaoId || null : null,
      permuta: area === 'recebiveis' && permuta,
      programado: area === 'pessoal' && programado,
    }
    if (parcelasEhIndefinida) await createLancamentoRecorrente(novo)
    else if (parcelasTotalNumerico > 1) await createLancamentoParcelado(novo, parcelasTotalNumerico)
    else await createLancamento(novo)

    setDescricao('')
    setValor('')
    setParcelas('')
    setProgramado(false)
    setPermuta(false)
    setSalvando(false)
    carregar()
  }

  function abrirEdicao(l: FinanceiroLancamento) {
    setEditando(l)
    setEditDescricao(l.descricao)
    setEditCategoria(l.categoria)
    setEditValor(formatarValorNumero(l.valor))
    setEditData(l.data)
    setEditCartaoId(l.cartaoId ?? '')
    setEditProgramado(!!l.programado)
    setEscopoExclusao('este')
  }

  function fecharEdicao() {
    setEditando(null)
  }

  async function salvarEdicao() {
    if (!editando) return
    const valorNumerico = paraNumero(editValor)
    if (!editDescricao.trim() || !valorNumerico || valorNumerico <= 0) return

    setSalvandoEdicao(true)
    await updateLancamento(editando.id, {
      descricao: editDescricao,
      categoria: editCategoria,
      valor: valorNumerico,
      data: editData,
      cartaoId: area === 'pessoal' ? editCartaoId || null : editando.cartaoId,
    })
    if (area === 'pessoal' && editProgramado !== !!editando.programado) {
      await definirProgramado(editando.id, editando.parcelaGrupoId, editProgramado)
    }
    setSalvandoEdicao(false)
    setEditando(null)
    carregar()
  }

  async function excluirEdicao() {
    if (!editando) return
    const escopo: EscopoExclusao = editandoEhSerie ? escopoExclusao : 'este'
    const mensagem =
      escopo === 'todos'
        ? 'Excluir todos os lançamentos desta série, inclusive os anteriores?'
        : escopo === 'proximos'
          ? 'Excluir este lançamento e todos os próximos desta série?'
          : 'Excluir este lançamento?'
    if (!window.confirm(mensagem)) return

    setExcluindo(true)
    await excluirLancamentoComEscopo({
      id: editando.id,
      grupoId: editando.parcelaGrupoId,
      data: editando.data,
      recorrente: !!editando.parcelaIndefinida,
      escopo,
    })
    setExcluindo(false)
    setEditando(null)
    carregar()
  }

  async function alternarPago(item: ItemLista) {
    const pago = !estaPago(item)
    const pagoEm = pago ? hoje() : null
    const fatura = item.fatura
    if (fatura) {
      setFluxo((atual) =>
        atual && {
          ...atual,
          faturasDoMes: atual.faturasDoMes.map((f) => (f.id === fatura.id ? { ...f, pagoEm } : f)),
        }
      )
      await marcarFaturaPaga(fatura.cartaoId, fatura.vencimento, pago)
    } else {
      setLancamentosDoMes((lista) => lista.map((l) => (l.id === item.id ? { ...l, pagoEm } : l)))
      await marcarLancamentoPago(item.id, pago)
    }
  }

  function alternarFaturaAberta(id: string) {
    setFaturasAbertas((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function abrirAjusteSaldo() {
    setValorAjuste(saldoPessoal > 0 ? formatarValorNumero(saldoPessoal) : '')
    setAjustandoSaldo(true)
  }

  async function salvarAjusteSaldo() {
    setSalvandoAjuste(true)
    await ajustarSaldo(mesAno.mes, mesAno.ano, paraNumero(valorAjuste))
    setSalvandoAjuste(false)
    setAjustandoSaldo(false)
    carregar()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">{area === 'recebiveis' ? 'Entradas' : 'Saldo'}</p>
            {area === 'recebiveis' ? (
              <p className="mt-1 text-lg font-medium text-emerald-400">{brl(resumo.entradas)}</p>
            ) : (
              <p
                onClick={abrirAjusteSaldo}
                onKeyDown={(e) => e.key === 'Enter' && abrirAjusteSaldo()}
                role="button"
                tabIndex={0}
                className={cn(
                  'mt-1 cursor-pointer text-lg font-medium transition hover:opacity-70',
                  saldoPessoal < 0 ? 'text-rose-400' : 'text-emerald-400'
                )}
              >
                {brl(saldoPessoal)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">{area === 'recebiveis' ? 'Recebido' : 'Saídas'}</p>
            <p className={cn('mt-1 text-lg font-medium', area === 'recebiveis' ? 'text-blue-400' : 'text-rose-400')}>
              {area === 'recebiveis' ? brl(resumo.entradasReais) : `- ${brl(saidasPessoal)}`}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">{area === 'recebiveis' ? 'A receber' : 'Cartão de crédito'}</p>
            <p className="mt-1 text-lg font-medium">
              {brl(area === 'recebiveis' ? resumo.aReceberProximoMes : totalFaturaAberta)}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {area === 'recebiveis' ? `Faturamento ${anoAtual}` : 'A receber'}
            </p>
            <p
              onClick={() => definirOcultarValores(!ocultarValores)}
              onKeyDown={(e) => e.key === 'Enter' && definirOcultarValores(!ocultarValores)}
              role="button"
              tabIndex={0}
              className="mt-1 text-lg font-medium outline-none"
            >
              {brl(area === 'recebiveis' ? faturamentoAno : aReceberPessoal)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo lançamento</CardTitle>
        </CardHeader>
        <CardContent>
          {area === 'recebiveis' ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex items-center gap-2 sm:contents">
                <Input
                  placeholder="Descrição"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className={cn(ALTURA_CAMPO, 'flex-[2] min-w-0 sm:flex-1')}
                />
                <Input
                  placeholder="Cliente"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className={cn(ALTURA_CAMPO, 'flex-1 min-w-0 sm:w-40 sm:flex-none')}
                />
              </div>

              <div className="flex items-center gap-2 sm:contents">
                <CampoValor
                  value={valor}
                  onChange={setValor}
                  className="flex-1 min-w-0 sm:w-32 sm:flex-none"
                />
                <Input
                  placeholder="Nº"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  className={cn(ALTURA_CAMPO, 'w-14 shrink-0 text-center')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPermuta((p) => !p)}
                  aria-label="Permuta"
                  aria-pressed={permuta}
                  title="Permuta (troca, sem dinheiro)"
                  className={cn(ALTURA_CAMPO_QUADRADA, 'shrink-0', permuta && 'brand-solo-active-glass')}
                >
                  <IconArrowsExchange />
                </Button>
                <DatePickerIcone value={data} onChange={setData} />
                <Button
                  onClick={salvar}
                  disabled={salvando}
                  size="icon"
                  aria-label="Lançar"
                  className={cn(ALTURA_CAMPO_QUADRADA, 'brand-glass-tile shrink-0')}
                >
                  {salvando ? <IconLoader2 className="animate-spin" /> : <IconCheck />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex items-center gap-2 sm:contents">
                <Input
                  placeholder="Descrição"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className={cn(ALTURA_CAMPO, 'w-full min-w-0 sm:flex-1')}
                />
              </div>

              <div className="flex items-center gap-2 sm:contents">
                <Select value={cartaoId} onValueChange={setCartaoId}>
                  <SelectTrigger className={cn(ALTURA_CAMPO, 'flex-1 min-w-0 sm:w-36 sm:flex-none')}>
                    <SelectValue placeholder="Pagamento">
                      {(id: string | null) => nomeDoCartao(cartoesSelecionaveis, id)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {cartoesSelecionaveis.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className={cn(ALTURA_CAMPO, 'flex-1 min-w-0 sm:w-32 sm:flex-none')}>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {nomesCategorias.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 sm:contents">
                <CampoValor
                  value={valor}
                  onChange={setValor}
                  className="flex-1 min-w-0 sm:w-28 sm:flex-none"
                />

                <Input
                  placeholder="Nº"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  className={cn(ALTURA_CAMPO, 'w-14 shrink-0 text-center')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setProgramado((p) => !p)}
                  aria-label="Pix programado"
                  aria-pressed={programado}
                  title="Pix programado"
                  className={cn(ALTURA_CAMPO_QUADRADA, 'shrink-0', programado && 'brand-solo-active-glass')}
                >
                  <IconCalendarRepeat />
                </Button>
                <DatePickerIcone value={data} onChange={setData} />
                <Button
                  onClick={salvar}
                  disabled={salvando}
                  size="icon"
                  aria-label="Lançar"
                  className={cn(ALTURA_CAMPO_QUADRADA, 'brand-glass-tile shrink-0')}
                >
                  {salvando ? <IconLoader2 className="animate-spin" /> : <IconCheck />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {visualizacao === 'pizza' && `Categorias ${MES_NOMES[mesAno.mes]}`}
            {visualizacao === 'categorias' && `Gastos ${MES_NOMES[mesAno.mes]}`}
            {visualizacao === 'faturamento' && `Faturamento ${mesAno.ano}`}
            {visualizacao === 'lista' && `Lançamento ${MES_NOMES[mesAno.mes]}`}
          </CardTitle>
          {area === 'recebiveis' && (
            <CardAction>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setVisualizacao((v) => (v === 'faturamento' ? 'lista' : 'faturamento'))}
                aria-label="Gráfico de faturamento por mês"
                className={cn(
                  'text-muted-foreground hover:text-foreground',
                  visualizacao === 'faturamento' && 'brand-solo-active-glass text-foreground'
                )}
              >
                <IconChartBar />
              </Button>
            </CardAction>
          )}
        </CardHeader>

        {area === 'pessoal' && (
          <div className="flex flex-nowrap items-center gap-2 px-(--card-spacing)">
            <Select value={filtroCartao} onValueChange={setFiltroCartao}>
              <SelectTrigger
                className={cn(ALTURA_CAMPO, 'min-w-0 flex-[3] sm:flex-1', filtroCartao === 'todos' && 'text-muted-foreground')}
              >
                <SelectValue placeholder="Pagamento">
                  {(valor: string | null) => (!valor || valor === 'todos' ? 'Pagamento' : valor)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {cartoesSelecionaveis.map((c) => (
                  <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger
                className={cn(ALTURA_CAMPO, 'min-w-0 flex-[2] sm:flex-1', filtroCategoria === 'todos' && 'text-muted-foreground')}
              >
                <SelectValue placeholder="Categoria">
                  {(valor: string | null) => (!valor || valor === 'todos' ? 'Categoria' : valor)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {nomesCategorias.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setVisualizacao((v) => (v === 'pizza' ? 'lista' : 'pizza'))}
              aria-label="Gráfico de pizza por categoria"
              className={cn(ALTURA_CAMPO_QUADRADA, 'shrink-0', visualizacao === 'pizza' && 'brand-solo-active-glass')}
            >
              <IconChartPie />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setVisualizacao((v) => (v === 'categorias' ? 'lista' : 'categorias'))}
              aria-label="Gráfico de valor por categoria"
              className={cn(
                ALTURA_CAMPO_QUADRADA,
                'shrink-0',
                visualizacao === 'categorias' && 'brand-solo-active-glass'
              )}
            >
              <IconChartCandle />
            </Button>
          </div>
        )}

        <CardContent className="flex flex-col gap-1">
          {carregando && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {!carregando && visualizacao !== 'lista' && (
            <div ref={graficoRef} className="scroll-mb-4">
              {visualizacao === 'pizza' && <GraficoPizzaCategorias dados={dadosCategoria} />}
              {visualizacao === 'categorias' && <GraficoBarrasCategorias dados={dadosCategoria} />}
              {visualizacao === 'faturamento' && <GraficoFaturamentoMensal dados={faturamentoMensal} />}
            </div>
          )}

          {!carregando && visualizacao === 'lista' && linhaDoTempo.length === 0 && itensEsteMes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum lançamento neste mês.</p>
          )}
          {visualizacao === 'lista' && gruposPorData.map((grupo, indiceGrupo) => (
            <div
              key={grupo.data}
              className={cn(
                indiceGrupo > 0 && 'mt-4 border-t border-white/10 pt-4'
              )}
            >
              <p className="px-1 pb-2 text-xs font-light text-muted-foreground">
                {formatCabecalhoData(grupo.data)}
              </p>
              {grupo.itens.map((l, indiceItem) => (
                <div
                  key={l.id}
                  className={cn(
                    indiceItem > 0 && 'border-t border-white/5',
                    'flex items-center justify-between gap-3 py-2.5 text-sm'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <IconeCategoria categoria={l.categoria} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{l.descricao}</span>
                      <span className="text-xs font-thin text-muted-foreground/40">
                        {[l.categoria, l.cartaoNome, l.permuta && 'Permuta', sufixoParcela(l)].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                  <span
                    onClick={() => abrirEdicao(l)}
                    onKeyDown={(e) => e.key === 'Enter' && abrirEdicao(l)}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'shrink-0 cursor-pointer font-medium transition hover:opacity-70',
                      l.tipo === 'entrada' ? 'text-emerald-400' : 'text-rose-400'
                    )}
                  >
                    {l.tipo === 'entrada' ? '+' : '-'} {brl(l.valor)}
                  </span>
                </div>
              ))}
            </div>
          ))}

          {visualizacao === 'lista' && !carregando && itensEsteMes.length > 0 && (
            <div className={cn(gruposPorData.length > 0 && 'mt-4 border-t border-white/10 pt-4')}>
              <p className="px-1 pb-2 text-xs font-light text-muted-foreground">Este mês</p>
              {itensEsteMes.map((item, indiceItem) => {
                const fatura = item.fatura
                const aberta = !!fatura && faturasAbertas.has(item.id)
                return (
                  <div key={item.id} className={cn(indiceItem > 0 && 'border-t border-white/5')}>
                    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        <IconeCategoria
                          categoria={item.categoria}
                          fatura={!!fatura}
                          pago={estaPago(item)}
                          onAlternarPago={() => alternarPago(item)}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">
                            <span className="mr-1.5 text-xs font-light tabular-nums text-muted-foreground">
                              {formatDataCurta(item.data)}
                            </span>
                            {item.descricao}
                          </span>
                          <span className="text-xs font-thin text-muted-foreground/40">
                            {fatura
                              ? subtituloFatura(fatura)
                              : [item.categoria, item.cartaoNome, sufixoParcela(item)].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </div>
                      {fatura ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="font-medium text-rose-400">- {brl(item.valor)}</span>
                          <button
                            type="button"
                            onClick={() => alternarFaturaAberta(item.id)}
                            aria-expanded={aberta}
                            aria-label={aberta ? 'Fechar compras da fatura' : 'Ver compras da fatura'}
                            className="-mr-1 flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                          >
                            <IconChevronDown className={cn('size-4 transition-transform', aberta && 'rotate-180')} />
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => abrirEdicao(item)}
                          onKeyDown={(e) => e.key === 'Enter' && abrirEdicao(item)}
                          role="button"
                          tabIndex={0}
                          className="shrink-0 cursor-pointer font-medium text-rose-400 transition hover:opacity-70"
                        >
                          - {brl(item.valor)}
                        </span>
                      )}
                    </div>

                    {fatura && aberta && (
                      <div className="mb-2 ml-[18px] flex flex-col border-l border-white/10 pl-5">
                        {fatura.compras.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-muted-foreground">
                                <span className="mr-1.5 font-light tabular-nums text-muted-foreground/60">
                                  {formatDataCurta(c.data)}
                                </span>
                                {c.descricao}
                              </span>
                              <span className="font-thin text-muted-foreground/40">
                                {[c.categoria, sufixoParcela(c)].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                            <span
                              onClick={() => abrirEdicao(c)}
                              onKeyDown={(e) => e.key === 'Enter' && abrirEdicao(c)}
                              role="button"
                              tabIndex={0}
                              className="shrink-0 cursor-pointer text-muted-foreground transition hover:opacity-70"
                            >
                              - {brl(c.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editando} onOpenChange={(aberto) => !aberto && fecharEdicao()}>
        <DialogContent className="brand-glass-menu sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar lançamento</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Input
              placeholder={area === 'recebiveis' ? 'Cliente' : 'Descrição'}
              value={editDescricao}
              onChange={(e) => setEditDescricao(e.target.value)}
              className={ALTURA_CAMPO}
            />

            {area === 'recebiveis' ? (
              <Input
                placeholder="Descrição"
                value={editCategoria}
                onChange={(e) => setEditCategoria(e.target.value)}
                className={ALTURA_CAMPO}
              />
            ) : (
              <>
                <Select value={editCategoria} onValueChange={setEditCategoria}>
                  <SelectTrigger className={`w-full ${ALTURA_CAMPO}`}>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {nomesCategorias.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={editCartaoId} onValueChange={setEditCartaoId}>
                  <SelectTrigger className={`w-full ${ALTURA_CAMPO}`}>
                    <SelectValue placeholder="Pagamento">
                      {(id: string | null) => nomeDoCartao(cartoesSelecionaveis, id)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {cartoesSelecionaveis.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditProgramado((p) => !p)}
                  aria-pressed={editProgramado}
                  className={cn(
                    ALTURA_CAMPO,
                    'w-full justify-start gap-2 font-normal',
                    editProgramado ? 'brand-solo-active-glass' : 'text-muted-foreground'
                  )}
                >
                  <IconCalendarRepeat />
                  Pix programado
                </Button>
              </>
            )}

            <div className="flex items-center gap-2">
              <CampoValor value={editValor} onChange={setEditValor} className="flex-1" />
              <DatePickerIcone value={editData} onChange={setEditData} />
            </div>

            {editandoEhSerie && editando && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {editando.parcelaIndefinida
                    ? 'Lançamento recorrente. Ao excluir:'
                    : `Parcela ${editando.parcelaNumero} de ${editando.parcelaTotal}. Ao excluir:`}
                </p>
                <div className="flex gap-2">
                  {OPCOES_ESCOPO.map((opcao) => (
                    <Button
                      key={opcao.valor}
                      type="button"
                      variant="outline"
                      onClick={() => setEscopoExclusao(opcao.valor)}
                      className={cn(
                        ALTURA_CAMPO,
                        'min-w-0 flex-1 px-2 text-xs',
                        escopoExclusao === opcao.valor && 'brand-solo-active-glass'
                      )}
                    >
                      {opcao.rotulo}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={excluirEdicao}
              disabled={excluindo || salvandoEdicao}
              className={cn(ALTURA_CAMPO, 'text-rose-400 hover:text-rose-400')}
            >
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </Button>
            <Button onClick={salvarEdicao} disabled={salvandoEdicao || excluindo} className={ALTURA_CAMPO}>
              {salvandoEdicao ? 'Salvando...' : 'Alterar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ajustandoSaldo} onOpenChange={setAjustandoSaldo}>
        <DialogContent className="brand-glass-menu sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar saldo</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Informe o saldo real de {MES_NOMES[mesAno.mes]}. A diferença entra só no saldo, sem aparecer na
              lista, e o mês seguinte já parte desse valor.
            </p>
            <CampoValor value={valorAjuste} onChange={setValorAjuste} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAjustandoSaldo(false)}
              disabled={salvandoAjuste}
              className={ALTURA_CAMPO}
            >
              Cancelar
            </Button>
            <Button onClick={salvarAjusteSaldo} disabled={salvandoAjuste} className={ALTURA_CAMPO}>
              {salvandoAjuste ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

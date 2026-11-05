'use client'

import { useEffect, useState } from 'react'
import { IconCheck, IconPencil, IconTrash, IconX } from '@tabler/icons-react'
import {
  createCartao,
  createCategoria,
  deleteCartao,
  deleteCategoria,
  getCartoes,
  getCategorias,
  renameCategoria,
  updateCartao,
  type DadosCartao,
  type FinanceiroCartao,
  type FinanceiroCategoria,
  type TipoCartao,
} from '@/lib/financas-queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ROTULO_TIPO: Record<TipoCartao, string> = { avista: 'À vista', credito: 'Crédito' }

function descreverCartao(c: FinanceiroCartao): string {
  if (c.tipo !== 'credito') return 'À vista (pix, débito, dinheiro)'
  if (!c.diaFechamento || !c.diaVencimento) return 'Crédito · sem dias cadastrados'
  return `Crédito · fecha dia ${c.diaFechamento} · vence dia ${c.diaVencimento}`
}

function diaValido(texto: string): number | null {
  const n = Number(texto)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
}

// Formulario de forma de pagamento (novo ou edicao).
function FormCartao({
  inicial,
  rotuloSalvar,
  onSalvar,
  onCancelar,
}: {
  inicial?: FinanceiroCartao
  rotuloSalvar: string
  onSalvar: (dados: DadosCartao) => Promise<void>
  onCancelar?: () => void
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [tipo, setTipo] = useState<TipoCartao>(inicial?.tipo ?? 'credito')
  const [fechamento, setFechamento] = useState(inicial?.diaFechamento ? String(inicial.diaFechamento) : '')
  const [vencimento, setVencimento] = useState(inicial?.diaVencimento ? String(inicial.diaVencimento) : '')
  const [salvando, setSalvando] = useState(false)

  const credito = tipo === 'credito'
  const valido = nome.trim() !== '' && (!credito || (diaValido(fechamento) && diaValido(vencimento)))

  async function salvar() {
    if (!valido) return
    setSalvando(true)
    await onSalvar({
      nome,
      tipo,
      diaFechamento: credito ? diaValido(fechamento) : null,
      diaVencimento: credito ? diaValido(vencimento) : null,
    })
    setSalvando(false)
    if (!inicial) {
      setNome('')
      setFechamento('')
      setVencimento('')
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input placeholder="Nome (ex: Nubank)" value={nome} onChange={(e) => setNome(e.target.value)} className="h-11 sm:flex-1" />
      <div className="flex items-center gap-2">
        <Select value={tipo} onValueChange={(v) => v && setTipo(v as TipoCartao)}>
          <SelectTrigger className="h-11 w-32">
            <SelectValue>{(v: string | null) => ROTULO_TIPO[(v as TipoCartao) ?? 'avista']}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="credito">Crédito</SelectItem>
            <SelectItem value="avista">À vista</SelectItem>
          </SelectContent>
        </Select>
        {credito && (
          <>
            <Input
              inputMode="numeric"
              placeholder="Fecha"
              title="Dia que a fatura fecha"
              value={fechamento}
              onChange={(e) => setFechamento(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="h-11 w-16 text-center"
            />
            <Input
              inputMode="numeric"
              placeholder="Vence"
              title="Dia que a fatura vence"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="h-11 w-16 text-center"
            />
          </>
        )}
        <Button onClick={salvar} disabled={!valido || salvando} size="icon" aria-label={rotuloSalvar} className="h-11! w-11!">
          <IconCheck />
        </Button>
        {onCancelar && (
          <Button variant="ghost" size="icon" onClick={onCancelar} aria-label="Cancelar" className="h-11! w-11!">
            <IconX />
          </Button>
        )}
      </div>
    </div>
  )
}

// Cadastros: formas de pagamento (com o ciclo da fatura de cada cartao de
// credito) e categorias de gasto. Tudo que a pessoa usa no dia a dia sai
// daqui.
export default function CadastrosPage() {
  const [cartoes, setCartoes] = useState<FinanceiroCartao[]>([])
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([])
  const [editandoCartao, setEditandoCartao] = useState<string | null>(null)
  const [editandoCategoria, setEditandoCategoria] = useState<string | null>(null)
  const [nomeCategoria, setNomeCategoria] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('')

  async function carregar() {
    const [cs, cats] = await Promise.all([getCartoes(), getCategorias()])
    setCartoes(cs)
    setCategorias(cats)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function excluirCartao(c: FinanceiroCartao) {
    if (!window.confirm(`Excluir "${c.nome}"? Os lançamentos feitos nele ficam sem forma de pagamento.`)) return
    await deleteCartao(c.id)
    carregar()
  }

  async function excluirCategoria(c: FinanceiroCategoria) {
    if (!window.confirm(`Excluir a categoria "${c.nome}"? Os lançamentos continuam com o nome antigo.`)) return
    await deleteCategoria(c.id)
    carregar()
  }

  async function adicionarCategoria() {
    if (!novaCategoria.trim()) return
    await createCategoria(novaCategoria)
    setNovaCategoria('')
    carregar()
  }

  async function salvarNomeCategoria(c: FinanceiroCategoria) {
    if (nomeCategoria.trim() && nomeCategoria.trim() !== c.nome) await renameCategoria(c.id, c.nome, nomeCategoria)
    setEditandoCategoria(null)
    carregar()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium">Cadastros</h1>
        <p className="brand-subtitle text-sm">Formas de pagamento e categorias</p>
        <span className="brand-accent-bar mt-3" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formas de pagamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs font-light text-muted-foreground">
            Cartão de crédito precisa do dia que a fatura fecha e do dia que ela vence: a compra feita antes do
            fechamento entra na fatura do mês, e no dia do fechamento ou depois já vai pra fatura seguinte.
          </p>
          <FormCartao
            rotuloSalvar="Adicionar"
            onSalvar={async (dados) => {
              await createCartao(dados)
              carregar()
            }}
          />
          <div className="flex flex-col">
            {cartoes.map((c, i) => (
              <div key={c.id} className={cn('py-3', i > 0 && 'border-t border-white/5')}>
                {editandoCartao === c.id ? (
                  <FormCartao
                    inicial={c}
                    rotuloSalvar="Salvar"
                    onCancelar={() => setEditandoCartao(null)}
                    onSalvar={async (dados) => {
                      await updateCartao(c.id, dados)
                      setEditandoCartao(null)
                      carregar()
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{c.nome}</span>
                      <span className="text-xs font-thin text-muted-foreground/60">{descreverCartao(c)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditandoCartao(c.id)} aria-label="Editar">
                        <IconPencil />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => excluirCartao(c)} aria-label="Excluir">
                        <IconTrash />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorias</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nova categoria"
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarCategoria()}
              className="h-11 flex-1"
            />
            <Button onClick={adicionarCategoria} disabled={!novaCategoria.trim()} size="icon" aria-label="Adicionar" className="h-11! w-11!">
              <IconCheck />
            </Button>
          </div>
          <div className="flex flex-col">
            {categorias.map((c, i) => (
              <div key={c.id} className={cn('flex items-center justify-between gap-3 py-2 text-sm', i > 0 && 'border-t border-white/5')}>
                {editandoCategoria === c.id ? (
                  <>
                    <Input
                      value={nomeCategoria}
                      onChange={(e) => setNomeCategoria(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && salvarNomeCategoria(c)}
                      autoFocus
                      className="h-9 flex-1"
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => salvarNomeCategoria(c)} aria-label="Salvar">
                        <IconCheck />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditandoCategoria(null)} aria-label="Cancelar">
                        <IconX />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="truncate">{c.nome}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditandoCategoria(c.id)
                          setNomeCategoria(c.nome)
                        }}
                        aria-label="Renomear"
                      >
                        <IconPencil />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => excluirCategoria(c)} aria-label="Excluir">
                        <IconTrash />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useSyncExternalStore } from 'react'

// Modo de exemplo (Recebíveis e Minhas Finanças), pra mostrar o sistema
// sem expor os numeros reais: clicando no valor do 2º card (Recebido em
// Recebíveis, Saídas em Minhas Finanças) cards, lista e graficos trocam
// por dados de demonstracao (ver financas-exemplo.ts).
// Clicando de novo, volta aos dados reais. Sem nenhuma dica na tela.
//
// Mesmo store do use-ocultar-valores.ts: salvo no navegador e valendo pras
// duas telas ao mesmo tempo.
const CHAVE = 'sg-modo-exemplo'

const ouvintes = new Set<() => void>()
let atual: boolean | null = null

function lerSalvo(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

function obterSnapshot(): boolean {
  if (atual === null) atual = typeof window === 'undefined' ? false : lerSalvo()
  return atual
}

function obterSnapshotServidor(): boolean {
  return false
}

function inscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function definirModoExemplo(ligado: boolean): void {
  atual = ligado
  try {
    window.localStorage.setItem(CHAVE, ligado ? '1' : '0')
  } catch {
    // sem localStorage: o modo vale so ate recarregar a pagina
  }
  ouvintes.forEach((ouvinte) => ouvinte())
}

export function useModoExemplo(): boolean {
  return useSyncExternalStore(inscrever, obterSnapshot, obterSnapshotServidor)
}

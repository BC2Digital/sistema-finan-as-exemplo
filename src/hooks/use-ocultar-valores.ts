'use client'

import { useSyncExternalStore } from 'react'

// Modo "ocultar valores": clicando no valor do 4º card (Faturamento em
// Recebíveis, A receber em Minhas Finanças) todos os valores da tela viram
// asteriscos. Clicando de novo, volta a mostrar. A escolha fica salva no
// navegador e vale pras duas telas. localStorage sempre em try/catch (em
// aba anonima pode falhar, e ai o modo so nao fica salvo).
const CHAVE = 'sg-ocultar-valores'

export const MASCARA_VALOR = 'R$ ****'
export const MASCARA_PERCENTUAL = '**%'

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

export function definirOcultarValores(ocultar: boolean): void {
  atual = ocultar
  try {
    window.localStorage.setItem(CHAVE, ocultar ? '1' : '0')
  } catch {
    // sem localStorage: o modo vale so ate recarregar a pagina
  }
  ouvintes.forEach((ouvinte) => ouvinte())
}

export function useOcultarValores(): boolean {
  return useSyncExternalStore(inscrever, obterSnapshot, obterSnapshotServidor)
}

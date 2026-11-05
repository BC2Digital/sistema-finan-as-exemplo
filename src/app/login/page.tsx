'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)
    setMensagem('')
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) setMensagem('E-mail ou senha inválidos.')
      else router.replace('/financas')
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: senha })
      if (error) setMensagem(error.message)
      else if (data.session) router.replace('/financas')
      else setMensagem('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.')
    }
    setCarregando(false)
  }

  return (
    <div className="brand-page-glow flex min-h-screen items-center justify-center p-4">
      <form onSubmit={enviar} className="brand-glass flex w-full max-w-sm flex-col gap-4 rounded-xl p-6">
        <div>
          <h1 className="text-2xl font-medium">Sistema de Finanças</h1>
          <p className="brand-subtitle text-sm">{modo === 'entrar' ? 'Entre na sua conta' : 'Crie sua conta'}</p>
          <span className="brand-accent-bar mt-3" />
        </div>
        <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
        <Input
          type="password"
          placeholder="Senha (mínimo 6 caracteres)"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={6}
          className="h-11"
        />
        {mensagem && <p className="text-sm text-muted-foreground">{mensagem}</p>}
        <Button type="submit" disabled={carregando} className="h-11">
          {carregando ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </Button>
        <button
          type="button"
          onClick={() => {
            setModo(modo === 'entrar' ? 'criar' : 'entrar')
            setMensagem('')
          }}
          className="cursor-pointer text-sm text-muted-foreground transition hover:text-foreground"
        >
          {modo === 'entrar' ? 'Ainda não tem conta? Criar conta' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { garantirCadastrosIniciais } from '@/lib/financas-queries'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/financas', rotulo: 'Minhas Finanças' },
  { href: '/recebiveis', rotulo: 'Recebíveis' },
  { href: '/cadastros', rotulo: 'Cadastros' },
]

// Area logada: sem sessao vai pro /login. Na primeira entrada cria os
// cadastros iniciais (forma de pagamento "À vista" e categorias padrao).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    let ativo = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      await garantirCadastrosIniciais()
      if (ativo) setPronto(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!session) router.replace('/login')
    })
    return () => {
      ativo = false
      data.subscription.unsubscribe()
    }
  }, [router])

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!pronto) return <div className="min-h-screen" />

  return (
    <div className="brand-page-glow min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center gap-0.5 overflow-x-auto px-3 py-2 sm:gap-1 sm:px-4">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'shrink-0 rounded-lg border border-transparent px-2.5 py-2 text-sm sm:px-3 text-muted-foreground transition hover:text-foreground',
                pathname.startsWith(link.href) && 'brand-solo-active-glass text-foreground'
              )}
            >
              {link.rotulo}
            </Link>
          ))}
          <button
            type="button"
            onClick={sair}
            className="ml-auto shrink-0 cursor-pointer rounded-lg px-2.5 py-2 sm:px-3 text-sm text-muted-foreground transition hover:text-foreground"
          >
            Sair
          </button>
        </nav>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">{children}</main>
    </div>
  )
}

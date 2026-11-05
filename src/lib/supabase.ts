import { createClient } from '@supabase/supabase-js'

// Cliente unico do navegador. As chaves vem do .env.local (ver
// .env.example). O acesso aos dados e protegido por RLS: cada usuario
// logado so le e grava as proprias linhas (ver supabase/schema.sql).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'chave-nao-configurada',
)

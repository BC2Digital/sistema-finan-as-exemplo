-- Sistema de Finanças: estrutura do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase.
-- Cada usuario so enxerga os proprios dados (RLS por user_id).

create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  -- 'avista' (pix, debito, dinheiro) ou 'credito' (cartao com fatura)
  tipo text not null default 'avista' check (tipo in ('avista', 'credito')),
  -- so cartao de credito: dia que a fatura fecha e dia que ela vence
  dia_fechamento int check (dia_fechamento between 1 and 31),
  dia_vencimento int check (dia_vencimento between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 'recebiveis' (o que voce recebe) ou 'pessoal' (Minhas Finanças)
  area text not null check (area in ('recebiveis', 'pessoal')),
  tipo text not null check (tipo in ('entrada', 'saida')),
  -- Recebíveis: descricao = cliente, categoria = descricao do servico.
  -- Minhas Finanças: descricao = descricao do gasto, categoria = categoria.
  descricao text not null default '',
  categoria text not null default '',
  valor numeric(12, 2) not null check (valor >= 0),
  data date not null,
  cartao_id uuid references public.cartoes (id) on delete set null,
  -- permuta (troca, sem dinheiro de verdade): conta no faturamento, mas
  -- nao entra como dinheiro em Minhas Finanças
  permuta boolean not null default false,
  parcela_grupo_id uuid,
  parcela_numero int,
  parcela_total int,
  parcela_indefinida boolean not null default false,
  -- pagamento programado (aparece no grupo "Este mês")
  programado boolean not null default false,
  -- marcado como pago (so visual)
  pago_em date,
  created_at timestamptz not null default now()
);

create index if not exists lancamentos_user_data_idx on public.lancamentos (user_id, data);
create index if not exists lancamentos_grupo_idx on public.lancamentos (parcela_grupo_id);

create table if not exists public.faturas_pagamentos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cartao_id uuid not null references public.cartoes (id) on delete cascade,
  vencimento date not null,
  pago_em date not null,
  primary key (cartao_id, vencimento)
);

alter table public.cartoes enable row level security;
alter table public.categorias enable row level security;
alter table public.lancamentos enable row level security;
alter table public.faturas_pagamentos enable row level security;

drop policy if exists "dono" on public.cartoes;
create policy "dono" on public.cartoes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "dono" on public.categorias;
create policy "dono" on public.categorias for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "dono" on public.lancamentos;
create policy "dono" on public.lancamentos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "dono" on public.faturas_pagamentos;
create policy "dono" on public.faturas_pagamentos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

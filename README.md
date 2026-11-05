# Sistema de Finanças

Controle de **Recebíveis** (o que você fatura e tem pra receber) e de **Minhas Finanças** (gastos pessoais, cartões e saldo) num lugar só. Cada pessoa cria a própria conta e cadastra as próprias formas de pagamento e categorias.

Feito com Next.js, Tailwind e Supabase.

## Como funciona

**Recebíveis**
- Lance cada entrada com descrição, cliente, valor e data.
- Parcelado: informe o número de parcelas no campo `Nº`. Recorrente (todo mês, sem fim): digite `x`.
- **Permuta** (troca sem dinheiro): conta no faturamento, mas não entra como dinheiro em Minhas Finanças.
- Cards: Entradas do mês, Recebido (sem permuta), A receber (mês seguinte) e Faturamento do ano, com gráfico mês a mês.

**Minhas Finanças**
- Tudo que entra em Recebíveis (menos permuta) já entra aqui como dinheiro.
- **Saldo** acumulado mês a mês. Clique no valor do Saldo para ajustar pelo saldo real da conta.
- **Cartão de crédito** com fatura calculada em tempo real: a compra feita antes do dia de fechamento entra na fatura do mês, e no dia do fechamento ou depois vai para a fatura seguinte. A fatura desconta do saldo no mês do vencimento.
- **Pix programado**: pagamentos fixos ou agendados vão para o grupo "Este mês".
- A lista mostra os gastos por dia e, no fim, **Este mês**: faturas e pagamentos programados por data de pagamento. A fatura abre as compras dela, e o ícone à esquerda marca o item como pago.
- Filtros por forma de pagamento e categoria. Gráficos de pizza (%) e de barras (valor) por categoria.
- Clicar no valor do 4º card esconde todos os valores da tela (clique de novo para mostrar).

**Cadastros**
- Formas de pagamento: à vista (pix, débito, dinheiro) ou cartão de crédito com dia de fechamento e de vencimento.
- Categorias de gasto.
- Na primeira entrada o sistema já cria "À vista" e algumas categorias padrão, que você pode editar ou apagar.

## Instalação

1. Crie um projeto grátis no [Supabase](https://supabase.com).
2. No Supabase, abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e rode.
3. Em **Authentication > Providers**, deixe o provedor **Email** ativo. Se não quiser confirmar e-mail ao criar conta, desligue "Confirm email".
4. Clone o repositório e instale:

```bash
git clone https://github.com/BC2Digital/sistema-finan-as-exemplo.git
cd sistema-finan-as-exemplo
npm install
```

5. Copie `.env.example` para `.env.local` e preencha com a URL e a chave `anon` do seu projeto (Supabase > Project Settings > API).
6. Rode:

```bash
npm run dev
```

Abra http://localhost:3000, crie sua conta e comece a lançar.

## Publicar

Na [Vercel](https://vercel.com): importe o repositório, adicione as duas variáveis do `.env.example` em Environment Variables e faça o deploy.

## Segurança

Os dados ficam no seu próprio Supabase. Todas as tabelas usam Row Level Security: cada usuário logado só lê e grava as próprias linhas.

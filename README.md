# Sistema de Finanças

Controle de **Recebíveis** (o que você fatura e tem pra receber) e de **Minhas Finanças** (gastos pessoais, cartões e saldo) num lugar só. Cada pessoa cria a própria conta e cadastra as próprias formas de pagamento e categorias.

Feito com Next.js, Tailwind e Supabase.

## Como funciona

**Recebíveis**
- Lance cada entrada com descrição, cliente, valor e data.
- Parcelado: informe o número de parcelas no campo `Nº`. Recorrente (todo mês, sem fim): digite `x`.
- **Permuta** (troca sem dinheiro): conta no faturamento, mas não entra como dinheiro em Minhas Finanças.
- Cards: Entradas do mês, Recebido (sem permuta), A receber (mês seguinte) e Faturamento do ano.
- Gráficos de faturamento mês a mês (os 12 meses, com setinhas para trocar o ano) e por ano.

**Minhas Finanças**
- Tudo que entra em Recebíveis (menos permuta) já entra aqui como dinheiro.
- **Saldo** acumulado mês a mês. Clique no valor do Saldo para ajustar pelo saldo real da conta.
- **Cartão de crédito** com fatura calculada em tempo real: a compra feita antes do dia de fechamento entra na fatura do mês, e no dia do fechamento ou depois vai para a fatura seguinte. A fatura desconta do saldo no mês do vencimento.
- **Pix programado**: pagamentos fixos ou agendados vão para o grupo "Mês". Não pedem data (entram no mês selecionado) e aceitam valor 0,00 até você saber o valor.
- A lista mostra os gastos por dia e, no fim, **Mês**: faturas e pagamentos programados, sem data. Em baixo ficam as contas fixas (faturas e recorrentes) e acima o resto, do cadastro mais novo para o mais antigo. Clicar no nome da fatura abre as compras dela, e o ícone à esquerda marca o item como pago.
- Parcelas aparecem ao lado do nome (ex: `2/12`, ou `∞` no recorrente). Digitar `1` no `Nº` registra como `1/1`. No popup de editar dá para mudar a quantidade de parcelas, e o excluir pede um segundo toque para confirmar.
- Filtros por forma de pagamento e categoria. Gráficos de pizza (%) e de barras (valor) por categoria.
- Clicar no valor do 4º card esconde todos os valores da tela (clique de novo para mostrar).
- Clicar no valor do 2º card (Recebido ou Saídas) troca a tela por números de exemplo, para mostrar o sistema sem expor seus dados. Clique de novo para voltar.

**Prioridade das contas fixas (opcional)**: para escolher a ordem das contas fixas no grupo "Mês", grave linhas na tabela `ordem_mes` (chave `cartao:<id do cartão>` ou `grupo:<parcela_grupo_id>`; ordem 1 fica no fim da lista).

**Cadastros**
- Formas de pagamento: à vista (pix, débito, dinheiro) ou cartão de crédito com dia de fechamento e de vencimento.
- Categorias de gasto.
- Na primeira entrada o sistema já cria "À vista" e algumas categorias padrão, que você pode editar ou apagar.

## Instalação

1. Crie um projeto grátis no [Supabase](https://supabase.com).
2. No Supabase, abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e rode. Se você já tinha instalado uma versão anterior, rode o arquivo de novo: ele só cria o que falta.
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

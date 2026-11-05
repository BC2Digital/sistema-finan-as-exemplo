export const MES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export const DIA_SEMANA_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate()
}

export function primeiroDiaSemanaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 1).getDay()
}

// yyyy-mm-dd no fuso local, nunca via toISOString() (que converte pra UTC
// e, a noite, ja mostra o dia seguinte no Brasil)
export function toISO(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function parseISO(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

export function hojeISO(): string {
  return toISO(new Date())
}

// soma meses mantendo o dia (31/01 + 1 mes = 28 ou 29/02)
export function somarMeses(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const alvo = new Date(ano, mes - 1 + meses, 1)
  const ultimo = diasNoMes(alvo.getFullYear(), alvo.getMonth())
  return toISO(new Date(alvo.getFullYear(), alvo.getMonth(), Math.min(dia, ultimo)))
}

/**
 * Datas como strings ISO "AAAA-MM-DD", sempre no fuso de Brasília para que
 * "hoje" no app seja o mesmo dia do relógio do curral.
 */

export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDias(iso: string, dias: number): string {
  return new Date(toUTC(iso) + dias * 86400000).toISOString().slice(0, 10);
}

export function addMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/** Dias corridos de `de` até `ate` (positivo se `ate` é depois). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((toUTC(ate) - toUTC(de)) / 86400000);
}

export function idadeMeses(nascimento: string, ref: string): number {
  return diasEntre(nascimento, ref) / 30.4375;
}

/** "2026-10" a partir de uma data ISO. */
export function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function rotuloMes(mes: string, longo = false): string {
  const [y, m] = mes.split('-').map(Number);
  return `${(longo ? MESES_LONGOS : MESES)[m - 1]}${longo ? ' de ' : '/'}${longo ? y : String(y).slice(2)}`;
}

/**
 * Ano-safra pecuário de julho a junho (o período das águas e da seca cabe
 * inteiro no mesmo ciclo). 2026-10-14 → "SAFRA 26/27".
 */
export function safraDe(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  const inicio = m >= 7 ? y : y - 1;
  return `SAFRA ${String(inicio).slice(2)}/${String(inicio + 1).slice(2)}`;
}

/** Período [início, fim] de uma safra "SAFRA 26/27". */
export function periodoSafra(safra: string): [string, string] {
  const m = safra.match(/(\d{2})\/(\d{2})/);
  const ini = m ? 2000 + Number(m[1]) : new Date().getFullYear();
  return [`${ini}-07-01`, `${ini + 1}-06-30`];
}

/** Estação no Brasil Central: águas (out–mar) ou seca (abr–set). */
export function estacao(iso: string): 'aguas' | 'seca' {
  const m = Number(iso.slice(5, 7));
  return m >= 4 && m <= 9 ? 'seca' : 'aguas';
}

export function diaDaSemana(iso: string): number {
  return new Date(toUTC(iso)).getUTCDay();
}

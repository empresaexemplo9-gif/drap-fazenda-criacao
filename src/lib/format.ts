/**
 * Helpers de formatação BR (moeda, data, número).
 */

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function brl(value: number | null | undefined): string {
  if (value == null) return '';
  return brlFormatter.format(value);
}

/** Aceita "R$ 1.234,56", "1234.56", "1.234,56" → 1234.56 */
export function parseBrlToNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** "01/07/2025" → "2025-07-01" (ISO). Retorna vazio se inválido. */
export function brDateToIso(br: string): string {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** "2025-07-01" → "01/07/2025". */
export function isoToBrDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

const numFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const num1Formatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num0Formatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const num3Formatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Número com até 2 casas, padrão BR. */
export function num(value: number | null | undefined, casas?: 0 | 1 | 3): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (casas === 0) return num0Formatter.format(value);
  if (casas === 1) return num1Formatter.format(value);
  if (casas === 3) return num3Formatter.format(value);
  return numFormatter.format(value);
}

export function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${num1Formatter.format(value)}%`;
}

/** "2026-10-14" → "14/10". */
export function isoToBrShort(iso: string): string {
  return isoToBrDate(iso).slice(0, 5);
}

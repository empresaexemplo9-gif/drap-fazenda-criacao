/**
 * Regras do rebanho: categoria por idade/sexo, unidade animal, GMD,
 * lotação de pasto, carência e conciliação de cabeças.
 */

import { diasEntre, idadeMeses, addDias } from '../datas';
import type {
  Animal, Categoria, Pesagem, Lote, Piquete, AplicacaoSanitaria, Ocorrencia, VendaAbate, Id, ISODate,
} from './types';

/** 1 UA = 450 kg de peso vivo. */
export const KG_POR_UA = 450;
/** 1 arroba de carcaça = 15 kg. */
export const KG_POR_ARROBA = 15;

/** Categoria zootécnica pela idade e sexo (touro quando macho inteiro registrado como reprodutor). */
export function categoriaDe(a: Pick<Animal, 'sexo' | 'nascimento'>, ref: ISODate, reprodutor = false): Categoria {
  const meses = idadeMeses(a.nascimento, ref);
  if (a.sexo === 'M') {
    if (reprodutor && meses >= 18) return 'touro';
    if (meses < 8) return 'bezerro';
    if (meses < 24) return 'garrote';
    return 'boi';
  }
  if (meses < 8) return 'bezerra';
  if (meses < 30) return 'novilha';
  return 'vaca';
}

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  bezerro: 'Bezerro', bezerra: 'Bezerra', garrote: 'Garrote', novilha: 'Novilha',
  boi: 'Boi', vaca: 'Vaca', touro: 'Touro',
};

/** Peso estimado por categoria quando o animal nunca foi pesado. */
const PESO_PADRAO: Record<Categoria, number> = {
  bezerro: 160, bezerra: 150, garrote: 330, novilha: 300, boi: 480, vaca: 450, touro: 750,
};

export function indexarPesagens(pesagens: Pesagem[]): Map<Id, Pesagem[]> {
  const m = new Map<Id, Pesagem[]>();
  for (const p of pesagens) {
    const arr = m.get(p.animalId);
    if (arr) arr.push(p); else m.set(p.animalId, [p]);
  }
  for (const arr of m.values()) arr.sort((a, b) => a.data.localeCompare(b.data));
  return m;
}

/** Última pesagem até a data de referência. */
export function ultimaPesagem(hist: Pesagem[] | undefined, ref?: ISODate): Pesagem | undefined {
  if (!hist || hist.length === 0) return undefined;
  if (!ref) return hist[hist.length - 1];
  for (let i = hist.length - 1; i >= 0; i--) if (hist[i].data <= ref) return hist[i];
  return undefined;
}

export function pesoAtual(a: Animal, hist: Pesagem[] | undefined, ref: ISODate): number {
  return ultimaPesagem(hist, ref)?.pesoKg ?? PESO_PADRAO[categoriaDe(a, ref)];
}

/**
 * Ganho médio diário (kg/dia) entre a primeira e a última pesagem dentro do
 * período. Retorna null com menos de duas pesagens ou intervalo < 7 dias
 * (pesagens muito próximas medem enchimento de rúmen, não ganho).
 */
export function gmd(hist: Pesagem[] | undefined, de?: ISODate, ate?: ISODate): number | null {
  if (!hist) return null;
  const dentro = hist.filter((p) => (!de || p.data >= de) && (!ate || p.data <= ate));
  if (dentro.length < 2) return null;
  const a = dentro[0];
  const b = dentro[dentro.length - 1];
  const dias = diasEntre(a.data, b.data);
  if (dias < 7) return null;
  return (b.pesoKg - a.pesoKg) / dias;
}

/** GMD médio do grupo, ponderado pelos dias de cada animal. */
export function gmdGrupo(ids: Id[], idx: Map<Id, Pesagem[]>, de?: ISODate, ate?: ISODate): number | null {
  let ganho = 0;
  let dias = 0;
  for (const id of ids) {
    const hist = idx.get(id)?.filter((p) => (!de || p.data >= de) && (!ate || p.data <= ate));
    if (!hist || hist.length < 2) continue;
    const d = diasEntre(hist[0].data, hist[hist.length - 1].data);
    if (d < 7) continue;
    ganho += hist[hist.length - 1].pesoKg - hist[0].pesoKg;
    dias += d;
  }
  return dias > 0 ? ganho / dias : null;
}

export function ativos(animais: Animal[]): Animal[] {
  return animais.filter((a) => a.status === 'ativo');
}

export function animaisDoLote(animais: Animal[], loteId: Id): Animal[] {
  return animais.filter((a) => a.status === 'ativo' && a.loteId === loteId);
}

export function uaDe(pesoKg: number): number {
  return pesoKg / KG_POR_UA;
}

export interface LotacaoPiquete {
  piquete: Piquete;
  lotes: Lote[];
  cabecas: number;
  ua: number;
  uaHa: number;
  /** Ocupação em relação à capacidade de suporte (1 = 100%). */
  ocupacao: number;
  diasNoStatus: number;
  situacao: 'ok' | 'superlotado' | 'subutilizado' | 'descanso_ok' | 'descanso_curto' | 'reforma';
}

export function lotacaoPiquetes(
  piquetes: Piquete[], lotes: Lote[], animais: Animal[], idx: Map<Id, Pesagem[]>, ref: ISODate,
): LotacaoPiquete[] {
  return piquetes.map((p) => {
    const ls = lotes.filter((l) => l.piqueteId === p.id);
    const bichos = ls.flatMap((l) => animaisDoLote(animais, l.id));
    const ua = bichos.reduce((s, a) => s + uaDe(pesoAtual(a, idx.get(a.id), ref)), 0);
    const uaHa = p.areaHa > 0 ? ua / p.areaHa : 0;
    const ocupacao = p.capacidadeUAha > 0 ? uaHa / p.capacidadeUAha : 0;
    const diasNoStatus = Math.max(0, diasEntre(p.desde, ref));
    let situacao: LotacaoPiquete['situacao'];
    if (p.status === 'reforma' || p.status === 'degradado') situacao = 'reforma';
    else if (bichos.length === 0) situacao = diasNoStatus >= p.diasDescansoAlvo ? 'descanso_ok' : 'descanso_curto';
    else if (ocupacao > 1.1) situacao = 'superlotado';
    else if (ocupacao < 0.6) situacao = 'subutilizado';
    else situacao = 'ok';
    return { piquete: p, lotes: ls, cabecas: bichos.length, ua, uaHa, ocupacao, diasNoStatus, situacao };
  });
}

// ===================== CARÊNCIA =====================

export interface CarenciaAtiva {
  animalId: Id;
  produto: string;
  aplicacao: ISODate;
  liberaCarne: ISODate;
  liberaLeite: ISODate;
  bloqueiaCarne: boolean;
  bloqueiaLeite: boolean;
}

/** Animais que não podem ir para abate ou ter leite entregue na data `ref`. */
export function carenciasAtivas(aplicacoes: AplicacaoSanitaria[], ref: ISODate): CarenciaAtiva[] {
  const porAnimal = new Map<Id, CarenciaAtiva>();
  for (const ap of aplicacoes) {
    if (ap.carenciaCarneDias <= 0 && ap.carenciaLeiteDias <= 0) continue;
    const liberaCarne = addDias(ap.data, ap.carenciaCarneDias);
    const liberaLeite = addDias(ap.data, ap.carenciaLeiteDias);
    const bloqueiaCarne = ap.data <= ref && liberaCarne > ref;
    const bloqueiaLeite = ap.data <= ref && liberaLeite > ref;
    if (!bloqueiaCarne && !bloqueiaLeite) continue;
    for (const id of ap.animalIds) {
      const atual = porAnimal.get(id);
      if (!atual || liberaCarne > atual.liberaCarne || liberaLeite > atual.liberaLeite) {
        porAnimal.set(id, {
          animalId: id, produto: ap.produto, aplicacao: ap.data,
          liberaCarne: atual && atual.liberaCarne > liberaCarne ? atual.liberaCarne : liberaCarne,
          liberaLeite: atual && atual.liberaLeite > liberaLeite ? atual.liberaLeite : liberaLeite,
          bloqueiaCarne: bloqueiaCarne || !!atual?.bloqueiaCarne,
          bloqueiaLeite: bloqueiaLeite || !!atual?.bloqueiaLeite,
        });
      }
    }
  }
  return [...porAnimal.values()];
}

// ===================== CONCILIAÇÃO DE CABEÇAS =====================

export interface ConciliacaoLote {
  lote: Lote;
  sistema: number;
  fisica: number | null;
  dataContagem?: ISODate;
  diferenca: number | null;
}

/** Cabeças no sistema x contagem física do curral, lote a lote. */
export function conciliarCabecas(lotes: Lote[], animais: Animal[]): ConciliacaoLote[] {
  return lotes.map((l) => {
    const sistema = animaisDoLote(animais, l.id).length;
    const fisica = l.contagemFisica?.cabecas ?? null;
    return {
      lote: l, sistema, fisica, dataContagem: l.contagemFisica?.data,
      diferenca: fisica == null ? null : fisica - sistema,
    };
  });
}

// ===================== INDICADORES DE PRODUTIVIDADE =====================

/**
 * Taxa de desfrute = cabeças vendidas/abatidas no período ÷ rebanho médio.
 * Rebanho médio aproximado pela média entre o início e o fim do período.
 */
export function taxaDesfrute(animais: Animal[], de: ISODate, ate: ISODate): number | null {
  const presenteEm = (ref: ISODate) => animais.filter((a) =>
    (a.dataEntrada ?? a.nascimento) <= ref && (!a.dataSaida || a.dataSaida > ref)).length;
  const medio = (presenteEm(de) + presenteEm(ate)) / 2;
  if (medio <= 0) return null;
  const saidas = animais.filter((a) => a.status === 'vendido' && a.dataSaida && a.dataSaida >= de && a.dataSaida <= ate).length;
  return (saidas / medio) * 100;
}

export function mortalidade(ocorrencias: Ocorrencia[], animais: Animal[], de: ISODate, ate: ISODate): number | null {
  const base = animais.filter((a) => (a.dataEntrada ?? a.nascimento) <= ate && (!a.dataSaida || a.dataSaida >= de)).length;
  if (base === 0) return null;
  const mortes = ocorrencias.filter((o) => o.tipo === 'morte' && o.data >= de && o.data <= ate).length;
  return (mortes / base) * 100;
}

/** Idade média ao abate (meses) das vendas para frigorífico no período. */
export function idadeMediaAbate(vendas: VendaAbate[], animais: Animal[], de: ISODate, ate: ISODate): number | null {
  const porId = new Map(animais.map((a) => [a.id, a]));
  const idades: number[] = [];
  for (const v of vendas) {
    if (v.data < de || v.data > ate) continue;
    for (const id of v.animalIds) {
      const a = porId.get(id);
      if (a) idades.push(idadeMeses(a.nascimento, v.data));
    }
  }
  return idades.length ? idades.reduce((s, x) => s + x, 0) / idades.length : null;
}

/** Rendimento de carcaça (%) de uma venda. */
export function rendimentoCarcaca(v: VendaAbate): number {
  return v.pesoVivoTotalKg > 0 ? (v.pesoCarcacaTotalKg / v.pesoVivoTotalKg) * 100 : 0;
}

export function valorVenda(v: VendaAbate): number {
  return (v.pesoCarcacaTotalKg / KG_POR_ARROBA) * v.precoArroba + v.bonificacoes - v.descontos;
}

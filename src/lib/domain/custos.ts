/**
 * Custo real de produção: quanto custou a arroba produzida e o litro de leite.
 *
 * Custos variáveis lançados com `loteId` vão direto para o lote. Custos sem
 * lote (mão de obra, combustível, energia, depreciação, reforma de pasto)
 * são rateados entre as atividades e lotes por UA·dia, que é o critério mais
 * justo quando o mesmo pasto e a mesma equipe atendem corte e leite.
 */

import { diasEntre, addDias } from '../datas';
import { realizados } from './livro-razao';
import { KG_POR_ARROBA, uaDe, pesoAtual, indexarPesagens } from './rebanho';
import type { Animal, Conta, Lancamento, Lote, Pesagem, Ordenha, Atividade, ISODate, Id } from './types';

const FASES_SEM_ARROBA = ['reprodutores', 'doadoras', 'receptoras', 'lactacao', 'seca'];

export type CriterioRateio = 'ua_dia' | 'cabecas' | 'igual';

export interface CustoLote {
  lote: Lote;
  direto: number;
  rateado: number;
  total: number;
  uaDia: number;
  cabecasMedias: number;
  /** @ de carcaça produzidas (ganho de peso vivo × rendimento ÷ 15). */
  arrobasProduzidas: number;
  custoPorArroba: number | null;
  custoCabecaMes: number | null;
}

/** Despesas realizadas do período (débito em conta 5.x). */
function despesas(ls: Lancamento[], de: ISODate, ate: ISODate): Lancamento[] {
  return realizados(ls).filter((l) => l.data >= de && l.data <= ate && l.debito.startsWith('5.'));
}

/** UA·dia de cada lote no período, amostrando semanalmente o peso e a composição atual. */
export function uaDiaPorLote(lotes: Lote[], animais: Animal[], pesagens: Pesagem[], de: ISODate, ate: ISODate): Map<Id, { uaDia: number; cabDia: number }> {
  const idx = indexarPesagens(pesagens);
  const out = new Map<Id, { uaDia: number; cabDia: number }>();
  for (const l of lotes) out.set(l.id, { uaDia: 0, cabDia: 0 });
  const total = Math.max(1, diasEntre(de, ate) + 1);
  const passo = 7;
  for (let d = 0; d < total; d += passo) {
    const ref = addDias(de, d);
    const peso = Math.min(passo, total - d);
    for (const a of animais) {
      if (!a.loteId || !out.has(a.loteId)) continue;
      const entrou = (a.dataEntrada ?? a.nascimento) <= ref;
      const saiu = a.dataSaida ? a.dataSaida <= ref : false;
      if (!entrou || saiu) continue;
      const acc = out.get(a.loteId)!;
      acc.uaDia += uaDe(pesoAtual(a, idx.get(a.id), ref)) * peso;
      acc.cabDia += peso;
    }
  }
  return out;
}

/**
 * Arrobas de carcaça produzidas no período. Como as pesagens são esparsas
 * (a cada 30–90 dias), o ganho é estimado pelo GMD de cada animal (pesagens
 * de até 120 dias antes do período) multiplicado pelos dias em que ele
 * esteve na fazenda dentro do período.
 */
export function arrobasProduzidas(animais: Animal[], pesagens: Pesagem[], de: ISODate, ate: ISODate, rendimentoPct: number): number {
  const idx = indexarPesagens(pesagens);
  const janelaIni = addDias(de, -120);
  let ganhoKg = 0;
  for (const a of animais) {
    const hist = (idx.get(a.id) ?? []).filter((p) => p.data >= janelaIni && p.data <= ate);
    if (hist.length < 2) continue;
    const dHist = diasEntre(hist[0].data, hist[hist.length - 1].data);
    if (dHist < 7) continue;
    const g = (hist[hist.length - 1].pesoKg - hist[0].pesoKg) / dHist;
    const ini = [de, a.dataEntrada ?? a.nascimento].sort()[1];
    const fim = a.dataSaida && a.dataSaida < ate ? a.dataSaida : ate;
    const dias = Math.max(0, diasEntre(ini, fim));
    ganhoKg += g * dias;
  }
  return Math.max(0, (ganhoKg * (rendimentoPct / 100)) / KG_POR_ARROBA);
}

export function custoPorLote(
  ls: Lancamento[], contas: Conta[], lotes: Lote[], animais: Animal[], pesagens: Pesagem[],
  de: ISODate, ate: ISODate, rendimentoPct: number, criterio: CriterioRateio = 'ua_dia',
): { lotes: CustoLote[]; naoRateado: number; totalDespesas: number } {
  void contas;
  const desp = despesas(ls, de, ate);
  const base = uaDiaPorLote(lotes, animais, pesagens, de, ate);
  const diretoPorLote = new Map<Id, number>();
  let comum = 0;
  const comumPorAtividade = new Map<Atividade, number>();
  for (const l of desp) {
    if (l.loteId && base.has(l.loteId)) {
      diretoPorLote.set(l.loteId, (diretoPorLote.get(l.loteId) ?? 0) + l.valor);
    } else if (l.atividade !== 'geral') {
      comumPorAtividade.set(l.atividade, (comumPorAtividade.get(l.atividade) ?? 0) + l.valor);
    } else {
      comum += l.valor;
    }
  }

  const pesoDe = (id: Id) => {
    const b = base.get(id)!;
    if (criterio === 'ua_dia') return b.uaDia;
    if (criterio === 'cabecas') return b.cabDia;
    return b.cabDia > 0 ? 1 : 0;
  };
  const totalPeso = lotes.reduce((s, l) => s + pesoDe(l.id), 0);
  const pesoAtiv = (a: Atividade) => lotes.filter((l) => l.atividade === a).reduce((s, l) => s + pesoDe(l.id), 0);

  let naoRateado = 0;
  if (totalPeso === 0) naoRateado += comum;
  for (const [a, v] of comumPorAtividade) if (pesoAtiv(a) === 0) naoRateado += v;

  const dias = Math.max(1, diasEntre(de, ate) + 1);
  const resultado = lotes.map((lote) => {
    const p = pesoDe(lote.id);
    const direto = diretoPorLote.get(lote.id) ?? 0;
    const daAtividade = comumPorAtividade.get(lote.atividade) ?? 0;
    const pa = pesoAtiv(lote.atividade);
    const rateado = (totalPeso > 0 ? (comum * p) / totalPeso : 0) + (pa > 0 ? (daAtividade * p) / pa : 0);
    const total = direto + rateado;
    const doLote = animais.filter((a) => a.loteId === lote.id);
    const arrobas = lote.atividade === 'leite' ? 0 : arrobasProduzidas(doLote, pesagens, de, ate, rendimentoPct);
    const b = base.get(lote.id)!;
    const cabecasMedias = b.cabDia / dias;
    return {
      lote, direto, rateado, total, uaDia: b.uaDia, cabecasMedias,
      arrobasProduzidas: arrobas,
      // Reprodutores e doadoras não existem para ganhar peso: custo por @ não se aplica.
      custoPorArroba: arrobas >= 1 && !FASES_SEM_ARROBA.includes(lote.fase) ? total / arrobas : null,
      custoCabecaMes: cabecasMedias > 0 ? (total / cabecasMedias) / (dias / 30.4375) : null,
    };
  });
  return { lotes: resultado, naoRateado, totalDespesas: desp.reduce((s, l) => s + l.valor, 0) };
}

export interface ResumoAtividade {
  atividade: Atividade;
  custo: number;
  arrobas: number;
  custoArroba: number | null;
  litros: number;
  custoLitro: number | null;
}

/** Custo da @ (corte) e do litro (leite) consolidados no período. */
export function resumoCustos(lotesCusto: CustoLote[], ordenhas: Ordenha[], de: ISODate, ate: ISODate): ResumoAtividade[] {
  const atividades: Atividade[] = ['corte', 'leite', 'genetica'];
  const litros = ordenhas.filter((o) => o.data >= de && o.data <= ate && !o.descartado).reduce((s, o) => s + o.litros, 0);
  return atividades.map((atividade) => {
    const ls = lotesCusto.filter((c) => c.lote.atividade === atividade);
    const custo = ls.reduce((s, c) => s + c.total, 0);
    const arrobas = ls.reduce((s, c) => s + c.arrobasProduzidas, 0);
    const l = atividade === 'leite' ? litros : 0;
    return {
      atividade, custo, arrobas,
      custoArroba: arrobas > 0 ? custo / arrobas : null,
      litros: l,
      custoLitro: l > 0 ? custo / l : null,
    };
  });
}

/** Lucro por hectare no período. */
export function lucroPorHectare(resultado: number, areaHa: number): number | null {
  return areaHa > 0 ? resultado / areaHa : null;
}

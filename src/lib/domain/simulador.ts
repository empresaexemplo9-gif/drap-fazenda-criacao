/**
 * Simuladores de decisão: vender agora ou segurar, confinar ou ficar no pasto,
 * e quanto pagar na reposição.
 */

import { KG_POR_ARROBA } from './rebanho';

export interface EntradaVenderSegurar {
  cabecas: number;
  pesoAtualKg: number;
  gmdKg: number;
  dias: number;
  precoArrobaHoje: number;
  precoArrobaFuturo: number;
  custoDiarioCabeca: number;
  rendimentoHojePct: number;
  /** Rendimento sobe com o acabamento; se vazio usa o de hoje. */
  rendimentoFuturoPct?: number;
  /** Funrural e frete sobre a venda (%). */
  descontosVendaPct: number;
}

export interface ResultadoVenderSegurar {
  arrobasHoje: number;
  arrobasFuturo: number;
  receitaHoje: number;
  receitaFutura: number;
  custoAdicional: number;
  ganhoLiquido: number;
  /** Preço futuro da @ que empata as duas opções. */
  precoEquilibrio: number;
  /** Custo da @ produzida a mais no período. */
  custoArrobaAdicional: number | null;
  recomendacao: 'segurar' | 'vender';
  pesoFinalKg: number;
}

export function venderOuSegurar(e: EntradaVenderSegurar): ResultadoVenderSegurar {
  const rendF = e.rendimentoFuturoPct ?? e.rendimentoHojePct;
  const pesoFinalKg = e.pesoAtualKg + e.gmdKg * e.dias;
  const arrobasHoje = (e.pesoAtualKg * e.rendimentoHojePct) / 100 / KG_POR_ARROBA;
  const arrobasFuturo = (pesoFinalKg * rendF) / 100 / KG_POR_ARROBA;
  const liq = 1 - e.descontosVendaPct / 100;
  const receitaHoje = arrobasHoje * e.precoArrobaHoje * liq * e.cabecas;
  const receitaFutura = arrobasFuturo * e.precoArrobaFuturo * liq * e.cabecas;
  const custoAdicional = e.custoDiarioCabeca * e.dias * e.cabecas;
  const ganhoLiquido = receitaFutura - receitaHoje - custoAdicional;
  const precoEquilibrio = arrobasFuturo > 0 && liq > 0
    ? (receitaHoje + custoAdicional) / (arrobasFuturo * liq * e.cabecas)
    : 0;
  const arrobasAdic = (arrobasFuturo - arrobasHoje) * e.cabecas;
  return {
    arrobasHoje, arrobasFuturo, receitaHoje, receitaFutura, custoAdicional, ganhoLiquido,
    precoEquilibrio, custoArrobaAdicional: arrobasAdic > 0 ? custoAdicional / arrobasAdic : null,
    recomendacao: ganhoLiquido > 0 ? 'segurar' : 'vender', pesoFinalKg,
  };
}

export interface CenarioTerminacao {
  nome: string;
  gmdKg: number;
  custoDiarioCabeca: number;
  rendimentoPct: number;
}

export interface ResultadoTerminacao {
  cenario: CenarioTerminacao;
  dias: number;
  arrobasProduzidas: number;
  custoTotal: number;
  custoArroba: number;
  receita: number;
  margem: number;
  margemDia: number;
}

/**
 * Compara terminar em pasto (suplementado) ou em confinamento até um peso
 * de abate. Mais rápido nem sempre é mais barato: o simulador mostra custo
 * da @ produzida e margem por dia de ocupação.
 */
export function compararTerminacao(
  pesoEntradaKg: number, pesoAbateKg: number, precoArroba: number, rendimentoEntradaPct: number, cenarios: CenarioTerminacao[],
): ResultadoTerminacao[] {
  return cenarios.map((c) => {
    const dias = c.gmdKg > 0 ? Math.ceil((pesoAbateKg - pesoEntradaKg) / c.gmdKg) : Infinity;
    const arrobasEntrada = (pesoEntradaKg * rendimentoEntradaPct) / 100 / KG_POR_ARROBA;
    const arrobasSaida = (pesoAbateKg * c.rendimentoPct) / 100 / KG_POR_ARROBA;
    const arrobasProduzidas = arrobasSaida - arrobasEntrada;
    const custoTotal = c.custoDiarioCabeca * dias;
    const receita = arrobasProduzidas * precoArroba;
    const margem = receita - custoTotal;
    return {
      cenario: c, dias, arrobasProduzidas, custoTotal,
      custoArroba: arrobasProduzidas > 0 ? custoTotal / arrobasProduzidas : Infinity,
      receita, margem, margemDia: Number.isFinite(dias) && dias > 0 ? margem / dias : 0,
    };
  });
}

/**
 * Relação de troca: quantos bezerros a venda de um boi gordo compra.
 * Acima de ~2,0 a reposição está barata; abaixo de ~1,6 está cara.
 */
export function relacaoTroca(precoArrobaBoi: number, arrobasBoi: number, precoBezerro: number): number {
  return precoBezerro > 0 ? (precoArrobaBoi * arrobasBoi) / precoBezerro : 0;
}

/** Custo da dieta por kg de matéria natural. */
export function custoKgDieta(ingredientes: { pct: number; custoKg: number }[]): number {
  const somaPct = ingredientes.reduce((s, i) => s + i.pct, 0);
  if (somaPct <= 0) return 0;
  return ingredientes.reduce((s, i) => s + i.pct * i.custoKg, 0) / somaPct;
}

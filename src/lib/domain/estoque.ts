/**
 * Estoque de insumos: saldo por movimento, custo médio ponderado e
 * previsão de ruptura pelo consumo diário (evita compra em cima da hora).
 */

import { addDias } from '../datas';
import type { Insumo, MovEstoque, ISODate } from './types';

export interface SaldoInsumo {
  insumo: Insumo;
  saldo: number;
  custoMedio: number;
  valorEstoque: number;
  diasCobertura: number | null;
  ruptura: ISODate | null;
  abaixoMinimo: boolean;
}

export function saldoInsumo(insumo: Insumo, movs: MovEstoque[], ate?: ISODate): { saldo: number; custoMedio: number } {
  let saldo = 0;
  let custoMedio = insumo.custoMedio;
  const lista = movs
    .filter((m) => m.insumoId === insumo.id && (!ate || m.data <= ate))
    .sort((a, b) => a.data.localeCompare(b.data));
  for (const m of lista) {
    if (m.tipo === 'entrada') {
      const vu = m.valorUnitario ?? custoMedio;
      const novo = saldo + m.quantidade;
      custoMedio = novo > 0 ? (saldo * custoMedio + m.quantidade * vu) / novo : vu;
      saldo = novo;
    } else if (m.tipo === 'saida') {
      saldo -= m.quantidade;
    } else {
      saldo += m.quantidade; // ajuste de inventário (pode ser negativo)
    }
  }
  return { saldo, custoMedio };
}

export function previsaoRuptura(insumos: Insumo[], movs: MovEstoque[], hoje: ISODate): SaldoInsumo[] {
  return insumos.map((insumo) => {
    const { saldo, custoMedio } = saldoInsumo(insumo, movs, hoje);
    const diasCobertura = insumo.consumoDiario > 0 ? Math.max(0, saldo) / insumo.consumoDiario : null;
    return {
      insumo, saldo, custoMedio,
      valorEstoque: Math.max(0, saldo) * custoMedio,
      diasCobertura,
      ruptura: diasCobertura == null ? null : addDias(hoje, Math.floor(diasCobertura)),
      abaixoMinimo: saldo <= insumo.estoqueMinimo,
    };
  });
}

/** Consumo de sal mineral esperado (kg/dia) para um número de UA. Referência: ~80 g/UA/dia. */
export function consumoSalEsperado(ua: number, gramasPorUA = 80): number {
  return (ua * gramasPorUA) / 1000;
}

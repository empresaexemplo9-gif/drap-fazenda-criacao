/**
 * Módulo Leite: produção por vaca, curva de lactação, vacas improdutivas,
 * qualidade (IN 76/77), mastite e indicadores reprodutivos.
 */

import { diasEntre, addDias } from '../datas';
import type { Animal, AnaliseLeite, CasoMastite, EventoReprodutivo, Ordenha, TabelaLaticinio, ISODate, Id } from './types';

/** Limites da IN 76/2018 para leite cru refrigerado (média geométrica trimestral). */
export const LIMITE_CBT = 300; // mil UFC/mL
export const LIMITE_CCS = 500; // mil células/mL

export function ultimoParto(reproducao: EventoReprodutivo[], animalId: Id, ate: ISODate): ISODate | null {
  return reproducao
    .filter((r) => r.animalId === animalId && r.tipo === 'parto' && r.data <= ate)
    .map((r) => r.data).sort().pop() ?? null;
}

export function secaDesde(reproducao: EventoReprodutivo[], animalId: Id, ate: ISODate): ISODate | null {
  const parto = ultimoParto(reproducao, animalId, ate);
  return reproducao
    .filter((r) => r.animalId === animalId && r.tipo === 'secagem' && r.data <= ate && (!parto || r.data > parto))
    .map((r) => r.data).sort().pop() ?? null;
}

/** Dias em lactação (DEL) na data, ou null se seca / sem parto. */
export function del(reproducao: EventoReprodutivo[], animalId: Id, ref: ISODate): number | null {
  const parto = ultimoParto(reproducao, animalId, ref);
  if (!parto || secaDesde(reproducao, animalId, ref)) return null;
  return diasEntre(parto, ref);
}

export interface ProducaoVaca {
  animal: Animal;
  del: number | null;
  mediaDia: number;
  ultimos7: number;
  totalPeriodo: number;
  descartado: number;
  improdutiva: boolean;
  motivo?: string;
}

/** Produção média por vaca no período e sinalização de vacas improdutivas. */
export function producaoPorVaca(
  vacas: Animal[], ordenhas: Ordenha[], reproducao: EventoReprodutivo[], de: ISODate, ate: ISODate, limiteLitrosDia = 8,
): ProducaoVaca[] {
  const dias = Math.max(1, diasEntre(de, ate) + 1);
  const ini7 = addDias(ate, -6);
  return vacas.map((animal) => {
    const os = ordenhas.filter((o) => o.animalId === animal.id && o.data >= de && o.data <= ate);
    const validos = os.filter((o) => !o.descartado);
    const totalPeriodo = validos.reduce((s, o) => s + o.litros, 0);
    const descartado = os.filter((o) => o.descartado).reduce((s, o) => s + o.litros, 0);
    const diasComOrdenha = new Set(os.map((o) => o.data)).size || dias;
    const ult7 = os.filter((o) => o.data >= ini7).reduce((s, o) => s + o.litros, 0) / 7;
    const d = del(reproducao, animal.id, ate);
    const mediaDia = (totalPeriodo + descartado) / diasComOrdenha;
    let improdutiva = false;
    let motivo: string | undefined;
    const prenhe = reproducao.some((r) => r.animalId === animal.id && r.tipo === 'diagnostico' && r.resultado === 'prenhe'
      && r.data > (ultimoParto(reproducao, animal.id, ate) ?? '0000'));
    if (d != null && d > 305 && mediaDia < limiteLitrosDia) { improdutiva = true; motivo = `${d} DEL e ${mediaDia.toFixed(1)} L/dia`; }
    else if (d != null && d > 150 && !prenhe) { improdutiva = true; motivo = `Vazia com ${d} DEL`; }
    else if (d != null && mediaDia > 0 && mediaDia < limiteLitrosDia / 2) { improdutiva = true; motivo = `Só ${mediaDia.toFixed(1)} L/dia`; }
    return { animal, del: d, mediaDia, ultimos7: ult7, totalPeriodo, descartado, improdutiva, motivo };
  });
}

/** Curva de lactação: litros/dia médios por faixa de DEL (30 dias). */
export function curvaLactacao(ordenhas: Ordenha[], reproducao: EventoReprodutivo[]): { faixa: number; litros: number; n: number }[] {
  const porDia = new Map<string, number>();
  for (const o of ordenhas) porDia.set(`${o.animalId}|${o.data}`, (porDia.get(`${o.animalId}|${o.data}`) ?? 0) + o.litros);
  const faixas = new Map<number, { soma: number; n: number }>();
  for (const [k, litros] of porDia) {
    const [animalId, data] = k.split('|');
    const parto = ultimoParto(reproducao, animalId, data);
    if (!parto) continue;
    const d = diasEntre(parto, data);
    if (d < 0 || d > 450) continue;
    const f = Math.floor(d / 30) * 30;
    const acc = faixas.get(f) ?? { soma: 0, n: 0 };
    acc.soma += litros; acc.n += 1;
    faixas.set(f, acc);
  }
  return [...faixas].sort((a, b) => a[0] - b[0]).map(([faixa, v]) => ({ faixa, litros: v.soma / v.n, n: v.n }));
}

export function mediaGeometrica(valores: number[]): number | null {
  const pos = valores.filter((v) => v > 0);
  if (!pos.length) return null;
  return Math.exp(pos.reduce((s, v) => s + Math.log(v), 0) / pos.length);
}

export interface SituacaoQualidade {
  ccsMg: number | null;
  cbtMg: number | null;
  ccsOk: boolean;
  cbtOk: boolean;
  gordura: number | null;
  proteina: number | null;
}

/** Média geométrica das análises do tanque nos últimos 3 meses (critério da IN 76). */
export function situacaoQualidade(analises: AnaliseLeite[], hoje: ISODate): SituacaoQualidade {
  const de = addDias(hoje, -90);
  const tanque = analises.filter((a) => !a.animalId && a.data >= de && a.data <= hoje);
  const ccsMg = mediaGeometrica(tanque.map((a) => a.ccs));
  const cbtMg = mediaGeometrica(tanque.map((a) => a.cbt));
  const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return {
    ccsMg, cbtMg,
    ccsOk: ccsMg == null || ccsMg <= LIMITE_CCS,
    cbtOk: cbtMg == null || cbtMg <= LIMITE_CBT,
    gordura: media(tanque.map((a) => a.gordura)),
    proteina: media(tanque.map((a) => a.proteina)),
  };
}

/**
 * Preço do litro pela tabela do laticínio: base + bônus de sólidos + ajuste
 * por faixa de CCS e CBT. Antecipa a penalização que o produtor só descobria
 * no fechamento.
 */
export function precoLitro(t: TabelaLaticinio, a: Pick<AnaliseLeite, 'ccs' | 'cbt' | 'gordura' | 'proteina'>): { preco: number; detalhes: { item: string; valor: number }[] } {
  const detalhes: { item: string; valor: number }[] = [{ item: 'Preço base', valor: t.precoBase }];
  const g = Math.max(0, Math.round((a.gordura - 3.0) * 10)) * t.bonusGorduraPorPonto;
  const p = Math.max(0, Math.round((a.proteina - 2.9) * 10)) * t.bonusProteinaPorPonto;
  if (g) detalhes.push({ item: `Gordura ${a.gordura.toFixed(2)}%`, valor: g });
  if (p) detalhes.push({ item: `Proteína ${a.proteina.toFixed(2)}%`, valor: p });
  const faixa = (fs: { ate: number; ajuste: number }[], v: number) => [...fs].sort((x, y) => x.ate - y.ate).find((f) => v <= f.ate)?.ajuste ?? fs[fs.length - 1]?.ajuste ?? 0;
  const ccs = faixa(t.faixasCcs, a.ccs);
  const cbt = faixa(t.faixasCbt, a.cbt);
  if (ccs) detalhes.push({ item: `CCS ${a.ccs} mil`, valor: ccs });
  if (cbt) detalhes.push({ item: `CBT ${a.cbt} mil`, valor: cbt });
  return { preco: detalhes.reduce((s, d) => s + d.valor, 0), detalhes };
}

/** Casos de mastite em carência de descarte na data. */
export function mastitesEmCarencia(casos: CasoMastite[], ref: ISODate): CasoMastite[] {
  return casos.filter((c) => c.data <= ref && addDias(c.data, c.carenciaDias) > ref);
}

/** Intervalo entre partos médio (dias) do rebanho. Meta de leite: ~ 395 dias (13 meses). */
export function intervaloEntrePartos(reproducao: EventoReprodutivo[]): { media: number | null; porVaca: Map<Id, number> } {
  const porVaca = new Map<Id, number>();
  const partos = new Map<Id, string[]>();
  for (const r of reproducao) if (r.tipo === 'parto') partos.set(r.animalId, [...(partos.get(r.animalId) ?? []), r.data]);
  const todos: number[] = [];
  for (const [id, ds] of partos) {
    const ord = ds.sort();
    if (ord.length < 2) continue;
    const ints = ord.slice(1).map((d, i) => diasEntre(ord[i], d));
    porVaca.set(id, ints[ints.length - 1]);
    todos.push(...ints);
  }
  return { media: todos.length ? todos.reduce((s, x) => s + x, 0) / todos.length : null, porVaca };
}

/** Taxa de prenhez (%) de serviços diagnosticados num período. */
export function taxaPrenhez(reproducao: EventoReprodutivo[], de: ISODate, ate: ISODate): { taxa: number | null; prenhes: number; diagnosticadas: number } {
  const dgs = reproducao.filter((r) => r.tipo === 'diagnostico' && r.data >= de && r.data <= ate);
  const prenhes = dgs.filter((r) => r.resultado === 'prenhe').length;
  return { taxa: dgs.length ? (prenhes / dgs.length) * 100 : null, prenhes, diagnosticadas: dgs.length };
}

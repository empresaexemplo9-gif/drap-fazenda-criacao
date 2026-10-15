/**
 * Módulo Genética: genealogia, consanguinidade (Wright), planejamento de
 * acasalamento por DEP, protocolos de IATF e ficha verificável para venda.
 */

import { addDias } from '../datas';
import type { Animal, AvaliacaoGenetica, EstoqueGenetico, Id, ISODate, ProvaDesempenho } from './types';

type Pedigree = Map<Id, { pai?: Id; mae?: Id; nascimento: string }>;

export function pedigree(animais: Animal[]): Pedigree {
  return new Map(animais.map((a) => [a.id, { pai: a.paiId, mae: a.maeId, nascimento: a.nascimento }]));
}

/**
 * Coeficiente de parentesco (coancestria) f(a,b) pelo método tabular
 * recursivo: expande sempre o animal mais novo, o que garante que ele não
 * é ancestral do outro. A consanguinidade de um filho de S × D é f(S,D).
 */
export function coancestria(ped: Pedigree, a: Id | undefined, b: Id | undefined, memo = new Map<string, number>()): number {
  if (!a || !b) return 0;
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const pa = ped.get(a);
  const pb = ped.get(b);
  let r: number;
  if (a === b) {
    r = 0.5 * (1 + (pa ? coancestria(ped, pa.pai, pa.mae, memo) : 0));
  } else {
    // expande o mais novo; desconhecidos no pedigree contribuem 0
    const aMaisNovo = (pa?.nascimento ?? '') >= (pb?.nascimento ?? '');
    const [x, y] = aMaisNovo ? [a, b] : [b, a];
    const px = ped.get(x);
    if (!px) r = 0;
    else r = 0.5 * (coancestria(ped, px.pai, y, memo) + coancestria(ped, px.mae, y, memo));
  }
  memo.set(key, r);
  return r;
}

export function consanguinidadeFilho(animais: Animal[], paiId: Id, maeId: Id): number {
  return coancestria(pedigree(animais), paiId, maeId);
}

export function consanguinidade(animais: Animal[], id: Id): number {
  const ped = pedigree(animais);
  const p = ped.get(id);
  return p ? coancestria(ped, p.pai, p.mae) : 0;
}

/** Limite usual de consanguinidade aceitável num acasalamento (6,25% = primos). */
export const LIMITE_F = 0.0625;

export interface OpcaoAcasalamento {
  touro: Animal | null;
  rotulo: string;
  semen?: EstoqueGenetico;
  avaliacao?: AvaliacaoGenetica;
  f: number;
  pontuacao: number;
  /** DEP da característica-meta do touro. */
  depMeta: number | null;
  bloqueado: boolean;
}

/**
 * Ordena os touros (do rebanho e do botijão) para uma vaca: maior DEP na
 * característica-meta, penalizando a consanguinidade. Acima do limite o
 * acasalamento fica bloqueado.
 */
export function opcoesAcasalamento(
  vacaId: Id, animais: Animal[], avaliacoes: AvaliacaoGenetica[], semen: EstoqueGenetico[], caracteristica: string,
): OpcaoAcasalamento[] {
  const ped = pedigree(animais);
  const ultimaAval = (id: Id) => avaliacoes.filter((a) => a.animalId === id).sort((x, y) => x.safra.localeCompare(y.safra)).pop();
  const opcoes: OpcaoAcasalamento[] = [];
  const touros = animais.filter((a) => a.sexo === 'M' && a.status === 'ativo' && avaliacoes.some((v) => v.animalId === a.id));
  const vistos = new Set<Id>();
  const add = (touro: Animal | null, rotulo: string, sem?: EstoqueGenetico) => {
    const aval = touro ? ultimaAval(touro.id) : undefined;
    const f = touro ? coancestria(ped, touro.id, vacaId) : 0;
    const depMeta = aval?.deps[caracteristica] ?? null;
    const pontuacao = (depMeta ?? 0) - f * 100;
    opcoes.push({ touro, rotulo, semen: sem, avaliacao: aval, f, pontuacao, depMeta, bloqueado: f > LIMITE_F });
  };
  for (const s of semen) {
    if (s.tipo !== 'semen' || s.doses <= 0) continue;
    const t = s.touroId ? animais.find((a) => a.id === s.touroId) ?? null : null;
    if (t) vistos.add(t.id);
    add(t, s.identificacao, s);
  }
  for (const t of touros) if (!vistos.has(t.id)) add(t, t.nome ?? t.brinco);
  return opcoes.sort((a, b) => Number(a.bloqueado) - Number(b.bloqueado) || b.pontuacao - a.pontuacao);
}

/** Protocolos de IATF mais usados (dias a partir do D0). */
export const PROTOCOLOS_IATF: Record<string, { dia: number; acao: string }[]> = {
  'P4 9 dias (Ovsynch adaptado)': [
    { dia: 0, acao: 'D0 · Implante de progesterona + benzoato de estradiol' },
    { dia: 7, acao: 'D7 · Prostaglandina (PGF2α)' },
    { dia: 9, acao: 'D9 · Retirar implante + cipionato de estradiol + eCG' },
    { dia: 11, acao: 'D11 · Inseminação (48 h após retirada)' },
  ],
  'P4 8 dias': [
    { dia: 0, acao: 'D0 · Implante de progesterona + benzoato de estradiol' },
    { dia: 8, acao: 'D8 · Retirar implante + PGF2α + cipionato de estradiol' },
    { dia: 10, acao: 'D10 · Inseminação' },
  ],
  'Ressincronização D22': [
    { dia: 0, acao: 'D0 · IATF anterior' },
    { dia: 22, acao: 'D22 · Novo implante nas não prenhes previstas' },
    { dia: 30, acao: 'D30 · Diagnóstico de gestação + retirada' },
    { dia: 32, acao: 'D32 · Segunda IATF' },
  ],
};

export function cronogramaIATF(protocolo: string, d0: ISODate): { data: ISODate; acao: string }[] {
  return (PROTOCOLOS_IATF[protocolo] ?? []).map((p) => ({ data: addDias(d0, p.dia), acao: p.acao }));
}

/** Índice de desempenho dentro do grupo de contemporâneos (100 = média do grupo). */
export function indicesContemporaneos(provas: ProvaDesempenho[], campo: 'pesoKg' | 'ceCm' | 'aolCm2' | 'egsMm'): Map<Id, number> {
  const out = new Map<Id, number>();
  const grupos = new Map<string, ProvaDesempenho[]>();
  for (const p of provas) grupos.set(p.grupo, [...(grupos.get(p.grupo) ?? []), p]);
  for (const ps of grupos.values()) {
    const vals = ps.map((p) => p[campo]).filter((v): v is number => typeof v === 'number');
    if (!vals.length) continue;
    const media = vals.reduce((s, v) => s + v, 0) / vals.length;
    for (const p of ps) {
      const v = p[campo];
      if (typeof v === 'number' && media > 0) out.set(p.animalId, (v / media) * 100);
    }
  }
  return out;
}

/** Ancestrais até a 3ª geração para a ficha genealógica. */
export function arvore(animais: Animal[], id: Id, geracoes = 3): { id?: Id; rotulo: string; nivel: number; lado: string }[] {
  const porId = new Map(animais.map((a) => [a.id, a]));
  const out: { id?: Id; rotulo: string; nivel: number; lado: string }[] = [];
  const visita = (aid: Id | undefined, externo: string | undefined, nivelAtual: number, lado: string) => {
    if (nivelAtual > geracoes) return;
    const a = aid ? porId.get(aid) : undefined;
    out.push({ id: a?.id, rotulo: a ? `${a.nome ?? a.brinco}${a.registroGenealogico ? ` · ${a.registroGenealogico}` : ''}` : externo ?? 'Desconhecido', nivel: nivelAtual, lado });
    if (a) {
      visita(a.paiId, a.paiExterno, nivelAtual + 1, `${lado}P`);
      visita(a.maeId, undefined, nivelAtual + 1, `${lado}M`);
    }
  };
  const raiz = porId.get(id);
  if (!raiz) return out;
  visita(raiz.paiId, raiz.paiExterno, 1, 'P');
  visita(raiz.maeId, undefined, 1, 'M');
  return out;
}

/**
 * Impressão digital do histórico do animal (SHA-256 do JSON canônico).
 * Impressa na ficha de venda: o comprador confere que o histórico não foi
 * alterado depois da emissão.
 */
export async function impressaoDigital(dados: unknown): Promise<string> {
  const canonico = JSON.stringify(dados, Object.keys(flatten(dados)).sort());
  const bytes = new TextEncoder().encode(canonico);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function flatten(o: unknown, acc: Record<string, true> = {}): Record<string, true> {
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) { acc[k] = true; flatten(v, acc); }
  }
  return acc;
}

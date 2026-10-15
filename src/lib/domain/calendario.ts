/**
 * Calendário da fazenda: a agenda do DRAP Fazenda (eventos com tipo,
 * concluído e atraso) mais os eventos que o sistema sugere a partir do
 * rebanho: vacinas obrigatórias, vermifugação estratégica, carência,
 * reprodução, documentos, pasto e estoque.
 *
 * As sugestões são calculadas, não gravadas: o usuário "agenda" uma
 * sugestão e ela vira Evento com `regra` (chave anti-duplicação).
 */

import { addDias, diasEntre, idadeMeses } from '../datas';
import { carenciasAtivas } from './rebanho';
import { previsaoRuptura } from './estoque';
import type {
  Estado, Evento, TipoEvento, ISODate, Id,
} from './types';

export interface Sugestao {
  regra: string;
  titulo: string;
  data: ISODate;
  tipo: TipoEvento;
  detalhe: string;
  animalIds?: Id[];
  loteId?: Id;
  prioridade: 'alta' | 'media' | 'baixa';
  /** Prazo legal/obrigatório (brucelose, GTA, ITR…). */
  obrigatorio?: boolean;
}

/** Duração média da gestação bovina (dias). */
export const GESTACAO_DIAS = 285;

function chaveAno(ref: ISODate): string { return ref.slice(0, 4); }

export function sugestoes(e: Estado, hoje: ISODate, horizonteDias = 60): Sugestao[] {
  const out: Sugestao[] = [];
  const limite = addDias(hoje, horizonteDias);
  const ativos = e.animais.filter((a) => a.status === 'ativo');
  const ano = chaveAno(hoje);

  // ---- Brucelose: fêmeas de 3 a 8 meses (B19 dose única, obrigatória — PNCEBT)
  const vacinadasBruc = new Set(
    e.sanidade.filter((s) => s.tipo === 'vacina' && /brucel|b19|rb51/i.test(s.produto)).flatMap((s) => s.animalIds),
  );
  const brucPendentes = ativos.filter((a) => {
    if (a.sexo !== 'F' || vacinadasBruc.has(a.id)) return false;
    const m = idadeMeses(a.nascimento, hoje);
    return m >= 2.5 && m <= 8;
  });
  if (brucPendentes.length) {
    const prazo = brucPendentes.map((a) => addDias(a.nascimento, 243)).sort()[0];
    out.push({
      regra: `brucelose:${hoje.slice(0, 7)}`,
      titulo: `Vacinar ${brucPendentes.length} bezerra(s) contra brucelose (B19)`,
      data: prazo < hoje ? hoje : addDias(hoje, 7),
      tipo: 'sanitario',
      detalhe: `Obrigatória entre 3 e 8 meses (PNCEBT). Prazo mais curto: ${prazo.split('-').reverse().join('/')}. Exige veterinário cadastrado e atestado para o órgão estadual.`,
      animalIds: brucPendentes.map((a) => a.id),
      prioridade: 'alta', obrigatorio: true,
    });
  }

  // ---- Aftosa (só onde o estado ainda exige)
  if (e.fazenda.vacinaAftosa) {
    for (const mes of ['05', '11']) {
      const d = `${ano}-${mes}-01`;
      if (d >= hoje && d <= limite) out.push({
        regra: `aftosa:${ano}-${mes}`, titulo: 'Campanha de vacinação contra febre aftosa', data: d, tipo: 'sanitario',
        detalhe: 'Conferir calendário do órgão de defesa estadual e declarar a vacinação no prazo.',
        prioridade: 'alta', obrigatorio: true,
      });
    }
  }

  // ---- Vermifugação estratégica 5-7-9 (maio, julho, setembro — seca)
  for (const mes of ['05', '07', '09']) {
    const d = `${ano}-${mes}-10`;
    if (d >= hoje && d <= limite) out.push({
      regra: `vermifugo:${ano}-${mes}`, titulo: 'Vermifugação estratégica (esquema 5-7-9)', data: d, tipo: 'sanitario',
      detalhe: 'Animais até 24 meses. Alternar princípio ativo e registrar a partida do produto.',
      prioridade: 'media',
    });
  }

  // ---- Raiva (anual onde é endêmica) e clostridioses (reforço anual)
  const ultimaVacina = (re: RegExp) => e.sanidade.filter((s) => s.tipo === 'vacina' && re.test(s.produto)).map((s) => s.data).sort().pop();
  const anuais: [string, RegExp, boolean][] = [
    ['Raiva', /raiva/i, e.fazenda.raivaEndemica],
    ['Clostridioses (polivalente)', /clostr|polival|carbún/i, true],
  ];
  for (const [nome, re, aplica] of anuais) {
    if (!aplica) continue;
    const ult = ultimaVacina(re);
    const prox = ult ? addDias(ult, 365) : hoje;
    if (prox <= limite) out.push({
      regra: `${nome.toLowerCase()}:${prox.slice(0, 7)}`, titulo: `Reforço anual: vacina ${nome}`,
      data: prox < hoje ? hoje : prox, tipo: 'sanitario',
      detalhe: ult ? `Última aplicação em ${ult.split('-').reverse().join('/')}.` : 'Nenhuma aplicação registrada.',
      prioridade: prox < hoje ? 'alta' : 'media',
    });
  }

  // ---- Fim de carência (liberação para abate / leite)
  for (const c of carenciasAtivas(e.sanidade, hoje)) {
    const a = e.animais.find((x) => x.id === c.animalId);
    if (!a) continue;
    const data = c.bloqueiaCarne ? c.liberaCarne : c.liberaLeite;
    if (data > limite) continue;
    out.push({
      regra: `carencia:${c.animalId}:${data}`,
      titulo: `Fim da carência de ${a.brinco} (${c.produto})`, data, tipo: 'sanitario',
      detalhe: `${c.bloqueiaCarne ? 'Bloqueado para abate' : ''}${c.bloqueiaCarne && c.bloqueiaLeite ? ' e ' : ''}${c.bloqueiaLeite ? 'leite descartado' : ''} até esta data.`,
      animalIds: [c.animalId], prioridade: 'baixa',
    });
  }

  // ---- Reprodução: diagnóstico, secagem e parto previsto
  const porAnimal = new Map<Id, typeof e.reproducao>();
  for (const r of [...e.reproducao].sort((a, b) => a.data.localeCompare(b.data))) {
    const arr = porAnimal.get(r.animalId) ?? [];
    arr.push(r);
    porAnimal.set(r.animalId, arr);
  }
  for (const [animalId, evs] of porAnimal) {
    const a = e.animais.find((x) => x.id === animalId);
    if (!a || a.status !== 'ativo') continue;
    const ult = evs[evs.length - 1];
    const servico = [...evs].reverse().find((x) => ['cobertura', 'ia', 'iatf', 'te'].includes(x.tipo));
    if (['cobertura', 'ia', 'iatf', 'te'].includes(ult.tipo)) {
      const d = addDias(ult.data, 30);
      if (d <= limite) out.push({
        regra: `dg:${animalId}:${ult.data}`, titulo: `Diagnóstico de gestação de ${a.brinco}`,
        data: d < hoje ? hoje : d, tipo: 'reprodutivo',
        detalhe: `Serviço (${ult.tipo.toUpperCase()}) em ${ult.data.split('-').reverse().join('/')}. Ultrassom a partir de 30 dias.`,
        animalIds: [animalId], prioridade: 'media',
      });
    }
    if (ult.tipo === 'diagnostico' && ult.resultado === 'prenhe' && servico) {
      const parto = addDias(servico.data, GESTACAO_DIAS);
      const secagem = addDias(parto, -60);
      if (secagem >= addDias(hoje, -7) && secagem <= limite && evs.every((x) => !(x.tipo === 'secagem' && x.data >= servico.data))) out.push({
        regra: `secagem:${animalId}:${servico.data}`, titulo: `Secar ${a.brinco} (60 dias antes do parto)`, data: secagem < hoje ? hoje : secagem,
        tipo: 'reprodutivo', detalhe: `Parto previsto em ${parto.split('-').reverse().join('/')}. Usar antibiótico de secagem e respeitar carência.`,
        animalIds: [animalId], prioridade: 'media',
      });
      if (parto >= hoje && parto <= limite) out.push({
        regra: `parto:${animalId}:${servico.data}`, titulo: `Parto previsto de ${a.brinco}`, data: parto, tipo: 'reprodutivo',
        detalhe: 'Levar para o piquete maternidade 15 dias antes. Curar umbigo e garantir colostro nas primeiras 6 horas.',
        animalIds: [animalId], prioridade: 'media',
      });
    }
  }

  // ---- Documentos com vencimento
  for (const d of e.documentos) {
    if (!d.vencimento || d.status === 'cancelado') continue;
    if (d.vencimento > limite) continue;
    out.push({
      regra: `doc:${d.id}:${d.vencimento}`, titulo: `${d.tipo} ${d.numero} vence`, data: d.vencimento, tipo: 'documento',
      detalhe: d.obs ?? 'Renovar ou baixar o documento antes do vencimento.',
      prioridade: d.vencimento < hoje ? 'alta' : 'media', obrigatorio: ['GTA', 'ITR', 'CAR', 'CCIR', 'Funrural'].includes(d.tipo),
    });
  }

  // ---- Pasto: fim do período de descanso
  for (const p of e.piquetes) {
    if (p.status !== 'descanso') continue;
    const pronto = addDias(p.desde, p.diasDescansoAlvo);
    if (pronto <= limite) out.push({
      regra: `pasto:${p.id}:${pronto}`, titulo: `${p.nome} pronto para entrada`, data: pronto < hoje ? hoje : pronto, tipo: 'pastagem',
      detalhe: `${p.diasDescansoAlvo} dias de descanso (${p.forrageira}). Conferir altura de entrada antes de mover o lote.`,
      prioridade: 'baixa',
    });
  }

  // ---- Estoque: ruptura prevista
  for (const r of previsaoRuptura(e.insumos, e.movEstoque, hoje)) {
    if (!r.ruptura || r.ruptura > limite) continue;
    const comprar = addDias(r.ruptura, -10);
    out.push({
      regra: `estoque:${r.insumo.id}:${r.ruptura}`, titulo: `Comprar ${r.insumo.nome}`, data: comprar < hoje ? hoje : comprar, tipo: 'estoque',
      detalhe: `Saldo ${r.saldo.toFixed(0)} ${r.insumo.unidade}; acaba por volta de ${r.ruptura.split('-').reverse().join('/')} no consumo atual.`,
      prioridade: r.ruptura <= addDias(hoje, 10) ? 'alta' : 'media',
    });
  }

  // ---- Títulos a pagar do livro-razão
  for (const l of e.lancamentos) {
    if (!l.credito.startsWith('2.') || l.pagoEm || l.baixaDe || !l.vencimento) continue;
    if (l.vencimento > limite) continue;
    out.push({
      regra: `pagar:${l.id}`, titulo: `Pagar ${l.historico}`, data: l.vencimento, tipo: 'pagamento',
      detalhe: `${l.fornecedor ?? ''}${l.nota ? ` · NF ${l.nota}` : ''}`.trim() || 'Título do livro-razão.',
      prioridade: l.vencimento < hoje ? 'alta' : 'media',
    });
  }

  const agendadas = new Set(e.eventos.map((ev) => ev.regra).filter(Boolean));
  return out
    .filter((s) => !agendadas.has(s.regra))
    .sort((a, b) => a.data.localeCompare(b.data) || ordemPrioridade(a.prioridade) - ordemPrioridade(b.prioridade));
}

function ordemPrioridade(p: Sugestao['prioridade']): number {
  return p === 'alta' ? 0 : p === 'media' ? 1 : 2;
}

export function sugestaoParaEvento(s: Sugestao, id: Id): Evento {
  return {
    id, titulo: s.titulo, data: s.data, tipo: s.tipo, concluido: false, obs: s.detalhe,
    animalIds: s.animalIds, loteId: s.loteId, regra: s.regra,
  };
}

export interface DiaCalendario { data: ISODate; doMes: boolean; eventos: Evento[]; sugestoes: Sugestao[] }

/** Grade de um mês (semanas de domingo a sábado) com eventos e sugestões. */
export function gradeMes(mes: string, eventos: Evento[], sugs: Sugestao[]): DiaCalendario[][] {
  const primeiro = `${mes}-01`;
  const dow = new Date(`${primeiro}T12:00:00Z`).getUTCDay();
  const inicio = addDias(primeiro, -dow);
  const semanas: DiaCalendario[][] = [];
  for (let w = 0; w < 6; w++) {
    const semana: DiaCalendario[] = [];
    for (let d = 0; d < 7; d++) {
      const data = addDias(inicio, w * 7 + d);
      semana.push({
        data, doMes: data.startsWith(mes),
        eventos: eventos.filter((ev) => ev.data === data),
        sugestoes: sugs.filter((s) => s.data === data),
      });
    }
    if (w >= 4 && !semana.some((x) => x.doMes)) break;
    semanas.push(semana);
  }
  return semanas;
}

/** Eventos atrasados (não concluídos com data passada). */
export function atrasados(eventos: Evento[], hoje: ISODate): Evento[] {
  return eventos.filter((ev) => !ev.concluido && ev.data < hoje).sort((a, b) => a.data.localeCompare(b.data));
}

export function diasAte(data: ISODate, hoje: ISODate): number {
  return diasEntre(hoje, data);
}

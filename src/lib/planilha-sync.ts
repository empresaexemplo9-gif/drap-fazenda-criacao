'use client';

/**
 * Sincronização com planilha, lado do aparelho.
 *
 * Google Planilhas: o navegador chama o app da web (Apps Script) colado na
 * planilha do produtor: lê as abas, funde com o DRAP (`domain/planilha`),
 * grava no aparelho e devolve à planilha só as abas que mudaram. Se alguém
 * editou a planilha entre a leitura e a escrita, o script recusa e a fusão
 * é refeita com a versão nova.
 *
 * Excel (sem internet): baixar o .xlsx, preencher, e enviar de volta. A
 * fusão é a mesma; a base fica separada da do Google.
 */

import { useSyncExternalStore } from 'react';
import { ABAS, sincronizarPlanilha, type Celula, type Grade, type ResultadoSync } from './domain/planilha';
import { aplicarDaPlanilha, configPlanilhaPadrao, estadoAtual, novoId } from './store';
import { hojeISO } from './datas';
import type { Colecoes, ConfigPlanilha, Estado, RelatorioPlanilha } from './domain/types';

// ===================== STATUS AO VIVO (memória) =====================

export interface StatusPlanilha {
  executando: boolean;
  verificadoEm?: string;
  falha?: string;
}

let status: StatusPlanilha = { executando: false };
const ouvintes = new Set<() => void>();
function setStatus(s: Partial<StatusPlanilha>) {
  status = { ...status, ...s };
  for (const l of ouvintes) l();
}
export function useStatusPlanilha(): StatusPlanilha {
  return useSyncExternalStore((l) => { ouvintes.add(l); return () => ouvintes.delete(l); }, () => status, () => status);
}

// ===================== AUXILIARES =====================

const nomesDasAbas = (ids: string[]) => ABAS.filter((a) => ids.includes(a.id)).map((a) => a.nome);
const colecoesDasAbas = (ids: string[]) => ABAS.filter((a) => ids.includes(a.id)).map((a) => a.colecao);

/** O que mudou no DRAP desde a última sincronização (para pular quando nada mudou dos dois lados). */
let assinatura: unknown[] = [];
let ultimoDigest = '';
const assinar = (e: Estado, ids: string[]) => colecoesDasAbas(ids).map((k) => e[k]);
const mesmaAssinatura = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function relatorio(res: ResultadoSync | null, origem: RelatorioPlanilha['origem'], falha?: string): RelatorioPlanilha {
  const r = res?.resumo;
  return {
    em: new Date().toISOString(), origem,
    criadosDrap: r?.criadosDrap ?? 0, atualizadosDrap: r?.atualizadosDrap ?? 0,
    criadosPlanilha: r?.criadosPlanilha ?? 0, atualizadosPlanilha: r?.atualizadosPlanilha ?? 0,
    removidosPlanilha: r?.removidosPlanilha ?? 0, recolocados: r?.recolocados ?? 0, conflitos: r?.conflitos ?? 0,
    erros: (r?.erros ?? []).slice(0, 200), falha,
  };
}
export const houveAlgo = (r: RelatorioPlanilha) =>
  !!r.falha || r.erros.length > 0 || r.criadosDrap + r.atualizadosDrap + r.criadosPlanilha + r.atualizadosPlanilha + r.removidosPlanilha + r.recolocados + r.conflitos > 0;

function registrar(cfg: ConfigPlanilha, rel: RelatorioPlanilha): Partial<ConfigPlanilha> {
  if (!houveAlgo(rel)) return {};
  return { ultima: rel, historico: [rel, ...cfg.historico].slice(0, 12) };
}

/** Coleções que a fusão alterou, para gravar no aparelho. */
function colecoesDe(res: ResultadoSync, ids: string[]): Partial<Colecoes> {
  const out: Partial<Colecoes> = {};
  for (const k of colecoesDasAbas(ids)) (out as Record<string, unknown>)[k] = res.estado[k];
  return out;
}

// ===================== GOOGLE PLANILHAS =====================

interface RespostaScript {
  ok: boolean;
  erro?: string;
  nome?: string;
  url?: string;
  versao?: number;
  digest?: string;
  abas?: Record<string, Grade | null>;
}

const MENSAGENS: Record<string, string> = {
  senha: 'A senha do script não confere. Copie o código de novo nesta tela e publique uma nova versão.',
  acao: 'O script da planilha está desatualizado. Copie o código de novo e publique uma nova versão.',
};

export async function chamarScript(url: string, corpo: Record<string, unknown>, timeoutMs = 45000): Promise<RespostaScript> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      // text/plain evita a pré-checagem de CORS, que o Apps Script não responde
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const texto = await resp.text();
    let json: RespostaScript;
    try {
      json = JSON.parse(texto) as RespostaScript;
    } catch {
      throw new Error(/<html/i.test(texto)
        ? 'A planilha respondeu com uma página em vez de dados. Confira se o app da web foi publicado com acesso "Qualquer pessoa".'
        : `Resposta inesperada da planilha (HTTP ${resp.status}).`);
    }
    if (!json.ok && json.erro !== 'mudou') throw new Error(MENSAGENS[json.erro ?? ''] ?? `A planilha recusou: ${json.erro}`);
    return json;
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('A planilha demorou demais para responder. Tente de novo.');
    if (err instanceof TypeError) throw new Error('Não consegui falar com a planilha. Confira a internet e o endereço do app da web (termina em /exec).');
    throw err;
  } finally {
    clearTimeout(t);
  }
}

export function urlValida(url: string): boolean {
  return /^https:\/\/script\.google(usercontent)?\.com\/.+\/exec(\?.*)?$/.test(url.trim()) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url.trim());
}

export async function testarConexao(url: string, token: string): Promise<{ nome: string; url?: string }> {
  const r = await chamarScript(url, { token, acao: 'testar' }, 30000);
  return { nome: r.nome ?? 'Planilha', url: r.url };
}

let emAndamento: Promise<RelatorioPlanilha> | null = null;

/**
 * Sincroniza com a planilha do Google. `auto` = chamada do relógio: pula
 * quando nada mudou dos dois lados e não grava relatório vazio.
 */
export function sincronizarGoogle(auto = false): Promise<RelatorioPlanilha> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    setStatus({ executando: true });
    try {
      return await executarGoogle(auto);
    } finally {
      emAndamento = null;
      setStatus({ executando: false, verificadoEm: new Date().toISOString() });
    }
  })();
  return emAndamento;
}

async function executarGoogle(auto: boolean): Promise<RelatorioPlanilha> {
  const cfg0 = estadoAtual().planilha;
  if (!cfg0?.url) return relatorio(null, 'google', 'Planilha não conectada.');
  const { url, token } = cfg0;
  const nomes = nomesDasAbas(cfg0.abas);
  try {
    if (auto && ultimoDigest && mesmaAssinatura(assinatura, assinar(estadoAtual(), cfg0.abas))) {
      const d = await chamarScript(url, { token, acao: 'digest', abas: nomes }, 20000);
      if (d.digest === ultimoDigest) { setStatus({ falha: undefined }); return relatorio(null, 'google'); }
    }
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const lido = await chamarScript(url, { token, acao: 'ler', abas: nomes });
      // fusão e gravação local sem `await` no meio: nenhuma anotação feita agora se perde
      const cfg = estadoAtual().planilha ?? cfg0;
      const res = sincronizarPlanilha(estadoAtual(), (lido.abas ?? {}) as Record<string, Grade | undefined>, cfg.base, cfg.abas, cfg.politica, hojeISO(), novoId);
      const escrever: Record<string, { valores: Grade; colunasTexto: number[] }> = {};
      for (const a of Object.values(res.abas)) if (a.mudouPlanilha) escrever[ABAS.find((x) => x.id === a.aba)!.nome] = { valores: a.grade, colunasTexto: a.colunasTexto };
      const rel = relatorio(res, 'google');
      if (!Object.keys(escrever).length) {
        aplicarDaPlanilha(colecoesDe(res, cfg.abas), { base: res.base, ...registrar(cfg, rel) });
        ultimoDigest = lido.digest ?? '';
        assinatura = assinar(estadoAtual(), cfg.abas);
        setStatus({ falha: undefined });
        return rel;
      }
      // a base só avança depois que a planilha aceitar a escrita
      aplicarDaPlanilha(colecoesDe(res, cfg.abas));
      const w = await chamarScript(url, { token, acao: 'escrever', abas: escrever, esperado: lido.digest, abasLidas: nomes });
      if (!w.ok && w.erro === 'mudou') continue; // alguém digitou na planilha agora: refaz com a versão nova
      const cfgAtual = estadoAtual().planilha ?? cfg;
      aplicarDaPlanilha({}, { base: res.base, ...registrar(cfgAtual, rel) });
      ultimoDigest = w.digest ?? '';
      assinatura = assinar(estadoAtual(), cfg.abas);
      setStatus({ falha: undefined });
      return rel;
    }
    throw new Error('A planilha está sendo editada agora. Tento de novo daqui a pouco.');
  } catch (err) {
    const msg = (err as Error).message || String(err);
    setStatus({ falha: msg });
    const rel = relatorio(null, 'google', msg);
    if (!auto) {
      const cfg = estadoAtual().planilha;
      if (cfg) aplicarDaPlanilha({}, registrar(cfg, rel));
    }
    return rel;
  }
}

/** Esquece o que sabia da planilha conectada (ao trocar de planilha). */
export function esquecerConexao() {
  ultimoDigest = '';
  assinatura = [];
}

// ===================== EXCEL (.xlsx) =====================

const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Monta as abas para o arquivo e já guarda a base do arquivo. */
export function gradesParaArquivo(): { grades: { nome: string; grade: Grade; colunasTexto: number[] }[]; res: ResultadoSync } {
  const e = estadoAtual();
  const cfg = e.planilha ?? configPlanilhaPadrao();
  const res = sincronizarPlanilha(e, {}, {}, cfg.abas, cfg.politica, hojeISO(), novoId);
  const grades = ABAS.filter((a) => res.abas[a.id]).map((a) => ({ nome: a.nome, grade: res.abas[a.id].grade, colunasTexto: res.abas[a.id].colunasTexto }));
  return { grades, res };
}

export async function gerarXlsx(grades: { nome: string; grade: Grade; colunasTexto: number[] }[]): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DRAP Pecuária';
  for (const { nome, grade, colunasTexto } of grades) {
    const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] });
    const texto = new Set(colunasTexto);
    grade.forEach((linha, i) => {
      const row = ws.getRow(i + 1);
      linha.forEach((v, j) => {
        const cel = row.getCell(j + 1);
        if (i > 0 && texto.has(j)) { cel.value = v == null ? '' : String(v); cel.numFmt = '@'; return; }
        const m = typeof v === 'string' && i > 0 ? v.match(DATA_BR) : null;
        if (m) { cel.value = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])); cel.numFmt = 'dd/mm/yyyy'; return; }
        cel.value = v === '' ? null : v;
      });
      if (i === 0) row.font = { bold: true };
    });
    ws.getColumn(1).font = { color: { argb: 'FF8A8A80' } };
    ws.columns.forEach((c, j) => {
      const larg = Math.max(...grade.slice(0, 200).map((l) => String(l[j] ?? '').length), 6);
      c.width = Math.min(40, larg + 2);
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function celula(v: unknown): Celula {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string; error?: string };
    if ('result' in o) return celula(o.result);
    if (o.richText) return o.richText.map((x) => x.text).join('');
    if (o.text != null) return String(o.text);
  }
  return String(v);
}

export async function lerXlsx(arquivo: ArrayBuffer): Promise<Record<string, Grade>> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arquivo);
  const out: Record<string, Grade> = {};
  wb.eachSheet((ws) => {
    const g: Grade = [];
    const largura = ws.columnCount;
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const l: Celula[] = [];
      for (let j = 1; j <= largura; j++) l.push(celula(row.getCell(j).value));
      g[n - 1] = l;
    });
    out[ws.name] = Array.from(g, (l) => l ?? []);
  });
  return out;
}

/** Recebe o .xlsx preenchido, funde, grava no aparelho e devolve as abas atualizadas. */
export async function importarXlsx(arquivo: ArrayBuffer): Promise<{ rel: RelatorioPlanilha; grades: { nome: string; grade: Grade; colunasTexto: number[] }[] }> {
  const planilha = await lerXlsx(arquivo);
  const e = estadoAtual();
  const cfg = e.planilha ?? configPlanilhaPadrao();
  const reconhecidas = ABAS.filter((a) => Object.keys(planilha).some((n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === a.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()));
  const ids = reconhecidas.map((a) => a.id);
  if (!ids.length) {
    const rel = relatorio(null, 'arquivo', `Nenhuma aba reconhecida. Os nomes das abas devem ser: ${ABAS.map((a) => a.nome).join(', ')}.`);
    return { rel, grades: [] };
  }
  const res = sincronizarPlanilha(e, planilha, cfg.baseArquivo, ids, cfg.politica, hojeISO(), novoId);
  const rel = relatorio(res, 'arquivo');
  aplicarDaPlanilha(colecoesDe(res, ids), { baseArquivo: { ...cfg.baseArquivo, ...res.base }, ...registrar(cfg, rel) });
  const grades = ABAS.filter((a) => res.abas[a.id]).map((a) => ({ nome: a.nome, grade: res.abas[a.id].grade, colunasTexto: res.abas[a.id].colunasTexto }));
  return { rel, grades };
}

export function baixar(blob: Blob, nome: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

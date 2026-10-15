'use client';

/**
 * Armazenamento offline-first.
 *
 * Todo o estado vive no aparelho (localStorage) e cada alteração entra numa
 * fila de pendências (`pendentes`). Quando houver servidor configurado
 * (NEXT_PUBLIC_DRAP_SYNC_URL), `sincronizar()` envia a fila e a esvazia; sem
 * servidor o app segue 100% funcional no modo local. É o comportamento de
 * que o campo precisa: anotar no curral sem sinal e sincronizar na sede.
 */

import { useSyncExternalStore } from 'react';
import { estadoDemo, estadoVazio, VERSAO_ESTADO } from './seed';
import { hojeISO } from './datas';
import type { Colecoes, Estado, Fazenda, Id, ModuloId, Pendente } from './domain/types';

const CHAVE = 'drap-pecuaria:estado:v1';

type Listener = () => void;
const listeners = new Set<Listener>();
let estado: Estado | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function carregar(): Estado {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) {
      const parsed = JSON.parse(raw) as Estado;
      if (parsed.versao === VERSAO_ESTADO) return { ...estadoVazio(), ...parsed };
    }
  } catch {
    /* armazenamento indisponível: segue com a demo em memória */
  }
  return estadoDemo(hojeISO());
}

function persistir() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      console.warn('Não foi possível salvar no aparelho (armazenamento cheio ou bloqueado).');
    }
  }, 150);
}

function emitir() {
  for (const l of listeners) l();
}

function obter(): Estado {
  if (!estado) {
    estado = carregar();
    // grava a demo na primeira abertura: o histórico não muda a cada recarga
    if (typeof window !== 'undefined') persistir();
  }
  return estado;
}

function definir(novo: Estado) {
  estado = novo;
  persistir();
  emitir();
}

export function useEstado(): Estado {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    obter,
    obter,
  );
}

export function estadoAtual(): Estado {
  return obter();
}

let contador = 0;
export function novoId(prefixo = 'x'): Id {
  contador = (contador + 1) % 1296;
  return `${prefixo}${Date.now().toString(36)}${contador.toString(36).padStart(2, '0')}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}

function pendencia(colecao: keyof Colecoes, op: Pendente['op'], registroId: Id): Pendente {
  return { id: novoId('q'), em: new Date().toISOString(), colecao, op, registroId };
}

type Item<K extends keyof Colecoes> = Colecoes[K][number];

/** Insere (ou substitui pelo id) um registro, assinando com o operador atual. */
export function salvar<K extends keyof Colecoes>(colecao: K, registro: Item<K>): Item<K> {
  const e = obter();
  const lista = e[colecao] as Item<K>[];
  const existe = lista.some((x) => x.id === registro.id);
  const assinado = { por: e.operadorId, em: new Date().toISOString(), ...registro } as Item<K>;
  const nova = existe ? lista.map((x) => (x.id === registro.id ? { ...x, ...registro } : x)) : [...lista, assinado];
  definir({ ...e, [colecao]: nova, pendentes: [...e.pendentes, pendencia(colecao, 'upsert', registro.id)] });
  return assinado;
}

export function salvarVarios<K extends keyof Colecoes>(colecao: K, registros: Item<K>[]) {
  const e = obter();
  const lista = e[colecao] as Item<K>[];
  const porId = new Map(lista.map((x) => [x.id, x]));
  const agora = new Date().toISOString();
  for (const r of registros) {
    const anterior = porId.get(r.id);
    porId.set(r.id, (anterior ? { ...anterior, ...r } : { por: e.operadorId, em: agora, ...r }) as Item<K>);
  }
  definir({
    ...e,
    [colecao]: [...porId.values()],
    pendentes: [...e.pendentes, ...registros.map((r) => pendencia(colecao, 'upsert', r.id))],
  });
}

export function atualizar<K extends keyof Colecoes>(colecao: K, id: Id, patch: Partial<Item<K>>) {
  const e = obter();
  const lista = e[colecao] as Item<K>[];
  definir({
    ...e,
    [colecao]: lista.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    pendentes: [...e.pendentes, pendencia(colecao, 'upsert', id)],
  });
}

export function remover<K extends keyof Colecoes>(colecao: K, id: Id) {
  const e = obter();
  const lista = e[colecao] as Item<K>[];
  definir({
    ...e,
    [colecao]: lista.filter((x) => x.id !== id),
    pendentes: [...e.pendentes, pendencia(colecao, 'delete', id)],
  });
}

export function definirFazenda(patch: Partial<Fazenda>) {
  const e = obter();
  definir({ ...e, fazenda: { ...e.fazenda, ...patch } });
}

export function definirModulo(id: ModuloId, ativo: boolean) {
  if (id === 'core') return;
  const e = obter();
  definir({ ...e, modulos: { ...e.modulos, [id]: ativo } });
}

export function definirOperador(id: Id) {
  definir({ ...obter(), operadorId: id });
}

export function definirParcial(patch: Partial<Estado>) {
  definir({ ...obter(), ...patch });
}

export function restaurarDemo() {
  definir(estadoDemo(hojeISO()));
}

export function comecarDoZero() {
  definir(estadoVazio());
}

export function exportarJSON(): string {
  return JSON.stringify(obter(), null, 2);
}

export function importarJSON(texto: string): { ok: true } | { ok: false; erro: string } {
  try {
    const dados = JSON.parse(texto) as Estado;
    if (dados.versao !== VERSAO_ESTADO || !Array.isArray(dados.animais)) {
      return { ok: false, erro: 'Arquivo não é um backup do DRAP Pecuária desta versão.' };
    }
    definir({ ...estadoVazio(), ...dados });
    return { ok: true };
  } catch (err) {
    return { ok: false, erro: `Não consegui ler o arquivo: ${String(err)}` };
  }
}

export const URL_SYNC = process.env.NEXT_PUBLIC_DRAP_SYNC_URL ?? '';

/**
 * Envia a fila de pendências ao servidor. Sem servidor configurado, devolve
 * `modo: 'local'` e mantém a fila (nada é perdido).
 */
export async function sincronizar(): Promise<{ modo: 'local' | 'servidor'; enviados: number; erro?: string }> {
  const e = obter();
  if (!URL_SYNC) return { modo: 'local', enviados: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { modo: 'servidor', enviados: 0, erro: 'Sem conexão: as pendências continuam guardadas no aparelho.' };
  const lote = e.pendentes;
  const registros = lote.map((p) => ({
    ...p,
    dados: p.op === 'upsert' ? (e[p.colecao] as { id: Id }[]).find((x) => x.id === p.registroId) ?? null : null,
  }));
  try {
    const resp = await fetch(URL_SYNC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fazenda: e.fazenda.nome, registros }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const enviados = new Set(lote.map((p) => p.id));
    const atual = obter();
    definir({ ...atual, pendentes: atual.pendentes.filter((p) => !enviados.has(p.id)), ultimaSincronizacao: new Date().toISOString() });
    return { modo: 'servidor', enviados: lote.length };
  } catch (err) {
    return { modo: 'servidor', enviados: 0, erro: String(err) };
  }
}

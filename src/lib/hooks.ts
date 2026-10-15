'use client';

import { useMemo } from 'react';
import { useEstado } from './store';
import { hojeISO } from './datas';
import { indexarPesagens } from './domain/rebanho';
import { atividadesAtivas } from './domain/modulos';
import type { Animal, Lote, Piquete, Pessoa, Id, Atividade, ModuloId } from './domain/types';

export function useHoje(): string {
  return useMemo(() => hojeISO(), []);
}

/** Índices usados em quase toda tela (por id, pesagens por animal). */
export function useIndices() {
  const e = useEstado();
  return useMemo(() => ({
    animal: new Map<Id, Animal>(e.animais.map((a) => [a.id, a])),
    lote: new Map<Id, Lote>(e.lotes.map((l) => [l.id, l])),
    piquete: new Map<Id, Piquete>(e.piquetes.map((p) => [p.id, p])),
    pessoa: new Map<Id, Pessoa>(e.pessoas.map((p) => [p.id, p])),
    pesagens: indexarPesagens(e.pesagens),
  }), [e.animais, e.lotes, e.piquetes, e.pessoas, e.pesagens]);
}

/** Saudação pelo horário de Brasília (igual à interface do sócio do DRAP Fazenda). */
export function saudacao(): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Atividades contratadas e lotes que pertencem a elas. */
export function usePerfil() {
  const e = useEstado();
  return useMemo(() => {
    const atividades = atividadesAtivas(e.modulos);
    const ativo = (a: Atividade | ModuloId) => a === 'geral' || a === 'core' || !!e.modulos[a as ModuloId];
    const lotes = e.lotes.filter((l) => ativo(l.atividade));
    const loteIds = new Set(lotes.map((l) => l.id));
    /** Animal visível: no lote de uma atividade ativa, ou sem lote (vendidos, mortos). */
    const animalVisivel = (a: Animal) => !a.loteId || loteIds.has(a.loteId);
    return { atividades, ativo, lotes, loteIds, animalVisivel, so: atividades.length === 1 ? atividades[0] : null };
  }, [e.modulos, e.lotes]);
}

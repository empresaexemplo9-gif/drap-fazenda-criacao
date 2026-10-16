'use client';

import { useEffect, useRef } from 'react';
import { useEstado } from '@/lib/store';
import { sincronizarGoogle } from '@/lib/planilha-sync';

const INTERVALO = 2 * 60 * 1000;
const DEPOIS_DE_ANOTAR = 15 * 1000;

/**
 * Sincronização automática com a planilha do Google: ao abrir, a cada
 * 2 minutos com a aba visível, ao voltar o sinal e 15 s depois de uma
 * anotação. Sem planilha conectada (ou com o automático desligado), não faz nada.
 */
export function PlanilhaAuto() {
  const e = useEstado();
  const ligado = !!e.planilha?.url && e.planilha.automatica;
  const atraso = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ligado) return;
    const rodar = () => {
      if (navigator.onLine && document.visibilityState === 'visible') void sincronizarGoogle(true);
    };
    const inicio = setTimeout(rodar, 2500);
    const relogio = setInterval(rodar, INTERVALO);
    const visivel = () => { if (document.visibilityState === 'visible') rodar(); };
    window.addEventListener('online', rodar);
    document.addEventListener('visibilitychange', visivel);
    return () => {
      clearTimeout(inicio);
      clearInterval(relogio);
      window.removeEventListener('online', rodar);
      document.removeEventListener('visibilitychange', visivel);
    };
  }, [ligado, e.planilha?.url]);

  // depois de uma anotação no DRAP, leva para a planilha
  const { animais, lotes, piquetes, pessoas, insumos, pesagens, lancamentos, documentos } = e;
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    if (!ligado) return;
    if (atraso.current) clearTimeout(atraso.current);
    atraso.current = setTimeout(() => { if (navigator.onLine) void sincronizarGoogle(true); }, DEPOIS_DE_ANOTAR);
    return () => { if (atraso.current) clearTimeout(atraso.current); };
  }, [ligado, animais, lotes, piquetes, pessoas, insumos, pesagens, lancamentos, documentos]);

  return null;
}

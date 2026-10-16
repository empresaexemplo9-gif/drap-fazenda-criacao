'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from './header';
import { BoasVindas } from './boas-vindas';
import { PlanilhaAuto } from './planilha-auto';
import { useEstado } from '@/lib/store';

/**
 * Os dados vivem no aparelho, então a página só renderiza depois de montar
 * no navegador (evita divergência entre o HTML estático e o estado local).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const e = useEstado();
  useEffect(() => {
    setPronto(true);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
  if (!pronto) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-earth" aria-label="Carregando" />
      </div>
    );
  }
  if (!e.perfilDefinido) return <BoasVindas />;
  return (
    <>
      <Header />
      <PlanilhaAuto />
      <main className="mx-auto max-w-wide px-4 pb-24 pt-8 sm:px-8 sm:pt-12">{children}</main>
      <footer className="mx-auto flex max-w-wide flex-col items-center justify-between gap-3 border-t border-rule px-4 pb-10 pt-6 text-[11px] uppercase tracking-wide2 text-muted sm:flex-row sm:px-8">
        <span>DRAP Pecuária · funciona sem sinal</span>
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          Desenvolvido por
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/drap.svg" alt="DRAP" className="h-3.5 w-auto opacity-90" />
        </span>
        <span className="font-mono text-earth">v0.1</span>
      </footer>
    </>
  );
}

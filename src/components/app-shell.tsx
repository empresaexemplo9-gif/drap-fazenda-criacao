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
    <div className="shell-main min-h-screen lg:pl-64">
      <Header />
      <PlanilhaAuto />
      <main className="px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8 2xl:px-10">{children}</main>
      <footer className="flex flex-col items-center justify-between gap-2 border-t border-rule/70 px-4 py-5 text-[12px] text-muted sm:flex-row sm:px-6 lg:px-8 2xl:px-10">
        <span>DRAP Pecuária · funciona sem sinal</span>
        <span className="flex items-center gap-1.5">
          Desenvolvido por
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/drap.svg" alt="DRAP" className="h-3.5 w-auto opacity-90" />
          <span className="num ml-2 text-earth">v0.1</span>
        </span>
      </footer>
    </div>
  );
}

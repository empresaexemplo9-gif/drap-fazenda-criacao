'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, Settings, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { ROTAS } from '@/lib/rotas';
import { useEstado, definirOperador, sincronizar } from '@/lib/store';
import { moduloAtivo } from '@/lib/domain/modulos';
import { cx } from './ui';

function ativo(path: string, href: string) {
  const h = href.replace(/\/$/, '');
  return path === href || path === h || path.startsWith(h + '/');
}

/** Online/offline + fila de pendências: o vaqueiro sabe que o que anotou está guardado. */
function SyncStatus() {
  const e = useEstado();
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener('online', up);
    window.addEventListener('offline', up);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', up); };
  }, []);
  async function sync() {
    const r = await sincronizar();
    setMsg(r.modo === 'local' ? 'Modo local: dados guardados neste aparelho.' : r.erro ?? `${r.enviados} registro(s) enviados.`);
    setTimeout(() => setMsg(''), 4000);
  }
  const n = e.pendentes.length;
  return (
    <div className="relative">
      <button type="button" onClick={sync}
        title={online ? `${n} alteração(ões) guardadas no aparelho` : 'Sem sinal: tudo continua sendo salvo no aparelho'}
        className={cx('inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-[12px] font-medium transition-colors hover:bg-rule/40', online ? 'text-muted' : 'text-warn')}>
        {online ? <Wifi className="h-4 w-4" strokeWidth={1.5} /> : <WifiOff className="h-4 w-4" strokeWidth={1.5} />}
        <span className="num hidden sm:inline">{n}</span>
        <RefreshCw className="hidden h-3 w-3 sm:inline" strokeWidth={1.5} />
      </button>
      {msg ? <div className="absolute right-0 top-10 z-50 w-64 rounded-sm border border-rule bg-bone px-3 py-2 text-[12px] shadow-card">{msg}</div> : null}
    </div>
  );
}

function Operador() {
  const e = useEstado();
  const ativos = e.pessoas.filter((p) => p.ativo);
  if (!ativos.length) return null;
  return (
    <label className="hidden items-center gap-1.5 text-[12px] text-muted md:inline-flex" title="Quem está anotando neste aparelho">
      <span className="eyebrow text-[10px] text-muted">Anotando</span>
      <select value={e.operadorId ?? ''} onChange={(ev) => definirOperador(ev.target.value)}
        className="max-w-[9rem] truncate border-0 border-b border-rule bg-transparent py-0.5 text-[12.5px] font-medium text-ink focus:outline-none">
        {ativos.map((p) => <option key={p.id} value={p.id}>{p.nome.split(' ')[0]}</option>)}
      </select>
    </label>
  );
}

export function Header() {
  const path = usePathname();
  const e = useEstado();
  const [drawer, setDrawer] = useState(false);
  const rotas = ROTAS.filter((r) => moduloAtivo(e.modulos, r.modulo));
  const topo = rotas.filter((r) => r.topo);

  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [drawer]);

  const grupos = ['Rebanho', 'Financeiro', 'Gestão', 'Módulos', 'Sistema'] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-wide items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Abrir menu"
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-sm text-ink transition-colors hover:bg-rule/40">
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <Link href="/" className="inline-flex items-center" aria-label="DRAP Pecuária · Painel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/drap-pecuaria.svg" alt="DRAP Pecuária" className="h-8 w-auto sm:h-9" />
          </Link>
        </div>

        <nav className="hidden items-center gap-0.5 xl:flex">
          {topo.map((item) => {
            const on = ativo(path, item.href);
            return (
              <Link key={item.href} href={item.href}
                className={cx('relative whitespace-nowrap px-2.5 py-1.5 text-[13px] font-medium transition-colors', on ? 'text-ink' : 'text-muted hover:text-ink')}>
                {item.label}
                {on ? <span className="absolute inset-x-2.5 -bottom-[15px] h-px bg-ink" aria-hidden /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Operador />
          <SyncStatus />
          <Link href="/config/" aria-label="Configurações" title="Configurações"
            className={cx('inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors hover:bg-rule/40', ativo(path, '/config/') ? 'text-ink' : 'text-muted hover:text-ink')}>
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {drawer && typeof document !== 'undefined'
        ? createPortal(
          <>
            <div className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-hidden />
            <aside className="fixed inset-y-0 left-0 z-[70] flex w-[82%] max-w-sm flex-col border-r border-rule bg-paper shadow-xl">
              <div className="flex items-center justify-between border-b border-rule px-5 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/drap-pecuaria.svg" alt="DRAP Pecuária" className="h-9 w-auto" />
                <button type="button" onClick={() => setDrawer(false)} aria-label="Fechar menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:bg-rule/40 hover:text-ink">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-2">
                <Link href="/" className={cx('block border-l-2 px-5 py-2.5 text-[15px] font-medium', path === '/' ? 'border-ink bg-bone text-ink' : 'border-transparent text-muted hover:text-ink')}>Painel</Link>
                {grupos.map((g) => {
                  const itens = rotas.filter((r) => r.grupo === g);
                  if (!itens.length) return null;
                  return (
                    <div key={g} className="mt-3">
                      <div className="eyebrow px-5 pb-1">{g}</div>
                      {itens.map((item) => {
                        const on = ativo(path, item.href);
                        return (
                          <Link key={item.href} href={item.href}
                            className={cx('block border-l-2 px-5 py-2 text-[14.5px] font-medium transition-colors', on ? 'border-ink bg-bone text-ink' : 'border-transparent text-muted hover:bg-bone/60 hover:text-ink')}>
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </nav>
              <div className="border-t border-rule px-5 py-4 text-[11px] uppercase tracking-wide2 text-muted">
                {e.fazenda.nome} · <span className="font-mono text-earth">v0.1</span>
              </div>
            </aside>
          </>,
          document.body,
        )
        : null}
    </header>
  );
}

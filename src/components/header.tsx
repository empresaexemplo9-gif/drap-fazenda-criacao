'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, Settings, Wifi, WifiOff, RefreshCw, LayoutDashboard, ListChecks, UserRound } from 'lucide-react';
import { ROTAS, type Rota } from '@/lib/rotas';
import { useEstado, definirOperador, sincronizar } from '@/lib/store';
import { useHoje } from '@/lib/hooks';
import { moduloAtivo } from '@/lib/domain/modulos';
import { ICONES } from './icones';
import { CurvasDeNivel } from './agro';
import { cx } from './ui';

function ativo(path: string, href: string) {
  const h = href.replace(/\/$/, '');
  return path === href || path === h || path.startsWith(h + '/');
}

const GRUPOS = ['Rebanho', 'Financeiro', 'Gestão', 'Módulos', 'Sistema'] as const;

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
        className={cx('inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-[12.5px] font-semibold transition-colors',
          online ? 'border-rule/70 bg-white text-muted hover:border-rule hover:text-ink' : 'border-warn/40 bg-warnLt/60 text-warn')}>
        <span className={cx('h-1.5 w-1.5 rounded-full', online ? 'bg-leaf' : 'bg-warn')} aria-hidden />
        {online ? <Wifi className="h-4 w-4" strokeWidth={1.75} /> : <WifiOff className="h-4 w-4" strokeWidth={1.75} />}
        <span className="hidden sm:inline">{online ? 'Online' : 'Sem sinal'}</span>
        <span className="num hidden rounded-md bg-paper px-1.5 py-0.5 text-[11px] text-ink sm:inline">{n}</span>
        <RefreshCw className="hidden h-3.5 w-3.5 sm:inline" strokeWidth={1.75} />
      </button>
      {msg ? <div className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-rule bg-white px-3 py-2 text-[12px] shadow-card">{msg}</div> : null}
    </div>
  );
}

function Operador() {
  const e = useEstado();
  const ativos = e.pessoas.filter((p) => p.ativo);
  if (!ativos.length) return null;
  return (
    <label className="hidden h-9 items-center gap-2 rounded-lg border border-rule/70 bg-white pl-2.5 pr-1 text-[12.5px] text-muted md:inline-flex" title="Quem está anotando neste aparelho">
      <UserRound className="h-4 w-4" strokeWidth={1.75} />
      <span className="hidden xl:inline">Anotando</span>
      <select value={e.operadorId ?? ''} onChange={(ev) => definirOperador(ev.target.value)}
        className="max-w-[9rem] cursor-pointer truncate border-0 bg-transparent py-1 text-[13px] font-semibold text-ink focus:outline-none">
        {ativos.map((p) => <option key={p.id} value={p.id}>{p.nome.split(' ')[0]}</option>)}
      </select>
    </label>
  );
}

/** Menu de navegação (mesmo conteúdo na barra lateral fixa e na gaveta do celular). */
function Navegacao({ rotas, path }: { rotas: Rota[]; path: string }) {
  const item = (on: boolean) => cx(
    'group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors',
    on ? 'bg-white/[0.11] text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
  );
  const marca = <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#A9C596]" aria-hidden />;
  return (
    <nav className="relative flex-1 overflow-y-auto px-3 pb-4 pt-3" aria-label="Navegação principal">
      <Link href="/" className={item(path === '/')}>
        {path === '/' ? marca : null}
        <LayoutDashboard className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} />
        Painel
      </Link>
      {GRUPOS.map((g) => {
        const itens = rotas.filter((r) => r.grupo === g);
        if (!itens.length) return null;
        return (
          <div key={g} className="mt-4">
            <div className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">{g === 'Módulos' ? 'Seus módulos' : g}</div>
            <div className="space-y-0.5">
              {itens.map((r) => {
                const on = ativo(path, r.href);
                const Icon = ICONES[r.href] ?? ListChecks;
                return (
                  <Link key={r.href} href={r.href} className={item(on)} aria-current={on ? 'page' : undefined}>
                    {on ? marca : null}
                    <Icon className={cx('h-[18px] w-[18px] flex-shrink-0', on ? 'text-[#A9C596]' : 'text-white/45 group-hover:text-white/80')} strokeWidth={1.75} />
                    {r.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function Marca({ fazenda }: { fazenda: string }) {
  return (
    <div className="relative flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
      <Link href="/" aria-label="DRAP Pecuária · Painel" className="inline-flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/drap-pecuaria-claro.svg" alt="DRAP Pecuária" className="h-9 w-auto" />
      </Link>
      <span className="sr-only">{fazenda}</span>
    </div>
  );
}

function Rodape({ fazenda }: { fazenda: string }) {
  return (
    <div className="relative border-t border-[#1B2A18]/15 px-5 py-3.5">
      <div className="truncate text-[13px] font-bold text-[#16210F]">{fazenda}</div>
      <div className="mt-0.5 flex items-center justify-between text-[11px] font-medium text-[#16210F]/70">
        <span>Funciona sem sinal</span>
        <span className="num">v0.1</span>
      </div>
    </div>
  );
}

const FUNDO_MENU = 'degrade-campo-v';

export function Header() {
  const path = usePathname();
  const e = useEstado();
  const hoje = useHoje();
  const [drawer, setDrawer] = useState(false);
  const rotas = ROTAS.filter((r) => moduloAtivo(e.modulos, r.modulo));
  const atual = path === '/' ? 'Painel' : rotas.find((r) => ativo(path, r.href))?.label ?? (path.startsWith('/animal') ? 'Ficha do animal' : '');

  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [drawer]);

  const dataLonga = new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      {/* Barra lateral fixa no desktop */}
      <aside className={cx('fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden lg:flex', FUNDO_MENU)}>
        <CurvasDeNivel className="pointer-events-none absolute inset-0 h-full w-full" />
        <Marca fazenda={e.fazenda.nome} />
        <Navegacao rotas={rotas} path={path} />
        <Rodape fazenda={e.fazenda.nome} />
      </aside>

      {/* Barra superior: contexto da página, operador e sincronização */}
      <header className="sticky top-0 z-30 border-b border-rule/70 bg-paper/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 2xl:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Abrir menu"
              className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-rule/40 lg:hidden">
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <Link href="/" className="inline-flex items-center lg:hidden" aria-label="DRAP Pecuária · Painel">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/drap-pecuaria.svg" alt="DRAP Pecuária" className="h-8 w-auto" />
            </Link>
            <div className="hidden min-w-0 lg:block">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="truncate text-muted">{e.fazenda.nome}</span>
                <span className="text-rule" aria-hidden>/</span>
                <span className="truncate font-semibold text-ink">{atual}</span>
              </div>
              <div className="text-[11.5px] text-muted/80 first-letter:uppercase">{dataLonga}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Operador />
            <SyncStatus />
            <Link href="/config/" aria-label="Configurações" title="Configurações"
              className={cx('inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                ativo(path, '/config/') ? 'border-leaf/40 bg-leafLt/60 text-leafDk' : 'border-rule/70 bg-white text-muted hover:border-rule hover:text-ink')}>
              <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </header>

      {drawer && typeof document !== 'undefined'
        ? createPortal(
          <>
            <div className="fixed inset-0 z-[60] bg-ink/50 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-hidden />
            <div className={cx('fixed inset-y-0 left-0 z-[70] flex w-[84%] max-w-xs flex-col overflow-hidden shadow-2xl', FUNDO_MENU)} role="dialog" aria-label="Menu">
              <CurvasDeNivel className="pointer-events-none absolute inset-0 h-full w-full" />
              <div className="relative">
                <Marca fazenda={e.fazenda.nome} />
                <button type="button" onClick={() => setDrawer(false)} aria-label="Fechar menu"
                  className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white">
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
              <Navegacao rotas={rotas} path={path} />
              <Rodape fazenda={e.fazenda.nome} />
            </div>
          </>,
          document.body,
        )
        : null}
    </>
  );
}

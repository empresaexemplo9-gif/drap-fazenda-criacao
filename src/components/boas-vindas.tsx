'use client';

/**
 * Primeiro acesso: "Como é a sua operação?". O produtor marca uma, duas ou
 * as três atividades; a plataforma inteira (menu, lotes, plano de contas,
 * custos, mercado e painel) passa a mostrar só o que ele faz.
 */

import { useState } from 'react';
import { Beef, Milk, Dna, Check } from 'lucide-react';
import { iniciarPerfil, confirmarPerfil, useEstado } from '@/lib/store';
import { brl } from '@/lib/format';
import { MODULOS, perfilDe, precoTotal, type ModuloProdutivo } from '@/lib/domain/modulos';
import type { ModuloId } from '@/lib/domain/types';
import { cx, Em } from './ui';

const ICONE: Record<ModuloProdutivo, typeof Beef> = { corte: Beef, leite: Milk, genetica: Dna };
const PERGUNTA: Record<ModuloProdutivo, string> = {
  corte: 'Cria, recria, engorda ou confinamento para frigorífico',
  leite: 'Ordenha e entrega para laticínio',
  genetica: 'Seleção e venda de touros, matrizes, sêmen ou embriões',
};

export function BoasVindas() {
  const e = useEstado();
  const temDados = e.perfilDefinido === false && e.animais.length > 0;
  const [sel, setSel] = useState<Record<ModuloProdutivo, boolean>>({
    corte: e.perfilDefinido === false ? e.modulos.corte : false,
    leite: e.perfilDefinido === false ? e.modulos.leite : false,
    genetica: e.perfilDefinido === false ? e.modulos.genetica : false,
  });
  const modulos: Record<ModuloId, boolean> = { core: true, ...sel };
  const algum = sel.corte || sel.leite || sel.genetica;
  const perfil = perfilDe(modulos);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(320px,30%)_1fr]">
      <aside className="flex flex-col justify-between gap-10 bg-[#1B2A18] bg-[radial-gradient(120%_60%_at_0%_0%,rgba(72,107,58,0.45),transparent_70%)] px-6 py-6 text-white sm:px-10 lg:sticky lg:top-0 lg:h-screen lg:py-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/drap-pecuaria-claro.svg" alt="DRAP Pecuária" className="h-10 w-auto self-start" />
        <div className="hidden lg:block">
          <p className="font-display text-[34px] font-semibold leading-[1.12] tracking-tight">A fazenda inteira <span className="italic text-[#A9C596]">num lugar só</span>, mesmo sem sinal.</p>
          <ul className="mt-6 space-y-2.5 text-[14px] text-white/70">
            {['Rebanho, sanidade e pasto no mesmo cadastro', 'Livro-razão com custo real da @ e do litro', 'Funciona offline no curral e sincroniza depois'].map((t) => (
              <li key={t} className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#A9C596]" />{t}</li>
            ))}
          </ul>
        </div>
        <span className="hidden text-[12px] text-white/40 lg:block">DRAP Pecuária · v0.1</span>
      </aside>
      <main className="px-5 pb-16 pt-8 sm:px-10 sm:pt-12 lg:flex lg:flex-col lg:justify-center lg:px-14 2xl:px-20">
        <span className="eyebrow">Primeiro acesso</span>
        <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-tight sm:text-4xl">
          Como é a <Em tom="earth">sua operação</Em>?
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Marque o que a fazenda faz. Pode ser uma atividade só ou uma combinação. O núcleo (rebanho, sanidade, pasto, estoque, livro-razão e custos) vem sempre, ajustado ao que você marcar.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['corte', 'leite', 'genetica'] as ModuloProdutivo[]).map((m) => {
            const Icon = ICONE[m];
            const mod = MODULOS.find((x) => x.id === m)!;
            const on = sel[m];
            return (
              <button key={m} type="button" role="checkbox" aria-checked={on} onClick={() => setSel({ ...sel, [m]: !on })}
                className={cx('card relative flex flex-col items-start gap-3 rounded-xl p-6 text-left transition-colors', on ? '!border-leaf !bg-leafLt/50 ring-2 ring-leaf/20' : 'hover:border-leaf/40')}>
                <span className={cx('absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md border', on ? 'border-leafDk bg-leafDk text-paper' : 'border-rule text-transparent')}><Check className="h-4 w-4" /></span>
                <Icon className={cx('h-8 w-8', on ? 'text-leafDk' : 'text-earth')} strokeWidth={1.5} />
                <span className="font-sans text-xl font-bold tracking-tight">{mod.nome.replace('Módulo ', '')}</span>
                <span className="text-[13.5px] leading-snug text-muted">{PERGUNTA[m]}</span>
                <ul className="mt-1 space-y-0.5 text-[12px] text-muted">{mod.recursos.slice(0, 4).map((r) => <li key={r}>· {r}</li>)}</ul>
              </button>
            );
          })}
        </div>

        <section className="card mt-6 flex flex-col gap-4 rounded-xl p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="eyebrow">Seu perfil</span>
            <p className="mt-1 font-display text-2xl font-semibold">{algum ? perfil?.nome : 'Escolha ao menos uma atividade'}</p>
            {algum ? <p className="num text-[13px] text-earth">Núcleo + {perfil?.modulos.length} módulo(s) · {brl(precoTotal(modulos))}/mês (referência)</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <button className="btn btn-primary" disabled={!algum} onClick={() => iniciarPerfil(modulos, true)}>Começar com a fazenda de exemplo</button>
            <button className="btn btn-ghost" disabled={!algum} onClick={() => iniciarPerfil(modulos, false)}>Começar com a fazenda vazia</button>
            {temDados ? <button className="text-[12.5px] font-medium text-earth hover:text-ink disabled:opacity-50" disabled={!algum} onClick={() => confirmarPerfil(modulos)}>Manter os dados que já estão neste aparelho</button> : null}
          </div>
        </section>
        <p className="mt-4 text-[12px] text-muted">Dá para mudar depois em Configurações: ligar um módulo novo quando a fazenda passar a fazer leite, por exemplo.</p>
      </main>
    </div>
  );
}

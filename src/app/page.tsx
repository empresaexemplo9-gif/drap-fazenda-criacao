'use client';

/**
 * Painel: "O que precisa da sua atenção hoje", no formato da interface do
 * sócio do DRAP Fazenda (pagamentos do dia + resumos compactos com link),
 * acrescido do que o pecuarista precisa ver ao acordar: manejo do dia,
 * prazos sanitários, carência, pasto, estoque e cabeças que não batem.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import {
  ArrowUpRight, CalendarCheck, Wallet, BarChart3, Beef, Milk, Dna, TriangleAlert, Sprout, Package, Scale, LineChart,
  ListChecks, Syringe, CalendarDays, Landmark, FileText, Users, Tractor, Calculator, ClipboardList,
} from 'lucide-react';
import { useEstado, salvar, novoId } from '@/lib/store';
import { useHoje, useIndices, saudacao } from '@/lib/hooks';
import { brl, isoToBrDate, num } from '@/lib/format';
import { addDias, rotuloMes } from '@/lib/datas';
import { posicao } from '@/lib/domain/livro-razao';
import { sugestoes, sugestaoParaEvento, atrasados } from '@/lib/domain/calendario';
import { carenciasAtivas, lotacaoPiquetes, conciliarCabecas, uaDe, pesoAtual, ativos } from '@/lib/domain/rebanho';
import { previsaoRuptura } from '@/lib/domain/estoque';
import { custoPorLote, resumoCustos } from '@/lib/domain/custos';
import { relacaoTroca } from '@/lib/domain/simulador';
import { moduloAtivo } from '@/lib/domain/modulos';
import { ROTAS } from '@/lib/rotas';
import { ROT_EVENTO, TOM_EVENTO } from '@/lib/rotulos';
import { Badge, Em } from '@/components/ui';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII'];
const ICONES: Record<string, typeof Beef> = {
  '/rebanho/': Beef, '/manejo/': Scale, '/pastagens/': Sprout, '/sanidade/': Syringe, '/agenda/': CalendarDays,
  '/lancamentos/': ListChecks, '/posicao/': Wallet, '/custos/': Calculator, '/estoque/': Package, '/documentos/': FileText,
  '/equipe/': Users, '/mercado/': LineChart, '/corte/': Tractor, '/leite/': Milk, '/genetica/': Dna, '/feira/': ClipboardList,
  '/config/': Landmark,
};

export default function Painel() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const operador = e.operadorId ? ix.pessoa.get(e.operadorId) : undefined;

  const d = useMemo(() => {
    const pos = posicao(e.lancamentos, hoje, hoje, addDias(hoje, 30));
    const pagarHoje = pos.titulos.filter((t) => t.vencimento <= hoje);
    const sugs = sugestoes(e, hoje, 30);
    const eventosHoje = e.eventos.filter((ev) => !ev.concluido && ev.data === hoje);
    const sugsHoje = sugs.filter((s) => s.data <= hoje && s.tipo !== 'pagamento');
    const atras = atrasados(e.eventos, hoje);
    const carencias = carenciasAtivas(e.sanidade, hoje);
    const pastos = lotacaoPiquetes(e.piquetes, e.lotes, e.animais, ix.pesagens, hoje);
    const superlotados = pastos.filter((p) => p.situacao === 'superlotado');
    const prontos = pastos.filter((p) => p.situacao === 'descanso_ok');
    const estoque = previsaoRuptura(e.insumos, e.movEstoque, hoje).filter((s) => s.abaixoMinimo || (s.diasCobertura != null && s.diasCobertura < 15));
    const conc = conciliarCabecas(e.lotes, e.animais).filter((c) => c.diferenca);
    const vivos = ativos(e.animais);
    const ua = vivos.reduce((s, a) => s + uaDe(pesoAtual(a, ix.pesagens.get(a.id), hoje)), 0);
    const areaPasto = e.piquetes.filter((p) => p.status !== 'reforma').reduce((s, p) => s + p.areaHa, 0);
    const porAtividade = (['corte', 'leite', 'genetica'] as const).map((at) => ({
      at, n: vivos.filter((a) => a.loteId && ix.lote.get(a.loteId)?.atividade === at).length,
    }));
    const de = addDias(hoje, -89);
    const custos = custoPorLote(e.lancamentos, e.contas, e.lotes, e.animais, e.pesagens, de, hoje, e.fazenda.rendimentoCarcacaPct);
    const res = resumoCustos(custos.lotes, e.ordenhas, de, hoje);
    const ultima = (ind: string) => e.cotacoes.filter((c) => c.indicador === ind).sort((a, b) => a.data.localeCompare(b.data)).pop();
    const boi = ultima('boi_gordo');
    const bez = ultima('bezerro');
    const leite = ultima('leite');
    return {
      pos, pagarHoje, sugs, eventosHoje, sugsHoje, atras, carencias, superlotados, prontos, estoque, conc,
      vivos: vivos.length, ua, uaHa: areaPasto ? ua / areaPasto : 0, porAtividade, res, boi, bez, leite,
      troca: boi && bez ? relacaoTroca(boi.valor, 18, bez.valor) : null,
    };
  }, [e, hoje, ix]);

  const corte = d.res.find((r) => r.atividade === 'corte');
  const leiteR = d.res.find((r) => r.atividade === 'leite');
  const totalHoje = d.pagarHoje.filter((t) => t.tipo === 'pagar').reduce((s, t) => s + t.lancamento.valor, 0);
  const atencao = d.atras.length + d.carencias.length + d.superlotados.length + d.estoque.length + d.conc.length;
  const rotas = ROTAS.filter((r) => moduloAtivo(e.modulos, r.modulo));

  return (
    <div className="mx-auto max-w-reading">
      <section className="mb-10">
        <span className="eyebrow text-earth">{saudacao()} · {operador?.nome.split(' ')[0] ?? 'bem-vindo'}</span>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          O que <Em tom="earth">precisa da sua atenção</Em> hoje.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Manejo do dia, pagamentos, prazos sanitários e o panorama do rebanho num lugar só, mesmo sem sinal.
        </p>
      </section>

      {/* ===== HOJE ===== */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <article className="card overflow-hidden rounded-sm">
          <header className="flex items-start justify-between border-b border-earth/15 bg-leafLt/40 px-5 py-4">
            <div>
              <span className="eyebrow">Hoje · {isoToBrDate(hoje)}</span>
              <h2 className="mt-1 font-display text-xl font-semibold">Pagamentos do dia</h2>
            </div>
            <div className="flex items-center gap-2 text-leafDk">
              <span className="num text-2xl font-semibold">{d.pagarHoje.length}</span>
              <CalendarCheck className="h-5 w-5" strokeWidth={1.5} />
            </div>
          </header>
          {d.pagarHoje.length === 0 ? (
            <p className="px-5 py-6 text-[13px] italic text-muted">Nada vence hoje.</p>
          ) : (
            <ul>
              {d.pagarHoje.map((t) => (
                <li key={t.lancamento.id} className="flex items-baseline justify-between gap-3 border-b border-earth/15 px-5 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 text-[11px] uppercase tracking-wider text-earth">
                      <span className="num">{isoToBrDate(t.vencimento)}</span>
                      {t.atrasado ? <Badge tone="alert">atrasado</Badge> : null}
                      {t.tipo === 'receber' ? <Badge tone="leaf">a receber</Badge> : null}
                    </div>
                    <p className="mt-1 text-[15px] font-medium text-ink">{t.lancamento.historico}</p>
                    {t.lancamento.fornecedor ? <p className="text-[12px] text-muted">{t.lancamento.fornecedor}</p> : null}
                  </div>
                  <span className={`num whitespace-nowrap text-[16px] font-semibold ${t.tipo === 'receber' ? 'text-leafDk' : 'text-ink'}`}>{brl(t.lancamento.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          <footer className="flex items-center justify-between border-t border-earth/15 bg-paper/40 px-5 py-2.5 text-[12px]">
            <span className="text-muted">Total a pagar até hoje <span className="num font-semibold text-ink">{brl(totalHoje)}</span></span>
            <Link href="/posicao/" className="inline-flex items-center gap-1 font-medium text-earth hover:text-ink">Posição <ArrowUpRight className="h-3 w-3" /></Link>
          </footer>
        </article>

        <article className="card overflow-hidden rounded-sm">
          <header className="flex items-start justify-between border-b border-earth/15 bg-earthLt/40 px-5 py-4">
            <div>
              <span className="eyebrow">Hoje · campo</span>
              <h2 className="mt-1 font-display text-xl font-semibold">Manejo e prazos</h2>
            </div>
            <span className="num text-2xl font-semibold text-earth">{d.eventosHoje.length + d.sugsHoje.length}</span>
          </header>
          {d.eventosHoje.length + d.sugsHoje.length === 0 ? (
            <p className="px-5 py-6 text-[13px] italic text-muted">Sem manejo marcado para hoje.</p>
          ) : (
            <ul>
              {d.eventosHoje.map((ev) => (
                <li key={ev.id} className="border-b border-earth/15 px-5 py-3 last:border-b-0">
                  <div className="flex items-center gap-2"><Badge tone={TOM_EVENTO[ev.tipo]}>{ROT_EVENTO[ev.tipo]}</Badge></div>
                  <p className="mt-1 text-[15px] font-medium">{ev.titulo}</p>
                  {ev.obs ? <p className="text-[12px] text-muted">{ev.obs}</p> : null}
                </li>
              ))}
              {d.sugsHoje.slice(0, 5).map((s) => (
                <li key={s.regra} className="flex items-start justify-between gap-3 border-b border-earth/15 px-5 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TOM_EVENTO[s.tipo]}>{ROT_EVENTO[s.tipo]}</Badge>
                      {s.obrigatorio ? <Badge tone="alert">obrigatório</Badge> : null}
                      <span className="text-[11px] text-muted">sugerido</span>
                    </div>
                    <p className="mt-1 text-[15px] font-medium">{s.titulo}</p>
                    <p className="text-[12px] text-muted">{s.detalhe}</p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm flex-shrink-0" onClick={() => salvar('eventos', sugestaoParaEvento(s, novoId('e')))}>Agendar</button>
                </li>
              ))}
            </ul>
          )}
          <footer className="flex items-center justify-between border-t border-earth/15 bg-paper/40 px-5 py-2.5 text-[12px]">
            <span className="text-muted">{d.sugs.length} sugestões nos próximos 30 dias</span>
            <Link href="/agenda/" className="inline-flex items-center gap-1 font-medium text-earth hover:text-ink">Agenda <ArrowUpRight className="h-3 w-3" /></Link>
          </footer>
        </article>
      </section>

      {/* ===== ATENÇÃO ===== */}
      {atencao > 0 ? (
        <section className="card mt-5 rounded-sm">
          <header className="flex items-center justify-between border-b border-alert/20 bg-alertLt/40 px-5 py-3">
            <span className="eyebrow inline-flex items-center gap-1.5 text-alert"><TriangleAlert className="h-3.5 w-3.5" /> Atenção</span>
            <span className="num text-[13px] font-semibold text-alert">{atencao}</span>
          </header>
          <ul className="divide-y divide-rule/40 text-[13.5px]">
            {d.atras.map((ev) => (
              <li key={ev.id} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                <span><span className="num mr-2 text-alert">{isoToBrDate(ev.data).slice(0, 5)}</span>{ev.titulo}</span>
                <Link href="/agenda/" className="text-[12px] text-earth hover:text-ink">em atraso</Link>
              </li>
            ))}
            {d.conc.map((c) => (
              <li key={c.lote.id} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                <span><strong className="font-semibold">{c.lote.nome}</strong>: contagem física <span className="num">{c.fisica}</span> × sistema <span className="num">{c.sistema}</span></span>
                <Link href="/rebanho/?aba=conciliacao" className="num text-[12px] font-semibold text-alert">{c.diferenca! > 0 ? '+' : ''}{c.diferenca} cab</Link>
              </li>
            ))}
            {d.carencias.length ? (
              <li className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                <span><span className="num font-semibold">{d.carencias.length}</span> animal(is) em carência: não embarcar para abate{d.carencias.some((c) => c.bloqueiaLeite) ? ' e descartar o leite' : ''}</span>
                <Link href="/sanidade/" className="text-[12px] text-earth hover:text-ink">ver lista</Link>
              </li>
            ) : null}
            {d.superlotados.map((p) => (
              <li key={p.piquete.id} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                <span><strong className="font-semibold">{p.piquete.nome}</strong> superlotado: <span className="num">{num(p.uaHa)}</span> UA/ha para capacidade de <span className="num">{num(p.piquete.capacidadeUAha)}</span></span>
                <Link href="/pastagens/" className="text-[12px] text-earth hover:text-ink">pastagens</Link>
              </li>
            ))}
            {d.estoque.map((s) => (
              <li key={s.insumo.id} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                <span><strong className="font-semibold">{s.insumo.nome}</strong>: {s.diasCobertura != null ? <>dura <span className="num">{Math.floor(s.diasCobertura)}</span> dias</> : 'abaixo do mínimo'}</span>
                <Link href="/estoque/" className="text-[12px] text-earth hover:text-ink">estoque</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ===== RESUMOS ===== */}
      <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Resumo eyebrow="Rebanho" titulo={`${d.vivos} cabeças`} icon={<Beef className="h-5 w-5 text-earth" strokeWidth={1.5} />} href="/rebanho/" link="Ver rebanho">
          {d.porAtividade.filter((x) => moduloAtivo(e.modulos, x.at)).map((x) => <Linha key={x.at} label={x.at === 'corte' ? 'Corte' : x.at === 'leite' ? 'Leite' : 'Genética'} value={`${x.n} cab`} />)}
          <Linha label="Unidades animais" value={`${num(d.ua, 1)} UA`} />
          <Linha label="Lotação média" value={`${num(d.uaHa)} UA/ha`} strong />
        </Resumo>
        <Resumo eyebrow="Posição · 30 dias" titulo={`${d.pos.titulos.length} títulos em aberto`} icon={<Wallet className="h-5 w-5 text-earth" strokeWidth={1.5} />} href="/posicao/" link="Ver posição completa">
          <Linha label="A pagar" value={brl(d.pos.aPagar)} />
          <Linha label="A receber" value={brl(d.pos.aReceber)} positive />
          <Linha label="Líquido" value={`${d.pos.liquido < 0 ? '−' : d.pos.liquido > 0 ? '+' : ''}${brl(Math.abs(d.pos.liquido))}`} strong />
        </Resumo>
        <Resumo eyebrow="Custo de produção · 90 dias" titulo="Quanto custou produzir" icon={<BarChart3 className="h-5 w-5 text-earth" strokeWidth={1.5} />} href="/custos/" link="Ver custos e rateio">
          {moduloAtivo(e.modulos, 'corte') ? <Linha label="Custo da @ produzida" value={corte?.custoArroba != null ? brl(corte.custoArroba) : '—'} strong /> : null}
          {moduloAtivo(e.modulos, 'corte') ? <Linha label="@ produzidas (corte)" value={num(corte?.arrobas, 1)} /> : null}
          {moduloAtivo(e.modulos, 'leite') ? <Linha label="Custo do litro" value={leiteR?.custoLitro != null ? brl(leiteR.custoLitro) : '—'} strong /> : null}
        </Resumo>
        <Resumo eyebrow={`Mercado · ${d.boi ? rotuloMes(d.boi.data.slice(0, 7)) : ''}`} titulo={d.boi ? `Boi a ${brl(d.boi.valor)}/@` : 'Sem cotação'} icon={<LineChart className="h-5 w-5 text-earth" strokeWidth={1.5} />} href="/mercado/" link="Simular vender × segurar">
          {d.bez ? <Linha label="Bezerro" value={`${brl(d.bez.valor)}/cab`} /> : null}
          {d.troca != null ? <Linha label="Relação de troca (boi de 18 @)" value={`${num(d.troca)} bezerros`} strong /> : null}
          {d.leite && moduloAtivo(e.modulos, 'leite') ? <Linha label="Leite" value={`${brl(d.leite.valor)}/L`} /> : null}
        </Resumo>
      </section>

      {/* ===== MÓDULOS ===== */}
      <section className="mt-12">
        <span className="eyebrow">Plataforma · Núcleo e módulos contratados</span>
        <div className="mt-3 grid grid-cols-1 overflow-hidden rounded-sm border-l border-t border-rule sm:grid-cols-2 lg:grid-cols-3">
          {rotas.map(({ href, label, blurb }, i) => {
            const Icon = ICONES[href] ?? ListChecks;
            return (
              <Link key={href} href={href} className="group relative flex flex-col justify-between gap-6 border-b border-r border-rule bg-bone p-6 transition-colors hover:bg-leafLt">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[11px] font-medium text-earth">{ROMAN[i] ?? i + 1}</span>
                  <Icon className="h-5 w-5 text-earth transition-transform group-hover:-translate-y-0.5 group-hover:text-leafDk" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold leading-tight text-ink">{label}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{blurb}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-leafDk opacity-0 transition-opacity group-hover:opacity-100">Entrar <ArrowUpRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Resumo({ eyebrow, titulo, icon, href, link, children }: { eyebrow: string; titulo: string; icon: React.ReactNode; href: string; link: string; children: React.ReactNode }) {
  return (
    <article className="card rounded-sm p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="eyebrow text-earth">{eyebrow}</span>
          <h3 className="mt-1 font-display text-xl font-semibold text-ink">{titulo}</h3>
        </div>
        {icon}
      </div>
      <dl className="mt-4 space-y-2 text-[13px]">{children}</dl>
      <Link href={href} className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-earth hover:text-ink">
        {link} <ArrowUpRight className="h-3 w-3" />
      </Link>
    </article>
  );
}

function Linha({ label, value, positive, strong }: { label: string; value: string; positive?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-rule/40 pb-1 last:border-b-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className={`num ${strong ? 'font-semibold' : ''} ${positive ? 'text-leafDk' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}

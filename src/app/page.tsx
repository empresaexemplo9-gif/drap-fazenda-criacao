'use client';

/**
 * Painel: "O que precisa da sua atenção hoje", no formato da interface do
 * sócio do DRAP Fazenda (pagamentos do dia + resumos compactos com link),
 * acrescido do que o pecuarista precisa ver ao acordar: manejo do dia,
 * prazos sanitários, carência, pasto, estoque e cabeças que não batem.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowUpRight, CalendarCheck, Wallet, Beef, Milk, Dna, TriangleAlert, Tractor, ListChecks, Scale, Plus, CircleCheck } from 'lucide-react';
import { useEstado, salvar, novoId } from '@/lib/store';
import { useHoje, useIndices, saudacao } from '@/lib/hooks';
import { brl, isoToBrDate, num } from '@/lib/format';
import { addDias } from '@/lib/datas';
import { posicao } from '@/lib/domain/livro-razao';
import { sugestoes, sugestaoParaEvento, atrasados } from '@/lib/domain/calendario';
import { carenciasAtivas, lotacaoPiquetes, conciliarCabecas, uaDe, pesoAtual, ativos, gmdGrupo } from '@/lib/domain/rebanho';
import { situacaoQualidade, taxaPrenhez } from '@/lib/domain/leite';
import { previsaoRuptura } from '@/lib/domain/estoque';
import { custoPorLote, resumoCustos } from '@/lib/domain/custos';
import { relacaoTroca } from '@/lib/domain/simulador';
import { moduloAtivo, perfilDe } from '@/lib/domain/modulos';
import { ROTAS } from '@/lib/rotas';
import { ROT_EVENTO, TOM_EVENTO } from '@/lib/rotulos';
import { Badge, Em, cx } from '@/components/ui';
import { ICONES } from '@/components/icones';

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
    const doAt = (at: string) => vivos.filter((a) => a.loteId && ix.lote.get(a.loteId)?.atividade === at);
    const corteAnimais = doAt('corte');
    const vacasLact = vivos.filter((a) => a.loteId && ix.lote.get(a.loteId)?.fase === 'lactacao');
    const ini7 = addDias(hoje, -6);
    const leite7 = e.ordenhas.filter((o) => o.data >= ini7 && !o.descartado).reduce((s, o) => s + o.litros, 0) / 7;
    const genIds = new Set(doAt('genetica').map((a) => a.id));
    const avals = new Map(e.avaliacoes.filter((v) => genIds.has(v.animalId)).map((v) => [v.animalId, v]));
    const tp = taxaPrenhez(e.reproducao.filter((r) => genIds.has(r.animalId)), addDias(hoje, -365), hoje);
    return {
      corte: { cab: corteAnimais.length, gmd: gmdGrupo(corteAnimais.map((a) => a.id), ix.pesagens, addDias(hoje, -120), hoje) },
      vacas: vacasLact.length, leite7, qual: situacaoQualidade(e.analisesLeite, hoje),
      gen: { avaliados: avals.size, top10: [...avals.values()].filter((v) => (v.top ?? 100) <= 10).length, prenhez: tp.taxa, doses: e.estoqueGenetico.reduce((s, x) => s + x.doses, 0) },
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

  const nHoje = d.eventosHoje.length + d.sugsHoje.length;
  const sinal = d.pos.liquido < 0 ? '−' : d.pos.liquido > 0 ? '+' : '';

  return (
    <div>
      <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <span className="eyebrow text-earth">{saudacao()} · {operador?.nome.split(' ')[0] ?? 'bem-vindo'} · {perfilDe(e.modulos)?.nome}</span>
          <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            O que <Em tom="earth">precisa da sua atenção</Em> hoje.
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
            Manejo do dia, pagamentos, prazos sanitários e o panorama do rebanho num lugar só, mesmo sem sinal.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <Link href="/manejo/" className="btn btn-ghost"><Scale className="h-4 w-4" strokeWidth={1.75} /> Abrir manejo</Link>
          <Link href="/lancamentos/" className="btn btn-primary"><Plus className="h-4 w-4" strokeWidth={2} /> Lançamento</Link>
        </div>
      </section>

      {/* ===== INDICADORES ===== */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <Indicador label="Rebanho" valor={`${d.vivos}`} unidade="cabeças" hint={`${num(d.ua, 1)} UA no pasto`} icon={<Beef className="h-[18px] w-[18px]" strokeWidth={1.75} />} href="/rebanho/" />
        <Indicador label="Lotação média" valor={num(d.uaHa)} unidade="UA/ha" hint={d.superlotados.length ? `${d.superlotados.length} piquete(s) superlotado(s)` : 'Dentro da capacidade'} tone={d.superlotados.length ? 'alert' : undefined} icon={<Tractor className="h-[18px] w-[18px]" strokeWidth={1.75} />} href="/pastagens/" />
        <Indicador label="A pagar · 30 dias" valor={brl(d.pos.aPagar)} hint={`${brl(totalHoje)} vencidos até hoje`} tone={totalHoje > 0 ? 'warn' : undefined} icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} />} href="/posicao/" />
        <Indicador label="A receber · 30 dias" valor={brl(d.pos.aReceber)} hint={`${d.pos.titulos.length} títulos em aberto`} tone="leaf" icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} />} href="/posicao/" />
        <Indicador label="Líquido · 30 dias" valor={`${sinal}${brl(Math.abs(d.pos.liquido))}`} hint="Receber menos pagar" tone={d.pos.liquido < 0 ? 'alert' : 'leaf'} icon={<ListChecks className="h-[18px] w-[18px]" strokeWidth={1.75} />} href="/posicao/" />
        <Indicador label="Pendências" valor={`${atencao}`} unidade={atencao === 1 ? 'alerta' : 'alertas'} hint={atencao ? `${d.atras.length} em atraso na agenda` : 'Tudo em dia'} tone={atencao ? 'alert' : 'leaf'} icon={<TriangleAlert className="h-[18px] w-[18px]" strokeWidth={1.75} />} href="/agenda/" />
      </section>

      {/* ===== HOJE ===== */}
      <section className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <article className="card flex flex-col overflow-hidden rounded-xl">
          <header className="flex items-center justify-between gap-3 border-b border-rule/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-leafLt/70 text-leafDk"><CalendarCheck className="h-5 w-5" strokeWidth={1.75} /></span>
              <div>
                <span className="eyebrow">Hoje · {isoToBrDate(hoje)}</span>
                <h2 className="font-sans text-[17px] font-bold tracking-tight text-ink">Pagamentos do dia</h2>
              </div>
            </div>
            <span className="num rounded-full bg-leafLt/70 px-3 py-1 text-[15px] font-bold text-leafDk">{d.pagarHoje.length}</span>
          </header>
          {d.pagarHoje.length === 0 ? (
            <Vazio>Nada vence hoje.</Vazio>
          ) : (
            <ul className="divide-y divide-rule/40">
              {d.pagarHoje.map((t) => (
                <li key={t.lancamento.id} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-paper/50">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-ink">{t.lancamento.historico}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                      <span className="num">{isoToBrDate(t.vencimento)}</span>
                      {t.lancamento.fornecedor ? <><span aria-hidden>·</span><span className="truncate">{t.lancamento.fornecedor}</span></> : null}
                      {t.atrasado ? <Badge tone="alert">atrasado</Badge> : null}
                      {t.tipo === 'receber' ? <Badge tone="leaf">a receber</Badge> : null}
                    </div>
                  </div>
                  <span className={`num whitespace-nowrap text-[15.5px] font-bold ${t.tipo === 'receber' ? 'text-leafDk' : 'text-ink'}`}>{brl(t.lancamento.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          <footer className="mt-auto flex items-center justify-between border-t border-rule/50 bg-paper/50 px-5 py-3 text-[12.5px]">
            <span className="text-muted">Total a pagar até hoje <span className="num ml-1 font-bold text-ink">{brl(totalHoje)}</span></span>
            <Link href="/posicao/" className="inline-flex items-center gap-1 font-semibold text-leafDk hover:text-leaf">Posição <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </footer>
        </article>

        <article className="card flex flex-col overflow-hidden rounded-xl">
          <header className="flex items-center justify-between gap-3 border-b border-rule/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-earthLt/70 text-earth"><Scale className="h-5 w-5" strokeWidth={1.75} /></span>
              <div>
                <span className="eyebrow">Hoje · campo</span>
                <h2 className="font-sans text-[17px] font-bold tracking-tight text-ink">Manejo e prazos</h2>
              </div>
            </div>
            <span className="num rounded-full bg-earthLt/70 px-3 py-1 text-[15px] font-bold text-earth">{nHoje}</span>
          </header>
          {nHoje === 0 ? (
            <Vazio>Sem manejo marcado para hoje.</Vazio>
          ) : (
            <ul className="divide-y divide-rule/40">
              {d.eventosHoje.map((ev) => (
                <li key={ev.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-2"><Badge tone={TOM_EVENTO[ev.tipo]}>{ROT_EVENTO[ev.tipo]}</Badge></div>
                  <p className="mt-1.5 text-[14.5px] font-semibold">{ev.titulo}</p>
                  {ev.obs ? <p className="mt-0.5 text-[12.5px] text-muted">{ev.obs}</p> : null}
                </li>
              ))}
              {d.sugsHoje.slice(0, 5).map((s) => (
                <li key={s.regra} className="flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-paper/50">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TOM_EVENTO[s.tipo]}>{ROT_EVENTO[s.tipo]}</Badge>
                      {s.obrigatorio ? <Badge tone="alert">obrigatório</Badge> : null}
                      <span className="text-[11.5px] text-muted">sugerido</span>
                    </div>
                    <p className="mt-1.5 text-[14.5px] font-semibold">{s.titulo}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{s.detalhe}</p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm flex-shrink-0" onClick={() => salvar('eventos', sugestaoParaEvento(s, novoId('e')))}>Agendar</button>
                </li>
              ))}
            </ul>
          )}
          <footer className="mt-auto flex items-center justify-between border-t border-rule/50 bg-paper/50 px-5 py-3 text-[12.5px]">
            <span className="text-muted">{d.sugs.length} sugestões nos próximos 30 dias</span>
            <Link href="/agenda/" className="inline-flex items-center gap-1 font-semibold text-leafDk hover:text-leaf">Agenda <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </footer>
        </article>

        {/* ===== ATENÇÃO ===== */}
        <article className="card flex flex-col overflow-hidden rounded-xl lg:col-span-2 2xl:col-span-1">
          <header className="flex items-center justify-between gap-3 border-b border-rule/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className={cx('flex h-10 w-10 items-center justify-center rounded-lg', atencao ? 'bg-alertLt/70 text-alert' : 'bg-leafLt/70 text-leafDk')}>
                {atencao ? <TriangleAlert className="h-5 w-5" strokeWidth={1.75} /> : <CircleCheck className="h-5 w-5" strokeWidth={1.75} />}
              </span>
              <div>
                <span className={cx('eyebrow', atencao ? 'text-alert' : '')}>Pendências</span>
                <h2 className="font-sans text-[17px] font-bold tracking-tight text-ink">Atenção</h2>
              </div>
            </div>
            <span className={cx('num rounded-full px-3 py-1 text-[15px] font-bold', atencao ? 'bg-alertLt/70 text-alert' : 'bg-leafLt/70 text-leafDk')}>{atencao}</span>
          </header>
          {atencao === 0 ? <Vazio>Nenhuma pendência. Tudo em dia.</Vazio> : (
            <ul className="divide-y divide-rule/40 text-[13.5px]">
              {d.atras.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0"><span className="num mr-2.5 rounded-md bg-alertLt/60 px-1.5 py-0.5 text-[12px] font-semibold text-alert">{isoToBrDate(ev.data).slice(0, 5)}</span>{ev.titulo}</span>
                  <Link href="/agenda/" className="whitespace-nowrap text-[12.5px] font-semibold text-earth hover:text-ink">em atraso</Link>
                </li>
              ))}
              {d.conc.map((c) => (
                <li key={c.lote.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span><strong className="font-semibold">{c.lote.nome}</strong>: contagem física <span className="num">{c.fisica}</span> × sistema <span className="num">{c.sistema}</span></span>
                  <Link href="/rebanho/?aba=conciliacao" className="num whitespace-nowrap text-[12.5px] font-bold text-alert">{c.diferenca! > 0 ? '+' : ''}{c.diferenca} cab</Link>
                </li>
              ))}
              {d.carencias.length ? (
                <li className="flex items-center justify-between gap-3 px-5 py-3">
                  <span><span className="num font-bold">{d.carencias.length}</span> animal(is) em carência: não embarcar para abate{d.carencias.some((c) => c.bloqueiaLeite) ? ' e descartar o leite' : ''}</span>
                  <Link href="/sanidade/" className="whitespace-nowrap text-[12.5px] font-semibold text-earth hover:text-ink">ver lista</Link>
                </li>
              ) : null}
              {d.superlotados.map((p) => (
                <li key={p.piquete.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span><strong className="font-semibold">{p.piquete.nome}</strong> superlotado: <span className="num">{num(p.uaHa)}</span> UA/ha para capacidade de <span className="num">{num(p.piquete.capacidadeUAha)}</span></span>
                  <Link href="/pastagens/" className="whitespace-nowrap text-[12.5px] font-semibold text-earth hover:text-ink">pastagens</Link>
                </li>
              ))}
              {d.estoque.map((s) => (
                <li key={s.insumo.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span><strong className="font-semibold">{s.insumo.nome}</strong>: {s.diasCobertura != null ? <>dura <span className="num">{Math.floor(s.diasCobertura)}</span> dias</> : 'abaixo do mínimo'}</span>
                  <Link href="/estoque/" className="whitespace-nowrap text-[12.5px] font-semibold text-earth hover:text-ink">estoque</Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      {/* ===== RESUMOS ===== */}
      <Secao titulo="Panorama da fazenda" />
      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr))]">
        <Resumo eyebrow="Rebanho" titulo={`${d.vivos} cabeças`} icon={<Beef className="h-5 w-5" strokeWidth={1.75} />} href="/rebanho/" link="Ver rebanho">
          {d.porAtividade.filter((x) => moduloAtivo(e.modulos, x.at)).map((x) => <Linha key={x.at} label={x.at === 'corte' ? 'Corte' : x.at === 'leite' ? 'Leite' : 'Genética'} value={`${x.n} cab`} />)}
          <Linha label="Unidades animais" value={`${num(d.ua, 1)} UA`} />
          <Linha label="Lotação média" value={`${num(d.uaHa)} UA/ha`} strong />
        </Resumo>
        <Resumo eyebrow="Posição · 30 dias" titulo={`${d.pos.titulos.length} títulos em aberto`} icon={<Wallet className="h-5 w-5" strokeWidth={1.75} />} href="/posicao/" link="Ver posição completa">
          <Linha label="A pagar" value={brl(d.pos.aPagar)} />
          <Linha label="A receber" value={brl(d.pos.aReceber)} positive />
          <Linha label="Líquido" value={`${sinal}${brl(Math.abs(d.pos.liquido))}`} strong />
        </Resumo>
        {moduloAtivo(e.modulos, 'corte') ? (
          <Resumo eyebrow="Módulo Corte" titulo={`${d.corte.cab} cabeças`} icon={<Tractor className="h-5 w-5" strokeWidth={1.75} />} href="/corte/" link="Abrir Corte">
            <Linha label="GMD · 120 dias" value={d.corte.gmd != null ? `${num(d.corte.gmd, 3)} kg/d` : '—'} />
            <Linha label="Custo da @ produzida · 90 d" value={corte?.custoArroba != null ? brl(corte.custoArroba) : '—'} strong />
            {d.boi ? <Linha label="Boi gordo" value={`${brl(d.boi.valor)}/@`} positive /> : null}
            {d.troca != null ? <Linha label="Relação de troca" value={`${num(d.troca)} bezerros`} /> : null}
          </Resumo>
        ) : null}
        {moduloAtivo(e.modulos, 'leite') ? (
          <Resumo eyebrow="Módulo Leite" titulo={`${num(d.leite7, 0)} L/dia no tanque`} icon={<Milk className="h-5 w-5" strokeWidth={1.75} />} href="/leite/" link="Abrir Leite">
            <Linha label="Vacas em lactação" value={`${d.vacas}`} />
            <Linha label="CCS · média 3 meses" value={d.qual.ccsMg != null ? `${num(d.qual.ccsMg, 0)} mil` : '—'} />
            <Linha label="Custo do litro · 90 d" value={leiteR?.custoLitro != null ? brl(leiteR.custoLitro) : '—'} strong />
            {d.leite ? <Linha label="Preço do litro" value={brl(d.leite.valor)} positive /> : null}
          </Resumo>
        ) : null}
        {moduloAtivo(e.modulos, 'genetica') ? (
          <Resumo eyebrow="Módulo Genética" titulo={`${d.gen.avaliados} animais avaliados`} icon={<Dna className="h-5 w-5" strokeWidth={1.75} />} href="/genetica/" link="Abrir Genética">
            <Linha label="TOP 10%" value={`${d.gen.top10}`} />
            <Linha label="Taxa de prenhez · 12 m" value={d.gen.prenhez != null ? `${num(d.gen.prenhez, 1)}%` : '—'} strong />
            <Linha label="Doses e embriões no botijão" value={`${d.gen.doses}`} />
          </Resumo>
        ) : null}
      </section>

      {/* ===== ATALHOS ===== */}
      <Secao titulo="Acesso rápido" sub="Núcleo e módulos contratados" />
      <section className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))]">
        {rotas.map(({ href, label, blurb }) => {
          const Icon = ICONES[href] ?? ListChecks;
          return (
            <Link key={href} href={href} className="card group flex items-start gap-3.5 rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:border-leaf/50 hover:shadow-[0_1px_2px_rgba(21,26,20,0.05),0_16px_32px_-20px_rgba(47,74,39,0.35)]">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-paper text-earth transition-colors group-hover:bg-leafLt group-hover:text-leafDk">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[14.5px] font-bold text-ink">{label}<ArrowUpRight className="h-3.5 w-3.5 text-leafDk opacity-0 transition-opacity group-hover:opacity-100" /></span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{blurb}</span>
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

function Secao({ titulo, sub }: { titulo: string; sub?: string }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline gap-3">
      <h2 className="font-sans text-[15px] font-bold tracking-tight text-ink">{titulo}</h2>
      {sub ? <span className="text-[12.5px] text-muted">{sub}</span> : null}
      <span className="h-px flex-1 self-center bg-rule/60" aria-hidden />
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="flex items-center gap-2 px-5 py-8 text-[13.5px] text-muted"><CircleCheck className="h-4 w-4 text-leaf" strokeWidth={1.75} />{children}</p>;
}

function Indicador({ label, valor, unidade, hint, icon, href, tone }: {
  label: string; valor: string; unidade?: string; hint: string; icon: React.ReactNode; href: string; tone?: 'leaf' | 'alert' | 'warn';
}) {
  const cor = tone === 'leaf' ? 'text-leafDk' : tone === 'alert' ? 'text-alert' : 'text-ink';
  const chip = tone === 'leaf' ? 'bg-leafLt/70 text-leafDk' : tone === 'alert' ? 'bg-alertLt/70 text-alert' : tone === 'warn' ? 'bg-warnLt/80 text-warn' : 'bg-paper text-earth';
  return (
    <Link href={href} className="card group flex min-w-0 flex-col gap-3 rounded-xl p-4 transition-colors hover:border-leaf/50 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-semibold text-muted">{label}</span>
        <span className={cx('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', chip)}>{icon}</span>
      </div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className={cx('num truncate text-[22px] font-bold leading-none tracking-tight sm:text-[26px]', cor)}>{valor}</span>
        {unidade ? <span className="text-[12.5px] font-medium text-muted">{unidade}</span> : null}
      </div>
      <span className="truncate text-[12px] text-muted">{hint}</span>
    </Link>
  );
}

function Resumo({ eyebrow, titulo, icon, href, link, children }: { eyebrow: string; titulo: string; icon: React.ReactNode; href: string; link: string; children: React.ReactNode }) {
  return (
    <article className="card flex flex-col rounded-xl p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-paper text-earth">{icon}</span>
        <div className="min-w-0">
          <span className="eyebrow">{eyebrow}</span>
          <h3 className="truncate font-sans text-[17px] font-bold tracking-tight text-ink">{titulo}</h3>
        </div>
      </div>
      <dl className="mt-4 text-[13.5px]">{children}</dl>
      <Link href={href} className="mt-auto inline-flex items-center gap-1 pt-4 text-[12.5px] font-semibold text-leafDk hover:text-leaf">
        {link} <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

function Linha({ label, value, positive, strong }: { label: string; value: string; positive?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-rule/40 py-2 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className={`num ${strong ? 'font-bold' : 'font-medium'} ${positive ? 'text-leafDk' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}

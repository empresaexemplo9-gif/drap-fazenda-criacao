'use client';

/**
 * Agenda: o mesmo fluxo do DRAP Fazenda (lembrete rápido com data e tipo,
 * concluir, atraso em vermelho, concluídos recolhidos) com a grade mensal
 * e as sugestões automáticas do calendário sanitário, reprodutivo,
 * financeiro e de documentos.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, CalendarDays } from 'lucide-react';
import { useEstado, salvar, atualizar, remover, novoId } from '@/lib/store';
import { useHoje } from '@/lib/hooks';
import { isoToBrDate, isoToBrShort } from '@/lib/format';
import { addMeses, rotuloMes, mesDe } from '@/lib/datas';
import { sugestoes, sugestaoParaEvento, gradeMes, atrasados } from '@/lib/domain/calendario';
import { ROT_EVENTO, TOM_EVENTO, opcoes } from '@/lib/rotulos';
import type { TipoEvento } from '@/lib/domain/types';
import { PageHeader, Em, Card, Badge, Tabs, cx, Empty } from '@/components/ui';

const COR_PONTO: Record<string, string> = { leaf: 'bg-leaf', earth: 'bg-earth', alert: 'bg-alert', warn: 'bg-warn', neutral: 'bg-muted', ink: 'bg-ink' };

export default function AgendaPage() {
  const e = useEstado();
  const hoje = useHoje();
  const [mes, setMes] = useState(mesDe(hoje));
  const [dia, setDia] = useState<string>(hoje);
  const [aba, setAba] = useState<'lista' | 'mes'>('lista');
  const [filtro, setFiltro] = useState<TipoEvento | ''>('');
  const [novo, setNovo] = useState({ titulo: '', data: hoje, tipo: 'geral' as TipoEvento });

  const sugs = useMemo(() => sugestoes(e, hoje, 120), [e, hoje]);
  const eventos = e.eventos.filter((ev) => !filtro || ev.tipo === filtro);
  const sugsF = sugs.filter((s) => !filtro || s.tipo === filtro);
  const grade = gradeMes(mes, eventos, sugsF);
  const pendentes = eventos.filter((ev) => !ev.concluido).sort((a, b) => a.data.localeCompare(b.data));
  const feitos = eventos.filter((ev) => ev.concluido).sort((a, b) => b.data.localeCompare(a.data));
  const atras = atrasados(eventos, hoje);

  function adicionar() {
    if (!novo.titulo.trim()) return;
    salvar('eventos', { id: novoId('e'), titulo: novo.titulo.trim(), data: novo.data, tipo: novo.tipo, concluido: false });
    setNovo({ titulo: '', data: novo.data, tipo: novo.tipo });
  }

  const doDia = { eventos: eventos.filter((ev) => ev.data === dia), sugs: sugsF.filter((s) => s.data === dia) };

  return (
    <>
      <PageHeader eyebrow="V · Agenda" title={<>O calendário <Em>da fazenda inteira</Em></>}
        sub="Vacinas, partos, secagens, pagamentos, GTA e ITR no mesmo calendário. As sugestões vêm do rebanho; agende para virarem tarefa." />

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-sm border border-rule bg-bone p-3">
        <input className="field-input min-w-0 flex-1 py-1.5" placeholder="Novo lembrete…" value={novo.titulo}
          onChange={(ev) => setNovo({ ...novo, titulo: ev.target.value })} onKeyDown={(ev) => { if (ev.key === 'Enter') adicionar(); }} aria-label="Título do lembrete" />
        <input type="date" className="field-input w-auto py-1.5" value={novo.data} onChange={(ev) => setNovo({ ...novo, data: ev.target.value })} aria-label="Data" />
        <select className="field-input w-auto py-1.5" value={novo.tipo} onChange={(ev) => setNovo({ ...novo, tipo: ev.target.value as TipoEvento })} aria-label="Tipo">
          {opcoes(ROT_EVENTO).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={adicionar} disabled={!novo.titulo.trim()} className="btn btn-leaf btn-sm"><Plus className="h-4 w-4" /> Adicionar</button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<'lista' | 'mes'> ativa={aba} onChange={setAba} abas={[{ id: 'lista', label: 'Lista', badge: pendentes.length }, { id: 'mes', label: 'Mês' }]} />
        <select className="field-input w-auto py-1 text-[13px]" value={filtro} onChange={(ev) => setFiltro(ev.target.value as TipoEvento | '')} aria-label="Filtrar por tipo">
          <option value="">Todos os tipos</option>
          {opcoes(ROT_EVENTO).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {aba === 'lista' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card eyebrow={atras.length ? `${atras.length} em atraso` : 'Pendentes'} title="Tarefas agendadas" tone={atras.length ? 'alert' : undefined}>
            {pendentes.length === 0 ? <Empty>Nada pendente.</Empty> : (
              <ul className="space-y-1.5">
                {pendentes.map((ev) => {
                  const atrasado = ev.data < hoje;
                  return (
                    <li key={ev.id} className="flex items-center gap-3 rounded-sm border border-rule/60 bg-white/50 px-3 py-2">
                      <button onClick={() => atualizar('eventos', ev.id, { concluido: true })} title="Concluir" aria-label={`Concluir ${ev.titulo}`}
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-ink/30 text-transparent transition-colors hover:border-leafDk hover:text-leafDk"><Check size={12} /></button>
                      <span className={cx('num w-11 flex-shrink-0 text-xs', atrasado ? 'font-semibold text-alert' : 'text-muted')}>{isoToBrShort(ev.data)}</span>
                      <span className="min-w-0 flex-1 text-sm">{ev.titulo}{ev.obs ? <span className="block truncate text-[11.5px] text-muted">{ev.obs}</span> : null}</span>
                      <Badge tone={TOM_EVENTO[ev.tipo]}>{ROT_EVENTO[ev.tipo]}</Badge>
                      <button onClick={() => remover('eventos', ev.id)} className="text-muted hover:text-alert" aria-label="Excluir"><Trash2 size={13} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            {feitos.length > 0 && (
              <details className="mt-4 text-sm text-muted">
                <summary className="cursor-pointer">Concluídos ({feitos.length})</summary>
                <ul className="mt-2 space-y-1">
                  {feitos.map((ev) => (
                    <li key={ev.id} className="flex items-center gap-3 rounded-sm px-3 py-1.5 line-through">
                      <button onClick={() => atualizar('eventos', ev.id, { concluido: false })} title="Reabrir" className="flex h-5 w-5 items-center justify-center rounded border border-leafDk bg-leafLt text-leafDk"><Check size={12} /></button>
                      <span className="num text-xs">{isoToBrShort(ev.data)}</span>
                      <span className="min-w-0 flex-1 truncate">{ev.titulo}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>

          <Card eyebrow="Calculado pelo sistema" title={`${sugsF.length} sugestões · 120 dias`}>
            {sugsF.length === 0 ? <Empty>Sem sugestões.</Empty> : (
              <ul className="divide-y divide-rule/40">
                {sugsF.slice(0, 40).map((s) => (
                  <li key={s.regra} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cx('num text-[11.5px]', s.data <= hoje ? 'font-semibold text-alert' : 'text-earth')}>{isoToBrDate(s.data)}</span>
                        <Badge tone={TOM_EVENTO[s.tipo]}>{ROT_EVENTO[s.tipo]}</Badge>
                        {s.obrigatorio ? <Badge tone="alert">obrigatório</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[14px] font-medium">{s.titulo}</p>
                      <p className="text-[12px] leading-snug text-muted">{s.detalhe}</p>
                    </div>
                    <button className="btn btn-ghost btn-sm flex-shrink-0" onClick={() => salvar('eventos', sugestaoParaEvento(s, novoId('e')))}>Agendar</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {aba === 'mes' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2" pad={false}>
            <div className="flex items-center justify-between border-b border-rule/60 px-5 py-3">
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm hover:bg-rule/40" onClick={() => setMes(mesDe(addMeses(`${mes}-01`, -1)))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
              <h2 className="font-display text-xl font-semibold capitalize">{rotuloMes(mes, true)}</h2>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm hover:bg-rule/40" onClick={() => setMes(mesDe(addMeses(`${mes}-01`, 1)))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-rule/60 text-center">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="eyebrow py-2 text-muted">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {grade.flat().map((d) => {
                const itens = [...d.eventos.map((ev) => ({ k: ev.id, tom: TOM_EVENTO[ev.tipo], t: ev.titulo, feito: ev.concluido })), ...d.sugestoes.map((s) => ({ k: s.regra, tom: TOM_EVENTO[s.tipo], t: s.titulo, feito: false, sug: true }))];
                return (
                  <button key={d.data} type="button" onClick={() => setDia(d.data)}
                    className={cx('min-h-[4.5rem] border-b border-r border-rule/40 p-1.5 text-left align-top transition-colors sm:min-h-[6rem]',
                      !d.doMes && 'bg-paper/60 text-muted/60', d.data === dia && 'bg-leafLt/60', d.data === hoje && 'ring-1 ring-inset ring-leaf')}>
                    <span className={cx('num text-[12px]', d.data === hoje && 'font-semibold text-leafDk')}>{Number(d.data.slice(8))}</span>
                    <div className="mt-1 hidden space-y-0.5 sm:block">
                      {itens.slice(0, 3).map((it) => (
                        <div key={it.k} className={cx('truncate text-[10.5px] leading-tight', it.feito && 'line-through opacity-50', 'sug' in it && 'italic text-muted')}>
                          <span className={cx('mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle', COR_PONTO[it.tom])} />{it.t}
                        </div>
                      ))}
                      {itens.length > 3 ? <div className="text-[10px] text-muted">+{itens.length - 3}</div> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                      {itens.slice(0, 4).map((it) => <span key={it.k} className={cx('h-1.5 w-1.5 rounded-full', COR_PONTO[it.tom])} />)}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
          <Card eyebrow={isoToBrDate(dia)} title="Neste dia" icon={<CalendarDays className="h-5 w-5" strokeWidth={1.5} />}>
            {doDia.eventos.length + doDia.sugs.length === 0 ? <Empty>Nada neste dia.</Empty> : (
              <ul className="space-y-3">
                {doDia.eventos.map((ev) => (
                  <li key={ev.id} className="text-[13.5px]">
                    <Badge tone={TOM_EVENTO[ev.tipo]}>{ROT_EVENTO[ev.tipo]}</Badge> {ev.concluido ? <Badge tone="leaf">feito</Badge> : null}
                    <p className="mt-1 font-medium">{ev.titulo}</p>
                    {ev.obs ? <p className="text-[12px] text-muted">{ev.obs}</p> : null}
                    {!ev.concluido ? <button className="mt-1 text-[12px] font-medium text-earth hover:text-ink" onClick={() => atualizar('eventos', ev.id, { concluido: true })}>Concluir</button> : null}
                  </li>
                ))}
                {doDia.sugs.map((s) => (
                  <li key={s.regra} className="text-[13.5px]">
                    <Badge tone={TOM_EVENTO[s.tipo]}>{ROT_EVENTO[s.tipo]}</Badge> <span className="text-[11px] italic text-muted">sugestão</span>
                    <p className="mt-1 font-medium">{s.titulo}</p>
                    <p className="text-[12px] text-muted">{s.detalhe}</p>
                    <button className="mt-1 text-[12px] font-medium text-earth hover:text-ink" onClick={() => salvar('eventos', sugestaoParaEvento(s, novoId('e')))}>Agendar</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

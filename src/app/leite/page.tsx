'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useEstado, salvar, salvarVarios, novoId, atualizar } from '@/lib/store';
import { useHoje, useIndices } from '@/lib/hooks';
import { brl, num, isoToBrDate, isoToBrShort } from '@/lib/format';
import { addDias, idadeMeses } from '@/lib/datas';
import {
  producaoPorVaca, curvaLactacao, situacaoQualidade, precoLitro, mastitesEmCarencia, intervaloEntrePartos, taxaPrenhez, LIMITE_CBT, LIMITE_CCS, del,
} from '@/lib/domain/leite';
import { sugestoes } from '@/lib/domain/calendario';
import { animaisDoLote, gmd, pesoAtual, carenciasAtivas } from '@/lib/domain/rebanho';
import { custoPorLote, resumoCustos } from '@/lib/domain/custos';
import { moduloAtivo } from '@/lib/domain/modulos';
import type { CasoMastite, Ordenha } from '@/lib/domain/types';
import { NovoEventoRepro } from '@/components/repro-form';
import { PageHeader, Em, Card, Tabs, Tabela, Badge, Field, Input, Select, Modal, StatGrid, Stat, Aviso, Empty, cx } from '@/components/ui';
import { Linha } from '@/components/graficos';

type Aba = 'producao' | 'ordenha' | 'qualidade' | 'mastite' | 'reproducao' | 'bezerras' | 'rentabilidade';

export default function LeitePage() {
  const e = useEstado();
  const [aba, setAba] = useState<Aba>('producao');
  if (!moduloAtivo(e.modulos, 'leite')) return <Empty>Módulo Leite não contratado. Ative em <Link href="/config/" className="text-earth underline">Configurações</Link>.</Empty>;
  return (
    <>
      <PageHeader eyebrow="XIV · Módulo Leite" title={<>Litro por vaca, <Em>qualidade antes do fechamento</Em></>}
        sub="Produção individual, curva de lactação, CCS/CBT contra a IN 76, mastite com descarte em carência, reprodução e o custo do litro contra a tabela do laticínio." />
      <Tabs<Aba> ativa={aba} onChange={setAba} abas={[
        { id: 'producao', label: 'Produção' }, { id: 'ordenha', label: 'Lançar ordenha' }, { id: 'qualidade', label: 'Qualidade' },
        { id: 'mastite', label: 'Mastite' }, { id: 'reproducao', label: 'Reprodução' }, { id: 'bezerras', label: 'Bezerras e novilhas' }, { id: 'rentabilidade', label: 'Rentabilidade' },
      ]} />
      {aba === 'producao' && <Producao />}
      {aba === 'ordenha' && <LancarOrdenha />}
      {aba === 'qualidade' && <Qualidade />}
      {aba === 'mastite' && <Mastite />}
      {aba === 'reproducao' && <Reproducao />}
      {aba === 'bezerras' && <Bezerras />}
      {aba === 'rentabilidade' && <Rentabilidade />}
    </>
  );
}

function vacasEmLactacao(e: ReturnType<typeof useEstado>) {
  const lotes = e.lotes.filter((l) => l.atividade === 'leite' && l.fase === 'lactacao');
  return lotes.flatMap((l) => animaisDoLote(e.animais, l.id));
}

function Producao() {
  const e = useEstado();
  const hoje = useHoje();
  const de = addDias(hoje, -29);
  const vacas = vacasEmLactacao(e);
  const prod = useMemo(() => producaoPorVaca(vacas, e.ordenhas, e.reproducao, de, hoje).sort((a, b) => b.mediaDia - a.mediaDia), [vacas, e.ordenhas, e.reproducao, de, hoje]);
  const curva = useMemo(() => curvaLactacao(e.ordenhas, e.reproducao), [e.ordenhas, e.reproducao]);
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of e.ordenhas) if (o.data >= de && !o.descartado) m.set(o.data, (m.get(o.data) ?? 0) + o.litros);
    return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y }));
  }, [e.ordenhas, de]);
  const total = prod.reduce((s, p) => s + p.totalPeriodo, 0);
  const desc = prod.reduce((s, p) => s + p.descartado, 0);
  const improd = prod.filter((p) => p.improdutiva);
  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="Vacas em lactação" value={vacas.length} />
        <Stat label="Litros · 30 dias" value={num(total, 0)} tone="leaf" hint={`${num(total / 30, 0)} L/dia no tanque`} />
        <Stat label="Média por vaca" value={`${num(vacas.length ? total / 30 / vacas.length : 0, 1)} L/d`} />
        <Stat label="Leite descartado" value={`${num(desc, 0)} L`} tone={desc ? 'alert' : undefined} hint="carência e mastite" />
      </StatGrid>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card eyebrow="Tanque" title="Litros por dia · 30 dias"><Linha pontos={porDia} formatar={(v) => `${num(v, 0)} L`} rotuloX={(x) => isoToBrShort(x)} desdeZero /></Card>
        <Card eyebrow="Rebanho" title="Curva de lactação (L/dia por DEL)"><Linha pontos={curva.map((c) => ({ x: String(c.faixa), y: c.litros }))} formatar={(v) => `${num(v, 1)} L`} rotuloX={(x) => `${x} d`} cor="#7A5C3B" desdeZero /></Card>
      </div>
      {improd.length ? (
        <Aviso tone="warn" titulo={`${improd.length} vaca(s) improdutiva(s)`}>
          {improd.map((p) => <span key={p.animal.id} className="mr-3 inline-block"><Link href={`/animal/?id=${p.animal.id}`} className="num font-semibold">{p.animal.brinco}</Link> {p.motivo}</span>)}
          <div className="mt-1 text-[12px] text-muted">Avaliar descarte ou secagem: cada vaca vazia com baixa produção come o lucro das outras.</div>
        </Aviso>
      ) : null}
      <Card eyebrow="Individual" title="Produção por vaca">
        <Tabela>
          <thead><tr><th>Vaca</th><th className="r">DEL</th><th className="r">Média L/d</th><th className="r">Últimos 7 d</th><th className="r">Total 30 d</th><th className="r">Descartado</th><th></th></tr></thead>
          <tbody>{prod.map((p) => (
            <tr key={p.animal.id}>
              <td><Link href={`/animal/?id=${p.animal.id}`} className="num font-semibold hover:text-leaf">{p.animal.brinco}</Link> <span className="text-muted">{p.animal.nome}</span></td>
              <td className="r num">{p.del ?? '—'}</td><td className="r num font-semibold">{num(p.mediaDia, 1)}</td><td className="r num">{num(p.ultimos7, 1)}</td>
              <td className="r num">{num(p.totalPeriodo, 0)}</td><td className={cx('r num', p.descartado && 'text-alert')}>{p.descartado ? num(p.descartado, 0) : '—'}</td>
              <td>{p.improdutiva ? <Badge tone="warn">improdutiva</Badge> : null}</td>
            </tr>
          ))}</tbody>
        </Tabela>
      </Card>
    </div>
  );
}

function LancarOrdenha() {
  const e = useEstado();
  const hoje = useHoje();
  const [data, setData] = useState(hoje);
  const [turno, setTurno] = useState<Ordenha['turno']>('manha');
  const [vals, setVals] = useState<Record<string, string>>({});
  const vacas = vacasEmLactacao(e).sort((a, b) => a.brinco.localeCompare(b.brinco, 'pt-BR', { numeric: true }));
  const carLeite = new Set(carenciasAtivas(e.sanidade, data).filter((c) => c.bloqueiaLeite).map((c) => c.animalId));
  const mast = new Set(mastitesEmCarencia(e.mastites, data).map((m) => m.animalId));
  const ja = new Set(e.ordenhas.filter((o) => o.data === data && o.turno === turno).map((o) => o.animalId));
  const total = Object.values(vals).reduce((s, v) => s + (Number(v.replace(',', '.')) || 0), 0);
  function gravar() {
    const regs: Ordenha[] = [];
    for (const v of vacas) {
      const l = Number((vals[v.id] ?? '').replace(',', '.'));
      if (!(l > 0)) continue;
      regs.push({ id: novoId('od'), data, animalId: v.id, turno, litros: l, descartado: carLeite.has(v.id) || mast.has(v.id) });
    }
    if (regs.length) salvarVarios('ordenhas', regs);
    setVals({});
  }
  return (
    <Card eyebrow="Ordenha" title="Lançamento rápido por vaca">
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Data"><Input type="date" value={data} onChange={(ev) => setData(ev.target.value)} /></Field>
        <Field label="Turno"><Select value={turno} onChange={(ev) => setTurno(ev.target.value as Ordenha['turno'])} opcoes={[{ value: 'manha', label: 'Manhã' }, { value: 'tarde', label: 'Tarde' }, { value: 'noite', label: 'Noite' }]} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {vacas.map((v) => {
          const bloq = carLeite.has(v.id) || mast.has(v.id);
          return (
            <label key={v.id} className={cx('rounded-sm border px-3 py-2', bloq ? 'border-alert/40 bg-alertLt/40' : ja.has(v.id) ? 'border-leaf/40 bg-leafLt/40' : 'border-rule/60 bg-white/40')}>
              <span className="flex items-baseline justify-between text-[12px]"><span className="num font-semibold">{v.brinco}</span><span className="truncate text-muted">{v.nome}</span></span>
              <input inputMode="decimal" className="field-input num py-1 text-lg" value={vals[v.id] ?? ''} onChange={(ev) => setVals({ ...vals, [v.id]: ev.target.value })} placeholder="L" aria-label={`Litros da vaca ${v.brinco}`} />
              {bloq ? <span className="text-[10.5px] font-semibold uppercase text-alert">descartar</span> : ja.has(v.id) ? <span className="text-[10.5px] text-leafDk">já lançada</span> : null}
            </label>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-[13px] text-muted">Total do turno: <span className="num font-semibold text-ink">{num(total, 1)} L</span></span>
        <button className="btn btn-primary" onClick={gravar} disabled={total <= 0}>Gravar ordenha</button>
      </div>
      <p className="mt-3 text-[12px] text-muted">Vacas em carência de antibiótico ou mastite entram como leite descartado: não vão para o tanque nem para a receita.</p>
    </Card>
  );
}

function Qualidade() {
  const e = useEstado();
  const hoje = useHoje();
  const s = situacaoQualidade(e.analisesLeite, hoje);
  const ultima = [...e.analisesLeite].filter((a) => !a.animalId).sort((a, b) => a.data.localeCompare(b.data)).pop();
  const [sim, setSim] = useState({ ccs: String(ultima?.ccs ?? 300), cbt: String(ultima?.cbt ?? 60), g: String(ultima?.gordura ?? 3.5), p: String(ultima?.proteina ?? 3.2) });
  const n = (x: string) => Number(x.replace(',', '.')) || 0;
  const preco = precoLitro(e.tabelaLaticinio, { ccs: n(sim.ccs), cbt: n(sim.cbt), gordura: n(sim.g), proteina: n(sim.p) });
  const [nova, setNova] = useState(false);
  const serie = [...e.analisesLeite].filter((a) => !a.animalId).sort((a, b) => a.data.localeCompare(b.data));
  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="CCS · média geom. 3 m" value={s.ccsMg != null ? `${num(s.ccsMg, 0)} mil` : '—'} tone={s.ccsOk ? 'leaf' : 'alert'} hint={`limite IN 76: ${LIMITE_CCS} mil cél/mL`} />
        <Stat label="CBT · média geom. 3 m" value={s.cbtMg != null ? `${num(s.cbtMg, 0)} mil` : '—'} tone={s.cbtOk ? 'leaf' : 'alert'} hint={`limite IN 76: ${LIMITE_CBT} mil UFC/mL`} />
        <Stat label="Gordura" value={s.gordura != null ? `${num(s.gordura)}%` : '—'} />
        <Stat label="Proteína" value={s.proteina != null ? `${num(s.proteina)}%` : '—'} />
      </StatGrid>
      {!s.ccsOk || !s.cbtOk ? <Aviso tone="alert" titulo="Fora da IN 76">Média geométrica acima do limite: risco de suspensão da coleta pelo laticínio. Revisar pré e pós-dipping, linha de ordenha e resfriamento (4 °C em até 3 horas).</Aviso> : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card eyebrow="Tanque" title="CCS ao longo do tempo" actions={<button className="btn btn-ghost btn-sm" onClick={() => setNova(true)}><Plus className="h-3.5 w-3.5" /> Análise</button>}>
          <Linha pontos={serie.map((a) => ({ x: a.data, y: a.ccs }))} formatar={(v) => `${num(v, 0)} mil`} rotuloX={(x) => isoToBrShort(x)} referencia={{ y: LIMITE_CCS, rotulo: 'limite IN 76' }} cor="#7A5C3B" />
          <Tabela className="mt-3">
            <thead><tr><th>Data</th><th className="r">CCS</th><th className="r">CBT</th><th className="r">Gord.</th><th className="r">Prot.</th></tr></thead>
            <tbody>{[...serie].reverse().map((a) => <tr key={a.id}><td className="num">{isoToBrDate(a.data)}</td><td className={cx('r num', a.ccs > LIMITE_CCS && 'text-alert')}>{a.ccs}</td><td className={cx('r num', a.cbt > LIMITE_CBT && 'text-alert')}>{a.cbt}</td><td className="r num">{num(a.gordura)}</td><td className="r num">{num(a.proteina)}</td></tr>)}</tbody>
          </Tabela>
        </Card>
        <Card eyebrow={`Tabela · ${e.tabelaLaticinio.laticinio}`} title={`Preço previsto: ${brl(preco.preco)}/L`} tone="leaf">
          <div className="grid grid-cols-4 gap-3">
            <Field label="CCS"><Input inputMode="numeric" value={sim.ccs} onChange={(ev) => setSim({ ...sim, ccs: ev.target.value })} /></Field>
            <Field label="CBT"><Input inputMode="numeric" value={sim.cbt} onChange={(ev) => setSim({ ...sim, cbt: ev.target.value })} /></Field>
            <Field label="Gord. %"><Input inputMode="decimal" value={sim.g} onChange={(ev) => setSim({ ...sim, g: ev.target.value })} /></Field>
            <Field label="Prot. %"><Input inputMode="decimal" value={sim.p} onChange={(ev) => setSim({ ...sim, p: ev.target.value })} /></Field>
          </div>
          <dl className="mt-4 space-y-1.5 text-[13px]">
            {preco.detalhes.map((d) => <div key={d.item} className="flex justify-between border-b border-rule/40 pb-1"><dt className="text-muted">{d.item}</dt><dd className={cx('num', d.valor < 0 && 'text-alert')}>{d.valor >= 0 && d.item !== 'Preço base' ? '+' : ''}{brl(d.valor)}</dd></div>)}
          </dl>
          <p className="mt-3 text-[12px] text-muted">Simule antes do fechamento: baixar a CCS de 520 para 380 mil pode valer mais que um aumento do preço base.</p>
        </Card>
      </div>
      {nova ? <NovaAnalise onFechar={() => setNova(false)} /> : null}
    </div>
  );
}

function NovaAnalise({ onFechar }: { onFechar: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const [f, setF] = useState({ data: hoje, ccs: '', cbt: '', g: '', p: '' });
  const n = (x: string) => Number(x.replace(',', '.')) || 0;
  return (
    <Modal aberto onFechar={onFechar} titulo="Análise do tanque" eyebrow="Qualidade">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Data" className="col-span-2"><Input type="date" value={f.data} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Field>
        <Field label="CCS (mil cél/mL)"><Input inputMode="numeric" value={f.ccs} onChange={(ev) => setF({ ...f, ccs: ev.target.value })} /></Field>
        <Field label="CBT (mil UFC/mL)"><Input inputMode="numeric" value={f.cbt} onChange={(ev) => setF({ ...f, cbt: ev.target.value })} /></Field>
        <Field label="Gordura (%)"><Input inputMode="decimal" value={f.g} onChange={(ev) => setF({ ...f, g: ev.target.value })} /></Field>
        <Field label="Proteína (%)"><Input inputMode="decimal" value={f.p} onChange={(ev) => setF({ ...f, p: ev.target.value })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!n(f.ccs) || !n(f.cbt)} onClick={() => { salvar('analisesLeite', { id: novoId('al'), data: f.data, ccs: n(f.ccs), cbt: n(f.cbt), gordura: n(f.g), proteina: n(f.p), laticinio: e.tabelaLaticinio.laticinio }); onFechar(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

function Mastite() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const [novo, setNovo] = useState(false);
  const ativos = mastitesEmCarencia(e.mastites, hoje);
  const casos = [...e.mastites].sort((a, b) => b.data.localeCompare(a.data));
  const vacas = vacasEmLactacao(e);
  const de = addDias(hoje, -89);
  const clinicas90 = e.mastites.filter((m) => m.data >= de && m.grau !== 'subclinica').length;
  return (
    <div className="space-y-5">
      <StatGrid cols={3}>
        <Stat label="Em carência agora" value={ativos.length} tone={ativos.length ? 'alert' : 'leaf'} hint="leite dessas vacas vai para o descarte" />
        <Stat label="Casos clínicos · 90 d" value={clinicas90} />
        <Stat label="Incidência mensal" value={vacas.length ? `${num((clinicas90 / 3 / vacas.length) * 100, 1)}%` : '—'} hint="meta abaixo de 2% ao mês" />
      </StatGrid>
      <Card eyebrow="Sanidade do úbere" title="Casos de mastite" actions={<button className="btn btn-ghost btn-sm" onClick={() => setNovo(true)}><Plus className="h-3.5 w-3.5" /> Caso</button>}>
        {casos.length === 0 ? <Empty>Nenhum caso registrado.</Empty> : (
          <Tabela>
            <thead><tr><th>Data</th><th>Vaca</th><th>Quarto</th><th>Grau</th><th>Tratamento</th><th>Descarte até</th><th>Situação</th></tr></thead>
            <tbody>{casos.map((c) => {
              const ate = addDias(c.data, c.carenciaDias);
              return (
                <tr key={c.id}><td className="num">{isoToBrDate(c.data)}</td><td><Link href={`/animal/?id=${c.animalId}`} className="num font-semibold hover:text-leaf">{ix.animal.get(c.animalId)?.brinco}</Link></td>
                  <td className="num">{c.quarto}</td><td className="text-muted">{c.grau.replace('_', ' ')}</td><td>{c.tratamento}</td>
                  <td>{ate > hoje ? <Badge tone="alert">{isoToBrDate(ate)}</Badge> : <span className="num text-muted">{isoToBrDate(ate)}</span>}</td>
                  <td>{c.curadaEm ? <Badge tone="leaf">curada</Badge> : <button className="text-[12px] text-earth hover:text-ink" onClick={() => atualizar('mastites', c.id, { curadaEm: hoje })}>marcar curada</button>}</td></tr>
              );
            })}</tbody>
          </Tabela>
        )}
      </Card>
      {novo ? <NovoCaso onFechar={() => setNovo(false)} /> : null}
    </div>
  );
}

function NovoCaso({ onFechar }: { onFechar: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const vacas = vacasEmLactacao(e);
  const [f, setF] = useState<Partial<CasoMastite>>({ data: hoje, animalId: vacas[0]?.id, quarto: 'AE', grau: 'clinica_leve', tratamento: '', carenciaDias: 4 });
  return (
    <Modal aberto onFechar={onFechar} titulo="Caso de mastite" eyebrow="Leite">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Data"><Input type="date" value={f.data} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Field>
        <Field label="Vaca"><Select value={f.animalId} onChange={(ev) => setF({ ...f, animalId: ev.target.value })} opcoes={vacas.map((v) => ({ value: v.id, label: `${v.brinco}${v.nome ? ` · ${v.nome}` : ''}` }))} /></Field>
        <Field label="Quarto"><Select value={f.quarto} onChange={(ev) => setF({ ...f, quarto: ev.target.value as CasoMastite['quarto'] })} opcoes={['AE', 'AD', 'PE', 'PD'].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Grau"><Select value={f.grau} onChange={(ev) => setF({ ...f, grau: ev.target.value as CasoMastite['grau'] })} opcoes={[{ value: 'subclinica', label: 'Subclínica (CMT)' }, { value: 'clinica_leve', label: 'Clínica leve' }, { value: 'clinica_moderada', label: 'Clínica moderada' }, { value: 'clinica_grave', label: 'Clínica grave' }]} /></Field>
        <Field label="Tratamento" className="col-span-2"><Input value={f.tratamento} onChange={(ev) => setF({ ...f, tratamento: ev.target.value })} /></Field>
        <Field label="Carência do leite (dias)"><Input inputMode="numeric" value={f.carenciaDias} onChange={(ev) => setF({ ...f, carenciaDias: Number(ev.target.value) || 0 })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.animalId || !f.tratamento} onClick={() => { salvar('mastites', { id: novoId('mt'), ...f } as CasoMastite); onFechar(); }}>Registrar</button>
      </div>
    </Modal>
  );
}

function Reproducao() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const [novo, setNovo] = useState(false);
  const idsLeite = new Set(e.lotes.filter((l) => l.atividade === 'leite').flatMap((l) => animaisDoLote(e.animais, l.id).map((a) => a.id)));
  const rep = e.reproducao.filter((r) => idsLeite.has(r.animalId));
  const iep = intervaloEntrePartos(rep);
  const tp = taxaPrenhez(rep, addDias(hoje, -365), hoje);
  const sugs = sugestoes(e, hoje, 90).filter((s) => s.tipo === 'reprodutivo' && s.animalIds?.some((id) => idsLeite.has(id)));
  const vazias = [...idsLeite].filter((id) => {
    const a = ix.animal.get(id);
    if (!a || a.sexo !== 'F') return false;
    const d = del(e.reproducao, id, hoje);
    if (d == null || d < 60) return false;
    const ev = e.reproducao.filter((r) => r.animalId === id).sort((x, y) => y.data.localeCompare(x.data));
    return !ev.some((r) => r.tipo === 'diagnostico' && r.resultado === 'prenhe' && r.data > (ev.find((x) => x.tipo === 'parto')?.data ?? ''));
  });
  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="Intervalo entre partos" value={iep.media != null ? `${num(iep.media, 0)} d` : '—'} tone={iep.media != null && iep.media > 420 ? 'alert' : 'leaf'} hint="meta: 12 a 13 meses (365–395 d)" />
        <Stat label="Taxa de prenhez · 12 m" value={tp.taxa != null ? `${num(tp.taxa, 1)}%` : '—'} hint={`${tp.prenhes} de ${tp.diagnosticadas} diagnósticos`} />
        <Stat label="Vazias após 60 DEL" value={vazias.length} tone={vazias.length ? 'warn' : undefined} hint="precisam de cio/IATF" />
        <Stat label="Eventos nos próximos 90 d" value={sugs.length} />
      </StatGrid>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card eyebrow="Agenda reprodutiva" title="Diagnósticos, secagens e partos" actions={<button className="btn btn-ghost btn-sm" onClick={() => setNovo(true)}><Plus className="h-3.5 w-3.5" /> Evento</button>}>
          {sugs.length === 0 ? <Empty>Nada previsto.</Empty> : (
            <ul className="divide-y divide-rule/40 text-[13px]">{sugs.map((s) => <li key={s.regra} className="flex justify-between gap-3 py-2"><span>{s.titulo}</span><span className="num text-earth">{isoToBrDate(s.data)}</span></li>)}</ul>
          )}
        </Card>
        <Card eyebrow="Atenção" title="Vacas vazias com mais de 60 DEL">
          {vazias.length === 0 ? <Empty>Todas prenhes ou no período voluntário de espera.</Empty> : (
            <ul className="flex flex-wrap gap-2">{vazias.map((id) => <li key={id}><Link href={`/animal/?id=${id}`} className="num rounded-sm bg-warnLt px-2 py-1 text-[12.5px] hover:bg-leafLt">{ix.animal.get(id)?.brinco} · {del(e.reproducao, id, hoje)} DEL</Link></li>)}</ul>
          )}
        </Card>
      </div>
      {novo ? <NovoEventoRepro onFechar={() => setNovo(false)} ids={[...idsLeite]} /> : null}
    </div>
  );
}

function Bezerras() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const lotes = e.lotes.filter((l) => l.atividade === 'leite' && l.fase === 'reposicao');
  const bichos = lotes.flatMap((l) => animaisDoLote(e.animais, l.id));
  const meta = 0.7;
  return (
    <div className="space-y-5">
      <Aviso tone="earth" titulo="Recria cara que ninguém acompanha">Meta de GMD de {num(meta, 1)} kg/dia para a novilha chegar a 55% do peso adulto (~330 kg) aos 13–15 meses e parir antes dos 24. Cada mês de atraso no primeiro parto custa ração sem leite.</Aviso>
      <Card eyebrow={`${bichos.length} animais`} title="Bezerras e novilhas de reposição">
        <Tabela>
          <thead><tr><th>Brinco</th><th className="r">Idade</th><th className="r">Peso</th><th className="r">GMD</th><th className="r">Meta p/ idade</th><th>Situação</th></tr></thead>
          <tbody>{bichos.map((a) => {
            const hist = ix.pesagens.get(a.id);
            const g = gmd(hist);
            const id = idadeMeses(a.nascimento, hoje);
            const p = pesoAtual(a, hist, hoje);
            const alvo = 40 + id * 30.4 * meta;
            return (
              <tr key={a.id}><td><Link href={`/animal/?id=${a.id}`} className="num font-semibold hover:text-leaf">{a.brinco}</Link></td><td className="r num">{num(id, 1)} m</td>
                <td className="r num">{Math.round(p)} kg</td><td className={cx('r num', g != null && g < meta && 'text-alert')}>{g != null ? num(g, 3) : '—'}</td>
                <td className="r num text-muted">{Math.round(alvo)} kg</td>
                <td>{p >= 330 && id <= 16 ? <Badge tone="leaf">apta à cobertura</Badge> : p < alvo * 0.9 ? <Badge tone="warn">abaixo da meta</Badge> : <Badge>no ritmo</Badge>}</td></tr>
            );
          })}</tbody>
        </Tabela>
      </Card>
    </div>
  );
}

function Rentabilidade() {
  const e = useEstado();
  const hoje = useHoje();
  const de = addDias(hoje, -89);
  const c = custoPorLote(e.lancamentos, e.contas, e.lotes, e.animais, e.pesagens, de, hoje, e.fazenda.rendimentoCarcacaPct);
  const lt = resumoCustos(c.lotes, e.ordenhas, de, hoje).find((r) => r.atividade === 'leite')!;
  const receitaLeite = e.lancamentos.filter((l) => !l.previsto && l.credito === '4.1.03' && l.data >= de && l.data <= hoje).reduce((s, l) => s + l.valor, 0);
  const precoMedio = lt.litros ? receitaLeite / lt.litros : null;
  const cota = e.cotacoes.filter((x) => x.indicador === 'leite').sort((a, b) => a.data.localeCompare(b.data)).pop()?.valor;
  const margem = lt.custoLitro != null && cota != null ? cota - lt.custoLitro : null;
  const conc = c.lotes.filter((l) => l.lote.atividade === 'leite');
  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="Custo do litro · 90 d" value={lt.custoLitro != null ? brl(lt.custoLitro) : '—'} size="lg" />
        <Stat label="Preço atual do litro" value={cota != null ? brl(cota) : '—'} tone="leaf" hint={precoMedio != null ? `recebido no período: ${brl(precoMedio)}/L (inclui atrasos de pagamento)` : undefined} />
        <Stat label="Margem por litro" value={margem != null ? brl(margem) : '—'} tone={margem != null && margem < 0 ? 'alert' : 'leaf'} />
        <Stat label="Litros · 90 d" value={num(lt.litros, 0)} />
      </StatGrid>
      <Card eyebrow="Custo dos lotes de leite (direto + rateio)" title={`Total ${brl(lt.custo)}`}>
        <Tabela>
          <thead><tr><th>Lote</th><th className="r">Direto</th><th className="r">Rateado</th><th className="r">Total</th></tr></thead>
          <tbody>{conc.map((l) => <tr key={l.lote.id}><td>{l.lote.nome}</td><td className="r num">{brl(l.direto)}</td><td className="r num">{brl(l.rateado)}</td><td className="r num font-semibold">{brl(l.total)}</td></tr>)}</tbody>
        </Tabela>
        <p className="mt-3 text-[12px] text-muted">Secas e bezerras não produzem, mas são custo do leite: entram no denominador do litro. Por isso a recria e o intervalo entre partos pesam tanto na margem.</p>
      </Card>
    </div>
  );
}

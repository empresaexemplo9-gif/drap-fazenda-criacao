'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus, ExternalLink } from 'lucide-react';
import { useEstado, salvar, salvarVarios, atualizar, novoId } from '@/lib/store';
import { useHoje, useIndices } from '@/lib/hooks';
import { brl, num, isoToBrDate } from '@/lib/format';
import { addDias, diasEntre, idadeMeses } from '@/lib/datas';
import { opcoesAcasalamento, PROTOCOLOS_IATF, cronogramaIATF, indicesContemporaneos, LIMITE_F, consanguinidade } from '@/lib/domain/genetica';
import { taxaPrenhez } from '@/lib/domain/leite';
import { moduloAtivo } from '@/lib/domain/modulos';
import type { EstoqueGenetico, Evento } from '@/lib/domain/types';
import { PageHeader, Em, Card, Tabs, Tabela, Badge, Field, Input, Select, Modal, StatGrid, Stat, Aviso, Empty, cx } from '@/components/ui';
import { NovoEventoRepro } from '@/components/repro-form';

type Aba = 'plantel' | 'acasalamento' | 'reproducao' | 'provas' | 'botijao' | 'catalogo' | 'registro';
const CARACTERISTICAS: Record<string, string> = {
  PN: 'Peso ao nascer (menor é melhor)', P120: 'Peso aos 120 d', P210: 'Peso à desmama', P365: 'Peso ao ano', P450: 'Peso ao sobreano',
  PE: 'Perímetro escrotal', AOL: 'Área de olho de lombo', EGS: 'Gordura subcutânea', MGT: 'Mérito genético total',
};

export default function GeneticaPage() {
  const e = useEstado();
  const [aba, setAba] = useState<Aba>('plantel');
  if (!moduloAtivo(e.modulos, 'genetica')) return <Empty>Módulo Genética não contratado. Ative em <Link href="/config/" className="text-earth underline">Configurações</Link>.</Empty>;
  return (
    <>
      <PageHeader eyebrow="XV · Módulo Genética" title={<>Seleção que <Em>se prova no papel</Em></>}
        sub="Registro genealógico, DEPs interpretadas, acasalamento com controle de consanguinidade, IATF/FIV/TE com taxa de prenhez, botijão e catálogo de venda com histórico verificável." />
      <Tabs<Aba> ativa={aba} onChange={setAba} abas={[
        { id: 'plantel', label: 'Plantel e DEPs' }, { id: 'acasalamento', label: 'Acasalamento' }, { id: 'reproducao', label: 'IATF · FIV · TE' },
        { id: 'provas', label: 'Provas' }, { id: 'botijao', label: 'Botijão' }, { id: 'catalogo', label: 'Catálogo de venda' }, { id: 'registro', label: 'Registro genealógico' },
      ]} />
      {aba === 'plantel' && <Plantel />}
      {aba === 'acasalamento' && <Acasalamento />}
      {aba === 'reproducao' && <ReproAssistida />}
      {aba === 'provas' && <Provas />}
      {aba === 'botijao' && <Botijao />}
      {aba === 'catalogo' && <Catalogo />}
      {aba === 'registro' && <Registro />}
    </>
  );
}

function Plantel() {
  const e = useEstado();
  const ix = useIndices();
  const [car, setCar] = useState('MGT');
  const linhas = useMemo(() => {
    const ult = new Map<string, (typeof e.avaliacoes)[number]>();
    for (const a of e.avaliacoes) { const u = ult.get(a.animalId); if (!u || a.safra > u.safra) ult.set(a.animalId, a); }
    return [...ult.values()].map((v) => ({ v, a: ix.animal.get(v.animalId) })).filter((x) => x.a && x.a.status === 'ativo')
      .sort((x, y) => (car === 'PN' ? 1 : -1) * ((x.v.deps[car] ?? 0) - (y.v.deps[car] ?? 0)));
  }, [e.avaliacoes, ix.animal, car]);
  const chaves = Object.keys(CARACTERISTICAS);
  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="Animais avaliados" value={linhas.length} />
        <Stat label="TOP 10%" value={linhas.filter((l) => (l.v.top ?? 100) <= 10).length} tone="leaf" />
        <Stat label="Machos avaliados" value={linhas.filter((l) => l.a!.sexo === 'M').length} />
        <Stat label="Acurácia média" value={linhas.length ? num(linhas.reduce((s, l) => s + (l.v.acuracia ?? 0), 0) / linhas.length, 1) : '—'} hint="abaixo de 0,5: DEP ainda instável" />
      </StatGrid>
      <Card eyebrow="Ordenar por" title={CARACTERISTICAS[car]} actions={<select className="field-input w-auto py-1 text-[13px]" value={car} onChange={(ev) => setCar(ev.target.value)} aria-label="Característica">{chaves.map((k) => <option key={k} value={k}>{k}</option>)}</select>}>
        <Tabela>
          <thead><tr><th>Animal</th><th>Sexo</th><th>Programa</th>{chaves.map((k) => <th key={k} className={cx('r', k === car && 'text-ink')}>{k}</th>)}<th className="r">Ac.</th><th className="r">TOP</th></tr></thead>
          <tbody>{linhas.map(({ v, a }) => (
            <tr key={v.id}>
              <td><Link href={`/animal/?id=${a!.id}`} className="font-semibold hover:text-leaf">{a!.nome ?? a!.brinco}</Link><div className="num text-[11px] text-muted">{a!.registroGenealogico}</div></td>
              <td>{a!.sexo}</td><td className="text-muted">{v.programa} {v.safra}</td>
              {chaves.map((k) => <td key={k} className={cx('r num', k === car && 'font-semibold', (v.deps[k] ?? 0) < 0 && k !== 'PN' && 'text-alert')}>{v.deps[k] != null ? num(v.deps[k]) : '—'}</td>)}
              <td className="r num text-muted">{v.acuracia != null ? num(v.acuracia) : '—'}</td>
              <td className="r">{v.top ? <Badge tone={v.top <= 10 ? 'leaf' : 'neutral'}>{v.top}%</Badge> : '—'}</td>
            </tr>
          ))}</tbody>
        </Tabela>
      </Card>
      <Aviso tone="earth" titulo="Como ler uma DEP">DEP é a diferença esperada na progênie em relação à média da raça. Um touro com DEP P450 de +14 kg deve gerar filhos 7 kg mais pesados ao sobreano (metade vem da mãe). A acurácia diz quanto a DEP ainda pode mudar: acima de 0,7 é confiável.</Aviso>
    </div>
  );
}

function Acasalamento() {
  const e = useEstado();
  const ix = useIndices();
  const femeas = e.animais.filter((a) => a.status === 'ativo' && a.sexo === 'F' && (e.lotes.find((l) => l.id === a.loteId)?.atividade === 'genetica' || a.registroGenealogico));
  const [vaca, setVaca] = useState(femeas[0]?.id ?? '');
  const [meta, setMeta] = useState('P450');
  const ops = useMemo(() => (vaca ? opcoesAcasalamento(vaca, e.animais, e.avaliacoes, e.estoqueGenetico, meta) : []), [vaca, e.animais, e.avaliacoes, e.estoqueGenetico, meta]);
  const planejados = e.acasalamentos.filter((a) => a.status === 'planejado');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fêmea"><Select value={vaca} onChange={(ev) => setVaca(ev.target.value)} opcoes={femeas.map((a) => ({ value: a.id, label: `${a.nome ?? a.brinco}${a.registroGenealogico ? ` · ${a.registroGenealogico}` : ''}` }))} /></Field>
        <Field label="Característica-meta"><Select value={meta} onChange={(ev) => setMeta(ev.target.value)} opcoes={Object.entries(CARACTERISTICAS).map(([k, v]) => ({ value: k, label: `${k} · ${v}` }))} /></Field>
      </div>
      <Card eyebrow={`Limite de consanguinidade ${num(LIMITE_F * 100, 1)}%`} title="Touros e sêmen recomendados">
        {ops.length === 0 ? <Empty>Sem touros avaliados ou sêmen no botijão.</Empty> : (
          <Tabela>
            <thead><tr><th>#</th><th>Touro / sêmen</th><th className="r">DEP {meta}</th><th className="r">F do produto</th><th className="r">Doses</th><th>Situação</th><th></th></tr></thead>
            <tbody>{ops.map((o, i) => (
              <tr key={o.rotulo + i} className={cx(o.bloqueado && 'text-muted')}>
                <td className="num">{i + 1}</td>
                <td>{o.rotulo}{o.avaliacao?.top ? <span className="ml-2"><Badge tone="leaf">TOP {o.avaliacao.top}%</Badge></span> : null}</td>
                <td className="r num font-semibold">{o.depMeta != null ? num(o.depMeta) : 'sem DEP'}</td>
                <td className={cx('r num', o.f > LIMITE_F ? 'text-alert' : o.f > 0 ? 'text-warn' : '')}>{num(o.f * 100, 1)}%</td>
                <td className="r num">{o.semen ? o.semen.doses : 'monta'}</td>
                <td>{o.bloqueado ? <Badge tone="alert">parentesco alto</Badge> : i === 0 ? <Badge tone="leaf">recomendado</Badge> : null}</td>
                <td>{!o.bloqueado ? <button className="text-[12px] font-medium text-earth hover:text-ink" onClick={() => salvar('acasalamentos', { id: novoId('ac'), vacaId: vaca, touroId: o.touro?.id, semen: o.semen?.identificacao, meta, coeficienteF: o.f, status: 'planejado' })}>planejar</button> : null}</td>
              </tr>
            ))}</tbody>
          </Tabela>
        )}
        <p className="mt-3 text-[12px] text-muted">F calculado pelo método de Wright sobre a genealogia cadastrada. Pais desconhecidos contam como não aparentados, então completar o pedigree deixa o cálculo mais seguro.</p>
      </Card>
      <Card eyebrow={`${planejados.length} planejados`} title="Plano de acasalamento da estação">
        {planejados.length === 0 ? <Empty>Nenhum acasalamento planejado.</Empty> : (
          <Tabela>
            <thead><tr><th>Fêmea</th><th>Touro / sêmen</th><th>Meta</th><th className="r">F</th><th></th></tr></thead>
            <tbody>{planejados.map((p) => (
              <tr key={p.id}><td>{ix.animal.get(p.vacaId)?.nome ?? ix.animal.get(p.vacaId)?.brinco}</td><td>{p.semen ?? (p.touroId ? ix.animal.get(p.touroId)?.nome : '—')}</td><td>{p.meta}</td><td className="r num">{num(p.coeficienteF * 100, 1)}%</td>
                <td className="whitespace-nowrap text-[12px]"><button className="mr-3 text-earth hover:text-ink" onClick={() => atualizar('acasalamentos', p.id, { status: 'realizado' })}>realizado</button><button className="text-muted hover:text-alert" onClick={() => atualizar('acasalamentos', p.id, { status: 'cancelado' })}>cancelar</button></td></tr>
            ))}</tbody>
          </Tabela>
        )}
      </Card>
    </div>
  );
}

function ReproAssistida() {
  const e = useEstado();
  const hoje = useHoje();
  const [protocolo, setProtocolo] = useState(Object.keys(PROTOCOLOS_IATF)[0]);
  const [d0, setD0] = useState(addDias(hoje, 3));
  const [lote, setLote] = useState(e.lotes.find((l) => l.fase === 'cria' || l.fase === 'doadoras')?.id ?? '');
  const [novo, setNovo] = useState(false);
  const crono = cronogramaIATF(protocolo, d0);
  const femeas = e.animais.filter((a) => a.status === 'ativo' && a.sexo === 'F' && a.loteId === lote && idadeMeses(a.nascimento, hoje) >= 14);
  const porProt = useMemo(() => {
    const m = new Map<string, { serv: number; prenhes: number }>();
    for (const r of e.reproducao) {
      if (r.tipo !== 'iatf' || !r.protocolo) continue;
      const dg = e.reproducao.find((x) => x.animalId === r.animalId && x.tipo === 'diagnostico' && x.data > r.data && diasEntre(r.data, x.data) <= 60);
      const acc = m.get(r.protocolo) ?? { serv: 0, prenhes: 0 };
      if (dg) { acc.serv += 1; if (dg.resultado === 'prenhe') acc.prenhes += 1; }
      m.set(r.protocolo, acc);
    }
    return m;
  }, [e.reproducao]);
  const tp = taxaPrenhez(e.reproducao, addDias(hoje, -365), hoje);
  const custoDoseMedia = e.estoqueGenetico.filter((s) => s.tipo === 'semen' && s.custoDose > 0).reduce((s, x, _, arr) => s + x.custoDose / arr.length, 0);
  function agendar() {
    const evs: Evento[] = crono.map((c) => ({ id: novoId('e'), titulo: `IATF ${protocolo}: ${c.acao} (${femeas.length} fêmeas)`, data: c.data, tipo: 'reprodutivo', concluido: false, loteId: lote, animalIds: femeas.map((a) => a.id), regra: `iatf:${lote}:${d0}:${c.data}` }));
    salvarVarios('eventos', evs);
  }
  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="Taxa de prenhez · 12 m" value={tp.taxa != null ? `${num(tp.taxa, 1)}%` : '—'} tone="leaf" hint={`${tp.prenhes} de ${tp.diagnosticadas}`} />
        <Stat label="Custo médio da dose" value={brl(custoDoseMedia)} />
        <Stat label="Custo por prenhez (sêmen)" value={tp.taxa ? brl(custoDoseMedia / (tp.taxa / 100)) : '—'} hint="sem hormônios e mão de obra" />
        <Stat label="Embriões no botijão" value={e.estoqueGenetico.filter((s) => s.tipo === 'embriao').reduce((s, x) => s + x.doses, 0)} />
      </StatGrid>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card eyebrow="Gerar cronograma" title="Protocolo de IATF">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Protocolo" className="col-span-2"><Select value={protocolo} onChange={(ev) => setProtocolo(ev.target.value)} opcoes={Object.keys(PROTOCOLOS_IATF).map((p) => ({ value: p, label: p }))} /></Field>
            <Field label="D0"><Input type="date" value={d0} onChange={(ev) => setD0(ev.target.value)} /></Field>
            <Field label="Lote"><Select value={lote} onChange={(ev) => setLote(ev.target.value)} opcoes={e.lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
          </div>
          <ul className="mt-4 divide-y divide-rule/40 text-[13px]">{crono.map((c) => <li key={c.data + c.acao} className="flex justify-between gap-3 py-1.5"><span>{c.acao}</span><span className="num text-earth">{isoToBrDate(c.data)}</span></li>)}</ul>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] text-muted"><span className="num font-semibold text-ink">{femeas.length}</span> fêmeas aptas (≥ 14 meses)</span>
            <button className="btn btn-leaf btn-sm" disabled={!femeas.length} onClick={agendar}>Agendar na agenda</button>
          </div>
        </Card>
        <Card eyebrow="Resultado por protocolo" title="Taxa de prenhez" actions={<button className="btn btn-ghost btn-sm" onClick={() => setNovo(true)}><Plus className="h-3.5 w-3.5" /> Evento</button>}>
          {porProt.size === 0 ? <Empty>Sem IATF com diagnóstico.</Empty> : (
            <Tabela>
              <thead><tr><th>Protocolo</th><th className="r">Diagnosticadas</th><th className="r">Prenhes</th><th className="r">Taxa</th></tr></thead>
              <tbody>{[...porProt].map(([p, v]) => <tr key={p}><td>{p}</td><td className="r num">{v.serv}</td><td className="r num">{v.prenhes}</td><td className="r num font-semibold">{v.serv ? `${num((v.prenhes / v.serv) * 100, 1)}%` : '—'}</td></tr>)}</tbody>
            </Tabela>
          )}
          <p className="mt-3 text-[12px] text-muted">Referência de mercado para IATF em Nelore: 45% a 55% na primeira inseminação.</p>
        </Card>
      </div>
      {novo ? <NovoEventoRepro onFechar={() => setNovo(false)} ids={e.animais.filter((a) => a.sexo === 'F' && a.status === 'ativo').map((a) => a.id)} /> : null}
    </div>
  );
}

function Provas() {
  const e = useEstado();
  const ix = useIndices();
  const ip = indicesContemporaneos(e.provas, 'pesoKg');
  const ice = indicesContemporaneos(e.provas, 'ceCm');
  const iaol = indicesContemporaneos(e.provas, 'aolCm2');
  const linhas = [...e.provas].sort((a, b) => (ip.get(b.animalId) ?? 0) + (iaol.get(b.animalId) ?? 0) - (ip.get(a.animalId) ?? 0) - (iaol.get(a.animalId) ?? 0));
  return (
    <Card eyebrow="Comparação dentro do grupo de contemporâneos" title="Prova de desempenho · peso, CE e ultrassom de carcaça">
      {linhas.length === 0 ? <Empty>Sem provas registradas.</Empty> : (
        <Tabela>
          <thead><tr><th>Animal</th><th>Grupo</th><th className="r">Peso</th><th className="r">Índ. peso</th><th className="r">CE (cm)</th><th className="r">Índ. CE</th><th className="r">AOL (cm²)</th><th className="r">Índ. AOL</th><th className="r">EGS (mm)</th><th className="r">F</th></tr></thead>
          <tbody>{linhas.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/animal/?id=${p.animalId}`} className="font-semibold hover:text-leaf">{ix.animal.get(p.animalId)?.nome ?? ix.animal.get(p.animalId)?.brinco}</Link></td>
              <td className="text-[12px] text-muted">{p.grupo}</td>
              <td className="r num">{p.pesoKg}</td><td className={cx('r num', (ip.get(p.animalId) ?? 100) >= 105 && 'font-semibold text-leafDk')}>{num(ip.get(p.animalId), 0)}</td>
              <td className="r num">{num(p.ceCm, 1)}</td><td className="r num">{num(ice.get(p.animalId), 0)}</td>
              <td className="r num">{p.aolCm2}</td><td className={cx('r num', (iaol.get(p.animalId) ?? 100) >= 105 && 'font-semibold text-leafDk')}>{num(iaol.get(p.animalId), 0)}</td>
              <td className="r num">{num(p.egsMm, 1)}</td><td className="r num text-muted">{num(consanguinidade(e.animais, p.animalId) * 100, 1)}%</td>
            </tr>
          ))}</tbody>
        </Tabela>
      )}
      <p className="mt-3 text-[12px] text-muted">Índice 100 = média do grupo (mesma época, sexo e manejo). Só faz sentido comparar dentro do grupo de contemporâneos.</p>
    </Card>
  );
}

function Botijao() {
  const e = useEstado();
  const hoje = useHoje();
  const [edit, setEdit] = useState<EstoqueGenetico | null>(null);
  const itens = [...e.estoqueGenetico].sort((a, b) => a.botijao.localeCompare(b.botijao) || a.caneca.localeCompare(b.caneca));
  const botijoes = [...new Set(itens.map((i) => i.botijao))];
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><button className="btn btn-primary" onClick={() => setEdit({ id: novoId('eg'), tipo: 'semen', identificacao: '', botijao: botijoes[0] ?? 'B1', caneca: '1', doses: 0, custoDose: 0 })}><Plus className="h-4 w-4" /> Sêmen ou embrião</button></div>
      {botijoes.map((b) => (
        <Card key={b} eyebrow="Botijão" title={b}>
          <Tabela>
            <thead><tr><th>Caneca</th><th>Tipo</th><th>Identificação</th><th>Central</th><th className="r">Doses</th><th className="r">R$/dose</th><th className="r">Valor</th><th>Validade</th><th></th></tr></thead>
            <tbody>{itens.filter((i) => i.botijao === b).map((i) => (
              <tr key={i.id}><td className="num">{i.caneca}</td><td><Badge tone={i.tipo === 'semen' ? 'earth' : 'leaf'}>{i.tipo}</Badge></td><td>{i.identificacao}</td><td className="text-muted">{i.central ?? 'próprio'}</td>
                <td className={cx('r num font-semibold', i.doses < 10 && 'text-warn')}>{i.doses}</td><td className="r num">{brl(i.custoDose)}</td><td className="r num">{brl(i.doses * i.custoDose)}</td>
                <td className="num">{i.validade ? <span className={cx(i.validade < addDias(hoje, 60) && 'text-alert')}>{isoToBrDate(i.validade)}</span> : '—'}</td>
                <td><button className="text-[12px] text-earth hover:text-ink" onClick={() => setEdit(i)}>editar</button></td></tr>
            ))}</tbody>
          </Tabela>
        </Card>
      ))}
      <Aviso tone="warn" titulo="Nitrogênio">Registre o reabastecimento de nitrogênio do botijão na Agenda (tipo Estoque). Botijão seco perde todo o material genético.</Aviso>
      {edit ? (
        <Modal aberto onFechar={() => setEdit(null)} titulo={edit.identificacao || 'Novo item'} eyebrow="Botijão">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Tipo"><Select value={edit.tipo} onChange={(ev) => setEdit({ ...edit, tipo: ev.target.value as EstoqueGenetico['tipo'] })} opcoes={[{ value: 'semen', label: 'Sêmen' }, { value: 'embriao', label: 'Embrião' }]} /></Field>
            <Field label="Touro do rebanho"><Select value={edit.touroId ?? ''} onChange={(ev) => setEdit({ ...edit, touroId: ev.target.value || undefined })} vazio="— externo —" opcoes={e.animais.filter((a) => a.sexo === 'M' && a.registroGenealogico).map((a) => ({ value: a.id, label: a.nome ?? a.brinco }))} /></Field>
            <Field label="Identificação" className="col-span-2"><Input value={edit.identificacao} onChange={(ev) => setEdit({ ...edit, identificacao: ev.target.value })} /></Field>
            <Field label="Central"><Input value={edit.central ?? ''} onChange={(ev) => setEdit({ ...edit, central: ev.target.value })} /></Field>
            <Field label="Botijão"><Input value={edit.botijao} onChange={(ev) => setEdit({ ...edit, botijao: ev.target.value })} /></Field>
            <Field label="Caneca"><Input value={edit.caneca} onChange={(ev) => setEdit({ ...edit, caneca: ev.target.value })} /></Field>
            <Field label="Doses / embriões"><Input inputMode="numeric" value={edit.doses} onChange={(ev) => setEdit({ ...edit, doses: Number(ev.target.value) || 0 })} /></Field>
            <Field label="Custo por dose (R$)"><Input inputMode="decimal" value={edit.custoDose} onChange={(ev) => setEdit({ ...edit, custoDose: Number(ev.target.value.replace(',', '.')) || 0 })} /></Field>
            <Field label="Validade"><Input type="date" value={edit.validade ?? ''} onChange={(ev) => setEdit({ ...edit, validade: ev.target.value || undefined })} /></Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn btn-primary" disabled={!edit.identificacao.trim()} onClick={() => { salvar('estoqueGenetico', edit); setEdit(null); }}>Salvar</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Catalogo() {
  const e = useEstado();
  const ix = useIndices();
  const [novo, setNovo] = useState(false);
  const [f, setF] = useState({ animalId: '', titulo: '', preco: '', leilao: '', dataLeilao: '', videoUrl: '' });
  const candidatos = e.animais.filter((a) => a.status === 'ativo' && a.registroGenealogico);
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><button className="btn btn-primary" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Anúncio</button></div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {e.anuncios.map((an) => {
          const a = ix.animal.get(an.animalId);
          const av = e.avaliacoes.filter((v) => v.animalId === an.animalId).sort((x, y) => y.safra.localeCompare(x.safra))[0];
          const pai = a?.paiId ? ix.animal.get(a.paiId) : undefined;
          const mae = a?.maeId ? ix.animal.get(a.maeId) : undefined;
          return (
            <Card key={an.id} eyebrow={an.leilao ? `${an.leilao}${an.dataLeilao ? ` · ${isoToBrDate(an.dataLeilao)}` : ''}` : 'Venda direta'} title={an.titulo}
              actions={an.publicado ? <Badge tone="leaf">publicado</Badge> : <Badge>rascunho</Badge>}>
              <p className="text-[13px] text-muted">{a?.raca} · {a?.registroGenealogico} · nasc. {a ? isoToBrDate(a.nascimento) : ''}</p>
              <p className="mt-1 text-[13px]">Pai: <strong>{pai?.nome ?? a?.paiExterno ?? '—'}</strong> · Mãe: <strong>{mae?.nome ?? '—'}</strong></p>
              {av ? <div className="mt-3 flex flex-wrap gap-2">{['P210', 'P450', 'PE', 'AOL', 'MGT'].map((k) => av.deps[k] != null ? <span key={k} className="num rounded-sm bg-leafLt/60 px-2 py-0.5 text-[12px]">{k} {num(av.deps[k])}</span> : null)}{av.top ? <Badge tone="leaf">TOP {av.top}%</Badge> : null}</div> : null}
              {an.preco ? <p className="num mt-4 text-2xl font-semibold">{brl(an.preco)}</p> : null}
              <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
                <Link href={`/animal/?id=${an.animalId}`} className="inline-flex items-center gap-1 font-medium text-earth hover:text-ink">Ficha com histórico verificável <ExternalLink className="h-3 w-3" /></Link>
                <button className="font-medium text-muted hover:text-ink" onClick={() => atualizar('anuncios', an.id, { publicado: !an.publicado })}>{an.publicado ? 'despublicar' : 'publicar'}</button>
              </div>
            </Card>
          );
        })}
      </div>
      {e.anuncios.length === 0 ? <Empty>Nenhum anúncio.</Empty> : null}
      <Aviso tone="earth" titulo="Confiança na venda">A ficha do animal traz genealogia, DEPs, provas, sanidade e pesagens com a impressão digital (SHA-256) do histórico. O comprador confere que nada foi alterado depois da emissão. A vitrine pública on-line para leilões e catálogos depende do servidor de sincronização.</Aviso>
      {novo ? (
        <Modal aberto onFechar={() => setNovo(false)} titulo="Novo anúncio" eyebrow="Catálogo">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Animal" className="col-span-2"><Select value={f.animalId} vazio="—" onChange={(ev) => { const a = candidatos.find((x) => x.id === ev.target.value); setF({ ...f, animalId: ev.target.value, titulo: a ? `${a.nome ?? a.brinco} · ${a.raca}` : '' }); }} opcoes={candidatos.map((a) => ({ value: a.id, label: `${a.nome ?? a.brinco} · ${a.registroGenealogico}` }))} /></Field>
            <Field label="Título" className="col-span-2"><Input value={f.titulo} onChange={(ev) => setF({ ...f, titulo: ev.target.value })} /></Field>
            <Field label="Preço (R$)"><Input inputMode="decimal" value={f.preco} onChange={(ev) => setF({ ...f, preco: ev.target.value })} /></Field>
            <Field label="Leilão"><Input value={f.leilao} onChange={(ev) => setF({ ...f, leilao: ev.target.value })} /></Field>
            <Field label="Data do leilão"><Input type="date" value={f.dataLeilao} onChange={(ev) => setF({ ...f, dataLeilao: ev.target.value })} /></Field>
            <Field label="Vídeo (link)"><Input value={f.videoUrl} onChange={(ev) => setF({ ...f, videoUrl: ev.target.value })} /></Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setNovo(false)}>Cancelar</button>
            <button className="btn btn-primary" disabled={!f.animalId || !f.titulo} onClick={() => { salvar('anuncios', { id: novoId('an'), animalId: f.animalId, titulo: f.titulo, preco: Number(f.preco.replace(',', '.')) || undefined, leilao: f.leilao || undefined, dataLeilao: f.dataLeilao || undefined, videoUrl: f.videoUrl || undefined, publicado: false }); setNovo(false); }}>Salvar</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Registro() {
  const e = useEstado();
  const hoje = useHoje();
  // Nascidos de pais registrados: comunicação de nascimento à associação de raça.
  const filhosPO = e.animais.filter((a) => a.status === 'ativo' && !a.registroGenealogico && (e.animais.find((p) => p.id === a.paiId)?.registroGenealogico || e.animais.find((p) => p.id === a.maeId)?.registroGenealogico));
  const PRAZO = 120;
  return (
    <div className="space-y-5">
      <Aviso tone="earth" titulo="Prazos das associações">Cada associação (ABCZ, ABCCMM, ACNB, Angus e outras) tem prazos próprios para comunicar cobertura, nascimento e pedir o registro definitivo. Configure o prazo da sua; o padrão aqui é {PRAZO} dias do nascimento para a comunicação.</Aviso>
      <Card eyebrow={`${filhosPO.length} sem registro`} title="Produtos de pais registrados">
        {filhosPO.length === 0 ? <Empty>Todos os produtos estão registrados.</Empty> : (
          <Tabela>
            <thead><tr><th>Animal</th><th>Nascimento</th><th>Pai</th><th>Mãe</th><th>Prazo</th><th></th></tr></thead>
            <tbody>{filhosPO.map((a) => {
              const prazo = addDias(a.nascimento, PRAZO);
              const vencido = prazo < hoje;
              return (
                <tr key={a.id}><td><Link href={`/animal/?id=${a.id}`} className="num font-semibold hover:text-leaf">{a.brinco}</Link></td><td className="num">{isoToBrDate(a.nascimento)}</td>
                  <td>{e.animais.find((p) => p.id === a.paiId)?.nome ?? a.paiExterno ?? '—'}</td><td>{e.animais.find((p) => p.id === a.maeId)?.nome ?? '—'}</td>
                  <td>{vencido ? <Badge tone="alert">vencido {isoToBrDate(prazo)}</Badge> : <Badge tone="warn">{isoToBrDate(prazo)}</Badge>}</td>
                  <td><button className="text-[12px] text-earth hover:text-ink" onClick={() => { const n = prompt('Número do registro (RGN/RGD):'); if (n) atualizar('animais', a.id, { registroGenealogico: n }); }}>registrar</button></td></tr>
              );
            })}</tbody>
          </Tabela>
        )}
      </Card>
    </div>
  );
}

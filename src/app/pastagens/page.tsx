'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useEstado, salvar, atualizar, novoId } from '@/lib/store';
import { useHoje, useIndices, usePerfil } from '@/lib/hooks';
import { num, isoToBrDate } from '@/lib/format';
import { addDias, estacao } from '@/lib/datas';
import { lotacaoPiquetes, gmdGrupo, animaisDoLote } from '@/lib/domain/rebanho';
import type { Piquete, StatusPiquete } from '@/lib/domain/types';
import { PageHeader, Em, Card, Badge, Barra, Field, Input, Select, Modal, StatGrid, Stat, Aviso, Textarea } from '@/components/ui';

const ROT_SIT = {
  ok: ['Lotação adequada', 'leaf'], superlotado: ['Superlotado', 'alert'], subutilizado: ['Subutilizado', 'warn'],
  descanso_ok: ['Pronto para entrada', 'leaf'], descanso_curto: ['Em descanso', 'earth'], reforma: ['Reforma / degradado', 'neutral'],
} as const;

export default function PastagensPage() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const [edit, setEdit] = useState<Piquete | null>(null);
  const perfil = usePerfil();

  const lot = useMemo(() => lotacaoPiquetes(e.piquetes, e.lotes, e.animais, ix.pesagens, hoje), [e.piquetes, e.lotes, e.animais, ix.pesagens, hoje]);
  const area = e.piquetes.reduce((s, p) => s + p.areaHa, 0);
  const areaUtil = e.piquetes.filter((p) => p.status !== 'reforma' && p.status !== 'degradado').reduce((s, p) => s + p.areaHa, 0);
  const ua = lot.reduce((s, l) => s + l.ua, 0);
  const cap = e.piquetes.filter((p) => p.status !== 'reforma' && p.status !== 'degradado').reduce((s, p) => s + p.capacidadeUAha * p.areaHa, 0);
  const est = estacao(hoje);

  function ocupar(p: Piquete) {
    atualizar('piquetes', p.id, { status: 'ocupado', desde: hoje });
  }
  function descanso(p: Piquete) {
    for (const l of e.lotes.filter((x) => x.piqueteId === p.id)) atualizar('lotes', l.id, { piqueteId: undefined });
    atualizar('piquetes', p.id, { status: 'descanso', desde: hoje });
  }
  function moverLote(loteId: string, p: Piquete) {
    const lote = ix.lote.get(loteId);
    if (lote?.piqueteId) {
      const antigo = ix.piquete.get(lote.piqueteId);
      const outros = e.lotes.filter((x) => x.piqueteId === lote.piqueteId && x.id !== loteId);
      if (antigo && outros.length === 0) atualizar('piquetes', antigo.id, { status: 'descanso', desde: hoje });
    }
    atualizar('lotes', loteId, { piqueteId: p.id });
    if (p.status !== 'ocupado') atualizar('piquetes', p.id, { status: 'ocupado', desde: hoje });
  }

  return (
    <>
      <PageHeader eyebrow="III · Pastagens" title={<>O pasto <Em>ligado ao ganho</Em> do animal</>}
        sub="Lotação em UA/ha contra a capacidade de suporte, rotação com descanso mínimo e o GMD de quem está em cada piquete."
        actions={<button className="btn btn-primary" onClick={() => setEdit({ id: novoId('pq'), nome: '', areaHa: 0, forrageira: 'Brachiaria brizantha (Marandu)', capacidadeUAha: 2, status: 'descanso', desde: hoje, diasDescansoAlvo: 30 })}><Plus className="h-4 w-4" /> Piquete</button>} />

      <div className="mb-6">
        <StatGrid cols={4}>
          <Stat label="Área de pasto" value={`${num(area)} ha`} hint={`${num(areaUtil)} ha em uso · ${e.piquetes.length} piquetes`} />
          <Stat label="Lotação global" value={`${num(areaUtil ? ua / areaUtil : 0)} UA/ha`} hint={`${num(ua, 1)} UA no pasto`} />
          <Stat label="Capacidade estimada" value={`${num(cap, 0)} UA`} tone={ua > cap ? 'alert' : 'leaf'} hint={ua > cap ? 'acima do suporte' : `folga de ${num(cap - ua, 0)} UA`} />
          <Stat label="Estação" value={est === 'seca' ? 'Seca' : 'Águas'} tone="earth" hint={est === 'seca' ? 'reduza a lotação e suplemente' : 'época de adubar e reformar'} />
        </StatGrid>
      </div>

      {est === 'seca' ? <div className="mb-6"><Aviso tone="warn" titulo="Período seco">Na seca a capacidade de suporte cai de 30% a 50%. Revise a capacidade dos piquetes e programe proteinado e diferimento.</Aviso></div> : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {lot.map((l) => {
          const [rot, tom] = ROT_SIT[l.situacao];
          const ids = l.lotes.flatMap((x) => animaisDoLote(e.animais, x.id).map((a) => a.id));
          const g = gmdGrupo(ids, ix.pesagens, addDias(hoje, -120), hoje);
          const pronto = addDias(l.piquete.desde, l.piquete.diasDescansoAlvo);
          return (
            <Card key={l.piquete.id} eyebrow={l.piquete.forrageira} title={l.piquete.nome}
              actions={<><Badge tone={tom}>{rot}</Badge><button className="text-[12px] font-medium text-earth hover:text-ink" onClick={() => setEdit(l.piquete)}>editar</button></>}>
              <dl className="grid grid-cols-4 gap-3 text-[13px]">
                <div><dt className="eyebrow text-muted">Área</dt><dd className="num">{num(l.piquete.areaHa)} ha</dd></div>
                <div><dt className="eyebrow text-muted">Cabeças</dt><dd className="num">{l.cabecas}</dd></div>
                <div><dt className="eyebrow text-muted">UA/ha</dt><dd className="num">{num(l.uaHa)}</dd></div>
                <div><dt className="eyebrow text-muted">GMD</dt><dd className="num">{g != null ? num(g, 3) : '—'}</dd></div>
              </dl>
              {l.piquete.status === 'ocupado' || l.cabecas > 0 ? (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11.5px] text-muted"><span>Ocupação da capacidade ({num(l.piquete.capacidadeUAha)} UA/ha)</span><span className="num">{num(l.ocupacao * 100, 1)}%</span></div>
                  <Barra valor={l.ocupacao} max={1.3} tone={l.situacao === 'superlotado' ? 'alert' : l.situacao === 'subutilizado' ? 'warn' : 'leaf'} />
                </div>
              ) : null}
              <p className="mt-3 text-[12.5px] text-muted">
                {l.piquete.status === 'descanso' ? <>Em descanso há <span className="num">{l.diasNoStatus}</span> dias · pronto em <span className="num">{isoToBrDate(pronto)}</span></> :
                  l.piquete.status === 'ocupado' ? <>Ocupado há <span className="num">{l.diasNoStatus}</span> dias por {l.lotes.map((x) => x.nome).join(', ') || '—'}</> :
                    l.piquete.obs ?? 'Em reforma.'}
                {l.piquete.ultimaAdubacao ? <> · adubado em <span className="num">{isoToBrDate(l.piquete.ultimaAdubacao)}</span></> : null}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {l.piquete.status !== 'ocupado' ? <button className="btn btn-ghost btn-sm" onClick={() => ocupar(l.piquete)}>Marcar ocupado</button> : <button className="btn btn-ghost btn-sm" onClick={() => descanso(l.piquete)}>Tirar o gado (descanso)</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => atualizar('piquetes', l.piquete.id, { ultimaAdubacao: hoje })}>Adubado hoje</button>
                {l.piquete.status !== 'reforma' ? <button className="btn btn-ghost btn-sm" onClick={() => atualizar('piquetes', l.piquete.id, { status: 'reforma', desde: hoje })}>Reforma</button> : null}
                <select className="field-input w-auto py-1 text-[12.5px]" value="" onChange={(ev) => ev.target.value && moverLote(ev.target.value, l.piquete)} aria-label="Trazer lote">
                  <option value="">Trazer lote…</option>
                  {perfil.lotes.filter((x) => x.piqueteId !== l.piquete.id && x.fase !== 'confinamento').map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </div>
            </Card>
          );
        })}
      </div>

      {edit ? <EditarPiquete p={edit} onFechar={() => setEdit(null)} /> : null}
    </>
  );
}

function EditarPiquete({ p, onFechar }: { p: Piquete; onFechar: () => void }) {
  const [f, setF] = useState<Piquete>(p);
  const n = (v: string) => Number(v.replace(',', '.')) || 0;
  return (
    <Modal aberto onFechar={onFechar} titulo={p.nome || 'Novo piquete'} eyebrow="Piquete">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Nome" className="col-span-2"><Input value={f.nome} onChange={(ev) => setF({ ...f, nome: ev.target.value })} /></Field>
        <Field label="Área (ha)"><Input inputMode="decimal" value={f.areaHa || ''} onChange={(ev) => setF({ ...f, areaHa: n(ev.target.value) })} /></Field>
        <Field label="Capacidade (UA/ha)" dica="Marandu ~2, Mombaça ~3,5, Tifton irrigado ~5"><Input inputMode="decimal" value={f.capacidadeUAha || ''} onChange={(ev) => setF({ ...f, capacidadeUAha: n(ev.target.value) })} /></Field>
        <Field label="Forrageira" className="col-span-2"><Input value={f.forrageira} onChange={(ev) => setF({ ...f, forrageira: ev.target.value })} /></Field>
        <Field label="Situação"><Select value={f.status} onChange={(ev) => setF({ ...f, status: ev.target.value as StatusPiquete })} opcoes={[{ value: 'ocupado', label: 'Ocupado' }, { value: 'descanso', label: 'Descanso' }, { value: 'reforma', label: 'Reforma' }, { value: 'degradado', label: 'Degradado' }]} /></Field>
        <Field label="Descanso alvo (dias)"><Input inputMode="numeric" value={f.diasDescansoAlvo} onChange={(ev) => setF({ ...f, diasDescansoAlvo: n(ev.target.value) })} /></Field>
        <Field label="Desde"><Input type="date" value={f.desde} onChange={(ev) => setF({ ...f, desde: ev.target.value })} /></Field>
        <Field label="Última adubação"><Input type="date" value={f.ultimaAdubacao ?? ''} onChange={(ev) => setF({ ...f, ultimaAdubacao: ev.target.value || undefined })} /></Field>
        <Field label="Observação" className="col-span-2"><Textarea value={f.obs ?? ''} onChange={(ev) => setF({ ...f, obs: ev.target.value })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.nome.trim() || f.areaHa <= 0} onClick={() => { salvar('piquetes', f); onFechar(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

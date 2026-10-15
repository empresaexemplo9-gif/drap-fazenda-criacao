'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useEstado, salvar, novoId } from '@/lib/store';
import { useHoje, useIndices } from '@/lib/hooks';
import { isoToBrDate, num } from '@/lib/format';
import { carenciasAtivas, animaisDoLote } from '@/lib/domain/rebanho';
import { sugestoes, sugestaoParaEvento } from '@/lib/domain/calendario';
import { ROT_SANITARIO, opcoes } from '@/lib/rotulos';
import type { TipoSanitario } from '@/lib/domain/types';
import { PageHeader, Em, Card, Tabs, Tabela, Badge, Field, Input, Select, Modal, Empty, StatGrid, Stat, Aviso } from '@/components/ui';

type Aba = 'carencia' | 'historico' | 'calendario' | 'rastreio';

export default function SanidadePage() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const [aba, setAba] = useState<Aba>('carencia');
  const [nova, setNova] = useState(false);
  const [partida, setPartida] = useState('');

  const carencias = useMemo(() => carenciasAtivas(e.sanidade, hoje).sort((a, b) => a.liberaCarne.localeCompare(b.liberaCarne)), [e.sanidade, hoje]);
  const sugs = useMemo(() => sugestoes(e, hoje, 120).filter((s) => s.tipo === 'sanitario'), [e, hoje]);
  const hist = [...e.sanidade].sort((a, b) => b.data.localeCompare(a.data));
  const rastreio = partida.trim() ? e.sanidade.filter((s) => s.partida.toLowerCase().includes(partida.trim().toLowerCase())) : [];
  const ano = hoje.slice(0, 4);
  const doses = e.sanidade.filter((s) => s.data.startsWith(ano)).reduce((s, a) => s + a.animalIds.length, 0);

  return (
    <>
      <PageHeader eyebrow="IV · Sanidade" title={<>Calendário sanitário <Em>e carência</Em> sob controle</>}
        sub="Vacinas obrigatórias, vermifugação, carrapato e antibiótico com a partida do frasco: rastreável para o frigorífico e para a defesa sanitária."
        actions={<button className="btn btn-primary" onClick={() => setNova(true)}><Plus className="h-4 w-4" /> Aplicação por lote</button>} />

      <div className="mb-6">
        <StatGrid cols={4}>
          <Stat label="Em carência" value={carencias.length} tone="warn" hint="bloqueados para abate ou leite" />
          <Stat label="Leite descartado" value={carencias.filter((c) => c.bloqueiaLeite).length} tone="alert" hint="vacas em carência de leite" />
          <Stat label={`Doses aplicadas em ${ano}`} value={num(doses, 1).replace(',0', '')} />
          <Stat label="Pendências sanitárias" value={sugs.length} tone={sugs.some((s) => s.obrigatorio) ? 'alert' : 'earth'} hint={`${sugs.filter((s) => s.obrigatorio).length} obrigatória(s)`} />
        </StatGrid>
      </div>

      <Tabs<Aba> ativa={aba} onChange={setAba} abas={[
        { id: 'carencia', label: 'Carência ativa', badge: carencias.length },
        { id: 'calendario', label: 'Calendário sanitário', badge: sugs.length },
        { id: 'historico', label: 'Histórico' },
        { id: 'rastreio', label: 'Rastrear partida' },
      ]} />

      {aba === 'carencia' && (
        <Card eyebrow="Não embarcar / descartar leite" title="Animais em período de carência">
          {carencias.length === 0 ? <Empty>Nenhum animal em carência hoje.</Empty> : (
            <Tabela>
              <thead><tr><th>Animal</th><th>Lote</th><th>Produto</th><th>Aplicado</th><th>Libera abate</th><th>Libera leite</th></tr></thead>
              <tbody>
                {carencias.map((c) => {
                  const a = ix.animal.get(c.animalId);
                  return (
                    <tr key={c.animalId}>
                      <td><Link href={`/animal/?id=${c.animalId}`} className="num font-semibold hover:text-leaf">{a?.brinco}</Link> {a?.nome ? <span className="text-muted">{a.nome}</span> : null}</td>
                      <td className="text-muted">{a?.loteId ? ix.lote.get(a.loteId)?.nome : '—'}</td>
                      <td>{c.produto}</td>
                      <td className="num">{isoToBrDate(c.aplicacao)}</td>
                      <td>{c.bloqueiaCarne ? <Badge tone="warn">{isoToBrDate(c.liberaCarne)}</Badge> : <span className="text-muted">liberado</span>}</td>
                      <td>{c.bloqueiaLeite ? <Badge tone="alert">{isoToBrDate(c.liberaLeite)}</Badge> : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
          )}
        </Card>
      )}

      {aba === 'calendario' && (
        <div className="space-y-5">
          <Aviso tone="earth" titulo={`Regras para ${e.fazenda.uf || 'sua UF'}`}>
            Brucelose (B19/RB51) é obrigatória para fêmeas de 3 a 8 meses. Aftosa: {e.fazenda.vacinaAftosa ? 'sua UF ainda vacina; campanhas em maio e novembro.' : 'o Brasil é reconhecido como livre sem vacinação; confira a regra estadual em Configurações.'} Raiva: {e.fazenda.raivaEndemica ? 'região endêmica, reforço anual.' : 'não endêmica.'} Vermifugação estratégica 5-7-9 na seca.
          </Aviso>
          <Card eyebrow="Próximos 120 dias" title="O que o sistema sugere">
            {sugs.length === 0 ? <Empty>Nada pendente.</Empty> : (
              <ul className="divide-y divide-rule/40">
                {sugs.map((s) => (
                  <li key={s.regra} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="num text-earth">{isoToBrDate(s.data)}</span>
                        {s.obrigatorio ? <Badge tone="alert">obrigatório</Badge> : null}
                        {s.prioridade === 'alta' ? <Badge tone="warn">prioridade</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[14.5px] font-medium">{s.titulo}</p>
                      <p className="text-[12.5px] text-muted">{s.detalhe}</p>
                    </div>
                    <button className="btn btn-ghost btn-sm flex-shrink-0" onClick={() => salvar('eventos', sugestaoParaEvento(s, novoId('e')))}>Agendar</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {aba === 'historico' && (
        <Card eyebrow="Rastreabilidade" title="Aplicações registradas">
          {hist.length === 0 ? <Empty>Nenhuma aplicação.</Empty> : (
            <Tabela>
              <thead><tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Partida</th><th className="r">Animais</th><th className="r">Dose</th><th className="r">Carência</th><th>Responsável</th></tr></thead>
              <tbody>
                {hist.map((s) => (
                  <tr key={s.id}>
                    <td className="num">{isoToBrDate(s.data)}</td>
                    <td><Badge tone={s.tipo === 'vacina' ? 'leaf' : s.tipo === 'antibiotico' ? 'alert' : 'earth'}>{ROT_SANITARIO[s.tipo]}</Badge></td>
                    <td>{s.produto}{s.motivo ? <div className="text-[11.5px] text-muted">{s.motivo}</div> : null}</td>
                    <td className="num">{s.partida}</td>
                    <td className="r num">{s.animalIds.length}</td>
                    <td className="r num">{num(s.doseMl)} mL</td>
                    <td className="r num">{s.carenciaCarneDias} d{s.carenciaLeiteDias ? ` / ${s.carenciaLeiteDias} d L` : ''}</td>
                    <td className="text-muted">{s.responsavel ?? (s.por ? ix.pessoa.get(s.por)?.nome : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Card>
      )}

      {aba === 'rastreio' && (
        <Card eyebrow="Recall de vacina ou medicamento" title="Quais animais receberam esta partida?">
          <Field label="Partida (lote de fabricação)">
            <div className="relative"><Search className="absolute left-0 top-2.5 h-4 w-4 text-muted" /><Input className="pl-6" value={partida} onChange={(ev) => setPartida(ev.target.value)} placeholder="ex.: CL-2508" /></div>
          </Field>
          <div className="mt-4">
            {partida && rastreio.length === 0 ? <Empty>Nenhuma aplicação com essa partida.</Empty> : null}
            {rastreio.map((s) => (
              <div key={s.id} className="mb-4">
                <p className="text-[13px]"><strong>{s.produto}</strong> · partida <span className="num">{s.partida}</span> · {isoToBrDate(s.data)} · <span className="num">{s.animalIds.length}</span> animais</p>
                <p className="mt-1 flex flex-wrap gap-1.5">{s.animalIds.slice(0, 200).map((id) => <Link key={id} href={`/animal/?id=${id}`} className="num rounded-sm bg-earthLt/60 px-1.5 py-0.5 text-[11.5px] hover:bg-leafLt">{ix.animal.get(id)?.brinco ?? '?'}</Link>)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <NovaAplicacao aberto={nova} onFechar={() => setNova(false)} />
    </>
  );
}

function NovaAplicacao({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const [f, setF] = useState({ data: hoje, tipo: 'vacina' as TipoSanitario, produto: '', partida: '', validade: '', dose: '5', carne: '0', leite: '0', motivo: '', insumoId: '', lotes: [] as string[] });
  const animais = f.lotes.flatMap((l) => animaisDoLote(e.animais, l));
  const insumosSan = e.insumos.filter((i) => ['vacina', 'medicamento'].includes(i.categoria));
  function salvarAp() {
    if (!f.produto || !f.partida || animais.length === 0) return;
    const id = novoId('s');
    salvar('sanidade', {
      id, data: f.data, tipo: f.tipo, produto: f.produto, partida: f.partida, validadePartida: f.validade || undefined, insumoId: f.insumoId || undefined,
      animalIds: animais.map((a) => a.id), doseMl: Number(f.dose.replace(',', '.')) || 0, carenciaCarneDias: Number(f.carne) || 0,
      carenciaLeiteDias: Number(f.leite) || 0, motivo: f.motivo || undefined,
    });
    const ins = e.insumos.find((i) => i.id === f.insumoId);
    if (ins) salvar('movEstoque', { id: novoId('m'), insumoId: ins.id, data: f.data, tipo: 'saida', quantidade: ins.unidade === 'dose' ? animais.length : animais.length * (Number(f.dose.replace(',', '.')) || 0), destino: `${f.produto} · ${animais.length} animais` });
    onFechar();
  }
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Aplicação por lote" eyebrow="Sanidade" largura="max-w-2xl">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <Field label="Data"><Input type="date" value={f.data} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Field>
        <Field label="Tipo"><Select value={f.tipo} onChange={(ev) => setF({ ...f, tipo: ev.target.value as TipoSanitario })} opcoes={opcoes(ROT_SANITARIO)} /></Field>
        <Field label="Do estoque"><Select value={f.insumoId} vazio="—" opcoes={insumosSan.map((i) => ({ value: i.id, label: i.nome }))} onChange={(ev) => setF({ ...f, insumoId: ev.target.value, produto: insumosSan.find((i) => i.id === ev.target.value)?.nome ?? f.produto })} /></Field>
        <Field label="Produto *" className="col-span-2"><Input value={f.produto} onChange={(ev) => setF({ ...f, produto: ev.target.value })} /></Field>
        <Field label="Partida *"><Input value={f.partida} onChange={(ev) => setF({ ...f, partida: ev.target.value })} /></Field>
        <Field label="Validade da partida"><Input type="date" value={f.validade} onChange={(ev) => setF({ ...f, validade: ev.target.value })} /></Field>
        <Field label="Dose (mL)"><Input inputMode="decimal" value={f.dose} onChange={(ev) => setF({ ...f, dose: ev.target.value })} /></Field>
        <Field label="Motivo"><Input value={f.motivo} onChange={(ev) => setF({ ...f, motivo: ev.target.value })} /></Field>
        <Field label="Carência carne (d)"><Input inputMode="numeric" value={f.carne} onChange={(ev) => setF({ ...f, carne: ev.target.value })} /></Field>
        <Field label="Carência leite (d)"><Input inputMode="numeric" value={f.leite} onChange={(ev) => setF({ ...f, leite: ev.target.value })} /></Field>
      </div>
      <div className="mt-5">
        <span className="field-label">Lotes</span>
        <div className="flex flex-wrap gap-2">
          {e.lotes.map((l) => {
            const on = f.lotes.includes(l.id);
            return <button key={l.id} type="button" onClick={() => setF({ ...f, lotes: on ? f.lotes.filter((x) => x !== l.id) : [...f.lotes, l.id] })}
              className={`rounded-full border px-3 py-1 text-[12.5px] ${on ? 'border-leaf bg-leafLt text-leafDk' : 'border-rule text-muted hover:text-ink'}`}>{l.nome} <span className="num">({animaisDoLote(e.animais, l.id).length})</span></button>;
          })}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted"><span className="num font-semibold text-ink">{animais.length}</span> animais</span>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" disabled={!f.produto || !f.partida || animais.length === 0} onClick={salvarAp}>Registrar aplicação</button>
        </div>
      </div>
    </Modal>
  );
}

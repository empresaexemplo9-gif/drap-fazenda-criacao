'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useEstado, salvar, novoId } from '@/lib/store';
import { useHoje } from '@/lib/hooks';
import { brl, isoToBrDate } from '@/lib/format';
import { diasEntre, periodoSafra, safraDe } from '@/lib/datas';
import { realizados } from '@/lib/domain/livro-razao';
import type { Documento, TipoDocumento } from '@/lib/domain/types';
import { PageHeader, Em, Card, Tabela, Badge, Field, Input, Select, Modal, StatGrid, Stat, Aviso, Textarea, Empty } from '@/components/ui';

const TIPOS: TipoDocumento[] = ['GTA', 'NF Produtor', 'Funrural', 'CAR', 'ITR', 'CCIR', 'SISBOV', 'Licença', 'Outro'];

export default function DocumentosPage() {
  const e = useEstado();
  const hoje = useHoje();
  const [edit, setEdit] = useState<Documento | null>(null);
  const [tipoF, setTipoF] = useState<TipoDocumento | ''>('');

  const docs = useMemo(() => [...e.documentos].filter((d) => !tipoF || d.tipo === tipoF).sort((a, b) => (a.vencimento ?? '9999').localeCompare(b.vencimento ?? '9999')), [e.documentos, tipoF]);
  const vencendo = e.documentos.filter((d) => d.vencimento && d.status !== 'cancelado' && diasEntre(hoje, d.vencimento) <= 60);
  const [ini] = periodoSafra(safraDe(hoje));
  const receitaBruta = realizados(e.lancamentos).filter((l) => l.data >= ini && l.data <= hoje && l.credito.startsWith('4.1') && !l.credito.startsWith('4.1.09')).reduce((s, l) => s + l.valor, 0);
  const funruralDevido = receitaBruta * (e.fazenda.funruralPct / 100);
  const funruralPago = realizados(e.lancamentos).filter((l) => l.data >= ini && l.data <= hoje && l.debito === '5.3.01').reduce((s, l) => s + l.valor, 0);
  const novo = (tipo: TipoDocumento = 'GTA'): Documento => ({ id: novoId('d'), tipo, numero: '', emissao: hoje, status: 'vigente', origem: tipo === 'GTA' ? e.fazenda.nome : undefined });

  return (
    <>
      <PageHeader eyebrow="X · Documentação e conformidade" title={<>Papel em dia, <Em>origem comprovada</Em></>}
        sub="GTA, nota do produtor, Funrural, CAR, ITR e CCIR com vencimento no calendário. Rastreabilidade para frigorífico, exportação e a exigência de origem livre de desmatamento."
        actions={<button className="btn btn-primary" onClick={() => setEdit(novo())}><Plus className="h-4 w-4" /> Documento</button>} />

      <div className="mb-6">
        <StatGrid cols={4}>
          <Stat label="Vencendo em 60 dias" value={vencendo.length} tone={vencendo.length ? 'warn' : 'leaf'} />
          <Stat label="GTAs emitidas (ano)" value={e.documentos.filter((d) => d.tipo === 'GTA' && d.emissao.startsWith(hoje.slice(0, 4))).length} />
          <Stat label={`Funrural ${e.fazenda.funruralPct}% · ${safraDe(hoje)}`} value={brl(funruralDevido)} hint={`sobre ${brl(receitaBruta)} de receita bruta`} />
          <Stat label="Funrural recolhido" value={brl(funruralPago)} tone={funruralPago + 1 < funruralDevido ? 'alert' : 'leaf'} hint={funruralPago + 1 < funruralDevido ? `faltam ${brl(funruralDevido - funruralPago)}` : 'em dia'} />
        </StatGrid>
      </div>

      <div className="mb-4 max-w-xs"><Field label="Tipo"><Select value={tipoF} onChange={(ev) => setTipoF(ev.target.value as TipoDocumento | '')} vazio="Todos" opcoes={TIPOS.map((t) => ({ value: t, label: t }))} /></Field></div>

      <Card pad>
        {docs.length === 0 ? <Empty>Nenhum documento.</Empty> : (
          <Tabela>
            <thead><tr><th>Tipo</th><th>Número</th><th>Emissão</th><th>Vencimento</th><th>Detalhe</th><th className="r">Valor</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {docs.map((d) => {
                const dias = d.vencimento ? diasEntre(hoje, d.vencimento) : null;
                const status = d.status === 'vigente' && dias != null && dias < 0 ? 'vencido' : d.status;
                return (
                  <tr key={d.id}>
                    <td><Badge tone={d.tipo === 'GTA' ? 'leaf' : d.tipo === 'CAR' ? 'earth' : 'neutral'}>{d.tipo}</Badge></td>
                    <td className="num max-w-[14rem] truncate" title={d.numero}>{d.numero}</td>
                    <td className="num">{isoToBrDate(d.emissao)}</td>
                    <td className="num">{d.vencimento ? <>{isoToBrDate(d.vencimento)}{dias != null && dias >= 0 && dias <= 60 ? <span className="ml-1 text-[11px] text-warn">({dias} d)</span> : null}</> : '—'}</td>
                    <td className="text-[12.5px] text-muted">{d.tipo === 'GTA' ? `${d.origem ?? ''} → ${d.destino ?? ''} · ${d.finalidade ?? ''} · ${d.quantidade ?? 0} cab` : d.obs ?? ''}</td>
                    <td className="r num">{d.valor ? brl(d.valor) : '—'}</td>
                    <td><Badge tone={status === 'vigente' ? 'leaf' : status === 'vencido' ? 'alert' : 'warn'}>{status}</Badge></td>
                    <td><button className="text-[12px] text-earth hover:text-ink" onClick={() => setEdit(d)}>editar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </Card>

      <div className="mt-6">
        <Aviso tone="earth" titulo="Próxima fase: emissão integrada">
          A GTA eletrônica é emitida no sistema do órgão estadual de defesa (ex.: SIDAGO, IMA, IAGRO). Por enquanto o DRAP Pecuária guarda o número, os animais e os vencimentos. A integração de emissão e a NF-e do produtor (reaproveitando o emissor do DRAP Fazenda) estão no roteiro.
        </Aviso>
      </div>

      {edit ? <EditarDoc d={edit} onFechar={() => setEdit(null)} /> : null}
    </>
  );
}

function EditarDoc({ d, onFechar }: { d: Documento; onFechar: () => void }) {
  const [f, setF] = useState<Documento>(d);
  return (
    <Modal aberto onFechar={onFechar} titulo={d.numero ? `${d.tipo} ${d.numero}` : 'Novo documento'} eyebrow="Documento">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Tipo"><Select value={f.tipo} onChange={(ev) => setF({ ...f, tipo: ev.target.value as TipoDocumento })} opcoes={TIPOS.map((t) => ({ value: t, label: t }))} /></Field>
        <Field label="Número"><Input value={f.numero} onChange={(ev) => setF({ ...f, numero: ev.target.value })} /></Field>
        <Field label="Emissão"><Input type="date" value={f.emissao} onChange={(ev) => setF({ ...f, emissao: ev.target.value })} /></Field>
        <Field label="Vencimento"><Input type="date" value={f.vencimento ?? ''} onChange={(ev) => setF({ ...f, vencimento: ev.target.value || undefined })} /></Field>
        {f.tipo === 'GTA' ? <>
          <Field label="Origem"><Input value={f.origem ?? ''} onChange={(ev) => setF({ ...f, origem: ev.target.value })} /></Field>
          <Field label="Destino"><Input value={f.destino ?? ''} onChange={(ev) => setF({ ...f, destino: ev.target.value })} /></Field>
          <Field label="Finalidade"><Select value={f.finalidade ?? 'Abate'} onChange={(ev) => setF({ ...f, finalidade: ev.target.value })} opcoes={['Abate', 'Engorda', 'Recria', 'Reprodução', 'Exposição/Leilão'].map((x) => ({ value: x, label: x }))} /></Field>
          <Field label="Quantidade (cab)"><Input inputMode="numeric" value={f.quantidade ?? ''} onChange={(ev) => setF({ ...f, quantidade: Number(ev.target.value) || undefined })} /></Field>
        </> : null}
        <Field label="Valor (R$)"><Input inputMode="decimal" value={f.valor ?? ''} onChange={(ev) => setF({ ...f, valor: Number(ev.target.value.replace(',', '.')) || undefined })} /></Field>
        <Field label="Situação"><Select value={f.status} onChange={(ev) => setF({ ...f, status: ev.target.value as Documento['status'] })} opcoes={['vigente', 'pendente', 'vencido', 'cancelado'].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Observação" className="col-span-2"><Textarea value={f.obs ?? ''} onChange={(ev) => setF({ ...f, obs: ev.target.value })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.numero.trim()} onClick={() => { salvar('documentos', f); onFechar(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

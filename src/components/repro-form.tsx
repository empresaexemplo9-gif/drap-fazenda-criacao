'use client';

import { useState } from 'react';
import { useEstado, salvar, novoId, atualizar } from '@/lib/store';
import { useHoje, useIndices } from '@/lib/hooks';
import type { EventoReprodutivo, TipoEventoReprodutivo } from '@/lib/domain/types';
import { Field, Input, Select, Modal } from './ui';

export function NovoEventoRepro({ onFechar, ids }: { onFechar: () => void; ids: string[] }) {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const femeas = ids.map((id) => ix.animal.get(id)).filter((a) => a && a.sexo === 'F');
  const [f, setF] = useState<Partial<EventoReprodutivo>>({ data: hoje, animalId: femeas[0]?.id, tipo: 'ia' });
  const tipos: TipoEventoReprodutivo[] = ['cio', 'cobertura', 'ia', 'iatf', 'te', 'diagnostico', 'parto', 'aborto', 'secagem'];
  return (
    <Modal aberto onFechar={onFechar} titulo="Evento reprodutivo" eyebrow="Reprodução">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Data"><Input type="date" value={f.data} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Field>
        <Field label="Fêmea"><Select value={f.animalId} onChange={(ev) => setF({ ...f, animalId: ev.target.value })} opcoes={femeas.map((v) => ({ value: v!.id, label: `${v!.brinco}${v!.nome ? ` · ${v!.nome}` : ''}` }))} /></Field>
        <Field label="Evento"><Select value={f.tipo} onChange={(ev) => setF({ ...f, tipo: ev.target.value as TipoEventoReprodutivo })} opcoes={tipos.map((t) => ({ value: t, label: t.toUpperCase() }))} /></Field>
        {f.tipo === 'diagnostico' ? <Field label="Resultado"><Select value={f.resultado ?? 'prenhe'} onChange={(ev) => setF({ ...f, resultado: ev.target.value as 'prenhe' | 'vazia' })} opcoes={[{ value: 'prenhe', label: 'Prenhe' }, { value: 'vazia', label: 'Vazia' }]} /></Field> : null}
        {['ia', 'iatf', 'te', 'cobertura'].includes(f.tipo ?? '') ? <Field label="Sêmen / touro"><Input list="semens" value={f.semen ?? ''} onChange={(ev) => setF({ ...f, semen: ev.target.value })} /></Field> : null}
      </div>
      <datalist id="semens">{e.estoqueGenetico.filter((s) => s.tipo === 'semen').map((s) => <option key={s.id} value={s.identificacao} />)}</datalist>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.animalId} onClick={() => {
          salvar('reproducao', { id: novoId('rp'), ...f, resultado: f.tipo === 'diagnostico' ? f.resultado ?? 'prenhe' : undefined } as EventoReprodutivo);
          const s = e.estoqueGenetico.find((x) => x.identificacao === f.semen && x.doses > 0);
          if (s && ['ia', 'iatf'].includes(f.tipo ?? '')) atualizar('estoqueGenetico', s.id, { doses: s.doses - 1 });
          onFechar();
        }}>Registrar</button>
      </div>
    </Modal>
  );
}


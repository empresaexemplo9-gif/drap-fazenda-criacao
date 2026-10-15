'use client';

import { useEffect, useState } from 'react';
import { useEstado, salvar, salvarVarios, novoId } from '@/lib/store';
import { useHoje, usePerfil } from '@/lib/hooks';
import { addDias } from '@/lib/datas';
import type { Animal, Sexo } from '@/lib/domain/types';
import { Field, Input, Select, Modal, Textarea } from './ui';

export function MoverLote({ ids, onFeito }: { ids: string[]; onFeito: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const { lotes } = usePerfil();
  const [para, setPara] = useState(lotes[0]?.id ?? '');
  const [motivo, setMotivo] = useState('Apartação');
  function confirmar() {
    const de = new Set(ids.map((id) => e.animais.find((a) => a.id === id)?.loteId));
    salvar('movimentacoes', { id: novoId('mv'), data: hoje, animalIds: ids, deLoteId: de.size === 1 ? [...de][0] : undefined, paraLoteId: para, motivo });
    salvarVarios('animais', ids.map((id) => ({ ...e.animais.find((a) => a.id === id)!, loteId: para })));
    onFeito();
  }
  return (
    <div className="space-y-5">
      <Field label="Para o lote"><Select value={para} onChange={(ev) => setPara(ev.target.value)} opcoes={lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
      <Field label="Motivo"><Input value={motivo} onChange={(ev) => setMotivo(ev.target.value)} /></Field>
      <div className="flex justify-end"><button className="btn btn-primary" onClick={confirmar} disabled={!para}>Mover</button></div>
    </div>
  );
}

export function NovoAnimal({ aberto, onFechar, inicial }: { aberto: boolean; onFechar: () => void; inicial?: Partial<Animal> }) {
  const e = useEstado();
  const hoje = useHoje();
  const perfil = usePerfil();
  const racaPadrao = perfil.so === 'leite' ? 'Girolando 3/4' : perfil.so === 'genetica' ? 'Nelore PO' : 'Nelore';
  const vazio: Partial<Animal> = { sexo: perfil.so === 'leite' ? 'F' : 'M', raca: racaPadrao, nascimento: addDias(hoje, -365), origem: 'nascido', status: 'ativo', loteId: perfil.lotes[0]?.id, ...inicial };
  const [f, setF] = useState<Partial<Animal>>(vazio);
  const [peso, setPeso] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => { if (aberto) { setF({ ...vazio }); setPeso(''); setErro(''); } }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Animal>(k: K, v: Animal[K]) => setF((x) => ({ ...x, [k]: v }));

  function salvarAnimal() {
    if (!f.brinco?.trim()) return setErro('Informe o brinco.');
    if (e.animais.some((a) => a.id !== f.id && a.status === 'ativo' && a.brinco === f.brinco!.trim())) return setErro('Já existe um animal ativo com esse brinco.');
    if (f.rfid && e.animais.some((a) => a.id !== f.id && a.rfid === f.rfid)) return setErro('RFID já cadastrado em outro animal.');
    const a: Animal = {
      id: f.id ?? novoId('a'), brinco: f.brinco!.trim(), rfid: f.rfid || undefined, sisbov: f.sisbov || undefined, nome: f.nome || undefined,
      sexo: f.sexo as Sexo, raca: f.raca || 'SRD', nascimento: f.nascimento!, loteId: f.loteId || undefined, origem: f.origem ?? 'nascido',
      fornecedor: f.fornecedor || undefined, valorCompra: f.valorCompra, dataEntrada: f.dataEntrada ?? (f.origem === 'comprado' ? hoje : f.nascimento), dataSaida: f.dataSaida,
      paiId: f.paiId || undefined, maeId: f.maeId || undefined, paiExterno: f.paiExterno || undefined, registroGenealogico: f.registroGenealogico || undefined,
      status: f.status ?? 'ativo', obs: f.obs || undefined,
    };
    salvar('animais', a);
    const p = Number(peso.replace(',', '.'));
    if (p > 0) salvar('pesagens', { id: novoId('w'), animalId: a.id, data: hoje, pesoKg: p, metodo: 'balanca' });
    onFechar();
  }

  const machos = e.animais.filter((a) => a.sexo === 'M' && a.status === 'ativo' && (a.registroGenealogico || a.nome));
  const femeas = e.animais.filter((a) => a.sexo === 'F' && a.status === 'ativo');

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={f.id ? `Editar ${f.brinco ?? ''}` : 'Novo animal'} eyebrow="Rebanho" largura="max-w-2xl">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <Field label="Brinco *"><Input autoFocus value={f.brinco ?? ''} onChange={(ev) => set('brinco', ev.target.value)} /></Field>
        <Field label="RFID / chip"><Input value={f.rfid ?? ''} onChange={(ev) => set('rfid', ev.target.value)} placeholder="leitor ou digitação" /></Field>
        <Field label="SISBOV"><Input value={f.sisbov ?? ''} onChange={(ev) => set('sisbov', ev.target.value)} /></Field>
        <Field label="Sexo"><Select value={f.sexo} onChange={(ev) => set('sexo', ev.target.value as Sexo)} opcoes={[{ value: 'M', label: 'Macho' }, { value: 'F', label: 'Fêmea' }]} /></Field>
        <Field label="Raça"><Input value={f.raca ?? ''} onChange={(ev) => set('raca', ev.target.value)} list="racas" /></Field>
        <Field label="Nascimento"><Input type="date" value={f.nascimento} onChange={(ev) => set('nascimento', ev.target.value)} /></Field>
        <Field label="Lote"><Select value={f.loteId ?? ''} onChange={(ev) => set('loteId', ev.target.value)} vazio="Sem lote" opcoes={perfil.lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
        <Field label="Origem"><Select value={f.origem} onChange={(ev) => set('origem', ev.target.value as Animal['origem'])} opcoes={[{ value: 'nascido', label: 'Nascido na fazenda' }, { value: 'comprado', label: 'Comprado' }]} /></Field>
        {!f.id ? <Field label="Peso de entrada (kg)"><Input inputMode="decimal" value={peso} onChange={(ev) => setPeso(ev.target.value)} /></Field> : null}
        {f.origem === 'comprado' ? <>
          <Field label="Fornecedor / origem" className="sm:col-span-2"><Input value={f.fornecedor ?? ''} onChange={(ev) => set('fornecedor', ev.target.value)} list="fornecedores" /></Field>
          <Field label="Valor pago (R$/cab)"><Input inputMode="decimal" value={f.valorCompra ?? ''} onChange={(ev) => set('valorCompra', Number(ev.target.value.replace(',', '.')) || undefined)} /></Field>
        </> : null}
        <Field label="Nome"><Input value={f.nome ?? ''} onChange={(ev) => set('nome', ev.target.value)} /></Field>
        <Field label="Pai"><Select value={f.paiId ?? ''} onChange={(ev) => set('paiId', ev.target.value)} vazio="—" opcoes={machos.map((a) => ({ value: a.id, label: a.nome ?? a.brinco }))} /></Field>
        <Field label="Mãe"><Select value={f.maeId ?? ''} onChange={(ev) => set('maeId', ev.target.value)} vazio="—" opcoes={femeas.map((a) => ({ value: a.id, label: `${a.brinco}${a.nome ? ` · ${a.nome}` : ''}` }))} /></Field>
        <Field label="Pai externo (sêmen)"><Input value={f.paiExterno ?? ''} onChange={(ev) => set('paiExterno', ev.target.value)} /></Field>
        <Field label="Registro genealógico"><Input value={f.registroGenealogico ?? ''} onChange={(ev) => set('registroGenealogico', ev.target.value)} /></Field>
        <Field label="Observação" className="col-span-2 sm:col-span-3"><Textarea value={f.obs ?? ''} onChange={(ev) => set('obs', ev.target.value)} /></Field>
      </div>
      <datalist id="racas">{['Nelore', 'Nelore PO', 'Angus', 'Nelore x Angus', 'Brahman', 'Senepol', 'Girolando 1/2', 'Girolando 3/4', 'Girolando 5/8', 'Holandês', 'Gir Leiteiro', 'Jersey', 'Tabapuã', 'Guzerá', 'SRD'].map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="fornecedores">{[...new Set(e.animais.map((a) => a.fornecedor).filter(Boolean))].map((r) => <option key={r} value={r} />)}</datalist>
      {erro ? <p className="mt-4 text-[13px] text-alert">{erro}</p> : null}
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" onClick={salvarAnimal}>Salvar animal</button>
      </div>
    </Modal>
  );
}


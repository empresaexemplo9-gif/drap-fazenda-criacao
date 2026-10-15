'use client';

/**
 * Tela de curral. Pensada para o tronco: botões grandes, um campo que
 * recebe o leitor RFID (os bastões funcionam como teclado e mandam Enter)
 * ou o brinco digitado, e três operações em sequência rápida: pesar,
 * aplicar e apartar. Cada leitura fica registrada com quem anotou, e tudo
 * funciona sem sinal.
 */

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Scale, Syringe, ArrowRightLeft, ScanLine, CheckCircle2, TriangleAlert, Undo2 } from 'lucide-react';
import { useEstado, salvar, novoId, remover, atualizar } from '@/lib/store';
import { useHoje, useIndices } from '@/lib/hooks';
import { num } from '@/lib/format';
import { pesoAtual, carenciasAtivas, categoriaDe, ROTULO_CATEGORIA } from '@/lib/domain/rebanho';
import { diasEntre } from '@/lib/datas';
import type { Animal, TipoSanitario } from '@/lib/domain/types';
import { ROT_SANITARIO, opcoes } from '@/lib/rotulos';
import { PageHeader, Em, Card, Field, Input, Select, Badge, cx, Aviso } from '@/components/ui';

type Modo = 'pesagem' | 'aplicacao' | 'apartacao';

interface Leitura { id: string; animal: Animal; texto: string; registroId?: string; colecao?: 'pesagens' | 'sanidade' | 'movimentacoes' }

export default function ManejoPage() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const [modo, setModo] = useState<Modo>('pesagem');
  const [codigo, setCodigo] = useState('');
  const [peso, setPeso] = useState('');
  const [atual, setAtual] = useState<Animal | null>(null);
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro' | 'aviso'; texto: string } | null>(null);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  // aplicação em série
  const [ap, setAp] = useState({ tipo: 'vacina' as TipoSanitario, produto: '', partida: '', dose: '5', carneD: '0', leiteD: '0', insumoId: '' });
  const [aplicacaoId, setAplicacaoId] = useState<string | null>(null);
  // apartação
  const [destino, setDestino] = useState(e.lotes[0]?.id ?? '');
  const codRef = useRef<HTMLInputElement>(null);
  const pesoRef = useRef<HTMLInputElement>(null);

  const carencias = useMemo(() => new Map(carenciasAtivas(e.sanidade, hoje).map((c) => [c.animalId, c])), [e.sanidade, hoje]);

  useEffect(() => { codRef.current?.focus(); }, [modo]);

  function localizar(cod: string): Animal | undefined {
    const c = cod.trim().replace(/\s+/g, ' ');
    if (!c) return undefined;
    const semEspaco = c.replace(/\s/g, '');
    return e.animais.find((a) => a.status === 'ativo' && (a.brinco === c || a.rfid?.replace(/\s/g, '') === semEspaco || a.sisbov === c));
  }

  function ler(ev: React.FormEvent) {
    ev.preventDefault();
    const a = localizar(codigo);
    if (!a) { setMsg({ tom: 'erro', texto: `Brinco/RFID "${codigo}" não encontrado entre os animais ativos.` }); setCodigo(''); return; }
    setAtual(a);
    setCodigo('');
    const c = carencias.get(a.id);
    setMsg(c ? { tom: 'aviso', texto: `${a.brinco} está em carência de ${c.produto} até ${c.liberaCarne.split('-').reverse().join('/')}.` } : null);
    if (modo === 'pesagem') setTimeout(() => pesoRef.current?.focus(), 30);
    if (modo === 'aplicacao') aplicar(a);
    if (modo === 'apartacao') apartar(a);
  }

  function registrarPeso(ev: React.FormEvent) {
    ev.preventDefault();
    if (!atual) return;
    const p = Number(peso.replace(',', '.'));
    if (!(p > 20 && p < 1500)) { setMsg({ tom: 'erro', texto: 'Peso fora da faixa (20 a 1500 kg).' }); return; }
    const hist = ix.pesagens.get(atual.id) ?? [];
    const ult = hist[hist.length - 1];
    const reg = salvar('pesagens', { id: novoId('w'), animalId: atual.id, data: hoje, pesoKg: p, metodo: 'balanca' });
    let texto = `${atual.brinco}: ${p} kg`;
    if (ult && ult.data < hoje) {
      const dias = diasEntre(ult.data, hoje);
      const g = (p - ult.pesoKg) / dias;
      texto += ` · ${p - ult.pesoKg >= 0 ? '+' : ''}${Math.round(p - ult.pesoKg)} kg em ${dias} d (GMD ${num(g, 3)})`;
      if (g < 0) setMsg({ tom: 'aviso', texto: `${atual.brinco} perdeu peso desde a última pesagem. Conferir sanidade.` });
    }
    setLeituras((l) => [{ id: reg.id, animal: atual, texto, registroId: reg.id, colecao: 'pesagens' }, ...l]);
    setPeso('');
    setAtual(null);
    codRef.current?.focus();
  }

  function aplicar(a: Animal) {
    if (!ap.produto.trim() || !ap.partida.trim()) { setMsg({ tom: 'erro', texto: 'Preencha produto e partida antes de ler os animais.' }); return; }
    if (aplicacaoId) {
      const reg = e.sanidade.find((s) => s.id === aplicacaoId);
      if (reg?.animalIds.includes(a.id)) { setMsg({ tom: 'aviso', texto: `${a.brinco} já recebeu esta aplicação.` }); return; }
      atualizar('sanidade', aplicacaoId, { animalIds: [...(reg?.animalIds ?? []), a.id] });
    } else {
      const id = novoId('s');
      salvar('sanidade', {
        id, data: hoje, tipo: ap.tipo, produto: ap.produto.trim(), partida: ap.partida.trim(), insumoId: ap.insumoId || undefined,
        animalIds: [a.id], doseMl: Number(ap.dose.replace(',', '.')) || 0, carenciaCarneDias: Number(ap.carneD) || 0, carenciaLeiteDias: Number(ap.leiteD) || 0,
        responsavel: e.operadorId ? ix.pessoa.get(e.operadorId)?.nome : undefined,
      });
      setAplicacaoId(id);
    }
    setLeituras((l) => [{ id: novoId('r'), animal: a, texto: `${a.brinco}: ${ap.produto} ${ap.dose} mL` }, ...l]);
    setAtual(null);
  }

  function encerrarAplicacao() {
    if (aplicacaoId && ap.insumoId) {
      const reg = e.sanidade.find((s) => s.id === aplicacaoId);
      const ins = e.insumos.find((i) => i.id === ap.insumoId);
      if (reg && ins) {
        const qtd = ins.unidade === 'dose' ? reg.animalIds.length : reg.animalIds.length * reg.doseMl;
        salvar('movEstoque', { id: novoId('m'), insumoId: ins.id, data: hoje, tipo: 'saida', quantidade: qtd, destino: `Aplicação em ${reg.animalIds.length} animais` });
      }
    }
    setAplicacaoId(null);
    setLeituras([]);
    setMsg({ tom: 'ok', texto: 'Aplicação encerrada e baixada do estoque.' });
  }

  function apartar(a: Animal) {
    if (!destino) return;
    if (a.loteId === destino) { setMsg({ tom: 'aviso', texto: `${a.brinco} já está neste lote.` }); return; }
    const reg = salvar('movimentacoes', { id: novoId('mv'), data: hoje, animalIds: [a.id], deLoteId: a.loteId, paraLoteId: destino, motivo: 'Apartação no curral' });
    atualizar('animais', a.id, { loteId: destino });
    setLeituras((l) => [{ id: reg.id, animal: a, texto: `${a.brinco}: ${ix.lote.get(a.loteId ?? '')?.nome ?? 'sem lote'} → ${ix.lote.get(destino)?.nome}`, registroId: reg.id, colecao: 'movimentacoes' }, ...l]);
    setAtual(null);
  }

  function desfazer(l: Leitura) {
    if (l.colecao === 'pesagens' && l.registroId) remover('pesagens', l.registroId);
    if (l.colecao === 'movimentacoes' && l.registroId) {
      const mv = e.movimentacoes.find((m) => m.id === l.registroId);
      if (mv) atualizar('animais', l.animal.id, { loteId: mv.deLoteId });
      remover('movimentacoes', l.registroId);
    }
    setLeituras((xs) => xs.filter((x) => x.id !== l.id));
  }

  const hist = atual ? ix.pesagens.get(atual.id) : undefined;
  const modos: { id: Modo; label: string; Icon: typeof Scale }[] = [
    { id: 'pesagem', label: 'Pesagem', Icon: Scale },
    { id: 'aplicacao', label: 'Aplicação', Icon: Syringe },
    { id: 'apartacao', label: 'Apartação', Icon: ArrowRightLeft },
  ];
  const insumosSan = e.insumos.filter((i) => ['vacina', 'medicamento'].includes(i.categoria));

  return (
    <div className="mx-auto max-w-reading">
      <PageHeader eyebrow="II · Manejo de curral" title={<>Leia o brinco, <Em>anote na hora</Em></>}
        sub="Funciona com leitor RFID em modo teclado, bastão bluetooth ou digitação do brinco. Sem sinal, tudo fica guardado no aparelho." />

      <div className="mb-6 grid grid-cols-3 gap-2">
        {modos.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => { setModo(id); setLeituras([]); setAtual(null); setMsg(null); setAplicacaoId(null); }}
            className={cx('card flex flex-col items-center gap-2 rounded-sm px-3 py-5 text-[15px] font-semibold transition-colors', modo === id ? 'border-leaf bg-leafLt text-leafDk' : 'text-muted hover:text-ink')}>
            <Icon className="h-6 w-6" strokeWidth={1.5} /> {label}
          </button>
        ))}
      </div>

      {modo === 'aplicacao' ? (
        <Card eyebrow="1 · Produto" title="O que está sendo aplicado" className="mb-5">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Field label="Tipo"><Select disabled={!!aplicacaoId} value={ap.tipo} onChange={(ev) => setAp({ ...ap, tipo: ev.target.value as TipoSanitario })} opcoes={opcoes(ROT_SANITARIO)} /></Field>
            <Field label="Do estoque"><Select disabled={!!aplicacaoId} value={ap.insumoId} vazio="—" opcoes={insumosSan.map((i) => ({ value: i.id, label: i.nome }))}
              onChange={(ev) => { const i = insumosSan.find((x) => x.id === ev.target.value); setAp({ ...ap, insumoId: ev.target.value, produto: i?.nome ?? ap.produto }); }} /></Field>
            <Field label="Produto *" className="col-span-2"><Input disabled={!!aplicacaoId} value={ap.produto} onChange={(ev) => setAp({ ...ap, produto: ev.target.value })} /></Field>
            <Field label="Partida (lote do frasco) *"><Input disabled={!!aplicacaoId} value={ap.partida} onChange={(ev) => setAp({ ...ap, partida: ev.target.value })} /></Field>
            <Field label="Dose (mL)"><Input disabled={!!aplicacaoId} inputMode="decimal" value={ap.dose} onChange={(ev) => setAp({ ...ap, dose: ev.target.value })} /></Field>
            <Field label="Carência carne (dias)"><Input disabled={!!aplicacaoId} inputMode="numeric" value={ap.carneD} onChange={(ev) => setAp({ ...ap, carneD: ev.target.value })} /></Field>
            <Field label="Carência leite (dias)"><Input disabled={!!aplicacaoId} inputMode="numeric" value={ap.leiteD} onChange={(ev) => setAp({ ...ap, leiteD: ev.target.value })} /></Field>
          </div>
          {aplicacaoId ? (
            <div className="mt-4 flex items-center justify-between rounded-sm bg-leafLt/60 px-3 py-2 text-[13px]">
              <span><span className="num font-semibold">{e.sanidade.find((s) => s.id === aplicacaoId)?.animalIds.length ?? 0}</span> animais nesta aplicação</span>
              <button className="btn btn-leaf btn-sm" onClick={encerrarAplicacao}>Encerrar aplicação</button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {modo === 'apartacao' ? (
        <Card eyebrow="1 · Destino" title="Para qual lote vão os animais lidos" className="mb-5">
          <Field label="Lote de destino"><Select value={destino} onChange={(ev) => setDestino(ev.target.value)} opcoes={e.lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
        </Card>
      ) : null}

      <Card eyebrow={modo === 'pesagem' ? '1 · Animal' : '2 · Animais'} title="Leitura">
        <form onSubmit={ler} className="flex items-end gap-3">
          <Field label="Brinco, RFID ou SISBOV" className="flex-1">
            <div className="relative">
              <ScanLine className="absolute left-0 top-3 h-5 w-5 text-earth" strokeWidth={1.5} />
              <input ref={codRef} value={codigo} onChange={(ev) => setCodigo(ev.target.value)} autoComplete="off" inputMode="text"
                className="field-input num pl-8 text-2xl" placeholder="aguardando…" aria-label="Brinco ou RFID" />
            </div>
          </Field>
          <button type="submit" className="btn btn-primary">Ler</button>
        </form>
        <p className="mt-2 text-[11.5px] text-muted">Dica: brincos da demo vão de 1001 a 1310. RFID no formato 982 0000…</p>

        {msg ? (
          <div className={cx('mt-4 flex items-start gap-2 rounded-sm px-3 py-2 text-[13px]', msg.tom === 'erro' ? 'bg-alertLt text-alert' : msg.tom === 'aviso' ? 'bg-warnLt text-warn' : 'bg-leafLt text-leafDk')}>
            {msg.tom === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <TriangleAlert className="mt-0.5 h-4 w-4" />}
            {msg.texto}
          </div>
        ) : null}

        {modo === 'pesagem' && atual ? (
          <div className="mt-5 rounded-sm border border-rule bg-paper/60 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/animal/?id=${atual.id}`} className="font-display text-3xl font-semibold"><span className="num">{atual.brinco}</span> {atual.nome ? <Em>{atual.nome}</Em> : null}</Link>
              <div className="flex gap-2">
                <Badge tone="earth">{ROTULO_CATEGORIA[categoriaDe(atual, hoje)]}</Badge>
                <Badge>{ix.lote.get(atual.loteId ?? '')?.nome ?? 'sem lote'}</Badge>
              </div>
            </div>
            <p className="mt-1 text-[13px] text-muted">Última pesagem: {hist?.length ? `${hist[hist.length - 1].pesoKg} kg em ${hist[hist.length - 1].data.split('-').reverse().join('/')}` : 'nunca pesado'} · estimado hoje {Math.round(pesoAtual(atual, hist, hoje))} kg</p>
            <form onSubmit={registrarPeso} className="mt-4 flex items-end gap-3">
              <Field label="Peso da balança (kg)" className="flex-1">
                <input ref={pesoRef} value={peso} onChange={(ev) => setPeso(ev.target.value)} inputMode="decimal" className="field-input num text-3xl" aria-label="Peso" />
              </Field>
              <button type="submit" className="btn btn-leaf px-6 py-4 text-base">Gravar</button>
            </form>
          </div>
        ) : null}
      </Card>

      <Card className="mt-5" eyebrow="Nesta sessão" title={`${leituras.length} registro(s)`}>
        {leituras.length === 0 ? <p className="text-[13px] italic text-muted">As leituras aparecem aqui. Toque em desfazer se errou o animal.</p> : (
          <ul className="divide-y divide-rule/40 text-[14px]">
            {leituras.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span className="num">{l.texto}</span>
                {l.registroId ? <button className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-alert" onClick={() => desfazer(l)}><Undo2 className="h-3.5 w-3.5" /> desfazer</button> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-5">
        <Aviso tone="earth" titulo="Balança e leitor">
          Leitores RFID em modo teclado (HID) e balanças que mandam o peso pelo teclado funcionam direto nos campos acima. A integração por Bluetooth (Web Bluetooth/Serial) está prevista no roteiro de integrações.
        </Aviso>
      </div>
    </div>
  );
}

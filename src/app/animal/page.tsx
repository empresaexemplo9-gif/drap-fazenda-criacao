'use client';

/**
 * Ficha do animal: histórico completo e verificável (pesagens, sanidade,
 * reprodução, produção, genética, movimentações e quem anotou cada coisa).
 * Rota estática /animal/?id=… para funcionar na exportação offline.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Printer } from 'lucide-react';
import { useEstado, salvar, novoId, atualizar } from '@/lib/store';
import { useHoje, useIndices } from '@/lib/hooks';
import { num, isoToBrDate, isoToBrShort, brl } from '@/lib/format';
import { idadeMeses, addDias } from '@/lib/datas';
import { categoriaDe, ROTULO_CATEGORIA, pesoAtual, gmd, uaDe, carenciasAtivas } from '@/lib/domain/rebanho';
import { del, ultimoParto } from '@/lib/domain/leite';
import { arvore, consanguinidade, impressaoDigital } from '@/lib/domain/genetica';
import { ROT_SANITARIO, ROT_STATUS, ROT_FASE } from '@/lib/rotulos';
import type { Ocorrencia } from '@/lib/domain/types';
import { Card, Badge, Tabela, Stat, StatGrid, Field, Input, Select, Empty, Em, Aviso, Modal } from '@/components/ui';
import { Linha } from '@/components/graficos';
import { NovoAnimal } from '@/components/rebanho-forms';

export default function AnimalPage() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => { setId(new URLSearchParams(window.location.search).get('id')); }, []);
  const ix = useIndices();
  const a = id ? ix.animal.get(id) : undefined;
  if (id === null) return null;
  if (!a) return <Empty>Animal não encontrado. <Link className="text-earth underline" href="/rebanho/">Voltar ao rebanho</Link></Empty>;
  return <Ficha key={a.id} animalId={a.id} />;
}

function Ficha({ animalId }: { animalId: string }) {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const a = ix.animal.get(animalId)!;
  const hist = ix.pesagens.get(a.id) ?? [];
  const lote = a.loteId ? ix.lote.get(a.loteId) : undefined;
  const cat = categoriaDe(a, hoje, lote?.fase === 'reprodutores');
  const peso = pesoAtual(a, hist, hoje);
  const g = gmd(hist);
  const carencia = carenciasAtivas(e.sanidade, hoje).find((c) => c.animalId === a.id);
  const sanidade = e.sanidade.filter((s) => s.animalIds.includes(a.id)).sort((x, y) => y.data.localeCompare(x.data));
  const repro = e.reproducao.filter((r) => r.animalId === a.id).sort((x, y) => y.data.localeCompare(x.data));
  const avaliacao = e.avaliacoes.filter((v) => v.animalId === a.id).sort((x, y) => y.safra.localeCompare(x.safra))[0];
  const prova = e.provas.filter((p) => p.animalId === a.id).pop();
  const movs = e.movimentacoes.filter((m) => m.animalIds.includes(a.id));
  const ocorr = e.ocorrencias.filter((o) => o.animalId === a.id);
  const filhos = e.animais.filter((x) => x.paiId === a.id || x.maeId === a.id);
  const ped = arvore(e.animais, a.id, 3);
  const F = consanguinidade(e.animais, a.id);
  const delHoje = a.sexo === 'F' ? del(e.reproducao, a.id, hoje) : null;
  const ordenhas = e.ordenhas.filter((o) => o.animalId === a.id);
  const litros30 = ordenhas.filter((o) => o.data >= addDias(hoje, -29)).reduce((s, o) => s + o.litros, 0);
  const quem = (pid?: string) => (pid ? ix.pessoa.get(pid)?.nome.split(' ')[0] : undefined) ?? '—';

  const [hash, setHash] = useState('');
  useEffect(() => {
    impressaoDigital({ a, hist, sanidade, repro, avaliacao, prova }).then((h) => setHash(h.slice(0, 16)));
  }, [a, hist, sanidade, repro, avaliacao, prova]);

  const [editar, setEditar] = useState(false);
  const [ocorrencia, setOcorrencia] = useState(false);
  const [novoPeso, setNovoPeso] = useState('');

  const pontosPeso = useMemo(() => hist.map((p) => ({ x: p.data, y: p.pesoKg })), [hist]);
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of ordenhas) m.set(o.data, (m.get(o.data) ?? 0) + o.litros);
    return [...m].sort((x, y) => x[0].localeCompare(y[0])).map(([x, y]) => ({ x, y }));
  }, [ordenhas]);

  return (
    <div className="mx-auto max-w-reading">
      <Link href="/rebanho/" className="no-print mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Rebanho</Link>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="eyebrow">{a.raca} · {ROTULO_CATEGORIA[cat]} · {a.sexo === 'M' ? 'Macho' : 'Fêmea'}</span>
          <h1 className="mt-2 font-display text-5xl font-semibold leading-none tracking-tight">
            <span className="num">{a.brinco}</span>{a.nome ? <> <Em>{a.nome}</Em></> : null}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={a.status === 'ativo' ? 'leaf' : 'neutral'}>{ROT_STATUS[a.status]}</Badge>
            {lote ? <Badge tone="earth">{lote.nome}</Badge> : null}
            {carencia ? <Badge tone="warn">carência até {isoToBrShort(carencia.bloqueiaCarne ? carencia.liberaCarne : carencia.liberaLeite)}</Badge> : null}
            {a.registroGenealogico ? <Badge tone="ink">{a.registroGenealogico}</Badge> : null}
          </div>
        </div>
        <div className="no-print flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Imprimir ficha</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditar(true)}><Pencil className="h-3.5 w-3.5" /> Editar</button>
          {a.status === 'ativo' ? <button className="btn btn-ghost btn-sm" onClick={() => setOcorrencia(true)}>Baixa / ocorrência</button> : null}
        </div>
      </header>

      <StatGrid cols={4}>
        <Stat label="Peso atual" value={hist.length ? `${Math.round(peso)} kg` : '—'} hint={hist.length ? `pesado em ${isoToBrDate(hist[hist.length - 1].data)}` : 'nunca pesado'} />
        <Stat label="GMD" value={g != null ? `${num(g, 3)} kg/d` : '—'} tone="leaf" hint={`${hist.length} pesagens`} />
        <Stat label="Idade" value={`${num(idadeMeses(a.nascimento, hoje), 1)} m`} hint={`nasc. ${isoToBrDate(a.nascimento)}`} />
        <Stat label={a.sexo === 'F' && delHoje != null ? 'Dias em lactação' : 'Unidade animal'} value={a.sexo === 'F' && delHoje != null ? delHoje : num(uaDe(peso), 1)} hint={a.sexo === 'F' && delHoje != null ? `${num(litros30, 1)} L nos últimos 30 dias` : '1 UA = 450 kg'} />
      </StatGrid>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card eyebrow="Identificação" title="Dados do animal" className="lg:col-span-1">
          <dl className="space-y-1.5 text-[13px]">
            {[
              ['RFID / chip', a.rfid], ['SISBOV', a.sisbov], ['Origem', a.origem === 'comprado' ? `Comprado · ${a.fornecedor ?? ''}` : 'Nascido na fazenda'],
              ['Valor de compra', a.valorCompra ? brl(a.valorCompra) : undefined], ['Entrada', a.dataEntrada ? isoToBrDate(a.dataEntrada) : undefined],
              ['Saída', a.dataSaida ? isoToBrDate(a.dataSaida) : undefined], ['Fase do lote', lote ? ROT_FASE[lote.fase] : undefined],
              ['Cadastrado por', quem(a.por)], ['Observação', a.obs],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3 border-b border-rule/40 pb-1.5 last:border-0"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
            ))}
          </dl>
        </Card>

        <Card eyebrow="Desempenho" title="Curva de peso" className="lg:col-span-2"
          actions={a.status === 'ativo' ? (
            <form className="no-print flex items-center gap-2" onSubmit={(ev) => {
              ev.preventDefault(); const p = Number(novoPeso.replace(',', '.'));
              if (p > 0) { salvar('pesagens', { id: novoId('w'), animalId: a.id, data: hoje, pesoKg: p, metodo: 'balanca' }); setNovoPeso(''); }
            }}>
              <input className="field-input w-20 py-1 text-[13px]" inputMode="decimal" placeholder="kg" value={novoPeso} onChange={(ev) => setNovoPeso(ev.target.value)} aria-label="Novo peso" />
              <button className="btn btn-ghost btn-sm" type="submit"><Plus className="h-3.5 w-3.5" /> Pesagem</button>
            </form>
          ) : null}>
          <Linha pontos={pontosPeso} formatar={(v) => `${Math.round(v)} kg`} rotuloX={(x) => isoToBrShort(x)} />
          {hist.length ? (
            <Tabela className="mt-3">
              <thead><tr><th>Data</th><th className="r">Peso</th><th className="r">Ganho</th><th className="r">GMD</th><th>Por</th></tr></thead>
              <tbody>{[...hist].reverse().map((p, i, arr) => {
                const ant = arr[i + 1];
                const dias = ant ? (Date.parse(p.data) - Date.parse(ant.data)) / 864e5 : 0;
                return (
                  <tr key={p.id}><td className="num">{isoToBrDate(p.data)}</td><td className="r num">{p.pesoKg} kg</td>
                    <td className="r num">{ant ? `${p.pesoKg - ant.pesoKg > 0 ? '+' : ''}${Math.round(p.pesoKg - ant.pesoKg)}` : '—'}</td>
                    <td className="r num">{ant && dias > 0 ? num((p.pesoKg - ant.pesoKg) / dias, 3) : '—'}</td><td className="text-muted">{quem(p.por)}</td></tr>
                );
              })}</tbody>
            </Tabela>
          ) : null}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card eyebrow="Sanidade" title="Aplicações">
          {sanidade.length === 0 ? <Empty>Nenhuma aplicação registrada.</Empty> : (
            <ul className="divide-y divide-rule/40 text-[13px]">
              {sanidade.map((s) => (
                <li key={s.id} className="py-2">
                  <div className="flex justify-between gap-3"><span className="font-medium">{s.produto}</span><span className="num text-muted">{isoToBrDate(s.data)}</span></div>
                  <div className="text-[12px] text-muted">{ROT_SANITARIO[s.tipo]} · partida {s.partida} · {s.doseMl} mL · carência {s.carenciaCarneDias} d carne{s.carenciaLeiteDias ? ` / ${s.carenciaLeiteDias} d leite` : ''} · {s.responsavel ?? quem(s.por)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {a.sexo === 'F' ? (
          <Card eyebrow="Reprodução" title={ultimoParto(e.reproducao, a.id, hoje) ? `Último parto ${isoToBrDate(ultimoParto(e.reproducao, a.id, hoje)!)}` : 'Histórico reprodutivo'}>
            {repro.length === 0 ? <Empty>Sem eventos reprodutivos.</Empty> : (
              <ul className="divide-y divide-rule/40 text-[13px]">
                {repro.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 py-2">
                    <span><Badge tone={r.tipo === 'parto' ? 'leaf' : r.tipo === 'diagnostico' ? (r.resultado === 'prenhe' ? 'leaf' : 'alert') : 'earth'}>{r.tipo === 'diagnostico' ? `DG ${r.resultado ?? ''}` : r.tipo.toUpperCase()}</Badge> <span className="text-muted">{r.semen ?? (r.touroId ? ix.animal.get(r.touroId)?.nome : '') ?? ''}{r.protocolo ? ` · ${r.protocolo}` : ''}</span></span>
                    <span className="num text-muted">{isoToBrDate(r.data)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card eyebrow="Movimentações" title="Lotes e ocorrências">
            {movs.length + ocorr.length === 0 ? <Empty>Sem movimentações registradas.</Empty> : (
              <ul className="divide-y divide-rule/40 text-[13px]">
                {movs.map((m) => <li key={m.id} className="py-2"><span className="num text-muted">{isoToBrDate(m.data)}</span> · {m.deLoteId ? ix.lote.get(m.deLoteId)?.nome : '—'} → {m.paraLoteId ? ix.lote.get(m.paraLoteId)?.nome : '—'} · {m.motivo}</li>)}
                {ocorr.map((o) => <li key={o.id} className="py-2 text-alert"><span className="num">{isoToBrDate(o.data)}</span> · {o.tipo} · {o.causa}</li>)}
              </ul>
            )}
          </Card>
        )}
      </div>

      {porDia.length ? (
        <Card className="mt-5" eyebrow="Leite" title="Produção diária (L)">
          <Linha pontos={porDia} formatar={(v) => `${num(v, 1)} L`} rotuloX={(x) => isoToBrShort(x)} cor="#7A5C3B" desdeZero />
        </Card>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card eyebrow="Genealogia" title={`Árvore até a 3ª geração${F > 0 ? ` · F = ${num(F * 100, 1)}%` : ''}`}>
          {ped.length === 0 ? <Empty>Pais não informados.</Empty> : (
            <ul className="space-y-1 text-[13px]">
              {ped.map((p, i) => (
                <li key={i} style={{ paddingLeft: `${(p.nivel - 1) * 18}px` }} className="flex gap-2">
                  <span className="num w-8 text-[11px] text-earth">{p.lado}</span>
                  {p.id ? <Link href={`/animal/?id=${p.id}`} className="hover:text-leaf">{p.rotulo}</Link> : <span className="text-muted">{p.rotulo}</span>}
                </li>
              ))}
            </ul>
          )}
          {filhos.length ? <p className="mt-3 text-[12px] text-muted">Progênie registrada: <span className="num">{filhos.length}</span></p> : null}
        </Card>
        <Card eyebrow="Avaliação genética" title={avaliacao ? `${avaliacao.programa} ${avaliacao.safra}${avaliacao.top ? ` · TOP ${avaliacao.top}%` : ''}` : 'Sem avaliação'}>
          {avaliacao ? (
            <div className="grid grid-cols-3 gap-3 text-[13px] sm:grid-cols-5">
              {Object.entries(avaliacao.deps).map(([k, v]) => (
                <div key={k}><div className="eyebrow text-muted">{k}</div><div className={`num text-[15px] ${v >= 0 ? 'text-leafDk' : 'text-alert'}`}>{v >= 0 ? '+' : ''}{num(v)}</div></div>
              ))}
              {avaliacao.indice ? <div><div className="eyebrow text-muted">Índice</div><div className="num text-[15px]">{num(avaliacao.indice, 1)}</div></div> : null}
            </div>
          ) : <Empty>Cadastre DEPs no módulo Genética.</Empty>}
          {prova ? <p className="mt-3 text-[12px] text-muted">Prova {isoToBrDate(prova.data)} · {prova.grupo}: {prova.pesoKg} kg · CE {prova.ceCm} cm · AOL {prova.aolCm2} cm² · EGS {prova.egsMm} mm</p> : null}
        </Card>
      </div>

      <div className="mt-5">
        <Aviso tone="leaf" titulo="Histórico verificável">
          Impressão digital deste histórico: <span className="num font-semibold">{hash || '…'}</span>. Ela muda se qualquer pesagem, aplicação ou avaliação for alterada. Imprima a ficha para o comprador conferir.
        </Aviso>
      </div>

      <NovoAnimal aberto={editar} onFechar={() => setEditar(false)} inicial={a} />
      <BaixaModal aberto={ocorrencia} onFechar={() => setOcorrencia(false)} animalId={a.id} />
    </div>
  );
}

function BaixaModal({ aberto, onFechar, animalId }: { aberto: boolean; onFechar: () => void; animalId: string }) {
  const hoje = useHoje();
  const [tipo, setTipo] = useState<Ocorrencia['tipo'] | 'venda'>('morte');
  const [data, setData] = useState(hoje);
  const [causa, setCausa] = useState('');
  function confirmar() {
    if (tipo === 'venda') {
      atualizar('animais', animalId, { status: 'vendido', dataSaida: data, loteId: undefined });
    } else {
      salvar('ocorrencias', { id: novoId('o'), data, animalId, tipo, causa: causa || 'Não informada' });
      atualizar('animais', animalId, { status: tipo === 'morte' ? 'morto' : tipo === 'descarte' ? 'descartado' : 'desaparecido', dataSaida: data, loteId: undefined });
    }
    onFechar();
  }
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Baixa do animal" eyebrow="Ocorrência">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Tipo"><Select value={tipo} onChange={(ev) => setTipo(ev.target.value as typeof tipo)} opcoes={[
          { value: 'morte', label: 'Morte' }, { value: 'roubo', label: 'Roubo' }, { value: 'desaparecimento', label: 'Desaparecimento' },
          { value: 'descarte', label: 'Descarte' }, { value: 'venda', label: 'Venda avulsa' },
        ]} /></Field>
        <Field label="Data"><Input type="date" value={data} onChange={(ev) => setData(ev.target.value)} /></Field>
        {tipo !== 'venda' ? <Field label="Causa / laudo" className="col-span-2"><Input value={causa} onChange={(ev) => setCausa(ev.target.value)} /></Field> : null}
      </div>
      <p className="mt-4 text-[12px] text-muted">A baixa tira o animal do lote e entra na conciliação e nos indicadores de mortalidade e desfrute. Para venda a frigorífico com GTA use o módulo Corte.</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" onClick={confirmar}>Confirmar baixa</button>
      </div>
    </Modal>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { Plus, Search, ArrowUpRight, ArrowRightLeft } from 'lucide-react';
import { useEstado, salvar, atualizar, novoId } from '@/lib/store';
import { useHoje, useIndices, usePerfil } from '@/lib/hooks';
import { num, isoToBrDate } from '@/lib/format';
import { idadeMeses, addDias } from '@/lib/datas';
import { categoriaDe, ROTULO_CATEGORIA, pesoAtual, gmd, uaDe, conciliarCabecas, carenciasAtivas, animaisDoLote, gmdGrupo } from '@/lib/domain/rebanho';
import { ROT_ATIVIDADE, ROT_FASE, ROT_STATUS, opcoes } from '@/lib/rotulos';
import type { Atividade, Fase, Lote, Sexo, StatusAnimal } from '@/lib/domain/types';
import { NovoAnimal, MoverLote } from '@/components/rebanho-forms';
import { PageHeader, Em, Card, Tabs, Tabela, Badge, Field, Input, Select, Modal, Empty, StatGrid, Stat, Aviso } from '@/components/ui';

type Aba = 'animais' | 'lotes' | 'conciliacao';

export default function RebanhoPage() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const [aba, setAba] = useState<Aba>('animais');
  const [busca, setBusca] = useState('');
  const [loteF, setLoteF] = useState('');
  const [statusF, setStatusF] = useState<StatusAnimal | ''>('ativo');
  const [sexoF, setSexoF] = useState<Sexo | ''>('');
  const [novo, setNovo] = useState(false);
  const [novoLote, setNovoLote] = useState<Lote | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [mover, setMover] = useState(false);
  const [limite, setLimite] = useState(60);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const a = q.get('aba');
    if (a === 'lotes' || a === 'conciliacao') setAba(a);
    const l = q.get('lote');
    if (l) setLoteF(l);
  }, []);

  const carencia = useMemo(() => new Set(carenciasAtivas(e.sanidade, hoje).map((c) => c.animalId)), [e.sanidade, hoje]);
  const perfil = usePerfil();
  const lotesVisiveis = perfil.lotes;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return e.animais
      .filter((a) => perfil.animalVisivel(a) && (!statusF || a.status === statusF) && (!loteF || a.loteId === loteF) && (!sexoF || a.sexo === sexoF))
      .filter((a) => !q || [a.brinco, a.rfid, a.nome, a.raca, a.sisbov, a.registroGenealogico].some((x) => x?.toLowerCase().includes(q)))
      .map((a) => {
        const hist = ix.pesagens.get(a.id);
        const peso = pesoAtual(a, hist, hoje);
        return { a, peso, pesado: !!hist?.length, gmd: gmd(hist), cat: categoriaDe(a, hoje, ix.lote.get(a.loteId ?? '')?.fase === 'reprodutores') };
      })
      .sort((x, y) => x.a.brinco.localeCompare(y.a.brinco, 'pt-BR', { numeric: true }));
  }, [e.animais, busca, statusF, loteF, sexoF, ix, hoje, perfil]);

  const ativosLista = lista.filter((x) => x.a.status === 'ativo');
  const ua = ativosLista.reduce((s, x) => s + uaDe(x.peso), 0);
  const gmdMedio = gmdGrupo(ativosLista.map((x) => x.a.id), ix.pesagens, addDias(hoje, -120), hoje);
  const conc = conciliarCabecas(lotesVisiveis, e.animais);
  const atividadesLote = perfil.atividades;
  const divergentes = conc.filter((c) => c.diferenca).length;

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <>
      <PageHeader
        eyebrow="I · Rebanho"
        title={<>Cada cabeça, <Em>no lote e no pasto</Em> certos</>}
        sub="Identificação individual por brinco, botton, chip ou RFID. Sai da caderneta e do WhatsApp para um lugar só."
        actions={<>
          <button className="btn btn-ghost" onClick={() => setNovoLote({ id: novoId('l'), nome: '', atividade: perfil.atividades[0] ?? 'corte', fase: perfil.atividades[0] === 'leite' ? 'lactacao' : perfil.atividades[0] === 'genetica' ? 'doadoras' : 'recria' })}><Plus className="h-4 w-4" /> Lote</button>
          <button className="btn btn-primary" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Animal</button>
        </>}
      />

      <div className="mb-8">
        <StatGrid cols={4}>
          <Stat label="Cabeças na seleção" value={ativosLista.length} hint={`${lista.length} registros no filtro`} />
          <Stat label="Unidades animais" value={num(ua, 1)} hint="1 UA = 450 kg PV" />
          <Stat label="GMD médio · 120 d" value={gmdMedio != null ? `${num(gmdMedio, 3)} kg` : '—'} tone="leaf" />
          <Stat label="Em carência" value={ativosLista.filter((x) => carencia.has(x.a.id)).length} tone="warn" hint="não embarcar para abate" />
        </StatGrid>
      </div>

      <Tabs<Aba> ativa={aba} onChange={setAba} abas={[
        { id: 'animais', label: 'Animais' },
        { id: 'lotes', label: 'Lotes', badge: lotesVisiveis.length },
        { id: 'conciliacao', label: 'Conciliação de cabeças', badge: divergentes || undefined },
      ]} />

      {aba === 'animais' && (
        <Card pad>
          <div className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-5">
            <Field label="Buscar" className="col-span-2">
              <div className="relative">
                <Search className="absolute left-0 top-2.5 h-4 w-4 text-muted" />
                <Input className="pl-6" placeholder="Brinco, RFID, nome, raça…" value={busca} onChange={(ev) => setBusca(ev.target.value)} />
              </div>
            </Field>
            <Field label="Lote"><Select value={loteF} onChange={(ev) => setLoteF(ev.target.value)} vazio="Todos" opcoes={lotesVisiveis.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
            <Field label="Situação"><Select value={statusF} onChange={(ev) => setStatusF(ev.target.value as StatusAnimal | '')} vazio="Todas" opcoes={opcoes(ROT_STATUS)} /></Field>
            <Field label="Sexo"><Select value={sexoF} onChange={(ev) => setSexoF(ev.target.value as Sexo | '')} vazio="Ambos" opcoes={[{ value: 'M', label: 'Machos' }, { value: 'F', label: 'Fêmeas' }]} /></Field>
          </div>
          {sel.size > 0 ? (
            <div className="mb-3 flex items-center justify-between rounded-sm bg-leafLt/60 px-3 py-2 text-[13px]">
              <span><span className="num font-semibold">{sel.size}</span> selecionado(s)</span>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>Limpar</button>
                <button className="btn btn-leaf btn-sm" onClick={() => setMover(true)}><ArrowRightLeft className="h-3.5 w-3.5" /> Mover de lote</button>
              </div>
            </div>
          ) : null}
          {lista.length === 0 ? <Empty>Nenhum animal no filtro.</Empty> : (
            <Tabela>
              <thead>
                <tr>
                  <th className="w-8"><input type="checkbox" aria-label="Selecionar todos" checked={sel.size > 0 && sel.size === ativosLista.length}
                    onChange={(ev) => setSel(ev.target.checked ? new Set(ativosLista.map((x) => x.a.id)) : new Set())} /></th>
                  <th>Brinco</th><th>Categoria</th><th>Raça</th><th className="r">Idade</th><th>Lote</th><th className="r">Peso</th><th className="r">GMD</th><th></th>
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, limite).map(({ a, peso, pesado, gmd: g, cat }) => (
                  <tr key={a.id}>
                    <td><input type="checkbox" disabled={a.status !== 'ativo'} checked={sel.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Selecionar ${a.brinco}`} /></td>
                    <td>
                      <Link href={`/animal/?id=${a.id}`} className="num font-semibold text-ink hover:text-leaf">{a.brinco}</Link>
                      {a.nome ? <div className="text-[11.5px] text-muted">{a.nome}</div> : null}
                    </td>
                    <td>
                      {ROTULO_CATEGORIA[cat]}
                      <div className="mt-0.5 flex gap-1">
                        {a.status !== 'ativo' ? <Badge tone="neutral">{ROT_STATUS[a.status]}</Badge> : null}
                        {carencia.has(a.id) ? <Badge tone="warn">carência</Badge> : null}
                      </div>
                    </td>
                    <td className="text-muted">{a.raca}</td>
                    <td className="r num">{num(idadeMeses(a.nascimento, hoje), 1)} m</td>
                    <td className="text-muted">{a.loteId ? ix.lote.get(a.loteId)?.nome : '—'}</td>
                    <td className="r num">{pesado ? `${Math.round(peso)} kg` : <span className="text-muted">~{Math.round(peso)}</span>}</td>
                    <td className="r num">{g != null ? num(g, 3) : '—'}</td>
                    <td className="r"><Link href={`/animal/?id=${a.id}`} className="text-earth hover:text-ink"><ArrowUpRight className="h-3.5 w-3.5" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
          {lista.length > limite ? (
            <div className="flex items-center justify-between pt-4 text-[12.5px] text-muted">
              <span>Mostrando {limite} de {lista.length}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setLimite((l) => l + 100)}>Mostrar mais 100</button>
            </div>
          ) : null}
        </Card>
      )}

      {aba === 'lotes' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {lotesVisiveis.map((l) => {
            const bichos = animaisDoLote(e.animais, l.id);
            const uaL = bichos.reduce((s, a) => s + uaDe(pesoAtual(a, ix.pesagens.get(a.id), hoje)), 0);
            const g = gmdGrupo(bichos.map((a) => a.id), ix.pesagens, addDias(hoje, -120), hoje);
            const pq = l.piqueteId ? ix.piquete.get(l.piqueteId) : undefined;
            return (
              <Card key={l.id} eyebrow={`${ROT_ATIVIDADE[l.atividade]} · ${ROT_FASE[l.fase]}`} title={l.nome}
                actions={<button className="text-[12px] font-medium text-earth hover:text-ink" onClick={() => setNovoLote(l)}>editar</button>}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
                  <div><dt className="eyebrow text-muted">Cabeças</dt><dd className="num text-lg">{bichos.length}</dd></div>
                  <div><dt className="eyebrow text-muted">UA</dt><dd className="num text-lg">{num(uaL, 1)}</dd></div>
                  <div><dt className="eyebrow text-muted">GMD</dt><dd className="num text-lg">{g != null ? num(g, 3) : '—'}</dd></div>
                  <div><dt className="eyebrow text-muted">Pasto</dt><dd className="text-[13px]">{pq?.nome ?? (l.fase === 'confinamento' ? 'Confinamento' : '—')}</dd></div>
                </dl>
                <div className="mt-4 flex gap-3 text-[12px]">
                  <button className="font-medium text-earth hover:text-ink" onClick={() => { setLoteF(l.id); setAba('animais'); }}>Ver animais →</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {aba === 'conciliacao' && (
        <Card eyebrow="Cabeças reais × sistema" title="Conferência de curral">
          <p className="mb-4 text-[13px] text-muted">Informe a contagem física de cada lote. A diferença aponta morte não anotada, animal em outro pasto ou roubo. Registre a ocorrência na ficha do animal para fechar a conta.</p>
          <Tabela>
            <thead><tr><th>Lote</th><th className="r">Sistema</th><th className="r">Contagem física</th><th>Data</th><th className="r">Diferença</th><th>Nova contagem</th></tr></thead>
            <tbody>
              {conc.map((c) => <LinhaContagem key={c.lote.id} c={c} hoje={hoje} />)}
            </tbody>
          </Tabela>
          <div className="mt-4">
            <Aviso tone="earth" titulo="Mortes, roubos e desaparecimentos">
              {e.ocorrencias.length === 0 ? 'Nenhuma ocorrência registrada.' : e.ocorrencias.map((o) => (
                <div key={o.id}><span className="num">{isoToBrDate(o.data)}</span> · {ix.animal.get(o.animalId)?.brinco} · {o.tipo} · {o.causa}</div>
              ))}
            </Aviso>
          </div>
        </Card>
      )}

      <NovoAnimal aberto={novo} onFechar={() => setNovo(false)} />
      {novoLote ? <EditarLote lote={novoLote} atividades={atividadesLote} onFechar={() => setNovoLote(null)} /> : null}
      <Modal aberto={mover} onFechar={() => setMover(false)} titulo={`Mover ${sel.size} animal(is)`} eyebrow="Movimentação">
        <MoverLote ids={[...sel]} onFeito={() => { setMover(false); setSel(new Set()); }} />
      </Modal>
    </>
  );
}

function LinhaContagem({ c, hoje }: { c: ReturnType<typeof conciliarCabecas>[number]; hoje: string }) {
  const [v, setV] = useState('');
  return (
    <tr>
      <td>{c.lote.nome}</td>
      <td className="r num">{c.sistema}</td>
      <td className="r num">{c.fisica ?? '—'}</td>
      <td className="num text-muted">{c.dataContagem ? isoToBrDate(c.dataContagem) : '—'}</td>
      <td className="r">{c.diferenca == null ? '—' : c.diferenca === 0 ? <Badge tone="leaf">bate</Badge> : <Badge tone="alert">{c.diferenca > 0 ? '+' : ''}{c.diferenca}</Badge>}</td>
      <td>
        <form className="flex items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); const n = Number(v); if (Number.isFinite(n) && v !== '') { atualizar('lotes', c.lote.id, { contagemFisica: { data: hoje, cabecas: n } }); setV(''); } }}>
          <input inputMode="numeric" className="field-input w-20 py-1" value={v} onChange={(ev) => setV(ev.target.value)} placeholder="cab" aria-label={`Contagem de ${c.lote.nome}`} />
          <button className="btn btn-ghost btn-sm" type="submit">Salvar</button>
        </form>
      </td>
    </tr>
  );
}

function EditarLote({ lote, atividades, onFechar }: { lote: Lote; atividades: Atividade[]; onFechar: () => void }) {
  const e = useEstado();
  const [f, setF] = useState<Lote>(lote);
  const fases: Fase[] = ['cria', 'recria', 'engorda', 'confinamento', 'lactacao', 'seca', 'reposicao', 'reprodutores', 'doadoras', 'receptoras'];
  return (
    <Modal aberto onFechar={onFechar} titulo={lote.nome || 'Novo lote'} eyebrow="Lote">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Nome" className="col-span-2"><Input value={f.nome} onChange={(ev) => setF({ ...f, nome: ev.target.value })} /></Field>
        <Field label="Atividade"><Select value={f.atividade} onChange={(ev) => setF({ ...f, atividade: ev.target.value as Atividade })} opcoes={atividades.map((a) => ({ value: a, label: ROT_ATIVIDADE[a] }))} /></Field>
        <Field label="Fase"><Select value={f.fase} onChange={(ev) => setF({ ...f, fase: ev.target.value as Fase })} opcoes={fases.map((x) => ({ value: x, label: ROT_FASE[x] }))} /></Field>
        <Field label="Piquete" className="col-span-2"><Select value={f.piqueteId ?? ''} onChange={(ev) => setF({ ...f, piqueteId: ev.target.value || undefined })} vazio="Sem piquete (confinamento/curral)" opcoes={e.piquetes.map((p) => ({ value: p.id, label: p.nome }))} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.nome.trim()} onClick={() => { salvar('lotes', f); onFechar(); }}>Salvar lote</button>
      </div>
    </Modal>
  );
}

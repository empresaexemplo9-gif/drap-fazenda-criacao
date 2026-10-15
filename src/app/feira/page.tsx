'use client';

/**
 * Modo feira: o tablet do stand vira laboratório de pesquisa. Questionário
 * de 5 perguntas, lista de interessados para o piloto e o resumo das
 * respostas (o que mais dói, quanto pagam hoje, quem aceita piloto).
 * Tudo funciona offline (o sinal no parque de exposições costuma cair).
 */

import { useMemo, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { useEstado, salvar, novoId } from '@/lib/store';
import { isoToBrDate, num } from '@/lib/format';
import type { Interessado } from '@/lib/domain/types';
import { PageHeader, Em, Card, Tabs, Tabela, Badge, Field, Input, Select, Textarea, StatGrid, Stat, Aviso, Empty, cx } from '@/components/ui';
import { BarrasH } from '@/components/graficos';

const DORES = [
  'Não sei quantos animais tenho / onde estão',
  'Não sei o custo da @ ou do litro',
  'Calendário sanitário e carência',
  'Pesagem e ganho de peso',
  'Fluxo de caixa e hora de vender',
  'Documentos (GTA, CAR, Funrural)',
  'Qualidade do leite e mastite',
  'Reprodução e genética',
  'Equipe anota pouco / perde dado',
  'Internet ruim na fazenda',
];
const CONTROLE = ['Caderneta / papel', 'Planilha', 'WhatsApp', 'Outro software', 'Na cabeça'];
const PAGA = ['Nada', 'Até R$ 100/mês', 'R$ 100 a 300/mês', 'R$ 300 a 600/mês', 'Mais de R$ 600/mês'];

export default function FeiraPage() {
  const e = useEstado();
  const [aba, setAba] = useState<'questionario' | 'lista' | 'resumo'>('questionario');
  return (
    <>
      <PageHeader eyebrow="XVI · Validação na feira" title={<>A feira como <Em>laboratório</Em></>}
        sub="Cinco perguntas no stand, lista de interessados por tipo de operação e quem aceita ser pecuarista-piloto. Funciona sem sinal e exporta CSV." />
      <Tabs ativa={aba} onChange={setAba} abas={[{ id: 'questionario', label: 'Questionário' }, { id: 'lista', label: 'Interessados', badge: e.interessados.length || undefined }, { id: 'resumo', label: 'Resumo' }]} />
      {aba === 'questionario' && <Questionario onSalvo={() => undefined} />}
      {aba === 'lista' && <Lista />}
      {aba === 'resumo' && <Resumo />}
    </>
  );
}

function Questionario({ onSalvo }: { onSalvo: () => void }) {
  const vazio: Omit<Interessado, 'id'> = { nome: '', contato: '', municipio: '', operacao: [], cabecas: 0, maiorDor: '', controleHoje: '', pagaHoje: '', aceitaPiloto: false, obs: '' };
  const [f, setF] = useState(vazio);
  const [ok, setOk] = useState(false);
  const toggleOp = (op: Interessado['operacao'][number]) => setF({ ...f, operacao: f.operacao.includes(op) ? f.operacao.filter((x) => x !== op) : [...f.operacao, op] });
  const valido = f.nome.trim() && f.maiorDor && f.controleHoje && f.pagaHoje;
  function enviar() {
    salvar('interessados', { id: novoId('int'), ...f });
    setF(vazio); setOk(true); onSalvo();
    setTimeout(() => setOk(false), 3500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const chip = (on: boolean) => cx('rounded-full border px-3 py-1.5 text-[13.5px] font-medium', on ? 'border-leaf bg-leafLt text-leafDk' : 'border-rule text-muted hover:text-ink');
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {ok ? <div className="flex items-center gap-2 rounded-sm bg-leafLt px-4 py-3 text-[14px] text-leafDk"><CheckCircle2 className="h-5 w-5" /> Obrigado! Resposta guardada.</div> : null}
      <Card eyebrow="1 · O que mais dói hoje na gestão?" title="Escolha a principal">
        <div className="flex flex-wrap gap-2">{DORES.map((d) => <button key={d} type="button" className={chip(f.maiorDor === d)} onClick={() => setF({ ...f, maiorDor: d })}>{d}</button>)}</div>
      </Card>
      <Card eyebrow="2 · Como controla hoje?" title="Ferramenta atual">
        <div className="flex flex-wrap gap-2">{CONTROLE.map((d) => <button key={d} type="button" className={chip(f.controleHoje === d)} onClick={() => setF({ ...f, controleHoje: d })}>{d}</button>)}</div>
      </Card>
      <Card eyebrow="3 · Quanto paga hoje por ferramenta de gestão?" title="Investimento atual">
        <div className="flex flex-wrap gap-2">{PAGA.map((d) => <button key={d} type="button" className={chip(f.pagaHoje === d)} onClick={() => setF({ ...f, pagaHoje: d })}>{d}</button>)}</div>
      </Card>
      <Card eyebrow="4 · Sua operação" title="Tipo e tamanho do rebanho">
        <div className="flex flex-wrap gap-2">
          {(['corte', 'leite', 'genetica'] as const).map((op) => <button key={op} type="button" className={chip(f.operacao.includes(op))} onClick={() => toggleOp(op)}>{op === 'corte' ? 'Corte' : op === 'leite' ? 'Leite' : 'Genética / PO'}</button>)}
        </div>
        <div className="mt-4 max-w-[12rem]"><Field label="Cabeças (aprox.)"><Input inputMode="numeric" value={f.cabecas || ''} onChange={(ev) => setF({ ...f, cabecas: Number(ev.target.value) || 0 })} /></Field></div>
      </Card>
      <Card eyebrow="5 · Aceitaria testar um piloto gratuito?" title="Pecuarista-piloto">
        <div className="flex gap-2">
          <button type="button" className={chip(f.aceitaPiloto)} onClick={() => setF({ ...f, aceitaPiloto: true })}>Sim, quero participar</button>
          <button type="button" className={chip(!f.aceitaPiloto)} onClick={() => setF({ ...f, aceitaPiloto: false })}>Agora não</button>
        </div>
      </Card>
      <Card eyebrow="Contato" title="Para a gente voltar a falar">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Nome *"><Input value={f.nome} onChange={(ev) => setF({ ...f, nome: ev.target.value })} /></Field>
          <Field label="WhatsApp ou e-mail"><Input value={f.contato} onChange={(ev) => setF({ ...f, contato: ev.target.value })} /></Field>
          <Field label="Município / UF"><Input value={f.municipio} onChange={(ev) => setF({ ...f, municipio: ev.target.value })} /></Field>
          <Field label="Observação (técnico, veterinário, sindicato…)"><Textarea value={f.obs} onChange={(ev) => setF({ ...f, obs: ev.target.value })} /></Field>
        </div>
        <p className="mt-4 text-[11.5px] text-muted">Os dados ficam só neste aparelho e são usados apenas para retornar o contato sobre o DRAP Pecuária (LGPD: peça o consentimento verbal).</p>
        <div className="mt-5 flex justify-end"><button className="btn btn-primary px-8 py-3 text-base" disabled={!valido} onClick={enviar}>Enviar respostas</button></div>
      </Card>
    </div>
  );
}

function Lista() {
  const e = useEstado();
  const [filtro, setFiltro] = useState('');
  const lista = e.interessados.filter((i) => !filtro || (filtro === 'piloto' ? i.aceitaPiloto : i.operacao.includes(filtro as 'corte')));
  function csv() {
    const linhas = [['nome', 'contato', 'municipio', 'operacao', 'cabecas', 'maior_dor', 'controle_hoje', 'paga_hoje', 'aceita_piloto', 'obs', 'registrado_em']];
    for (const i of e.interessados) linhas.push([i.nome, i.contato, i.municipio, i.operacao.join('+'), String(i.cabecas), i.maiorDor, i.controleHoje, i.pagaHoje, i.aceitaPiloto ? 'sim' : 'nao', i.obs ?? '', i.em ?? '']);
    const conteudo = linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'interessados-feira.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return (
    <Card eyebrow="Base de piloto" title={`${lista.length} interessado(s)`}
      actions={<div className="flex items-center gap-2">
        <select className="field-input w-auto py-1 text-[13px]" value={filtro} onChange={(ev) => setFiltro(ev.target.value)} aria-label="Filtro"><option value="">Todos</option><option value="piloto">Aceitam piloto</option><option value="corte">Corte</option><option value="leite">Leite</option><option value="genetica">Genética</option></select>
        <button className="btn btn-ghost btn-sm" onClick={csv} disabled={!e.interessados.length}><Download className="h-3.5 w-3.5" /> CSV</button>
      </div>}>
      {lista.length === 0 ? <Empty>Nenhuma resposta ainda. Use o questionário no stand.</Empty> : (
        <Tabela>
          <thead><tr><th>Nome</th><th>Contato</th><th>Município</th><th>Operação</th><th className="r">Cab.</th><th>Maior dor</th><th>Hoje</th><th>Paga</th><th>Piloto</th><th>Data</th></tr></thead>
          <tbody>{lista.map((i) => (
            <tr key={i.id}><td className="font-medium">{i.nome}</td><td className="text-muted">{i.contato}</td><td className="text-muted">{i.municipio}</td>
              <td>{i.operacao.map((o) => <Badge key={o} tone="earth">{o}</Badge>)}</td><td className="r num">{i.cabecas || '—'}</td>
              <td className="text-[12.5px]">{i.maiorDor}</td><td className="text-[12.5px] text-muted">{i.controleHoje}</td><td className="text-[12.5px] text-muted">{i.pagaHoje}</td>
              <td>{i.aceitaPiloto ? <Badge tone="leaf">sim</Badge> : '—'}</td><td className="num text-muted">{i.em ? isoToBrDate(i.em.slice(0, 10)) : ''}</td></tr>
          ))}</tbody>
        </Tabela>
      )}
    </Card>
  );
}

function Resumo() {
  const e = useEstado();
  const r = useMemo(() => {
    const cont = (k: keyof Interessado) => {
      const m = new Map<string, number>();
      for (const i of e.interessados) { const v = String(i[k]); if (v) m.set(v, (m.get(v) ?? 0) + 1); }
      return [...m].sort((a, b) => b[1] - a[1]).map(([rotulo, valor]) => ({ rotulo, valor }));
    };
    const ops = { corte: 0, leite: 0, genetica: 0 };
    for (const i of e.interessados) for (const o of i.operacao) ops[o] += 1;
    return { dores: cont('maiorDor'), controle: cont('controleHoje'), paga: cont('pagaHoje'), ops, piloto: e.interessados.filter((i) => i.aceitaPiloto) };
  }, [e.interessados]);
  const n = e.interessados.length;
  if (!n) return <Empty>O resumo aparece depois das primeiras respostas.</Empty>;
  const cab = e.interessados.reduce((s, i) => s + i.cabecas, 0);
  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="Respostas" value={n} />
        <Stat label="Aceitam piloto" value={`${r.piloto.length} (${num((r.piloto.length / n) * 100, 1)}%)`} tone="leaf" />
        <Stat label="Cabeças representadas" value={num(cab, 0)} />
        <Stat label="Corte · Leite · Genética" value={`${r.ops.corte} · ${r.ops.leite} · ${r.ops.genetica}`} tone="earth" />
      </StatGrid>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card eyebrow="Pergunta 1" title="Maior dor"><BarrasH itens={r.dores} formatar={(v) => String(v)} tom="leaf" /></Card>
        <Card eyebrow="Pergunta 2" title="Como controla hoje"><BarrasH itens={r.controle} formatar={(v) => String(v)} /></Card>
        <Card eyebrow="Pergunta 3" title="Quanto paga hoje"><BarrasH itens={r.paga} formatar={(v) => String(v)} /></Card>
      </div>
      <Aviso tone="leaf" titulo="Próximo passo">Escolha de 3 a 5 pilotos (um de corte, um de leite, um de genética) entre os que aceitaram. Priorize quem já usa planilha: dá para importar o histórico.</Aviso>
      <Field label="Pilotos (sim)"><Select value="" onChange={() => undefined} vazio={`${r.piloto.length} contato(s)`} opcoes={r.piloto.map((p) => ({ value: p.id, label: `${p.nome} · ${p.operacao.join('/')} · ${p.cabecas} cab · ${p.contato}` }))} /></Field>
    </div>
  );
}

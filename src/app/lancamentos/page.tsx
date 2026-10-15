'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, Pencil, Download } from 'lucide-react';
import { useEstado, remover } from '@/lib/store';
import { useHoje } from '@/lib/hooks';
import { brl, isoToBrDate } from '@/lib/format';
import { addDias, periodoSafra, safraDe } from '@/lib/datas';
import { razao, balancete, dre, nomeConta, nivel, saldoConta, CONTAS_DISPONIVEL } from '@/lib/domain/livro-razao';
import { ROT_ATIVIDADE } from '@/lib/rotulos';
import type { Atividade, Lancamento } from '@/lib/domain/types';
import { PageHeader, Em, Card, Tabs, Tabela, Badge, Field, Input, Select, Empty, StatGrid, Stat, cx } from '@/components/ui';
import { LancamentoForm } from '@/components/lancamento-form';
import { BarrasH } from '@/components/graficos';

type Aba = 'diario' | 'razao' | 'balancete' | 'dre' | 'plano';

export default function LancamentosPage() {
  const e = useEstado();
  const hoje = useHoje();
  const [aba, setAba] = useState<Aba>('diario');
  const [form, setForm] = useState<{ aberto: boolean; inicial?: Partial<Lancamento> }>({ aberto: false });
  const [de, setDe] = useState(addDias(hoje, -90));
  const [ate, setAte] = useState(addDias(hoje, 60));
  const [busca, setBusca] = useState('');
  const [ativ, setAtiv] = useState<Atividade | ''>('');
  const [conta, setConta] = useState('1.1.02');
  const [safra, setSafra] = useState(safraDe(hoje));

  const safras = useMemo(() => [...new Set([safraDe(hoje), ...e.lancamentos.map((l) => l.safra ?? safraDe(l.data))])].sort().reverse(), [e.lancamentos, hoje]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return e.lancamentos
      .filter((l) => l.data >= de && l.data <= ate && (!ativ || l.atividade === ativ))
      .filter((l) => !q || [l.historico, l.fornecedor, l.nota, l.debito, l.credito, nomeConta(e.contas, l.debito), nomeConta(e.contas, l.credito)].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => b.data.localeCompare(a.data) || (b.em ?? '').localeCompare(a.em ?? ''));
  }, [e.lancamentos, e.contas, de, ate, ativ, busca]);

  const saldoDisp = CONTAS_DISPONIVEL.reduce((s, c) => s + saldoConta(e.lancamentos, e.contas, c, hoje), 0);
  const fornec = saldoConta(e.lancamentos, e.contas, '2.1', hoje);
  const clientes = saldoConta(e.lancamentos, e.contas, '1.1.03', hoje);
  const credRural = saldoConta(e.lancamentos, e.contas, '2.2', hoje);

  function exportarCSV() {
    const linhas = [['data', 'historico', 'debito', 'conta_debito', 'credito', 'conta_credito', 'valor', 'atividade', 'fornecedor', 'nota', 'vencimento', 'pago_em', 'previsto']];
    for (const l of lista) linhas.push([l.data, l.historico, l.debito, nomeConta(e.contas, l.debito), l.credito, nomeConta(e.contas, l.credito), l.valor.toFixed(2).replace('.', ','), l.atividade, l.fornecedor ?? '', l.nota ?? '', l.vencimento ?? '', l.pagoEm ?? '', l.previsto ? 'sim' : '']);
    const csv = linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `livro-razao-${de}-a-${ate}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader eyebrow="VI · Livro-razão" title={<>Cada real <Em>com débito e crédito</Em></>}
        sub="O mesmo método do DRAP Fazenda: plano de contas em três níveis, fornecedor, NF e vencimento. Cada lançamento leva a atividade e o lote para virar custo de produção."
        actions={<>
          <button className="btn btn-ghost" onClick={exportarCSV}><Download className="h-4 w-4" /> CSV contábil</button>
          <button className="btn btn-primary" onClick={() => setForm({ aberto: true })}><Plus className="h-4 w-4" /> Lançamento</button>
        </>} />

      <div className="mb-6">
        <StatGrid cols={4}>
          <Stat label="Disponível · banco + caixa" value={brl(saldoDisp)} tone={saldoDisp < 0 ? 'alert' : 'leaf'} />
          <Stat label="Fornecedores a pagar" value={brl(fornec)} tone="earth" />
          <Stat label="Clientes a receber" value={brl(clientes)} tone="leaf" />
          <Stat label="Crédito rural" value={brl(credRural)} hint="saldo devedor" />
        </StatGrid>
      </div>

      <Tabs<Aba> ativa={aba} onChange={setAba} abas={[
        { id: 'diario', label: 'Lançamentos' }, { id: 'razao', label: 'Razão por conta' }, { id: 'balancete', label: 'Balancete' },
        { id: 'dre', label: 'DRE por atividade' }, { id: 'plano', label: 'Plano de contas' },
      ]} />

      {(aba === 'diario' || aba === 'razao' || aba === 'balancete') && (
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="De"><Input type="date" value={de} onChange={(ev) => setDe(ev.target.value)} /></Field>
          <Field label="Até"><Input type="date" value={ate} onChange={(ev) => setAte(ev.target.value)} /></Field>
          {aba === 'diario' ? <>
            <Field label="Atividade"><Select value={ativ} onChange={(ev) => setAtiv(ev.target.value as Atividade | '')} vazio="Todas" opcoes={(Object.keys(ROT_ATIVIDADE) as Atividade[]).map((a) => ({ value: a, label: ROT_ATIVIDADE[a] }))} /></Field>
            <Field label="Buscar"><div className="relative"><Search className="absolute left-0 top-2.5 h-4 w-4 text-muted" /><Input className="pl-6" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="histórico, NF, conta…" /></div></Field>
          </> : null}
          {aba === 'razao' ? <Field label="Conta" className="col-span-2"><Select value={conta} onChange={(ev) => setConta(ev.target.value)} opcoes={e.contas.filter((c) => nivel(c.codigo) === 3).map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.nome}` }))} /></Field> : null}
        </div>
      )}

      {aba === 'diario' && (
        <Card pad>
          {lista.length === 0 ? <Empty>Nenhum lançamento no período.</Empty> : null}
          {/* celular: cartões; desktop: tabela */}
          <ul className="divide-y divide-rule/40 sm:hidden">
            {lista.slice(0, 200).map((l) => (
              <li key={l.id} className={cx('py-3', l.previsto && 'italic text-muted')} onClick={() => setForm({ aberto: true, inicial: l })}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="num text-[11.5px] text-earth">{isoToBrDate(l.data)}</span>
                  <span className="num font-semibold">{brl(l.valor)}</span>
                </div>
                <p className="mt-0.5 text-[14px] font-medium">{l.historico}</p>
                <p className="num mt-0.5 text-[11.5px] text-muted">D {l.debito} · C {l.credito}{l.fornecedor ? <span className="font-sans"> · {l.fornecedor}</span> : null}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {l.previsto ? <Badge tone="neutral">previsão</Badge> : null}
                  {l.vencimento && !l.pagoEm && !l.baixaDe && (l.credito.startsWith('2.1') || l.debito === '1.1.03') ? <Badge tone={l.vencimento < hoje ? 'alert' : 'warn'}>vence {isoToBrDate(l.vencimento).slice(0, 5)}</Badge> : null}
                  {l.pagoEm ? <Badge tone="leaf">baixado</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
          {lista.length === 0 ? null : (
            <Tabela className="hidden sm:block">
              <thead><tr><th>Data</th><th>Histórico</th><th>Débito</th><th>Crédito</th><th className="r">Valor</th><th>Atividade</th><th></th></tr></thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id} className={cx(l.previsto && 'italic text-muted')}>
                    <td className="num whitespace-nowrap">{isoToBrDate(l.data)}</td>
                    <td>
                      {l.historico}
                      <div className="mt-0.5 flex flex-wrap gap-1 text-[11.5px] text-muted">
                        {l.fornecedor ? <span>{l.fornecedor}</span> : null}
                        {l.nota ? <span>· NF {l.nota}</span> : null}
                        {l.previsto ? <Badge tone="neutral">previsão</Badge> : null}
                        {l.vencimento && !l.pagoEm && !l.baixaDe && (l.credito.startsWith('2.1') || l.debito === '1.1.03') ? <Badge tone={l.vencimento < hoje ? 'alert' : 'warn'}>vence {isoToBrDate(l.vencimento).slice(0, 5)}</Badge> : null}
                        {l.pagoEm ? <Badge tone="leaf">baixado</Badge> : null}
                      </div>
                    </td>
                    <td className="num whitespace-nowrap text-[12px]" title={nomeConta(e.contas, l.debito)}>{l.debito}<div className="max-w-[10rem] truncate font-sans text-[11px] text-muted">{nomeConta(e.contas, l.debito)}</div></td>
                    <td className="num whitespace-nowrap text-[12px]" title={nomeConta(e.contas, l.credito)}>{l.credito}<div className="max-w-[10rem] truncate font-sans text-[11px] text-muted">{nomeConta(e.contas, l.credito)}</div></td>
                    <td className="r num whitespace-nowrap font-semibold">{brl(l.valor)}</td>
                    <td className="text-[12px] text-muted">{ROT_ATIVIDADE[l.atividade]}{l.loteId ? <div>{e.lotes.find((x) => x.id === l.loteId)?.nome}</div> : null}</td>
                    <td className="whitespace-nowrap">
                      <button className="mr-2 text-muted hover:text-ink" aria-label="Editar" onClick={() => setForm({ aberto: true, inicial: l })}><Pencil className="h-3.5 w-3.5" /></button>
                      <button className="text-muted hover:text-alert" aria-label="Excluir" onClick={() => { if (confirm('Excluir este lançamento?')) remover('lancamentos', l.id); }}><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Card>
      )}

      {aba === 'razao' && <Razao conta={conta} de={de} ate={ate} />}
      {aba === 'balancete' && <Balancete de={de} ate={ate} />}

      {aba === 'dre' && (
        <>
          <div className="mb-4 max-w-xs"><Field label="Safra (jul → jun)"><Select value={safra} onChange={(ev) => setSafra(ev.target.value)} opcoes={safras.map((s) => ({ value: s, label: s }))} /></Field></div>
          <DreAtividades safra={safra} />
        </>
      )}

      {aba === 'plano' && (
        <Card eyebrow="Três níveis · como no DRAP Fazenda" title="Plano de contas da pecuária">
          <ul className="text-[13.5px]">
            {e.contas.map((c) => (
              <li key={c.codigo} className={cx('flex items-baseline justify-between gap-3 border-b border-rule/30 py-1.5', nivel(c.codigo) === 1 && 'mt-3 font-display text-lg font-semibold', nivel(c.codigo) === 2 && 'font-semibold')}
                style={{ paddingLeft: `${(nivel(c.codigo) - 1) * 18}px` }}>
                <span><span className="num mr-2 text-earth">{c.codigo}</span>{c.nome}</span>
                {c.comportamento ? <Badge tone={c.comportamento === 'fixo' ? 'earth' : 'leaf'}>{c.comportamento}</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <LancamentoForm aberto={form.aberto} inicial={form.inicial} onFechar={() => setForm({ aberto: false })} />
    </>
  );
}

function Razao({ conta, de, ate }: { conta: string; de: string; ate: string }) {
  const e = useEstado();
  const r = razao(e.lancamentos, e.contas, conta, de, ate);
  return (
    <Card eyebrow={`Razão · ${conta}`} title={nomeConta(e.contas, conta)}>
      <Tabela>
        <thead><tr><th>Data</th><th>Histórico</th><th>Contrapartida</th><th className="r">Débito</th><th className="r">Crédito</th><th className="r">Saldo</th></tr></thead>
        <tbody>
          <tr><td className="num">{isoToBrDate(de)}</td><td className="italic text-muted">Saldo anterior</td><td></td><td></td><td></td><td className="r num font-semibold">{brl(r.saldoAnterior)}</td></tr>
          {r.linhas.map((l) => (
            <tr key={l.lancamento.id}>
              <td className="num">{isoToBrDate(l.lancamento.data)}</td>
              <td>{l.lancamento.historico}</td>
              <td className="text-[12px] text-muted"><span className="num">{l.contrapartida}</span> {nomeConta(e.contas, l.contrapartida)}</td>
              <td className="r num">{l.debito ? brl(l.debito) : ''}</td>
              <td className="r num">{l.credito ? brl(l.credito) : ''}</td>
              <td className={cx('r num font-semibold', l.saldo < 0 && 'text-alert')}>{brl(l.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>
      {r.linhas.length === 0 ? <Empty>Sem movimento no período.</Empty> : null}
    </Card>
  );
}

function Balancete({ de, ate }: { de: string; ate: string }) {
  const e = useEstado();
  const b = balancete(e.lancamentos, e.contas, de, ate);
  const fecha = Math.abs(b.totalDebitos - b.totalCreditos) < 0.005;
  return (
    <Card eyebrow="Balancete de verificação" title={fecha ? 'Débitos e créditos conferem' : 'Diferença encontrada'} tone={fecha ? 'leaf' : 'alert'}>
      <Tabela>
        <thead><tr><th>Conta</th><th className="r">Débitos</th><th className="r">Créditos</th><th className="r">Saldo</th></tr></thead>
        <tbody>
          {b.linhas.map((l) => (
            <tr key={l.conta.codigo} className={cx(nivel(l.conta.codigo) === 1 && 'font-semibold', nivel(l.conta.codigo) === 2 && 'font-medium')}>
              <td style={{ paddingLeft: `${12 + (nivel(l.conta.codigo) - 1) * 16}px` }}><span className="num mr-2 text-earth">{l.conta.codigo}</span>{l.conta.nome}</td>
              <td className="r num">{brl(l.debitos)}</td><td className="r num">{brl(l.creditos)}</td><td className="r num">{brl(l.saldo)}</td>
            </tr>
          ))}
          <tr className="font-semibold"><td>Total dos lançamentos</td><td className="r num">{brl(b.totalDebitos)}</td><td className="r num">{brl(b.totalCreditos)}</td><td></td></tr>
        </tbody>
      </Tabela>
    </Card>
  );
}

function DreAtividades({ safra }: { safra: string }) {
  const e = useEstado();
  const [de, ate] = periodoSafra(safra);
  const ativs: (Atividade | undefined)[] = [undefined, 'corte', 'leite', 'genetica', 'geral'];
  const dres = ativs.map((a) => ({ a, d: dre(e.lancamentos, e.contas, de, ate, a) }));
  const total = dres[0].d;
  return (
    <div className="space-y-5">
      <Card eyebrow={`${safra} · ${isoToBrDate(de)} a ${isoToBrDate(ate)}`} title="Demonstrativo de resultado">
        <Tabela>
          <thead><tr><th></th>{dres.map(({ a }) => <th key={a ?? 'total'} className="r">{a ? ROT_ATIVIDADE[a] : 'Fazenda'}</th>)}</tr></thead>
          <tbody>
            {([
              ['Receitas', 'receitas', 'leaf'], ['(−) Custos variáveis', 'custosVariaveis', ''], ['= Margem de contribuição', 'margemContribuicao', 'b'],
              ['(−) Custos fixos', 'custosFixos', ''], ['(−) Tributos e juros', 'tributos', ''], ['= Resultado', 'resultado', 'b'],
            ] as const).map(([rot, k, s]) => (
              <tr key={k} className={cx(s === 'b' && 'font-semibold')}>
                <td>{rot}</td>
                {dres.map(({ a, d }) => <td key={a ?? 't'} className={cx('r num', s === 'leaf' && 'text-leafDk', k === 'resultado' && d.resultado < 0 && 'text-alert')}>{brl(d[k])}</td>)}
              </tr>
            ))}
          </tbody>
        </Tabela>
        <p className="mt-3 text-[12px] text-muted">A coluna “Geral” reúne custos comuns ainda não rateados. O rateio por UA·dia está em Custo de produção.</p>
      </Card>
      <Card eyebrow="Para onde foi o dinheiro" title="Custos por conta na safra">
        <BarrasH itens={total.porConta.filter((x) => x.conta.natureza === 'despesa').sort((a, b) => b.valor - a.valor).map((x) => ({ rotulo: `${x.conta.codigo} · ${x.conta.nome}`, valor: x.valor }))} formatar={brl} />
      </Card>
    </div>
  );
}

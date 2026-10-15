'use client';

import { useMemo, useState } from 'react';
import { Plus, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useEstado, salvar, novoId } from '@/lib/store';
import { useHoje } from '@/lib/hooks';
import { brl, num, isoToBrDate } from '@/lib/format';
import { previsaoRuptura, consumoSalEsperado } from '@/lib/domain/estoque';
import { pesoAtual, uaDe, ativos } from '@/lib/domain/rebanho';
import { CONTA_FORNECEDORES } from '@/lib/domain/livro-razao';
import { safraDe } from '@/lib/datas';
import { useIndices } from '@/lib/hooks';
import { ROT_INSUMO, opcoes } from '@/lib/rotulos';
import type { CategoriaInsumo, Insumo, MovEstoque } from '@/lib/domain/types';
import { PageHeader, Em, Card, Tabela, Badge, Field, Input, Select, Modal, StatGrid, Stat, Barra, Aviso } from '@/components/ui';

const CONTA_POR_CATEGORIA: Partial<Record<CategoriaInsumo, string>> = {
  sal_mineral: '5.1.01', racao: '5.1.02', medicamento: '5.1.03', vacina: '5.1.03', semen: '5.1.04', combustivel: '5.2.02', adubo: '5.2.05',
};

export default function EstoquePage() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const [mov, setMov] = useState<{ insumo: Insumo; tipo: MovEstoque['tipo'] } | null>(null);
  const [novo, setNovo] = useState(false);

  const saldos = useMemo(() => previsaoRuptura(e.insumos, e.movEstoque, hoje).sort((a, b) => (a.diasCobertura ?? 9999) - (b.diasCobertura ?? 9999)), [e.insumos, e.movEstoque, hoje]);
  const valor = saldos.reduce((s, x) => s + x.valorEstoque, 0);
  const criticos = saldos.filter((s) => s.abaixoMinimo || (s.diasCobertura != null && s.diasCobertura < 15));
  const uaPasto = ativos(e.animais).filter((a) => ix.lote.get(a.loteId ?? '')?.fase !== 'confinamento').reduce((s, a) => s + uaDe(pesoAtual(a, ix.pesagens.get(a.id), hoje)), 0);
  const sal = saldos.find((s) => s.insumo.categoria === 'sal_mineral');
  const ultimas = [...e.movEstoque].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 30);

  return (
    <>
      <PageHeader eyebrow="IX · Estoque de insumos" title={<>Sem compra <Em>em cima da hora</Em></>}
        sub="Sal mineral, ração, remédios, sêmen e diesel com custo médio ponderado e a data em que cada item acaba no consumo atual."
        actions={<button className="btn btn-primary" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Insumo</button>} />

      <div className="mb-6">
        <StatGrid cols={4}>
          <Stat label="Valor em estoque" value={brl(valor)} />
          <Stat label="Itens críticos" value={criticos.length} tone={criticos.length ? 'alert' : 'leaf'} hint="abaixo do mínimo ou < 15 dias" />
          <Stat label="UA a pasto" value={num(uaPasto, 1)} hint={`sal esperado ≈ ${num(consumoSalEsperado(uaPasto), 0)} kg/dia (80 g/UA)`} />
          <Stat label="Consumo de sal informado" value={sal ? `${num(sal.insumo.consumoDiario, 0)} kg/d` : '—'} tone={sal && Math.abs(sal.insumo.consumoDiario - consumoSalEsperado(uaPasto)) / Math.max(1, consumoSalEsperado(uaPasto)) > 0.3 ? 'warn' : undefined}
            hint="diferença grande indica perda no cocho ou falta" />
        </StatGrid>
      </div>

      <Card eyebrow="Saldo e cobertura" title="Insumos">
        <Tabela>
          <thead><tr><th>Insumo</th><th className="r">Saldo</th><th className="r">Mínimo</th><th className="r">Consumo/dia</th><th>Cobertura</th><th className="r">Custo médio</th><th className="r">Valor</th><th></th></tr></thead>
          <tbody>
            {saldos.map((s) => (
              <tr key={s.insumo.id}>
                <td>{s.insumo.nome}<div className="text-[11px] text-muted">{ROT_INSUMO[s.insumo.categoria]}</div></td>
                <td className="r num font-semibold">{num(s.saldo, 0)} {s.insumo.unidade}</td>
                <td className="r num text-muted">{num(s.insumo.estoqueMinimo, 0)}</td>
                <td className="r num">{s.insumo.consumoDiario ? num(s.insumo.consumoDiario) : '—'}</td>
                <td className="min-w-[9rem]">
                  {s.diasCobertura != null ? (
                    <>
                      <div className="mb-1 flex justify-between text-[11.5px]"><span className="num">{Math.floor(s.diasCobertura)} dias</span>{s.ruptura ? <span className="num text-muted">até {isoToBrDate(s.ruptura).slice(0, 5)}</span> : null}</div>
                      <Barra valor={s.diasCobertura} max={90} tone={s.diasCobertura < 15 ? 'alert' : s.diasCobertura < 30 ? 'warn' : 'leaf'} />
                    </>
                  ) : s.abaixoMinimo ? <Badge tone="alert">abaixo do mínimo</Badge> : <span className="text-muted">uso eventual</span>}
                </td>
                <td className="r num">{brl(s.custoMedio)}</td>
                <td className="r num">{brl(s.valorEstoque)}</td>
                <td className="whitespace-nowrap">
                  <button className="mr-2 text-leafDk hover:text-ink" title="Entrada" aria-label={`Entrada de ${s.insumo.nome}`} onClick={() => setMov({ insumo: s.insumo, tipo: 'entrada' })}><ArrowDownToLine className="h-4 w-4" /></button>
                  <button className="text-earth hover:text-ink" title="Saída" aria-label={`Saída de ${s.insumo.nome}`} onClick={() => setMov({ insumo: s.insumo, tipo: 'saida' })}><ArrowUpFromLine className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Card>

      <Card className="mt-6" eyebrow="Últimos movimentos" title="Entradas e saídas">
        <Tabela>
          <thead><tr><th>Data</th><th>Insumo</th><th>Tipo</th><th className="r">Quantidade</th><th className="r">Valor un.</th><th>Destino / NF</th><th>Por</th></tr></thead>
          <tbody>
            {ultimas.map((m) => {
              const i = e.insumos.find((x) => x.id === m.insumoId);
              return (
                <tr key={m.id}>
                  <td className="num">{isoToBrDate(m.data)}</td><td>{i?.nome}</td>
                  <td><Badge tone={m.tipo === 'entrada' ? 'leaf' : m.tipo === 'saida' ? 'earth' : 'neutral'}>{m.tipo}</Badge></td>
                  <td className="r num">{num(m.quantidade, 0)} {i?.unidade}</td>
                  <td className="r num">{m.valorUnitario ? brl(m.valorUnitario) : '—'}</td>
                  <td className="text-muted">{m.destino ?? (m.nota ? `NF ${m.nota}` : '—')}</td>
                  <td className="text-muted">{m.por ? ix.pessoa.get(m.por)?.nome.split(' ')[0] : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </Card>

      <div className="mt-6"><Aviso tone="leaf" titulo="Integração com o livro-razão">Uma entrada com valor pode gerar o lançamento a prazo na conta de custo do insumo (ex.: sal → 5.1.01). Assim estoque, Posição e custo de produção ficam amarrados.</Aviso></div>

      {mov ? <MovModal {...mov} onFechar={() => setMov(null)} /> : null}
      {novo ? <NovoInsumo onFechar={() => setNovo(false)} /> : null}
    </>
  );
}

function MovModal({ insumo, tipo, onFechar }: { insumo: Insumo; tipo: MovEstoque['tipo']; onFechar: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const [f, setF] = useState({ data: hoje, qtd: '', vu: String(insumo.custoMedio || ''), nota: '', destino: '', loteId: '', fornecedor: '', lancar: true, vencimento: '' });
  const n = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0;
  function gravar() {
    const q = n(f.qtd);
    if (q <= 0) return;
    salvar('movEstoque', { id: novoId('m'), insumoId: insumo.id, data: f.data, tipo, quantidade: q, valorUnitario: tipo === 'entrada' ? n(f.vu) : undefined, nota: f.nota || undefined, destino: f.destino || undefined, loteId: f.loteId || undefined });
    if (tipo === 'entrada' && f.lancar && n(f.vu) > 0) {
      const lote = e.lotes.find((l) => l.id === f.loteId);
      salvar('lancamentos', {
        id: novoId('f'), data: f.data, historico: `${insumo.nome}${f.nota ? ` · NF ${f.nota}` : ''}`, debito: CONTA_POR_CATEGORIA[insumo.categoria] ?? '5.1.02', credito: CONTA_FORNECEDORES,
        valor: Math.round(q * n(f.vu) * 100) / 100, atividade: lote?.atividade ?? 'geral', loteId: lote?.id, fornecedor: f.fornecedor || undefined, nota: f.nota || undefined,
        formaPgto: 'A PAGAR', vencimento: f.vencimento || f.data, safra: safraDe(f.data),
      });
    }
    onFechar();
  }
  return (
    <Modal aberto onFechar={onFechar} titulo={`${tipo === 'entrada' ? 'Entrada' : 'Saída'} · ${insumo.nome}`} eyebrow="Estoque">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Data"><Input type="date" value={f.data} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Field>
        <Field label={`Quantidade (${insumo.unidade})`}><Input autoFocus inputMode="decimal" value={f.qtd} onChange={(ev) => setF({ ...f, qtd: ev.target.value })} /></Field>
        {tipo === 'entrada' ? <>
          <Field label="Valor unitário (R$)"><Input inputMode="decimal" value={f.vu} onChange={(ev) => setF({ ...f, vu: ev.target.value })} /></Field>
          <Field label="Nota fiscal"><Input value={f.nota} onChange={(ev) => setF({ ...f, nota: ev.target.value })} /></Field>
          <Field label="Fornecedor"><Input value={f.fornecedor} onChange={(ev) => setF({ ...f, fornecedor: ev.target.value })} /></Field>
          <Field label="Vencimento"><Input type="date" value={f.vencimento} onChange={(ev) => setF({ ...f, vencimento: ev.target.value })} /></Field>
          <label className="col-span-2 flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" checked={f.lancar} onChange={(ev) => setF({ ...f, lancar: ev.target.checked })} /> Lançar no livro-razão como despesa a prazo</label>
        </> : <>
          <Field label="Lote (custo direto)"><Select value={f.loteId} onChange={(ev) => setF({ ...f, loteId: ev.target.value })} vazio="—" opcoes={e.lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
          <Field label="Destino"><Input value={f.destino} onChange={(ev) => setF({ ...f, destino: ev.target.value })} placeholder="cocho, trator, curral…" /></Field>
        </>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" onClick={gravar} disabled={n(f.qtd) <= 0}>Registrar</button>
      </div>
    </Modal>
  );
}

function NovoInsumo({ onFechar }: { onFechar: () => void }) {
  const [f, setF] = useState<Insumo>({ id: novoId('i'), nome: '', categoria: 'sal_mineral', unidade: 'kg', estoqueMinimo: 0, consumoDiario: 0, custoMedio: 0 });
  const n = (v: string) => Number(v.replace(',', '.')) || 0;
  return (
    <Modal aberto onFechar={onFechar} titulo="Novo insumo" eyebrow="Estoque">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Nome" className="col-span-2"><Input value={f.nome} onChange={(ev) => setF({ ...f, nome: ev.target.value })} /></Field>
        <Field label="Categoria"><Select value={f.categoria} onChange={(ev) => setF({ ...f, categoria: ev.target.value as CategoriaInsumo })} opcoes={opcoes(ROT_INSUMO)} /></Field>
        <Field label="Unidade"><Input value={f.unidade} onChange={(ev) => setF({ ...f, unidade: ev.target.value })} placeholder="kg, L, dose, mL" /></Field>
        <Field label="Estoque mínimo"><Input inputMode="decimal" onChange={(ev) => setF({ ...f, estoqueMinimo: n(ev.target.value) })} /></Field>
        <Field label="Consumo diário"><Input inputMode="decimal" onChange={(ev) => setF({ ...f, consumoDiario: n(ev.target.value) })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.nome.trim()} onClick={() => { salvar('insumos', f); onFechar(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

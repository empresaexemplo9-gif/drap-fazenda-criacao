'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useEstado, salvar, salvarVarios, novoId } from '@/lib/store';
import { useHoje, useIndices } from '@/lib/hooks';
import { brl, num, isoToBrDate, isoToBrShort } from '@/lib/format';
import { addDias, diasEntre, safraDe } from '@/lib/datas';
import {
  animaisDoLote, gmd, gmdGrupo, pesoAtual, taxaDesfrute, mortalidade, idadeMediaAbate, rendimentoCarcaca, valorVenda, carenciasAtivas, KG_POR_ARROBA,
} from '@/lib/domain/rebanho';
import { custoKgDieta } from '@/lib/domain/simulador';
import { CONTA_CLIENTES } from '@/lib/domain/livro-razao';
import { dre } from '@/lib/domain/livro-razao';
import { moduloAtivo } from '@/lib/domain/modulos';
import type { LeituraCocho } from '@/lib/domain/types';
import { PageHeader, Em, Card, Tabs, Tabela, Badge, Field, Input, Select, Modal, StatGrid, Stat, Aviso, Empty, cx } from '@/components/ui';
import { BarrasH, Linha } from '@/components/graficos';

type Aba = 'desempenho' | 'confinamento' | 'reposicao' | 'vendas' | 'indicadores';

export default function CortePage() {
  const e = useEstado();
  const [aba, setAba] = useState<Aba>('desempenho');
  if (!moduloAtivo(e.modulos, 'corte')) return <Empty>Módulo Corte não contratado. Ative em <Link href="/config/" className="text-earth underline">Configurações</Link>.</Empty>;
  return (
    <>
      <PageHeader eyebrow="XIII · Módulo Corte" title={<>Do bezerro <Em>ao gancho</Em></>}
        sub="Ganho de peso com histórico usável, confinamento por cocho, reposição comparada por fornecedor, venda por frigorífico e os indicadores que dizem se a fazenda está dando lucro." />
      <Tabs<Aba> ativa={aba} onChange={setAba} abas={[
        { id: 'desempenho', label: 'Ganho de peso' }, { id: 'confinamento', label: 'Confinamento' }, { id: 'reposicao', label: 'Reposição' },
        { id: 'vendas', label: 'Vendas e frigoríficos' }, { id: 'indicadores', label: 'Indicadores' },
      ]} />
      {aba === 'desempenho' && <Desempenho />}
      {aba === 'confinamento' && <Confinamento />}
      {aba === 'reposicao' && <Reposicao />}
      {aba === 'vendas' && <Vendas />}
      {aba === 'indicadores' && <Indicadores />}
    </>
  );
}

function Desempenho() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const lotes = e.lotes.filter((l) => l.atividade === 'corte');
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const bichos = animaisDoLote(e.animais, loteId);
  const linhas = bichos.map((a) => ({ a, hist: ix.pesagens.get(a.id) ?? [], g: gmd(ix.pesagens.get(a.id)) })).sort((x, y) => (y.g ?? -9) - (x.g ?? -9));
  const gLote = gmdGrupo(bichos.map((a) => a.id), ix.pesagens, addDias(hoje, -120), hoje);
  // curva média do lote por data de pesagem
  const curva = useMemo(() => {
    const m = new Map<string, { s: number; n: number }>();
    for (const a of bichos) for (const p of ix.pesagens.get(a.id) ?? []) {
      const k = p.data.slice(0, 7);
      const acc = m.get(k) ?? { s: 0, n: 0 };
      acc.s += p.pesoKg; acc.n += 1; m.set(k, acc);
    }
    return [...m].sort((x, y) => x[0].localeCompare(y[0])).map(([x, v]) => ({ x, y: v.s / v.n }));
  }, [bichos, ix.pesagens]);
  const semPesar = linhas.filter((l) => !l.hist.length || diasEntre(l.hist[l.hist.length - 1].data, hoje) > 60).length;
  const piores = linhas.filter((l) => l.g != null && gLote != null && l.g < gLote * 0.7);
  const pesoMedio = bichos.length ? bichos.reduce((s, a) => s + pesoAtual(a, ix.pesagens.get(a.id), hoje), 0) / bichos.length : 0;
  const diasAbate = gLote && gLote > 0 ? Math.max(0, Math.ceil((540 - pesoMedio) / gLote)) : null;

  return (
    <div className="space-y-5">
      <div className="max-w-sm"><Field label="Lote"><Select value={loteId} onChange={(ev) => setLoteId(ev.target.value)} opcoes={lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field></div>
      <StatGrid cols={4}>
        <Stat label="GMD do lote · 120 d" value={gLote != null ? `${num(gLote, 3)} kg` : '—'} tone="leaf" />
        <Stat label="Peso médio" value={`${Math.round(pesoMedio)} kg`} hint={`${num(pesoMedio / 30, 1)} @ vivas`} />
        <Stat label="Dias até 540 kg" value={diasAbate ?? '—'} hint={diasAbate != null ? `previsão ${isoToBrDate(addDias(hoje, diasAbate))}` : undefined} />
        <Stat label="Sem pesar há 60+ dias" value={semPesar} tone={semPesar ? 'warn' : undefined} />
      </StatGrid>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3" eyebrow="Curva média" title="Peso médio por mês"><Linha pontos={curva} formatar={(v) => `${Math.round(v)} kg`} /></Card>
        <Card className="lg:col-span-2" eyebrow={`${piores.length} abaixo de 70% do GMD do lote`} title="Animais que não respondem" tone={piores.length ? 'earth' : undefined}>
          {piores.length === 0 ? <Empty>Lote homogêneo.</Empty> : (
            <ul className="divide-y divide-rule/40 text-[13px]">
              {piores.slice(0, 12).map((l) => <li key={l.a.id} className="flex justify-between py-1.5"><Link className="num font-semibold hover:text-leaf" href={`/animal/?id=${l.a.id}`}>{l.a.brinco}</Link><span className="num text-alert">{num(l.g, 3)} kg/d</span></li>)}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-muted">Verificar verminose, casco e dominância no cocho. Persistindo, apartar ou descartar.</p>
        </Card>
      </div>
      <Card eyebrow="Ranking" title="GMD individual">
        <Tabela>
          <thead><tr><th>Brinco</th><th>Raça</th><th>Origem</th><th className="r">Pesagens</th><th className="r">Último peso</th><th className="r">GMD</th></tr></thead>
          <tbody>{linhas.map((l) => (
            <tr key={l.a.id}><td><Link href={`/animal/?id=${l.a.id}`} className="num font-semibold hover:text-leaf">{l.a.brinco}</Link></td><td className="text-muted">{l.a.raca}</td><td className="text-muted">{l.a.fornecedor ?? 'Própria'}</td>
              <td className="r num">{l.hist.length}</td><td className="r num">{l.hist.length ? `${l.hist[l.hist.length - 1].pesoKg} kg` : '—'}</td><td className="r num font-semibold">{l.g != null ? num(l.g, 3) : '—'}</td></tr>
          ))}</tbody>
        </Tabela>
      </Card>
    </div>
  );
}

function Confinamento() {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const lotes = e.lotes.filter((l) => l.fase === 'confinamento');
  const [loteId, setLoteId] = useState(lotes[0]?.id ?? '');
  const [leitura, setLeitura] = useState(false);
  const dieta = e.dietas[0];
  const bichos = animaisDoLote(e.animais, loteId);
  const pesoMedio = bichos.length ? bichos.reduce((s, a) => s + pesoAtual(a, ix.pesagens.get(a.id), hoje), 0) / bichos.length : 0;
  const leituras = e.leiturasCocho.filter((l) => l.loteId === loteId).sort((a, b) => a.data.localeCompare(b.data));
  const ult7 = leituras.filter((l) => l.data >= addDias(hoje, -6));
  const custoKg = dieta ? custoKgDieta(dieta.ingredientes) : 0;
  const consumoCab = ult7.length && bichos.length ? ult7.reduce((s, l) => s + l.fornecidoKg - l.sobraKg, 0) / ult7.length / bichos.length : 0;
  const custoCabDia = consumoCab * custoKg;
  const entrada = bichos.map((a) => a.dataEntrada ?? hoje).sort()[0] ?? hoje;
  const diasCocho = diasEntre(entrada, hoje);
  const g = gmdGrupo(bichos.map((a) => a.id), ix.pesagens, entrada, hoje);
  const conv = g && g > 0 ? (consumoCab * 0.62) / g : null; // MS ~62% na dieta com silagem
  const ultNota = leituras[leituras.length - 1]?.nota;
  const ajuste = ultNota == null ? null : ultNota === 0 ? '+3% no trato (cocho limpo)' : ultNota >= 3 ? '−5% no trato (muita sobra)' : 'manter o trato';
  const carencia = carenciasAtivas(e.sanidade, hoje).filter((c) => c.bloqueiaCarne && bichos.some((a) => a.id === c.animalId)).length;
  if (!lotes.length) return <Empty>Nenhum lote em confinamento.</Empty>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm"><Field label="Lote"><Select value={loteId} onChange={(ev) => setLoteId(ev.target.value)} opcoes={lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field></div>
        <button className="btn btn-primary" onClick={() => setLeitura(true)}><Plus className="h-4 w-4" /> Leitura de cocho</button>
      </div>
      <StatGrid cols={5}>
        <Stat label="Dias de cocho" value={diasCocho} hint={`entrada ${isoToBrDate(entrada)}`} />
        <Stat label="GMD no cocho" value={g != null ? `${num(g, 3)} kg` : '—'} tone="leaf" />
        <Stat label="Consumo MN" value={`${num(consumoCab, 1)} kg`} hint={`${num(pesoMedio ? (consumoCab / pesoMedio) * 100 : 0, 1)}% do PV`} />
        <Stat label="Custo por cabeça/dia" value={brl(custoCabDia)} hint={`dieta a ${brl(custoKg)}/kg`} />
        <Stat label="Conversão (MS/ganho)" value={conv != null ? num(conv, 1) : '—'} hint="kg de MS por kg ganho" />
      </StatGrid>
      {carencia ? <Aviso tone="warn" titulo="Carência">{carencia} animal(is) do lote em carência: não embarcar antes da liberação.</Aviso> : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card eyebrow="Leitura de cocho · 14 dias" title={ajuste ? `Recomendação: ${ajuste}` : 'Sem leituras'}>
          <Tabela>
            <thead><tr><th>Data</th><th className="r">Fornecido</th><th className="r">Sobra</th><th>Nota</th><th className="r">kg/cab</th></tr></thead>
            <tbody>{[...leituras].reverse().slice(0, 14).map((l) => (
              <tr key={l.id}><td className="num">{isoToBrShort(l.data)}</td><td className="r num">{num(l.fornecidoKg, 0)} kg</td><td className="r num">{num(l.sobraKg, 0)}</td>
                <td><Badge tone={l.nota === 0 ? 'warn' : l.nota >= 3 ? 'alert' : 'leaf'}>{l.nota}</Badge></td><td className="r num">{bichos.length ? num((l.fornecidoKg - l.sobraKg) / bichos.length, 1) : '—'}</td></tr>
            ))}</tbody>
          </Tabela>
          <p className="mt-3 text-[12px] text-muted">Escala 0 (cocho lambido) a 4 (sobra acima de 10%). Ideal: 1, com sobra entre 2% e 5%.</p>
        </Card>
        {dieta ? (
          <Card eyebrow={`Dieta · ${num(dieta.consumoPctPV, 1)}% do PV`} title={dieta.nome}>
            <BarrasH itens={dieta.ingredientes.map((i) => ({ rotulo: i.nome, valor: i.pct, extra: brl(i.custoKg) + '/kg' }))} formatar={(v) => `${num(v)}%`} tom="leaf" />
            <dl className="mt-4 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-muted">Custo por kg de dieta</dt><dd className="num">{brl(custoKg)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Custo por cocho/dia ({bichos.length} cab)</dt><dd className="num">{brl(custoCabDia * bichos.length)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Custo da @ produzida (só dieta)</dt><dd className="num font-semibold">{g ? brl(custoCabDia / ((g * 0.6) / KG_POR_ARROBA)) : '—'}</dd></div>
            </dl>
          </Card>
        ) : null}
      </div>
      {leitura ? <LeituraModal loteId={loteId} dietaId={dieta?.id ?? ''} onFechar={() => setLeitura(false)} /> : null}
    </div>
  );
}

function LeituraModal({ loteId, dietaId, onFechar }: { loteId: string; dietaId: string; onFechar: () => void }) {
  const hoje = useHoje();
  const [f, setF] = useState({ data: hoje, fornecido: '', sobra: '0', nota: '1' });
  return (
    <Modal aberto onFechar={onFechar} titulo="Leitura de cocho" eyebrow="Confinamento">
      <div className="grid grid-cols-2 gap-5">
        <Field label="Data"><Input type="date" value={f.data} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Field>
        <Field label="Nota de cocho (0–4)"><Select value={f.nota} onChange={(ev) => setF({ ...f, nota: ev.target.value })} opcoes={['0', '1', '2', '3', '4'].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Fornecido (kg)"><Input autoFocus inputMode="decimal" value={f.fornecido} onChange={(ev) => setF({ ...f, fornecido: ev.target.value })} /></Field>
        <Field label="Sobra (kg)"><Input inputMode="decimal" value={f.sobra} onChange={(ev) => setF({ ...f, sobra: ev.target.value })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!(Number(f.fornecido) > 0)} onClick={() => {
          salvar('leiturasCocho', { id: novoId('lc'), data: f.data, loteId, dietaId, fornecidoKg: Number(f.fornecido.replace(',', '.')), sobraKg: Number(f.sobra.replace(',', '.')) || 0, nota: Number(f.nota) as LeituraCocho['nota'] });
          onFechar();
        }}>Salvar</button>
      </div>
    </Modal>
  );
}

function Reposicao() {
  const e = useEstado();
  const ix = useIndices();
  const comprados = e.animais.filter((a) => a.origem === 'comprado' && a.fornecedor);
  const por = new Map<string, typeof comprados>();
  for (const a of comprados) por.set(a.fornecedor!, [...(por.get(a.fornecedor!) ?? []), a]);
  const linhas = [...por].map(([forn, as]) => {
    const g = gmdGrupo(as.map((a) => a.id), ix.pesagens);
    const preco = as.filter((a) => a.valorCompra).reduce((s, a) => s + (a.valorCompra ?? 0), 0) / Math.max(1, as.filter((a) => a.valorCompra).length);
    const mortos = as.filter((a) => a.status === 'morto' || a.status === 'desaparecido').length;
    const pesoEntrada = as.map((a) => ix.pesagens.get(a.id)?.[0]?.pesoKg).filter((x): x is number => !!x);
    const pe = pesoEntrada.length ? pesoEntrada.reduce((s, x) => s + x, 0) / pesoEntrada.length : null;
    return { forn, n: as.length, g, preco, mortos, pe, precoKg: pe ? preco / pe : null };
  }).sort((a, b) => (b.g ?? 0) - (a.g ?? 0));
  const melhor = linhas[0];
  return (
    <div className="space-y-5">
      <Card eyebrow="Preço pago × desempenho posterior" title="Comparativo por origem e fornecedor">
        {linhas.length === 0 ? <Empty>Nenhuma compra registrada com fornecedor.</Empty> : (
          <Tabela>
            <thead><tr><th>Fornecedor / origem</th><th className="r">Cabeças</th><th className="r">Preço médio</th><th className="r">Peso entrada</th><th className="r">R$/kg</th><th className="r">GMD</th><th className="r">Perdas</th><th className="r">Ganho/R$ mil</th></tr></thead>
            <tbody>{linhas.map((l) => (
              <tr key={l.forn} className={cx(l === melhor && 'bg-leafLt/40')}>
                <td>{l.forn} {l === melhor ? <Badge tone="leaf">melhor GMD</Badge> : null}</td>
                <td className="r num">{l.n}</td><td className="r num">{brl(l.preco)}</td><td className="r num">{l.pe ? `${Math.round(l.pe)} kg` : '—'}</td>
                <td className="r num">{l.precoKg ? brl(l.precoKg) : '—'}</td><td className="r num font-semibold">{l.g != null ? num(l.g, 3) : '—'}</td>
                <td className={cx('r num', l.mortos && 'text-alert')}>{l.mortos}</td>
                <td className="r num">{l.g != null && l.preco ? `${num((l.g * 100 * 1000) / l.preco, 1)} kg` : '—'}</td>
              </tr>
            ))}</tbody>
          </Tabela>
        )}
        <p className="mt-3 text-[12px] text-muted">“Ganho/R$ mil” = kg ganhos em 100 dias para cada R$ 1.000 pagos no animal. O bezerro mais barato nem sempre é o melhor negócio.</p>
      </Card>
      <Aviso tone="earth" titulo="Próxima compra">Use a aba Mercado para ver a relação de troca (boi × bezerro) antes de fechar o lote. Cadastre a compra pelo Rebanho com origem “Comprado”, fornecedor e valor pago, e lance a NF no livro-razão em 5.1.05.</Aviso>
    </div>
  );
}

function Vendas() {
  const e = useEstado();
  const [nova, setNova] = useState(false);
  const vendas = [...e.vendas].sort((a, b) => b.data.localeCompare(a.data));
  const porFrig = new Map<string, { n: number; arrobas: number; valor: number; rend: number[]; precos: number[] }>();
  for (const v of vendas) {
    const acc = porFrig.get(v.frigorifico) ?? { n: 0, arrobas: 0, valor: 0, rend: [], precos: [] };
    acc.n += v.animalIds.length; acc.arrobas += v.pesoCarcacaTotalKg / KG_POR_ARROBA; acc.valor += valorVenda(v); acc.rend.push(rendimentoCarcaca(v)); acc.precos.push(v.precoArroba);
    porFrig.set(v.frigorifico, acc);
  }
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><button className="btn btn-primary" onClick={() => setNova(true)}><Plus className="h-4 w-4" /> Venda para frigorífico</button></div>
      <Card eyebrow="Histórico por frigorífico" title="Quem paga melhor">
        <Tabela>
          <thead><tr><th>Frigorífico</th><th className="r">Cabeças</th><th className="r">@ vendidas</th><th className="r">Preço médio/@</th><th className="r">Rendimento médio</th><th className="r">Valor líquido/@</th></tr></thead>
          <tbody>{[...porFrig].map(([f, v]) => (
            <tr key={f}><td>{f}</td><td className="r num">{v.n}</td><td className="r num">{num(v.arrobas, 1)}</td><td className="r num">{brl(v.precos.reduce((s, x) => s + x, 0) / v.precos.length)}</td>
              <td className="r num">{num(v.rend.reduce((s, x) => s + x, 0) / v.rend.length, 1)}%</td><td className="r num font-semibold">{brl(v.valor / v.arrobas)}</td></tr>
          ))}</tbody>
        </Tabela>
      </Card>
      <Card eyebrow="Romaneios" title="Vendas registradas">
        <Tabela>
          <thead><tr><th>Data</th><th>Frigorífico</th><th className="r">Cab</th><th className="r">Peso vivo</th><th className="r">Carcaça</th><th className="r">Rend.</th><th className="r">R$/@</th><th className="r">Valor</th><th>GTA</th></tr></thead>
          <tbody>{vendas.map((v) => (
            <tr key={v.id}><td className="num">{isoToBrDate(v.data)}</td><td>{v.frigorifico}</td><td className="r num">{v.animalIds.length}</td><td className="r num">{num(v.pesoVivoTotalKg, 0)} kg</td>
              <td className="r num">{num(v.pesoCarcacaTotalKg, 0)} kg</td><td className="r num">{num(rendimentoCarcaca(v), 1)}%</td><td className="r num">{brl(v.precoArroba)}</td><td className="r num font-semibold">{brl(valorVenda(v))}</td><td className="num text-muted">{v.gta ?? '—'}</td></tr>
          ))}</tbody>
        </Tabela>
      </Card>
      {nova ? <NovaVenda onFechar={() => setNova(false)} /> : null}
    </div>
  );
}

function NovaVenda({ onFechar }: { onFechar: () => void }) {
  const e = useEstado();
  const hoje = useHoje();
  const ix = useIndices();
  const lotes = e.lotes.filter((l) => l.atividade === 'corte');
  const [f, setF] = useState({ data: hoje, frigorifico: '', loteId: lotes.find((l) => l.fase === 'confinamento')?.id ?? '', preco: '', rend: String(e.fazenda.rendimentoCarcacaPct), bon: '0', desc: '0', gta: '', vencimento: addDias(hoje, 30), qtd: '' });
  const bichos = animaisDoLote(e.animais, f.loteId);
  const carencia = new Set(carenciasAtivas(e.sanidade, f.data).filter((c) => c.bloqueiaCarne).map((c) => c.animalId));
  const aptos = bichos.filter((a) => !carencia.has(a.id)).sort((a, b) => pesoAtual(b, ix.pesagens.get(b.id), hoje) - pesoAtual(a, ix.pesagens.get(a.id), hoje));
  const qtd = Math.min(aptos.length, Number(f.qtd) || aptos.length);
  const sel = aptos.slice(0, qtd);
  const pv = sel.reduce((s, a) => s + pesoAtual(a, ix.pesagens.get(a.id), hoje), 0);
  const n = (s: string) => Number(s.replace(',', '.')) || 0;
  const pc = pv * (n(f.rend) / 100);
  const valor = (pc / KG_POR_ARROBA) * n(f.preco) + n(f.bon) - n(f.desc);
  function gravar() {
    if (!f.frigorifico || !n(f.preco) || !sel.length) return;
    salvar('vendas', { id: novoId('v'), data: f.data, frigorifico: f.frigorifico, animalIds: sel.map((a) => a.id), pesoVivoTotalKg: Math.round(pv), pesoCarcacaTotalKg: Math.round(pc), precoArroba: n(f.preco), bonificacoes: n(f.bon), descontos: n(f.desc), gta: f.gta || undefined });
    salvarVarios('animais', sel.map((a) => ({ ...a, status: 'vendido' as const, dataSaida: f.data, loteId: undefined })));
    salvar('lancamentos', { id: novoId('f'), data: f.data, historico: `Venda de ${sel.length} bois · ${f.frigorifico}`, debito: CONTA_CLIENTES, credito: '4.1.01', valor: Math.round(valor * 100) / 100, atividade: 'corte', fornecedor: f.frigorifico, nota: f.gta || undefined, vencimento: f.vencimento, safra: safraDe(f.data) });
    salvar('lancamentos', { id: novoId('f'), data: f.data, historico: `Funrural sobre venda · ${f.frigorifico}`, debito: '5.3.01', credito: '2.1.03', valor: Math.round(valor * (e.fazenda.funruralPct / 100) * 100) / 100, atividade: 'corte', vencimento: addDias(f.data.slice(0, 8) + '20', 30), safra: safraDe(f.data) });
    if (f.gta) salvar('documentos', { id: novoId('d'), tipo: 'GTA', numero: f.gta, emissao: f.data, status: 'vigente', origem: e.fazenda.nome, destino: f.frigorifico, finalidade: 'Abate', quantidade: sel.length, animalIds: sel.map((a) => a.id) });
    onFechar();
  }
  return (
    <Modal aberto onFechar={onFechar} titulo="Venda para frigorífico" eyebrow="Corte" largura="max-w-2xl">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <Field label="Data do abate"><Input type="date" value={f.data} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Field>
        <Field label="Frigorífico" className="sm:col-span-2"><Input list="frigs" value={f.frigorifico} onChange={(ev) => setF({ ...f, frigorifico: ev.target.value })} /></Field>
        <Field label="Lote"><Select value={f.loteId} onChange={(ev) => setF({ ...f, loteId: ev.target.value })} opcoes={lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
        <Field label={`Cabeças (máx. ${aptos.length})`} dica="os mais pesados primeiro"><Input inputMode="numeric" value={f.qtd} onChange={(ev) => setF({ ...f, qtd: ev.target.value })} placeholder={String(aptos.length)} /></Field>
        <Field label="Preço da @ (R$)"><Input inputMode="decimal" value={f.preco} onChange={(ev) => setF({ ...f, preco: ev.target.value })} /></Field>
        <Field label="Rendimento (%)"><Input inputMode="decimal" value={f.rend} onChange={(ev) => setF({ ...f, rend: ev.target.value })} /></Field>
        <Field label="Bonificações (R$)"><Input inputMode="decimal" value={f.bon} onChange={(ev) => setF({ ...f, bon: ev.target.value })} /></Field>
        <Field label="Descontos (R$)"><Input inputMode="decimal" value={f.desc} onChange={(ev) => setF({ ...f, desc: ev.target.value })} /></Field>
        <Field label="GTA"><Input value={f.gta} onChange={(ev) => setF({ ...f, gta: ev.target.value })} /></Field>
        <Field label="Recebimento"><Input type="date" value={f.vencimento} onChange={(ev) => setF({ ...f, vencimento: ev.target.value })} /></Field>
      </div>
      <datalist id="frigs">{[...new Set(e.vendas.map((v) => v.frigorifico))].map((x) => <option key={x} value={x} />)}</datalist>
      {carencia.size && bichos.some((a) => carencia.has(a.id)) ? <p className="mt-4 text-[12.5px] text-warn">{bichos.filter((a) => carencia.has(a.id)).length} animal(is) em carência ficaram fora da venda.</p> : null}
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-sm bg-paper/70 px-4 py-3 text-[13px]">
        <div><div className="eyebrow text-muted">Peso vivo</div><div className="num">{num(pv, 0)} kg</div></div>
        <div><div className="eyebrow text-muted">@ de carcaça</div><div className="num">{num(pc / KG_POR_ARROBA, 1)}</div></div>
        <div><div className="eyebrow text-muted">Valor bruto</div><div className="num font-semibold">{brl(valor)}</div></div>
      </div>
      <p className="mt-3 text-[12px] text-muted">Ao salvar: os animais saem do rebanho, entra o título a receber (4.1.01), o Funrural a recolher ({e.fazenda.funruralPct}%) e a GTA em Documentos. Confira o romaneio do frigorífico e ajuste os pesos se precisar.</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.frigorifico || !n(f.preco) || !sel.length} onClick={gravar}>Registrar venda</button>
      </div>
    </Modal>
  );
}

function Indicadores() {
  const e = useEstado();
  const hoje = useHoje();
  const de = addDias(hoje, -364);
  const desfrute = taxaDesfrute(e.animais, de, hoje);
  const mort = mortalidade(e.ocorrencias, e.animais, de, hoje);
  const idade = idadeMediaAbate(e.vendas, e.animais, de, hoje);
  const d = dre(e.lancamentos, e.contas, de, hoje, 'corte');
  const area = e.piquetes.filter((p) => p.status !== 'reforma').reduce((s, p) => s + p.areaHa, 0);
  const arrobasVend = e.vendas.filter((v) => v.data >= de).reduce((s, v) => s + v.pesoCarcacaTotalKg / KG_POR_ARROBA, 0);
  return (
    <div className="space-y-5">
      <StatGrid cols={4}>
        <Stat label="Taxa de desfrute · 12 m" value={desfrute != null ? `${num(desfrute, 1)}%` : '—'} tone="leaf" hint="vendidos ÷ rebanho médio (média nacional ≈ 22%)" />
        <Stat label="Mortalidade · 12 m" value={mort != null ? `${num(mort, 1)}%` : '—'} tone={mort != null && mort > 2 ? 'alert' : undefined} hint="meta abaixo de 2%" />
        <Stat label="Idade média ao abate" value={idade != null ? `${num(idade, 1)} m` : '—'} hint="precoce: até 24 meses" tone={idade != null && idade <= 24 ? 'leaf' : 'earth'} />
        <Stat label="@ vendidas por hectare" value={area ? num(arrobasVend / area, 1) : '—'} hint={`${num(arrobasVend, 0)} @ em ${num(area)} ha`} />
      </StatGrid>
      <StatGrid cols={3}>
        <Stat label="Receita do corte · 12 m" value={brl(d.receitas)} tone="leaf" />
        <Stat label="Resultado do corte · 12 m" value={brl(d.resultado)} tone={d.resultado < 0 ? 'alert' : 'leaf'} hint="antes do rateio dos custos gerais" />
        <Stat label="Lucro por hectare" value={area ? brl(d.resultado / area) : '—'} />
      </StatGrid>
      <Aviso tone="earth" titulo="Rastreabilidade premium">Cada animal tem campo de SISBOV, histórico sanitário com partida e GTA de saída. Protocolos como SISBOV, Carne Carbono Neutro e programas de qualidade de frigorífico usam esses dados. A exportação no formato de cada programa está no roteiro.</Aviso>
    </div>
  );
}

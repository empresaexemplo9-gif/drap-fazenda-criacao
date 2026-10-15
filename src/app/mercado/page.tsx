'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useEstado, salvar, novoId } from '@/lib/store';
import { useHoje, usePerfil } from '@/lib/hooks';
import { brl, num, isoToBrDate, isoToBrShort } from '@/lib/format';
import { relacaoTroca } from '@/lib/domain/simulador';
import { ROT_INDICADOR } from '@/lib/rotulos';
import type { Indicador } from '@/lib/domain/types';
import { PageHeader, Em, Card, Field, Input, Stat, StatGrid, Tabela, Aviso } from '@/components/ui';
import { Linha } from '@/components/graficos';

export default function MercadoPage() {
  const e = useEstado();
  const { ativo } = usePerfil();
  const corte = ativo('corte');
  const comBoi = corte || ativo('genetica');
  const ult = (ind: Indicador) => e.cotacoes.filter((c) => c.indicador === ind).sort((a, b) => a.data.localeCompare(b.data)).pop()?.valor;
  const boi = ult('boi_gordo');
  const bez = ult('bezerro');
  const leite = ult('leite');
  const sBoi = e.cotacoes.filter((c) => c.indicador === 'boi_gordo').sort((a, b) => a.data.localeCompare(b.data));
  const variacao = sBoi.length > 4 ? ((sBoi[sBoi.length - 1].valor / sBoi[sBoi.length - 5].valor) - 1) * 100 : null;
  const indicadores = indicadoresDoPerfil(ativo);

  return (
    <>
      <PageHeader eyebrow="XII · Mercado" title={<>O preço que <Em tom="earth">mexe com a sua conta</Em></>}
        sub="Só as cotações da sua operação: boi e bezerro para corte e genética, leite para o leiteiro, milho e soja para a dieta. A decisão de vender ou segurar fica no módulo Corte." />

      <div className="mb-6">
        <StatGrid cols={4}>
          {comBoi ? <Stat label="Boi gordo" value={boi ? `${brl(boi)}/@` : '—'} tone="leaf" hint={variacao != null ? `${variacao >= 0 ? '+' : ''}${num(variacao, 1)}% em 4 semanas` : undefined} /> : null}
          {comBoi ? <Stat label="Bezerro" value={bez ? brl(bez) : '—'} hint="por cabeça" /> : null}
          {corte ? <Stat label="Relação de troca" value={boi && bez ? num(relacaoTroca(boi, 18, bez)) : '—'} hint="bezerros por boi de 18 @ (acima de 2 = reposição barata)" tone="earth" /> : null}
          {ativo('leite') ? <Stat label="Leite" value={leite ? `${brl(leite)}/L` : '—'} tone="leaf" hint="preço pago pelo laticínio" /> : null}
          <Stat label="Milho" value={ult('milho') ? `${brl(ult('milho')!)}/sc` : '—'} hint="pesa no custo da dieta" />
        </StatGrid>
      </div>

      {corte ? (
        <div className="mb-6">
          <Aviso tone="leaf" titulo="Vender ou segurar?">Os simuladores de venda e de terminação (pasto × confinamento) estão no <Link href="/corte/?aba=decisao" className="font-semibold underline">módulo Corte</Link>, com o peso e o GMD dos seus lotes.</Aviso>
        </div>
      ) : null}

      <Cotacoes indicadores={indicadores} />
    </>
  );
}

function indicadoresDoPerfil(ativo: (a: 'corte' | 'leite' | 'genetica') => boolean): Indicador[] {
  const out: Indicador[] = [];
  if (ativo('corte') || ativo('genetica')) out.push('boi_gordo', 'vaca_gorda', 'bezerro');
  if (ativo('leite')) out.push('leite');
  out.push('milho', 'soja');
  return out;
}

function Cotacoes({ indicadores }: { indicadores: Indicador[] }) {
  const e = useEstado();
  const hoje = useHoje();
  const [ind, setInd] = useState<Indicador>(indicadores[0]);
  const [nova, setNova] = useState({ valor: '', fonte: 'Manual', data: hoje });
  const serie = e.cotacoes.filter((c) => c.indicador === ind).sort((a, b) => a.data.localeCompare(b.data));
  const fmt = (v: number) => (ind === 'leite' ? `R$ ${num(v)}` : brl(v));
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2" eyebrow="Série" title={ROT_INDICADOR[ind]}
        actions={<select className="field-input w-auto py-1 text-[13px]" value={ind} onChange={(ev) => setInd(ev.target.value as Indicador)} aria-label="Indicador">
          {indicadores.map((k) => <option key={k} value={k}>{ROT_INDICADOR[k]}</option>)}
        </select>}>
        <Linha pontos={serie.map((c) => ({ x: c.data, y: c.valor }))} formatar={fmt} rotuloX={(x) => isoToBrShort(x)} />
        <Tabela className="mt-3">
          <thead><tr><th>Data</th><th className="r">Valor</th><th>Fonte</th><th>Praça</th></tr></thead>
          <tbody>{[...serie].reverse().slice(0, 8).map((c) => <tr key={c.id}><td className="num">{isoToBrDate(c.data)}</td><td className="r num">{fmt(c.valor)}</td><td className="text-muted">{c.fonte}</td><td className="text-muted">{c.praca ?? '—'}</td></tr>)}</tbody>
        </Tabela>
      </Card>
      <Card eyebrow="Registrar" title="Nova cotação" icon={<Plus className="h-5 w-5" strokeWidth={1.5} />}>
        <div className="space-y-4">
          <Field label="Data"><Input type="date" value={nova.data} onChange={(ev) => setNova({ ...nova, data: ev.target.value })} /></Field>
          <Field label={ROT_INDICADOR[ind]}><Input inputMode="decimal" value={nova.valor} onChange={(ev) => setNova({ ...nova, valor: ev.target.value })} /></Field>
          <Field label="Fonte"><Input value={nova.fonte} onChange={(ev) => setNova({ ...nova, fonte: ev.target.value })} placeholder="frigorífico, laticínio, boletim" /></Field>
          <button className="btn btn-primary w-full" disabled={!(Number(nova.valor.replace(',', '.')) > 0)}
            onClick={() => { salvar('cotacoes', { id: novoId('c'), data: nova.data, indicador: ind, valor: Number(nova.valor.replace(',', '.')), fonte: nova.fonte }); setNova({ ...nova, valor: '' }); }}>Salvar cotação</button>
        </div>
        <div className="mt-5"><Aviso tone="earth">Integração automática com indicadores públicos (Cepea/Esalq, B3) e com o preço pago por frigoríficos e laticínios parceiros está no roteiro. No piloto a cotação é digitada.</Aviso></div>
      </Card>
    </div>
  );
}

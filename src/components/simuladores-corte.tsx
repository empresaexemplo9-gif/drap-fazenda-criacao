'use client';

/**
 * Simuladores de decisão do módulo Corte: vender agora ou segurar o lote, e
 * terminar a pasto, em semiconfinamento ou em confinamento.
 */

import { useMemo, useState } from 'react';
import { useEstado } from '@/lib/store';
import { useIndices } from '@/lib/hooks';
import { brl, num } from '@/lib/format';
import { addDias } from '@/lib/datas';
import { venderOuSegurar, compararTerminacao } from '@/lib/domain/simulador';
import { animaisDoLote, pesoAtual, gmdGrupo } from '@/lib/domain/rebanho';
import { Card, Field, Input, Select, Tabela, Badge, cx } from './ui';

export function VenderSegurar({ boi, hoje }: { boi: number; hoje: string }) {
  const e = useEstado();
  const ix = useIndices();
  const lotesCorte = e.lotes.filter((l) => l.atividade === 'corte' && animaisDoLote(e.animais, l.id).length);
  const [loteId, setLoteId] = useState(lotesCorte.find((l) => l.fase === 'confinamento')?.id ?? lotesCorte[0]?.id ?? '');
  const base = useMemo(() => {
    const bichos = animaisDoLote(e.animais, loteId);
    const peso = bichos.length ? bichos.reduce((s, a) => s + pesoAtual(a, ix.pesagens.get(a.id), hoje), 0) / bichos.length : 500;
    const g = gmdGrupo(bichos.map((a) => a.id), ix.pesagens, addDias(hoje, -90), hoje) ?? 0.8;
    const fase = e.lotes.find((l) => l.id === loteId)?.fase;
    return { cab: bichos.length || 1, peso: Math.round(peso), gmd: Math.round(g * 1000) / 1000, custo: fase === 'confinamento' ? 15 : 4.5 };
  }, [loteId, e.animais, e.lotes, ix.pesagens, hoje]);
  const [f, setF] = useState<Record<string, string>>({});
  const v = (k: string, d: number) => (f[k] !== undefined ? Number(f[k].replace(',', '.')) || 0 : d);
  const ent = {
    cabecas: v('cab', base.cab), pesoAtualKg: v('peso', base.peso), gmdKg: v('gmd', base.gmd), dias: v('dias', 30),
    precoArrobaHoje: v('hoje', boi), precoArrobaFuturo: v('futuro', Math.round(boi * 1.02 * 100) / 100), custoDiarioCabeca: v('custo', base.custo),
    rendimentoHojePct: v('rendH', e.fazenda.rendimentoCarcacaPct), rendimentoFuturoPct: v('rendF', e.fazenda.rendimentoCarcacaPct + 0.5), descontosVendaPct: v('desc', e.fazenda.funruralPct + 1),
  };
  const r = venderOuSegurar(ent);
  const campo = (k: string, label: string, d: number, dica?: string) => (
    <Field label={label} dica={dica}><Input inputMode="decimal" value={f[k] ?? String(d).replace('.', ',')} onChange={(ev) => setF({ ...f, [k]: ev.target.value })} /></Field>
  );
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-3" eyebrow="Premissas" title="O lote e o mercado">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <Field label="Lote" className="col-span-2 sm:col-span-3"><Select value={loteId} onChange={(ev) => { setLoteId(ev.target.value); setF({}); }} opcoes={lotesCorte.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
          {campo('cab', 'Cabeças', base.cab)}
          {campo('peso', 'Peso médio hoje (kg)', base.peso)}
          {campo('gmd', 'GMD esperado (kg/d)', base.gmd, 'do lote, últimos 90 dias')}
          {campo('dias', 'Segurar por (dias)', 30)}
          {campo('hoje', 'Preço da @ hoje', boi)}
          {campo('futuro', 'Preço da @ na saída', Math.round(boi * 1.02 * 100) / 100, 'mercado futuro ou expectativa')}
          {campo('custo', 'Custo diário (R$/cab)', base.custo, 'dieta + operação')}
          {campo('rendH', 'Rendimento hoje (%)', e.fazenda.rendimentoCarcacaPct)}
          {campo('rendF', 'Rendimento na saída (%)', e.fazenda.rendimentoCarcacaPct + 0.5)}
          {campo('desc', 'Funrural + frete (%)', e.fazenda.funruralPct + 1)}
        </div>
      </Card>
      <Card className="lg:col-span-2" eyebrow="Resultado" title={r.recomendacao === 'segurar' ? 'Compensa segurar' : 'Melhor vender agora'} tone={r.recomendacao === 'segurar' ? 'leaf' : 'earth'}>
        <dl className="space-y-2 text-[13.5px]">
          <div className="flex justify-between border-b border-rule/40 pb-1.5"><dt className="text-muted">Vendendo hoje</dt><dd className="num">{brl(r.receitaHoje)}</dd></div>
          <div className="flex justify-between border-b border-rule/40 pb-1.5"><dt className="text-muted">Vendendo em {ent.dias} dias</dt><dd className="num">{brl(r.receitaFutura)}</dd></div>
          <div className="flex justify-between border-b border-rule/40 pb-1.5"><dt className="text-muted">Custo de segurar</dt><dd className="num">−{brl(r.custoAdicional)}</dd></div>
          <div className="flex justify-between pt-1"><dt className="font-semibold">Ganho líquido de segurar</dt><dd className={cx('num text-lg font-semibold', r.ganhoLiquido >= 0 ? 'text-leafDk' : 'text-alert')}>{r.ganhoLiquido >= 0 ? '+' : '−'}{brl(Math.abs(r.ganhoLiquido))}</dd></div>
        </dl>
        <div className="mt-5 grid grid-cols-2 gap-4 text-[13px]">
          <div><div className="eyebrow text-muted">@ por cabeça</div><div className="num">{num(r.arrobasHoje, 1)} → {num(r.arrobasFuturo, 1)}</div></div>
          <div><div className="eyebrow text-muted">Peso final</div><div className="num">{Math.round(r.pesoFinalKg)} kg</div></div>
          <div><div className="eyebrow text-muted">@ de equilíbrio</div><div className="num font-semibold">{brl(r.precoEquilibrio)}</div></div>
          <div><div className="eyebrow text-muted">Custo da @ a mais</div><div className="num">{r.custoArrobaAdicional ? brl(r.custoArrobaAdicional) : '—'}</div></div>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-muted">Se a @ na saída ficar abaixo de <span className="num font-semibold text-ink">{brl(r.precoEquilibrio)}</span>, vender hoje é melhor. Confira a carência dos animais antes de programar o embarque.</p>
      </Card>
    </div>
  );
}

export function Terminacao({ boi }: { boi: number }) {
  const e = useEstado();
  const [f, setF] = useState({ entrada: '420', abate: '540', rendE: '50', pGmd: '0,6', pCusto: '4', pRend: '52', cGmd: '1,6', cCusto: '15', cRend: '54', sGmd: '0,9', sCusto: '7,5', sRend: '53' });
  const n = (s: string) => Number(s.replace(',', '.')) || 0;
  const res = compararTerminacao(n(f.entrada), n(f.abate), boi, n(f.rendE), [
    { nome: 'Pasto + mineral', gmdKg: n(f.pGmd), custoDiarioCabeca: n(f.pCusto), rendimentoPct: n(f.pRend) },
    { nome: 'Semiconfinamento', gmdKg: n(f.sGmd), custoDiarioCabeca: n(f.sCusto), rendimentoPct: n(f.sRend) },
    { nome: 'Confinamento', gmdKg: n(f.cGmd), custoDiarioCabeca: n(f.cCusto), rendimentoPct: n(f.cRend) },
  ]);
  const melhor = [...res].sort((a, b) => b.margemDia - a.margemDia)[0];
  const inp = (k: keyof typeof f, label: string) => <Field label={label}><Input inputMode="decimal" value={f[k]} onChange={(ev) => setF({ ...f, [k]: ev.target.value })} /></Field>;
  return (
    <div className="space-y-5">
      <Card eyebrow="Premissas por cabeça" title={`Do peso de entrada ao abate · @ a ${brl(boi)}`}>
        <div className="grid grid-cols-3 gap-5">{inp('entrada', 'Peso de entrada (kg)')}{inp('abate', 'Peso de abate (kg)')}{inp('rendE', 'Rendimento na entrada (%)')}</div>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {([['p', 'Pasto + mineral'], ['s', 'Semiconfinamento'], ['c', 'Confinamento']] as const).map(([k, nome]) => (
            <div key={k} className="rounded-sm border border-rule/60 p-4">
              <div className="eyebrow mb-3">{nome}</div>
              <div className="grid grid-cols-3 gap-3">{inp(`${k}Gmd` as keyof typeof f, 'GMD')}{inp(`${k}Custo` as keyof typeof f, 'R$/dia')}{inp(`${k}Rend` as keyof typeof f, 'Rend. %')}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card eyebrow="Comparativo" title={`Melhor margem por dia: ${melhor.cenario.nome}`}>
        <Tabela>
          <thead><tr><th>Sistema</th><th className="r">Dias</th><th className="r">@ produzidas</th><th className="r">Custo total</th><th className="r">Custo/@</th><th className="r">Receita das @</th><th className="r">Margem</th><th className="r">Margem/dia</th></tr></thead>
          <tbody>
            {res.map((r) => (
              <tr key={r.cenario.nome} className={cx(r === melhor && 'bg-leafLt/40')}>
                <td>{r.cenario.nome} {r === melhor ? <Badge tone="leaf">melhor</Badge> : null}</td>
                <td className="r num">{Number.isFinite(r.dias) ? r.dias : '—'}</td>
                <td className="r num">{num(r.arrobasProduzidas, 1)}</td>
                <td className="r num">{brl(r.custoTotal)}</td>
                <td className={cx('r num font-semibold', r.custoArroba > boi && 'text-alert')}>{Number.isFinite(r.custoArroba) ? brl(r.custoArroba) : '—'}</td>
                <td className="r num">{brl(r.receita)}</td>
                <td className={cx('r num', r.margem < 0 && 'text-alert')}>{brl(r.margem)}</td>
                <td className="r num font-semibold">{brl(r.margemDia)}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
        <p className="mt-3 text-[12px] text-muted">Margem por dia importa porque o confinamento libera o pasto e o capital mais cedo. Rendimento de carcaça maior no confinado aumenta as @ vendidas. Valores por cabeça; o rendimento padrão da fazenda é {e.fazenda.rendimentoCarcacaPct}%.</p>
      </Card>
    </div>
  );
}


'use client';

import { useMemo, useState } from 'react';
import { useEstado } from '@/lib/store';
import { useHoje } from '@/lib/hooks';
import { brl, num, isoToBrDate } from '@/lib/format';
import { addDias, periodoSafra, safraDe } from '@/lib/datas';
import { custoPorLote, resumoCustos, lucroPorHectare, type CriterioRateio } from '@/lib/domain/custos';
import { dre } from '@/lib/domain/livro-razao';
import { moduloAtivo } from '@/lib/domain/modulos';
import { ROT_ATIVIDADE, ROT_FASE } from '@/lib/rotulos';
import { PageHeader, Em, Card, Tabela, Field, Select, Input, StatGrid, Stat, Aviso, cx } from '@/components/ui';
import { BarrasH } from '@/components/graficos';

export default function CustosPage() {
  const e = useEstado();
  const hoje = useHoje();
  const [periodo, setPeriodo] = useState<'90' | '180' | 'safra' | 'livre'>('90');
  const [de0, setDe0] = useState(addDias(hoje, -89));
  const [ate0, setAte0] = useState(hoje);
  const [criterio, setCriterio] = useState<CriterioRateio>('ua_dia');
  const oQue = [e.modulos.corte && 'a arroba', e.modulos.leite && 'o litro', e.modulos.genetica && 'o plantel PO'].filter(Boolean).join(e.modulos.corte && e.modulos.leite && e.modulos.genetica ? ', ' : ' e ').replace(/, (?=[^,]*$)/, ' e ');

  const [de, ate] = periodo === '90' ? [addDias(hoje, -89), hoje] : periodo === '180' ? [addDias(hoje, -179), hoje]
    : periodo === 'safra' ? [periodoSafra(safraDe(hoje))[0], hoje] : [de0, ate0];

  const c = useMemo(() => custoPorLote(e.lancamentos, e.contas, e.lotes, e.animais, e.pesagens, de, ate, e.fazenda.rendimentoCarcacaPct, criterio),
    [e.lancamentos, e.contas, e.lotes, e.animais, e.pesagens, de, ate, e.fazenda.rendimentoCarcacaPct, criterio]);
  const res = resumoCustos(c.lotes, e.ordenhas, de, ate);
  const d = dre(e.lancamentos, e.contas, de, ate);
  const area = e.fazenda.areaTotalHa || e.piquetes.reduce((s, p) => s + p.areaHa, 0);
  const lph = lucroPorHectare(d.resultado, area);
  const ult = (ind: string) => e.cotacoes.filter((x) => x.indicador === ind).sort((a, b) => a.data.localeCompare(b.data)).pop()?.valor;
  const boi = ult('boi_gordo');
  const leite = ult('leite');
  const corte = res.find((r) => r.atividade === 'corte')!;
  const lt = res.find((r) => r.atividade === 'leite')!;
  const fixos = d.porConta.filter((x) => x.conta.codigo.startsWith('5.2') || x.conta.codigo.startsWith('5.3'));
  const variaveis = d.porConta.filter((x) => x.conta.codigo.startsWith('5.1'));

  return (
    <>
      <PageHeader eyebrow="VIII · Custo de produção" title={<>Quanto <Em>custou {oQue}</Em></>}
        sub="Custo direto do lote mais o rateio de mão de obra, combustível, energia, depreciação e reforma de pasto, só entre as atividades que a fazenda pratica. O produtor sabe o que vendeu; aqui ele vê quanto custou."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Período"><Select value={periodo} onChange={(ev) => setPeriodo(ev.target.value as typeof periodo)} opcoes={[
          { value: '90', label: 'Últimos 90 dias' }, { value: '180', label: 'Últimos 180 dias' }, { value: 'safra', label: `${safraDe(hoje)} até hoje` }, { value: 'livre', label: 'Personalizado' },
        ]} /></Field>
        {periodo === 'livre' ? <>
          <Field label="De"><Input type="date" value={de0} onChange={(ev) => setDe0(ev.target.value)} /></Field>
          <Field label="Até"><Input type="date" value={ate0} onChange={(ev) => setAte0(ev.target.value)} /></Field>
        </> : null}
        <Field label="Critério de rateio" dica="UA·dia pesa tamanho e permanência"><Select value={criterio} onChange={(ev) => setCriterio(ev.target.value as CriterioRateio)} opcoes={[
          { value: 'ua_dia', label: 'UA·dia (recomendado)' }, { value: 'cabecas', label: 'Cabeças·dia' }, { value: 'igual', label: 'Igual entre lotes' },
        ]} /></Field>
      </div>

      <StatGrid cols={4}>
        {moduloAtivo(e.modulos, 'corte') ? <Stat label="Custo da @ produzida" value={corte.custoArroba != null ? brl(corte.custoArroba) : '—'} size="lg"
          tone={boi && corte.custoArroba ? (corte.custoArroba < boi ? 'leaf' : 'alert') : undefined}
          hint={boi ? `@ do boi a ${brl(boi)} · margem ${corte.custoArroba ? brl(boi - corte.custoArroba) : '—'}/@` : undefined} /> : null}
        {moduloAtivo(e.modulos, 'corte') ? <Stat label="@ produzidas (corte)" value={num(corte.arrobas, 1)} hint={`${e.fazenda.rendimentoCarcacaPct}% de rendimento de carcaça`} /> : null}
        {moduloAtivo(e.modulos, 'leite') ? <Stat label="Custo do litro" value={lt.custoLitro != null ? brl(lt.custoLitro) : '—'} size="lg"
          tone={leite && lt.custoLitro ? (lt.custoLitro < leite ? 'leaf' : 'alert') : undefined}
          hint={leite ? `leite pago a ${brl(leite)}/L · ${num(lt.litros, 1).replace(',0', '')} L no período` : undefined} /> : null}
        {moduloAtivo(e.modulos, 'genetica') ? (() => {
          const gl = c.lotes.filter((l) => l.lote.atividade === 'genetica');
          const tot = gl.reduce((s, l) => s + l.total, 0);
          const cab = gl.reduce((s, l) => s + l.cabecasMedias, 0);
          const meses = Math.max(1, (Date.parse(ate) - Date.parse(de)) / 864e5 / 30.4375);
          return <Stat label="Custo do plantel PO" value={cab ? brl(tot / cab / meses) : '—'} size="lg" hint={`por cabeça/mês · ${num(cab, 0)} cab · ${brl(tot)} no período`} />;
        })() : null}
        <Stat label="Resultado por hectare" value={lph != null ? brl(lph) : '—'} tone={lph != null && lph < 0 ? 'alert' : 'leaf'} hint={`${num(area)} ha · resultado ${brl(d.resultado)}`} />
      </StatGrid>

      <Card className="mt-6" eyebrow={`${isoToBrDate(de)} a ${isoToBrDate(ate)}`} title="Custo por lote">
        <Tabela>
          <thead><tr><th>Lote</th><th>Atividade</th><th className="r">Cab. médias</th><th className="r">Direto</th><th className="r">Rateado</th><th className="r">Total</th><th className="r">@ prod.</th><th className="r">Custo/@</th><th className="r">R$/cab/mês</th></tr></thead>
          <tbody>
            {c.lotes.filter((l) => moduloAtivo(e.modulos, l.lote.atividade === 'geral' ? 'core' : l.lote.atividade)).map((l) => (
              <tr key={l.lote.id}>
                <td>{l.lote.nome}<div className="text-[11px] text-muted">{ROT_FASE[l.lote.fase]}</div></td>
                <td className="text-muted">{ROT_ATIVIDADE[l.lote.atividade]}</td>
                <td className="r num">{num(l.cabecasMedias, 1)}</td>
                <td className="r num">{brl(l.direto)}</td>
                <td className="r num text-muted">{brl(l.rateado)}</td>
                <td className="r num font-semibold">{brl(l.total)}</td>
                <td className="r num">{l.arrobasProduzidas ? num(l.arrobasProduzidas, 1) : '—'}</td>
                <td className={cx('r num font-semibold', boi && l.custoPorArroba && l.custoPorArroba > boi && 'text-alert')}>{l.custoPorArroba ? brl(l.custoPorArroba) : '—'}</td>
                <td className="r num">{l.custoCabecaMes ? brl(l.custoCabecaMes) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
        {c.naoRateado > 0 ? <p className="mt-3 text-[12px] text-alert">{brl(c.naoRateado)} sem lote para rateio (atividade sem animais no período).</p> : null}
        <p className="mt-3 text-[12px] text-muted">@ produzida = GMD de cada animal × dias no período × rendimento de carcaça ÷ 15 kg. Lotes de cria têm custo por @ alto porque a vaca não ganha peso. Para eles, o indicador certo é o custo por bezerro desmamado.</p>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card eyebrow="Diretos do lote" title={`Custos variáveis · ${brl(d.custosVariaveis)}`}>
          <BarrasH itens={variaveis.sort((a, b) => b.valor - a.valor).map((x) => ({ rotulo: x.conta.nome, valor: x.valor }))} formatar={brl} tom="leaf" />
        </Card>
        <Card eyebrow="Rateados" title={`Custos fixos e financeiros · ${brl(d.custosFixos + d.tributos)}`}>
          <BarrasH itens={fixos.sort((a, b) => b.valor - a.valor).map((x) => ({ rotulo: x.conta.nome, valor: x.valor }))} formatar={brl} />
        </Card>
      </div>

      <div className="mt-6">
        <Aviso tone="earth" titulo="Como o rateio funciona">
          Lançamento com lote é custo direto daquele lote. Lançamento com atividade (corte, leite ou genética) e sem lote é dividido entre os lotes dessa atividade. Lançamento “Geral” (folha, diesel, depreciação) é dividido entre todos os lotes pelo critério escolhido. A depreciação entra pelo lançamento mensal 5.2.07.
        </Aviso>
      </div>
    </>
  );
}

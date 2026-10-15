'use client';

/**
 * Posição: o que pagar e receber num intervalo (padrão: próximos 30 dias,
 * atrasados sempre incluídos), como a /posicao do DRAP Fazenda, com baixa
 * em um clique e o fluxo de caixa mensal que mostra a sazonalidade da
 * pecuária: custeio na seca e receita concentrada na venda da boiada.
 */

import { useMemo, useState } from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import { useEstado, salvar, atualizar, novoId } from '@/lib/store';
import { useHoje } from '@/lib/hooks';
import { brl, isoToBrDate } from '@/lib/format';
import { addDias, rotuloMes } from '@/lib/datas';
import { posicao, baixar, fluxoCaixa, nomeConta, CONTA_BANCO, CONTA_CAIXA, type Titulo } from '@/lib/domain/livro-razao';
import { PageHeader, Em, Card, Field, Input, Select, Badge, Empty, Aviso, cx } from '@/components/ui';
import { BarrasFluxo } from '@/components/graficos';

export default function PosicaoPage() {
  const e = useEstado();
  const hoje = useHoje();
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(addDias(hoje, 30));
  const [agrupar, setAgrupar] = useState(true);
  const [contaBaixa, setContaBaixa] = useState(CONTA_BANCO);

  const pos = useMemo(() => posicao(e.lancamentos, hoje, de, ate), [e.lancamentos, hoje, de, ate]);
  const fluxo = useMemo(() => fluxoCaixa(e.lancamentos, e.contas, hoje, 6, 6), [e.lancamentos, e.contas, hoje]);
  const menorSaldo = fluxo.filter((m) => m.projetado).reduce((min, m) => (m.saldoFinal < min.saldoFinal ? m : min), fluxo[fluxo.length - 1]);

  function darBaixa(t: Titulo) {
    const b = baixar(t.lancamento, hoje, contaBaixa, novoId('f'));
    salvar('lancamentos', b);
    atualizar('lancamentos', t.lancamento.id, { pagoEm: hoje });
  }

  const pagar = pos.titulos.filter((t) => t.tipo === 'pagar');
  const receber = pos.titulos.filter((t) => t.tipo === 'receber');

  return (
    <>
      <PageHeader eyebrow="VII · Posição financeira" title={<>O que <Em tom="earth">pagar e receber</Em> no período</>}
        sub="Títulos em aberto do livro-razão. Atrasados entram sempre. A baixa gera o lançamento de pagamento contra o banco ou o caixa."
        actions={<button className="btn btn-ghost no-print" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir / PDF</button>} />

      <section className="card mb-6 overflow-hidden rounded-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="flex flex-col justify-center gap-2 border-b border-rule p-7 lg:border-b-0 lg:border-r">
            <span className="eyebrow">Líquido do período</span>
            <div className={cx('num text-3xl font-medium sm:text-4xl', pos.liquido < 0 ? 'text-earth' : 'text-leafDk')}>{pos.liquido < 0 ? '−' : '+'}{brl(Math.abs(pos.liquido))}</div>
            <div className="text-sm text-muted">{isoToBrDate(de)} a {isoToBrDate(ate)} · <span className="num">{pos.titulos.length}</span> títulos</div>
          </div>
          <div className="flex flex-col justify-center gap-2 border-b border-rule p-7 lg:border-b-0 lg:border-r">
            <span className="eyebrow">A pagar</span>
            <div className="num text-2xl font-medium">{brl(pos.aPagar)}</div>
            <div className="text-sm text-muted"><span className="num">{pos.atrasados.filter((t) => t.tipo === 'pagar').length}</span> em atraso</div>
          </div>
          <div className="flex flex-col justify-center gap-2 p-7">
            <span className="eyebrow">A receber</span>
            <div className="num text-2xl font-medium text-leafDk">{brl(pos.aReceber)}</div>
            <div className="text-sm text-muted"><span className="num">{receber.length}</span> títulos</div>
          </div>
        </div>
      </section>

      <div className="no-print mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="De"><Input type="date" value={de} onChange={(ev) => setDe(ev.target.value)} /></Field>
        <Field label="Até"><Input type="date" value={ate} onChange={(ev) => setAte(ev.target.value)} /></Field>
        <Field label="Exibir"><Select value={agrupar ? '1' : '0'} onChange={(ev) => setAgrupar(ev.target.value === '1')} opcoes={[{ value: '1', label: 'Separado por tipo' }, { value: '0', label: 'Ordem cronológica' }]} /></Field>
        <Field label="Baixar contra"><Select value={contaBaixa} onChange={(ev) => setContaBaixa(ev.target.value)} opcoes={[{ value: CONTA_BANCO, label: 'Banco' }, { value: CONTA_CAIXA, label: 'Caixa' }]} /></Field>
      </div>

      {agrupar ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ListaTitulos titulo="A pagar" eyebrow="Fornecedores, folha, impostos" itens={pagar} hoje={hoje} onBaixa={darBaixa} />
          <ListaTitulos titulo="A receber" eyebrow="Frigorífico, laticínio, leilão" itens={receber} hoje={hoje} onBaixa={darBaixa} />
        </div>
      ) : (
        <ListaTitulos titulo="Todos os títulos" eyebrow="Ordem de vencimento" itens={pos.titulos} hoje={hoje} onBaixa={darBaixa} />
      )}

      <Card className="mt-8" eyebrow="Fluxo de caixa · 6 meses realizados + 6 projetados" title="Sazonalidade do caixa">
        <BarrasFluxo dados={fluxo.map((m) => ({ rotulo: rotuloMes(m.mes), a: m.entradas, b: m.saidas, linha: m.saldoFinal, destaque: m.projetado }))} />
        <p className="mt-3 text-[12.5px] text-muted">Meses projetados (barras claras) somam títulos em aberto no mês do vencimento e lançamentos marcados como previsão.</p>
      </Card>

      {menorSaldo && menorSaldo.saldoFinal < 0 ? (
        <div className="mt-5"><Aviso tone="alert" titulo="Caixa negativo à frente">Em {rotuloMes(menorSaldo.mes, true)} o saldo projetado chega a <span className="num font-semibold">{brl(menorSaldo.saldoFinal)}</span>. Antecipe venda, renegocie vencimentos ou programe o custeio.</Aviso></div>
      ) : null}
    </>
  );
}

function ListaTitulos({ titulo, eyebrow, itens, hoje, onBaixa }: { titulo: string; eyebrow: string; itens: Titulo[]; hoje: string; onBaixa: (t: Titulo) => void }) {
  const e = useEstado();
  const total = itens.reduce((s, t) => s + (t.tipo === 'pagar' ? -1 : 1) * t.lancamento.valor, 0);
  return (
    <Card eyebrow={eyebrow} title={titulo} pad={false} actions={<span className={cx('num text-[15px] font-semibold', total < 0 ? 'text-ink' : 'text-leafDk')}>{brl(Math.abs(total))}</span>}>
      {itens.length === 0 ? <div className="px-6 pb-4"><Empty>Nada no período.</Empty></div> : (
        <ul>
          {itens.map((t) => (
            <li key={t.lancamento.id} className="flex items-baseline justify-between gap-3 border-t border-earth/15 px-5 py-3 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2 text-[11px] uppercase tracking-wider text-earth">
                  <span className={cx('num', t.atrasado && 'font-semibold text-alert')}>{isoToBrDate(t.vencimento)}</span>
                  {t.atrasado ? <Badge tone="alert">atrasado</Badge> : t.vencimento === hoje ? <Badge tone="warn">hoje</Badge> : null}
                  <span className="normal-case tracking-normal text-muted">{nomeConta(e.contas, t.tipo === 'pagar' ? t.lancamento.debito : t.lancamento.credito)}</span>
                </div>
                <p className="mt-1 text-[14.5px] font-medium">{t.lancamento.historico}</p>
                {t.lancamento.fornecedor ? <p className="text-[12px] text-muted">{t.lancamento.fornecedor}{t.lancamento.nota ? ` · NF ${t.lancamento.nota}` : ''}</p> : null}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={cx('num whitespace-nowrap text-[15px] font-semibold', t.tipo === 'receber' && 'text-leafDk')}>{brl(t.lancamento.valor)}</span>
                <button className="no-print inline-flex items-center gap-1 text-[12px] font-medium text-earth hover:text-leafDk" onClick={() => onBaixa(t)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t.tipo === 'pagar' ? 'Pago' : 'Recebido'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

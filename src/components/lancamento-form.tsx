'use client';

/**
 * Novo lançamento. Quem não é contador escolhe um modelo ("despesa a
 * prazo", "venda à vista"…) e o sistema monta débito e crédito; o modo
 * livre expõe a partida dobrada inteira.
 */

import { useEffect, useMemo, useState } from 'react';
import { useEstado, salvar, novoId } from '@/lib/store';
import { useHoje, usePerfil } from '@/lib/hooks';
import { brl } from '@/lib/format';
import { safraDe } from '@/lib/datas';
import { validarLancamento, CONTA_BANCO, CONTA_CAIXA, CONTA_CLIENTES, CONTA_FORNECEDORES, nivel, fornecedores } from '@/lib/domain/livro-razao';
import { ROT_ATIVIDADE } from '@/lib/rotulos';
import { contaVisivel } from '@/lib/domain/modulos';
import type { Atividade, FormaPgto, Lancamento } from '@/lib/domain/types';
import { Field, Input, Select, Modal, cx } from './ui';

type Modelo = 'despesa_vista' | 'despesa_prazo' | 'receita_vista' | 'receita_prazo' | 'livre';

const MODELOS: { id: Modelo; label: string; dica: string }[] = [
  { id: 'despesa_prazo', label: 'Despesa a prazo', dica: 'NF de fornecedor com vencimento. Entra na Posição até ser paga.' },
  { id: 'despesa_vista', label: 'Despesa paga', dica: 'Saiu do banco ou do caixa hoje.' },
  { id: 'receita_prazo', label: 'Venda a prazo', dica: 'Boi, leite ou animal vendido para receber depois.' },
  { id: 'receita_vista', label: 'Venda recebida', dica: 'Entrou no banco ou no caixa.' },
  { id: 'livre', label: 'Partida dobrada livre', dica: 'Escolha débito e crédito (transferências, empréstimos, ajustes).' },
];

export function LancamentoForm({ aberto, onFechar, inicial }: { aberto: boolean; onFechar: () => void; inicial?: Partial<Lancamento> }) {
  const e = useEstado();
  const hoje = useHoje();
  const [modelo, setModelo] = useState<Modelo>('despesa_prazo');
  const [f, setF] = useState<Partial<Lancamento>>({});
  const [disp, setDisp] = useState(CONTA_BANCO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [valorTxt, setValorTxt] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setF({ data: hoje, atividade: perfil.atividades.length === 1 ? perfil.atividades[0] : 'geral', formaPgto: 'A PAGAR', debito: '5.1.01', ...inicial });
    setValorTxt(inicial?.valor ? String(inicial.valor).replace('.', ',') : '');
    setModelo(inicial?.id ? 'livre' : 'despesa_prazo');
    setErros({});
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const perfil = usePerfil();
  const analiticas = e.contas.filter((c) => nivel(c.codigo) === 3 && contaVisivel(c.codigo, e.modulos));
  const atividadesOp: Atividade[] = [...perfil.atividades, 'geral'];
  const despesas = analiticas.filter((c) => c.natureza === 'despesa');
  const receitas = analiticas.filter((c) => c.natureza === 'receita');
  const opc = (cs: typeof analiticas) => cs.map((c) => ({ value: c.codigo, label: `${c.codigo} · ${c.nome}` }));
  const forn = useMemo(() => fornecedores(e.lancamentos), [e.lancamentos]);

  /** Monta débito/crédito pelo modelo. */
  function partidas(): Pick<Lancamento, 'debito' | 'credito'> {
    switch (modelo) {
      case 'despesa_prazo': return { debito: f.debito ?? '', credito: CONTA_FORNECEDORES };
      case 'despesa_vista': return { debito: f.debito ?? '', credito: disp };
      case 'receita_prazo': return { debito: CONTA_CLIENTES, credito: f.credito ?? '' };
      case 'receita_vista': return { debito: disp, credito: f.credito ?? '' };
      default: return { debito: f.debito ?? '', credito: f.credito ?? '' };
    }
  }

  function trocarModelo(m: Modelo) {
    setModelo(m);
    if (m.startsWith('despesa')) setF((x) => ({ ...x, debito: despesas.some((c) => c.codigo === x.debito) ? x.debito : '5.1.01', formaPgto: m === 'despesa_prazo' ? 'A PAGAR' : 'PIX' }));
    if (m.startsWith('receita')) setF((x) => ({ ...x, credito: receitas.some((c) => c.codigo === x.credito) ? x.credito : receitas[0]?.codigo, formaPgto: m === 'receita_prazo' ? 'A PAGAR' : 'TRANSFER' }));
  }

  function gravar() {
    const valor = Number(valorTxt.replace(/\./g, '').replace(',', '.'));
    const p = partidas();
    const l: Lancamento = {
      id: f.id ?? novoId('f'), data: f.data ?? hoje, historico: (f.historico ?? '').trim(), ...p, valor,
      atividade: (f.atividade ?? 'geral') as Atividade, loteId: f.loteId || undefined, fornecedor: f.fornecedor?.trim() || undefined,
      nota: f.nota?.trim() || undefined, formaPgto: f.formaPgto, safra: safraDe(f.data ?? hoje), previsto: f.previsto || undefined,
      vencimento: modelo.endsWith('prazo') || modelo === 'livre' ? f.vencimento || undefined : undefined,
      pagoEm: f.pagoEm,
    };
    const v = validarLancamento(l, e.contas);
    if ((modelo === 'despesa_prazo' || modelo === 'receita_prazo') && !l.vencimento) v.push({ campo: 'vencimento', msg: 'Informe o vencimento.' });
    if (v.length) { setErros(Object.fromEntries(v.map((x) => [x.campo, x.msg]))); return; }
    salvar('lancamentos', l);
    onFechar();
  }

  const p = partidas();
  const lotes = e.lotes.filter((l) => !f.atividade || f.atividade === 'geral' || l.atividade === f.atividade);

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo={f.id ? 'Editar lançamento' : 'Novo lançamento'} eyebrow="Livro-razão" largura="max-w-2xl">
      {!f.id ? (
        <div className="mb-5 flex flex-wrap gap-2">
          {MODELOS.map((m) => (
            <button key={m.id} type="button" onClick={() => trocarModelo(m.id)}
              className={cx('rounded-full border px-3 py-1 text-[12.5px] font-medium', modelo === m.id ? 'border-ink bg-ink text-paper' : 'border-rule text-muted hover:text-ink')}>{m.label}</button>
          ))}
          <p className="w-full text-[12px] text-muted">{MODELOS.find((m) => m.id === modelo)?.dica}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <Field label="Data" erro={erros.data}><Input type="date" value={f.data ?? ''} onChange={(ev) => setF({ ...f, data: ev.target.value })} /></Field>
        <Field label="Valor (R$)" erro={erros.valor}><Input inputMode="decimal" value={valorTxt} onChange={(ev) => setValorTxt(ev.target.value)} placeholder="0,00" aria-invalid={!!erros.valor} /></Field>
        {modelo.endsWith('prazo') || modelo === 'livre' ? (
          <Field label="Vencimento" erro={erros.vencimento}><Input type="date" value={f.vencimento ?? ''} onChange={(ev) => setF({ ...f, vencimento: ev.target.value })} /></Field>
        ) : (
          <Field label="Saiu / entrou em"><Select value={disp} onChange={(ev) => setDisp(ev.target.value)} opcoes={[{ value: CONTA_BANCO, label: 'Banco' }, { value: CONTA_CAIXA, label: 'Caixa' }]} /></Field>
        )}
        <Field label="Histórico" className="col-span-2 sm:col-span-3" erro={erros.historico}><Input value={f.historico ?? ''} onChange={(ev) => setF({ ...f, historico: ev.target.value })} placeholder="ex.: Sal mineral 80P · NF 48211" /></Field>

        {modelo.startsWith('despesa') ? (
          <Field label="Conta de despesa" className="col-span-2 sm:col-span-3" erro={erros.debito}><Select value={f.debito ?? ''} onChange={(ev) => setF({ ...f, debito: ev.target.value })} opcoes={opc(despesas)} /></Field>
        ) : modelo.startsWith('receita') ? (
          <Field label="Conta de receita" className="col-span-2 sm:col-span-3" erro={erros.credito}><Select value={f.credito ?? ''} onChange={(ev) => setF({ ...f, credito: ev.target.value })} opcoes={opc(receitas)} /></Field>
        ) : (
          <>
            <Field label="Débito" className="col-span-2 sm:col-span-3" erro={erros.debito}><Select value={f.debito ?? ''} vazio="—" onChange={(ev) => setF({ ...f, debito: ev.target.value })} opcoes={opc(analiticas)} /></Field>
            <Field label="Crédito" className="col-span-2 sm:col-span-3" erro={erros.credito}><Select value={f.credito ?? ''} vazio="—" onChange={(ev) => setF({ ...f, credito: ev.target.value })} opcoes={opc(analiticas)} /></Field>
          </>
        )}

        <Field label="Atividade" dica="Geral é rateado no custo"><Select value={f.atividade ?? 'geral'} onChange={(ev) => setF({ ...f, atividade: ev.target.value as Atividade, loteId: undefined })} opcoes={atividadesOp.map((a) => ({ value: a, label: ROT_ATIVIDADE[a] }))} /></Field>
        <Field label="Lote (custo direto)"><Select value={f.loteId ?? ''} onChange={(ev) => setF({ ...f, loteId: ev.target.value || undefined })} vazio="— rateio —" opcoes={lotes.map((l) => ({ value: l.id, label: l.nome }))} /></Field>
        <Field label="Forma de pagamento"><Select value={f.formaPgto ?? ''} onChange={(ev) => setF({ ...f, formaPgto: (ev.target.value || undefined) as FormaPgto })} vazio="—" opcoes={(['A PAGAR', 'BOLETO', 'TRANSFER', 'PIX', 'DINHEIRO', 'CARTAO', 'CREDITO RURAL'] as FormaPgto[]).map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Fornecedor / cliente" className="col-span-2"><Input list="lanc-forn" value={f.fornecedor ?? ''} onChange={(ev) => setF({ ...f, fornecedor: ev.target.value })} /></Field>
        <Field label="Nota fiscal"><Input value={f.nota ?? ''} onChange={(ev) => setF({ ...f, nota: ev.target.value })} /></Field>
        <label className="col-span-2 flex items-center gap-2 text-[13px] text-muted sm:col-span-3">
          <input type="checkbox" checked={!!f.previsto} onChange={(ev) => setF({ ...f, previsto: ev.target.checked })} />
          É uma previsão (orçamento): entra só no fluxo de caixa projetado, fora do balancete.
        </label>
      </div>
      <datalist id="lanc-forn">{forn.map((x) => <option key={x} value={x} />)}</datalist>
      <div className="mt-5 rounded-sm bg-paper/70 px-4 py-3 text-[12.5px]">
        <span className="eyebrow">Partida dobrada</span>
        <div className="num mt-1 flex flex-wrap justify-between gap-2">
          <span>D {p.debito || '—'} · {e.contas.find((c) => c.codigo === p.debito)?.nome ?? ''}</span>
          <span>C {p.credito || '—'} · {e.contas.find((c) => c.codigo === p.credito)?.nome ?? ''}</span>
          <span className="font-semibold">{brl(Number(valorTxt.replace(/\./g, '').replace(',', '.')) || 0)}</span>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
        <button className="btn btn-primary" onClick={gravar}>Lançar</button>
      </div>
    </Modal>
  );
}

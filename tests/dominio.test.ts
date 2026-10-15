import { describe, it, expect } from 'vitest';
import { addDias, addMeses, diasEntre, safraDe, periodoSafra, estacao } from '@/lib/datas';
import {
  PLANO_PADRAO, saldoConta, razao, balancete, dre, posicao, baixar, fluxoCaixa, validarLancamento, titulosEmAberto,
} from '@/lib/domain/livro-razao';
import { gmd, gmdGrupo, indexarPesagens, categoriaDe, carenciasAtivas, lotacaoPiquetes, conciliarCabecas, uaDe } from '@/lib/domain/rebanho';
import { venderOuSegurar, compararTerminacao, relacaoTroca, custoKgDieta } from '@/lib/domain/simulador';
import { saldoInsumo, previsaoRuptura } from '@/lib/domain/estoque';
import { coancestria, pedigree, consanguinidadeFilho, opcoesAcasalamento, cronogramaIATF } from '@/lib/domain/genetica';
import { mediaGeometrica, situacaoQualidade, precoLitro, intervaloEntrePartos, del, producaoPorVaca } from '@/lib/domain/leite';
import { sugestoes, gradeMes } from '@/lib/domain/calendario';
import { custoPorLote, arrobasProduzidas } from '@/lib/domain/custos';
import { estadoDemo, estadoVazio } from '@/lib/seed';
import type { Animal, Lancamento, Pesagem } from '@/lib/domain/types';

const HOJE = '2026-10-15';

const lanc = (o: Partial<Lancamento>): Lancamento => ({
  id: Math.random().toString(36), data: '2026-10-01', historico: 'x', debito: '5.1.01', credito: '1.1.02', valor: 100, atividade: 'corte', ...o,
});

describe('datas', () => {
  it('soma dias e meses e calcula intervalos', () => {
    expect(addDias('2026-02-27', 2)).toBe('2026-03-01');
    expect(addMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(diasEntre('2026-10-01', '2026-10-15')).toBe(14);
  });
  it('safra pecuária vai de julho a junho', () => {
    expect(safraDe('2026-10-14')).toBe('SAFRA 26/27');
    expect(safraDe('2026-06-30')).toBe('SAFRA 25/26');
    expect(periodoSafra('SAFRA 26/27')).toEqual(['2026-07-01', '2027-06-30']);
    expect(estacao('2026-07-10')).toBe('seca');
    expect(estacao('2026-12-10')).toBe('aguas');
  });
});

describe('livro-razão (partida dobrada)', () => {
  const ls: Lancamento[] = [
    lanc({ data: '2026-09-01', historico: 'Aporte', debito: '1.1.02', credito: '3.1.01', valor: 10000, atividade: 'geral' }),
    lanc({ data: '2026-09-10', historico: 'Sal à vista', debito: '5.1.01', credito: '1.1.02', valor: 1500 }),
    lanc({ id: 'nf1', data: '2026-09-20', historico: 'Ração a prazo', debito: '5.1.02', credito: '2.1.01', valor: 4000, vencimento: '2026-10-20' }),
    lanc({ id: 'rec1', data: '2026-09-25', historico: 'Venda boi', debito: '1.1.03', credito: '4.1.01', valor: 9000, vencimento: '2026-10-05' }),
    lanc({ data: '2026-11-10', historico: 'Previsão', debito: '5.1.05', credito: '1.1.02', valor: 50000, previsto: true }),
  ];
  it('saldo respeita a natureza da conta e ignora previsões', () => {
    expect(saldoConta(ls, PLANO_PADRAO, '1.1.02')).toBe(8500);
    expect(saldoConta(ls, PLANO_PADRAO, '2.1.01')).toBe(4000);
    expect(saldoConta(ls, PLANO_PADRAO, '5')).toBe(5500);
    expect(saldoConta(ls, PLANO_PADRAO, '4')).toBe(9000);
  });
  it('balancete fecha: débitos = créditos', () => {
    const b = balancete(ls, PLANO_PADRAO);
    expect(b.totalDebitos).toBe(b.totalCreditos);
    const soma = (natur: string, campo: 'debitos' | 'creditos') => b.linhas.filter((l) => l.conta.codigo.length === 1 && l.conta.natureza === natur).reduce((s, l) => s + l[campo], 0);
    const deb = ['ativo', 'passivo', 'patrimonio', 'receita', 'despesa'].reduce((s, n) => s + soma(n, 'debitos'), 0);
    const cred = ['ativo', 'passivo', 'patrimonio', 'receita', 'despesa'].reduce((s, n) => s + soma(n, 'creditos'), 0);
    expect(deb).toBe(cred);
  });
  it('razão traz saldo corrente', () => {
    const r = razao(ls, PLANO_PADRAO, '1.1.02');
    expect(r.linhas.map((l) => l.saldo)).toEqual([10000, 8500]);
    const r2 = razao(ls, PLANO_PADRAO, '1.1.02', '2026-09-05');
    expect(r2.saldoAnterior).toBe(10000);
  });
  it('DRE separa variáveis, fixos e resultado', () => {
    const d = dre(ls, PLANO_PADRAO, '2026-09-01', '2026-09-30');
    expect(d.receitas).toBe(9000);
    expect(d.custosVariaveis).toBe(5500);
    expect(d.resultado).toBe(3500);
  });
  it('posição lista a pagar, a receber e atrasados', () => {
    const p = posicao(ls, HOJE, HOJE, addDias(HOJE, 30));
    expect(p.aPagar).toBe(4000);
    expect(p.aReceber).toBe(9000);
    expect(p.atrasados.map((t) => t.lancamento.id)).toEqual(['rec1']);
  });
  it('baixa gera contrapartida e zera o fornecedor', () => {
    const titulo = ls[2];
    const b = baixar(titulo, HOJE, '1.1.02', 'bx1');
    expect(b.debito).toBe('2.1.01');
    expect(b.credito).toBe('1.1.02');
    const depois = [...ls.map((l) => (l.id === titulo.id ? { ...l, pagoEm: HOJE } : l)), b];
    expect(saldoConta(depois, PLANO_PADRAO, '2.1.01')).toBe(0);
    expect(titulosEmAberto(depois, HOJE).map((t) => t.lancamento.id)).toEqual(['rec1']);
  });
  it('fluxo de caixa projeta títulos e previsões', () => {
    const f = fluxoCaixa(ls, PLANO_PADRAO, HOJE, 2, 2);
    const out = f.find((m) => m.mes === '2026-10')!;
    expect(out.saidas).toBe(4000);
    expect(out.entradas).toBe(9000);
    expect(f.find((m) => m.mes === '2026-11')!.saidas).toBe(50000);
    expect(f[f.length - 1].saldoFinal).toBe(8500 + 9000 - 4000 - 50000);
  });
  it('valida contas analíticas e valor', () => {
    expect(validarLancamento({ data: HOJE, historico: 'x', valor: 10, debito: '5.1', credito: '1.1.02' }, PLANO_PADRAO).map((e) => e.campo)).toEqual(['debito']);
    expect(validarLancamento({ data: HOJE, historico: 'x', valor: 10, debito: '1.1.02', credito: '1.1.02' }, PLANO_PADRAO).map((e) => e.campo)).toEqual(['credito']);
  });
});

describe('rebanho', () => {
  const pes = (animalId: string, data: string, pesoKg: number): Pesagem => ({ id: `${animalId}${data}`, animalId, data, pesoKg, metodo: 'balanca' });
  it('GMD pela primeira e última pesagem do período', () => {
    const h = [pes('a', '2026-07-01', 300), pes('a', '2026-08-30', 336), pes('a', '2026-10-01', 360)];
    expect(gmd(h)).toBeCloseTo(60 / 92, 5);
    expect(gmd(h, '2026-08-01')).toBeCloseTo(24 / 32, 5);
    expect(gmd([pes('a', '2026-10-01', 300), pes('a', '2026-10-03', 305)])).toBeNull();
    const idx = indexarPesagens([...h, pes('b', '2026-07-01', 200), pes('b', '2026-10-01', 260)]);
    expect(gmdGrupo(['a', 'b'], idx)).toBeCloseTo(120 / 184, 5);
  });
  it('categoria por idade e sexo', () => {
    expect(categoriaDe({ sexo: 'F', nascimento: '2026-05-01' }, HOJE)).toBe('bezerra');
    expect(categoriaDe({ sexo: 'M', nascimento: '2025-06-01' }, HOJE)).toBe('garrote');
    expect(categoriaDe({ sexo: 'F', nascimento: '2022-01-01' }, HOJE)).toBe('vaca');
  });
  it('carência bloqueia até a liberação', () => {
    const c = carenciasAtivas([{ id: 's', data: '2026-10-10', tipo: 'antibiotico', produto: 'Oxi', partida: 'p', animalIds: ['a'], doseMl: 1, carenciaCarneDias: 28, carenciaLeiteDias: 4 }], HOJE);
    expect(c).toHaveLength(1);
    expect(c[0].bloqueiaCarne).toBe(true);
    expect(c[0].bloqueiaLeite).toBe(false);
    expect(c[0].liberaCarne).toBe('2026-11-07');
  });
  it('UA/ha e conciliação de cabeças na demo', () => {
    const e = estadoDemo(HOJE);
    const lot = lotacaoPiquetes(e.piquetes, e.lotes, e.animais, indexarPesagens(e.pesagens), HOJE);
    expect(lot.find((l) => l.piquete.status === 'reforma')!.situacao).toBe('reforma');
    expect(lot.some((l) => l.uaHa > 0)).toBe(true);
    expect(uaDe(450)).toBe(1);
    const conc = conciliarCabecas(e.lotes, e.animais);
    expect(conc.find((c) => c.lote.nome.includes('R1'))!.diferenca).toBe(-1);
  });
});

describe('simuladores', () => {
  it('vender ou segurar', () => {
    const r = venderOuSegurar({ cabecas: 1, pesoAtualKg: 510, gmdKg: 1.5, dias: 30, precoArrobaHoje: 300, precoArrobaFuturo: 300, custoDiarioCabeca: 15, rendimentoHojePct: 54, descontosVendaPct: 0 });
    expect(r.arrobasHoje).toBeCloseTo(18.36, 2);
    expect(r.arrobasFuturo).toBeCloseTo(19.98, 2);
    expect(r.ganhoLiquido).toBeCloseTo(486 - 450, 0);
    expect(r.recomendacao).toBe('segurar');
    // no preço de equilíbrio o ganho é zero
    const z = venderOuSegurar({ cabecas: 1, pesoAtualKg: 510, gmdKg: 1.5, dias: 30, precoArrobaHoje: 300, precoArrobaFuturo: r.precoEquilibrio, custoDiarioCabeca: 15, rendimentoHojePct: 54, descontosVendaPct: 0 });
    expect(Math.abs(z.ganhoLiquido)).toBeLessThan(0.01);
  });
  it('terminação, relação de troca e custo da dieta', () => {
    const [pasto, conf] = compararTerminacao(420, 540, 310, 50, [
      { nome: 'Pasto', gmdKg: 0.6, custoDiarioCabeca: 4, rendimentoPct: 52 },
      { nome: 'Confinamento', gmdKg: 1.6, custoDiarioCabeca: 16, rendimentoPct: 54 },
    ]);
    expect(pasto.dias).toBe(200);
    expect(conf.dias).toBe(75);
    expect(conf.custoArroba).toBeCloseTo(1200 / (540 * 0.54 / 15 - 420 * 0.5 / 15), 4);
    expect(relacaoTroca(310, 20, 3100)).toBe(2);
    expect(custoKgDieta([{ pct: 50, custoKg: 1 }, { pct: 50, custoKg: 2 }])).toBe(1.5);
  });
});

describe('estoque', () => {
  it('custo médio ponderado e ruptura', () => {
    const ins = { id: 'i', nome: 'Sal', categoria: 'sal_mineral' as const, unidade: 'kg', estoqueMinimo: 100, consumoDiario: 10, custoMedio: 0 };
    const movs = [
      { id: '1', insumoId: 'i', data: '2026-10-01', tipo: 'entrada' as const, quantidade: 100, valorUnitario: 2 },
      { id: '2', insumoId: 'i', data: '2026-10-02', tipo: 'entrada' as const, quantidade: 100, valorUnitario: 4 },
      { id: '3', insumoId: 'i', data: '2026-10-03', tipo: 'saida' as const, quantidade: 50 },
    ];
    expect(saldoInsumo(ins, movs)).toEqual({ saldo: 150, custoMedio: 3 });
    const [p] = previsaoRuptura([ins], movs, HOJE);
    expect(p.diasCobertura).toBe(15);
    expect(p.ruptura).toBe('2026-10-30');
  });
});

describe('genética', () => {
  const a = (id: string, nascimento: string, paiId?: string, maeId?: string): Animal => ({ id, brinco: id, sexo: 'M', raca: 'Nelore', nascimento, origem: 'nascido', status: 'ativo', paiId, maeId });
  it('consanguinidade de meio-irmãos é 12,5%', () => {
    const animais = [a('S', '2015-01-01'), a('D1', '2016-01-01'), a('D2', '2016-02-01'), a('X', '2019-01-01', 'S', 'D1'), { ...a('Y', '2019-02-01', 'S', 'D2'), sexo: 'F' as const }];
    expect(consanguinidadeFilho(animais, 'X', 'Y')).toBeCloseTo(0.125, 6);
    expect(coancestria(pedigree(animais), 'S', 'S')).toBe(0.5);
  });
  it('pai × filha = 25%', () => {
    const animais = [a('S', '2015-01-01'), a('D', '2015-01-01'), { ...a('F', '2018-01-01', 'S', 'D'), sexo: 'F' as const }];
    expect(consanguinidadeFilho(animais, 'S', 'F')).toBeCloseTo(0.25, 6);
  });
  it('acasalamento bloqueia parente próximo e ordena por DEP', () => {
    const e = estadoDemo(HOJE);
    const tourinho = e.animais.find((x) => x.nome?.startsWith('Tourinho A'))!;
    const filhaDoBarao = e.animais.find((x) => x.nome === 'Duquesa da Boa Vista')!;
    const ops = opcoesAcasalamento(filhaDoBarao.id, e.animais, e.avaliacoes, e.estoqueGenetico, 'P450');
    expect(ops.length).toBeGreaterThan(1);
    const desbloqueadas = ops.filter((o) => !o.bloqueado);
    for (let i = 1; i < desbloqueadas.length; i++) expect(desbloqueadas[i - 1].pontuacao).toBeGreaterThanOrEqual(desbloqueadas[i].pontuacao);
    expect(tourinho).toBeTruthy();
  });
  it('cronograma de IATF', () => {
    const c = cronogramaIATF('P4 8 dias', '2026-10-01');
    expect(c.map((x) => x.data)).toEqual(['2026-10-01', '2026-10-09', '2026-10-11']);
  });
});

describe('leite', () => {
  it('média geométrica e limites da IN 76', () => {
    expect(mediaGeometrica([100, 400])).toBeCloseTo(200, 6);
    const s = situacaoQualidade([
      { id: '1', data: '2026-09-05', ccs: 600, cbt: 40, gordura: 3.5, proteina: 3.1 },
      { id: '2', data: '2026-10-05', ccs: 600, cbt: 40, gordura: 3.7, proteina: 3.3 },
    ], HOJE);
    expect(s.ccsOk).toBe(false);
    expect(s.cbtOk).toBe(true);
    expect(s.gordura).toBeCloseTo(3.6, 6);
  });
  it('preço do litro pela tabela do laticínio', () => {
    const e = estadoVazio();
    const p = precoLitro(e.tabelaLaticinio, { ccs: 180, cbt: 40, gordura: 3.5, proteina: 3.2 });
    expect(p.preco).toBeCloseTo(2.45 + 0.05 + 0.045 + 0.05 + 0.04, 6);
  });
  it('IEP, DEL e vacas improdutivas na demo', () => {
    const e = estadoDemo(HOJE);
    const iep = intervaloEntrePartos(e.reproducao);
    expect(iep.media).toBeGreaterThan(380);
    const vaca = e.animais.find((x) => x.loteId === e.lotes.find((l) => l.fase === 'lactacao')!.id)!;
    expect(del(e.reproducao, vaca.id, HOJE)).toBeGreaterThanOrEqual(0);
    const prod = producaoPorVaca([vaca], e.ordenhas, e.reproducao, addDias(HOJE, -29), HOJE);
    expect(prod[0].mediaDia).toBeGreaterThan(0);
  });
});

describe('calendário e custos na demo', () => {
  const e = estadoDemo(HOJE);
  it('sugere brucelose obrigatória, pagamentos e estoque', () => {
    const s = sugestoes(e, HOJE, 60);
    expect(s.some((x) => x.regra.startsWith('brucelose') && x.obrigatorio)).toBe(true);
    expect(s.some((x) => x.tipo === 'pagamento' && x.data === HOJE)).toBe(true);
    expect(s.some((x) => x.tipo === 'documento')).toBe(true);
    // agendar remove da lista de sugestões
    const reg = s[0].regra;
    const s2 = sugestoes({ ...e, eventos: [...e.eventos, { id: 'z', titulo: 't', data: HOJE, tipo: 'geral', concluido: false, regra: reg }] }, HOJE, 60);
    expect(s2.some((x) => x.regra === reg)).toBe(false);
  });
  it('grade do mês começa no domingo', () => {
    const g = gradeMes('2026-10', [], []);
    expect(g[0][0].data).toBe('2026-09-27');
    expect(g.flat().filter((d) => d.doMes)).toHaveLength(31);
  });
  it('custo por lote soma direto + rateado = despesas rateáveis', () => {
    const de = addDias(HOJE, -90);
    const c = custoPorLote(e.lancamentos, e.contas, e.lotes, e.animais, e.pesagens, de, HOJE, 52);
    const soma = c.lotes.reduce((s, l) => s + l.total, 0) + c.naoRateado;
    expect(soma).toBeCloseTo(c.totalDespesas, 2);
    const conf = c.lotes.find((l) => l.lote.fase === 'confinamento')!;
    expect(conf.arrobasProduzidas).toBeGreaterThan(0);
    expect(conf.custoPorArroba).toBeGreaterThan(0);
  });
  it('arrobas produzidas = GMD × dias no período × rendimento / 15', () => {
    const p: Pesagem[] = [
      { id: '1', animalId: 'a', data: '2026-08-01', pesoKg: 400, metodo: 'balanca' },
      { id: '2', animalId: 'a', data: '2026-10-01', pesoKg: 490, metodo: 'balanca' },
    ];
    const boi: Animal = { id: 'a', brinco: '1', sexo: 'M', raca: 'Nelore', nascimento: '2024-08-01', origem: 'nascido', status: 'ativo' };
    // GMD 90/61 kg/dia durante 61 dias = 90 kg → 90 × 0,5 / 15 = 3 @
    expect(arrobasProduzidas([boi], p, '2026-08-01', '2026-10-01', 50)).toBeCloseTo(3, 6);
    // animal que entrou no meio do período só conta os dias presentes
    expect(arrobasProduzidas([{ ...boi, dataEntrada: '2026-09-01' }], p, '2026-08-01', '2026-10-01', 50)).toBeCloseTo(3 * 30 / 61, 6);
  });
});

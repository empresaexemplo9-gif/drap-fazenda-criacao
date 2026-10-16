import { describe, it, expect } from 'vitest';
import { estadoDemo, estadoVazio } from '@/lib/seed';
import {
  ABA_ANIMAIS, ABA_LOTES, COLUNA_ID, canon, codigo, fundirAba, lerData, lerNumero, mesmaGrade, sincronizarPlanilha,
  type Contexto, type Grade,
} from '@/lib/domain/planilha';
import type { Estado } from '@/lib/domain/types';

const HOJE = '2026-10-15';
const gerador = () => { let n = 0; return (p: string) => `${p}-t${++n}`; };
const TODAS = ['piquetes', 'lotes', 'pessoas', 'insumos', 'animais', 'pesagens', 'lancamentos', 'documentos'];

function base(): Estado {
  const e = estadoVazio();
  e.lotes = [{ id: 'l1', nome: 'Recria 1', atividade: 'corte', fase: 'recria' }];
  e.animais = [
    { id: 'a1', brinco: '0123', rfid: '982 000 111', sexo: 'M', raca: 'Nelore', nascimento: '2025-01-10', origem: 'nascido', status: 'ativo', loteId: 'l1' },
    { id: 'a2', brinco: '124', sexo: 'F', raca: 'Nelore', nascimento: '2025-02-01', origem: 'comprado', status: 'ativo', loteId: 'l1' },
  ];
  return e;
}
const col = (g: Grade, titulo: string) => g[0].findIndex((h) => h === titulo);
const linhaDe = (g: Grade, id: string) => g.find((l) => l[0] === id)!;

describe('leitura de células', () => {
  it('números brasileiros e internacionais', () => {
    expect(lerNumero('1.234,56')).toBe(1234.56);
    expect(lerNumero('R$ 1.500')).toBe(1500);
    expect(lerNumero('1234.5')).toBe(1234.5);
    expect(lerNumero('350 kg')).toBe(350);
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('abc')).toBeNull();
  });
  it('datas dd/mm/aaaa, ISO e série do Excel', () => {
    expect(lerData('15/10/2026')).toBe('2026-10-15');
    expect(lerData('5/3/26')).toBe('2026-03-05');
    expect(lerData('2026-10-15')).toBe('2026-10-15');
    expect(lerData(46310)).toBe('2026-10-15');
    expect(lerData('31/02/2026')).toBeNull();
  });
  it('códigos ignoram espaços, pontos e zeros à esquerda', () => {
    expect(codigo('0123')).toBe('123');
    expect(codigo('982 000.111')).toBe('982000111');
    expect(codigo('br-12a')).toBe('BR12A');
  });
  it('forma canônica não se engana com formato', () => {
    expect(canon('15/10/2026')).toBe(canon('2026-10-15'));
    expect(canon('1.500,00')).toBe(canon(1500));
    expect(canon(' Lactação ')).toBe(canon('lactacao'));
  });
});

describe('primeira sincronização', () => {
  it('planilha vazia recebe tudo do DRAP com a coluna ID DRAP', () => {
    const e = base();
    const r = sincronizarPlanilha(e, {}, {}, ['lotes', 'animais'], 'planilha', HOJE, gerador());
    const g = r.abas.animais.grade;
    expect(g[0][0]).toBe(COLUNA_ID);
    expect(g).toHaveLength(3);
    expect(r.resumo.criadosPlanilha).toBe(3);
    expect(r.abas.animais.mudouPlanilha).toBe(true);
    expect(linhaDe(g, 'a1')[col(g, 'Lote')]).toBe('Recria 1');
    expect(linhaDe(r.abas.lotes.grade, 'l1')[col(r.abas.lotes.grade, 'Cabeças (calculado)')]).toBe(2);
    // brinco é coluna de texto (não perde o zero à esquerda)
    expect(r.abas.animais.colunasTexto).toContain(col(g, 'Brinco'));
  });

  it('planilha do produtor sem ID: reconhece o animal pelo brinco ou RFID', () => {
    const e = base();
    const planilha = {
      animais: [
        ['brinco', 'Chip', 'Sexo', 'Raca', 'Nascimento', 'Lote', 'Peso de desmama (minha coluna)'],
        ['123', '', 'Macho', 'Nelore', '10/01/2025', 'Recria 1', '180'],
        ['999', '982000111', 'M', 'Nelore', '10/01/2025', 'recria 1', '190'],
        ['500', '', 'Fêmea', 'Angus', '01/03/2025', 'Recria 1', '170'],
      ],
    };
    const r = sincronizarPlanilha(e, planilha, {}, ['animais'], 'planilha', HOJE, gerador());
    const a = r.estado.animais;
    // "123" casa com o brinco 0123 (a1); a linha com o RFID de a1 já não casa com a1 (usado) e vira animal novo... mas com RFID duplicado = erro
    expect(r.resumo.erros.map((x) => x.msg).join()).toMatch(/RFID/);
    expect(a.find((x) => x.id === 'a1')!.brinco).toBe('123');
    expect(a.find((x) => x.brinco === '500')?.raca).toBe('Angus');
    expect(r.resumo.criadosDrap).toBe(1);
    // a2 não estava na planilha: vai para ela
    expect(r.resumo.criadosPlanilha).toBe(1);
    // coluna extra do produtor é preservada
    const g = r.abas.animais.grade;
    expect(g[0]).toContain('Peso de desmama (minha coluna)');
    expect(linhaDe(g, 'a1')[col(g, 'Peso de desmama (minha coluna)')]).toBe('180');
    // a linha com erro continua na planilha como o produtor digitou
    expect(g.some((l) => l[0] === '' && l.includes('999'))).toBe(true);
  });

  it('política "drap" mantém o DRAP na primeira vez', () => {
    const e = base();
    const planilha = { animais: [['Brinco', 'Raça'], ['124', 'Gir']] };
    const r = sincronizarPlanilha(e, planilha, {}, ['animais'], 'drap', HOJE, gerador());
    expect(r.estado.animais.find((x) => x.id === 'a2')!.raca).toBe('Nelore');
    expect(linhaDe(r.abas.animais.grade, 'a2')[col(r.abas.animais.grade, 'Raça')]).toBe('Nelore');
  });
});

describe('sincronizações seguintes', () => {
  function primeira(e = base()) {
    const r = sincronizarPlanilha(e, {}, {}, TODAS, 'planilha', HOJE, gerador());
    const planilha: Record<string, Grade> = {};
    for (const [id, res] of Object.entries(r.abas)) planilha[{ lotes: 'Lotes', animais: 'Animais', piquetes: 'Piquetes', pessoas: 'Equipe', insumos: 'Insumos', pesagens: 'Pesagens', lancamentos: 'Lançamentos', documentos: 'Documentos' }[id]!] = structuredClone(res.grade);
    return { r, planilha };
  }

  it('sem mudanças dos dois lados: nada a fazer (idempotente)', () => {
    const { r, planilha } = primeira();
    const r2 = sincronizarPlanilha(r.estado, planilha, r.base, TODAS, 'planilha', HOJE, gerador());
    for (const res of Object.values(r2.abas)) expect(res.mudouPlanilha).toBe(false);
    expect(r2.resumo).toMatchObject({ criadosDrap: 0, atualizadosDrap: 0, criadosPlanilha: 0, atualizadosPlanilha: 0, conflitos: 0, erros: [] });
  });

  it('idempotente também com a demo inteira', () => {
    const { r, planilha } = primeira(estadoDemo(HOJE));
    const r2 = sincronizarPlanilha(r.estado, planilha, r.base, TODAS, 'planilha', HOJE, gerador());
    expect(r2.resumo.erros).toEqual([]);
    expect(Object.values(r2.abas).filter((x) => x.mudouPlanilha).map((x) => x.aba)).toEqual([]);
    expect(r2.resumo.atualizadosDrap + r2.resumo.atualizadosPlanilha).toBe(0);
  });

  it('mudou na planilha → atualiza o DRAP', () => {
    const { r, planilha } = primeira();
    const g = planilha.Animais;
    linhaDe(g, 'a2')[col(g, 'Raça')] = 'Girolando';
    const r2 = sincronizarPlanilha(r.estado, planilha, r.base, TODAS, 'drap', HOJE, gerador());
    expect(r2.estado.animais.find((x) => x.id === 'a2')!.raca).toBe('Girolando');
    expect(r2.resumo.atualizadosDrap).toBe(1);
    expect(r2.resumo.conflitos).toBe(0);
  });

  it('mudou no DRAP → atualiza a planilha', () => {
    const { r, planilha } = primeira();
    const e = structuredClone(r.estado);
    e.animais.find((x) => x.id === 'a1')!.nome = 'Trovão';
    const r2 = sincronizarPlanilha(e, planilha, r.base, TODAS, 'planilha', HOJE, gerador());
    const g = r2.abas.animais.grade;
    expect(linhaDe(g, 'a1')[col(g, 'Nome')]).toBe('Trovão');
    expect(r2.abas.animais.mudouPlanilha).toBe(true);
    expect(r2.resumo.atualizadosPlanilha).toBe(1);
    expect(r2.estado.animais.find((x) => x.id === 'a1')!.nome).toBe('Trovão');
  });

  it('mudou dos dois lados → conflito resolvido pela política', () => {
    const { r, planilha } = primeira();
    const e = structuredClone(r.estado);
    e.animais.find((x) => x.id === 'a1')!.raca = 'Angus';
    const g = planilha.Animais;
    linhaDe(g, 'a1')[col(g, 'Raça')] = 'Brahman';
    const pPlan = sincronizarPlanilha(e, structuredClone(planilha), r.base, TODAS, 'planilha', HOJE, gerador());
    expect(pPlan.resumo.conflitos).toBe(1);
    expect(pPlan.estado.animais.find((x) => x.id === 'a1')!.raca).toBe('Brahman');
    const pDrap = sincronizarPlanilha(e, structuredClone(planilha), r.base, TODAS, 'drap', HOJE, gerador());
    expect(pDrap.estado.animais.find((x) => x.id === 'a1')!.raca).toBe('Angus');
    expect(linhaDe(pDrap.abas.animais.grade, 'a1')[col(g, 'Raça')]).toBe('Angus');
  });

  it('linha nova na planilha com lote novo na mesma sincronização', () => {
    const { r, planilha } = primeira();
    planilha.Lotes.push(['', 'Engorda 2', 'Corte', 'Engorda', '', '']);
    planilha.Animais.push(['', '777', '', '', '', 'Macho', 'Nelore', '01/01/2025', 'Engorda 2']);
    const r2 = sincronizarPlanilha(r.estado, planilha, r.base, TODAS, 'planilha', HOJE, gerador());
    expect(r2.resumo.erros).toEqual([]);
    const lote = r2.estado.lotes.find((l) => l.nome === 'Engorda 2')!;
    const a = r2.estado.animais.find((x) => x.brinco === '777')!;
    expect(a.loteId).toBe(lote.id);
    // o ID novo volta para a planilha e as cabeças do lote novo já aparecem
    expect(r2.abas.animais.grade.some((l) => l[0] === a.id)).toBe(true);
    const gl = r2.abas.lotes.grade;
    expect(linhaDe(gl, lote.id)[col(gl, 'Cabeças (calculado)')]).toBe(1);
    // e a terceira vez não muda nada
    const pl3: Record<string, Grade> = { Lotes: r2.abas.lotes.grade, Animais: r2.abas.animais.grade };
    const r3 = sincronizarPlanilha(r2.estado, pl3, r2.base, ['lotes', 'animais'], 'planilha', HOJE, gerador());
    expect(r3.abas.lotes.mudouPlanilha || r3.abas.animais.mudouPlanilha).toBe(false);
  });

  it('excluído no DRAP sai da planilha; apagado na planilha volta', () => {
    const { r, planilha } = primeira();
    const e = structuredClone(r.estado);
    e.animais = e.animais.filter((x) => x.id !== 'a2');
    planilha.Animais = planilha.Animais.filter((l) => l[0] !== 'a1');
    const r2 = sincronizarPlanilha(e, planilha, r.base, ['animais'], 'planilha', HOJE, gerador());
    expect(r2.resumo.removidosPlanilha).toBe(1);
    expect(r2.resumo.recolocados).toBe(1);
    expect(r2.estado.animais.map((x) => x.id)).toEqual(['a1']);
    expect(r2.abas.animais.grade.map((l) => l[0])).toEqual([COLUNA_ID, 'a1']);
  });

  it('erro na planilha não apaga o que foi digitado nem altera o DRAP', () => {
    const { r, planilha } = primeira();
    const g = planilha.Animais;
    linhaDe(g, 'a2')[col(g, 'Nascimento')] = '32/13/2025';
    const r2 = sincronizarPlanilha(r.estado, planilha, r.base, ['animais'], 'planilha', HOJE, gerador());
    expect(r2.resumo.erros).toHaveLength(1);
    expect(r2.resumo.erros[0]).toMatchObject({ aba: 'Animais', linha: 3 });
    expect(r2.estado.animais.find((x) => x.id === 'a2')!.nascimento).toBe('2025-02-01');
    expect(linhaDe(r2.abas.animais.grade, 'a2')[col(g, 'Nascimento')]).toBe('32/13/2025');
  });

  it('duas linhas novas com o mesmo brinco: a segunda é recusada', () => {
    const e = base();
    const planilha = { Animais: [['Brinco', 'Sexo'], ['800', 'M'], ['800', 'F']] };
    const r = sincronizarPlanilha(e, planilha, {}, ['animais'], 'planilha', HOJE, gerador());
    expect(r.estado.animais.filter((x) => x.brinco === '800')).toHaveLength(1);
    expect(r.resumo.erros).toHaveLength(1);
  });

  it('pesagem pelo brinco + data e lançamento validado pelo plano de contas', () => {
    const e = base();
    const planilha = {
      Pesagens: [['Brinco', 'Data', 'Peso (kg)'], ['0123', '01/10/2026', '312,5']],
      'Lançamentos': [
        ['Data', 'Histórico', 'Débito', 'Crédito', 'Valor (R$)'],
        ['02/10/2026', 'Sal mineral', '5.1.01 Sal', '1.1.01', '1.250,00'],
        ['02/10/2026', 'Conta inventada', '9.9.99', '1.1.01', '10'],
      ],
    };
    const r = sincronizarPlanilha(e, planilha, {}, ['animais', 'pesagens', 'lancamentos'], 'planilha', HOJE, gerador());
    expect(r.estado.pesagens).toMatchObject([{ animalId: 'a1', data: '2026-10-01', pesoKg: 312.5 }]);
    expect(r.estado.lancamentos.find((l) => l.historico === 'Sal mineral')).toMatchObject({ debito: '5.1.01', valor: 1250 });
    expect(r.resumo.erros.map((x) => x.aba)).toEqual(['Lançamentos']);
  });
});

describe('fundirAba isolada', () => {
  it('cabeçalho por apelido e sem acento', () => {
    const e = base();
    const c: Contexto = { e, hoje: HOJE, novoId: gerador() };
    const r = fundirAba(ABA_LOTES, e.lotes, [['LOTE', 'atividade', 'fase'], ['Recria 1', 'Leite', 'Lactação']], {}, 'planilha', c);
    expect(r.registros[0]).toMatchObject({ id: 'l1', atividade: 'leite', fase: 'lactacao' });
  });
  it('mesmaGrade ignora linhas vazias e formato', () => {
    expect(mesmaGrade([['a', '1.500'], ['', '']], [['A', 1500]])).toBe(true);
    expect(mesmaGrade([['a']], [['b']])).toBe(false);
  });
  it('não muda o array do DRAP original', () => {
    const e = base();
    const antes = structuredClone(e.animais);
    fundirAba(ABA_ANIMAIS, e.animais, [['ID DRAP', 'Raça'], ['a1', 'Gir']], {}, 'planilha', { e, hoje: HOJE, novoId: gerador() });
    expect(e.animais).toEqual(antes);
  });
});

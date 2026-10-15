import { describe, it, expect } from 'vitest';
import { estadoDemo } from '@/lib/seed';
import { PERFIS, modulosDoPerfil, atividadesAtivas, podeDesativar, perfilDe, contaVisivel } from '@/lib/domain/modulos';
import { balancete } from '@/lib/domain/livro-razao';
import { custoPorLote } from '@/lib/domain/custos';
import { sugestoes } from '@/lib/domain/calendario';
import { addDias } from '@/lib/datas';

const HOJE = '2026-10-15';

describe('módulos e perfis', () => {
  it('sete combinações, todas com ao menos uma atividade', () => {
    expect(PERFIS).toHaveLength(7);
    for (const p of PERFIS) {
      const m = modulosDoPerfil(p);
      expect(atividadesAtivas(m)).toEqual(p.modulos);
      expect(perfilDe(m)?.id).toBe(p.id);
    }
  });
  it('não deixa desligar a última atividade', () => {
    const soLeite = modulosDoPerfil(PERFIS.find((p) => p.id === 'leite')!);
    expect(podeDesativar(soLeite, 'leite')).toBe(false);
    expect(podeDesativar(soLeite, 'core')).toBe(false);
    const dois = modulosDoPerfil(PERFIS.find((p) => p.id === 'corte+leite')!);
    expect(podeDesativar(dois, 'leite')).toBe(true);
  });
  it('contas de receita seguem o perfil', () => {
    const soLeite = modulosDoPerfil(PERFIS.find((p) => p.id === 'leite')!);
    expect(contaVisivel('4.1.03', soLeite)).toBe(true);
    expect(contaVisivel('4.1.01', soLeite)).toBe(false);
    expect(contaVisivel('5.2.01', soLeite)).toBe(true);
  });
});

describe.each(PERFIS)('demo do perfil $nome', (perfil) => {
  const m = modulosDoPerfil(perfil);
  const e = estadoDemo(HOJE, m);
  const at = new Set<string>(perfil.modulos);

  it('só tem lotes e lançamentos das atividades do perfil', () => {
    expect(e.modulos).toEqual(m);
    expect(e.lotes.length).toBeGreaterThan(0);
    expect(e.lotes.every((l) => at.has(l.atividade))).toBe(true);
    expect(e.lancamentos.every((l) => l.atividade === 'geral' || at.has(l.atividade))).toBe(true);
    expect(e.lancamentos.some((l) => l.credito === '4.1.03')).toBe(at.has('leite'));
    expect(e.lancamentos.some((l) => l.credito === '4.1.01' && !l.previsto)).toBe(at.has('corte'));
  });

  it('histórico só aponta para animais que existem', () => {
    const ids = new Set(e.animais.map((a) => a.id));
    expect(e.pesagens.every((p) => ids.has(p.animalId))).toBe(true);
    expect(e.sanidade.every((s) => s.animalIds.every((id) => ids.has(id)))).toBe(true);
    expect(e.ordenhas.every((o) => ids.has(o.animalId))).toBe(true);
    expect(e.reproducao.every((r) => ids.has(r.animalId))).toBe(true);
    expect(e.avaliacoes.every((v) => ids.has(v.animalId))).toBe(true);
    expect(e.vendas.every((v) => v.animalIds.every((id) => ids.has(id)))).toBe(true);
    const loteIds = new Set(e.lotes.map((l) => l.id));
    expect(e.animais.every((a) => !a.loteId || loteIds.has(a.loteId))).toBe(true);
  });

  it('cada módulo traz os dados dele e só eles', () => {
    expect(e.ordenhas.length > 0).toBe(at.has('leite'));
    expect(e.vendas.length > 0).toBe(at.has('corte'));
    expect(e.dietas.length > 0).toBe(at.has('corte'));
    expect(e.avaliacoes.length > 0).toBe(at.has('genetica'));
    expect(e.cotacoes.some((c) => c.indicador === 'leite')).toBe(at.has('leite'));
  });

  it('livro-razão continua fechando e o custo é rateado', () => {
    const b = balancete(e.lancamentos, e.contas);
    expect(Math.abs(b.totalDebitos - b.totalCreditos)).toBeLessThan(0.005);
    const c = custoPorLote(e.lancamentos, e.contas, e.lotes, e.animais, e.pesagens, addDias(HOJE, -89), HOJE, 52);
    const soma = c.lotes.reduce((s, l) => s + l.total, 0) + c.naoRateado;
    expect(soma).toBeCloseTo(c.totalDespesas, 2);
    expect(c.naoRateado).toBe(0);
  });

  it('calendário funciona com o recorte', () => {
    const s = sugestoes(e, HOJE, 90);
    expect(Array.isArray(s)).toBe(true);
    for (const x of s) for (const id of x.animalIds ?? []) expect(e.animais.some((a) => a.id === id)).toBe(true);
  });
});

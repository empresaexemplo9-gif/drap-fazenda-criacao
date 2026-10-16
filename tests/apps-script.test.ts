import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { codigoAppsScript } from '@/lib/apps-script';
import { estadoVazio } from '@/lib/seed';
import { sincronizarPlanilha, type Grade } from '@/lib/domain/planilha';

/** Planilha falsa, só com o que o script usa. Valores guardados como texto exibido (pt_BR). */
function planilhaFalsa(abas: Record<string, string[][]>) {
  const formatos: Record<string, Record<string, string>> = {};
  const formulas: Record<string, Record<string, string>> = {};
  let locale = 'en_US';
  const exibir = (v: unknown) => (typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? ''));
  const sheet = (nome: string) => {
    const dados = () => abas[nome];
    const lastRow = () => dados().length;
    const lastCol = () => Math.max(0, ...dados().map((l) => l.length));
    const range = (r: number, c: number, nr: number, nc: number) => ({
      getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => dados()[r - 1 + i]?.[c - 1 + j] ?? '')),
      getFormulas: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => formulas[nome]?.[`${r + i},${c + j}`] ?? '')),
      clearContent: () => { abas[nome] = []; formulas[nome] = {}; },
      setNumberFormat: (f: string) => { for (let i = 0; i < nr; i++) (formatos[nome] ??= {})[`${r + i},${c}`] = f; return range(r, c, nr, nc); },
      setValues: (v: unknown[][]) => {
        v.forEach((l, i) => l.forEach((x, j) => {
          const row = (abas[nome][r - 1 + i] ??= []);
          if (typeof x === 'string' && x.startsWith('=')) { (formulas[nome] ??= {})[`${r + i},${c + j}`] = x; row[c - 1 + j] = '42'; } else row[c - 1 + j] = exibir(x);
        }));
        return range(r, c, nr, nc);
      },
      setFontWeight: () => range(r, c, nr, nc),
      setFontColor: () => range(r, c, nr, nc),
    });
    return { getName: () => nome, getLastRow: lastRow, getLastColumn: lastCol, getRange: range, setFrozenRows: () => undefined };
  };
  const ss = {
    getName: () => 'Rebanho 2026', getUrl: () => 'https://docs.google.com/spreadsheets/d/x',
    getSheets: () => Object.keys(abas).map(sheet),
    insertSheet: (n: string) => { abas[n] = []; return sheet(n); },
    getSpreadsheetLocale: () => locale, setSpreadsheetLocale: (l: string) => { locale = l; },
  };
  const globais = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => undefined },
    LockService: { getDocumentLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t: string) => ({ setMimeType: () => t }) },
    Utilities: {
      DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_a: string, s: string) => createHash('md5').update(s, 'utf8').digest(),
      base64Encode: (b: Buffer) => b.toString('base64'),
    },
  };
  return { abas, formatos, formulas, globais, locale: () => locale };
}

function carregar(token: string, p: ReturnType<typeof planilhaFalsa>) {
  const fn = new Function(...Object.keys(p.globais), `${codigoAppsScript(token)}\nreturn { doPost, doGet };`);
  const { doPost } = fn(...Object.values(p.globais)) as { doPost: (e: unknown) => string };
  return (corpo: unknown) => JSON.parse(doPost({ postData: { contents: JSON.stringify(corpo) } }));
}

describe('script da planilha (Apps Script)', () => {
  it('recusa senha errada e responde ao teste', () => {
    const p = planilhaFalsa({});
    const post = carregar('segredo', p);
    expect(post({ token: 'outro', acao: 'testar' })).toEqual({ ok: false, erro: 'senha' });
    expect(post({ token: 'segredo', acao: 'testar' })).toMatchObject({ ok: true, nome: 'Rebanho 2026' });
  });

  it('lê aba pelo nome sem acento e devolve null para aba que não existe', () => {
    const p = planilhaFalsa({ Lancamentos: [['Data'], ['01/10/2026']] });
    const post = carregar('t', p);
    const r = post({ token: 't', acao: 'ler', abas: ['Lançamentos', 'Animais'] });
    expect(r.abas['Lançamentos']).toEqual([['Data'], ['01/10/2026']]);
    expect(r.abas.Animais).toBeNull();
    expect(typeof r.digest).toBe('string');
  });

  it('escreve, cria aba, marca colunas de texto e recusa se a planilha mudou no meio', () => {
    const p = planilhaFalsa({ Animais: [['Brinco'], ['0123']] });
    const post = carregar('t', p);
    const lido = post({ token: 't', acao: 'ler', abas: ['Animais', 'Lotes'] });
    p.abas.Animais.push(['555']); // alguém digitou depois da leitura
    expect(post({ token: 't', acao: 'escrever', abas: { Animais: { valores: [['x']], colunasTexto: [] } }, esperado: lido.digest, abasLidas: ['Animais', 'Lotes'] }))
      .toEqual({ ok: false, erro: 'mudou' });
    const lido2 = post({ token: 't', acao: 'ler', abas: ['Animais', 'Lotes'] });
    const w = post({ token: 't', acao: 'escrever', esperado: lido2.digest, abasLidas: ['Animais', 'Lotes'], abas: {
      Animais: { valores: [['ID DRAP', 'Brinco'], ['a1', '0123'], ['a2', '555']], colunasTexto: [0, 1] },
      Lotes: { valores: [['ID DRAP', 'Nome', 'Cabeças (calculado)'], ['l1', 'Recria', 2]], colunasTexto: [0] },
    } });
    expect(w.ok).toBe(true);
    expect(p.abas.Animais).toEqual([['ID DRAP', 'Brinco'], ['a1', '0123'], ['a2', '555']]);
    expect(p.abas.Lotes[1]).toEqual(['l1', 'Recria', '2']);
    expect(p.formatos.Animais['1,2']).toBe('@');
    expect(p.locale()).toBe('pt_BR');
    // o digest devolvido é o da planilha depois da escrita
    expect(post({ token: 't', acao: 'digest', abas: ['Animais', 'Lotes'] }).digest).toBe(w.digest);
  });

  it('mantém a fórmula do produtor quando o resultado não mudou', () => {
    const p = planilhaFalsa({ Lotes: [['ID DRAP', 'Nome', 'Minha conta'], ['l1', 'Recria', '42']] });
    p.formulas.Lotes = { '2,3': '=6*7' };
    const post = carregar('t', p);
    post({ token: 't', acao: 'escrever', abas: { Lotes: { valores: [['ID DRAP', 'Nome', 'Minha conta'], ['l1', 'Recria 1', '42']], colunasTexto: [] } } });
    expect(p.formulas.Lotes['2,3']).toBe('=6*7');
    expect(p.abas.Lotes[1][1]).toBe('Recria 1');
  });

  it('ida e volta completa: DRAP → script → planilha → DRAP sem mudanças', () => {
    const e = estadoVazio();
    e.lotes = [{ id: 'l1', nome: 'Recria 1', atividade: 'corte', fase: 'recria' }];
    e.animais = [{ id: 'a1', brinco: '0123', sexo: 'M', raca: 'Nelore', nascimento: '2025-01-10', origem: 'nascido', status: 'ativo', loteId: 'l1', valorCompra: 2350.5 }];
    const p = planilhaFalsa({});
    const post = carregar('t', p);
    let n = 0;
    const id = (x: string) => `${x}${++n}`;
    const nomes = ['Lotes', 'Animais'];
    const lido = post({ token: 't', acao: 'ler', abas: nomes });
    const r1 = sincronizarPlanilha(e, lido.abas, {}, ['lotes', 'animais'], 'planilha', '2026-10-15', id);
    post({ token: 't', acao: 'escrever', esperado: lido.digest, abasLidas: nomes, abas: Object.fromEntries(Object.values(r1.abas).map((a) => [a.aba === 'lotes' ? 'Lotes' : 'Animais', { valores: a.grade, colunasTexto: a.colunasTexto }])) });
    // o produtor edita a raça na planilha (texto exibido, vírgula decimal)
    const raca = p.abas.Animais[0].indexOf('Raça');
    expect(p.abas.Animais[1][p.abas.Animais[0].indexOf('Valor de compra (R$)')]).toBe('2350,5');
    p.abas.Animais[1][raca] = 'Angus';
    const lido2 = post({ token: 't', acao: 'ler', abas: nomes });
    const r2 = sincronizarPlanilha(r1.estado, lido2.abas as Record<string, Grade>, r1.base, ['lotes', 'animais'], 'drap', '2026-10-15', id);
    expect(r2.estado.animais[0].raca).toBe('Angus');
    expect(r2.estado.animais[0].valorCompra).toBe(2350.5);
    expect(r2.resumo).toMatchObject({ atualizadosDrap: 1, conflitos: 0, erros: [] });
    expect(Object.values(r2.abas).some((a) => a.mudouPlanilha)).toBe(false);
  });
});

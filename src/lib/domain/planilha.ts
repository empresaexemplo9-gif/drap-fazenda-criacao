/**
 * Sincronização nos dois sentidos com uma planilha (Google Planilhas ou
 * Excel). Cada aba da planilha espelha uma coleção do DRAP Pecuária.
 *
 * Como o mesmo registro é reconhecido dos dois lados:
 *   1. pela coluna "ID DRAP", que o sistema escreve na planilha;
 *   2. sem ID (linha digitada na planilha), pela identificação natural:
 *      RFID, SISBOV ou brinco do animal; nome do lote, do piquete, da pessoa
 *      ou do insumo; tipo + número do documento; brinco + data da pesagem;
 *      data + histórico + valor (ou NF + fornecedor) do lançamento.
 *
 * Quem vence quando os dois lados diferem: guardamos a "base" (uma
 * impressão de cada linha na última sincronização). Se só a planilha mudou
 * desde a base, a planilha atualiza o DRAP; se só o DRAP mudou, o DRAP
 * atualiza a planilha; se os dois mudaram (ou é a primeira vez), vale a
 * política escolhida — por padrão, a planilha, que é "a realidade" do
 * produtor.
 *
 * Exclusões: um registro excluído no DRAP sai da planilha. Uma linha
 * apagada na planilha NÃO apaga nada no DRAP (perder um animal por engano
 * numa planilha é caro); a linha volta e o relatório avisa.
 *
 * Tudo aqui é puro (sem rede, sem armazenamento) e testado.
 */

import { ROT_ATIVIDADE, ROT_FASE, ROT_FUNCAO, ROT_INSUMO, ROT_STATUS } from '../rotulos';
import { validarLancamento } from './livro-razao';
import { saldoInsumo } from './estoque';
import type {
  Animal, Atividade, CategoriaInsumo, Colecoes, Documento, Estado, Fase, FormaPgto, Id, Insumo, ISODate, Lancamento, Lote,
  Pesagem, Pessoa, Piquete, StatusAnimal, StatusPiquete, TipoDocumento,
} from './types';

export type Celula = string | number | null;
/** Uma aba como a planilha a mostra: primeira linha = cabeçalho. */
export type Grade = Celula[][];

export const COLUNA_ID = 'ID DRAP';

// ===================== NORMALIZAÇÃO E LEITURA DE CÉLULAS =====================

/** Texto sem acento, minúsculo, espaços simples. "  Lote  Recria " → "lote recria". */
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Código (brinco, RFID, SISBOV, número): sem espaços, maiúsculo, sem zeros à esquerda se só dígitos. */
export function codigo(s: unknown): string {
  const t = String(s ?? '').replace(/[\s.\-/]/g, '').toUpperCase();
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, '') : t;
}

/**
 * Número no jeito brasileiro ou internacional: "1.234,56", "1234,56",
 * "1234.56", "R$ 1.500". Só pontos agrupando de 3 em 3 = milhar ("1.500").
 */
export function lerNumero(v: Celula): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let t = String(v).replace(/R\$|\s|kg|ha|%/gi, '').trim();
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Data "15/10/2026", "15/10/26", "2026-10-15" ou número de série do Excel → "2026-10-15". */
export function lerData(v: Celula): ISODate | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v))) {
    const serial = Number(v);
    if (serial > 20000 && serial < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 864e5).toISOString().slice(0, 10);
    return null;
  }
  const t = String(v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return valida(ano, Number(m[2]), Number(m[1]));
  }
  return null;
}

function valida(a: number, mes: number, d: number): ISODate | null {
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  const iso = `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return new Date(`${iso}T12:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

export function escreverData(iso?: string): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function lerSimNao(v: Celula): boolean | null {
  const t = norm(v);
  if (!t) return null;
  if (['sim', 's', 'x', 'yes', 'true', '1', 'verdadeiro'].includes(t)) return true;
  if (['nao', 'n', 'no', 'false', '0', 'falso'].includes(t)) return false;
  return null;
}

/** Acha a chave de um rótulo: "Lactação", "lactacao" ou a própria chave "lactacao". */
function deRotulo<K extends string>(rotulos: Record<K, string>, v: Celula): K | null {
  const t = norm(v);
  if (!t) return null;
  for (const k of Object.keys(rotulos) as K[]) {
    if (norm(k) === t || norm(rotulos[k]) === t || norm(rotulos[k]).startsWith(t)) return k;
  }
  return null;
}

/** Forma canônica de uma célula para comparar os dois lados sem se enganar com formato. */
export function canon(v: Celula): string {
  if (v == null) return '';
  const s = String(v).trim();
  if (s === '') return '';
  const d = /\d[/.-]\d|^\d{4}-\d/.test(s) ? lerData(s) : null;
  if (d) return `d${d}`;
  const n = /^[-R$\s\d.,]+$/.test(s) && /\d/.test(s) ? lerNumero(s) : null;
  if (n != null) return `n${Math.round(n * 1e6) / 1e6}`;
  return `t${norm(s)}`;
}

/** Impressão curta (FNV-1a) de uma linha. */
export function impressao(valores: Celula[]): string {
  let h = 0x811c9dc5;
  const s = valores.map(canon).join('␟');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ===================== ESPECIFICAÇÃO DAS ABAS =====================

export interface Contexto {
  e: Estado;
  hoje: ISODate;
  novoId: (prefixo: string) => Id;
}

interface Coluna<T> {
  titulo: string;
  aliases?: string[];
  /** DRAP → planilha. */
  ler: (r: T, c: Contexto) => Celula;
  /** Planilha → DRAP. Devolve uma mensagem de erro, se houver. Sem `gravar` = só leitura. */
  gravar?: (r: T, v: Celula, c: Contexto) => string | void;
  /** Coluna de identificação: a planilha guarda como texto (não come zeros à esquerda). */
  texto?: boolean;
}

export interface Aba<T extends { id: Id }> {
  id: string;
  nome: string;
  colecao: keyof Colecoes;
  colunas: Coluna<T>[];
  /** Chaves naturais que identificam o registro sem o ID DRAP. */
  chaves: (r: Partial<T>, c: Contexto) => string[];
  novo: (c: Contexto) => T;
  validar: (r: T, c: Contexto) => string | null;
}

const opc = (s?: string | number | null) => (s == null || s === '' ? undefined : s);
const txt = (v: Celula) => (v == null ? '' : String(v).trim());

const loteNome = (c: Contexto, id?: Id) => (id ? c.e.lotes.find((l) => l.id === id)?.nome ?? '' : '');
const piqueteNome = (c: Contexto, id?: Id) => (id ? c.e.piquetes.find((p) => p.id === id)?.nome ?? '' : '');
const animalBrinco = (c: Contexto, id?: Id) => (id ? c.e.animais.find((a) => a.id === id)?.brinco ?? '' : '');

function porNome<T extends { id: Id; nome: string }>(lista: T[], v: Celula): T | undefined {
  const t = norm(v);
  return t ? lista.find((x) => norm(x.nome) === t) : undefined;
}

/** Animal pelo brinco: o ativo primeiro, depois qualquer um. */
export function animalPorBrinco(e: Estado, v: Celula): Animal | undefined {
  const t = codigo(v);
  if (!t) return undefined;
  return e.animais.find((a) => a.status === 'ativo' && codigo(a.brinco) === t) ?? e.animais.find((a) => codigo(a.brinco) === t);
}

function setLote<T extends { loteId?: Id }>(r: T, v: Celula, c: Contexto): string | void {
  if (!txt(v)) { r.loteId = undefined; return; }
  const l = porNome(c.e.lotes, v);
  if (!l) return `Lote "${txt(v)}" não existe (cadastre na aba Lotes)`;
  r.loteId = l.id;
}

const SEXO = { M: 'Macho', F: 'Fêmea' } as const;

export const ABA_ANIMAIS: Aba<Animal> = {
  id: 'animais', nome: 'Animais', colecao: 'animais',
  colunas: [
    { titulo: 'Brinco', aliases: ['numero', 'nº brinco', 'n brinco', 'identificacao'], texto: true, ler: (a) => a.brinco,
      gravar: (a, v) => { if (!txt(v)) return 'Brinco em branco'; a.brinco = txt(v); } },
    { titulo: 'RFID', aliases: ['chip', 'eid', 'botton'], texto: true, ler: (a) => a.rfid ?? '', gravar: (a, v) => { a.rfid = opc(txt(v)) as string | undefined; } },
    { titulo: 'SISBOV', texto: true, ler: (a) => a.sisbov ?? '', gravar: (a, v) => { a.sisbov = opc(txt(v)) as string | undefined; } },
    { titulo: 'Nome', ler: (a) => a.nome ?? '', gravar: (a, v) => { a.nome = opc(txt(v)) as string | undefined; } },
    { titulo: 'Sexo', ler: (a) => SEXO[a.sexo],
      gravar: (a, v) => { const t = norm(v); if (t.startsWith('m')) a.sexo = 'M'; else if (t.startsWith('f')) a.sexo = 'F'; else return 'Sexo deve ser Macho ou Fêmea'; } },
    { titulo: 'Raça', aliases: ['raca'], ler: (a) => a.raca, gravar: (a, v) => { a.raca = txt(v) || 'SRD'; } },
    { titulo: 'Nascimento', aliases: ['data de nascimento', 'nasc'], ler: (a) => escreverData(a.nascimento),
      gravar: (a, v) => { const d = lerData(v); if (!d) return 'Nascimento inválido (use dd/mm/aaaa)'; a.nascimento = d; } },
    { titulo: 'Lote', ler: (a, c) => loteNome(c, a.loteId), gravar: setLote },
    { titulo: 'Origem', ler: (a) => (a.origem === 'comprado' ? 'Comprado' : 'Nascido'),
      gravar: (a, v) => { a.origem = norm(v).startsWith('c') ? 'comprado' : 'nascido'; } },
    { titulo: 'Fornecedor', ler: (a) => a.fornecedor ?? '', gravar: (a, v) => { a.fornecedor = opc(txt(v)) as string | undefined; } },
    { titulo: 'Valor de compra (R$)', aliases: ['valor de compra', 'valor pago'], ler: (a) => a.valorCompra ?? '',
      gravar: (a, v) => { a.valorCompra = lerNumero(v) ?? undefined; } },
    { titulo: 'Entrada', aliases: ['data de entrada'], ler: (a) => escreverData(a.dataEntrada), gravar: (a, v) => { a.dataEntrada = lerData(v) ?? undefined; } },
    { titulo: 'Situação', aliases: ['situacao', 'status'], ler: (a) => ROT_STATUS[a.status],
      gravar: (a, v) => { if (!txt(v)) return; const s = deRotulo(ROT_STATUS, v); if (!s) return `Situação "${txt(v)}" desconhecida`; a.status = s as StatusAnimal; } },
    { titulo: 'Saída', aliases: ['data de saida'], ler: (a) => escreverData(a.dataSaida), gravar: (a, v) => { a.dataSaida = lerData(v) ?? undefined; } },
    { titulo: 'Pai (brinco)', aliases: ['pai'], texto: true, ler: (a, c) => animalBrinco(c, a.paiId) || a.paiExterno || '',
      gravar: (a, v, c) => {
        if (!txt(v)) { a.paiId = undefined; a.paiExterno = undefined; return; }
        const p = animalPorBrinco(c.e, v);
        if (p && p.id !== a.id) { a.paiId = p.id; a.paiExterno = undefined; } else { a.paiId = undefined; a.paiExterno = txt(v); }
      } },
    { titulo: 'Mãe (brinco)', aliases: ['mae'], texto: true, ler: (a, c) => animalBrinco(c, a.maeId),
      gravar: (a, v, c) => { if (!txt(v)) { a.maeId = undefined; return; } const m = animalPorBrinco(c.e, v); if (!m || m.id === a.id) return `Mãe "${txt(v)}" não encontrada`; a.maeId = m.id; } },
    { titulo: 'Registro genealógico', aliases: ['registro', 'rgd', 'rgn'], texto: true, ler: (a) => a.registroGenealogico ?? '',
      gravar: (a, v) => { a.registroGenealogico = opc(txt(v)) as string | undefined; } },
    { titulo: 'Observação', aliases: ['observacao', 'obs'], ler: (a) => a.obs ?? '', gravar: (a, v) => { a.obs = opc(txt(v)) as string | undefined; } },
  ],
  chaves: (a) => [
    a.rfid ? `rfid:${codigo(a.rfid)}` : '',
    a.sisbov ? `sisbov:${codigo(a.sisbov)}` : '',
    a.brinco && (a.status ?? 'ativo') === 'ativo' ? `brinco:${codigo(a.brinco)}` : '',
  ].filter(Boolean),
  novo: (c) => ({ id: c.novoId('a'), brinco: '', sexo: 'M', raca: 'SRD', nascimento: c.hoje, origem: 'nascido', status: 'ativo' }),
  validar: (a, c) => {
    if (!a.brinco) return 'Brinco em branco';
    const dup = c.e.animais.find((x) => x.id !== a.id && x.status === 'ativo' && a.status === 'ativo' && codigo(x.brinco) === codigo(a.brinco));
    if (dup) return `Brinco ${a.brinco} já usado por outro animal ativo`;
    if (a.rfid && c.e.animais.some((x) => x.id !== a.id && x.rfid && codigo(x.rfid) === codigo(a.rfid))) return `RFID ${a.rfid} já usado por outro animal`;
    return null;
  },
};

export const ABA_LOTES: Aba<Lote> = {
  id: 'lotes', nome: 'Lotes', colecao: 'lotes',
  colunas: [
    { titulo: 'Nome', aliases: ['lote'], ler: (l) => l.nome, gravar: (l, v) => { if (!txt(v)) return 'Nome em branco'; l.nome = txt(v); } },
    { titulo: 'Atividade', ler: (l) => ROT_ATIVIDADE[l.atividade],
      gravar: (l, v) => { const a = deRotulo(ROT_ATIVIDADE, v); if (!a) return 'Atividade deve ser Corte, Leite ou Genética'; l.atividade = a as Atividade; } },
    { titulo: 'Fase', ler: (l) => ROT_FASE[l.fase], gravar: (l, v) => { const f = deRotulo(ROT_FASE, v); if (!f) return `Fase "${txt(v)}" desconhecida`; l.fase = f as Fase; } },
    { titulo: 'Piquete', aliases: ['pasto'], ler: (l, c) => piqueteNome(c, l.piqueteId),
      gravar: (l, v, c) => { if (!txt(v)) { l.piqueteId = undefined; return; } const p = porNome(c.e.piquetes, v); if (!p) return `Piquete "${txt(v)}" não existe`; l.piqueteId = p.id; } },
    { titulo: 'Cabeças (calculado)', aliases: ['cabecas'], ler: (l, c) => c.e.animais.filter((a) => a.status === 'ativo' && a.loteId === l.id).length },
  ],
  chaves: (l) => (l.nome ? [`nome:${norm(l.nome)}`] : []),
  novo: (c) => ({ id: c.novoId('l'), nome: '', atividade: c.e.modulos.corte ? 'corte' : c.e.modulos.leite ? 'leite' : 'genetica', fase: 'recria' }),
  validar: (l, c) => (!l.nome ? 'Nome em branco' : c.e.lotes.some((x) => x.id !== l.id && norm(x.nome) === norm(l.nome)) ? `Já existe o lote ${l.nome}` : null),
};

const ROT_PIQUETE: Record<StatusPiquete, string> = { ocupado: 'Ocupado', descanso: 'Descanso', reforma: 'Reforma', degradado: 'Degradado' };

export const ABA_PIQUETES: Aba<Piquete> = {
  id: 'piquetes', nome: 'Piquetes', colecao: 'piquetes',
  colunas: [
    { titulo: 'Nome', aliases: ['piquete', 'pasto'], ler: (p) => p.nome, gravar: (p, v) => { if (!txt(v)) return 'Nome em branco'; p.nome = txt(v); } },
    { titulo: 'Área (ha)', aliases: ['area', 'hectares'], ler: (p) => p.areaHa,
      gravar: (p, v) => { const n = lerNumero(v); if (n == null || n <= 0) return 'Área deve ser maior que zero'; p.areaHa = n; } },
    { titulo: 'Forrageira', aliases: ['capim'], ler: (p) => p.forrageira, gravar: (p, v) => { p.forrageira = txt(v); } },
    { titulo: 'Capacidade (UA/ha)', aliases: ['capacidade', 'ua/ha'], ler: (p) => p.capacidadeUAha, gravar: (p, v) => { p.capacidadeUAha = lerNumero(v) ?? p.capacidadeUAha; } },
    { titulo: 'Situação', aliases: ['situacao', 'status'], ler: (p) => ROT_PIQUETE[p.status],
      gravar: (p, v) => { if (!txt(v)) return; const s = deRotulo(ROT_PIQUETE, v); if (!s) return `Situação "${txt(v)}" desconhecida`; p.status = s as StatusPiquete; } },
    { titulo: 'Desde', ler: (p) => escreverData(p.desde), gravar: (p, v, c) => { p.desde = lerData(v) ?? c.hoje; } },
    { titulo: 'Descanso alvo (dias)', aliases: ['descanso'], ler: (p) => p.diasDescansoAlvo, gravar: (p, v) => { p.diasDescansoAlvo = lerNumero(v) ?? p.diasDescansoAlvo; } },
    { titulo: 'Última adubação', aliases: ['ultima adubacao', 'adubacao'], ler: (p) => escreverData(p.ultimaAdubacao), gravar: (p, v) => { p.ultimaAdubacao = lerData(v) ?? undefined; } },
  ],
  chaves: (p) => (p.nome ? [`nome:${norm(p.nome)}`] : []),
  novo: (c) => ({ id: c.novoId('pq'), nome: '', areaHa: 0, forrageira: '', capacidadeUAha: 2, status: 'descanso', desde: c.hoje, diasDescansoAlvo: 30 }),
  validar: (p, c) => (!p.nome ? 'Nome em branco' : !(p.areaHa > 0) ? 'Área deve ser maior que zero'
    : c.e.piquetes.some((x) => x.id !== p.id && norm(x.nome) === norm(p.nome)) ? `Já existe o piquete ${p.nome}` : null),
};

export const ABA_PESSOAS: Aba<Pessoa> = {
  id: 'pessoas', nome: 'Equipe', colecao: 'pessoas',
  colunas: [
    { titulo: 'Nome', ler: (p) => p.nome, gravar: (p, v) => { if (!txt(v)) return 'Nome em branco'; p.nome = txt(v); } },
    { titulo: 'Função', aliases: ['funcao', 'cargo'], ler: (p) => ROT_FUNCAO[p.funcao],
      gravar: (p, v) => { const f = deRotulo(ROT_FUNCAO, v); if (!f) return `Função "${txt(v)}" desconhecida`; p.funcao = f as Pessoa['funcao']; } },
    { titulo: 'Telefone', aliases: ['celular', 'whatsapp'], texto: true, ler: (p) => p.telefone ?? '', gravar: (p, v) => { p.telefone = opc(txt(v)) as string | undefined; } },
    { titulo: 'Escala', aliases: ['turno'], ler: (p) => p.escala ?? '', gravar: (p, v) => { p.escala = opc(txt(v)) as string | undefined; } },
    { titulo: 'Ativo', ler: (p) => (p.ativo ? 'Sim' : 'Não'), gravar: (p, v) => { const b = lerSimNao(v); if (b != null) p.ativo = b; } },
  ],
  chaves: (p) => (p.nome ? [`nome:${norm(p.nome)}`] : []),
  novo: (c) => ({ id: c.novoId('p'), nome: '', funcao: 'vaqueiro', ativo: true }),
  validar: (p) => (!p.nome ? 'Nome em branco' : null),
};

export const ABA_INSUMOS: Aba<Insumo> = {
  id: 'insumos', nome: 'Insumos', colecao: 'insumos',
  colunas: [
    { titulo: 'Nome', aliases: ['insumo', 'produto'], ler: (i) => i.nome, gravar: (i, v) => { if (!txt(v)) return 'Nome em branco'; i.nome = txt(v); } },
    { titulo: 'Categoria', ler: (i) => ROT_INSUMO[i.categoria], gravar: (i, v) => { i.categoria = (deRotulo(ROT_INSUMO, v) ?? 'outro') as CategoriaInsumo; } },
    { titulo: 'Unidade', aliases: ['un'], ler: (i) => i.unidade, gravar: (i, v) => { i.unidade = txt(v) || 'un'; } },
    { titulo: 'Estoque mínimo', aliases: ['minimo'], ler: (i) => i.estoqueMinimo, gravar: (i, v) => { i.estoqueMinimo = lerNumero(v) ?? 0; } },
    { titulo: 'Consumo por dia', aliases: ['consumo diario', 'consumo'], ler: (i) => i.consumoDiario, gravar: (i, v) => { i.consumoDiario = lerNumero(v) ?? 0; } },
    { titulo: 'Custo médio (R$)', aliases: ['custo medio', 'custo'], ler: (i) => i.custoMedio, gravar: (i, v) => { i.custoMedio = lerNumero(v) ?? i.custoMedio; } },
    { titulo: 'Saldo (calculado)', aliases: ['saldo'], ler: (i, c) => Math.round(saldoInsumo(i, c.e.movEstoque, c.hoje).saldo * 100) / 100 },
  ],
  chaves: (i) => (i.nome ? [`nome:${norm(i.nome)}`] : []),
  novo: (c) => ({ id: c.novoId('i'), nome: '', categoria: 'outro', unidade: 'un', estoqueMinimo: 0, consumoDiario: 0, custoMedio: 0 }),
  validar: (i) => (!i.nome ? 'Nome em branco' : null),
};

const TIPOS_DOC: TipoDocumento[] = ['GTA', 'NF Produtor', 'Funrural', 'CAR', 'ITR', 'CCIR', 'SISBOV', 'Licença', 'Outro'];

export const ABA_DOCUMENTOS: Aba<Documento> = {
  id: 'documentos', nome: 'Documentos', colecao: 'documentos',
  colunas: [
    { titulo: 'Tipo', ler: (d) => d.tipo,
      gravar: (d, v) => { const t = TIPOS_DOC.find((x) => norm(x) === norm(v)) ?? (norm(v).startsWith('nf') ? 'NF Produtor' : undefined); if (!t) return `Tipo "${txt(v)}" desconhecido`; d.tipo = t; } },
    { titulo: 'Número', aliases: ['numero', 'n'], texto: true, ler: (d) => d.numero, gravar: (d, v) => { if (!txt(v)) return 'Número em branco'; d.numero = txt(v); } },
    { titulo: 'Emissão', aliases: ['emissao', 'data'], ler: (d) => escreverData(d.emissao), gravar: (d, v) => { const x = lerData(v); if (!x) return 'Emissão inválida'; d.emissao = x; } },
    { titulo: 'Vencimento', aliases: ['validade'], ler: (d) => escreverData(d.vencimento), gravar: (d, v) => { d.vencimento = lerData(v) ?? undefined; } },
    { titulo: 'Situação', aliases: ['situacao', 'status'], ler: (d) => d.status,
      gravar: (d, v) => { const t = norm(v); if (!t) return; const s = (['vigente', 'pendente', 'vencido', 'cancelado'] as const).find((x) => x.startsWith(t)); if (!s) return `Situação "${txt(v)}" desconhecida`; d.status = s; } },
    { titulo: 'Destino', ler: (d) => d.destino ?? '', gravar: (d, v) => { d.destino = opc(txt(v)) as string | undefined; } },
    { titulo: 'Quantidade', aliases: ['cabecas'], ler: (d) => d.quantidade ?? '', gravar: (d, v) => { d.quantidade = lerNumero(v) ?? undefined; } },
    { titulo: 'Valor (R$)', aliases: ['valor'], ler: (d) => d.valor ?? '', gravar: (d, v) => { d.valor = lerNumero(v) ?? undefined; } },
    { titulo: 'Observação', aliases: ['observacao', 'obs'], ler: (d) => d.obs ?? '', gravar: (d, v) => { d.obs = opc(txt(v)) as string | undefined; } },
  ],
  chaves: (d) => (d.tipo && d.numero ? [`doc:${norm(d.tipo)}:${codigo(d.numero)}`] : []),
  novo: (c) => ({ id: c.novoId('d'), tipo: 'Outro', numero: '', emissao: c.hoje, status: 'vigente' }),
  validar: (d) => (!d.numero ? 'Número em branco' : null),
};

export const ABA_PESAGENS: Aba<Pesagem> = {
  id: 'pesagens', nome: 'Pesagens', colecao: 'pesagens',
  colunas: [
    { titulo: 'Brinco', texto: true, ler: (p, c) => animalBrinco(c, p.animalId),
      gravar: (p, v, c) => { const a = animalPorBrinco(c.e, v); if (!a) return `Animal de brinco "${txt(v)}" não encontrado`; p.animalId = a.id; } },
    { titulo: 'Data', ler: (p) => escreverData(p.data), gravar: (p, v) => { const d = lerData(v); if (!d) return 'Data inválida'; p.data = d; } },
    { titulo: 'Peso (kg)', aliases: ['peso'], ler: (p) => p.pesoKg,
      gravar: (p, v) => { const n = lerNumero(v); if (n == null || n < 20 || n > 1500) return 'Peso fora da faixa (20 a 1500 kg)'; p.pesoKg = n; } },
    { titulo: 'Método', aliases: ['metodo'], ler: (p) => ({ balanca: 'Balança', fita: 'Fita', estimado: 'Estimado' })[p.metodo],
      gravar: (p, v) => { const t = norm(v); p.metodo = t.startsWith('f') ? 'fita' : t.startsWith('e') ? 'estimado' : 'balanca'; } },
  ],
  chaves: (p) => (p.animalId && p.data ? [`pes:${p.animalId}:${p.data}`] : []),
  novo: (c) => ({ id: c.novoId('w'), animalId: '', data: c.hoje, pesoKg: 0, metodo: 'balanca' }),
  validar: (p) => (!p.animalId ? 'Brinco não encontrado' : !(p.pesoKg > 0) ? 'Peso em branco' : null),
};

const FORMAS: FormaPgto[] = ['A PAGAR', 'BOLETO', 'TRANSFER', 'PIX', 'DINHEIRO', 'CARTAO', 'CREDITO RURAL'];

export const ABA_LANCAMENTOS: Aba<Lancamento> = {
  id: 'lancamentos', nome: 'Lançamentos', colecao: 'lancamentos',
  colunas: [
    { titulo: 'Data', ler: (l) => escreverData(l.data), gravar: (l, v) => { const d = lerData(v); if (!d) return 'Data inválida'; l.data = d; } },
    { titulo: 'Histórico', aliases: ['historico', 'descricao'], ler: (l) => l.historico, gravar: (l, v) => { l.historico = txt(v); } },
    { titulo: 'Débito', aliases: ['debito', 'conta debito'], texto: true, ler: (l) => l.debito, gravar: (l, v) => { l.debito = txt(v).split(' ')[0]; } },
    { titulo: 'Crédito', aliases: ['credito', 'conta credito'], texto: true, ler: (l) => l.credito, gravar: (l, v) => { l.credito = txt(v).split(' ')[0]; } },
    { titulo: 'Valor (R$)', aliases: ['valor'], ler: (l) => l.valor, gravar: (l, v) => { const n = lerNumero(v); if (n == null) return 'Valor inválido'; l.valor = Math.abs(n); } },
    { titulo: 'Atividade', ler: (l) => ROT_ATIVIDADE[l.atividade], gravar: (l, v) => { l.atividade = (deRotulo(ROT_ATIVIDADE, v) ?? 'geral') as Atividade; } },
    { titulo: 'Lote', ler: (l, c) => loteNome(c, l.loteId), gravar: setLote },
    { titulo: 'Fornecedor', aliases: ['cliente', 'fornecedor / cliente'], ler: (l) => l.fornecedor ?? '', gravar: (l, v) => { l.fornecedor = opc(txt(v)) as string | undefined; } },
    { titulo: 'NF', aliases: ['nota', 'nota fiscal'], texto: true, ler: (l) => l.nota ?? '', gravar: (l, v) => { l.nota = opc(txt(v)) as string | undefined; } },
    { titulo: 'Forma de pagamento', aliases: ['forma', 'forma pgto'], ler: (l) => l.formaPgto ?? '',
      gravar: (l, v) => { l.formaPgto = FORMAS.find((f) => norm(f) === norm(v)) ?? undefined; } },
    { titulo: 'Vencimento', ler: (l) => escreverData(l.vencimento), gravar: (l, v) => { l.vencimento = lerData(v) ?? undefined; } },
    { titulo: 'Pago em', aliases: ['pagamento', 'data de pagamento'], ler: (l) => escreverData(l.pagoEm), gravar: (l, v) => { l.pagoEm = lerData(v) ?? undefined; } },
    { titulo: 'Previsão', aliases: ['previsao', 'previsto'], ler: (l) => (l.previsto ? 'Sim' : ''), gravar: (l, v) => { l.previsto = lerSimNao(v) || undefined; } },
  ],
  chaves: (l) => [
    l.data && l.historico && l.valor ? `lanc:${l.data}:${norm(l.historico)}:${Math.round(l.valor * 100)}` : '',
    l.nota && l.fornecedor ? `nf:${codigo(l.nota)}:${norm(l.fornecedor)}` : '',
  ].filter(Boolean),
  novo: (c) => ({ id: c.novoId('f'), data: c.hoje, historico: '', debito: '', credito: '', valor: 0, atividade: 'geral' }),
  validar: (l, c) => validarLancamento(l, c.e.contas)[0]?.msg ?? null,
};

/** Ordem importa: o que é referenciado (lote, piquete, animal) vem antes. */
export const ABAS = [ABA_PIQUETES, ABA_LOTES, ABA_PESSOAS, ABA_INSUMOS, ABA_ANIMAIS, ABA_PESAGENS, ABA_LANCAMENTOS, ABA_DOCUMENTOS] as const;
export type AbaId = (typeof ABAS)[number]['id'];

// ===================== FUSÃO DE UMA ABA =====================

export type Politica = 'planilha' | 'drap';

export interface ErroLinha { aba: string; linha: number; msg: string }

export interface ResultadoAba {
  aba: string;
  grade: Grade;
  /** Colunas que a planilha deve guardar como texto (índices de coluna, base 0). */
  colunasTexto: number[];
  mudouPlanilha: boolean;
  registros: { id: Id }[];
  base: Record<Id, string>;
  criadosDrap: number;
  atualizadosDrap: number;
  criadosPlanilha: number;
  atualizadosPlanilha: number;
  removidosPlanilha: number;
  recolocados: number;
  conflitos: number;
  erros: ErroLinha[];
}

function cabecalhoIndice<T extends { id: Id }>(aba: Aba<T>, cab: Celula[]): { idCol: number; mapa: Map<number, Coluna<T>> } {
  const mapa = new Map<number, Coluna<T>>();
  let idCol = -1;
  cab.forEach((h, i) => {
    const t = norm(h);
    if (!t) return;
    if (t === norm(COLUNA_ID) || t === 'id') { idCol = i; return; }
    const col = aba.colunas.find((c) => norm(c.titulo) === t || (c.aliases ?? []).some((a) => norm(a) === t))
      ?? aba.colunas.find((c) => norm(c.titulo).replace(/\s*\(.*\)$/, '') === t.replace(/\s*\(.*\)$/, ''));
    if (col && ![...mapa.values()].includes(col)) mapa.set(i, col);
  });
  return { idCol, mapa };
}

/**
 * Funde uma aba. `registros` = a coleção do DRAP; `grade` = a aba como está
 * na planilha (vazia ou ausente = planilha nova); `base` = impressões da
 * última sincronização desta aba.
 */
export function fundirAba<T extends { id: Id }>(
  aba: Aba<T>, registros: T[], grade: Grade | undefined, base: Record<Id, string>, politica: Politica, c: Contexto,
): ResultadoAba {
  const r: ResultadoAba = {
    aba: aba.id, grade: [], colunasTexto: [], mudouPlanilha: false, registros: [], base: {},
    criadosDrap: 0, atualizadosDrap: 0, criadosPlanilha: 0, atualizadosPlanilha: 0, removidosPlanilha: 0, recolocados: 0, conflitos: 0, erros: [],
  };
  const cab = grade?.[0] ?? [];
  const { idCol, mapa } = cabecalhoIndice(aba, cab);
  // cabeçalho de saída: ID DRAP + nossas colunas + colunas extras do usuário, na ordem em que estavam
  const extras = cab.map((h, i) => ({ h, i })).filter(({ h, i }) => norm(h) && i !== idCol && !mapa.has(i));
  const saidaCab: Celula[] = [COLUNA_ID, ...aba.colunas.map((col) => col.titulo), ...extras.map((x) => x.h)];
  r.colunasTexto = [0, ...aba.colunas.flatMap((col, i) => (col.texto ? [i + 1] : []))];

  const porId = new Map(registros.map((x) => [x.id, x]));
  const porChave = new Map<string, Id>();
  for (const x of registros) for (const k of aba.chaves(x, c)) if (!porChave.has(k)) porChave.set(k, x.id);

  const lerDrap = (x: T): Celula[] => aba.colunas.map((col) => col.ler(x, c) ?? '');
  // a impressão só olha as colunas editáveis: "Cabeças (calculado)" muda sozinha e não é conflito
  const editaveis = aba.colunas.map((col) => !!col.gravar);
  const hash = (v: Celula[]) => impressao(v.filter((_, j) => editaveis[j]));
  const final = new Map<Id, T>(registros.map((x) => [x.id, x]));
  const usados = new Set<Id>();
  const saidaLinhas: { id: Id | null; valores: Celula[]; extras: Celula[] }[] = [];

  /** Aplica as células da planilha num registro. Só as colunas que existem na planilha. */
  const aplicar = (alvo: T, linha: Celula[], semApagar = false): string | null => {
    for (const [i, col] of mapa) {
      if (!col.gravar) continue;
      // primeira vez que a linha casa com o registro: célula vazia na planilha não apaga dado do DRAP
      if (semApagar && txt(linha[i]) === '' && txt(col.ler(alvo, c)) !== '') continue;
      const erro = col.gravar(alvo, linha[i] ?? '', c);
      if (erro) return `${col.titulo}: ${erro}`;
    }
    // valida contra o que já foi fundido nesta aba (duas linhas novas com o mesmo brinco, por exemplo)
    const vivo = [...final.values()].filter((x) => x.id !== alvo.id);
    return aba.validar(alvo, { ...c, e: { ...c.e, [aba.colecao]: vivo } });
  };
  /** Valores da planilha alinhados às nossas colunas (coluna ausente = valor do DRAP, se houver). */
  const daPlanilha = (linha: Celula[], x?: T): Celula[] => aba.colunas.map((col, j) => {
    const i = [...mapa].find(([, cc]) => cc === col)?.[0];
    return i != null ? (linha[i] ?? '') : x ? lerDrap(x)[j] : '';
  });

  const linhas = (grade ?? []).slice(1);
  linhas.forEach((linha, n) => {
    const numero = n + 2; // linha da planilha (1 = cabeçalho)
    const extrasLinha = extras.map((x) => linha[x.i] ?? '');
    const vazia = linha.every((v) => txt(v) === '');
    if (vazia) return;
    const idPlanilha = idCol >= 0 ? txt(linha[idCol]) : '';
    let alvo: T | undefined = idPlanilha ? porId.get(idPlanilha) : undefined;
    if (alvo && usados.has(alvo.id)) alvo = undefined; // ID repetido na planilha: trata como nova
    if (!alvo && idPlanilha && base[idPlanilha] && !porId.has(idPlanilha)) {
      // registro excluído no DRAP depois da última sincronização: a linha sai da planilha
      r.removidosPlanilha++;
      return;
    }
    if (!alvo) {
      const tentativa = aba.novo(c);
      for (const [i, col] of mapa) col.gravar?.(tentativa, linha[i] ?? '', c);
      for (const k of aba.chaves(tentativa, c)) {
        const id = porChave.get(k);
        if (id && !usados.has(id)) { alvo = porId.get(id); break; }
      }
    }

    if (alvo) {
      usados.add(alvo.id);
      const drap = lerDrap(alvo);
      const planilha = daPlanilha(linha, alvo);
      const hDrap = hash(drap);
      const hPlan = hash(planilha);
      const b = base[alvo.id];
      let vence: 'nenhum' | 'drap' | 'planilha';
      if (hDrap === hPlan) vence = 'nenhum';
      else if (b && hPlan === b) vence = 'drap';
      else if (b && hDrap === b) vence = 'planilha';
      else {
        vence = politica;
        if (b) r.conflitos++;
      }
      if (vence === 'planilha') {
        const copia = structuredClone(alvo);
        const erro = aplicar(copia, linha, !b);
        if (erro) {
          r.erros.push({ aba: aba.nome, linha: numero, msg: erro });
          saidaLinhas.push({ id: alvo.id, valores: planilha, extras: extrasLinha }); // não apaga o que o produtor digitou
          if (b) r.base[alvo.id] = b;
          return;
        }
        final.set(alvo.id, copia);
        r.atualizadosDrap++;
        const v = lerDrap(copia);
        saidaLinhas.push({ id: alvo.id, valores: v, extras: extrasLinha });
        r.base[alvo.id] = hash(v);
      } else {
        if (vence === 'drap') r.atualizadosPlanilha++;
        saidaLinhas.push({ id: alvo.id, valores: drap, extras: extrasLinha });
        r.base[alvo.id] = hDrap;
      }
      return;
    }

    // linha nova na planilha → novo registro no DRAP
    const novo = aba.novo(c);
    const erro = aplicar(novo, linha);
    if (erro) {
      r.erros.push({ aba: aba.nome, linha: numero, msg: erro });
      saidaLinhas.push({ id: null, valores: daPlanilha(linha), extras: extrasLinha });
      return;
    }
    final.set(novo.id, novo);
    porId.set(novo.id, novo);
    for (const k of aba.chaves(novo, c)) if (!porChave.has(k)) porChave.set(k, novo.id);
    usados.add(novo.id);
    r.criadosDrap++;
    const v = lerDrap(novo);
    saidaLinhas.push({ id: novo.id, valores: v, extras: extrasLinha });
    r.base[novo.id] = hash(v);
  });

  // registros do DRAP que não estão na planilha
  for (const x of registros) {
    if (usados.has(x.id)) continue;
    if (base[x.id]) r.recolocados++; else r.criadosPlanilha++;
    const v = lerDrap(x);
    saidaLinhas.push({ id: x.id, valores: v, extras: extras.map(() => '') });
    r.base[x.id] = hash(v);
  }

  r.grade = [saidaCab, ...saidaLinhas.map((l) => [l.id ?? '', ...l.valores, ...l.extras])];
  r.registros = [...final.values()];
  r.mudouPlanilha = !mesmaGrade(grade ?? [], r.grade);
  return r;
}

/** Duas grades são iguais quando todas as células têm a mesma forma canônica. */
export function mesmaGrade(a: Grade, b: Grade): boolean {
  const linhas = (g: Grade) => g.filter((l) => l.some((v) => txt(v) !== ''));
  const la = linhas(a);
  const lb = linhas(b);
  if (la.length !== lb.length) return false;
  for (let i = 0; i < la.length; i++) {
    const n = Math.max(la[i].length, lb[i].length);
    for (let j = 0; j < n; j++) if (canon(la[i][j] ?? '') !== canon(lb[i][j] ?? '')) return false;
  }
  return true;
}

// ===================== SINCRONIZAÇÃO COMPLETA =====================

export interface ResultadoSync {
  estado: Estado;
  abas: Record<string, ResultadoAba>;
  base: Record<string, Record<Id, string>>;
  resumo: {
    criadosDrap: number; atualizadosDrap: number; criadosPlanilha: number; atualizadosPlanilha: number;
    removidosPlanilha: number; recolocados: number; conflitos: number; erros: ErroLinha[];
  };
}

/**
 * Sincroniza todas as abas escolhidas. Roda em ordem e cada aba já enxerga
 * o que as anteriores criaram (um lote novo na planilha serve para os
 * animais novos da mesma sincronização).
 */
export function sincronizarPlanilha(
  e0: Estado, planilha: Record<string, Grade | undefined>, base: Record<string, Record<Id, string>>,
  abasEscolhidas: string[], politica: Politica, hoje: ISODate, novoId: (p: string) => Id,
): ResultadoSync {
  let e = e0;
  const abas: Record<string, ResultadoAba> = {};
  const novaBase: Record<string, Record<Id, string>> = { ...base };
  const resumo: ResultadoSync['resumo'] = { criadosDrap: 0, atualizadosDrap: 0, criadosPlanilha: 0, atualizadosPlanilha: 0, removidosPlanilha: 0, recolocados: 0, conflitos: 0, erros: [] };
  const originais: Record<string, Grade | undefined> = {};
  for (const aba of ABAS) {
    if (!abasEscolhidas.includes(aba.id)) continue;
    const c: Contexto = { e, hoje, novoId };
    const grade = acharAba(planilha, aba.nome);
    const res = fundirAba(aba as unknown as Aba<{ id: Id }>, e[aba.colecao] as unknown as { id: Id }[], grade, base[aba.id] ?? {}, politica, c);
    abas[aba.id] = res;
    originais[aba.id] = grade;
    novaBase[aba.id] = res.base;
    e = { ...e, [aba.colecao]: res.registros };
    for (const k of ['criadosDrap', 'atualizadosDrap', 'criadosPlanilha', 'atualizadosPlanilha', 'removidosPlanilha', 'recolocados', 'conflitos'] as const) resumo[k] += res[k];
    resumo.erros.push(...res.erros);
  }
  // colunas calculadas (cabeças do lote, saldo do insumo) com o estado final, depois de todas as abas
  const cFinal: Contexto = { e, hoje, novoId };
  for (const aba of ABAS) {
    const res = abas[aba.id];
    if (!res) continue;
    const colunas = aba.colunas as Coluna<{ id: Id }>[];
    const lista = e[aba.colecao] as unknown as { id: Id }[];
    const porId = new Map(lista.map((x) => [x.id, x]));
    for (const linha of res.grade.slice(1)) {
      const x = porId.get(txt(linha[0]));
      if (!x) continue;
      colunas.forEach((col, j) => { if (!col.gravar) linha[j + 1] = col.ler(x, cFinal) ?? ''; });
    }
    res.mudouPlanilha = !mesmaGrade(originais[aba.id] ?? [], res.grade);
  }
  return { estado: e, abas, base: novaBase, resumo };
}

/** Acha a aba pelo nome, sem ligar para acento ou maiúscula ("lancamentos" = "Lançamentos"). */
export function acharAba(planilha: Record<string, Grade | undefined>, nome: string): Grade | undefined {
  const k = Object.keys(planilha).find((n) => norm(n) === norm(nome));
  return k ? planilha[k] : undefined;
}

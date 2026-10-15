/**
 * Livro-razão em partida dobrada.
 *
 * Herda do DRAP Fazenda: plano de contas de 3 níveis ("5.1.01"), lançamento
 * com fornecedor/NF/forma de pagamento, título pendente até `pagoEm`, Posição
 * (a pagar × a receber num intervalo) e saldo realizado × projetado.
 *
 * Acrescenta o que a pecuária precisa: cada lançamento tem atividade
 * (corte/leite/genética/geral) e, quando é custo direto, o lote. Assim o
 * mesmo razão alimenta o custo da arroba e do litro.
 */

import { addDias, mesDe, addMeses } from '../datas';
import type { Conta, Lancamento, NaturezaConta, Atividade, ISODate, Id } from './types';

export const CONTA_CAIXA = '1.1.01';
export const CONTA_BANCO = '1.1.02';
export const CONTA_CLIENTES = '1.1.03';
export const CONTA_FORNECEDORES = '2.1.01';
export const CONTAS_DISPONIVEL = [CONTA_CAIXA, CONTA_BANCO];

/** Plano de contas padrão da pecuária. Contas de nível 3 recebem lançamentos. */
export const PLANO_PADRAO: Conta[] = [
  { codigo: '1', nome: 'Ativo', natureza: 'ativo' },
  { codigo: '1.1', nome: 'Disponível e realizável', natureza: 'ativo' },
  { codigo: '1.1.01', nome: 'Caixa', natureza: 'ativo' },
  { codigo: '1.1.02', nome: 'Banco conta movimento', natureza: 'ativo' },
  { codigo: '1.1.03', nome: 'Clientes a receber', natureza: 'ativo' },
  { codigo: '1.2', nome: 'Estoques', natureza: 'ativo' },
  { codigo: '1.2.01', nome: 'Insumos em estoque', natureza: 'ativo' },
  { codigo: '1.2.02', nome: 'Rebanho (ativo biológico)', natureza: 'ativo' },
  { codigo: '1.3', nome: 'Imobilizado', natureza: 'ativo' },
  { codigo: '1.3.01', nome: 'Máquinas e equipamentos', natureza: 'ativo' },
  { codigo: '1.3.02', nome: 'Benfeitorias, currais e cercas', natureza: 'ativo' },
  { codigo: '1.3.03', nome: 'Pastagens formadas', natureza: 'ativo' },

  { codigo: '2', nome: 'Passivo', natureza: 'passivo' },
  { codigo: '2.1', nome: 'Circulante', natureza: 'passivo' },
  { codigo: '2.1.01', nome: 'Fornecedores a pagar', natureza: 'passivo' },
  { codigo: '2.1.02', nome: 'Salários e encargos a pagar', natureza: 'passivo' },
  { codigo: '2.1.03', nome: 'Funrural a recolher', natureza: 'passivo' },
  { codigo: '2.2', nome: 'Crédito rural', natureza: 'passivo' },
  { codigo: '2.2.01', nome: 'Custeio pecuário', natureza: 'passivo' },
  { codigo: '2.2.02', nome: 'Investimento (Pronamp/Inovagro)', natureza: 'passivo' },

  { codigo: '3', nome: 'Patrimônio líquido', natureza: 'patrimonio' },
  { codigo: '3.1', nome: 'Capital', natureza: 'patrimonio' },
  { codigo: '3.1.01', nome: 'Capital dos sócios', natureza: 'patrimonio' },
  { codigo: '3.1.02', nome: 'Resultados acumulados', natureza: 'patrimonio' },

  { codigo: '4', nome: 'Receitas', natureza: 'receita' },
  { codigo: '4.1', nome: 'Vendas', natureza: 'receita' },
  { codigo: '4.1.01', nome: 'Venda de bois e vacas gordas', natureza: 'receita' },
  { codigo: '4.1.02', nome: 'Venda de bezerros e reposição', natureza: 'receita' },
  { codigo: '4.1.03', nome: 'Venda de leite', natureza: 'receita' },
  { codigo: '4.1.04', nome: 'Venda de reprodutores e matrizes', natureza: 'receita' },
  { codigo: '4.1.05', nome: 'Venda de sêmen e embriões', natureza: 'receita' },
  { codigo: '4.1.09', nome: 'Outras receitas', natureza: 'receita' },

  { codigo: '5', nome: 'Custos e despesas', natureza: 'despesa' },
  { codigo: '5.1', nome: 'Custos variáveis', natureza: 'despesa' },
  { codigo: '5.1.01', nome: 'Sal mineral e suplementos', natureza: 'despesa', comportamento: 'variavel' },
  { codigo: '5.1.02', nome: 'Ração e concentrado', natureza: 'despesa', comportamento: 'variavel' },
  { codigo: '5.1.03', nome: 'Medicamentos e vacinas', natureza: 'despesa', comportamento: 'variavel' },
  { codigo: '5.1.04', nome: 'Sêmen e reprodução', natureza: 'despesa', comportamento: 'variavel' },
  { codigo: '5.1.05', nome: 'Compra de animais (reposição)', natureza: 'despesa', comportamento: 'variavel' },
  { codigo: '5.1.06', nome: 'Silagem e volumoso', natureza: 'despesa', comportamento: 'variavel' },
  { codigo: '5.1.07', nome: 'Fretes e comissões', natureza: 'despesa', comportamento: 'variavel' },
  { codigo: '5.2', nome: 'Custos fixos', natureza: 'despesa' },
  { codigo: '5.2.01', nome: 'Mão de obra e encargos', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.2.02', nome: 'Combustível e lubrificantes', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.2.03', nome: 'Manutenção de máquinas e cercas', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.2.04', nome: 'Energia elétrica', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.2.05', nome: 'Adubação e reforma de pastagem', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.2.06', nome: 'Assistência técnica e veterinária', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.2.07', nome: 'Depreciação', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.2.08', nome: 'Arrendamento', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.3', nome: 'Tributos e despesas financeiras', natureza: 'despesa' },
  { codigo: '5.3.01', nome: 'Funrural', natureza: 'despesa', comportamento: 'variavel' },
  { codigo: '5.3.02', nome: 'ITR e taxas', natureza: 'despesa', comportamento: 'fixo' },
  { codigo: '5.3.03', nome: 'Juros de crédito rural', natureza: 'despesa', comportamento: 'fixo' },
];

export function nivel(codigo: string): number {
  return codigo.split('.').length;
}

export function contaAnalitica(contas: Conta[], codigo: string): boolean {
  return nivel(codigo) === 3 && contas.some((c) => c.codigo === codigo);
}

export function nomeConta(contas: Conta[], codigo: string): string {
  return contas.find((c) => c.codigo === codigo)?.nome ?? codigo;
}

function naturezaDe(contas: Conta[], codigo: string): NaturezaConta {
  const c = contas.find((x) => x.codigo === codigo) ?? contas.find((x) => x.codigo === codigo[0]);
  return c?.natureza ?? 'ativo';
}

/** Contas de natureza devedora aumentam com débito. */
export function devedora(n: NaturezaConta): boolean {
  return n === 'ativo' || n === 'despesa';
}

/** Lançamentos que efetivamente aconteceram (sem orçamento). */
export function realizados(ls: Lancamento[]): Lancamento[] {
  return ls.filter((l) => !l.previsto);
}

export interface ErroLancamento { campo: keyof Lancamento; msg: string }

export function validarLancamento(l: Partial<Lancamento>, contas: Conta[]): ErroLancamento[] {
  const erros: ErroLancamento[] = [];
  if (!l.data || !/^\d{4}-\d{2}-\d{2}$/.test(l.data)) erros.push({ campo: 'data', msg: 'Informe a data.' });
  if (!l.historico?.trim()) erros.push({ campo: 'historico', msg: 'Descreva o lançamento.' });
  if (!l.valor || !(l.valor > 0)) erros.push({ campo: 'valor', msg: 'Valor deve ser maior que zero.' });
  if (!l.debito || !contaAnalitica(contas, l.debito)) erros.push({ campo: 'debito', msg: 'Escolha uma conta analítica (3 níveis) para o débito.' });
  if (!l.credito || !contaAnalitica(contas, l.credito)) erros.push({ campo: 'credito', msg: 'Escolha uma conta analítica (3 níveis) para o crédito.' });
  if (l.debito && l.debito === l.credito) erros.push({ campo: 'credito', msg: 'Débito e crédito não podem ser a mesma conta.' });
  return erros;
}

/** Saldo de uma conta (ou grupo, pelo prefixo) até a data, na natureza da conta. */
export function saldoConta(ls: Lancamento[], contas: Conta[], codigo: string, ate?: ISODate, de?: ISODate): number {
  const n = naturezaDe(contas, codigo);
  const pertence = (c: string) => c === codigo || c.startsWith(codigo + '.');
  let deb = 0;
  let cred = 0;
  for (const l of ls) {
    if (l.previsto) continue;
    if (ate && l.data > ate) continue;
    if (de && l.data < de) continue;
    if (pertence(l.debito)) deb += l.valor;
    if (pertence(l.credito)) cred += l.valor;
  }
  return devedora(n) ? deb - cred : cred - deb;
}

export interface LinhaRazao {
  lancamento: Lancamento;
  debito: number;
  credito: number;
  saldo: number;
  contrapartida: string;
}

/** Razão de uma conta: lançamentos em ordem cronológica com saldo corrente. */
export function razao(ls: Lancamento[], contas: Conta[], codigo: string, de?: ISODate, ate?: ISODate): { saldoAnterior: number; linhas: LinhaRazao[] } {
  const n = naturezaDe(contas, codigo);
  const sinal = devedora(n) ? 1 : -1;
  const saldoAnterior = de ? saldoConta(ls, contas, codigo, addDias(de, -1)) : 0;
  let saldo = saldoAnterior;
  const linhas: LinhaRazao[] = [];
  const ordenados = realizados(ls)
    .filter((l) => (l.debito === codigo || l.credito === codigo) && (!de || l.data >= de) && (!ate || l.data <= ate))
    .sort((a, b) => a.data.localeCompare(b.data) || (a.em ?? '').localeCompare(b.em ?? ''));
  for (const l of ordenados) {
    const debito = l.debito === codigo ? l.valor : 0;
    const credito = l.credito === codigo ? l.valor : 0;
    saldo += sinal * (debito - credito);
    linhas.push({ lancamento: l, debito, credito, saldo, contrapartida: l.debito === codigo ? l.credito : l.debito });
  }
  return { saldoAnterior, linhas };
}

export interface LinhaBalancete { conta: Conta; debitos: number; creditos: number; saldo: number }

/** Balancete de verificação: soma dos débitos = soma dos créditos. */
export function balancete(ls: Lancamento[], contas: Conta[], de?: ISODate, ate?: ISODate): { linhas: LinhaBalancete[]; totalDebitos: number; totalCreditos: number } {
  const linhas: LinhaBalancete[] = [];
  let totalDebitos = 0;
  let totalCreditos = 0;
  const reais = realizados(ls).filter((l) => (!de || l.data >= de) && (!ate || l.data <= ate));
  for (const l of reais) { totalDebitos += l.valor; totalCreditos += l.valor; }
  for (const c of contas) {
    const pertence = (x: string) => x === c.codigo || x.startsWith(c.codigo + '.');
    let d = 0;
    let k = 0;
    for (const l of reais) {
      if (pertence(l.debito)) d += l.valor;
      if (pertence(l.credito)) k += l.valor;
    }
    if (d === 0 && k === 0) continue;
    linhas.push({ conta: c, debitos: d, creditos: k, saldo: devedora(c.natureza) ? d - k : k - d });
  }
  return { linhas, totalDebitos, totalCreditos };
}

// ===================== DRE =====================

export interface Dre {
  receitas: number;
  custosVariaveis: number;
  custosFixos: number;
  tributos: number;
  margemContribuicao: number;
  resultado: number;
  porConta: { conta: Conta; valor: number }[];
}

export function dre(ls: Lancamento[], contas: Conta[], de: ISODate, ate: ISODate, atividade?: Atividade): Dre {
  const filtrados = realizados(ls).filter((l) => l.data >= de && l.data <= ate && (!atividade || l.atividade === atividade));
  const porCodigo = new Map<string, number>();
  for (const l of filtrados) {
    for (const [codigo, sinal] of [[l.debito, 1], [l.credito, -1]] as const) {
      const n = naturezaDe(contas, codigo);
      if (n !== 'receita' && n !== 'despesa') continue;
      const efeito = n === 'despesa' ? sinal * l.valor : -sinal * l.valor;
      porCodigo.set(codigo, (porCodigo.get(codigo) ?? 0) + efeito);
    }
  }
  const soma = (pref: string) => [...porCodigo].filter(([c]) => c.startsWith(pref)).reduce((s, [, v]) => s + v, 0);
  const receitas = soma('4.');
  const custosVariaveis = soma('5.1.') + (porCodigo.get('5.3.01') ?? 0);
  const custosFixos = soma('5.2.');
  const tributos = soma('5.3.') - (porCodigo.get('5.3.01') ?? 0);
  const margemContribuicao = receitas - custosVariaveis;
  return {
    receitas, custosVariaveis, custosFixos, tributos, margemContribuicao,
    resultado: margemContribuicao - custosFixos - tributos,
    porConta: [...porCodigo]
      .map(([codigo, valor]) => ({ conta: contas.find((c) => c.codigo === codigo) ?? { codigo, nome: codigo, natureza: 'despesa' as const }, valor }))
      .filter((x) => Math.abs(x.valor) > 0.004)
      .sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo)),
  };
}

// ===================== POSIÇÃO (títulos a pagar / a receber) =====================

export type TipoTitulo = 'pagar' | 'receber';

/**
 * Título em aberto: lançamento de competência contra o passivo circulante
 * (fornecedores, salários, Funrural) ou contra Clientes, ainda sem baixa.
 * Crédito rural (2.2) é dívida de longo prazo: suas parcelas entram como
 * títulos próprios quando vencem.
 */
export function tipoTitulo(l: Lancamento): TipoTitulo | null {
  if (l.baixaDe || l.previsto) return null;
  if (l.credito.startsWith('2.1.')) return 'pagar';
  if (l.debito === CONTA_CLIENTES) return 'receber';
  return null;
}

export interface Titulo { lancamento: Lancamento; tipo: TipoTitulo; vencimento: ISODate; atrasado: boolean }

export function titulosEmAberto(ls: Lancamento[], hoje: ISODate): Titulo[] {
  const out: Titulo[] = [];
  for (const l of ls) {
    const tipo = tipoTitulo(l);
    if (!tipo || l.pagoEm) continue;
    const vencimento = l.vencimento ?? l.data;
    out.push({ lancamento: l, tipo, vencimento, atrasado: vencimento < hoje });
  }
  return out.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

export interface Posicao { aPagar: number; aReceber: number; liquido: number; titulos: Titulo[]; atrasados: Titulo[] }

/** Posição de um intervalo, como na /posicao do DRAP Fazenda. Atrasados entram sempre. */
export function posicao(ls: Lancamento[], hoje: ISODate, de: ISODate, ate: ISODate): Posicao {
  const todos = titulosEmAberto(ls, hoje);
  const titulos = todos.filter((t) => t.vencimento <= ate && (t.vencimento >= de || t.atrasado));
  const aPagar = titulos.filter((t) => t.tipo === 'pagar').reduce((s, t) => s + t.lancamento.valor, 0);
  const aReceber = titulos.filter((t) => t.tipo === 'receber').reduce((s, t) => s + t.lancamento.valor, 0);
  return { aPagar, aReceber, liquido: aReceber - aPagar, titulos, atrasados: titulos.filter((t) => t.atrasado) };
}

/** Gera o lançamento de baixa (pagamento ou recebimento) de um título. */
export function baixar(l: Lancamento, data: ISODate, contaDisponivel: string, id: Id): Lancamento {
  const tipo = tipoTitulo(l);
  if (!tipo) throw new Error('Lançamento não é um título a pagar/receber.');
  const base = {
    id, data, valor: l.valor, atividade: l.atividade, loteId: l.loteId, fornecedor: l.fornecedor,
    nota: l.nota, safra: l.safra, baixaDe: l.id,
  };
  return tipo === 'pagar'
    ? { ...base, historico: `Pagamento · ${l.historico}`, debito: l.credito, credito: contaDisponivel }
    : { ...base, historico: `Recebimento · ${l.historico}`, debito: contaDisponivel, credito: CONTA_CLIENTES };
}

// ===================== FLUXO DE CAIXA =====================

export interface MesFluxo {
  mes: string;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  projetado: boolean;
}

/**
 * Fluxo de caixa mensal: meses passados pelo realizado (movimento nas contas
 * Caixa/Banco); meses futuros pelos títulos em aberto (no mês do vencimento)
 * e pelos lançamentos previstos. Mostra a sazonalidade: receita concentrada
 * na venda da boiada e custeio na seca.
 */
export function fluxoCaixa(ls: Lancamento[], contas: Conta[], hoje: ISODate, mesesAntes = 6, mesesDepois = 6): MesFluxo[] {
  const mesHoje = mesDe(hoje);
  const inicio = mesDe(addMeses(`${mesHoje}-01`, -mesesAntes));
  const ehDisp = (c: string) => CONTAS_DISPONIVEL.includes(c);
  let saldo = CONTAS_DISPONIVEL.reduce((s, c) => s + saldoConta(ls, contas, c, addDias(`${inicio}-01`, -1)), 0);

  const meses: MesFluxo[] = [];
  for (let i = 0; i <= mesesAntes + mesesDepois; i++) {
    const mes = mesDe(addMeses(`${inicio}-01`, i));
    meses.push({ mes, entradas: 0, saidas: 0, saldoFinal: 0, projetado: mes > mesHoje });
  }
  const porMes = new Map(meses.map((m) => [m.mes, m]));

  for (const l of ls) {
    if (l.previsto) {
      const m = porMes.get(mesDe(l.data));
      if (!m || l.data <= hoje) continue;
      if (naturezaDe(contas, l.debito) === 'despesa') m.saidas += l.valor;
      else if (naturezaDe(contas, l.credito) === 'receita') m.entradas += l.valor;
      continue;
    }
    const m = porMes.get(mesDe(l.data));
    if (!m || l.data > hoje) continue;
    if (ehDisp(l.debito) && !ehDisp(l.credito)) m.entradas += l.valor;
    if (ehDisp(l.credito) && !ehDisp(l.debito)) m.saidas += l.valor;
  }
  for (const t of titulosEmAberto(ls, hoje)) {
    const venc = t.vencimento < hoje ? hoje : t.vencimento;
    const m = porMes.get(mesDe(venc));
    if (!m) continue;
    if (t.tipo === 'pagar') m.saidas += t.lancamento.valor; else m.entradas += t.lancamento.valor;
  }
  for (const m of meses) {
    saldo += m.entradas - m.saidas;
    m.saldoFinal = saldo;
  }
  return meses;
}

/** Fornecedores com total comprado (para autocomplete e comparativos). */
export function fornecedores(ls: Lancamento[]): string[] {
  return [...new Set(ls.map((l) => l.fornecedor).filter((f): f is string => !!f))].sort();
}

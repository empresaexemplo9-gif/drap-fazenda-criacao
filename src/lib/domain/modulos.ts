/**
 * Arquitetura modular: o Núcleo é obrigatório; Corte, Leite e Genética são
 * plugáveis, cada um com preço próprio. O menu e o painel só mostram o que
 * está contratado.
 */

import type { ModuloId } from './types';

export interface Modulo {
  id: ModuloId;
  nome: string;
  resumo: string;
  /** Preço de referência por mês (hipótese a validar na feira). */
  precoMes: number;
  obrigatorio: boolean;
  recursos: string[];
}

export const MODULOS: Modulo[] = [
  {
    id: 'core', nome: 'Núcleo DRAP Pecuária', precoMes: 149, obrigatorio: true,
    resumo: 'Rebanho, identificação, sanidade, pastagem, estoque, livro-razão, custo de produção e app offline.',
    recursos: ['Rebanho e lotes', 'Manejo por brinco/RFID', 'Pastagens e lotação UA/ha', 'Calendário sanitário e carência', 'Estoque de insumos', 'Livro-razão e posição', 'Custo da @ e do litro', 'Documentos (GTA, CAR, ITR)', 'Equipe e apontamentos', 'Mercado e simulador'],
  },
  {
    id: 'corte', nome: 'Módulo Corte', precoMes: 99, obrigatorio: false,
    resumo: 'Pesagens e GMD, confinamento, reposição por fornecedor, venda por frigorífico e conciliação de cabeças.',
    recursos: ['GMD e curva de peso', 'Confinamento: dieta e leitura de cocho', 'Comparativo de reposição por origem', 'Histórico de preço por frigorífico', 'Rendimento de carcaça', 'Desfrute, idade ao abate, lucro/ha'],
  },
  {
    id: 'leite', nome: 'Módulo Leite', precoMes: 99, obrigatorio: false,
    resumo: 'Produção por vaca, qualidade (CCS/CBT), mastite, reprodução e custo do litro.',
    recursos: ['Ordenha por vaca e lote', 'Curva de lactação e vacas improdutivas', 'CCS, CBT, sólidos e tabela do laticínio', 'Mastite e descarte em carência', 'IEP, secagem e partos', 'Escala de ordenha'],
  },
  {
    id: 'genetica', nome: 'Módulo Genética', precoMes: 199, obrigatorio: false,
    resumo: 'Genealogia, DEPs, acasalamento com controle de consanguinidade, IATF/FIV/TE, botijão e catálogo de venda.',
    recursos: ['Registro genealógico', 'DEPs e índices por programa', 'Planejamento de acasalamento', 'Protocolos de IATF e taxa de prenhez', 'Provas de desempenho por contemporâneos', 'Botijão: sêmen e embriões', 'Ficha de venda verificável'],
  },
];

export function moduloAtivo(modulos: Record<ModuloId, boolean>, id: ModuloId): boolean {
  return id === 'core' || !!modulos[id];
}

export function precoTotal(modulos: Record<ModuloId, boolean>): number {
  return MODULOS.filter((m) => moduloAtivo(modulos, m.id)).reduce((s, m) => s + m.precoMes, 0);
}

export type ModuloProdutivo = Exclude<ModuloId, 'core'>;
export const MODULOS_PRODUTIVOS: ModuloProdutivo[] = ['corte', 'leite', 'genetica'];

export const ROTULO_MODULO: Record<ModuloProdutivo, string> = { corte: 'Corte', leite: 'Leite', genetica: 'Genética' };

/**
 * Atividades que a fazenda pratica. A maioria dos produtores trabalha com uma
 * só (corte, leite ou genética); outros combinam duas ou as três. Todo o
 * núcleo (lotes, plano de contas, custos, mercado, painel) se recorta por aqui.
 */
export function atividadesAtivas(modulos: Record<ModuloId, boolean>): ModuloProdutivo[] {
  return MODULOS_PRODUTIVOS.filter((m) => modulos[m]);
}

/** A plataforma precisa de pelo menos uma atividade produtiva contratada. */
export function podeDesativar(modulos: Record<ModuloId, boolean>, id: ModuloId): boolean {
  if (id === 'core') return false;
  return atividadesAtivas(modulos).filter((m) => m !== id).length > 0;
}

export interface Perfil { id: string; nome: string; modulos: ModuloProdutivo[]; resumo: string }

/** As sete combinações possíveis, como o produtor se descreve na feira. */
export const PERFIS: Perfil[] = [
  { id: 'corte', nome: 'Só corte', modulos: ['corte'], resumo: 'Cria, recria, engorda ou confinamento.' },
  { id: 'leite', nome: 'Só leite', modulos: ['leite'], resumo: 'Ordenha, qualidade e reprodução do rebanho leiteiro.' },
  { id: 'genetica', nome: 'Só genética', modulos: ['genetica'], resumo: 'Seleção e venda de reprodutores e matrizes PO.' },
  { id: 'corte+leite', nome: 'Corte e leite', modulos: ['corte', 'leite'], resumo: 'Leite com venda de machos e descarte para corte.' },
  { id: 'corte+genetica', nome: 'Corte e genética', modulos: ['corte', 'genetica'], resumo: 'Plantel PO e rebanho comercial.' },
  { id: 'leite+genetica', nome: 'Leite e genética', modulos: ['leite', 'genetica'], resumo: 'Leite com seleção e venda de genética leiteira.' },
  { id: 'completo', nome: 'Corte, leite e genética', modulos: ['corte', 'leite', 'genetica'], resumo: 'Operação completa.' },
];

export function modulosDoPerfil(p: Perfil): Record<ModuloId, boolean> {
  return { core: true, corte: p.modulos.includes('corte'), leite: p.modulos.includes('leite'), genetica: p.modulos.includes('genetica') };
}

export function perfilDe(modulos: Record<ModuloId, boolean>): Perfil | undefined {
  const at = atividadesAtivas(modulos).join('+');
  return PERFIS.find((p) => p.modulos.join('+') === at);
}

/**
 * Atividade econômica de cada conta de receita. Contas sem entrada aqui
 * servem a qualquer atividade (insumos, mão de obra, financeiro).
 */
export const ATIVIDADE_DA_CONTA: Record<string, ModuloProdutivo> = {
  '4.1.01': 'corte', '4.1.02': 'corte', '4.1.03': 'leite', '4.1.04': 'genetica', '4.1.05': 'genetica',
};

export function contaVisivel(codigo: string, modulos: Record<ModuloId, boolean>): boolean {
  const a = ATIVIDADE_DA_CONTA[codigo];
  return !a || !!modulos[a];
}

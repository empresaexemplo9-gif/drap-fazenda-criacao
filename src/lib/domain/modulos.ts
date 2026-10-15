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

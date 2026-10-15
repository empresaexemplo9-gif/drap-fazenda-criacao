import type { ModuloId } from './domain/types';

export interface Rota {
  href: string;
  label: string;
  modulo: ModuloId;
  grupo: 'Rebanho' | 'Financeiro' | 'Gestão' | 'Módulos' | 'Sistema';
  blurb: string;
  /** Aparece na barra superior do desktop. */
  topo?: boolean;
}

export const ROTAS: Rota[] = [
  { href: '/rebanho/', label: 'Rebanho', modulo: 'core', grupo: 'Rebanho', topo: true, blurb: 'Quantos animais há, em qual lote e em qual pasto, com a ficha de cada um.' },
  { href: '/manejo/', label: 'Manejo', modulo: 'core', grupo: 'Rebanho', topo: true, blurb: 'Tela de curral: leia o brinco ou o RFID e registre pesagem, vacina ou troca de lote.' },
  { href: '/pastagens/', label: 'Pastagens', modulo: 'core', grupo: 'Rebanho', blurb: 'Lotação em UA/ha, rotação de piquetes, descanso, adubação e reforma.' },
  { href: '/sanidade/', label: 'Sanidade', modulo: 'core', grupo: 'Rebanho', blurb: 'Vacinas, vermífugos, partida do produto e carência ativa por animal.' },
  { href: '/agenda/', label: 'Agenda', modulo: 'core', grupo: 'Gestão', topo: true, blurb: 'Calendário sanitário, reprodutivo, de pagamentos e de documentos.' },
  { href: '/lancamentos/', label: 'Lançamentos', modulo: 'core', grupo: 'Financeiro', topo: true, blurb: 'Livro-razão em partida dobrada, razão por conta e balancete.' },
  { href: '/posicao/', label: 'Posição', modulo: 'core', grupo: 'Financeiro', topo: true, blurb: 'O que pagar e receber no intervalo e o fluxo de caixa com a sazonalidade.' },
  { href: '/custos/', label: 'Custo de produção', modulo: 'core', grupo: 'Financeiro', blurb: 'Custo real da @ e do litro, com rateio dos fixos e o resultado por atividade.' },
  { href: '/estoque/', label: 'Estoque', modulo: 'core', grupo: 'Gestão', blurb: 'Sal, ração, remédios e combustível, com custo médio e previsão de ruptura.' },
  { href: '/documentos/', label: 'Documentos', modulo: 'core', grupo: 'Gestão', blurb: 'GTA, nota do produtor, Funrural, CAR, ITR e CCIR com seus vencimentos.' },
  { href: '/equipe/', label: 'Equipe', modulo: 'core', grupo: 'Gestão', blurb: 'Quem anotou o quê. O conhecimento fica na fazenda quando o peão sai.' },
  { href: '/mercado/', label: 'Mercado', modulo: 'core', grupo: 'Gestão', blurb: 'Cotações do boi, do bezerro, do leite e do milho que importam para a sua operação.' },
  { href: '/corte/', label: 'Corte', modulo: 'corte', grupo: 'Módulos', topo: true, blurb: 'GMD, confinamento, reposição, frigoríficos, vender × segurar e confinar × pasto.' },
  { href: '/leite/', label: 'Leite', modulo: 'leite', grupo: 'Módulos', topo: true, blurb: 'Produção por vaca, CCS/CBT, mastite, reprodução e custo do litro.' },
  { href: '/genetica/', label: 'Genética', modulo: 'genetica', grupo: 'Módulos', topo: true, blurb: 'Genealogia, DEPs, acasalamento, IATF, botijão e catálogo de venda.' },
  { href: '/feira/', label: 'Feira', modulo: 'core', grupo: 'Sistema', blurb: 'Questionário do stand e lista de interessados para o piloto.' },
  { href: '/config/', label: 'Configurações', modulo: 'core', grupo: 'Sistema', blurb: 'Fazenda, módulos contratados, backup e sincronização.' },
];

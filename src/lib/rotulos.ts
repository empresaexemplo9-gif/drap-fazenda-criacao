import type { Atividade, Fase, TipoEvento, TipoSanitario, CategoriaInsumo, StatusAnimal, Pessoa } from './domain/types';

export const ROT_ATIVIDADE: Record<Atividade, string> = { corte: 'Corte', leite: 'Leite', genetica: 'Genética', geral: 'Geral (rateio)' };
export const ROT_FASE: Record<Fase, string> = {
  cria: 'Cria', recria: 'Recria', engorda: 'Engorda', confinamento: 'Confinamento', lactacao: 'Lactação', seca: 'Secas',
  reposicao: 'Reposição', reprodutores: 'Reprodutores', doadoras: 'Doadoras', receptoras: 'Receptoras',
};
export const ROT_EVENTO: Record<TipoEvento, string> = {
  sanitario: 'Sanitário', reprodutivo: 'Reprodutivo', pagamento: 'Pagamento', documento: 'Documento', manejo: 'Manejo',
  pastagem: 'Pastagem', estoque: 'Estoque', venda: 'Venda', geral: 'Geral',
};
export const TOM_EVENTO: Record<TipoEvento, 'leaf' | 'earth' | 'alert' | 'warn' | 'neutral' | 'ink'> = {
  sanitario: 'leaf', reprodutivo: 'earth', pagamento: 'ink', documento: 'warn', manejo: 'neutral', pastagem: 'leaf',
  estoque: 'warn', venda: 'earth', geral: 'neutral',
};
export const ROT_SANITARIO: Record<TipoSanitario, string> = {
  vacina: 'Vacina', vermifugo: 'Vermífugo', carrapaticida: 'Carrapaticida', antibiotico: 'Antibiótico',
  antiinflamatorio: 'Anti-inflamatório', hormonio: 'Hormônio', outro: 'Outro',
};
export const ROT_INSUMO: Record<CategoriaInsumo, string> = {
  sal_mineral: 'Sal mineral', racao: 'Ração e volumoso', medicamento: 'Medicamento', vacina: 'Vacina', semen: 'Sêmen',
  combustivel: 'Combustível', adubo: 'Adubo', semente: 'Semente', outro: 'Outro',
};
export const ROT_STATUS: Record<StatusAnimal, string> = {
  ativo: 'Ativo', vendido: 'Vendido', morto: 'Morto', desaparecido: 'Desaparecido', descartado: 'Descartado',
};
export const ROT_FUNCAO: Record<Pessoa['funcao'], string> = {
  proprietario: 'Proprietário', gerente: 'Gerente', vaqueiro: 'Vaqueiro', peao: 'Peão', ordenhador: 'Ordenhador(a)',
  veterinario: 'Veterinário', tecnico: 'Técnico',
};
export const ROT_INDICADOR = {
  boi_gordo: 'Boi gordo (R$/@)', vaca_gorda: 'Vaca gorda (R$/@)', bezerro: 'Bezerro (R$/cab)', leite: 'Leite (R$/L)',
  milho: 'Milho (R$/sc)', soja: 'Soja (R$/sc)',
} as const;

export const opcoes = <T extends string>(r: Record<T, string>) => (Object.keys(r) as T[]).map((k) => ({ value: k, label: r[k] }));

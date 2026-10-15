/**
 * Modelo de dados do DRAP Pecuária.
 *
 * Datas são strings ISO "AAAA-MM-DD" (como no DRAP Fazenda), valores em R$
 * são number com sinal explícito apenas no livro-razão (débito/crédito).
 * Todo registro guarda `por` (quem anotou) e `em` (quando), para que o
 * conhecimento do vaqueiro não se perca quando ele sai da fazenda.
 */

export type ISODate = string;
export type Id = string;

export type ModuloId = 'core' | 'corte' | 'leite' | 'genetica';
export type Atividade = 'corte' | 'leite' | 'genetica' | 'geral';

export interface Registro {
  id: Id;
  /** Pessoa que registrou (Pessoa.id). */
  por?: Id;
  /** Timestamp ISO de criação. */
  em?: string;
}

// ===================== FAZENDA =====================

export interface Fazenda {
  nome: string;
  municipio: string;
  uf: string;
  areaTotalHa: number;
  car?: string;
  ie?: string;
  /** Estado ainda vacina contra aftosa? (Brasil é livre sem vacinação desde 2025, conferir a regra estadual.) */
  vacinaAftosa: boolean;
  /** Raiva é endêmica na região (vacinação anual recomendada)? */
  raivaEndemica: boolean;
  /** Rendimento de carcaça padrão para simulações (%). */
  rendimentoCarcacaPct: number;
  /** Funrural pessoa física sobre receita bruta (%). */
  funruralPct: number;
}

// ===================== REBANHO =====================

export type Sexo = 'M' | 'F';
export type Categoria =
  | 'bezerro' | 'bezerra'
  | 'garrote' | 'novilha'
  | 'boi' | 'vaca' | 'touro';
export type StatusAnimal = 'ativo' | 'vendido' | 'morto' | 'desaparecido' | 'descartado';

export interface Animal extends Registro {
  brinco: string;
  rfid?: string;
  sisbov?: string;
  nome?: string;
  sexo: Sexo;
  raca: string;
  nascimento: ISODate;
  loteId?: Id;
  origem: 'nascido' | 'comprado';
  fornecedor?: string;
  dataEntrada?: ISODate;
  /** Preço de compra por cabeça (reposição). */
  valorCompra?: number;
  paiId?: Id;
  maeId?: Id;
  /** Identificação textual do pai quando é sêmen de central (sem cadastro). */
  paiExterno?: string;
  registroGenealogico?: string;
  status: StatusAnimal;
  dataSaida?: ISODate;
  obs?: string;
}

export type Fase =
  | 'cria' | 'recria' | 'engorda' | 'confinamento'
  | 'lactacao' | 'seca' | 'reposicao' | 'reprodutores' | 'doadoras' | 'receptoras';

export interface Lote extends Registro {
  nome: string;
  atividade: Atividade;
  fase: Fase;
  piqueteId?: Id;
  /** Contagem física da última conferência no curral, para conciliar. */
  contagemFisica?: { data: ISODate; cabecas: number };
}

export type StatusPiquete = 'ocupado' | 'descanso' | 'reforma' | 'degradado';

export interface Piquete extends Registro {
  nome: string;
  areaHa: number;
  forrageira: string;
  /** Capacidade de suporte estimada (UA/ha) na estação. */
  capacidadeUAha: number;
  status: StatusPiquete;
  /** Data em que entrou em descanso ou foi ocupado pela última vez. */
  desde: ISODate;
  diasDescansoAlvo: number;
  ultimaAdubacao?: ISODate;
  obs?: string;
}

export interface Pesagem extends Registro {
  animalId: Id;
  data: ISODate;
  pesoKg: number;
  metodo: 'balanca' | 'fita' | 'estimado';
  /** Escore de condição corporal 1–5 (opcional). */
  ecc?: number;
}

export interface Movimentacao extends Registro {
  data: ISODate;
  animalIds: Id[];
  deLoteId?: Id;
  paraLoteId?: Id;
  motivo: string;
}

/** Morte, roubo, desaparecimento: alimenta a conciliação cabeças reais x sistema. */
export interface Ocorrencia extends Registro {
  data: ISODate;
  animalId: Id;
  tipo: 'morte' | 'roubo' | 'desaparecimento' | 'descarte';
  causa: string;
}

// ===================== SANIDADE =====================

export type TipoSanitario =
  | 'vacina' | 'vermifugo' | 'carrapaticida' | 'antibiotico'
  | 'antiinflamatorio' | 'hormonio' | 'outro';

export interface AplicacaoSanitaria extends Registro {
  data: ISODate;
  tipo: TipoSanitario;
  produto: string;
  insumoId?: Id;
  /** Lote de fabricação do produto (rastreabilidade de vacina). */
  partida: string;
  validadePartida?: ISODate;
  animalIds: Id[];
  doseMl: number;
  carenciaCarneDias: number;
  carenciaLeiteDias: number;
  motivo?: string;
  responsavel?: string;
}

// ===================== ESTOQUE =====================

export type CategoriaInsumo =
  | 'sal_mineral' | 'racao' | 'medicamento' | 'vacina' | 'semen'
  | 'combustivel' | 'adubo' | 'semente' | 'outro';

export interface Insumo extends Registro {
  nome: string;
  categoria: CategoriaInsumo;
  unidade: string;
  estoqueMinimo: number;
  /** Consumo médio diário estimado, para prever ruptura. */
  consumoDiario: number;
  custoMedio: number;
}

export interface MovEstoque extends Registro {
  insumoId: Id;
  data: ISODate;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  valorUnitario?: number;
  destino?: string;
  loteId?: Id;
  nota?: string;
}

// ===================== LIVRO-RAZÃO =====================

/**
 * Plano de contas hierárquico de 3 níveis, como no DRAP Fazenda:
 * "4" > "4.2" > "4.2.03". Lançamentos só usam contas de nível 3.
 */
export type NaturezaConta = 'ativo' | 'passivo' | 'patrimonio' | 'receita' | 'despesa';

export interface Conta {
  codigo: string;
  nome: string;
  natureza: NaturezaConta;
  /** Despesa fixa (rateada) ou variável (direta do lote). Só para despesas. */
  comportamento?: 'fixo' | 'variavel';
}

export type FormaPgto = 'A PAGAR' | 'BOLETO' | 'TRANSFER' | 'PIX' | 'DINHEIRO' | 'CARTAO' | 'CREDITO RURAL';

/**
 * Lançamento em partida dobrada: cada lançamento debita uma conta e credita
 * outra pelo mesmo valor. Ex.: compra de sal a prazo:
 *   D 4.2.01 Sal mineral  /  C 2.1.01 Fornecedores a pagar.
 * O pagamento depois: D 2.1.01 Fornecedores  /  C 1.1.02 Banco.
 *
 * `vencimento` + `pagoEm` reproduzem a lógica de Posição do DRAP Fazenda:
 * pagoEm vazio = pendente.
 */
export interface Lancamento extends Registro {
  data: ISODate;
  historico: string;
  debito: string;
  credito: string;
  valor: number;
  atividade: Atividade;
  loteId?: Id;
  fornecedor?: string;
  nota?: string;
  formaPgto?: FormaPgto;
  vencimento?: ISODate;
  pagoEm?: ISODate;
  /** Safra pecuária (ano-safra jul→jun), ex. "SAFRA 26/27". */
  safra?: string;
  /** Previsão (orçamento) que ainda não aconteceu: entra no fluxo projetado, fora do balancete. */
  previsto?: boolean;
  /** Lançamento de baixa (pagamento/recebimento) do título `baixaDe`. */
  baixaDe?: Id;
}

// ===================== AGENDA / CALENDÁRIO =====================

export type TipoEvento =
  | 'sanitario' | 'reprodutivo' | 'pagamento' | 'documento'
  | 'manejo' | 'pastagem' | 'estoque' | 'venda' | 'geral';

export interface Evento extends Registro {
  titulo: string;
  data: ISODate;
  tipo: TipoEvento;
  concluido: boolean;
  obs?: string;
  loteId?: Id;
  animalIds?: Id[];
  /** Evento gerado por regra (calendário sanitário etc.): chave para não duplicar. */
  regra?: string;
}

// ===================== DOCUMENTOS =====================

export type TipoDocumento = 'GTA' | 'NF Produtor' | 'Funrural' | 'CAR' | 'ITR' | 'CCIR' | 'SISBOV' | 'Licença' | 'Outro';

export interface Documento extends Registro {
  tipo: TipoDocumento;
  numero: string;
  emissao: ISODate;
  vencimento?: ISODate;
  status: 'vigente' | 'pendente' | 'vencido' | 'cancelado';
  /** GTA: origem → destino, finalidade e quantidade. */
  origem?: string;
  destino?: string;
  finalidade?: string;
  quantidade?: number;
  animalIds?: Id[];
  valor?: number;
  obs?: string;
}

// ===================== PESSOAS =====================

export interface Pessoa extends Registro {
  nome: string;
  funcao: 'proprietario' | 'gerente' | 'vaqueiro' | 'peao' | 'ordenhador' | 'veterinario' | 'tecnico';
  telefone?: string;
  ativo: boolean;
  /** Turno de ordenha ou escala. */
  escala?: string;
}

// ===================== MERCADO =====================

export type Indicador = 'boi_gordo' | 'vaca_gorda' | 'bezerro' | 'leite' | 'milho' | 'soja';

export interface Cotacao extends Registro {
  data: ISODate;
  indicador: Indicador;
  /** R$/@ para boi/vaca, R$/cabeça bezerro, R$/litro leite, R$/saca grãos. */
  valor: number;
  fonte: string;
  praca?: string;
}

// ===================== MÓDULO CORTE =====================

export interface Dieta extends Registro {
  nome: string;
  /** Composição por kg de matéria natural. */
  ingredientes: { insumoId?: Id; nome: string; pct: number; custoKg: number }[];
  /** Consumo de matéria natural esperado (% do peso vivo). */
  consumoPctPV: number;
}

export interface LeituraCocho extends Registro {
  data: ISODate;
  loteId: Id;
  dietaId: Id;
  fornecidoKg: number;
  /** Nota de cocho 0 (limpo) a 4 (muita sobra). */
  nota: 0 | 1 | 2 | 3 | 4;
  sobraKg: number;
}

export interface VendaAbate extends Registro {
  data: ISODate;
  frigorifico: string;
  animalIds: Id[];
  pesoVivoTotalKg: number;
  pesoCarcacaTotalKg: number;
  precoArroba: number;
  bonificacoes: number;
  descontos: number;
  gta?: string;
}

// ===================== MÓDULO LEITE =====================

export interface Ordenha extends Registro {
  data: ISODate;
  animalId: Id;
  turno: 'manha' | 'tarde' | 'noite';
  litros: number;
  /** Leite descartado por carência/mastite. */
  descartado?: boolean;
}

export interface AnaliseLeite extends Registro {
  data: ISODate;
  /** Tanque (todo o rebanho) ou animal individual. */
  animalId?: Id;
  ccs: number; // mil células/mL
  cbt: number; // mil UFC/mL
  gordura: number; // %
  proteina: number; // %
  laticinio?: string;
}

export interface CasoMastite extends Registro {
  data: ISODate;
  animalId: Id;
  quarto: 'AE' | 'AD' | 'PE' | 'PD';
  grau: 'clinica_leve' | 'clinica_moderada' | 'clinica_grave' | 'subclinica';
  tratamento: string;
  carenciaDias: number;
  curadaEm?: ISODate;
}

export type TipoEventoReprodutivo =
  | 'cio' | 'cobertura' | 'ia' | 'iatf' | 'te' | 'diagnostico'
  | 'parto' | 'aborto' | 'secagem';

export interface EventoReprodutivo extends Registro {
  data: ISODate;
  animalId: Id;
  tipo: TipoEventoReprodutivo;
  /** Touro (animal), sêmen (texto) ou embrião usado. */
  touroId?: Id;
  semen?: string;
  resultado?: 'prenhe' | 'vazia';
  /** Protocolo IATF (nome) quando aplicável. */
  protocolo?: string;
  crias?: Id[];
  obs?: string;
}

/** Tabela de pagamento do laticínio: preço base + bonificação por qualidade. */
export interface TabelaLaticinio {
  laticinio: string;
  precoBase: number;
  bonusGorduraPorPonto: number; // R$/L por 0,1 p.p. acima de 3,0%
  bonusProteinaPorPonto: number; // R$/L por 0,1 p.p. acima de 2,9%
  faixasCcs: { ate: number; ajuste: number }[];
  faixasCbt: { ate: number; ajuste: number }[];
}

// ===================== MÓDULO GENÉTICA =====================

export interface AvaliacaoGenetica extends Registro {
  animalId: Id;
  programa: string; // PMGRN, ANCP, Geneplus, ABCZ...
  safra: string;
  /** DEPs por característica (ex.: PN, P120, P210, P365, P450, PE, AOL, EGS, MGT). */
  deps: Record<string, number>;
  acuracia?: number;
  indice?: number;
  /** Percentil TOP (%), ex. 1 = TOP 1%. */
  top?: number;
}

export interface ProvaDesempenho extends Registro {
  animalId: Id;
  data: ISODate;
  /** Grupo de contemporâneos (mesma época, manejo e sexo). */
  grupo: string;
  pesoKg?: number;
  ceCm?: number; // circunferência escrotal
  aolCm2?: number; // área de olho de lombo (ultrassom)
  egsMm?: number; // espessura de gordura subcutânea
  marmoreio?: number;
}

export interface EstoqueGenetico extends Registro {
  tipo: 'semen' | 'embriao';
  identificacao: string; // touro (nome/RGD) ou acasalamento do embrião
  touroId?: Id;
  central?: string;
  botijao: string;
  caneca: string;
  doses: number;
  custoDose: number;
  validade?: ISODate;
}

export interface Acasalamento extends Registro {
  vacaId: Id;
  touroId?: Id;
  semen?: string;
  meta: string;
  coeficienteF: number;
  status: 'planejado' | 'realizado' | 'cancelado';
}

export interface Anuncio extends Registro {
  animalId: Id;
  titulo: string;
  preco?: number;
  leilao?: string;
  dataLeilao?: ISODate;
  videoUrl?: string;
  publicado: boolean;
}

// ===================== FEIRA (validação) =====================

export interface Interessado extends Registro {
  nome: string;
  contato: string;
  municipio: string;
  operacao: ('corte' | 'leite' | 'genetica')[];
  cabecas: number;
  maiorDor: string;
  controleHoje: string;
  pagaHoje: string;
  aceitaPiloto: boolean;
  obs?: string;
}

// ===================== SINCRONIZAÇÃO =====================

export interface Pendente {
  id: Id;
  em: string;
  colecao: keyof Colecoes;
  op: 'upsert' | 'delete';
  registroId: Id;
}

export interface Colecoes {
  animais: Animal[];
  lotes: Lote[];
  piquetes: Piquete[];
  pesagens: Pesagem[];
  movimentacoes: Movimentacao[];
  ocorrencias: Ocorrencia[];
  sanidade: AplicacaoSanitaria[];
  insumos: Insumo[];
  movEstoque: MovEstoque[];
  lancamentos: Lancamento[];
  eventos: Evento[];
  documentos: Documento[];
  pessoas: Pessoa[];
  cotacoes: Cotacao[];
  dietas: Dieta[];
  leiturasCocho: LeituraCocho[];
  vendas: VendaAbate[];
  ordenhas: Ordenha[];
  analisesLeite: AnaliseLeite[];
  mastites: CasoMastite[];
  reproducao: EventoReprodutivo[];
  avaliacoes: AvaliacaoGenetica[];
  provas: ProvaDesempenho[];
  estoqueGenetico: EstoqueGenetico[];
  acasalamentos: Acasalamento[];
  anuncios: Anuncio[];
  interessados: Interessado[];
}

export interface Estado extends Colecoes {
  versao: number;
  fazenda: Fazenda;
  modulos: Record<ModuloId, boolean>;
  contas: Conta[];
  tabelaLaticinio: TabelaLaticinio;
  /** Pessoa que está usando o aparelho agora (assina os registros). */
  operadorId?: Id;
  pendentes: Pendente[];
  ultimaSincronizacao?: string;
}

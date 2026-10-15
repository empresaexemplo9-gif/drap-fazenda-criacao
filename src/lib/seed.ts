/**
 * Fazenda de demonstração. Gera ~250 animais com histórico coerente
 * (pesagens, sanidade, ordenhas, reprodução, livro-razão) relativo a `hoje`,
 * para a demo da feira e para a revisão sem precisar digitar nada.
 *
 * Nomes de pessoas, fornecedores e frigoríficos são fictícios.
 */

import { addDias, addMeses, safraDe } from './datas';
import { atividadesAtivas } from './domain/modulos';
import { uaDe, pesoAtual, indexarPesagens } from './domain/rebanho';
import { PLANO_PADRAO, CONTA_BANCO, CONTA_FORNECEDORES, CONTA_CLIENTES } from './domain/livro-razao';
import type {
  Animal, Estado, Lote, Piquete, Pesagem, AplicacaoSanitaria, Insumo, MovEstoque, Lancamento,
  Evento, Pessoa, Cotacao, Dieta, LeituraCocho, VendaAbate, Ordenha, AnaliseLeite,
  CasoMastite, EventoReprodutivo, AvaliacaoGenetica, ProvaDesempenho, Acasalamento,
  Anuncio, Atividade, Fase, Sexo, ISODate, Ocorrencia, ModuloId, Id,
} from './domain/types';

export const VERSAO_ESTADO = 1;

/** PRNG determinístico (mulberry32) para a demo ser igual em todo aparelho. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function estadoVazio(): Estado {
  return {
    versao: VERSAO_ESTADO,
    fazenda: {
      nome: 'Minha fazenda', municipio: '', uf: 'GO', areaTotalHa: 0,
      vacinaAftosa: false, raivaEndemica: true, rendimentoCarcacaPct: 52, funruralPct: 1.5,
    },
    modulos: { core: true, corte: true, leite: false, genetica: false },
    contas: PLANO_PADRAO,
    tabelaLaticinio: tabelaPadrao(),
    pendentes: [],
    animais: [], lotes: [], piquetes: [], pesagens: [], movimentacoes: [], ocorrencias: [], sanidade: [],
    insumos: [], movEstoque: [], lancamentos: [], eventos: [], documentos: [], pessoas: [], cotacoes: [],
    dietas: [], leiturasCocho: [], vendas: [], ordenhas: [], analisesLeite: [], mastites: [], reproducao: [],
    avaliacoes: [], provas: [], estoqueGenetico: [], acasalamentos: [], anuncios: [], interessados: [],
  };
}

function tabelaPadrao() {
  return {
    laticinio: 'Laticínio Vale do Rio',
    precoBase: 2.45,
    bonusGorduraPorPonto: 0.01,
    bonusProteinaPorPonto: 0.015,
    faixasCcs: [{ ate: 200, ajuste: 0.05 }, { ate: 400, ajuste: 0.02 }, { ate: 500, ajuste: 0 }, { ate: 99999, ajuste: -0.08 }],
    faixasCbt: [{ ate: 50, ajuste: 0.04 }, { ate: 100, ajuste: 0.02 }, { ate: 300, ajuste: 0 }, { ate: 99999, ajuste: -0.1 }],
  };
}

/**
 * Demo completa (corte + leite + genética) recortada para as atividades do
 * perfil escolhido. Sem `modulos`, devolve a fazenda completa.
 */
export function estadoDemo(hoje: ISODate, modulos?: Record<ModuloId, boolean>): Estado {
  const completo = demoCompleta(hoje);
  return modulos ? recortarPorModulos(completo, modulos) : completo;
}

function demoCompleta(hoje: ISODate): Estado {
  const r = rng(20261015);
  const between = (a: number, b: number) => a + (b - a) * r();
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  let seq = 0;
  const id = (p: string) => `${p}${(++seq).toString(36).padStart(4, '0')}`;
  const em = `${hoje}T07:00:00.000Z`;

  const e = estadoVazio();
  e.fazenda = {
    nome: 'Fazenda Boa Vista', municipio: 'Rio Verde', uf: 'GO', areaTotalHa: 1240,
    car: 'GO-5218805-8F2A.71C3.94B0.4E1D.A6B2.0C5F.3D97.E8A1', ie: '10.987.654-3',
    vacinaAftosa: false, raivaEndemica: true, rendimentoCarcacaPct: 52, funruralPct: 1.5,
  };
  e.modulos = { core: true, corte: true, leite: true, genetica: true };

  // ---------------- Pessoas ----------------
  const pessoas: Pessoa[] = [
    { id: id('p'), nome: 'Antônio Ribeiro', funcao: 'proprietario', telefone: '(64) 99999-0001', ativo: true, em },
    { id: id('p'), nome: 'João Batista', funcao: 'gerente', telefone: '(64) 99999-0002', ativo: true, em },
    { id: id('p'), nome: 'Zé Carlos', funcao: 'vaqueiro', telefone: '(64) 99999-0003', ativo: true, em },
    { id: id('p'), nome: 'Tião', funcao: 'peao', ativo: true, em },
    { id: id('p'), nome: 'Maria Aparecida', funcao: 'ordenhador', ativo: true, escala: 'Ordenha 5h e 15h', em },
    { id: id('p'), nome: 'Dr. Paulo Mendes', funcao: 'veterinario', telefone: '(64) 99999-0006', ativo: true, em },
  ];
  e.pessoas = pessoas;
  const [dono, gerente, vaqueiro, peao, ordenhadora, vet] = pessoas;
  e.operadorId = gerente.id;

  // ---------------- Piquetes ----------------
  const pqs: [string, number, string, number][] = [
    ['Piquete 1 · Retiro', 48, 'Brachiaria brizantha (Marandu)', 2.2],
    ['Piquete 2 · Córrego', 52, 'Brachiaria brizantha (Marandu)', 2.2],
    ['Piquete 3 · Sede', 36, 'Panicum (Mombaça)', 3.5],
    ['Piquete 4 · Mata', 60, 'Brachiaria decumbens', 1.6],
    ['Piquete 5 · Aroeira', 44, 'Panicum (Mombaça)', 3.5],
    ['Piquete 6 · Baixada', 40, 'Brachiaria humidicola', 1.4],
    ['Piquete 7 · Leite', 24, 'Tifton 85 irrigado', 5],
    ['Piquete 8 · Maternidade', 18, 'Panicum (Mombaça)', 3.0],
    ['Piquete 9 · PO', 30, 'Brachiaria brizantha (Piatã)', 2.4],
    ['Piquete 10 · Reforma', 55, 'Brachiaria brizantha (Marandu)', 2.0],
  ];
  e.piquetes = pqs.map(([nome, areaHa, forrageira, cap], i): Piquete => ({
    id: id('pq'), nome, areaHa, forrageira, capacidadeUAha: cap,
    status: i === 9 ? 'reforma' : i === 3 ? 'descanso' : i === 5 ? 'descanso' : 'ocupado',
    desde: addDias(hoje, -[12, 20, 8, 22, 5, 41, 60, 15, 30, 70][i]),
    diasDescansoAlvo: forrageira.includes('Mombaça') ? 30 : 35,
    ultimaAdubacao: i % 3 === 0 ? addDias(hoje, -int(60, 200)) : undefined,
    obs: i === 9 ? 'Pasto degradado, com reforma em andamento: calagem feita e plantio previsto nas águas.' : undefined,
    em,
  }));
  const pq = e.piquetes;

  // ---------------- Lotes ----------------
  const mkLote = (nome: string, atividade: Atividade, fase: Fase, piqueteId?: string): Lote => ({ id: id('l'), nome, atividade, fase, piqueteId, em });
  const L = {
    recria: mkLote('Recria Nelore · R1', 'corte', 'recria', pq[0].id),
    engorda: mkLote('Engorda a pasto · E1', 'corte', 'engorda', pq[1].id),
    conf: mkLote('Confinamento · C1', 'corte', 'confinamento'),
    matrizes: mkLote('Cria · Matrizes Nelore', 'corte', 'cria', pq[2].id),
    lactacao: mkLote('Leite · Lactação A', 'leite', 'lactacao', pq[6].id),
    secas: mkLote('Leite · Secas e pré-parto', 'leite', 'seca', pq[7].id),
    bezerras: mkLote('Leite · Bezerras e novilhas', 'leite', 'reposicao', pq[4].id),
    doadoras: mkLote('PO · Doadoras', 'genetica', 'doadoras', pq[8].id),
    touros: mkLote('PO · Touros', 'genetica', 'reprodutores', pq[8].id),
    prova: mkLote('PO · Tourinhos em prova', 'genetica', 'recria', pq[4].id),
  };
  e.lotes = Object.values(L);

  // ---------------- Animais ----------------
  const animais: Animal[] = [];
  const pesagens: Pesagem[] = [];
  let brinco = 1000;
  const fornecedoresRep = [
    { nome: 'Agropecuária Santa Rita', gmdMod: 1.08, preco: 3150 },
    { nome: 'Leilão Regional Rio Verde', gmdMod: 0.9, preco: 2850 },
    { nome: 'Fazenda Três Barras', gmdMod: 1.0, preco: 3000 },
  ];

  /** Cria animal com série de pesagens a cada ~60 dias. */
  const mk = (o: {
    sexo: Sexo; raca: string; idadeDias: number; lote: Lote; pesoHoje: number; gmd: number;
    origem?: 'nascido' | 'comprado'; fornecedor?: string; valorCompra?: number; entradaDias?: number;
    nome?: string; rgd?: string; paiId?: string; maeId?: string; paiExterno?: string; semPesagem?: boolean;
  }): Animal => {
    const a: Animal = {
      id: id('a'), brinco: String(++brinco), rfid: `982 0000${String(brinco).padStart(8, '0')}`,
      sexo: o.sexo, raca: o.raca, nascimento: addDias(hoje, -o.idadeDias), loteId: o.lote.id,
      origem: o.origem ?? 'nascido', fornecedor: o.fornecedor, valorCompra: o.valorCompra,
      dataEntrada: o.entradaDias != null ? addDias(hoje, -o.entradaDias) : addDias(hoje, -o.idadeDias),
      nome: o.nome, registroGenealogico: o.rgd, paiId: o.paiId, maeId: o.maeId, paiExterno: o.paiExterno,
      status: 'ativo', por: vaqueiro.id, em,
    };
    animais.push(a);
    if (!o.semPesagem) {
      const maxDias = Math.min(o.entradaDias ?? o.idadeDias, 240);
      for (let d = Math.floor(maxDias / 60) * 60; d >= 0; d -= 60) {
        const dia = d === 0 ? int(0, 6) : d + int(-3, 3);
        const peso = Math.max(30, o.pesoHoje - o.gmd * dia + between(-6, 6));
        pesagens.push({ id: id('w'), animalId: a.id, data: addDias(hoje, -dia), pesoKg: Math.round(peso), metodo: 'balanca', por: vaqueiro.id, em });
      }
    }
    return a;
  };

  // Corte: recria (comprados, 3 fornecedores)
  for (let i = 0; i < 42; i++) {
    const f = fornecedoresRep[i % 3];
    mk({ sexo: 'M', raca: 'Nelore', idadeDias: int(330, 420), lote: L.recria, pesoHoje: between(300, 345), gmd: 0.55 * f.gmdMod * between(0.85, 1.15), origem: 'comprado', fornecedor: f.nome, valorCompra: Math.round(f.preco * between(0.95, 1.05)), entradaDias: 190 });
  }
  // Engorda a pasto
  for (let i = 0; i < 36; i++) mk({ sexo: 'M', raca: pick(['Nelore', 'Nelore', 'Nelore x Angus']), idadeDias: int(700, 820), lote: L.engorda, pesoHoje: between(440, 500), gmd: between(0.55, 0.8) });
  // Confinamento (entrou há 62 dias)
  for (let i = 0; i < 48; i++) mk({ sexo: 'M', raca: pick(['Nelore', 'Nelore x Angus']), idadeDias: int(680, 760), lote: L.conf, pesoHoje: between(500, 560), gmd: between(1.35, 1.75), entradaDias: 62 });
  // Matrizes Nelore e bezerros ao pé
  const touroCorte = 'Sêmen · REM Fortaleza (central)';
  const matrizes: Animal[] = [];
  for (let i = 0; i < 58; i++) matrizes.push(mk({ sexo: 'F', raca: 'Nelore', idadeDias: int(1300, 3000), lote: L.matrizes, pesoHoje: between(420, 480), gmd: 0.05 }));
  const bezerrosCorte: Animal[] = [];
  for (let i = 0; i < 26; i++) {
    const mae = matrizes[i];
    const sexo: Sexo = i % 2 ? 'F' : 'M';
    // algumas bezerras com 3–7 meses para cair na janela da brucelose
    const idade = sexo === 'F' && i < 12 ? int(95, 210) : int(150, 230);
    bezerrosCorte.push(mk({ sexo, raca: 'Nelore', idadeDias: idade, lote: L.matrizes, pesoHoje: 40 + idade * 0.78, gmd: 0.78, maeId: mae.id, paiExterno: touroCorte }));
  }

  // Leite: Girolando
  const vacasLeite: Animal[] = [];
  for (let i = 0; i < 22; i++) vacasLeite.push(mk({ sexo: 'F', raca: pick(['Girolando 3/4', 'Girolando 5/8', 'Girolando 1/2']), idadeDias: int(1200, 2900), lote: L.lactacao, pesoHoje: between(480, 580), gmd: 0.02, nome: pick(['Mimosa', 'Estrela', 'Pintada', 'Formosa', 'Malhada', 'Boneca', 'Princesa', 'Jabuticaba', 'Cereja', 'Lua']) }));
  const secas: Animal[] = [];
  for (let i = 0; i < 6; i++) secas.push(mk({ sexo: 'F', raca: 'Girolando 3/4', idadeDias: int(1400, 2600), lote: L.secas, pesoHoje: between(520, 600), gmd: 0.1 }));
  for (let i = 0; i < 9; i++) mk({ sexo: 'F', raca: 'Girolando 3/4', idadeDias: int(100, 600), lote: L.bezerras, pesoHoje: between(110, 330), gmd: 0.62, maeId: vacasLeite[i].id, paiExterno: 'Sêmen · Gir Leiteiro (central)' });

  // Genética: Nelore PO
  const avos = [
    mk({ sexo: 'M', raca: 'Nelore PO', idadeDias: 4200, lote: L.touros, pesoHoje: 900, gmd: 0, nome: 'Imperador da Boa Vista', rgd: 'RGD BV 1001', semPesagem: true }),
    mk({ sexo: 'F', raca: 'Nelore PO', idadeDias: 3900, lote: L.doadoras, pesoHoje: 560, gmd: 0, nome: 'Rainha da Boa Vista', rgd: 'RGD BV 1002', semPesagem: true }),
  ];
  const t1 = mk({ sexo: 'M', raca: 'Nelore PO', idadeDias: 2300, lote: L.touros, pesoHoje: 860, gmd: 0.05, nome: 'Barão da Boa Vista', rgd: 'RGD BV 1210', paiId: avos[0].id, maeId: avos[1].id });
  const t2 = mk({ sexo: 'M', raca: 'Nelore PO', idadeDias: 1900, lote: L.touros, pesoHoje: 820, gmd: 0.05, nome: 'Jequitibá da Boa Vista', rgd: 'RGD BV 1305', paiExterno: 'Sêmen · Nelore TOP (central)' });
  const doadoras: Animal[] = [];
  for (let i = 0; i < 7; i++) doadoras.push(mk({
    sexo: 'F', raca: 'Nelore PO', idadeDias: int(1500, 2900), lote: L.doadoras, pesoHoje: between(500, 580), gmd: 0.02,
    nome: ['Duquesa', 'Baronesa', 'Condessa', 'Princesa', 'Marquesa', 'Viscondessa', 'Imperatriz'][i] + ' da Boa Vista',
    rgd: `RGD BV ${1400 + i}`, paiId: i < 3 ? avos[0].id : undefined, maeId: i < 2 ? avos[1].id : undefined,
    paiExterno: i >= 3 ? 'Sêmen · Nelore TOP (central)' : undefined,
  }));
  const tourinhos: Animal[] = [];
  for (let i = 0; i < 12; i++) tourinhos.push(mk({
    sexo: 'M', raca: 'Nelore PO', idadeDias: int(520, 600), lote: L.prova, pesoHoje: between(380, 460), gmd: between(0.6, 0.85),
    nome: `Tourinho ${['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'][i]} da Boa Vista`, rgd: `RGN BV ${2100 + i}`,
    paiId: i % 2 ? t1.id : t2.id, maeId: doadoras[i % doadoras.length].id,
  }));

  // Histórico: vendidos e mortos (alimenta desfrute, conciliação e venda por frigorífico)
  const vendidos: Animal[] = [];
  for (let i = 0; i < 40; i++) {
    const a = mk({ sexo: 'M', raca: 'Nelore', idadeDias: int(760, 900), lote: L.engorda, pesoHoje: between(520, 560), gmd: 0.65, semPesagem: true });
    a.status = 'vendido';
    a.dataSaida = addDias(hoje, i < 22 ? -75 : -150);
    a.loteId = undefined;
    vendidos.push(a);
  }
  const ocorrencias: Ocorrencia[] = [];
  const morto = mk({ sexo: 'M', raca: 'Nelore', idadeDias: 360, lote: L.recria, pesoHoje: 290, gmd: 0.5, origem: 'comprado', fornecedor: fornecedoresRep[1].nome, valorCompra: 2850, entradaDias: 190 });
  morto.status = 'morto'; morto.dataSaida = addDias(hoje, -33);
  ocorrencias.push({ id: id('o'), data: morto.dataSaida, animalId: morto.id, tipo: 'morte', causa: 'Picada de cobra (laudo do veterinário)', por: vaqueiro.id, em });

  e.animais = animais;
  e.pesagens = pesagens;
  e.ocorrencias = ocorrencias;
  // contagens físicas: recria com 1 cabeça a menos (desaparecimento em apuração)
  L.recria.contagemFisica = { data: addDias(hoje, -3), cabecas: 41 };
  L.engorda.contagemFisica = { data: addDias(hoje, -3), cabecas: 36 };
  L.conf.contagemFisica = { data: addDias(hoje, -1), cabecas: 48 };

  // ---------------- Sanidade ----------------
  const ids = (xs: Animal[]) => xs.map((a) => a.id);
  const ativosCorte = animais.filter((a) => a.status === 'ativo');
  e.sanidade = [
    { id: id('s'), data: addDias(hoje, -330), tipo: 'vacina', produto: 'Polivalente clostridioses', partida: 'CL-2508-114', validadePartida: addDias(hoje, 200), animalIds: ids(ativosCorte), doseMl: 5, carenciaCarneDias: 21, carenciaLeiteDias: 0, responsavel: vet.nome, por: vaqueiro.id, em },
    { id: id('s'), data: addDias(hoje, -350), tipo: 'vacina', produto: 'Raiva (vírus inativado)', partida: 'RV-2507-022', animalIds: ids(ativosCorte), doseMl: 2, carenciaCarneDias: 21, carenciaLeiteDias: 0, responsavel: vet.nome, por: vaqueiro.id, em },
    { id: id('s'), data: addDias(hoje, -60), tipo: 'vermifugo', produto: 'Ivermectina 3,15%', partida: 'IV-2603-551', animalIds: ids([...animais.filter((a) => a.loteId === L.recria.id), ...tourinhos]), doseMl: 1, carenciaCarneDias: 122, carenciaLeiteDias: 0, motivo: 'Vermifugação estratégica (julho)', responsavel: vaqueiro.nome, por: vaqueiro.id, em },
    { id: id('s'), data: addDias(hoje, -20), tipo: 'carrapaticida', produto: 'Fluazuron pour-on', partida: 'FZ-2604-090', animalIds: ids(animais.filter((a) => a.loteId === L.engorda.id)), doseMl: 30, carenciaCarneDias: 42, carenciaLeiteDias: 0, responsavel: vaqueiro.nome, por: vaqueiro.id, em },
    { id: id('s'), data: addDias(hoje, -2), tipo: 'antibiotico', produto: 'Oxitetraciclina LA', partida: 'OX-2605-321', animalIds: [vacasLeite[3].id, vacasLeite[8].id], doseMl: 25, carenciaCarneDias: 28, carenciaLeiteDias: 4, motivo: 'Mastite clínica', responsavel: vet.nome, por: ordenhadora.id, em },
    { id: id('s'), data: addDias(hoje, -150), tipo: 'vacina', produto: 'Brucelose B19', partida: 'B19-2511-007', animalIds: ids(bezerrosCorte.filter((a) => a.sexo === 'F').slice(8)), doseMl: 2, carenciaCarneDias: 0, carenciaLeiteDias: 0, responsavel: vet.nome, por: vet.id, em },
  ] satisfies AplicacaoSanitaria[];

  // ---------------- Estoque ----------------
  const ins = (nome: string, categoria: Insumo['categoria'], unidade: string, min: number, consumo: number, custo: number): Insumo =>
    ({ id: id('i'), nome, categoria, unidade, estoqueMinimo: min, consumoDiario: consumo, custoMedio: custo, em });
  const I = {
    sal: ins('Sal mineral 80P', 'sal_mineral', 'kg', 1500, 62, 3.6),
    proteinado: ins('Proteinado seca 40%', 'sal_mineral', 'kg', 2000, 180, 2.4),
    racao: ins('Ração dieta total confinamento', 'racao', 'kg', 15000, 1150, 1.15),
    concentrado: ins('Concentrado vacas em lactação', 'racao', 'kg', 1500, 160, 2.05),
    silagem: ins('Silagem de milho', 'racao', 'kg', 30000, 1400, 0.32),
    vacina: ins('Vacina polivalente clostridioses', 'vacina', 'dose', 100, 0, 1.9),
    ivermec: ins('Ivermectina 3,15%', 'medicamento', 'mL', 500, 4, 0.42),
    oxitetra: ins('Oxitetraciclina LA', 'medicamento', 'mL', 250, 2, 0.6),
    diesel: ins('Diesel S10', 'combustivel', 'L', 400, 38, 6.29),
  };
  e.insumos = Object.values(I);
  const mov = (insumo: Insumo, dias: number, tipo: MovEstoque['tipo'], q: number, vu?: number, nota?: string): MovEstoque =>
    ({ id: id('m'), insumoId: insumo.id, data: addDias(hoje, -dias), tipo, quantidade: q, valorUnitario: vu, nota, por: gerente.id, em });
  e.movEstoque = [
    mov(I.sal, 90, 'entrada', 6000, 3.55, '48211'), mov(I.sal, 60, 'saida', 1900), mov(I.sal, 30, 'saida', 1850), mov(I.sal, 5, 'saida', 400),
    mov(I.proteinado, 75, 'entrada', 12000, 2.35, '48390'), mov(I.proteinado, 40, 'saida', 5400), mov(I.proteinado, 10, 'saida', 4800),
    mov(I.racao, 62, 'entrada', 40000, 1.12, '155101'), mov(I.racao, 31, 'entrada', 36000, 1.16, '155307'), mov(I.racao, 31, 'saida', 35000), mov(I.racao, 1, 'saida', 28000),
    mov(I.concentrado, 30, 'entrada', 5000, 2.05, '7781'), mov(I.concentrado, 1, 'saida', 4200),
    mov(I.silagem, 200, 'entrada', 420000, 0.3, 'Produção própria'), mov(I.silagem, 1, 'saida', 260000),
    mov(I.vacina, 340, 'entrada', 400, 1.9), mov(I.vacina, 330, 'saida', 260),
    mov(I.ivermec, 70, 'entrada', 1000, 0.42), mov(I.ivermec, 60, 'saida', 520),
    mov(I.oxitetra, 50, 'entrada', 500, 0.6), mov(I.oxitetra, 2, 'saida', 50),
    mov(I.diesel, 25, 'entrada', 2000, 6.29, '99810'), mov(I.diesel, 1, 'saida', 1050),
  ];

  // ---------------- Livro-razão ----------------
  const lanc: Lancamento[] = [];
  const L_ = (o: Omit<Lancamento, 'id' | 'safra' | 'em'> & { safra?: string }) => {
    const l: Lancamento = { ...o, id: id('f'), safra: o.safra ?? safraDe(o.data), em, por: o.por ?? gerente.id };
    lanc.push(l);
    return l;
  };
  const d = (dias: number) => addDias(hoje, dias);
  // capital inicial e crédito rural
  L_({ data: d(-230), historico: 'Saldo inicial de abertura do livro', debito: CONTA_BANCO, credito: '3.1.01', valor: 850000, atividade: 'geral' });
  L_({ data: d(-180), historico: 'Liberação custeio pecuário · Banco do Produtor', debito: CONTA_BANCO, credito: '2.2.01', valor: 400000, atividade: 'corte', formaPgto: 'CREDITO RURAL' });
  // reposição comprada
  for (const f of fornecedoresRep) {
    const animaisF = animais.filter((a) => a.fornecedor === f.nome);
    const valor = animaisF.reduce((s, a) => s + (a.valorCompra ?? 0), 0);
    L_({ data: d(-190), historico: `Compra de ${animaisF.length} garrotes · ${f.nome}`, debito: '5.1.05', credito: CONTA_BANCO, valor, atividade: 'corte', loteId: L.recria.id, fornecedor: f.nome, formaPgto: 'TRANSFER' });
  }
  // mensais (6 meses)
  for (let m = 6; m >= 0; m--) {
    const base = addMeses(hoje, -m).slice(0, 8);
    const dia = (n: number) => `${base}${String(n).padStart(2, '0')}`;
    if (dia(5) <= hoje) {
      L_({ data: dia(5), historico: 'Folha de pagamento e encargos', debito: '5.2.01', credito: CONTA_BANCO, valor: 11000, atividade: 'geral', formaPgto: 'TRANSFER' });
      L_({ data: dia(10), historico: 'Energia elétrica · ordenha e resfriador', debito: '5.2.04', credito: CONTA_BANCO, valor: Math.round(between(2600, 3300) * 100) / 100, atividade: 'leite', fornecedor: 'Energia Rural', formaPgto: 'BOLETO' });
      L_({ data: dia(12), historico: 'Diesel S10 · tratores e vagão', debito: '5.2.02', credito: CONTA_BANCO, valor: Math.round(between(5500, 7500) * 100) / 100, atividade: 'geral', fornecedor: 'Posto Rodovia', formaPgto: 'PIX' });
      L_({ data: dia(15), historico: 'Sal mineral e proteinado', debito: '5.1.01', credito: CONTA_BANCO, valor: Math.round(between(9000, 12000) * 100) / 100, atividade: 'corte', fornecedor: 'Nutrição Cerrado', formaPgto: 'BOLETO' });
      L_({ data: dia(18), historico: 'Concentrado vacas em lactação', debito: '5.1.02', credito: CONTA_BANCO, valor: Math.round(between(9000, 11000) * 100) / 100, atividade: 'leite', loteId: L.lactacao.id, fornecedor: 'Nutrição Cerrado', formaPgto: 'BOLETO' });
      L_({ data: dia(20), historico: 'Assistência veterinária mensal', debito: '5.2.06', credito: CONTA_BANCO, valor: 3500, atividade: 'geral', fornecedor: 'Dr. Paulo Mendes', formaPgto: 'PIX' });
      L_({ data: dia(28), historico: 'Depreciação mensal de máquinas e benfeitorias', debito: '5.2.07', credito: '1.3.01', valor: 2800, atividade: 'geral' });
    }
    if (m >= 1 && dia(8) <= hoje) {
      const litros = Math.round(between(10500, 12500));
      L_({ data: dia(8), historico: `Venda de leite · ${litros.toLocaleString('pt-BR')} L · ${e.tabelaLaticinio.laticinio}`, debito: CONTA_BANCO, credito: '4.1.03', valor: Math.round(litros * between(2.48, 2.62) * 100) / 100, atividade: 'leite', fornecedor: e.tabelaLaticinio.laticinio, formaPgto: 'TRANSFER' });
    }
  }
  // confinamento: ração a prazo (2 notas, uma vence hoje — "pagamentos do dia")
  L_({ data: d(-62), historico: 'Ração dieta total · NF 155101', debito: '5.1.02', credito: CONTA_BANCO, valor: 24800, atividade: 'corte', loteId: L.conf.id, fornecedor: 'Cereal Rações', nota: '155101', formaPgto: 'BOLETO' });
  L_({ data: d(-31), historico: 'Ração dieta total · NF 155307', debito: '5.1.02', credito: CONTA_FORNECEDORES, valor: 26150, atividade: 'corte', loteId: L.conf.id, fornecedor: 'Cereal Rações', nota: '155307', formaPgto: 'A PAGAR', vencimento: hoje });
  L_({ data: d(-4), historico: 'Óleo 20W50 e filtros · NF 264454', debito: '5.2.03', credito: CONTA_FORNECEDORES, valor: 160.46, atividade: 'geral', fornecedor: 'Casa do Fazendeiro', nota: '264454', formaPgto: 'A PAGAR', vencimento: hoje });
  L_({ data: d(-6), historico: 'Medicamentos · NF 88120', debito: '5.1.03', credito: CONTA_FORNECEDORES, valor: 2380.9, atividade: 'geral', fornecedor: 'Agrovet Rio Verde', nota: '88120', formaPgto: 'A PAGAR', vencimento: d(-1) });
  L_({ data: d(-2), historico: 'Silagem: frete do milho', debito: '5.1.07', credito: CONTA_FORNECEDORES, valor: 6400, atividade: 'leite', fornecedor: 'Transportes JR', formaPgto: 'A PAGAR', vencimento: d(9) });
  L_({ data: d(-10), historico: 'Sêmen sexado · 40 doses', debito: '5.1.04', credito: CONTA_FORNECEDORES, valor: 6800, atividade: 'leite', fornecedor: 'Central Genética Brasil', formaPgto: 'A PAGAR', vencimento: d(20) });
  L_({ data: d(-1), historico: 'Adubação de cobertura · Piquetes 3 e 5', debito: '5.2.05', credito: CONTA_FORNECEDORES, valor: 12400, atividade: 'geral', fornecedor: 'Fertilizantes Goiás', formaPgto: 'A PAGAR', vencimento: d(27) });
  L_({ data: d(-3), historico: 'Juros e parcela do custeio pecuário', debito: '5.3.03', credito: '2.1.01', valor: 9600, atividade: 'corte', fornecedor: 'Banco do Produtor', formaPgto: 'A PAGAR', vencimento: d(45) });
  L_({ data: d(-40), historico: 'ITR 2026 · cota única', debito: '5.3.02', credito: CONTA_BANCO, valor: 4120, atividade: 'geral', formaPgto: 'BOLETO' });

  // vendas para frigorífico (receita + Funrural)
  const vendas: VendaAbate[] = [];
  const frigs = [
    { nome: 'Frigorífico Vale Verde', dias: 75, preco: 312, idx: [0, 22] as const, bon: 1.5 },
    { nome: 'Frigorífico Serra Azul', dias: 150, preco: 298, idx: [22, 40] as const, bon: 0 },
  ];
  for (const f of frigs) {
    const lote = vendidos.slice(f.idx[0], f.idx[1]);
    const pv = lote.length * between(530, 555);
    const rend = between(51.5, 54);
    const pc = pv * (rend / 100);
    const v: VendaAbate = {
      id: id('v'), data: d(-f.dias), frigorifico: f.nome, animalIds: ids(lote), pesoVivoTotalKg: Math.round(pv),
      pesoCarcacaTotalKg: Math.round(pc), precoArroba: f.preco, bonificacoes: Math.round((pc / 15) * f.bon), descontos: 0,
      gta: `GO-${int(100000, 999999)}`, por: gerente.id, em,
    };
    vendas.push(v);
    const bruto = (v.pesoCarcacaTotalKg / 15) * v.precoArroba + v.bonificacoes;
    L_({ data: v.data, historico: `Venda de ${lote.length} bois gordos · ${f.nome}`, debito: CONTA_CLIENTES, credito: '4.1.01', valor: Math.round(bruto * 100) / 100, atividade: 'corte', fornecedor: f.nome, vencimento: addDias(v.data, 30), pagoEm: addDias(v.data, 30), nota: v.gta });
    const receb = lanc[lanc.length - 1];
    L_({ data: addDias(v.data, 30), historico: `Recebimento · ${receb.historico}`, debito: CONTA_BANCO, credito: CONTA_CLIENTES, valor: receb.valor, atividade: 'corte', baixaDe: receb.id });
    L_({ data: v.data, historico: `Funrural sobre venda · ${f.nome}`, debito: '5.3.01', credito: CONTA_BANCO, valor: Math.round(bruto * 0.015 * 100) / 100, atividade: 'corte' });
  }
  e.vendas = vendas;
  // venda de tourinhos PO a receber
  L_({ data: d(-12), historico: 'Venda de 2 touros PO · Leilão Elite Cerrado', debito: CONTA_CLIENTES, credito: '4.1.04', valor: 46000, atividade: 'genetica', fornecedor: 'Leilão Elite Cerrado', formaPgto: 'A PAGAR', vencimento: d(18) });
  // previsões (orçamento): saída do confinamento e reposição
  L_({ data: d(28), historico: 'Previsão: venda do confinamento C1 (48 bois)', debito: CONTA_CLIENTES, credito: '4.1.01', valor: 48 * 19.6 * 318, atividade: 'corte', previsto: true });
  L_({ data: d(40), historico: 'Previsão: reposição de 60 garrotes', debito: '5.1.05', credito: CONTA_BANCO, valor: 60 * 3100, atividade: 'corte', previsto: true });
  L_({ data: d(60), historico: 'Previsão: ração confinamento 2º giro', debito: '5.1.02', credito: CONTA_BANCO, valor: 88000, atividade: 'corte', previsto: true });
  e.lancamentos = lanc;

  // ---------------- Agenda ----------------
  const ev = (titulo: string, dias: number, tipo: Evento['tipo'], obs?: string, concluido = false): Evento =>
    ({ id: id('e'), titulo, data: d(dias), tipo, concluido, obs, por: gerente.id, em });
  e.eventos = [
    ev('Pesagem do confinamento C1 (saída prevista)', 3, 'manejo', 'Separar os mais pesados para o primeiro embarque.'),
    ev('Visita do técnico: avaliação de pastagem', 6, 'pastagem'),
    ev('Conferência de cabeças: lote R1 (1 a menos)', 1, 'manejo', 'Contagem física deu 41 contra 42 no sistema.'),
    ev('Reunião com o laticínio: tabela de bonificação', 9, 'geral'),
    ev('Coleta de amostra do tanque (CCS/CBT)', 4, 'sanitario'),
    ev('Conserto da cerca do Piquete 4', -2, 'manejo'),
    ev('Pagar folha de pagamento', -10, 'pagamento', undefined, true),
  ];

  // ---------------- Documentos ----------------
  e.documentos = [
    { id: id('d'), tipo: 'CAR', numero: e.fazenda.car!, emissao: '2019-03-12', status: 'vigente', obs: 'Situação: ativo, em análise no órgão estadual.', em },
    { id: id('d'), tipo: 'ITR', numero: 'NIRF 1.234.567-8', emissao: d(-40), vencimento: '2027-09-30', status: 'vigente', valor: 4120, em },
    { id: id('d'), tipo: 'CCIR', numero: '950.123.456.789-0', emissao: '2025-02-10', vencimento: d(48), status: 'vigente', obs: 'Renovar o CCIR no SNCR antes do vencimento.', em },
    { id: id('d'), tipo: 'GTA', numero: vendas[0].gta!, emissao: vendas[0].data, status: 'vigente', origem: e.fazenda.nome, destino: vendas[0].frigorifico, finalidade: 'Abate', quantidade: vendas[0].animalIds.length, animalIds: vendas[0].animalIds, em },
    { id: id('d'), tipo: 'NF Produtor', numero: '000.412', emissao: vendas[0].data, status: 'vigente', valor: lanc.find((l) => l.credito === '4.1.01')?.valor, em },
    { id: id('d'), tipo: 'Licença', numero: 'Outorga de água · poço 2', emissao: '2022-05-01', vencimento: d(25), status: 'vigente', obs: 'Pedir a renovação da outorga com 30 dias de antecedência.', em },
  ];

  // ---------------- Cotações (semanal, 16 semanas) ----------------
  const cot: Cotacao[] = [];
  for (let w = 15; w >= 0; w--) {
    const data = d(-w * 7);
    const t = (15 - w) / 15;
    cot.push({ id: id('c'), data, indicador: 'boi_gordo', valor: Math.round((298 + t * 18 + between(-4, 4)) * 100) / 100, fonte: 'Média regional (manual)', praca: 'GO', em });
    cot.push({ id: id('c'), data, indicador: 'vaca_gorda', valor: Math.round((272 + t * 14 + between(-4, 4)) * 100) / 100, fonte: 'Média regional (manual)', praca: 'GO', em });
    cot.push({ id: id('c'), data, indicador: 'bezerro', valor: Math.round(2950 + t * 180 + between(-50, 50)), fonte: 'Leilões regionais', praca: 'GO', em });
    cot.push({ id: id('c'), data, indicador: 'leite', valor: Math.round((2.5 + t * 0.08 + between(-0.03, 0.03)) * 100) / 100, fonte: e.tabelaLaticinio.laticinio, em });
    cot.push({ id: id('c'), data, indicador: 'milho', valor: Math.round((62 + t * 4 + between(-2, 2)) * 100) / 100, fonte: 'Cooperativa', praca: 'Rio Verde', em });
  }
  e.cotacoes = cot;

  // ---------------- Confinamento ----------------
  const dieta: Dieta = {
    id: id('dt'), nome: 'Terminação · 85% concentrado', consumoPctPV: 2.3, em,
    ingredientes: [
      { nome: 'Milho moído', pct: 55, custoKg: 1.1 },
      { nome: 'Núcleo mineral/aditivo', pct: 5, custoKg: 4.8 },
      { nome: 'Farelo de soja', pct: 12, custoKg: 2.3 },
      { nome: 'Silagem de milho', pct: 28, custoKg: 0.32, insumoId: I.silagem.id },
    ],
  };
  e.dietas = [dieta];
  e.leiturasCocho = Array.from({ length: 14 }, (_, i): LeituraCocho => {
    const nota = ([1, 1, 2, 1, 0, 1, 1, 2, 1, 1, 0, 1, 3, 1] as const)[i];
    return { id: id('lc'), data: d(-13 + i), loteId: L.conf.id, dietaId: dieta.id, fornecidoKg: Math.round(48 * 530 * 0.023 * between(0.97, 1.04)), nota, sobraKg: nota * 55, por: peao.id, em };
  });

  // ---------------- Leite: ordenhas, qualidade, mastite, reprodução ----------------
  const ordenhas: Ordenha[] = [];
  const reproducao: EventoReprodutivo[] = [];
  vacasLeite.forEach((v, i) => {
    const delHoje = int(20, 380);
    const parto = d(-delHoje);
    reproducao.push({ id: id('rp'), data: addDias(parto, -400 - int(0, 60)), animalId: v.id, tipo: 'parto', por: vaqueiro.id, em });
    reproducao.push({ id: id('rp'), data: parto, animalId: v.id, tipo: 'parto', por: vaqueiro.id, em });
    if (delHoje > 60) {
      const ia = addDias(parto, int(55, 110));
      if (ia < d(-5)) {
        reproducao.push({ id: id('rp'), data: ia, animalId: v.id, tipo: i % 3 === 0 ? 'iatf' : 'ia', semen: 'Gir Leiteiro sexado', protocolo: i % 3 === 0 ? 'P4 9 dias (Ovsynch adaptado)' : undefined, por: vaqueiro.id, em });
        if (addDias(ia, 30) < hoje) reproducao.push({ id: id('rp'), data: addDias(ia, 32), animalId: v.id, tipo: 'diagnostico', resultado: r() < 0.6 ? 'prenhe' : 'vazia', por: vet.id, em });
      }
    }
    const pico = between(22, 32);
    for (let k = 89; k >= 0; k--) {
      const dataO = d(-k);
      const delO = delHoje - k;
      if (delO < 0) continue;
      // curva de Wood simplificada
      const prod = Math.max(3, pico * Math.pow((delO + 5) / 60, 0.25) * Math.exp(-0.0028 * Math.max(0, delO - 45)));
      const descartado = (i === 3 || i === 8) && k <= 1;
      for (const turno of ['manha', 'tarde'] as const) {
        ordenhas.push({ id: id('od'), data: dataO, animalId: v.id, turno, litros: Math.round(prod * (turno === 'manha' ? 0.56 : 0.44) * between(0.92, 1.08) * 10) / 10, descartado, por: ordenhadora.id });
      }
    }
  });
  secas.forEach((v) => {
    const parto = d(-int(300, 360));
    reproducao.push({ id: id('rp'), data: parto, animalId: v.id, tipo: 'parto', por: vaqueiro.id, em });
    const ia = addDias(parto, int(70, 90));
    reproducao.push({ id: id('rp'), data: ia, animalId: v.id, tipo: 'ia', semen: 'Girolando 3/4 (central)', por: vaqueiro.id, em });
    reproducao.push({ id: id('rp'), data: addDias(ia, 32), animalId: v.id, tipo: 'diagnostico', resultado: 'prenhe', por: vet.id, em });
    reproducao.push({ id: id('rp'), data: addDias(ia, 220), animalId: v.id, tipo: 'secagem', por: vaqueiro.id, em });
  });
  // matrizes de corte: estação de monta com IATF
  matrizes.slice(0, 40).forEach((m, i) => {
    const d0 = d(-75);
    reproducao.push({ id: id('rp'), data: addDias(d0, 11), animalId: m.id, tipo: 'iatf', semen: touroCorte, protocolo: 'P4 9 dias (Ovsynch adaptado)', por: vaqueiro.id, em });
    reproducao.push({ id: id('rp'), data: addDias(d0, 41), animalId: m.id, tipo: 'diagnostico', resultado: i % 5 === 0 || i % 7 === 0 ? 'vazia' : 'prenhe', por: vet.id, em });
  });
  // doadoras PO: IATF com sêmen próprio e diagnóstico (taxa de prenhez da genética)
  doadoras.forEach((dd, i) => {
    const ia = d(-70 - i * 3);
    reproducao.push({ id: id('rp'), data: ia, animalId: dd.id, tipo: 'iatf', semen: 'Barão da Boa Vista (próprio)', protocolo: 'P4 8 dias', por: vet.id, em });
    reproducao.push({ id: id('rp'), data: addDias(ia, 30), animalId: dd.id, tipo: 'diagnostico', resultado: i % 3 === 2 ? 'vazia' : 'prenhe', por: vet.id, em });
  });
  e.ordenhas = ordenhas;
  e.reproducao = reproducao;
  e.analisesLeite = [0, 1, 2, 3].map((m): AnaliseLeite => ({
    id: id('al'), data: addMeses(hoje, -m).slice(0, 8) + '05', ccs: [380, 455, 520, 410][m], cbt: [42, 61, 88, 55][m],
    gordura: [3.62, 3.55, 3.48, 3.7][m], proteina: [3.21, 3.18, 3.12, 3.25][m], laticinio: e.tabelaLaticinio.laticinio, em,
  })).filter((a) => a.data <= hoje);
  e.mastites = [
    { id: id('mt'), data: d(-2), animalId: vacasLeite[3].id, quarto: 'AD', grau: 'clinica_moderada', tratamento: 'Oxitetraciclina LA + intramamário', carenciaDias: 4, por: ordenhadora.id, em } as CasoMastite,
    { id: id('mt'), data: d(-2), animalId: vacasLeite[8].id, quarto: 'PE', grau: 'clinica_leve', tratamento: 'Oxitetraciclina LA', carenciaDias: 4, por: ordenhadora.id, em },
    { id: id('mt'), data: d(-40), animalId: vacasLeite[12].id, quarto: 'AE', grau: 'clinica_leve', tratamento: 'Intramamário cefalosporina', carenciaDias: 3, curadaEm: d(-34), por: ordenhadora.id, em },
  ];

  // ---------------- Genética ----------------
  const r2 = (x: number) => Math.round(x * 100) / 100;
  /** TOP coerente com o MGT (quanto maior o mérito, menor o percentil). */
  const aval = (a: Animal, deps: Record<string, number>, indice: number, top: number, acuracia = 0.7): AvaliacaoGenetica => {
    const d = Object.fromEntries(Object.entries(deps).map(([k, v]) => [k, r2(v)]));
    const t = top > 0 ? top : Math.max(1, Math.min(50, Math.round(48 - d.MGT * 5.5)));
    return { id: id('g'), animalId: a.id, programa: 'PMGRN', safra: '2026', deps: d, indice: r2(indice), top: t, acuracia, em };
  };
  e.avaliacoes = [
    aval(t1, { PN: 0.8, P120: 4.1, P210: 7.9, P365: 11.2, P450: 14.5, PE: 1.1, AOL: 1.9, EGS: 0.3, MGT: 6.8 }, 118.4, 3, 0.82),
    aval(t2, { PN: 0.4, P120: 3.2, P210: 6.4, P365: 9.8, P450: 12.1, PE: 0.8, AOL: 2.6, EGS: 0.5, MGT: 5.2 }, 112.7, 7, 0.76),
    aval(avos[0], { PN: 1.1, P120: 3.6, P210: 6.9, P365: 9.7, P450: 12.6, PE: 0.9, AOL: 1.2, EGS: 0.1, MGT: 7.4 }, 110.1, 10, 0.9),
    ...doadoras.map((dd, i) => aval(dd, { PN: between(-0.2, 0.9), P120: between(1.5, 4), P210: between(3, 7.5), P365: between(5, 11), P450: between(6, 13), PE: between(0.2, 1), AOL: between(0.5, 2.5), EGS: between(0, 0.5), MGT: between(3, 8) }, between(102, 116), 0, 0.6)),
    ...tourinhos.map((tt) => aval(tt, { PN: between(0, 1), P120: between(2, 4.5), P210: between(4, 8), P365: between(6, 12), P450: between(8, 15), PE: between(0.3, 1.3), AOL: between(0.8, 2.8), EGS: between(0, 0.6), MGT: between(4, 8) }, between(100, 120), 0, 0.45)),
  ];
  e.provas = tourinhos.map((tt): ProvaDesempenho => ({
    id: id('pv'), animalId: tt.id, data: d(-8), grupo: `PO · machos · safra ${hoje.slice(0, 4)}`,
    pesoKg: Math.round(between(380, 460)), ceCm: Math.round(between(28, 36) * 10) / 10, aolCm2: Math.round(between(58, 78)), egsMm: Math.round(between(2, 6) * 10) / 10, por: vet.id, em,
  }));
  e.estoqueGenetico = [
    { id: id('eg'), tipo: 'semen', identificacao: 'Barão da Boa Vista (próprio)', touroId: t1.id, botijao: 'B1', caneca: '1', doses: 85, custoDose: 0, em },
    { id: id('eg'), tipo: 'semen', identificacao: 'Jequitibá da Boa Vista (próprio)', touroId: t2.id, botijao: 'B1', caneca: '2', doses: 40, custoDose: 0, em },
    { id: id('eg'), tipo: 'semen', identificacao: 'Nelore TOP (central)', central: 'Central Genética Brasil', botijao: 'B1', caneca: '3', doses: 22, custoDose: 85, em },
    { id: id('eg'), tipo: 'semen', identificacao: 'Gir Leiteiro sexado', central: 'Central Genética Brasil', botijao: 'B2', caneca: '1', doses: 31, custoDose: 170, em },
    { id: id('eg'), tipo: 'embriao', identificacao: 'Duquesa × Barão (FIV)', botijao: 'B2', caneca: '4', doses: 6, custoDose: 650, validade: d(400), em },
  ];
  e.acasalamentos = [
    { id: id('ac'), vacaId: doadoras[3].id, touroId: t1.id, meta: 'P450', coeficienteF: 0, status: 'planejado', em } as Acasalamento,
  ];
  e.anuncios = [
    { id: id('an'), animalId: tourinhos[0].id, titulo: 'Tourinho A da Boa Vista · TOP genético', preco: 24000, leilao: 'Leilão Elite Cerrado', dataLeilao: d(35), publicado: true, em } as Anuncio,
  ];

  void dono; void ordenhadora;
  return e;
}

/**
 * Recorta um estado para as atividades contratadas: tira lotes, animais e
 * todo o histórico ligado a eles, lançamentos e receitas das atividades
 * fora do perfil, insumos e cotações que não se aplicam. Custos "geral"
 * (folha, diesel, depreciação) são reduzidos na proporção das UA que
 * ficam, para a demo de uma fazenda só de leite não carregar a folha de
 * uma fazenda completa.
 */
export function recortarPorModulos(e: Estado, modulos: Record<ModuloId, boolean>): Estado {
  const at = new Set<string>(atividadesAtivas(modulos));
  if (at.size === 3) return { ...e, modulos: { ...modulos, core: true } };
  const hoje = e.lancamentos.map((l) => l.data).sort().pop() ?? '2026-01-01';
  const lotes = e.lotes.filter((l) => at.has(l.atividade));
  const loteIds = new Set(lotes.map((l) => l.id));
  // animais sem lote (vendidos e mortos da demo) são do corte
  const animais = e.animais.filter((a) => (a.loteId ? loteIds.has(a.loteId) : at.has('corte')));
  const ids = new Set<Id>(animais.map((a) => a.id));
  const tem = (id?: Id) => !!id && ids.has(id);

  const idx = indexarPesagens(e.pesagens);
  const ua = (xs: typeof e.animais) => xs.filter((a) => a.status === 'ativo').reduce((s, a) => s + uaDe(pesoAtual(a, idx.get(a.id), hoje)), 0);
  const fator = Math.max(0.1, Math.min(1, ua(animais) / Math.max(1, ua(e.animais))));

  const lancFora = new Set(e.lancamentos.filter((l) => l.atividade !== 'geral' && !at.has(l.atividade)).map((l) => l.id));
  const lancamentos = e.lancamentos
    .filter((l) => !lancFora.has(l.id) && !(l.baixaDe && lancFora.has(l.baixaDe)))
    .map((l) => (l.atividade === 'geral' && !l.credito.startsWith('3.') ? { ...l, valor: Math.round(l.valor * fator * 100) / 100 } : l));

  const insumoAtiv: [RegExp, string[]][] = [
    [/confinamento|proteinado/i, ['corte']],
    [/lactação|silagem/i, ['leite', 'corte']],
  ];
  const insumos = e.insumos.filter((i) => {
    const regra = insumoAtiv.find(([re]) => re.test(i.nome));
    return !regra || regra[1].some((a) => at.has(a));
  });
  const insIds = new Set(insumos.map((i) => i.id));

  const usaCorteOuGen = at.has('corte') || at.has('genetica');
  const cotacoes = e.cotacoes.filter((c) =>
    c.indicador === 'leite' ? at.has('leite') : c.indicador === 'milho' || c.indicador === 'soja' ? true : usaCorteOuGen);

  const eventoFora = (t: string) => (!at.has('corte') && /confinamento|R1|boi/i.test(t)) || (!at.has('leite') && /laticínio|tanque|ordenha/i.test(t));

  // Pastos: os ocupados pelos lotes que ficam, mais um em descanso para cada
  // um deles (rotação). A área da fazenda acompanha, com 25% de reserva.
  const lotesComPasto = new Set(lotes.map((l) => l.piqueteId).filter(Boolean) as string[]);
  const livres = e.piquetes.filter((p) => !lotesComPasto.has(p.id) && !e.lotes.some((l) => l.piqueteId === p.id));
  const extras = livres.filter((p) => p.status !== 'reforma').sort((a, b) => a.areaHa - b.areaHa).slice(0, 1);
  const piquetes = e.piquetes.filter((p) => lotesComPasto.has(p.id) || extras.includes(p));
  const fazenda = { ...e.fazenda, areaTotalHa: Math.round(piquetes.reduce((s, p) => s + p.areaHa, 0) * 1.25) };

  return {
    ...e,
    modulos: { ...modulos, core: true },
    fazenda, lotes, animais, piquetes, lancamentos, insumos, cotacoes,
    pesagens: e.pesagens.filter((p) => tem(p.animalId)),
    movimentacoes: e.movimentacoes.map((m) => ({ ...m, animalIds: m.animalIds.filter(tem) })).filter((m) => m.animalIds.length),
    ocorrencias: e.ocorrencias.filter((o) => tem(o.animalId)),
    sanidade: e.sanidade.map((s) => ({ ...s, animalIds: s.animalIds.filter(tem) })).filter((s) => s.animalIds.length),
    movEstoque: e.movEstoque.filter((m) => insIds.has(m.insumoId)).map((m) => (m.tipo === 'saida' ? { ...m, quantidade: Math.round(m.quantidade * fator) } : m)),
    eventos: e.eventos.filter((ev) => !eventoFora(ev.titulo)),
    documentos: e.documentos.filter((d) => at.has('corte') || !['GTA', 'NF Produtor'].includes(d.tipo)),
    pessoas: e.pessoas.filter((p) => p.funcao !== 'ordenhador' || at.has('leite')),
    dietas: at.has('corte') ? e.dietas : [],
    leiturasCocho: e.leiturasCocho.filter((l) => loteIds.has(l.loteId)),
    vendas: e.vendas.map((v) => ({ ...v, animalIds: v.animalIds.filter(tem) })).filter((v) => v.animalIds.length),
    ordenhas: e.ordenhas.filter((o) => tem(o.animalId)),
    analisesLeite: at.has('leite') ? e.analisesLeite : [],
    mastites: e.mastites.filter((m) => tem(m.animalId)),
    reproducao: e.reproducao.filter((r) => tem(r.animalId)),
    avaliacoes: e.avaliacoes.filter((a) => tem(a.animalId)),
    provas: e.provas.filter((p) => tem(p.animalId)),
    estoqueGenetico: e.estoqueGenetico.filter((g) => at.has('genetica')
      || (at.has('leite') && /gir|girolando/i.test(g.identificacao))
      || (at.has('corte') && !g.touroId && /nelore/i.test(g.identificacao))),
    acasalamentos: e.acasalamentos.filter((a) => tem(a.vacaId)),
    anuncios: e.anuncios.filter((a) => tem(a.animalId)),
  };
}

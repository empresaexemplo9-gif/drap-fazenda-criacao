# DRAP Pecuária: produto, cobertura das dores e roteiro

Documento para a revisão dos sócios. Ele cruza cada dor levantada com o que já está implementado nesta versão (v0.1), o que é parcial e o que fica para o roteiro.

**Legenda:** ✅ implementado · 🟡 parcial (funciona, mas falta a integração ou automação indicada) · 🔜 roteiro.

---

## 1. Núcleo comum (todo cliente leva)

| Dor | Como o DRAP Pecuária resolve | Onde | Status |
|---|---|---|---|
| Rebanho fragmentado (caderneta, planilha, WhatsApp) | Cadastro único por animal, com lote e piquete. Filtros e contagem por lote. Movimentação em massa | Rebanho | ✅ |
| Identificação individual com erro de digitação | Brinco, RFID/chip, SISBOV e botton. Tela de curral que recebe leitor RFID em modo teclado e valida duplicidade | Manejo, Rebanho | ✅ leitor HID · 🔜 Bluetooth/serial |
| Pastagem sem ligação com o desempenho | UA/ha contra a capacidade de suporte, situação (superlotado, subutilizado, pronto para entrada), dias de descanso, adubação, reforma e **GMD de quem está em cada piquete** | Pastagens | ✅ |
| Sanidade e calendário sanitário | Brucelose 3–8 meses (obrigatória), aftosa conforme a UF, raiva, clostridioses, vermifugação 5-7-9, partida do frasco, rastreio de recall e carência por animal | Sanidade, Agenda | ✅ |
| Custo real de produção (@ e litro) | Custo direto do lote mais o rateio dos fixos (mão de obra, combustível, energia, depreciação, reforma) por UA·dia, cabeças ou igual. @ produzida = GMD × dias × rendimento ÷ 15 | Custo de produção | ✅ |
| Fluxo de caixa e sazonalidade | Posição a pagar × a receber (método do DRAP Fazenda), baixa em um clique, fluxo de 6 meses realizados + 6 projetados com previsões, alerta de caixa negativo | Posição, Lançamentos | ✅ |
| Crédito rural | Contas 2.2 (custeio e investimento), parcelas como títulos | Lançamentos | 🟡 cronograma de parcelas automático no roteiro |
| Documentação e conformidade | GTA, NF do produtor, Funrural calculado sobre a receita bruta, CAR, ITR, CCIR e licenças com vencimento na agenda | Documentos | 🟡 emissão de GTA/NF-e integrada no roteiro |
| Gestão de pessoas e rotatividade | Cada registro assina quem anotou. Apontamentos por pessoa e escala de turnos | Equipe | ✅ · 🔜 login por pessoa (servidor) |
| Rebanho já controlado em planilha | Sincronização nos dois sentidos com Google Planilhas (automática) ou Excel (offline), reconhecendo o mesmo animal, lote, documento ou lançamento pelo brinco, RFID, nome, código ou número | Planilha | ✅ |
| Conectividade ruim | App estático com service worker: abre sem sinal, grava no aparelho e mostra a fila de pendências. Backup em JSON | Todo o app | ✅ local · 🟡 servidor de sincronização (schema pronto) |
| Estoque de insumos | Saldo, custo médio ponderado, previsão de ruptura pelo consumo diário, conferência do consumo de sal por UA, entrada que já lança a despesa a prazo | Estoque | ✅ |
| Clima e preço de mercado | Cotações (boi, vaca, bezerro, leite, milho), relação de troca, **simulador vender × segurar** com @ de equilíbrio, **confinar × pasto** | Mercado | ✅ cotação manual · 🔜 Cepea/B3 e clima |

## 2. Módulo Corte

| Dor | Solução | Status |
|---|---|---|
| GMD com pesagens esparsas | GMD individual e do lote, curva média, animais abaixo de 70% do lote, dias até o peso de abate | ✅ |
| Recria, engorda, ciclo completo; confinar ou pasto | Simulador com três sistemas: margem total e margem por dia | ✅ |
| Compra de reposição sem comparativo | Preço pago × GMD posterior × perdas, por fornecedor ou origem, e "kg ganhos por R$ 1.000" | ✅ |
| Gestão do confinamento | Dieta com custo por kg, leitura de cocho (nota 0–4) com recomendação de trato, consumo % PV, custo por cocho, conversão e dias de cocho | ✅ · 🔜 formulação nutricional |
| Venda e frigorífico | Venda que tira os animais do rebanho, bloqueia quem está em carência, gera o título a receber, o Funrural e a GTA. Histórico de preço e de rendimento por frigorífico | ✅ |
| Mortalidade, perdas e roubo | Conciliação contagem física × sistema por lote e baixa com causa | ✅ |
| Rastreabilidade premium | SISBOV por animal, sanidade com partida, GTA de saída | 🟡 exportação nos formatos dos programas no roteiro |
| Indicadores | Desfrute, mortalidade, idade ao abate, @/ha, resultado e lucro por hectare | ✅ |

## 3. Módulo Leite

| Dor | Solução | Status |
|---|---|---|
| Produção por vaca e vacas improdutivas | Ordenha rápida por vaca/turno, curva de lactação, DEL, alerta de improdutivas (vazia > 150 DEL, baixa produção) | ✅ |
| Qualidade descoberta só no fechamento | Média geométrica trimestral de CCS/CBT contra a IN 76 e **simulador do preço do litro** pela tabela do laticínio | ✅ · 🔜 importar análises do laticínio |
| Mastite e descarte em carência | Casos por quarto, descarte automático do leite das vacas em carência, incidência mensal | ✅ |
| Reprodução | Intervalo entre partos, taxa de prenhez, vacas vazias após 60 DEL, diagnóstico, secagem e parto previstos na agenda | ✅ |
| Nutrição e custo por litro | Custo do litro (direto + rateio, incluindo secas e recria) contra o preço | ✅ · 🔜 balanceamento por categoria |
| Bezerras e novilhas | GMD contra a meta, apta à cobertura (330 kg até 16 meses) | ✅ |
| Mão de obra de ordenha | Escala na Equipe e cada ordenha assinada | ✅ |
| IN 76/77, brucelose e tuberculose | Limites da IN 76 e calendário sanitário | 🟡 checklist de resfriamento e exames de tuberculose no roteiro |

## 4. Módulo Genética

| Dor | Solução | Status |
|---|---|---|
| Registro genealógico e prazos | Produtos de pais registrados sem RGN, com prazo de comunicação | 🟡 prazo por associação configurável no roteiro |
| DEPs difíceis de interpretar | Tabela de DEPs por programa com acurácia, TOP, ordenação por característica e explicação | ✅ |
| Planejamento de acasalamento | Ranking de touros e sêmen do botijão pela DEP-meta, **consanguinidade de Wright** do produto, bloqueio acima de 6,25% e plano da estação | ✅ |
| IATF, FIV, TE | Cronograma dos protocolos agendado para o lote, taxa de prenhez por protocolo, custo por prenhez | ✅ · 🔜 FIV/TE com doadora × receptora |
| Provas de desempenho | Índices dentro do grupo de contemporâneos (peso, CE, AOL) | ✅ |
| Sêmen e embriões | Botijão, caneca, doses, custo, validade e baixa da dose na inseminação | ✅ |
| Marketing e confiança na venda | Catálogo com DEPs e genealogia e **ficha do animal com impressão digital SHA-256** do histórico | 🟡 vitrine pública on-line depende do servidor |

## 5. Arquitetura modular: cada produtor leva só o que faz

A maioria dos produtores trabalha com **uma atividade só** (corte, leite ou genética). Outros combinam duas ou as três. Por isso a plataforma é separada por módulo desde o primeiro acesso:

- **Primeiro acesso:** "Como é a sua operação?". O produtor marca Corte, Leite e/ou Genética (sete combinações possíveis) e começa com a demo daquele perfil ou com a fazenda vazia.
- **Núcleo DRAP Pecuária** (obrigatório): tudo da seção 1, **recortado pelo perfil**:

  | No núcleo | Só corte | Só leite | Só genética |
  |---|---|---|---|
  | Lotes e fases | cria, recria, engorda, confinamento | lactação, secas, bezerras | doadoras, touros, tourinhos em prova |
  | Contas de receita | boi gordo, bezerro | venda de leite | reprodutores, sêmen e embriões |
  | Custo de produção | custo da @ | custo do litro | custo do plantel PO por cabeça/mês |
  | Mercado | boi, vaca, bezerro, milho | leite, milho | boi e bezerro (referência), milho |
  | Painel | cartão Corte | cartão Leite | cartão Genética |
  | DRE | resultado da fazenda | resultado da fazenda | resultado da fazenda |

  Com duas ou três atividades, a DRE ganha uma coluna por atividade e os custos comuns são rateados entre elas por UA·dia.
- **Módulos plugáveis** com preço próprio, ligados e desligados em *Configurações*. Desligar esconde as telas e os lotes do módulo sem apagar dados. A fazenda nunca fica sem pelo menos uma atividade.
- **O que é de um módulo fica no módulo:** "vender × segurar" e "pasto × confinamento" são do Corte; qualidade e tabela do laticínio são do Leite; DEPs e acasalamento são da Genética.
- **Camada de inteligência:** o Painel "o que precisa da sua atenção hoje", as sugestões do calendário (vacina, carência, parto, secagem, GTA, ruptura de estoque, pagamento), os simuladores e os comparativos.
- **Reaproveitamento do DRAP Fazenda:** paleta, tipografia, componentes, o método do livro-razão (plano em 3 níveis, título pendente até `pago_em`, Posição) e a infraestrutura (Next.js, Vercel, Supabase).

Preços de referência usados na tela (hipóteses a validar na feira): núcleo R$ 149, Corte R$ 99, Leite R$ 99 e Genética R$ 199 por mês.

## 6. Roteiro sugerido

1. **Piloto (agora):** núcleo + Corte com 3 a 5 pecuaristas. App local com backup semanal.
2. **Sincronização:** publicar o `supabase/migrations/001_sincronizacao.sql`, um endpoint que chama `aplicar_pendencias` e o login por pessoa, com permissão do livro-razão só para proprietário e gerente.
3. **Integrações:** balança e bastão RFID por Bluetooth, mais abas na planilha (sanidade, ordenhas, reprodução), exportação contábil (o CSV de lançamentos já sai no formato com `;` para o ContábilPro), cotações Cepea e B3.
4. **Leite:** importar as análises do laticínio, checklist da IN 77 e balanceamento.
5. **Genética premium:** associações de raça, FIV/TE completas, vitrine pública e leilões.
6. **Conformidade:** emissão de GTA via órgão estadual e NF-e do produtor reaproveitando o emissor do DRAP Fazenda.

## 7. Validação na feira

A tela **Feira** roda no tablet do stand, sem sinal:

1. **Questionário de 5 perguntas:** maior dor, como controla hoje, quanto paga, tipo e tamanho da operação, se aceita piloto.
2. **Lista de interessados** com contato e município, filtrável por corte, leite, genética ou piloto, exportável em CSV.
3. **Resumo ao vivo** das respostas para a conversa de fim de dia.
4. **Demo:** o Painel e os módulos da Fazenda Boa Vista mostram o "futuro DRAP Pecuária" ao lado do DRAP Fazenda.
5. **Escolha dos pilotos:** um de corte, um de leite e um de genética entre os que aceitaram. Anotar técnicos, veterinários e o sindicato no campo de observação, como possíveis parceiros de distribuição.

## 8. Limitações conhecidas desta versão

- Os dados ficam só no navegador do aparelho até o servidor de sincronização entrar. Sem backup, limpar o navegador apaga tudo.
- O custo por lote usa o lote **atual** de cada animal. Animais que mudaram de lote no período têm o custo atribuído ao lote de hoje. Corrigir exige reconstruir o histórico pelas movimentações.
- Para lotes de cria, o custo por @ não é o indicador certo; o certo é o custo por bezerro desmamado (roteiro).
- As regras sanitárias são nacionais e genéricas. Cada UF tem calendário próprio de aftosa, raiva e declaração de rebanho.
- Cotações e preços de módulo são dados de exemplo.

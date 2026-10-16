# DRAP Pecuária

Gestão do rebanho que funciona sem sinal: rebanho, identificação, sanidade, pastagem, estoque, livro-razão, custo da arroba e do litro, mais os módulos **Corte**, **Leite** e **Genética**.

Feito com a paleta, a tipografia e os métodos do **DRAP Fazenda** (`psaprincesa-netizen/fazenda-app`):

- **Visual:** papel `#F7F4EC`, osso `#FBFAF5`, tinta `#111410`, folha `#486B3A`, terra `#7A5C3B`. Fraunces nos títulos (com destaque em itálico), Manrope no texto e Roboto Mono nos números.
- **Livro-razão:** plano de contas em 3 níveis (`5.1.01`), fornecedor/NF/forma de pagamento, título pendente até a baixa e Posição (a pagar × a receber no intervalo).
- **Gestão:** "O que precisa da sua atenção hoje", com pagamentos do dia e resumos compactos.
- **Calendário:** a agenda com tipo, concluído, atraso em vermelho e concluídos recolhidos.

## Rodar

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 91 testes: domínio, 7 perfis, planilha e script do Google (vitest)
npm run build        # exportação estática em out/
npm start            # serve out/ em http://localhost:4173
npm run e2e -- http://localhost:4173            # fluxos de ponta a ponta (Playwright)
npm run e2e:planilha -- http://localhost:4173   # sincronização com planilha, com Google simulado
```

No primeiro acesso o produtor responde **"Como é a sua operação?"**: só corte, só leite, só genética ou qualquer combinação. O núcleo (lotes, plano de contas, custos, mercado, painel) passa a mostrar só o que ele faz. A **Fazenda Boa Vista**, uma demo fictícia com até cerca de 310 animais e 6 meses de histórico, é montada com as atividades escolhidas. Em *Configurações* dá para ligar ou desligar módulos, refazer a escolha e recarregar a demo do perfil.

## Arquitetura

| Camada | Onde | O quê |
|---|---|---|
| Domínio | `src/lib/domain/` | Regras puras e testadas: `livro-razao`, `rebanho`, `custos`, `calendario`, `estoque`, `simulador`, `leite`, `genetica`, `modulos` (perfis e recorte por atividade) |
| Planilha | `src/lib/domain/planilha.ts`, `src/lib/planilha-sync.ts`, `src/lib/apps-script.ts` | Fusão nos dois sentidos com Google Planilhas (via Apps Script colado na planilha do produtor) ou Excel (.xlsx), reconhecendo o mesmo registro por ID DRAP, RFID, SISBOV, brinco, nome ou número do documento |
| Estado offline | `src/lib/store.ts` | Estado inteiro no aparelho (localStorage), fila de pendências por registro, backup/restauração em JSON, `sincronizar()` |
| Demo | `src/lib/seed.ts` | Fazenda fictícia, determinística, com datas relativas a hoje, recortada por perfil (`recortarPorModulos`) |
| Telas | `src/app/*/page.tsx` | Uma rota estática por área. Ficha do animal em `/animal/?id=` |
| PWA | `public/sw.js` | Guarda o app em cache e abre sem conexão |
| Servidor (fase 2) | `supabase/migrations/001_sincronizacao.sql` | Recebe a fila de pendências, isolamento por fazenda com RLS e auditoria |

**Por que exportação estática:** o vaqueiro anota no curral sem sinal. Os dados ficam no aparelho e a sincronização envia a fila quando houver conexão. Hoje ela fica desligada até existir `NEXT_PUBLIC_DRAP_SYNC_URL`.

## Telas

Primeiro acesso: escolha da operação.
Núcleo: Painel · Rebanho · Manejo (curral com RFID) · Pastagens · Sanidade · Agenda · Lançamentos · Posição · Custo de produção · Estoque · Documentos · Equipe · Mercado.
Módulos: Corte (com vender × segurar e confinar × pasto) · Leite · Genética.
Sistema: Feira (questionário e interessados) · Planilha (Google Planilhas ou Excel nos dois sentidos) · Configurações (módulos, fazenda, backup).

## Planilha nos dois sentidos

Em *Planilha* o produtor conecta a planilha que já usa. O que ele digita lá entra no DRAP; o que é anotado no DRAP aparece lá.

- **Google Planilhas:** o produtor cola um Apps Script (gerado com uma senha só da fazenda) em *Extensões → Apps Script* e publica como app da web. O navegador conversa direto com a planilha, sem servidor nosso. Sincroniza sozinho a cada 2 minutos, ao voltar o sinal e 15 s depois de cada anotação.
- **Excel (.xlsx), sem internet:** baixar, preencher, enviar de volta.
- **Mesmo registro dos dois lados:** coluna `ID DRAP`; sem ela, RFID, SISBOV ou brinco (animal), nome (lote, piquete, pessoa, insumo), tipo + número (documento), brinco + data (pesagem), data + histórico + valor ou NF + fornecedor (lançamento). Cabeçalhos são aceitos sem acento, em outra ordem e por apelido (`chip` = RFID).
- **Quem vale:** guardamos a impressão de cada linha na última troca. Mudou de um lado só, esse lado vence; mudou dos dois, vale a regra escolhida (planilha, por padrão). Na primeira vez, célula vazia na planilha não apaga dado do DRAP.
- **Segurança dos dados:** excluir no DRAP tira a linha da planilha, mas apagar a linha na planilha não apaga o animal (a linha volta e o relatório avisa). Erro de digitação não muda o DRAP e a célula fica como foi digitada. Colunas criadas pelo produtor e fórmulas com o mesmo resultado são mantidas. Se alguém digitar na planilha durante a troca, o script recusa a escrita e a fusão é refeita.

A análise de produto (cada dor mapeada para uma funcionalidade, o que fica para depois e o roteiro da feira) está em [`docs/produto.md`](docs/produto.md).

## Deploy

É um site estático: Vercel (`next build` gera `out/`), Netlify ou qualquer CDN. O DRAP Fazenda já usa Vercel, então basta criar um projeto apontando para este repositório.

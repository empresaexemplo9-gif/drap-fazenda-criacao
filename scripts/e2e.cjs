// Teste de ponta a ponta dos fluxos principais (Playwright).
// Uso: npm run build && npx serve out -l 4173 & node scripts/e2e.cjs http://localhost:4173

const { chromium } = require('playwright');
const B = process.argv[2] || 'http://localhost:4173';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('dialog', (d) => d.accept());
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('drap-pecuaria:estado:v1')));
  const ok = (c, m) => { if (!c) { erros.push('FALHOU: ' + m); } else console.log('ok ·', m); };

  // Primeiro acesso: escolha do perfil
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  ok(await p.locator('text=Como é a').isVisible(), 'primeiro acesso pergunta a operação');
  for (const m of ['Corte', 'Leite', 'Genética']) await p.click(`[role=checkbox]:has-text("${m}")`);
  await p.click('text=Começar com a fazenda de exemplo');
  await p.waitForTimeout(500);
  let e = await st(); ok(e && e.perfilDefinido && e.animais.length > 200, 'demo completa gravada no aparelho');

  // Manejo: pesagem
  await p.goto(B + '/manejo/', { waitUntil: 'networkidle' });
  await p.fill('input[aria-label="Brinco ou RFID"]', '1001');
  await p.keyboard.press('Enter');
  await p.fill('input[aria-label="Peso"]', '355');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(300);
  e = await st();
  const a1001 = e.animais.find((a) => a.brinco === '1001');
  ok(e.pesagens.some((w) => w.animalId === a1001.id && w.pesoKg === 355), 'pesagem gravada pelo brinco');
  // RFID
  await p.fill('input[aria-label="Brinco ou RFID"]', a1001.rfid.replace(/\s/g, ''));
  await p.keyboard.press('Enter');
  ok(await p.locator('input[aria-label="Peso"]').isVisible(), 'leitura por RFID localiza o animal');

  // Novo lançamento a prazo
  await p.goto(B + '/lancamentos/', { waitUntil: 'networkidle' });
  await p.click('button.btn-primary:has-text("Lançamento")');
  await p.fill('[role=dialog] input[placeholder="0,00"]', '1.234,56');
  const venc = p.locator('[role=dialog] input[type=date]').nth(1);
  await venc.fill('2026-12-01');
  await p.fill('input[placeholder^="ex.: Sal"]', 'Teste E2E sal');
  await p.click('button:has-text("Lançar")');
  await p.waitForTimeout(300);
  e = await st();
  const l = e.lancamentos.find((x) => x.historico === 'Teste E2E sal');
  ok(l && l.valor === 1234.56 && l.credito === '2.1.01' && l.debito === '5.1.01', 'lançamento a prazo em partida dobrada');

  // Posição: baixa
  await p.goto(B + '/posicao/', { waitUntil: 'networkidle' });
  await p.locator('input[type=date]').nth(1).fill('2026-12-31');
  await p.waitForTimeout(200);
  const antes = (await st()).lancamentos.length;
  await p.locator('li:has-text("Teste E2E sal") button:has-text("Pago")').click();
  await p.waitForTimeout(300);
  e = await st();
  ok(e.lancamentos.length === antes + 1 && e.lancamentos.find((x) => x.historico === 'Teste E2E sal').pagoEm, 'baixa gera lançamento de pagamento');

  // Agenda: agendar sugestão
  await p.goto(B + '/agenda/', { waitUntil: 'networkidle' });
  const nEv = (await st()).eventos.length;
  await p.locator('button:has-text("Agendar")').first().click();
  await p.waitForTimeout(200);
  ok((await st()).eventos.length === nEv + 1, 'sugestão agendada vira tarefa');
  await p.click('text=Mês'); await p.waitForTimeout(200);

  // Feira
  await p.goto(B + '/feira/', { waitUntil: 'networkidle' });
  await p.click('text=Não sei o custo da @ ou do litro');
  await p.click('text=Planilha');
  await p.click('text=Até R$ 100/mês');
  await p.click('button:has-text("Corte")');
  await p.click('text=Sim, quero participar');
  await p.locator('label:has-text("Nome") input').fill('Produtor Teste');
  await p.click('text=Enviar respostas');
  await p.waitForTimeout(200);
  ok((await st()).interessados.length === 1, 'questionário da feira salvo');
  await p.click('text=Resumo'); await p.waitForTimeout(200);

  // Módulos
  await p.goto(B + '/config/', { waitUntil: 'networkidle' });
  await p.click('button[aria-label="Ativar Módulo Leite"]');
  await p.waitForTimeout(200);
  ok((await st()).modulos.leite === false, 'desativar módulo Leite');
  await p.goto(B + '/leite/', { waitUntil: 'networkidle' });
  ok(await p.locator('text=Módulo Leite não contratado').isVisible(), 'tela do módulo bloqueada quando desativado');

  // Visita todas as abas de módulos para erros de runtime
  await p.goto(B + '/config/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.click('button[aria-label="Ativar Módulo Leite"]');
  await p.waitForTimeout(400);
  ok((await st()).modulos.leite === true, 'reativar módulo Leite');
  for (const [rota, abas] of [['/corte/', ['Confinamento', 'Reposição', 'Vendas e frigoríficos', 'Vender × segurar', 'Indicadores']], ['/leite/', ['Lançar ordenha', 'Qualidade', 'Mastite', 'Reprodução', 'Bezerras e novilhas', 'Rentabilidade']], ['/genetica/', ['Acasalamento', 'IATF · FIV · TE', 'Provas', 'Botijão', 'Catálogo de venda', 'Registro genealógico']], ['/lancamentos/', ['Razão por conta', 'Balancete', 'DRE por atividade', 'Plano de contas']], ['/sanidade/', ['Calendário sanitário', 'Histórico', 'Rastrear partida']], ['/rebanho/', ['Lotes', 'Conciliação de cabeças']]]) {
    await p.goto(B + rota, { waitUntil: 'networkidle' });
    for (const aba of abas) { await p.click(`[role=tab]:has-text("${aba}")`); await p.waitForTimeout(150); }
  }
  // Perfil só leite: nada de corte no núcleo
  await p.goto(B + '/config/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.click('text=refazer escolha');
  await p.waitForTimeout(300);
  for (const m of ['Corte', 'Genética']) await p.click(`[role=checkbox]:has-text("${m}")`);
  await p.click('text=Começar com a fazenda de exemplo');
  await p.waitForTimeout(500);
  e = await st();
  ok(!e.modulos.corte && e.modulos.leite && !e.modulos.genetica && e.lotes.every((l) => l.atividade === 'leite'), 'perfil só leite: só lotes de leite');
  await p.goto(B + '/', { waitUntil: 'networkidle' });
  ok(!(await p.locator('header nav a:has-text("Corte")').count()) && (await p.locator('header nav a:has-text("Leite")').count()) === 1, 'menu mostra só o módulo Leite');
  ok(await p.locator('text=Módulo Leite').first().isVisible() && !(await p.locator('text=Módulo Corte').count()), 'painel com cartão só do Leite');
  await p.goto(B + '/mercado/', { waitUntil: 'networkidle' });
  ok(!(await p.locator('text=Boi gordo').count()), 'mercado sem boi para quem só tira leite');
  await p.goto(B + '/lancamentos/', { waitUntil: 'networkidle' });
  await p.click('button.btn-primary:has-text("Lançamento")');
  await p.click('[role=dialog] button:has-text("Venda a prazo")');
  const opReceita = await p.locator('[role=dialog] label:has-text("Conta de receita") option').allTextContents();
  ok(opReceita.some((t) => t.includes('Venda de leite')) && !opReceita.some((t) => t.includes('bois')), 'receitas do lançamento só de leite');
  await p.keyboard.press('Escape');
  await p.goto(B + '/config/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  ok(await p.locator('button[aria-label="Ativar Módulo Leite"]').isDisabled(), 'não deixa desligar a única atividade');

  // Perfil só corte
  await p.click('text=refazer escolha');
  await p.waitForTimeout(300);
  await p.click('[role=checkbox]:has-text("Leite")');
  await p.click('[role=checkbox]:has-text("Corte")');
  await p.click('text=Começar com a fazenda de exemplo');
  await p.waitForTimeout(500);
  e = await st();
  ok(e.modulos.corte && !e.modulos.leite && e.ordenhas.length === 0, 'perfil só corte sem ordenhas');
  await p.goto(B + '/corte/?aba=decisao', { waitUntil: 'networkidle' });
  ok(await p.locator('text=Ganho líquido de segurar').isVisible(), 'simulador vender × segurar dentro do Corte');
  await p.goto(B + '/config/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.click('text=refazer escolha');
  await p.waitForTimeout(300);
  for (const m of ['Leite', 'Genética']) await p.click(`[role=checkbox]:has-text("${m}")`);
  await p.click('text=Manter os dados que já estão neste aparelho');
  await p.waitForTimeout(300);
  e = await st();
  ok(e.modulos.leite && e.modulos.genetica && e.ordenhas.length === 0, 'refazer perfil mantendo dados');
  await p.goto(B + '/config/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  await p.click('text=Recarregar demo deste perfil');
  await p.waitForTimeout(500);
  e = await st();
  ok(e.lotes.length === 10, 'demo completa recarregada');

  // ficha do animal
  await p.goto(B + '/animal/?id=' + a1001.id, { waitUntil: 'networkidle' });
  ok(await p.locator('text=Histórico verificável').isVisible(), 'ficha do animal abre');
  // offline: recarrega com SW
  await p.goto(B + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  await ctx.setOffline(true);
  await p.goto(B + '/rebanho/').catch(() => {});
  await p.waitForTimeout(800);
  ok(await p.locator('text=Cada cabeça').isVisible().catch(() => false), 'abre sem conexão (service worker)');
  await ctx.setOffline(false);

  console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'TUDO OK');
  await b.close();
})();

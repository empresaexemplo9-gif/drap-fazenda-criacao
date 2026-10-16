// Ponta a ponta da sincronização com planilha (Playwright).
// Roda o MESMO código de Apps Script que a tela mostra, contra uma planilha
// falsa em memória, interceptando o endereço do Google.
// Uso: node scripts/e2e-planilha.cjs http://localhost:4174

const { chromium } = require('playwright');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const ExcelJS = require(path.join(__dirname, '..', 'node_modules', 'exceljs'));

const B = process.argv[2] || 'http://localhost:4173';
const URL_SCRIPT = 'https://script.google.com/macros/s/AKfyTESTE/exec';

function planilhaFalsa(abas) {
  const formatos = {};
  let locale = 'en_US';
  const exibir = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v));
  const sheet = (nome) => {
    const dados = () => abas[nome];
    const range = (r, c, nr, nc) => ({
      getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (dados()[r - 1 + i] || [])[c - 1 + j] ?? '')),
      getFormulas: () => Array.from({ length: nr }, () => Array.from({ length: nc }, () => '')),
      clearContent: () => { abas[nome] = []; },
      setNumberFormat: (f) => { for (let i = 0; i < nr; i++) (formatos[nome] = formatos[nome] || {})[`${r + i},${c}`] = f; return range(r, c, nr, nc); },
      setValues: (v) => { v.forEach((l, i) => l.forEach((x, j) => { const row = (abas[nome][r - 1 + i] = abas[nome][r - 1 + i] || []); row[c - 1 + j] = exibir(x); })); return range(r, c, nr, nc); },
      setFontWeight: () => range(r, c, nr, nc),
      setFontColor: () => range(r, c, nr, nc),
    });
    return { getName: () => nome, getLastRow: () => dados().length, getLastColumn: () => Math.max(0, ...dados().map((l) => l.length)), getRange: range, setFrozenRows: () => {} };
  };
  const ss = {
    getName: () => 'Controle do rebanho', getUrl: () => 'https://docs.google.com/spreadsheets/d/teste',
    getSheets: () => Object.keys(abas).map(sheet), insertSheet: (n) => { abas[n] = []; return sheet(n); },
    getSpreadsheetLocale: () => locale, setSpreadsheetLocale: (l) => { locale = l; },
  };
  return {
    abas, formatos,
    globais: {
      SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
      LockService: { getDocumentLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
      ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => t }) },
      Utilities: {
        DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
        computeDigest: (_a, s) => crypto.createHash('md5').update(s, 'utf8').digest(),
        base64Encode: (b) => b.toString('base64'),
      },
    },
  };
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('dialog', (d) => d.accept());
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('drap-pecuaria:estado:v1')));
  const ok = (c, m) => { if (!c) erros.push('FALHOU: ' + m); else console.log('ok ·', m); };
  const col = (g, t) => g[0].indexOf(t);

  await p.goto(B + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.click('[role=checkbox]:has-text("Corte")');
  await p.click('text=Começar com a fazenda de exemplo');
  await p.waitForTimeout(500);
  let e = await st();
  const lote = e.lotes.find((l) => l.atividade === 'corte');
  const a0 = e.animais.find((a) => a.status === 'ativo');

  // A planilha que o produtor já tinha, do jeito dele
  const fake = planilhaFalsa({
    Animais: [
      ['brinco', 'Raca', 'Sexo', 'Nascimento', 'Lote', 'Peso à desmama'],
      [a0.brinco, 'Angus', a0.sexo === 'M' ? 'Macho' : 'Fêmea', '', '', '210'],
      ['9999', 'Nelore', 'Fêmea', '03/04/2025', lote.nome, '185'],
    ],
  });

  await p.goto(B + '/planilha/', { waitUntil: 'networkidle' });
  ok(await p.locator('text=preenchendo um ao outro').isVisible(), 'tela da planilha abre');
  await p.click('text=Começar a configurar');
  await p.click('text=Ver o código');
  await p.waitForTimeout(400);
  const codigo = await p.locator('textarea').inputValue();
  e = await st();
  ok(codigo.includes(`var TOKEN = '${e.planilha.token}'`), 'código do script vem com a senha da fazenda');
  const { doPost } = new Function(...Object.keys(fake.globais), `${codigo}\nreturn { doPost };`)(...Object.values(fake.globais));
  let chamadas = 0;
  await ctx.route(URL_SCRIPT, async (route) => {
    chamadas++;
    const corpo = route.request().postData();
    const resp = doPost({ postData: { contents: corpo } });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: resp });
  });

  // URL errada é recusada antes de chamar
  await p.fill('[data-testid=url-script]', 'https://docs.google.com/spreadsheets/d/abc');
  await p.click('[data-testid=conectar-planilha]');
  ok(await p.locator('text=terminar em /exec').isVisible(), 'endereço que não é do app da web é recusado');

  await p.fill('[data-testid=url-script]', URL_SCRIPT);
  await p.click('[data-testid=conectar-planilha]');
  await p.waitForSelector('text=Google Planilhas · conectada', { timeout: 15000 });
  await p.waitForTimeout(500);
  e = await st();
  const animal = e.animais.find((a) => a.id === a0.id);
  ok(animal.raca === 'Angus' && animal.sexo === a0.sexo, 'planilha → DRAP: raça alterada, campos vazios não apagam o DRAP');
  const novo = e.animais.find((a) => a.brinco === '9999');
  ok(novo && novo.loteId === lote.id && novo.nascimento === '2025-04-03', 'planilha → DRAP: animal novo com lote pelo nome');
  let g = fake.abas.Animais;
  ok(g[0][0] === 'ID DRAP' && g[0].includes('Peso à desmama'), 'planilha ganha a coluna ID DRAP e mantém a coluna do produtor');
  ok(g.length - 1 === e.animais.length, `DRAP → planilha: todos os ${e.animais.length} animais na planilha`);
  ok(g.find((l) => l[0] === novo.id)[col(g, 'Peso à desmama')] === '185', 'valor da coluna do produtor continua na linha certa');
  ok(fake.abas.Lotes && fake.abas.Pesagens && fake.abas.Lotes.length - 1 === e.lotes.length, 'abas Lotes e Pesagens criadas');
  ok(fake.formatos.Animais && fake.formatos.Animais['1,2'] === '@', 'coluna Brinco gravada como texto');
  ok(await p.locator('text=Controle do rebanho').isVisible(), 'mostra o nome da planilha conectada');

  // Planilha → DRAP de novo, pelo botão
  g = fake.abas.Animais;
  g.find((l) => l[0] === novo.id)[col(g, 'Raça')] = 'Gir';
  await p.click('[data-testid=sincronizar-planilha]');
  await p.waitForTimeout(1200);
  e = await st();
  ok(e.animais.find((a) => a.id === novo.id).raca === 'Gir', 'edição na planilha chega ao DRAP');

  // DRAP → planilha automático: pesagem no curral
  await p.goto(B + '/manejo/', { waitUntil: 'networkidle' });
  await p.fill('input[aria-label="Brinco ou RFID"]', '9999');
  await p.keyboard.press('Enter');
  await p.fill('input[aria-label="Peso"]', '233');
  await p.keyboard.press('Enter');
  const antes = chamadas;
  await p.waitForTimeout(19000);
  const pes = fake.abas.Pesagens;
  ok(pes.some((l) => l[col(pes, 'Brinco')] === '9999' && l[col(pes, 'Peso (kg)')] === '233'), 'DRAP → planilha automático: pesagem do curral aparece na planilha');
  ok(chamadas > antes, 'sincronização automática chamou a planilha');

  e = await st();

  // Excel: baixar, editar, enviar
  await p.goto(B + '/planilha/', { waitUntil: 'networkidle' });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid=baixar-xlsx]')]);
  const arq = path.join(require('node:os').tmpdir(), 'drap-e2e.xlsx');
  await dl.saveAs(arq);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arq);
  const ws = wb.getWorksheet('Animais');
  ok(ws && ws.rowCount - 1 === e.animais.length, 'xlsx baixado com todos os animais');
  const cab = ws.getRow(1).values;
  const cBrinco = cab.indexOf('Brinco');
  const cRaca = cab.indexOf('Raça');
  ws.eachRow((row) => { if (row.getCell(cBrinco).value === '9999') row.getCell(cRaca).value = 'Brahman'; });
  const r = ws.addRow([]);
  r.getCell(cBrinco).value = '7777';
  r.getCell(cab.indexOf('Sexo')).value = 'Macho';
  r.getCell(cab.indexOf('Nascimento')).value = new Date(Date.UTC(2025, 5, 1));
  await wb.xlsx.writeFile(arq);
  await p.setInputFiles('[data-testid=enviar-xlsx]', arq);
  await p.waitForSelector('[data-testid=relatorio-arquivo]', { timeout: 15000 });
  await p.waitForTimeout(500);
  e = await st();
  ok(e.animais.find((a) => a.id === novo.id).raca === 'Brahman', 'Excel → DRAP: edição aplicada');
  const n7 = e.animais.find((a) => a.brinco === '7777');
  ok(n7 && n7.nascimento === '2025-06-01', 'Excel → DRAP: animal novo com data do Excel');
  ok(await p.locator('text=Baixar a planilha atualizada').isVisible(), 'oferece a planilha atualizada');
  fs.unlinkSync(arq);

  // E o Google recebe o que veio do Excel na próxima sincronização
  await p.click('[data-testid=sincronizar-planilha]');
  await p.waitForTimeout(1500);
  g = fake.abas.Animais;
  ok(g.some((l) => l[col(g, 'Brinco')] === '7777'), 'o que entrou pelo Excel vai para o Google Planilhas');

  // Telefone estreito: sem rolagem horizontal
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(B + '/planilha/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const larg = await p.evaluate(() => document.documentElement.scrollWidth);
  ok(larg <= 390, `sem rolagem horizontal no celular (${larg}px)`);
  await p.screenshot({ path: path.join(process.env.SHOTS || '.', 'planilha-celular.png'), fullPage: true });
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(B + '/planilha/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(process.env.SHOTS || '.', 'planilha.png'), fullPage: true });

  console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'TUDO OK');
  await b.close();
  process.exit(erros.length ? 1 : 0);
})();

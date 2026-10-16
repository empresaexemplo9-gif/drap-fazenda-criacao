/**
 * Código do Google Apps Script que o produtor cola na planilha dele
 * (Extensões → Apps Script). Ele vira um "app da web" que o DRAP Pecuária
 * chama para ler e escrever as abas. Nada passa por servidor nosso: o
 * navegador conversa direto com a planilha, protegido pela senha (token)
 * que só este script e o aparelho conhecem.
 *
 * Protocolo (POST, corpo JSON como text/plain para não exigir preflight):
 *   { token, acao: 'testar' }                          → { ok, nome, url }
 *   { token, acao: 'digest', abas: [nomes] }           → { ok, digest }
 *   { token, acao: 'ler', abas: [nomes] }              → { ok, abas: { nome: valores[][] | null }, digest }
 *   { token, acao: 'escrever', abas: { nome: { valores, colunasTexto } },
 *     esperado: digest, abasLidas: [nomes] }           → { ok, digest } | { ok: false, erro: 'mudou' }
 */

export const VERSAO_SCRIPT = 1;

export function codigoAppsScript(token: string): string {
  return `/**
 * DRAP Pecuária · ponte com esta planilha (versão ${VERSAO_SCRIPT}).
 * Não compartilhe este código: a linha TOKEN é a senha da sua fazenda.
 * Gerado pelo DRAP Pecuária em Planilha → Conectar.
 */
var TOKEN = '${token}';
var VERSAO = ${VERSAO_SCRIPT};

function doGet() {
  return json_({ ok: true, app: 'drap-pecuaria', versao: VERSAO });
}

function doPost(e) {
  var trava = LockService.getDocumentLock();
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN) return json_({ ok: false, erro: 'senha' });
    trava.waitLock(20000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (req.acao === 'testar') return json_({ ok: true, nome: ss.getName(), url: ss.getUrl(), versao: VERSAO });
    if (req.acao === 'digest') return json_({ ok: true, digest: digest_(ss, req.abas) });
    if (req.acao === 'ler') return json_({ ok: true, abas: ler_(ss, req.abas), digest: digest_(ss, req.abas) });
    if (req.acao === 'escrever') {
      var lidas = req.abasLidas || Object.keys(req.abas);
      if (req.esperado && digest_(ss, lidas) !== req.esperado) return json_({ ok: false, erro: 'mudou' });
      if (String(ss.getSpreadsheetLocale()).indexOf('pt') !== 0) ss.setSpreadsheetLocale('pt_BR');
      Object.keys(req.abas).forEach(function (nome) { escrever_(ss, nome, req.abas[nome]); });
      SpreadsheetApp.flush();
      return json_({ ok: true, digest: digest_(ss, lidas) });
    }
    return json_({ ok: false, erro: 'acao' });
  } catch (err) {
    return json_({ ok: false, erro: String(err) });
  } finally {
    try { trava.releaseLock(); } catch (x) {}
  }
}

function norm_(s) {
  return String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\s+/g, ' ').trim();
}

function aba_(ss, nome) {
  var alvo = norm_(nome);
  var abas = ss.getSheets();
  for (var i = 0; i < abas.length; i++) if (norm_(abas[i].getName()) === alvo) return abas[i];
  return null;
}

function valores_(sh) {
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) return [];
  return sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
}

function ler_(ss, nomes) {
  var saida = {};
  (nomes || []).forEach(function (nome) {
    var sh = aba_(ss, nome);
    saida[nome] = sh ? valores_(sh) : null;
  });
  return saida;
}

function digest_(ss, nomes) {
  var partes = (nomes || []).map(function (nome) {
    var sh = aba_(ss, nome);
    return nome + '=' + (sh ? JSON.stringify(valores_(sh)) : '-');
  });
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, partes.join('\\n'), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function escrever_(ss, nome, dados) {
  var sh = aba_(ss, nome) || ss.insertSheet(nome);
  var valores = dados.valores || [];
  var largura = 1;
  valores.forEach(function (l) { if (l.length > largura) largura = l.length; });
  valores = valores.map(function (l) {
    var c = l.slice();
    while (c.length < largura) c.push('');
    return c;
  });
  // fórmulas do produtor que continuam com o mesmo resultado são mantidas
  if (sh.getLastRow() > 0 && sh.getLastColumn() > 0) {
    var faixa = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn());
    var formulas = faixa.getFormulas();
    var vistos = faixa.getDisplayValues();
    for (var i = 0; i < valores.length && i < formulas.length; i++) {
      for (var j = 0; j < largura && j < formulas[i].length; j++) {
        if (formulas[i][j] && String(vistos[i][j]) === String(valores[i][j])) valores[i][j] = formulas[i][j];
      }
    }
    sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).clearContent();
  }
  if (!valores.length) return;
  (dados.colunasTexto || []).forEach(function (c) {
    if (c < largura) sh.getRange(1, c + 1, valores.length, 1).setNumberFormat('@');
  });
  sh.getRange(1, 1, valores.length, largura).setValues(valores);
  sh.getRange(1, 1, 1, largura).setFontWeight('bold');
  sh.getRange(1, 1, valores.length, 1).setFontColor('#8a8a80');
  sh.setFrozenRows(1);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;
}

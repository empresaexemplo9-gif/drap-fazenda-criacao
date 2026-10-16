'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, FileSpreadsheet, Link2, Loader2, RefreshCw, Unplug, Upload } from 'lucide-react';
import { useEstado, estadoAtual, definirPlanilha, configPlanilhaPadrao, aplicarDaPlanilha } from '@/lib/store';
import { ABAS, type Grade } from '@/lib/domain/planilha';
import { codigoAppsScript } from '@/lib/apps-script';
import {
  sincronizarGoogle, testarConexao, urlValida, esquecerConexao, useStatusPlanilha, gradesParaArquivo, gerarXlsx, importarXlsx, baixar, houveAlgo,
} from '@/lib/planilha-sync';
import type { RelatorioPlanilha } from '@/lib/domain/types';
import { PageHeader, Em, Card, Field, Input, Select, Badge, Aviso, Tabela, cx } from '@/components/ui';

/** Como cada aba reconhece o mesmo registro dos dois lados. */
const IDENTIFICA: Record<string, { como: string; dica: string }> = {
  piquetes: { como: 'Nome do piquete', dica: 'área, capim, capacidade, situação' },
  lotes: { como: 'Nome do lote', dica: 'atividade, fase, piquete, cabeças' },
  pessoas: { como: 'Nome da pessoa', dica: 'função, telefone, escala' },
  insumos: { como: 'Nome do insumo', dica: 'categoria, mínimo, consumo, saldo' },
  animais: { como: 'RFID, SISBOV ou brinco', dica: 'sexo, raça, nascimento, lote, pais, situação' },
  pesagens: { como: 'Brinco + data', dica: 'peso e método' },
  lancamentos: { como: 'Data + histórico + valor, ou NF + fornecedor', dica: 'contas, atividade, lote, vencimento, pagamento' },
  documentos: { como: 'Tipo + número', dica: 'GTA, NF, CAR, ITR, vencimento' },
};

const dataHora = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export default function PlanilhaPage() {
  const e = useEstado();
  const st = useStatusPlanilha();
  const cfg = e.planilha;
  const [url, setUrl] = useState(cfg?.url ?? '');
  const [testando, setTestando] = useState(false);
  const [erroConexao, setErroConexao] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [verCodigo, setVerCodigo] = useState(false);
  const [arquivo, setArquivo] = useState<{ rel: RelatorioPlanilha; grades: { nome: string; grade: Grade; colunasTexto: number[] }[] } | null>(null);
  const [processando, setProcessando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  // traz a biblioteca do Excel enquanto há sinal: o service worker guarda e o .xlsx funciona offline
  useEffect(() => { if (navigator.onLine) { const t = setTimeout(() => { void import('exceljs'); }, 1500); return () => clearTimeout(t); } }, []);

  const token = cfg?.token ?? '';
  const conectada = !!cfg?.url;
  /** Cria a configuração (com a senha) na primeira vez e devolve a senha. */
  function preparar(): string {
    if (!estadoAtual().planilha) definirPlanilha(configPlanilhaPadrao());
    return estadoAtual().planilha!.token;
  }

  async function copiar() {
    const t = preparar();
    try {
      await navigator.clipboard.writeText(codigoAppsScript(t));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setVerCodigo(true);
    }
  }

  async function conectar() {
    setErroConexao('');
    const u = url.trim();
    if (!urlValida(u)) { setErroConexao('O endereço deve ser o do app da web e terminar em /exec (https://script.google.com/macros/s/…/exec).'); return; }
    const senha = preparar();
    setTestando(true);
    try {
      const t = await testarConexao(u, senha);
      esquecerConexao();
      definirPlanilha({ url: u, nome: t.nome, link: t.url, base: {} });
      await sincronizarGoogle();
    } catch (err) {
      setErroConexao((err as Error).message);
    } finally {
      setTestando(false);
    }
  }

  function alternarAba(id: string) {
    if (!cfg) return;
    const abas = cfg.abas.includes(id) ? cfg.abas.filter((x) => x !== id) : [...cfg.abas, id];
    if (abas.length) definirPlanilha({ abas });
  }

  async function baixarArquivo() {
    preparar();
    setProcessando(true);
    try {
      const { grades, res } = gradesParaArquivo();
      aplicarDaPlanilha({}, { baseArquivo: res.base });
      baixar(await gerarXlsx(grades), nomeArquivo());
    } finally {
      setProcessando(false);
    }
  }

  async function enviarArquivo(f: File) {
    preparar();
    setProcessando(true);
    try {
      setArquivo(await importarXlsx(await f.arrayBuffer()));
    } catch (err) {
      setArquivo({ rel: { em: new Date().toISOString(), origem: 'arquivo', criadosDrap: 0, atualizadosDrap: 0, criadosPlanilha: 0, atualizadosPlanilha: 0, removidosPlanilha: 0, recolocados: 0, conflitos: 0, erros: [], falha: `Não consegui ler o arquivo: ${(err as Error).message}` }, grades: [] });
    } finally {
      setProcessando(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  const nomeArquivo = () => `DRAP Pecuária - ${e.fazenda.nome || 'Fazenda'} - ${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;

  return (
    <>
      <PageHeader eyebrow="XVIII · Planilha" title={<>Planilha e DRAP <Em>preenchendo um ao outro</Em></>}
        sub="Quem já controla o rebanho numa planilha não precisa abandoná-la. O que for digitado na planilha entra no DRAP Pecuária, e o que for anotado no DRAP aparece na planilha. O mesmo animal, lote ou lançamento é reconhecido dos dois lados pelo brinco, RFID, nome, número do documento ou código."
      />

      {conectada ? (
        <Card eyebrow="Google Planilhas · conectada" title={cfg!.nome ?? 'Planilha'} tone="leaf"
          actions={cfg!.automatica ? <Badge tone="leaf">automática</Badge> : <Badge>manual</Badge>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div><span className="eyebrow">Última troca</span><p className="num mt-1 text-[15px]">{dataHora(cfg!.ultima?.em)}</p></div>
            <div><span className="eyebrow">Última verificação</span><p className="num mt-1 text-[15px]">{st.executando ? 'agora…' : dataHora(st.verificadoEm)}</p></div>
            <div><span className="eyebrow">Abas</span><p className="mt-1 text-[15px]">{ABAS.filter((a) => cfg!.abas.includes(a.id)).map((a) => a.nome).join(', ')}</p></div>
          </div>
          {st.falha ? <div className="mt-4"><Aviso tone="alert" titulo="Não sincronizou">{st.falha}</Aviso></div> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={st.executando} onClick={() => sincronizarGoogle()} data-testid="sincronizar-planilha">
              {st.executando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar agora
            </button>
            {cfg!.link ? <a className="btn btn-ghost" href={cfg!.link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir a planilha</a> : null}
            <button className="btn btn-ghost text-alert" onClick={() => {
              if (confirm('Desconectar a planilha? Nada é apagado: nem no DRAP, nem na planilha.')) { esquecerConexao(); definirPlanilha({ url: undefined, nome: undefined, link: undefined, base: {} }); }
            }}><Unplug className="h-4 w-4" /> Desconectar</button>
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card eyebrow="1 · O que sincroniza" title="Abas da planilha">
          <p className="text-[13px] text-muted">Cada aba da planilha espelha uma área do DRAP. A primeira coluna, <b>ID DRAP</b>, é preenchida pelo sistema: não apague. Linhas novas podem ficar com ela em branco.</p>
          <div className="mt-4 divide-y divide-rule">
            {ABAS.map((a) => {
              const marcada = (cfg?.abas ?? configPlanilhaPadrao().abas).includes(a.id);
              return (
                <label key={a.id} className="flex cursor-pointer items-start gap-3 py-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-leaf" checked={marcada} disabled={!cfg} onChange={() => alternarAba(a.id)} />
                  <span className="min-w-0">
                    <span className="font-semibold">{a.nome}</span>
                    <span className="block text-[12px] text-muted">Reconhece por <b className="text-ink">{IDENTIFICA[a.id].como}</b> · {IDENTIFICA[a.id].dica}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {!cfg ? <button className="btn btn-leaf mt-3" onClick={preparar}>Começar a configurar</button> : null}
        </Card>

        <Card eyebrow="2 · Regras" title="Quando os dois lados mudam">
          <Field label="Se a mesma linha mudou na planilha e no DRAP" dica="vale também na primeira sincronização">
            <Select value={cfg?.politica ?? 'planilha'} disabled={!cfg} onChange={(ev) => definirPlanilha({ politica: ev.target.value as 'planilha' | 'drap' })} opcoes={[
              { value: 'planilha', label: 'Vale a planilha (recomendado)' }, { value: 'drap', label: 'Vale o DRAP Pecuária' },
            ]} />
          </Field>
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-leaf" checked={cfg?.automatica ?? true} disabled={!cfg} onChange={(ev) => definirPlanilha({ automatica: ev.target.checked })} />
            <span><span className="font-semibold">Sincronizar sozinho</span><span className="block text-[12px] text-muted">A cada 2 minutos com o app aberto, ao voltar a ter sinal e logo depois de cada anotação.</span></span>
          </label>
          <ul className="mt-5 space-y-2 text-[13px] leading-relaxed">
            <li>• Mudou só de um lado: esse lado atualiza o outro.</li>
            <li>• Excluído no DRAP: a linha sai da planilha.</li>
            <li>• Linha apagada na planilha <b>não apaga</b> o animal do DRAP: ela volta e o relatório avisa. Para dar baixa, use a coluna Situação (Vendido, Morto…).</li>
            <li>• Erro de digitação (data, lote que não existe): o DRAP não muda e a célula fica como você digitou, com o aviso abaixo.</li>
            <li>• Colunas que você criar na planilha são mantidas.</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-6" eyebrow="3 · Google Planilhas" title={conectada ? 'Trocar de planilha ou republicar o script' : 'Conectar uma planilha do Google'}>
        <ol className="space-y-5 text-[14px] leading-relaxed">
          <li className="flex gap-3"><Passo n={1} /><div>Abra (ou crie) a planilha no <b>Google Planilhas</b>, no computador. Pode ser a que você já usa: o DRAP reconhece colunas como <i>Brinco, Raça, Nascimento, Lote</i> mesmo sem acento ou em outra ordem, e usa nomes de aba como <i>Animais, Lotes, Pesagens</i>.</div></li>
          <li className="flex gap-3"><Passo n={2} /><div>
            No menu, clique em <b>Extensões → Apps Script</b>. Apague o que estiver escrito e cole o código do DRAP:
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn btn-leaf btn-sm" onClick={copiar} data-testid="copiar-script">{copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? 'Código copiado' : 'Copiar o código'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { preparar(); setVerCodigo((v) => !v); }}>{verCodigo ? 'Esconder' : 'Ver o código'}</button>
            </div>
            {verCodigo && token ? (
              <textarea readOnly className="mt-3 h-56 w-full rounded-sm border border-rule bg-paper p-3 font-mono text-[11px]" value={codigoAppsScript(token)} onFocus={(ev) => ev.target.select()} />
            ) : null}
            <p className="mt-2 text-[12px] text-muted">O código tem uma senha só desta fazenda. Não mande para ninguém.</p>
          </div></li>
          <li className="flex gap-3"><Passo n={3} /><div>Clique em <b>Implantar → Nova implantação</b>. Na engrenagem, escolha <b>App da Web</b>. Em <i>Executar como</i>, deixe <b>Eu</b>; em <i>Quem pode acessar</i>, escolha <b>Qualquer pessoa</b>. Clique em <b>Implantar</b> e autorize com a sua conta Google (em “O Google não verificou este app”, vá em <i>Avançado → Acessar</i>).</div></li>
          <li className="flex gap-3"><Passo n={4} /><div className="min-w-0 flex-1">
            Copie o <b>URL do app da web</b> (termina em <span className="font-mono">/exec</span>) e cole aqui:
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={(ev) => setUrl(ev.target.value)} className="flex-1" data-testid="url-script" />
              <button className="btn btn-primary" disabled={testando || !url.trim()} onClick={conectar} data-testid="conectar-planilha">
                {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Conectar e sincronizar
              </button>
            </div>
            {erroConexao ? <p className="mt-2 text-[13px] text-alert">{erroConexao}</p> : null}
          </div></li>
        </ol>
        <div className="mt-5"><Aviso tone="earth" titulo="Por que assim">A planilha fica na sua conta Google e o DRAP conversa direto com ela, sem servidor no meio. Se mudar o código (por exemplo, depois de uma atualização do DRAP), use <b>Implantar → Gerenciar implantações → editar → Nova versão</b>: o endereço continua o mesmo.</Aviso></div>
      </Card>

      <Card className="mt-6" eyebrow="Sem internet" title="Planilha do Excel (.xlsx)" icon={<FileSpreadsheet className="h-5 w-5" />}>
        <p className="text-[14px] leading-relaxed">Baixe a planilha com tudo que está no DRAP, preencha no Excel (ou no celular, sem sinal) e envie de volta. O DRAP lê o que você mudou, junta com o que foi anotado aqui nesse meio-tempo e devolve a planilha atualizada.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-ghost" disabled={processando} onClick={baixarArquivo} data-testid="baixar-xlsx"><Download className="h-4 w-4" /> Baixar planilha (.xlsx)</button>
          <button className="btn btn-ghost" disabled={processando} onClick={() => entrada.current?.click()}><Upload className="h-4 w-4" /> Enviar planilha preenchida</button>
          <input ref={entrada} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" data-testid="enviar-xlsx"
            onChange={(ev) => ev.target.files?.[0] && enviarArquivo(ev.target.files[0])} />
          {processando ? <Loader2 className="h-5 w-5 animate-spin self-center text-earth" /> : null}
        </div>
        {arquivo ? (
          <div className="mt-5" data-testid="relatorio-arquivo">
            <Relatorio rel={arquivo.rel} />
            {arquivo.grades.length ? (
              <button className="btn btn-leaf mt-3" onClick={async () => baixar(await gerarXlsx(arquivo.grades), nomeArquivo())}><Download className="h-4 w-4" /> Baixar a planilha atualizada</button>
            ) : null}
          </div>
        ) : null}
      </Card>

      {cfg?.historico.length ? (
        <Card className="mt-6" eyebrow="Histórico" title="Últimas sincronizações">
          <div className="space-y-5">
            {cfg.historico.slice(0, 6).map((r, i) => <Relatorio key={r.em + i} rel={r} compacto={i > 0} />)}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function Passo({ n }: { n: number }) {
  return <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[13px] text-paper">{n}</span>;
}

function Relatorio({ rel, compacto }: { rel: RelatorioPlanilha; compacto?: boolean }) {
  const itens: [string, string, number][] = [
    ['entrou no DRAP', 'entraram no DRAP', rel.criadosDrap], ['atualizado no DRAP', 'atualizados no DRAP', rel.atualizadosDrap],
    ['foi para a planilha', 'foram para a planilha', rel.criadosPlanilha], ['atualizado na planilha', 'atualizados na planilha', rel.atualizadosPlanilha],
    ['saiu da planilha (excluído no DRAP)', 'saíram da planilha (excluídos no DRAP)', rel.removidosPlanilha],
    ['voltou à planilha (apagado lá)', 'voltaram à planilha (apagados lá)', rel.recolocados],
    ['conflito resolvido pela regra', 'conflitos resolvidos pela regra', rel.conflitos],
  ];
  const ditos = itens.filter(([, , n]) => n > 0);
  return (
    <div className={cx(compacto && 'border-t border-rule pt-4')}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="eyebrow">{rel.origem === 'google' ? 'Google Planilhas' : 'Arquivo Excel'} · {dataHora(rel.em)}</span>
        {rel.falha ? <Badge tone="alert">falhou</Badge> : rel.erros.length ? <Badge tone="warn">{rel.erros.length} linha(s) com erro</Badge> : <Badge tone="leaf">ok</Badge>}
      </div>
      {rel.falha ? <p className="mt-1 text-[13px] text-alert">{rel.falha}</p> : null}
      {!rel.falha ? (
        <p className="mt-1 text-[14px]">{ditos.length ? ditos.map(([um, varios, n]) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`).join(' · ') : houveAlgo(rel) ? '' : 'Tudo igual dos dois lados.'}</p>
      ) : null}
      {rel.erros.length && !compacto ? (
        <Tabela className="mt-3">
          <thead><tr><th>Aba</th><th className="r">Linha</th><th>O que corrigir na planilha</th></tr></thead>
          <tbody>{rel.erros.slice(0, 30).map((x, i) => <tr key={i}><td>{x.aba}</td><td className="r num">{x.linha}</td><td>{x.msg}</td></tr>)}</tbody>
        </Tabela>
      ) : null}
    </div>
  );
}

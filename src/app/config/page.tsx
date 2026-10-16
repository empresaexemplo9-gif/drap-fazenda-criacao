'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Upload, RotateCcw, Eraser, FileSpreadsheet } from 'lucide-react';
import {
  useEstado, definirFazenda, definirModulo, exportarJSON, importarJSON, restaurarDemo, comecarDoZero, sincronizar, URL_SYNC, definirParcial, refazerPerfil,
} from '@/lib/store';
import { brl, isoToBrDate } from '@/lib/format';
import { MODULOS, moduloAtivo, precoTotal, podeDesativar, perfilDe } from '@/lib/domain/modulos';
import { PageHeader, Em, Card, Field, Input, Select, Badge, Aviso, cx } from '@/components/ui';

export default function ConfigPage() {
  const e = useEstado();
  const arq = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const f = e.fazenda;
  const n = (v: string) => Number(v.replace(',', '.')) || 0;

  function baixarBackup() {
    const url = URL.createObjectURL(new Blob([exportarJSON()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `drap-pecuaria-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }
  async function importar(file: File) {
    const r = importarJSON(await file.text());
    setMsg(r.ok ? 'Backup restaurado.' : r.erro);
  }
  async function sync() {
    const r = await sincronizar();
    setMsg(r.modo === 'local' ? 'Sem servidor configurado: os dados ficam neste aparelho. Faça backup regularmente.' : r.erro ?? `${r.enviados} registro(s) enviados ao servidor.`);
  }

  return (
    <div className="mx-auto max-w-reading">
      <PageHeader eyebrow="XVII · Configurações" title={<>Sua fazenda, <Em>seus módulos</Em></>} sub="Núcleo obrigatório e módulos plugáveis com preço próprio. Backup, restauração e sincronização." />

      <Card eyebrow="Fazenda" title="Dados gerais">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <Field label="Nome" className="col-span-2"><Input value={f.nome} onChange={(ev) => definirFazenda({ nome: ev.target.value })} /></Field>
          <Field label="Área total (ha)"><Input inputMode="decimal" value={f.areaTotalHa || ''} onChange={(ev) => definirFazenda({ areaTotalHa: n(ev.target.value) })} /></Field>
          <Field label="Município"><Input value={f.municipio} onChange={(ev) => definirFazenda({ municipio: ev.target.value })} /></Field>
          <Field label="UF"><Input value={f.uf} maxLength={2} onChange={(ev) => definirFazenda({ uf: ev.target.value.toUpperCase() })} /></Field>
          <Field label="Inscrição estadual"><Input value={f.ie ?? ''} onChange={(ev) => definirFazenda({ ie: ev.target.value })} /></Field>
          <Field label="CAR" className="col-span-2 sm:col-span-3"><Input value={f.car ?? ''} onChange={(ev) => definirFazenda({ car: ev.target.value })} /></Field>
          <Field label="Rendimento de carcaça padrão (%)"><Input inputMode="decimal" value={f.rendimentoCarcacaPct} onChange={(ev) => definirFazenda({ rendimentoCarcacaPct: n(ev.target.value) })} /></Field>
          <Field label="Funrural (%)" dica="PF: 1,5% (1,2 + 0,1 RAT + 0,2 Senar)"><Input inputMode="decimal" value={f.funruralPct} onChange={(ev) => definirFazenda({ funruralPct: n(ev.target.value) })} /></Field>
          <Field label="Vacina contra aftosa?"><Select value={f.vacinaAftosa ? '1' : '0'} onChange={(ev) => definirFazenda({ vacinaAftosa: ev.target.value === '1' })} opcoes={[{ value: '0', label: 'Não (zona livre sem vacinação)' }, { value: '1', label: 'Sim (campanha estadual)' }]} /></Field>
          <Field label="Raiva endêmica na região?"><Select value={f.raivaEndemica ? '1' : '0'} onChange={(ev) => definirFazenda({ raivaEndemica: ev.target.value === '1' })} opcoes={[{ value: '1', label: 'Sim' }, { value: '0', label: 'Não' }]} /></Field>
        </div>
      </Card>

      <Card className="mt-6" eyebrow={`Assinatura de referência · ${brl(precoTotal(e.modulos))}/mês`} title={`Módulos · ${perfilDe(e.modulos)?.nome ?? ''}`}
        actions={<button className="text-[12px] font-medium text-earth hover:text-ink" onClick={refazerPerfil}>refazer escolha</button>}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {MODULOS.map((m) => {
            const on = moduloAtivo(e.modulos, m.id);
            return (
              <div key={m.id} className={cx('rounded-sm border p-4', on ? 'border-leaf/60 bg-leafLt/30' : 'border-rule/70')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold">{m.nome}</h3>
                    <p className="num text-[12px] text-earth">{brl(m.precoMes)}/mês</p>
                  </div>
                  {m.obrigatorio ? <Badge tone="ink">incluso</Badge> : (
                    <button type="button" role="switch" aria-checked={on} onClick={() => definirModulo(m.id, !on)} disabled={on && !podeDesativar(e.modulos, m.id)}
                      title={on && !podeDesativar(e.modulos, m.id) ? 'A fazenda precisa de pelo menos uma atividade' : undefined}
                      className={cx('relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60', on ? 'bg-leaf' : 'bg-rule')} aria-label={`Ativar ${m.nome}`}>
                      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-paper transition-all', on ? 'left-[22px]' : 'left-0.5')} />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[13px] text-muted">{m.resumo}</p>
                <ul className="mt-2 flex flex-wrap gap-1">{m.recursos.map((r) => <li key={r} className="rounded-sm bg-paper px-1.5 py-0.5 text-[11px] text-muted">{r}</li>)}</ul>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[12px] text-muted">Cada produtor contrata só o que faz: uma atividade, duas ou as três. Desligar um módulo esconde as telas e os lotes dele, sem apagar dados. Pelo menos um módulo produtivo fica ligado. Preços são hipóteses de pesquisa para validar na feira.</p>
      </Card>

      <Card className="mt-6" eyebrow="Laticínio" title="Tabela de pagamento do leite">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Field label="Laticínio" className="col-span-2"><Input value={e.tabelaLaticinio.laticinio} onChange={(ev) => definirParcial({ tabelaLaticinio: { ...e.tabelaLaticinio, laticinio: ev.target.value } })} /></Field>
          <Field label="Preço base (R$/L)"><Input inputMode="decimal" value={e.tabelaLaticinio.precoBase} onChange={(ev) => definirParcial({ tabelaLaticinio: { ...e.tabelaLaticinio, precoBase: n(ev.target.value) } })} /></Field>
          <Field label="Bônus gordura (R$/0,1 p.p.)"><Input inputMode="decimal" value={e.tabelaLaticinio.bonusGorduraPorPonto} onChange={(ev) => definirParcial({ tabelaLaticinio: { ...e.tabelaLaticinio, bonusGorduraPorPonto: n(ev.target.value) } })} /></Field>
        </div>
        <p className="mt-3 text-[12px] text-muted">Faixas de CCS e CBT: {e.tabelaLaticinio.faixasCcs.map((x) => `≤${x.ate} ${x.ajuste >= 0 ? '+' : ''}${x.ajuste}`).join(' · ')} | {e.tabelaLaticinio.faixasCbt.map((x) => `≤${x.ate} ${x.ajuste >= 0 ? '+' : ''}${x.ajuste}`).join(' · ')}</p>
      </Card>

      <Card className="mt-6" eyebrow="Dados" title="Backup e sincronização">
        <dl className="mb-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <div><dt className="eyebrow text-muted">Modo</dt><dd>{URL_SYNC ? 'Servidor' : 'Local (aparelho)'}</dd></div>
          <div><dt className="eyebrow text-muted">Pendências</dt><dd className="num">{e.pendentes.length}</dd></div>
          <div><dt className="eyebrow text-muted">Última sincronização</dt><dd className="num">{e.ultimaSincronizacao ? isoToBrDate(e.ultimaSincronizacao.slice(0, 10)) : '—'}</dd></div>
          <div><dt className="eyebrow text-muted">Animais</dt><dd className="num">{e.animais.length}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={sync}>Sincronizar agora</button>
          <button className="btn btn-ghost" onClick={baixarBackup}><Download className="h-4 w-4" /> Baixar backup (.json)</button>
          <button className="btn btn-ghost" onClick={() => arq.current?.click()}><Upload className="h-4 w-4" /> Restaurar backup</button>
          <Link className="btn btn-ghost" href="/planilha/"><FileSpreadsheet className="h-4 w-4" /> Sincronizar com planilha</Link>
          <input ref={arq} type="file" accept="application/json" className="hidden" onChange={(ev) => ev.target.files?.[0] && importar(ev.target.files[0])} />
        </div>
        {msg ? <p className="mt-3 text-[13px] text-leafDk">{msg}</p> : null}
        <div className="mt-5"><Aviso tone="warn" titulo="Fase piloto">Sem servidor, os dados vivem só neste navegador. Baixe o backup toda semana. A sincronização com o servidor (schema em supabase/migrations) liga quando a variável NEXT_PUBLIC_DRAP_SYNC_URL estiver configurada.</Aviso></div>
      </Card>

      <Card className="mt-6" eyebrow="Demonstração" title="Fazenda de exemplo">
        <p className="text-[13px] text-muted">A Fazenda Boa Vista é fictícia. A demo é montada só com as atividades ligadas acima ({perfilDe(e.modulos)?.nome ?? '—'}). Ligue ou desligue módulos e recarregue para ver cada perfil.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => { if (confirm('Substituir todos os dados pela fazenda de demonstração deste perfil?')) restaurarDemo(); }}><RotateCcw className="h-4 w-4" /> Recarregar demo deste perfil</button>
          <button className="btn btn-ghost text-alert" onClick={() => { if (confirm('Apagar todos os dados deste aparelho e começar do zero? Baixe um backup antes.')) comecarDoZero(); }}><Eraser className="h-4 w-4" /> Começar do zero</button>
        </div>
      </Card>
    </div>
  );
}

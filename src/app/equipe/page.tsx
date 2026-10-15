'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useEstado, salvar, atualizar, novoId, definirOperador } from '@/lib/store';
import { useHoje } from '@/lib/hooks';
import { isoToBrDate } from '@/lib/format';
import { addDias } from '@/lib/datas';
import { ROT_FUNCAO, opcoes } from '@/lib/rotulos';
import type { Colecoes, Pessoa } from '@/lib/domain/types';
import { PageHeader, Em, Card, Tabela, Badge, Field, Input, Select, Modal, Aviso } from '@/components/ui';

const ROT_COLECAO: Partial<Record<keyof Colecoes, string>> = {
  pesagens: 'Pesagens', sanidade: 'Aplicações', movimentacoes: 'Movimentações', ordenhas: 'Ordenhas', reproducao: 'Eventos reprodutivos',
  movEstoque: 'Movimentos de estoque', lancamentos: 'Lançamentos', animais: 'Animais cadastrados', leiturasCocho: 'Leituras de cocho',
  ocorrencias: 'Ocorrências', eventos: 'Tarefas',
};

export default function EquipePage() {
  const e = useEstado();
  const hoje = useHoje();
  const [edit, setEdit] = useState<Pessoa | null>(null);
  const de = addDias(hoje, -30);

  const apont = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    const ult = new Map<string, string>();
    for (const k of Object.keys(ROT_COLECAO) as (keyof Colecoes)[]) {
      for (const r of e[k] as { por?: string; em?: string; data?: string }[]) {
        if (!r.por) continue;
        const data = r.data ?? r.em?.slice(0, 10) ?? '';
        if (data < de) continue;
        const acc = m.get(r.por) ?? {};
        acc[k] = (acc[k] ?? 0) + 1;
        m.set(r.por, acc);
        if (!ult.has(r.por) || data > ult.get(r.por)!) ult.set(r.por, data);
      }
    }
    return { m, ult };
  }, [e, de]);

  return (
    <>
      <PageHeader eyebrow="XI · Equipe" title={<>O conhecimento <Em>fica na fazenda</Em></>}
        sub="Cada pesagem, vacina e ordenha leva o nome de quem anotou. Quando o vaqueiro sai, o histórico continua."
        actions={<button className="btn btn-primary" onClick={() => setEdit({ id: novoId('p'), nome: '', funcao: 'vaqueiro', ativo: true })}><Plus className="h-4 w-4" /> Pessoa</button>} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {e.pessoas.map((p) => {
          const a = apont.m.get(p.id) ?? {};
          const total = Object.values(a).reduce((s, x) => s + x, 0);
          return (
            <Card key={p.id} eyebrow={ROT_FUNCAO[p.funcao]} title={p.nome}
              actions={<>{e.operadorId === p.id ? <Badge tone="leaf">neste aparelho</Badge> : null}{!p.ativo ? <Badge>inativo</Badge> : null}</>}>
              <p className="text-[12.5px] text-muted">{p.telefone ?? 'sem telefone'}{p.escala ? ` · ${p.escala}` : ''}</p>
              <div className="mt-3">
                <span className="eyebrow text-muted">Apontamentos · 30 dias</span>
                <p className="num mt-1 text-2xl">{total}</p>
                <ul className="mt-1 text-[12.5px] text-muted">
                  {Object.entries(a).sort((x, y) => y[1] - x[1]).map(([k, v]) => <li key={k}>{ROT_COLECAO[k as keyof Colecoes]}: <span className="num text-ink">{v}</span></li>)}
                </ul>
                {apont.ult.get(p.id) ? <p className="mt-2 text-[11.5px] text-muted">Último registro em {isoToBrDate(apont.ult.get(p.id)!)}</p> : null}
              </div>
              <div className="mt-4 flex gap-3 text-[12px]">
                <button className="font-medium text-earth hover:text-ink" onClick={() => setEdit(p)}>editar</button>
                {e.operadorId !== p.id && p.ativo ? <button className="font-medium text-earth hover:text-ink" onClick={() => definirOperador(p.id)}>usar neste aparelho</button> : null}
                <button className="font-medium text-muted hover:text-ink" onClick={() => atualizar('pessoas', p.id, { ativo: !p.ativo })}>{p.ativo ? 'desligar' : 'reativar'}</button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6" eyebrow="Escala" title="Turnos e responsabilidades">
        <Tabela>
          <thead><tr><th>Pessoa</th><th>Função</th><th>Escala</th><th>Situação</th></tr></thead>
          <tbody>{e.pessoas.map((p) => <tr key={p.id}><td>{p.nome}</td><td className="text-muted">{ROT_FUNCAO[p.funcao]}</td><td>{p.escala ?? '—'}</td><td>{p.ativo ? <Badge tone="leaf">ativo</Badge> : <Badge>inativo</Badge>}</td></tr>)}</tbody>
        </Tabela>
      </Card>

      <div className="mt-6"><Aviso tone="earth" titulo="Acesso por pessoa">No piloto cada aparelho escolhe quem está anotando (canto superior). Com o servidor de sincronização ligado, cada pessoa terá login próprio e permissões por tela, como no DRAP Fazenda.</Aviso></div>

      {edit ? (
        <Modal aberto onFechar={() => setEdit(null)} titulo={edit.nome || 'Nova pessoa'} eyebrow="Equipe">
          <div className="grid grid-cols-2 gap-5">
            <Field label="Nome" className="col-span-2"><Input value={edit.nome} onChange={(ev) => setEdit({ ...edit, nome: ev.target.value })} /></Field>
            <Field label="Função"><Select value={edit.funcao} onChange={(ev) => setEdit({ ...edit, funcao: ev.target.value as Pessoa['funcao'] })} opcoes={opcoes(ROT_FUNCAO)} /></Field>
            <Field label="Telefone"><Input value={edit.telefone ?? ''} onChange={(ev) => setEdit({ ...edit, telefone: ev.target.value })} /></Field>
            <Field label="Escala / turno" className="col-span-2"><Input value={edit.escala ?? ''} onChange={(ev) => setEdit({ ...edit, escala: ev.target.value })} placeholder="ex.: ordenha 5h e 15h" /></Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn btn-primary" disabled={!edit.nome.trim()} onClick={() => { salvar('pessoas', edit); setEdit(null); }}>Salvar</button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

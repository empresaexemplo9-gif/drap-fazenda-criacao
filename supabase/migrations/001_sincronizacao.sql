-- =====================================================================
-- DRAP Pecuária · servidor de sincronização (fase 2)
--
-- O app é offline-first: cada aparelho guarda o estado completo e uma fila
-- de pendências (upsert/delete por coleção). Este schema recebe essa fila
-- sem impor o modelo relacional agora: cada registro vira uma linha JSONB
-- por (fazenda, coleção, id). Assim o mesmo contrato serve rebanho,
-- livro-razão, sanidade etc., e o modelo pode ser normalizado depois sem
-- quebrar os aparelhos em campo.
--
-- Mesma infraestrutura do DRAP Fazenda (Supabase/Postgres), em projeto
-- separado ou no mesmo, com isolamento por fazenda via RLS.
-- =====================================================================

CREATE TABLE fazendas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        TEXT NOT NULL,
    uf          CHAR(2),
    modulos     JSONB NOT NULL DEFAULT '{"core": true, "corte": true, "leite": false, "genetica": false}',
    criada_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE papel_membro AS ENUM ('proprietario', 'gerente', 'operador', 'leitura');

CREATE TABLE membros (
    fazenda_id  UUID NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    papel       papel_membro NOT NULL DEFAULT 'operador',
    pessoa_id   TEXT,                       -- Pessoa.id no app (assina os registros)
    PRIMARY KEY (fazenda_id, user_id)
);

-- Um registro por (fazenda, coleção, id do app). `dados` é o objeto inteiro.
CREATE TABLE registros (
    fazenda_id    UUID NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
    colecao       TEXT NOT NULL CHECK (colecao IN (
                    'animais','lotes','piquetes','pesagens','movimentacoes','ocorrencias','sanidade',
                    'insumos','movEstoque','lancamentos','eventos','documentos','pessoas','cotacoes',
                    'dietas','leiturasCocho','vendas','ordenhas','analisesLeite','mastites','reproducao',
                    'avaliacoes','provas','estoqueGenetico','acasalamentos','anuncios','interessados')),
    registro_id   TEXT NOT NULL,
    dados         JSONB,                     -- NULL quando excluído (tombstone)
    excluido      BOOLEAN NOT NULL DEFAULT FALSE,
    por           TEXT,                      -- Pessoa.id que anotou
    alterado_em   TIMESTAMPTZ NOT NULL,      -- carimbo do aparelho (Pendente.em)
    recebido_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (fazenda_id, colecao, registro_id)
);

CREATE INDEX registros_recebido_idx ON registros (fazenda_id, recebido_em);
CREATE INDEX registros_lancamentos_data_idx ON registros (fazenda_id, ((dados->>'data')))
    WHERE colecao = 'lancamentos';

-- Trilha de auditoria: cada envio fica guardado (quem mudou o quê, quando).
CREATE TABLE auditoria (
    id            BIGSERIAL PRIMARY KEY,
    fazenda_id    UUID NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
    user_id       UUID,
    colecao       TEXT NOT NULL,
    registro_id   TEXT NOT NULL,
    op            TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
    dados         JSONB,
    em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aplica um lote de pendências. Conflito: vence a alteração mais recente
-- do aparelho (last-writer-wins por registro), o que basta para o campo,
-- onde cada registro (pesagem, ordenha) costuma ter um único autor.
CREATE OR REPLACE FUNCTION aplicar_pendencias(p_fazenda UUID, p_registros JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
    r JSONB;
    n INTEGER := 0;
BEGIN
    FOR r IN SELECT * FROM jsonb_array_elements(p_registros) LOOP
        INSERT INTO registros AS t (fazenda_id, colecao, registro_id, dados, excluido, por, alterado_em)
        VALUES (
            p_fazenda, r->>'colecao', r->>'registroId',
            CASE WHEN r->>'op' = 'delete' THEN NULL ELSE r->'dados' END,
            r->>'op' = 'delete', r->'dados'->>'por', (r->>'em')::timestamptz
        )
        ON CONFLICT (fazenda_id, colecao, registro_id) DO UPDATE
            SET dados = EXCLUDED.dados, excluido = EXCLUDED.excluido, por = EXCLUDED.por,
                alterado_em = EXCLUDED.alterado_em, recebido_em = NOW()
            WHERE t.alterado_em <= EXCLUDED.alterado_em;
        INSERT INTO auditoria (fazenda_id, user_id, colecao, registro_id, op, dados)
        VALUES (p_fazenda, auth.uid(), r->>'colecao', r->>'registroId', r->>'op', r->'dados');
        n := n + 1;
    END LOOP;
    RETURN n;
END;
$$;

-- ========== RLS: cada usuário só enxerga as fazendas de que é membro ==========

ALTER TABLE fazendas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros   ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION eh_membro(p_fazenda UUID, p_papeis papel_membro[] DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM membros
        WHERE fazenda_id = p_fazenda AND user_id = auth.uid()
          AND (p_papeis IS NULL OR papel = ANY (p_papeis))
    );
$$;

CREATE POLICY fazendas_ler ON fazendas FOR SELECT USING (eh_membro(id));
CREATE POLICY fazendas_editar ON fazendas FOR UPDATE USING (eh_membro(id, ARRAY['proprietario']::papel_membro[]));

CREATE POLICY membros_ler ON membros FOR SELECT USING (eh_membro(fazenda_id));
CREATE POLICY membros_gerir ON membros FOR ALL USING (eh_membro(fazenda_id, ARRAY['proprietario']::papel_membro[]));

CREATE POLICY registros_ler ON registros FOR SELECT USING (eh_membro(fazenda_id));
CREATE POLICY registros_gravar ON registros FOR INSERT
    WITH CHECK (eh_membro(fazenda_id, ARRAY['proprietario','gerente','operador']::papel_membro[]));
CREATE POLICY registros_atualizar ON registros FOR UPDATE
    USING (eh_membro(fazenda_id, ARRAY['proprietario','gerente','operador']::papel_membro[]));
-- Operador de campo não mexe no livro-razão: só proprietário e gerente.
CREATE POLICY registros_financeiro ON registros AS RESTRICTIVE FOR ALL
    USING (colecao <> 'lancamentos' OR eh_membro(fazenda_id, ARRAY['proprietario','gerente','leitura']::papel_membro[]))
    WITH CHECK (colecao <> 'lancamentos' OR eh_membro(fazenda_id, ARRAY['proprietario','gerente']::papel_membro[]));

CREATE POLICY auditoria_ler ON auditoria FOR SELECT USING (eh_membro(fazenda_id, ARRAY['proprietario','gerente']::papel_membro[]));
CREATE POLICY auditoria_gravar ON auditoria FOR INSERT WITH CHECK (eh_membro(fazenda_id));

CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  documento VARCHAR(18),
  email VARCHAR(255),
  telefone VARCHAR(20),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_empresas_nome ON empresas (nome);
CREATE INDEX IF NOT EXISTS idx_empresas_documento ON empresas (documento);
CREATE INDEX IF NOT EXISTS idx_empresas_ativo ON empresas (ativo);

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_tipo_usuario_check
  CHECK (tipo_usuario IN ('colaborador', 'motorista', 'operador', 'financeiro', 'administrador'));

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE entrega_eventos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE motoristas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE veiculos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE rotas_operacionais
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE rota_entregas
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE comprovantes
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE chamados_suporte
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE avisos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

ALTER TABLE configuracoes_usuario
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON usuarios (empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_entregas_empresa_id ON entregas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_entrega_eventos_empresa_id ON entrega_eventos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_motoristas_empresa_id ON motoristas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_empresa_id ON veiculos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_rotas_empresa_id ON rotas_operacionais (empresa_id);
CREATE INDEX IF NOT EXISTS idx_rota_entregas_empresa_id ON rota_entregas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_comprovantes_empresa_id ON comprovantes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_empresa_id ON lancamentos_financeiros (empresa_id);
CREATE INDEX IF NOT EXISTS idx_documentos_empresa_id ON documentos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_suporte_empresa_id ON chamados_suporte (empresa_id);
CREATE INDEX IF NOT EXISTS idx_avisos_empresa_id ON avisos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_empresa_id ON configuracoes_usuario (empresa_id);

WITH usuarios_sem_empresa AS (
  SELECT
    u.id AS usuario_id,
    u.nome,
    u.cpf,
    u.email,
    u.telefone
  FROM usuarios u
  WHERE u.empresa_id IS NULL
),
empresas_criadas AS (
  INSERT INTO empresas (nome, documento, email, telefone, ativo)
  SELECT
    CASE
      WHEN TRIM(COALESCE(nome, '')) <> '' THEN CONCAT('Empresa de ', nome)
      ELSE 'Empresa Principal'
    END AS nome,
    NULLIF(cpf, ''),
    NULLIF(email, ''),
    NULLIF(telefone, ''),
    TRUE
  FROM usuarios_sem_empresa
  RETURNING id
),
usuarios_ordenados AS (
  SELECT
    usuario_id,
    ROW_NUMBER() OVER (ORDER BY usuario_id) AS ordem
  FROM usuarios_sem_empresa
),
empresas_ordenadas AS (
  SELECT
    id AS empresa_id,
    ROW_NUMBER() OVER (ORDER BY id) AS ordem
  FROM empresas_criadas
)
UPDATE usuarios u
SET empresa_id = eo.empresa_id
FROM usuarios_ordenados uo
INNER JOIN empresas_ordenadas eo
  ON eo.ordem = uo.ordem
WHERE u.id = uo.usuario_id
  AND u.empresa_id IS NULL;

UPDATE clientes c
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE c.empresa_id IS NULL
  AND c.usuario_id = u.id
  AND u.empresa_id IS NOT NULL;

UPDATE entregas e
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE e.empresa_id IS NULL
  AND e.usuario_id = u.id
  AND u.empresa_id IS NOT NULL;

UPDATE motoristas m
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE m.empresa_id IS NULL
  AND m.usuario_id = u.id
  AND u.empresa_id IS NOT NULL;

UPDATE veiculos v
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE v.empresa_id IS NULL
  AND v.usuario_id = u.id
  AND u.empresa_id IS NOT NULL;

UPDATE rotas_operacionais r
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE r.empresa_id IS NULL
  AND r.usuario_id = u.id
  AND u.empresa_id IS NOT NULL;

UPDATE rota_entregas re
SET empresa_id = origem.empresa_id
FROM (
  SELECT
    re_base.id,
    COALESCE(r.empresa_id, e.empresa_id, u.empresa_id) AS empresa_id
  FROM rota_entregas re_base
  LEFT JOIN rotas_operacionais r
    ON r.id = re_base.rota_id
  LEFT JOIN entregas e
    ON e.id = re_base.entrega_id
  LEFT JOIN usuarios u
    ON u.id = re_base.usuario_id
  WHERE re_base.empresa_id IS NULL
) AS origem
WHERE re.id = origem.id
  AND re.empresa_id IS NULL
  AND origem.empresa_id IS NOT NULL;

UPDATE comprovantes c
SET empresa_id = origem.empresa_id
FROM (
  SELECT
    c_base.id,
    COALESCE(e.empresa_id, u.empresa_id) AS empresa_id
  FROM comprovantes c_base
  LEFT JOIN entregas e
    ON e.id = c_base.entrega_id
  LEFT JOIN usuarios u
    ON u.id = c_base.usuario_id
  WHERE c_base.empresa_id IS NULL
) AS origem
WHERE c.id = origem.id
  AND c.empresa_id IS NULL
  AND origem.empresa_id IS NOT NULL;

UPDATE lancamentos_financeiros lf
SET empresa_id = origem.empresa_id
FROM (
  SELECT
    lf_base.id,
    COALESCE(c.empresa_id, e.empresa_id, u.empresa_id) AS empresa_id
  FROM lancamentos_financeiros lf_base
  LEFT JOIN usuarios u
    ON u.id = lf_base.usuario_id
  LEFT JOIN clientes c
    ON c.id = lf_base.cliente_id
  LEFT JOIN entregas e
    ON e.id = lf_base.entrega_id
  WHERE lf_base.empresa_id IS NULL
) AS origem
WHERE lf.id = origem.id
  AND lf.empresa_id IS NULL
  AND origem.empresa_id IS NOT NULL;

UPDATE documentos d
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE d.empresa_id IS NULL
  AND d.usuario_id = u.id
  AND u.empresa_id IS NOT NULL;

UPDATE chamados_suporte cs
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE cs.empresa_id IS NULL
  AND cs.usuario_id = u.id
  AND u.empresa_id IS NOT NULL;

UPDATE configuracoes_usuario cu
SET empresa_id = u.empresa_id
FROM usuarios u
WHERE cu.empresa_id IS NULL
  AND cu.usuario_id = u.id
  AND u.empresa_id IS NOT NULL;

UPDATE entrega_eventos ee
SET empresa_id = origem.empresa_id
FROM (
  SELECT
    ee_base.id,
    COALESCE(e.empresa_id, u.empresa_id) AS empresa_id
  FROM entrega_eventos ee_base
  LEFT JOIN entregas e
    ON e.id = ee_base.entrega_id
  LEFT JOIN usuarios u
    ON u.id = ee_base.usuario_id
  WHERE ee_base.empresa_id IS NULL
) AS origem
WHERE ee.id = origem.id
  AND ee.empresa_id IS NULL
  AND origem.empresa_id IS NOT NULL;

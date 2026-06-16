ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS razao_social VARCHAR(150),
  ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(150),
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18),
  ADD COLUMN IF NOT EXISTS endereco VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(120),
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
  ADD COLUMN IF NOT EXISTS cep VARCHAR(9),
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

UPDATE empresas
SET
  razao_social = COALESCE(NULLIF(razao_social, ''), nome),
  nome_fantasia = COALESCE(NULLIF(nome_fantasia, ''), nome),
  cnpj = COALESCE(
    NULLIF(cnpj, ''),
    CASE
      WHEN LENGTH(REGEXP_REPLACE(COALESCE(documento, ''), '\D', '', 'g')) = 14 THEN documento
      ELSE NULL
    END
  ),
  status = COALESCE(NULLIF(status, ''), CASE WHEN ativo THEN 'ativo' ELSE 'inativo' END)
WHERE razao_social IS NULL
   OR nome_fantasia IS NULL
   OR cnpj IS NULL
   OR status IS NULL;

ALTER TABLE empresas
  ALTER COLUMN razao_social SET NOT NULL;

ALTER TABLE empresas
  ALTER COLUMN nome_fantasia SET NOT NULL;

ALTER TABLE empresas
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE empresas
  DROP CONSTRAINT IF EXISTS empresas_status_check;

ALTER TABLE empresas
  ADD CONSTRAINT empresas_status_check
  CHECK (status IN ('ativo', 'inativo'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_empresas_cnpj
  ON empresas (cnpj)
  WHERE cnpj IS NOT NULL;

CREATE TABLE IF NOT EXISTS configuracoes_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Sao_Paulo',
  moeda VARCHAR(10) NOT NULL DEFAULT 'BRL',
  formato_data VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
  dashboard_periodo_padrao VARCHAR(20) NOT NULL DEFAULT '7d',
  dashboard_exibir_financeiro BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_configuracoes_empresa_empresa_id
  ON configuracoes_empresa (empresa_id);

INSERT INTO configuracoes_empresa (empresa_id)
SELECT e.id
FROM empresas e
WHERE NOT EXISTS (
  SELECT 1
  FROM configuracoes_empresa ce
  WHERE ce.empresa_id = e.id
);

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_tipo_usuario_check
  CHECK (tipo_usuario IN ('colaborador', 'motorista', 'operador', 'financeiro', 'gestor', 'administrador'));

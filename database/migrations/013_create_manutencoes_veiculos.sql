CREATE TABLE IF NOT EXISTS manutencoes_veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  veiculo_id UUID NOT NULL REFERENCES veiculos(id),
  despesa_veiculo_id UUID REFERENCES despesas_veiculos(id) ON DELETE SET NULL,
  tipo VARCHAR(40) NOT NULL,
  descricao VARCHAR(160) NOT NULL,
  custo NUMERIC(12, 2) NOT NULL,
  data_manutencao DATE NOT NULL,
  proxima_manutencao DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'agendada',
  observacoes TEXT,
  integrar_financeiro BOOLEAN NOT NULL DEFAULT TRUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manutencoes_veiculos_status_check
    CHECK (status IN ('agendada', 'em_execucao', 'concluida', 'cancelada'))
);

ALTER TABLE manutencoes_veiculos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS despesa_veiculo_id UUID REFERENCES despesas_veiculos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(40),
  ADD COLUMN IF NOT EXISTS descricao VARCHAR(160),
  ADD COLUMN IF NOT EXISTS custo NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS data_manutencao DATE,
  ADD COLUMN IF NOT EXISTS proxima_manutencao DATE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'agendada',
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS integrar_financeiro BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE manutencoes_veiculos mv
SET empresa_id = origem.empresa_id
FROM (
  SELECT
    mv_base.id,
    COALESCE(v.empresa_id, u.empresa_id) AS empresa_id
  FROM manutencoes_veiculos mv_base
  LEFT JOIN veiculos v
    ON v.id = mv_base.veiculo_id
  LEFT JOIN usuarios u
    ON u.id = mv_base.usuario_id
  WHERE mv_base.empresa_id IS NULL
) AS origem
WHERE mv.id = origem.id
  AND mv.empresa_id IS NULL
  AND origem.empresa_id IS NOT NULL;

ALTER TABLE manutencoes_veiculos
  ALTER COLUMN tipo SET NOT NULL,
  ALTER COLUMN descricao SET NOT NULL,
  ALTER COLUMN custo SET NOT NULL,
  ALTER COLUMN data_manutencao SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE manutencoes_veiculos
  DROP CONSTRAINT IF EXISTS manutencoes_veiculos_status_check;

ALTER TABLE manutencoes_veiculos
  ADD CONSTRAINT manutencoes_veiculos_status_check
  CHECK (status IN ('agendada', 'em_execucao', 'concluida', 'cancelada'));

CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculos_empresa_id ON manutencoes_veiculos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculos_usuario_id ON manutencoes_veiculos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculos_veiculo_id ON manutencoes_veiculos (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculos_status ON manutencoes_veiculos (status);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculos_data_manutencao ON manutencoes_veiculos (data_manutencao);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculos_proxima_manutencao ON manutencoes_veiculos (proxima_manutencao);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculos_ativo ON manutencoes_veiculos (ativo);

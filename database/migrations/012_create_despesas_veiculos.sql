CREATE TABLE IF NOT EXISTS despesas_veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  veiculo_id UUID NOT NULL REFERENCES veiculos(id),
  motorista_id UUID REFERENCES motoristas(id) ON DELETE SET NULL,
  lancamento_financeiro_id UUID UNIQUE REFERENCES lancamentos_financeiros(id) ON DELETE SET NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('abastecimento', 'pedagio', 'manutencao', 'seguro', 'multa', 'outros')),
  descricao VARCHAR(160) NOT NULL,
  valor NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  data_despesa DATE NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE despesas_veiculos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motorista_id UUID REFERENCES motoristas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lancamento_financeiro_id UUID UNIQUE REFERENCES lancamentos_financeiros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS descricao VARCHAR(160),
  ADD COLUMN IF NOT EXISTS valor NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS data_despesa DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE despesas_veiculos dv
SET empresa_id = origem.empresa_id
FROM (
  SELECT
    dv_base.id,
    COALESCE(v.empresa_id, m.empresa_id, u.empresa_id) AS empresa_id
  FROM despesas_veiculos dv_base
  LEFT JOIN usuarios u
    ON u.id = dv_base.usuario_id
  LEFT JOIN veiculos v
    ON v.id = dv_base.veiculo_id
  LEFT JOIN motoristas m
    ON m.id = dv_base.motorista_id
  WHERE dv_base.empresa_id IS NULL
) AS origem
WHERE dv.id = origem.id
  AND dv.empresa_id IS NULL
  AND origem.empresa_id IS NOT NULL;

UPDATE despesas_veiculos
SET status = CASE
  WHEN ativo = FALSE THEN 'cancelado'
  WHEN data_pagamento IS NOT NULL THEN 'pago'
  ELSE 'pendente'
END
WHERE status IS NULL;

ALTER TABLE despesas_veiculos
  ALTER COLUMN tipo SET NOT NULL,
  ALTER COLUMN descricao SET NOT NULL,
  ALTER COLUMN valor SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pendente',
  ALTER COLUMN data_despesa SET NOT NULL;

ALTER TABLE despesas_veiculos
  DROP CONSTRAINT IF EXISTS despesas_veiculos_status_check;

ALTER TABLE despesas_veiculos
  DROP CONSTRAINT IF EXISTS despesas_veiculos_tipo_check;

ALTER TABLE despesas_veiculos
  ADD CONSTRAINT despesas_veiculos_tipo_check
  CHECK (tipo IN ('abastecimento', 'pedagio', 'manutencao', 'seguro', 'multa', 'outros'));

ALTER TABLE despesas_veiculos
  ADD CONSTRAINT despesas_veiculos_status_check
  CHECK (status IN ('pendente', 'pago', 'cancelado'));

ALTER TABLE despesas_veiculos
  DROP CONSTRAINT IF EXISTS despesas_veiculos_valor_positivo_check;

ALTER TABLE despesas_veiculos
  ADD CONSTRAINT despesas_veiculos_valor_positivo_check
  CHECK (valor > 0);

CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_empresa_id ON despesas_veiculos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_usuario_id ON despesas_veiculos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_veiculo_id ON despesas_veiculos (veiculo_id);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_motorista_id ON despesas_veiculos (motorista_id);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_tipo ON despesas_veiculos (tipo);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_status ON despesas_veiculos (status);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_data_despesa ON despesas_veiculos (data_despesa);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_ativo ON despesas_veiculos (ativo);

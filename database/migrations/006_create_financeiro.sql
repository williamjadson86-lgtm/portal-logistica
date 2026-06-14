CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  entrega_id UUID REFERENCES entregas(id) ON DELETE SET NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('receita', 'despesa', 'repasse')),
  descricao VARCHAR(160) NOT NULL,
  valor NUMERIC(12, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'faturado', 'pago', 'cancelado')),
  data_competencia DATE NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entrega_id UUID REFERENCES entregas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'lancamentos_financeiros'
      AND column_name = 'referencia_mes'
  ) THEN
    EXECUTE $sql$
      UPDATE lancamentos_financeiros
      SET
        tipo = COALESCE(tipo, 'receita'),
        data_competencia = COALESCE(data_competencia, referencia_mes, CURRENT_DATE),
        status = CASE status
          WHEN 'previsto' THEN 'pendente'
          WHEN 'processando' THEN 'faturado'
          ELSE COALESCE(status, 'pendente')
        END,
        atualizado_em = COALESCE(atualizado_em, criado_em, NOW())
      WHERE
        tipo IS NULL
        OR data_competencia IS NULL
        OR status IN ('previsto', 'processando')
        OR atualizado_em IS NULL
    $sql$;
  ELSE
    UPDATE lancamentos_financeiros
    SET
      tipo = COALESCE(tipo, 'receita'),
      data_competencia = COALESCE(data_competencia, CURRENT_DATE),
      status = CASE status
        WHEN 'previsto' THEN 'pendente'
        WHEN 'processando' THEN 'faturado'
        ELSE COALESCE(status, 'pendente')
      END,
      atualizado_em = COALESCE(atualizado_em, criado_em, NOW())
    WHERE
      tipo IS NULL
      OR data_competencia IS NULL
      OR status IN ('previsto', 'processando')
      OR atualizado_em IS NULL;
  END IF;
END $$;

ALTER TABLE lancamentos_financeiros
  ALTER COLUMN descricao SET NOT NULL,
  ALTER COLUMN valor SET NOT NULL,
  ALTER COLUMN tipo SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN data_competencia SET NOT NULL;

ALTER TABLE lancamentos_financeiros
  DROP CONSTRAINT IF EXISTS lancamentos_financeiros_status_check;

ALTER TABLE lancamentos_financeiros
  ADD CONSTRAINT lancamentos_financeiros_status_check
  CHECK (status IN ('pendente', 'faturado', 'pago', 'cancelado'));

ALTER TABLE lancamentos_financeiros
  DROP CONSTRAINT IF EXISTS lancamentos_financeiros_tipo_check;

ALTER TABLE lancamentos_financeiros
  ADD CONSTRAINT lancamentos_financeiros_tipo_check
  CHECK (tipo IN ('receita', 'despesa', 'repasse'));

ALTER TABLE lancamentos_financeiros
  DROP COLUMN IF EXISTS categoria;

ALTER TABLE lancamentos_financeiros
  DROP COLUMN IF EXISTS referencia_mes;

CREATE INDEX IF NOT EXISTS idx_financeiro_usuario_status ON lancamentos_financeiros (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_financeiro_cliente ON lancamentos_financeiros (cliente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_entrega ON lancamentos_financeiros (entrega_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON lancamentos_financeiros (tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_data_competencia ON lancamentos_financeiros (data_competencia);
CREATE INDEX IF NOT EXISTS idx_financeiro_data_vencimento ON lancamentos_financeiros (data_vencimento);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_entrega_ativa_unique
  ON lancamentos_financeiros (entrega_id)
  WHERE entrega_id IS NOT NULL AND status <> 'cancelado';

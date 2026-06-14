CREATE TABLE IF NOT EXISTS entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  cliente VARCHAR(160) NOT NULL,
  descricao TEXT,
  origem VARCHAR(150) NOT NULL,
  destino VARCHAR(150) NOT NULL,
  cidade VARCHAR(120) NOT NULL,
  estado VARCHAR(2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'coletada', 'em_transito', 'em_rota', 'entregue', 'cancelada')),
  previsao_entrega DATE,
  valor_frete NUMERIC(12, 2),
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS cliente VARCHAR(160),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(120),
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
  ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE entregas
  ALTER COLUMN descricao DROP NOT NULL;

ALTER TABLE entregas
  DROP CONSTRAINT IF EXISTS entregas_status_check;

ALTER TABLE entregas
  ADD CONSTRAINT entregas_status_check
  CHECK (status IN ('pendente', 'coletada', 'em_transito', 'em_rota', 'entregue', 'cancelada'));

CREATE TABLE IF NOT EXISTS entrega_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id UUID NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  tipo_evento VARCHAR(40) NOT NULL CHECK (
    tipo_evento IN (
      'entrega_criada',
      'entrega_atualizada',
      'status_alterado',
      'vinculada_rota',
      'removida_rota',
      'rota_iniciada',
      'rota_concluida',
      'rota_cancelada',
      'comprovante_enviado',
      'comprovante_inativado'
    )
  ),
  descricao TEXT NOT NULL,
  dados JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE entrega_eventos
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_evento VARCHAR(40),
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS dados JSONB,
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE entrega_eventos
  DROP CONSTRAINT IF EXISTS entrega_eventos_tipo_evento_check;

ALTER TABLE entrega_eventos
  ADD CONSTRAINT entrega_eventos_tipo_evento_check
  CHECK (
    tipo_evento IN (
      'entrega_criada',
      'entrega_atualizada',
      'status_alterado',
      'vinculada_rota',
      'removida_rota',
      'rota_iniciada',
      'rota_concluida',
      'rota_cancelada',
      'comprovante_enviado',
      'comprovante_inativado'
    )
  );

CREATE INDEX IF NOT EXISTS idx_entregas_usuario_status ON entregas (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_entregas_codigo ON entregas (codigo);
CREATE INDEX IF NOT EXISTS idx_entregas_previsao_entrega ON entregas (previsao_entrega);
CREATE INDEX IF NOT EXISTS idx_entregas_valor_frete ON entregas (valor_frete);
CREATE INDEX IF NOT EXISTS idx_entrega_eventos_entrega_criado_em
  ON entrega_eventos (entrega_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_entrega_eventos_tipo ON entrega_eventos (tipo_evento);

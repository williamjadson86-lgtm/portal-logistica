CREATE TABLE IF NOT EXISTS comprovantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  entrega_id UUID NOT NULL REFERENCES entregas(id) ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('foto', 'pdf', 'assinatura', 'observacao')),
  arquivo_nome VARCHAR(255),
  arquivo_caminho TEXT,
  mime_type VARCHAR(120),
  tamanho_bytes INTEGER,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE comprovantes
  ADD COLUMN IF NOT EXISTS arquivo_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS arquivo_caminho TEXT,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS tamanho_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE comprovantes
  DROP CONSTRAINT IF EXISTS comprovantes_tipo_check;

ALTER TABLE comprovantes
  ADD CONSTRAINT comprovantes_tipo_check
  CHECK (tipo IN ('foto', 'pdf', 'assinatura', 'observacao'));

CREATE INDEX IF NOT EXISTS idx_comprovantes_usuario_ativo ON comprovantes (usuario_id, ativo);
CREATE INDEX IF NOT EXISTS idx_comprovantes_entrega_ativo ON comprovantes (entrega_id, ativo);
CREATE INDEX IF NOT EXISTS idx_comprovantes_criado_em ON comprovantes (criado_em);

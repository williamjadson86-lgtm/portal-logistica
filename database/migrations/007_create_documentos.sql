CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  tipo VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'enviado', 'aprovado', 'vencido')),
  validade_em DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_usuario_status ON documentos (usuario_id, status);

CREATE TABLE IF NOT EXISTS chamados_suporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  assunto VARCHAR(150) NOT NULL,
  categoria VARCHAR(60) NOT NULL,
  prioridade VARCHAR(20) NOT NULL CHECK (prioridade IN ('baixa', 'media', 'alta')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('aberto', 'em_atendimento', 'resolvido')),
  mensagem TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suporte_usuario_status ON chamados_suporte (usuario_id, status);

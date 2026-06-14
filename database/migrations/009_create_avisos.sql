CREATE TABLE IF NOT EXISTS avisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(150) NOT NULL,
  conteudo TEXT NOT NULL,
  prioridade VARCHAR(20) NOT NULL CHECK (prioridade IN ('informativo', 'importante', 'urgente')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  publicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avisos_ativo_publicado ON avisos (ativo, publicado_em DESC);

INSERT INTO avisos (titulo, conteudo, prioridade, ativo)
SELECT
  'Atualizacao operacional',
  'O portal agora possui modulos reais para entregas, documentos, suporte e acompanhamento financeiro.',
  'informativo',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM avisos WHERE titulo = 'Atualizacao operacional'
);

INSERT INTO avisos (titulo, conteudo, prioridade, ativo)
SELECT
  'Checklist de documentos',
  'Revise periodicamente seus documentos obrigatorios para evitar bloqueios operacionais.',
  'importante',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM avisos WHERE titulo = 'Checklist de documentos'
);

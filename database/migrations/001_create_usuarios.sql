CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  cpf VARCHAR(14) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  telefone VARCHAR(20) NOT NULL,
  matricula VARCHAR(50) NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  tipo_usuario VARCHAR(20) NOT NULL CHECK (tipo_usuario IN ('colaborador', 'motorista', 'operador', 'administrador')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configuracoes_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  tema VARCHAR(30) NOT NULL DEFAULT 'claro',
  notificacoes_email BOOLEAN NOT NULL DEFAULT TRUE,
  notificacoes_push BOOLEAN NOT NULL DEFAULT TRUE,
  idioma VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_nome ON usuarios (nome);
CREATE INDEX IF NOT EXISTS idx_usuarios_matricula ON usuarios (matricula);

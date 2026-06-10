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

CREATE TABLE IF NOT EXISTS motoristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  cpf VARCHAR(14) NOT NULL,
  cnh VARCHAR(30) NOT NULL,
  categoria_cnh VARCHAR(4) NOT NULL,
  validade_cnh DATE NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ativo', 'inativo', 'afastado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, cpf),
  UNIQUE (usuario_id, cnh)
);

CREATE TABLE IF NOT EXISTS veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  placa VARCHAR(8) NOT NULL,
  modelo VARCHAR(120) NOT NULL,
  tipo VARCHAR(80) NOT NULL,
  capacidade NUMERIC(10, 2) NOT NULL,
  ano INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('disponivel', 'em_rota', 'manutencao', 'inativo')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, placa)
);

CREATE TABLE IF NOT EXISTS rotas_operacionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  motorista_id UUID NOT NULL REFERENCES motoristas(id) ON DELETE RESTRICT,
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
  origem VARCHAR(150) NOT NULL,
  destino VARCHAR(150) NOT NULL,
  data_rota DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('planejada', 'em_andamento', 'concluida', 'cancelada')),
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rotas_operacionais
  ADD COLUMN IF NOT EXISTS entrega_id UUID REFERENCES entregas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nome VARCHAR(120),
  ADD COLUMN IF NOT EXISTS distancia_km NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(40),
  ADD COLUMN IF NOT EXISTS motorista_id UUID REFERENCES motoristas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS veiculo_id UUID REFERENCES veiculos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS data_rota DATE,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

ALTER TABLE rotas_operacionais
  ALTER COLUMN nome DROP NOT NULL;

ALTER TABLE rotas_operacionais
  DROP CONSTRAINT IF EXISTS rotas_operacionais_status_check;

ALTER TABLE rotas_operacionais
  ADD CONSTRAINT rotas_operacionais_status_check
  CHECK (status IN ('planejada', 'em_andamento', 'concluida', 'cancelada'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_rotas_codigo_unique ON rotas_operacionais (codigo);

CREATE TABLE IF NOT EXISTS rota_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES rotas_operacionais(id) ON DELETE CASCADE,
  entrega_id UUID NOT NULL REFERENCES entregas(id) ON DELETE RESTRICT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  vinculado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
);

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

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  documento VARCHAR(14) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  contato_nome VARCHAR(150) NOT NULL,
  cidade VARCHAR(120) NOT NULL,
  estado VARCHAR(2) NOT NULL,
  endereco VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, documento),
  UNIQUE (usuario_id, email)
);

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS contato_nome VARCHAR(150),
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(120),
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
  ADD COLUMN IF NOT EXISTS endereco VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE clientes
  DROP CONSTRAINT IF EXISTS clientes_status_check;

ALTER TABLE clientes
  ADD CONSTRAINT clientes_status_check
  CHECK (status IN ('ativo', 'inativo', 'bloqueado'));

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
  OR atualizado_em IS NULL;

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

CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  tipo VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pendente', 'enviado', 'aprovado', 'vencido')),
  validade_em DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS avisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo VARCHAR(150) NOT NULL,
  conteudo TEXT NOT NULL,
  prioridade VARCHAR(20) NOT NULL CHECK (prioridade IN ('informativo', 'importante', 'urgente')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  publicado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
CREATE INDEX IF NOT EXISTS idx_entregas_usuario_status ON entregas (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_entregas_codigo ON entregas (codigo);
CREATE INDEX IF NOT EXISTS idx_entregas_previsao_entrega ON entregas (previsao_entrega);
CREATE INDEX IF NOT EXISTS idx_entregas_valor_frete ON entregas (valor_frete);
CREATE INDEX IF NOT EXISTS idx_rotas_usuario_status ON rotas_operacionais (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_rotas_data_rota ON rotas_operacionais (data_rota);
CREATE INDEX IF NOT EXISTS idx_rotas_motorista ON rotas_operacionais (motorista_id);
CREATE INDEX IF NOT EXISTS idx_rotas_veiculo ON rotas_operacionais (veiculo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rota_entregas_entrega_ativa
  ON rota_entregas (entrega_id)
  WHERE ativo = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_rota_entregas_rota_entrega_ativa
  ON rota_entregas (rota_id, entrega_id)
  WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_rota_entregas_rota ON rota_entregas (rota_id);
CREATE INDEX IF NOT EXISTS idx_motoristas_usuario_status ON motoristas (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_motoristas_validade_cnh ON motoristas (validade_cnh);
CREATE INDEX IF NOT EXISTS idx_veiculos_usuario_status ON veiculos (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON veiculos (placa);
CREATE INDEX IF NOT EXISTS idx_comprovantes_usuario_ativo ON comprovantes (usuario_id, ativo);
CREATE INDEX IF NOT EXISTS idx_comprovantes_entrega_ativo ON comprovantes (entrega_id, ativo);
CREATE INDEX IF NOT EXISTS idx_comprovantes_criado_em ON comprovantes (criado_em);
CREATE INDEX IF NOT EXISTS idx_clientes_usuario_status ON clientes (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes (nome);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes (documento);
CREATE INDEX IF NOT EXISTS idx_entrega_eventos_entrega_criado_em
  ON entrega_eventos (entrega_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_entrega_eventos_tipo
  ON entrega_eventos (tipo_evento);
CREATE INDEX IF NOT EXISTS idx_financeiro_usuario_status ON lancamentos_financeiros (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_financeiro_cliente ON lancamentos_financeiros (cliente_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_entrega ON lancamentos_financeiros (entrega_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON lancamentos_financeiros (tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_data_competencia ON lancamentos_financeiros (data_competencia);
CREATE INDEX IF NOT EXISTS idx_financeiro_data_vencimento ON lancamentos_financeiros (data_vencimento);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_entrega_ativa_unique
  ON lancamentos_financeiros (entrega_id)
  WHERE entrega_id IS NOT NULL AND status <> 'cancelado';
CREATE INDEX IF NOT EXISTS idx_documentos_usuario_status ON documentos (usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_suporte_usuario_status ON chamados_suporte (usuario_id, status);
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

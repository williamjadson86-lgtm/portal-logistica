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
  entrega_id UUID REFERENCES entregas(id) ON DELETE SET NULL,
  motorista_id UUID NOT NULL REFERENCES motoristas(id) ON DELETE RESTRICT,
  veiculo_id UUID NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
  nome VARCHAR(120),
  origem VARCHAR(150) NOT NULL,
  destino VARCHAR(150) NOT NULL,
  distancia_km NUMERIC(10, 2) NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS rota_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rota_id UUID NOT NULL REFERENCES rotas_operacionais(id) ON DELETE CASCADE,
  entrega_id UUID NOT NULL REFERENCES entregas(id) ON DELETE RESTRICT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  vinculado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rotas_codigo_unique ON rotas_operacionais (codigo);
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

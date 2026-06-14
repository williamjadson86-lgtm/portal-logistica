ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_entregas_cliente_id ON entregas (cliente_id);

WITH clientes_priorizados AS (
  SELECT
    c.id,
    c.usuario_id,
    c.nome,
    ROW_NUMBER() OVER (
      PARTITION BY c.usuario_id, LOWER(TRIM(c.nome))
      ORDER BY c.criado_em ASC, c.id ASC
    ) AS ordem
  FROM clientes c
)
UPDATE entregas e
SET cliente_id = cp.id
FROM clientes_priorizados cp
WHERE e.cliente_id IS NULL
  AND e.usuario_id = cp.usuario_id
  AND LOWER(TRIM(e.cliente)) = LOWER(TRIM(cp.nome))
  AND cp.ordem = 1;

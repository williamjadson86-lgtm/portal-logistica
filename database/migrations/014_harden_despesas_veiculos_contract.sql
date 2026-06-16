ALTER TABLE despesas_veiculos
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

UPDATE despesas_veiculos
SET status = CASE
  WHEN ativo = FALSE THEN 'cancelado'
  WHEN data_pagamento IS NOT NULL THEN 'pago'
  ELSE 'pendente'
END
WHERE status IS NULL;

ALTER TABLE despesas_veiculos
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pendente';

ALTER TABLE despesas_veiculos
  DROP CONSTRAINT IF EXISTS despesas_veiculos_status_check;

ALTER TABLE despesas_veiculos
  ADD CONSTRAINT despesas_veiculos_status_check
  CHECK (status IN ('pendente', 'pago', 'cancelado'));

ALTER TABLE despesas_veiculos
  DROP CONSTRAINT IF EXISTS despesas_veiculos_valor_positivo_check;

ALTER TABLE despesas_veiculos
  ADD CONSTRAINT despesas_veiculos_valor_positivo_check
  CHECK (valor > 0);

CREATE INDEX IF NOT EXISTS idx_despesas_veiculos_status ON despesas_veiculos (status);

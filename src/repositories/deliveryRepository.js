const database = require("../config/database");

function mapDelivery(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    codigo: row.codigo,
    cliente: row.cliente,
    origem: row.origem,
    destino: row.destino,
    cidade: row.cidade,
    estado: row.estado,
    status: row.status,
    dataPrevista: row.dataPrevista,
    valorFrete: row.valorFrete != null ? Number(row.valorFrete) : null,
    observacoes: row.observacoes || "",
    rotaAtual:
      row.rotaId || row.rotaCodigo
        ? {
            id: row.rotaId,
            codigo: row.rotaCodigo,
            status: row.rotaStatus,
            dataRota: row.rotaData,
          }
        : null,
    motorista:
      row.motoristaId || row.motoristaNome
        ? {
            id: row.motoristaId,
            nome: row.motoristaNome,
          }
        : null,
    veiculo:
      row.veiculoId || row.veiculoPlaca
        ? {
            id: row.veiculoId,
            placa: row.veiculoPlaca,
            modelo: row.veiculoModelo,
          }
        : null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

async function getDashboardSummary(userId) {
  const result = await database.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'em_transito')::int AS "emTransito",
      COUNT(*) FILTER (WHERE status = 'entregue')::int AS entregues,
      COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes
    FROM entregas
    WHERE usuario_id = $1`,
    [userId],
  );

  return result.rows[0];
}

async function listByUserId(userId) {
  const result = await database.query(
    `SELECT
      id,
      codigo,
      cliente,
      origem,
      destino,
      cidade,
      estado,
      status,
      TO_CHAR(previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      valor_frete AS "valorFrete",
      COALESCE(observacoes, descricao, '') AS observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"
    FROM entregas
    WHERE usuario_id = $1
    ORDER BY previsao_entrega ASC NULLS LAST, criado_em DESC`,
    [userId],
  );

  return result.rows.map(mapDelivery);
}

async function findById(userId, deliveryId) {
  const result = await database.query(
    `SELECT
      d.id,
      d.codigo,
      d.cliente,
      d.origem,
      d.destino,
      d.cidade,
      d.estado,
      d.status,
      TO_CHAR(d.previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      d.valor_frete AS "valorFrete",
      COALESCE(d.observacoes, d.descricao, '') AS observacoes,
      r.id AS "rotaId",
      r.codigo AS "rotaCodigo",
      r.status AS "rotaStatus",
      TO_CHAR(r.data_rota, 'YYYY-MM-DD') AS "rotaData",
      m.id AS "motoristaId",
      m.nome AS "motoristaNome",
      v.id AS "veiculoId",
      v.placa AS "veiculoPlaca",
      v.modelo AS "veiculoModelo",
      d.criado_em AS "criadoEm",
      d.atualizado_em AS "atualizadoEm"
    FROM entregas d
    LEFT JOIN rota_entregas re
      ON re.entrega_id = d.id
      AND re.ativo = TRUE
    LEFT JOIN rotas_operacionais r
      ON r.id = re.rota_id
      AND r.usuario_id = d.usuario_id
    LEFT JOIN motoristas m
      ON m.id = r.motorista_id
    LEFT JOIN veiculos v
      ON v.id = r.veiculo_id
    WHERE d.usuario_id = $1 AND d.id = $2`,
    [userId, deliveryId],
  );

  return mapDelivery(result.rows[0]);
}

async function create(userId, payload) {
  const result = await database.query(
    `INSERT INTO entregas (
      usuario_id,
      codigo,
      cliente,
      descricao,
      origem,
      destino,
      cidade,
      estado,
      status,
      previsao_entrega,
      valor_frete,
      observacoes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING
      id,
      codigo,
      cliente,
      origem,
      destino,
      cidade,
      estado,
      status,
      TO_CHAR(previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      valor_frete AS "valorFrete",
      COALESCE(observacoes, descricao, '') AS observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [
      userId,
      payload.codigo,
      payload.cliente,
      payload.observacoes,
      payload.origem,
      payload.destino,
      payload.cidade,
      payload.estado,
      payload.status,
      payload.dataPrevista,
      payload.valorFrete ?? null,
      payload.observacoes,
    ],
  );

  return mapDelivery(result.rows[0]);
}

async function updateById(userId, deliveryId, payload) {
  const fields = [];
  const values = [userId, deliveryId];
  const mapping = {
    codigo: "codigo",
    cliente: "cliente",
    origem: "origem",
    destino: "destino",
    cidade: "cidade",
    estado: "estado",
    status: "status",
    dataPrevista: "previsao_entrega",
    valorFrete: "valor_frete",
    observacoes: "observacoes",
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    values.push(payload[key]);
    fields.push(`${column} = $${values.length}`);

    if (key === "observacoes") {
      values.push(payload[key]);
      fields.push(`descricao = $${values.length}`);
    }
  }

  values.push(new Date().toISOString());
  fields.push(`atualizado_em = $${values.length}`);

  const result = await database.query(
    `UPDATE entregas
    SET ${fields.join(", ")}
    WHERE usuario_id = $1 AND id = $2
    RETURNING
      id,
      codigo,
      cliente,
      origem,
      destino,
      cidade,
      estado,
      status,
      TO_CHAR(previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      valor_frete AS "valorFrete",
      COALESCE(observacoes, descricao, '') AS observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    values,
  );

  return mapDelivery(result.rows[0]);
}

async function updateStatusById(userId, deliveryId, status) {
  const result = await database.query(
    `UPDATE entregas
    SET status = $3, atualizado_em = NOW()
    WHERE usuario_id = $1 AND id = $2
    RETURNING
      id,
      codigo,
      cliente,
      origem,
      destino,
      cidade,
      estado,
      status,
      TO_CHAR(previsao_entrega, 'YYYY-MM-DD') AS "dataPrevista",
      valor_frete AS "valorFrete",
      COALESCE(observacoes, descricao, '') AS observacoes,
      criado_em AS "criadoEm",
      atualizado_em AS "atualizadoEm"`,
    [userId, deliveryId, status],
  );

  return mapDelivery(result.rows[0]);
}

async function deleteById(userId, deliveryId) {
  const result = await database.query(
    `DELETE FROM entregas
    WHERE usuario_id = $1 AND id = $2
    RETURNING id`,
    [userId, deliveryId],
  );

  return result.rows[0] || null;
}

module.exports = {
  getDashboardSummary,
  listByUserId,
  findById,
  create,
  updateById,
  updateStatusById,
  deleteById,
};

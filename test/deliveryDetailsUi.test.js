const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildEventFilterChipsMarkup,
  buildEventTimelineMarkup,
  buildProofHistoryMarkup,
  filterEventsByCategory,
  formatDayGroupTitle,
  getEventCategory,
  getEventFilterCounts,
  getEventVisualMeta,
  groupEventsByDay,
  isProofUploadAllowed,
} = require("../public/js/deliveries.js");

test("historico de comprovantes renderiza dados operacionais no detalhe", () => {
  const markup = buildProofHistoryMarkup([
    {
      id: "1ccf4920-232d-4c29-b7f1-83680da30a12",
      tipo: "foto",
      arquivoNome: "canhoto.jpg",
      arquivoCaminho: "uploads/comprovantes/canhoto.jpg",
      observacao: "Recebido na portaria",
      enviadoPor: "Operador Teste",
      criadoEm: "2026-06-09T10:30:00.000Z",
      ativo: true,
    },
  ]);

  assert.match(markup, /canhoto\.jpg/);
  assert.match(markup, /Operador Teste/);
  assert.match(markup, /Recebido na portaria/);
  assert.match(markup, /Visualizar arquivo/);
});

test("bloqueio visual do upload respeita o status da entrega", () => {
  assert.equal(isProofUploadAllowed("em_rota"), true);
  assert.equal(isProofUploadAllowed("entregue"), true);
  assert.equal(isProofUploadAllowed("pendente"), false);
  assert.equal(isProofUploadAllowed("coletada"), false);
});

test("timeline renderiza tipo, descricao e usuario responsavel", () => {
  const markup = buildEventTimelineMarkup([
    {
      id: "evt-1",
      tipoEvento: "status_alterado",
      descricao: "Status da entrega ENT-100 alterado para entregue",
      usuarioNome: "Operador Teste",
      criadoEm: "2026-06-09T10:30:00.000Z",
    },
  ]);

  assert.match(markup, /Status alterado/);
  assert.match(markup, /ENT-100/);
  assert.match(markup, /Operador Teste/);
});

test("timeline agrupa eventos por dia em ordem cronologica decrescente", () => {
  const groups = groupEventsByDay(
    [
      {
        id: "evt-1",
        tipoEvento: "entrega_criada",
        criadoEm: "2026-06-09T12:00:00.000Z",
      },
      {
        id: "evt-2",
        tipoEvento: "status_alterado",
        criadoEm: "2026-06-09T09:00:00.000Z",
      },
      {
        id: "evt-3",
        tipoEvento: "comprovante_enviado",
        criadoEm: "2026-06-08T16:00:00.000Z",
      },
    ],
    new Date("2026-06-09T18:00:00.000Z"),
  );

  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, "Hoje");
  assert.equal(groups[0].events[0].id, "evt-1");
  assert.equal(groups[0].events[1].id, "evt-2");
  assert.equal(groups[1].label, "Ontem");
});

test("formatacao do titulo do grupo usa Hoje, Ontem ou data", () => {
  const now = new Date("2026-06-09T18:00:00.000Z");

  assert.equal(formatDayGroupTitle("2026-06-09", now), "Hoje");
  assert.equal(formatDayGroupTitle("2026-06-08", now), "Ontem");
  assert.equal(formatDayGroupTitle("2026-06-01", now), "01/06/2026");
});

test("timeline usa o icone correto por tipo de evento", () => {
  const visual = getEventVisualMeta("rota_iniciada");
  const markup = buildEventTimelineMarkup(
    [
      {
        id: "evt-1",
        tipoEvento: "rota_iniciada",
        descricao: "Rota ROT-100 iniciada",
        usuarioNome: "Operador Teste",
        criadoEm: "2026-06-09T10:30:00.000Z",
      },
    ],
    new Date("2026-06-09T18:00:00.000Z"),
  );

  assert.equal(visual.icon, "🚚");
  assert.equal(visual.className, "route-started");
  assert.match(markup, /🚚/);
  assert.match(markup, /timeline-item-route-started/);
});

test("timeline vazia renderiza mensagem amigavel", () => {
  const markup = buildEventTimelineMarkup([]);

  assert.match(markup, /Nenhum evento registrado/);
  assert.match(markup, /linha do tempo operacional/i);
});

test("filtro Todos mostra todos os eventos", () => {
  const events = [
    { id: "evt-1", tipoEvento: "entrega_criada" },
    { id: "evt-2", tipoEvento: "rota_iniciada" },
    { id: "evt-3", tipoEvento: "comprovante_enviado" },
  ];

  const filtered = filterEventsByCategory(events, "todos");

  assert.equal(filtered.length, 3);
});

test("filtro Rotas mostra apenas eventos de rota", () => {
  const events = [
    { id: "evt-1", tipoEvento: "entrega_criada" },
    { id: "evt-2", tipoEvento: "rota_iniciada" },
    { id: "evt-3", tipoEvento: "rota_concluida" },
    { id: "evt-4", tipoEvento: "comprovante_enviado" },
  ];

  const filtered = filterEventsByCategory(events, "rotas");

  assert.deepEqual(
    filtered.map((event) => event.id),
    ["evt-2", "evt-3"],
  );
});

test("filtro Comprovantes mostra apenas eventos de comprovante", () => {
  const events = [
    { id: "evt-1", tipoEvento: "comprovante_enviado" },
    { id: "evt-2", tipoEvento: "rota_iniciada" },
    { id: "evt-3", tipoEvento: "comprovante_inativado" },
  ];

  const filtered = filterEventsByCategory(events, "comprovantes");

  assert.deepEqual(
    filtered.map((event) => event.id),
    ["evt-1", "evt-3"],
  );
});

test("badge correto e exibido por tipo de evento", () => {
  const category = getEventCategory("comprovante_enviado");
  const markup = buildEventTimelineMarkup(
    [
      {
        id: "evt-1",
        tipoEvento: "comprovante_enviado",
        descricao: "Comprovante enviado",
        usuarioNome: "Operador Teste",
        criadoEm: "2026-06-09T10:30:00.000Z",
      },
    ],
    new Date("2026-06-09T18:00:00.000Z"),
    "todos",
  );

  assert.equal(category.label, "Comprovante");
  assert.equal(category.key, "comprovante");
  assert.match(markup, /timeline-badge-comprovante/);
  assert.match(markup, /Comprovante/);
});

test("estado vazio filtrado exibe mensagem amigavel", () => {
  const markup = buildEventTimelineMarkup(
    [
      {
        id: "evt-1",
        tipoEvento: "entrega_criada",
        descricao: "Entrega criada",
        usuarioNome: "Operador Teste",
        criadoEm: "2026-06-09T10:30:00.000Z",
      },
    ],
    new Date("2026-06-09T18:00:00.000Z"),
    "rotas",
  );

  assert.match(markup, /Nenhum evento encontrado para este filtro/);
});

test("chips de filtro destacam o filtro ativo", () => {
  const markup = buildEventFilterChipsMarkup([], "rotas");

  assert.match(markup, /data-event-filter="rotas"/);
  assert.match(markup, /timeline-filter-chip active/);
  assert.match(markup, /timeline-filter-chip-count">0</);
});

test("contador Todos soma todos os eventos", () => {
  const counts = getEventFilterCounts([
    { tipoEvento: "entrega_criada" },
    { tipoEvento: "rota_iniciada" },
    { tipoEvento: "comprovante_enviado" },
    { tipoEvento: "status_alterado" },
  ]);

  assert.equal(counts.todos, 4);
});

test("contador Rotas conta apenas eventos de rota", () => {
  const counts = getEventFilterCounts([
    { tipoEvento: "entrega_criada" },
    { tipoEvento: "rota_iniciada" },
    { tipoEvento: "rota_concluida" },
    { tipoEvento: "comprovante_enviado" },
  ]);

  assert.equal(counts.rotas, 2);
});

test("contador Comprovantes conta apenas eventos de comprovante", () => {
  const counts = getEventFilterCounts([
    { tipoEvento: "comprovante_enviado" },
    { tipoEvento: "rota_iniciada" },
    { tipoEvento: "comprovante_inativado" },
  ]);

  assert.equal(counts.comprovantes, 2);
});

test("categorias sem eventos mostram zero", () => {
  const counts = getEventFilterCounts([{ tipoEvento: "status_alterado" }]);

  assert.equal(counts.entrega, 0);
  assert.equal(counts.rotas, 0);
  assert.equal(counts.comprovantes, 0);
});

test("contadores sao atualizados apos nova renderizacao", () => {
  const firstMarkup = buildEventFilterChipsMarkup(
    [
      { tipoEvento: "entrega_criada" },
      { tipoEvento: "rota_iniciada" },
    ],
    "todos",
  );
  const secondMarkup = buildEventFilterChipsMarkup(
    [
      { tipoEvento: "entrega_criada" },
      { tipoEvento: "rota_iniciada" },
      { tipoEvento: "comprovante_enviado" },
      { tipoEvento: "comprovante_inativado" },
    ],
    "todos",
  );

  assert.match(firstMarkup, /timeline-filter-chip-label">Todos</);
  assert.match(firstMarkup, /timeline-filter-chip-count">2</);
  assert.match(firstMarkup, /timeline-filter-chip-label">Comprovantes</);
  assert.match(firstMarkup, /timeline-filter-chip-count">0</);
  assert.match(secondMarkup, /timeline-filter-chip-label">Todos</);
  assert.match(secondMarkup, /timeline-filter-chip-count">4</);
  assert.match(secondMarkup, /timeline-filter-chip-label">Comprovantes</);
  assert.match(secondMarkup, /timeline-filter-chip-count">2</);
});

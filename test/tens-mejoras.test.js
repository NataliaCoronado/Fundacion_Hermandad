"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");
const { hoy } = require("../src/herramientas/tiempo");
const { calendario } = require("../src/views/operacion");

async function sitio({ asistida = false } = {}) {
  const c = crearContenedor();
  await c.inicializar();
  for (const id of [1, 2]) await c.catalogo.actualizarBloque(id, { fecha: hoy() });
  if (asistida) await c.agendamiento.registrarAsistencia(1, true);
  const ps = (await c.catalogo.pacientes()).slice(0, 3);
  for (const p of ps) { c.operacion.meta.pacientes[p.rut] = c.operacion.meta.pacientes[p.rut] || {}; c.operacion.meta.pacientes[p.rut].sedes = [1]; }
  const esps = ["Kinesiología", "Fonoaudiología", "Medicina General"];
  for (const e of ["Fonoaudiología", "Medicina General"]) (c.operacion.meta.especialidades[e] ||= {}).listaEspera = true;
  for (const [i, p] of ps.entries()) await c.espera.registrar({ rut: p.rut, idPoliclinico: 1, especialidad: esps[i], idUsuario: "u2" });
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo: "tens@ejemplo.cl", clave: "demo1234" }) });
  const a = r.headers.get("set-cookie").split(";")[0];
  return { c, get: (ruta) => fetch(base + ruta, { headers: { Cookie: a } }).then((x) => x.text()), cerrar: () => new Promise((r) => srv.close(r)) };
}
const grupo = (h, nombre) => h.match(new RegExp(`<section class="rec-grupo" data-grupo="${nombre}"[\\s\\S]*?</section>`))?.[0] || "";

test("Recepción: las citas se agrupan en Por llegar, En sala, Atendidos y No asistieron", async () => {
  const s = await sitio({ asistida: true });
  try {
    const h = await s.get("/tens/recepcion");
    const porLlegar = grupo(h, "por-llegar"), atendidos = grupo(h, "atendidos");
    assert.match(porLlegar, /<h2[^>]*>Por llegar <span[^>]*>\d+<\/span><\/h2>/);
    assert.match(porLlegar, /class="rec-fila"/);
    assert.match(atendidos, /<h2[^>]*>Atendidos/);
    assert.ok(atendidos.includes("11111111-1"), "la cita atendida pasa al grupo Atendidos");
    assert.ok(!porLlegar.includes("11111111-1"));
    assert.equal(grupo(h, "en-sala"), "", "los grupos vacíos no se muestran");
  } finally { await s.cerrar(); }
});

test("Recepción: quien ya fue atendido no muestra alerta de documento", async () => {
  const s = await sitio({ asistida: true });
  try {
    const h = await s.get("/tens/recepcion");
    const atendidos = grupo(h, "atendidos");
    assert.doesNotMatch(atendidos, /Documento faltante|Subir documento|Pendiente de validación/);
    assert.match(grupo(h, "por-llegar"), /Documento faltante/);
  } finally { await s.cerrar(); }
});

test("Recepción: el documento faltante es una etiqueta pequeña con botón «Subir documento»", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/recepcion");
    assert.match(h, /<span class="rec-doc rec-doc-falta">Documento faltante<\/span>/);
    assert.match(h, /<a class="rec-btn-doc"[^>]*href="\/tens\/documentos\?rut=[^"]+">Subir documento<\/a>/);
    assert.doesNotMatch(h, /Sin ese documento no se puede atender/);
  } finally { await s.cerrar(); }
});

const fixtureAgenda = (fecha, horas = ["09:00", "12:00"]) => {
  const sede = { id: 1, nombre: "Sede" };
  const profs = [{ id: 1, nombre: "Profesional 1", activo: true, especialidad: "Medicina General" }];
  const bloques = [
    { id: 1, idProfesional: 1, fecha, hora: horas[0], duracion: 30 },
    { id: 2, idProfesional: 1, fecha, hora: horas[1], duracion: 30 },
  ];
  const ctx = {
    listaProfs: profs, listaSedes: [sede], sedes: new Map([[1, sede]]), profs: new Map(profs.map((p) => [p.id, p])),
    pacientes: new Map(), bloques: new Map(bloques.map((b) => [b.id, { ...b, publicado: true }])),
  };
  const op = { lugares: () => [1], sedeBloque: () => 1, meta: { sedes: {}, especialidades: {} } };
  return (q) => calendario({ u: { rol: "TENS_TONS", nombre: "T", idPoliclinico: 1 }, q: new URLSearchParams(q), admin: false, citas: [], op, ctx });
};

test("Agenda: las horas sin cupos se comprimen en una fila delgada", () => {
  const html = fixtureAgenda(hoy())({ fecha: hoy(), vista: "dia" });
  assert.equal((html.match(/<time class="calendar-hour calendar-hour-vacia"/g) || []).length, 2, "10:00 y 11:00 están vacías");
  assert.match(html, /style="--agenda-tracks:[^"]*grid-template-rows:auto var\(--calendar-hour\) 30px 30px var\(--calendar-hour\)/);
});

test("Agenda: hoy tiene la línea de «ahora»; otro día no", () => {
  const dia = ["00:00", "23:30"];
  const conhoy = fixtureAgenda(hoy(), dia)({ fecha: hoy(), vista: "dia" });
  assert.equal((conhoy.match(/<i class="calendar-now" style="top:[\d.]+px"/g) || []).length, 1, "una línea en la columna del profesional");
  assert.match(conhoy, /<time class="calendar-hour[^"]*" datetime="\d\d:00"[^>]*>[\s\S]*?<small class="calendar-now-hora">\d\d:\d\d<\/small>/);
  const otro = fixtureAgenda("2030-01-02", dia)({ fecha: "2030-01-02", vista: "dia" });
  assert.doesNotMatch(otro, /<i class="calendar-now"/);
});

test("Lista de espera: días de espera destacados y «Asignar cupo» como acción principal", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/espera");
    assert.match(h, /<b class="espera-dias"[^>]*>\d+ días?<\/b>/);
    const fila = h.match(/<tbody>\s*<tr>([\s\S]*?)<\/tr>/)[1];
    const celdas = [...fila.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    assert.match(celdas[8], /Asignar cupo/);
    assert.doesNotMatch(celdas[8], />Reservar</);
    assert.match(celdas[7], /<details class="espera-contacto"><summary>Registrar contacto<\/summary>/);
  } finally { await s.cerrar(); }
});

test("Lista de espera: «Agregar a la lista» se abre desde un botón arriba", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/espera");
    const nueva = h.indexOf('<details class="espera-nueva"');
    assert.ok(nueva > 0);
    assert.ok(nueva < h.indexOf("<table"), "va antes de la tabla");
    assert.match(h.slice(nueva, nueva + 200), /<summary class="btn">Agregar a la lista de espera<\/summary>/);
  } finally { await s.cerrar(); }
});

test("Pacientes: contador, filtros rápidos y acciones con texto visible", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/pacientes");
    assert.match(h, /<p class="cuenta">\d+ pacientes?<\/p>/);
    const chips = h.match(/<nav class="chips-filtro"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || "";
    for (const [rotulo, f] of [["Con reserva próxima", "proxima"], ["Menores de edad", "menor"], ["Sin teléfono", "sin-telefono"]]) {
      assert.match(chips, new RegExp(`<a[^>]*href="[^"]*f=${f}[^"]*"[^>]*>${rotulo}</a>`), rotulo);
    }
    assert.match(h, /<a class="btn-icono"[^>]*title="Ver reservas">[\s\S]*?<span>Reservas<\/span><\/a>/);
    assert.match(h, /<a class="btn-icono"[^>]*title="Editar">[\s\S]*?<span>Editar<\/span><\/a>/);
    const menores = await s.get("/tens/pacientes?f=menor");
    assert.match(menores, /<a[^>]*aria-current="true"[^>]*>Menores de edad<\/a>/);
    const nombres = (x) => (x.match(/class="paciente-link"/g) || []).length;
    assert.ok(nombres(menores) < nombres(h), "el filtro reduce la lista");
  } finally { await s.cerrar(); }
});

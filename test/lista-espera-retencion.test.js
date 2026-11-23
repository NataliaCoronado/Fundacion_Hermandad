"use strict";
require("./helpers/reloj");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

const A = "11111111-1",
  C = "33333333-3";
const BLOQUE_PSICOLOGIA = 9;
const BLOQUE_MEDICINA = 1;

async function aplicacion() {
  const c = crearContenedor();
  await c.inicializar();
  return c;
}

async function esperaEnPsicologia(c, rut = C) {
  return c.espera.registrar({ rut, idPoliclinico: 1, especialidad: "Psicología", idUsuario: "u2" });
}

async function cancelarBloque(c, idBloque, origen = "ASISTIDA") {
  const cita = await c.agendamiento.agendar({ rut: A, idBloque, idUsuario: "u2" });
  await c.agendamiento.cancelar(cita.id, origen);
  return cita;
}

const estaLibre = async (c, idBloque, especialidad) =>
  (await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1, especialidad })).some((b) => b.id === idBloque);

async function sitio(c) {
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const entrar = async (correo) => {
    const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
    return r.headers.get("set-cookie").split(";")[0];
  };
  const tens = await entrar("tens@ejemplo.cl"),
    admin = await entrar("admin@ejemplo.cl");
  return {
    get: (ruta, ck = tens) => fetch(base + ruta, { headers: { Cookie: ck } }).then((x) => x.text()),
    post: (ruta, d, ck = tens) => fetch(base + ruta, { method: "POST", headers: { Cookie: ck }, body: new URLSearchParams(d) }).then((x) => x.text()),
    admin,
    cerrar: () => new Promise((r) => srv.close(r)),
  };
}

test("Lista de espera: por defecto solo Psicología y Kinesiología; las demás se rechazan", async () => {
  const c = await aplicacion();
  assert.equal(c.espera.tieneLista("Psicología"), true);
  assert.equal(c.espera.tieneLista("Kinesiología"), true);
  assert.equal(c.espera.tieneLista("Medicina General"), false);
  await assert.rejects(
    () => c.espera.registrar({ rut: C, idPoliclinico: 1, especialidad: "Medicina General", idUsuario: "u2" }),
    /ESPECIALIDAD_SIN_LISTA/,
  );
});

test("Hora cancelada con alguien esperando: queda retenida y no sale a la agenda pública", async () => {
  const c = await aplicacion();
  await esperaEnPsicologia(c);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  assert.equal(await estaLibre(c, BLOQUE_PSICOLOGIA, "Psicología"), false);
  assert.deepEqual((await c.espera.retenidos(1)).map((b) => b.id), [BLOQUE_PSICOLOGIA]);
  const fila = (await c.espera.vigentes()).find((e) => e.especialidad === "Psicología");
  assert.ok(fila.cupos.some((b) => b.id === BLOQUE_PSICOLOGIA && b.retenido === true), "el cupo retenido aparece como compatible");
});

test("Hora cancelada por el paciente (WhatsApp) también queda retenida", async () => {
  const c = await aplicacion();
  await esperaEnPsicologia(c);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA, "WHATSAPP");
  assert.equal((await c.espera.retenidos(1)).length, 1);
});

test("Hora cancelada sin nadie esperando: se libera sola, como siempre", async () => {
  const c = await aplicacion();
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  assert.equal(await estaLibre(c, BLOQUE_PSICOLOGIA, "Psicología"), true);
  assert.equal((await c.espera.retenidos(1)).length, 0);
});

test("Cancelación institucional no retiene la hora", async () => {
  const c = await aplicacion();
  await esperaEnPsicologia(c);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA, "INSTITUCIONAL");
  assert.equal((await c.espera.retenidos(1)).length, 0);
});

test("Especialidad sin lista de espera: la hora cancelada se libera sola", async () => {
  const c = await aplicacion();
  await c.agendamiento.cancelar(1, "ASISTIDA");
  assert.equal(await estaLibre(c, BLOQUE_MEDICINA, "Medicina General"), true);
});

test("Asignar un cupo retenido: crea la cita, cierra la solicitud y quita la retención", async () => {
  const c = await aplicacion();
  const e = await esperaEnPsicologia(c);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  const cita = await c.espera.asignar({ idSolicitud: e.id, idBloque: BLOQUE_PSICOLOGIA, idUsuario: "u2" });
  assert.equal(cita.rut, C);
  assert.equal(cita.estadoReserva, "ACTIVA");
  assert.equal((await c.espera.retenidos(1)).length, 0);
  assert.equal((await c.catalogo.espera()).find((x) => x.id === e.id).estado, "ASIGNADA");
});

test("Soltar a la agenda pública: la hora vuelve a estar disponible y deja de estar retenida", async () => {
  const c = await aplicacion();
  await esperaEnPsicologia(c);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  await c.espera.soltar({ idBloque: BLOQUE_PSICOLOGIA });
  assert.equal(await estaLibre(c, BLOQUE_PSICOLOGIA, "Psicología"), true);
  assert.equal((await c.espera.retenidos(1)).length, 0);
});

test("Administración activa y desactiva la lista de espera de una especialidad", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    const vista = await s.get("/admin/policlinicos?tab=especialidades", s.admin);
    assert.match(vista, /name="listaEspera"/, "hay una casilla «Tiene lista de espera» por especialidad");
    assert.match(vista, /Tiene lista de espera/);
    await s.post("/admin/especialidad", { nombre: "Medicina General", color: "#16808b", activo: "1", listaEspera: "1" }, s.admin);
    assert.equal(c.espera.tieneLista("Medicina General"), true);
    await s.post("/admin/especialidad", { nombre: "Psicología", color: "#16808b", activo: "1" }, s.admin);
    assert.equal(c.espera.tieneLista("Psicología"), false);
  } finally { await s.cerrar(); }
});

test("TENS/TONS: la pantalla de espera avisa los cupos disponibles y permite soltarlos", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    const vacia = await s.get("/tens/espera");
    assert.doesNotMatch(vacia, /<section class="espera-cupos"/, "sin cupos retenidos no aparece el panel");
    await esperaEnPsicologia(c);
    await cancelarBloque(c, BLOQUE_PSICOLOGIA);
    const h = await s.get("/tens/espera");
    const panel = h.match(/<section class="espera-cupos"[\s\S]*?<\/section>/)?.[0] || "";
    assert.match(panel, /Cupos disponibles para la lista de espera/);
    assert.match(panel, /Psicología/);
    assert.match(panel, /action="\/tens\/espera\/asignar"/);
    assert.match(panel, /action="\/tens\/espera\/soltar"/);
    await s.post("/tens/espera/soltar", { idBloque: BLOQUE_PSICOLOGIA });
    assert.equal(await estaLibre(c, BLOQUE_PSICOLOGIA, "Psicología"), true);
    assert.doesNotMatch(await s.get("/tens/espera"), /<section class="espera-cupos"/);
  } finally { await s.cerrar(); }
});

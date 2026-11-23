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

const B = "22222222-2";

// Hace que la solicitud no calce con la hora de las 09:00 (prefiere la tarde):
// así la hora queda retenida y se decide a mano.
const prefiereTarde = (c, solicitud) => ((c.espera.meta.espera[solicitud.id] ||= {}).preferencia = "Tarde");

test("Hora cancelada con alguien esperando: se asigna sola al primero de la lista", async () => {
  const c = await aplicacion();
  const e = await esperaEnPsicologia(c);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  const cita = await c.citaRepo.buscarActivaPorBloque(BLOQUE_PSICOLOGIA);
  assert.equal(cita?.rut, C, "la hora quedó reservada para quien esperaba");
  assert.equal(cita.estadoConfirmacion, "PENDIENTE");
  assert.equal(await estaLibre(c, BLOQUE_PSICOLOGIA, "Psicología"), false, "no sale a la agenda pública");
  assert.equal((await c.espera.retenidos(1)).length, 0);
  assert.equal((await c.catalogo.espera()).find((x) => x.id === e.id).estado, "ASIGNADA");
  const aviso = c.extras.listar("notificaciones").find((n) => n.tipo === "CUPO_ASIGNADO_ESPERA");
  assert.match(aviso.texto, /asignada automáticamente a Paciente C/);
  assert.match(aviso.texto, /llámalo/i, "sin WhatsApp ni correo, la TENS/TONS debe llamarlo");
  assert.ok(
    !c.extras.listar("notificaciones").some((n) => n.tipo === "CUPO_LIBERADO" && !n.leida && n.idBloque === BLOQUE_PSICOLOGIA),
    "el aviso de cupo liberado queda leído",
  );
  assert.ok(c.auditoria.listar().some((a) => a.accion === "Cupo asignado automáticamente desde lista de espera"));
});

test("Hora cancelada por el paciente (WhatsApp) también se asigna sola", async () => {
  const c = await aplicacion();
  await esperaEnPsicologia(c);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA, "WHATSAPP");
  assert.equal((await c.citaRepo.buscarActivaPorBloque(BLOQUE_PSICOLOGIA))?.rut, C);
});

test("Asignación automática: primero la prioridad y después quien lleva más tiempo esperando", async () => {
  const c = await aplicacion();
  await esperaEnPsicologia(c, C);
  const urgente = await esperaEnPsicologia(c, B);
  c.espera.meta.espera[urgente.id] = { prioridad: "Alta" };
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  assert.equal((await c.citaRepo.buscarActivaPorBloque(BLOQUE_PSICOLOGIA))?.rut, B);
});

test("Asignación automática: con WhatsApp y consentimiento se simula el comprobante", async () => {
  const c = await aplicacion();
  c.operacion.meta.pacientes[B] = { ...(c.operacion.meta.pacientes[B] || {}), consentimientoComunicaciones: true };
  await esperaEnPsicologia(c, B);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  const cita = await c.citaRepo.buscarActivaPorBloque(BLOQUE_PSICOLOGIA);
  assert.ok(
    c.extras.listar("comunicaciones").some((m) => m.idCita === cita.id && m.tipo === "Comprobante de reserva" && m.canal === "WhatsApp" && m.estado === "Simulado"),
  );
  assert.match(c.extras.listar("notificaciones").find((n) => n.tipo === "CUPO_ASIGNADO_ESPERA").texto, /bandeja de simulación/);
});

test("Asignación automática: el aviso indica que el comprobante sigue pendiente si falta el proveedor", async () => {
  const c = await aplicacion();
  c.operacion.meta.pacientes[B] = { consentimientoComunicaciones: true };
  delete c.despachador.transportes.WhatsApp;
  await esperaEnPsicologia(c, B);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  const aviso = c.extras.listar("notificaciones").find((n) => n.tipo === "CUPO_ASIGNADO_ESPERA");
  assert.match(aviso.texto, /envío del comprobante está pendiente/);
});

test("Si el paciente asignado cancela por WhatsApp, la hora pasa al siguiente de la lista", async () => {
  const c = await aplicacion();
  await esperaEnPsicologia(c, C);
  await esperaEnPsicologia(c, B);
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  const primera = await c.citaRepo.buscarActivaPorBloque(BLOQUE_PSICOLOGIA);
  assert.equal(primera.rut, C);
  await c.agendamiento.cancelar(primera.id, "WHATSAPP");
  assert.equal((await c.citaRepo.buscarActivaPorBloque(BLOQUE_PSICOLOGIA))?.rut, B);
});

test("Si nadie calza con el horario, la hora queda retenida para decidir a mano", async () => {
  const c = await aplicacion();
  prefiereTarde(c, await esperaEnPsicologia(c));
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  assert.equal(await c.citaRepo.buscarActivaPorBloque(BLOQUE_PSICOLOGIA), null);
  assert.equal(await estaLibre(c, BLOQUE_PSICOLOGIA, "Psicología"), false);
  assert.deepEqual((await c.espera.retenidos(1)).map((b) => b.id), [BLOQUE_PSICOLOGIA]);
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

test("Asignar a mano un cupo retenido: crea la cita, cierra la solicitud y quita la retención", async () => {
  const c = await aplicacion();
  prefiereTarde(c, await esperaEnPsicologia(c));
  await cancelarBloque(c, BLOQUE_PSICOLOGIA);
  const e = await esperaEnPsicologia(c, B);
  const cita = await c.espera.asignar({ idSolicitud: e.id, idBloque: BLOQUE_PSICOLOGIA, idUsuario: "u2" });
  assert.equal(cita.rut, B);
  assert.equal(cita.estadoReserva, "ACTIVA");
  assert.equal((await c.espera.retenidos(1)).length, 0);
  assert.equal((await c.catalogo.espera()).find((x) => x.id === e.id).estado, "ASIGNADA");
});

test("Soltar a la agenda pública: la hora vuelve a estar disponible y deja de estar retenida", async () => {
  const c = await aplicacion();
  prefiereTarde(c, await esperaEnPsicologia(c));
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
    prefiereTarde(c, await esperaEnPsicologia(c));
    await cancelarBloque(c, BLOQUE_PSICOLOGIA);
    await esperaEnPsicologia(c, B);
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

test("TENS/TONS: la pantalla de espera muestra las horas asignadas automáticamente", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await esperaEnPsicologia(c);
    await cancelarBloque(c, BLOQUE_PSICOLOGIA);
    const h = await s.get("/tens/espera");
    assert.match(h, /1 hora asignada automáticamente/);
    assert.match(h, /asignada automáticamente a Paciente C/);
    assert.match(h, /el sistema se la asigna sola al primer paciente de la lista/);
  } finally { await s.cerrar(); }
});

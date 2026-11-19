"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { crearContenedor } = require("../src/contenedor");
const { WhatsAppMeta } = require("../src/transport/WhatsAppMeta");
const { ejecutarCiclo } = require("../src/automaticos");

const tens = { id: "u2", nombre: "TENS", rol: "TENS_TONS", idPoliclinico: 1 };
const consentir = (c, rut, valor = true) => {
  (c.operacion.meta.pacientes[rut] ||= {}).consentimientoComunicaciones = valor;
};
const bandejaSaliente = (c) => c.extras.listar("bandeja").filter((b) => b.direccion === "SALIENTE");
async function pendiente(c, tipo = "Comprobante de reserva") {
  const cita = await c.citaRepo.buscarPorId(1);
  consentir(c, cita.rut);
  return c.operacion.comunicar(tens, cita, "WhatsApp", tipo);
}

test("despachador: con transporte simulado el estado es Simulado, nunca Enviado ni Entregado", async () => {
  const c = crearContenedor();
  const m = await pendiente(c);
  assert.strictEqual(m.estado, "Pendiente");
  const r = await c.despachador.procesar();
  assert.deepStrictEqual(r, { enviados: 0, simulados: 1, errores: 0, reintentos: 0 });
  const f = c.extras.buscar("comunicaciones", m.id);
  assert.strictEqual(f.estado, "Simulado");
  assert.match(f.detalle, /no salió ningún mensaje real/);
  assert.ok(!c.extras.listar("comunicaciones").some((x) => ["Enviado", "Entregado"].includes(x.estado)));
  assert.match(bandejaSaliente(c)[0].texto, /Hermandad de Dolores:.*comprobante/);
  assert.ok(!/código/i.test(bandejaSaliente(c)[0].texto), "el comprobante no menciona un código de reserva");
  assert.strictEqual((await c.despachador.procesar()).simulados, 0);
  assert.strictEqual(bandejaSaliente(c).length, 1);
});

test("despachador: el consentimiento retirado antes del envío deja Error y no sale ningún mensaje", async () => {
  const c = crearContenedor();
  const m = await pendiente(c);
  consentir(c, (await c.citaRepo.buscarPorId(1)).rut, false);
  await c.despachador.procesar();
  const f = c.extras.buscar("comunicaciones", m.id);
  assert.strictEqual(f.estado, "Error");
  assert.match(f.detalle, /consentimiento/);
  assert.strictEqual(bandejaSaliente(c).length, 0);
});

test("despachador: proveedor real aceptó el mensaje → Enviado con su identificador, sin marcar Entregado", async () => {
  const c = crearContenedor();
  c.despachador.transportes.WhatsApp = { simulado: false, enviar: async () => ({ id: "wamid.PRUEBA" }) };
  const m = await pendiente(c);
  await c.despachador.procesar();
  const f = c.extras.buscar("comunicaciones", m.id);
  assert.strictEqual(f.estado, "Enviado");
  assert.strictEqual(f.proveedorId, "wamid.PRUEBA");
  assert.match(f.detalle, /entrega no está confirmada/);
});

test("despachador: si el proveedor falla reintenta con espera creciente y al tercer intento queda Error", async () => {
  const c = crearContenedor();
  let reloj = "2026-11-20 10:00";
  c.despachador.ahora = () => reloj;
  c.despachador.transportes.WhatsApp = { simulado: false, enviar: async () => { throw new Error("proveedor caído"); } };
  const m = await pendiente(c);
  const ver = () => c.extras.buscar("comunicaciones", m.id);
  await c.despachador.procesar();
  assert.strictEqual(ver().estado, "Pendiente");
  assert.strictEqual(ver().intentos, 1);
  assert.strictEqual(ver().proximoIntento, "2026-11-20 10:05");
  reloj = "2026-11-20 10:01";
  assert.strictEqual((await c.despachador.procesar()).reintentos, 0);
  assert.strictEqual(ver().intentos, 1);
  reloj = "2026-11-20 10:05";
  await c.despachador.procesar();
  assert.strictEqual(ver().intentos, 2);
  assert.strictEqual(ver().proximoIntento, "2026-11-20 10:15");
  reloj = "2026-11-20 10:15";
  await c.despachador.procesar();
  assert.strictEqual(ver().estado, "Error");
  assert.match(ver().detalle, /3 intentos.*proveedor caído/);
});

test("despachador: un canal sin proveedor queda Pendiente (no se inventa un resultado)", async () => {
  const c = crearContenedor();
  c.despachador.transportes.WhatsApp = null;
  const m = await pendiente(c);
  const r = await c.despachador.procesar();
  assert.deepStrictEqual(r, { enviados: 0, simulados: 0, errores: 0, reintentos: 0 });
  assert.strictEqual(c.extras.buscar("comunicaciones", m.id).estado, "Pendiente");
});

test("WhatsApp Meta: sin configuración rechaza; con configuración arma la solicitud oficial", async () => {
  await assert.rejects(() => new WhatsAppMeta({ env: {} }).enviar({ telefono: "+56911112222", texto: "x" }), /WHATSAPP_NO_CONFIGURADO/);
  const llamadas = [];
  const fetchFn = async (url, opciones) => {
    llamadas.push({ url, opciones, cuerpo: JSON.parse(opciones.body) });
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.OK" }] }) };
  };
  const env = { WHATSAPP_TOKEN: "token-de-prueba", WHATSAPP_PHONE_ID: "12345", WHATSAPP_PLANTILLA: "recordatorio_hora" };
  const meta = new WhatsAppMeta({ env, fetchFn });
  assert.strictEqual(meta.simulado, false);
  const r = await meta.enviar({ telefono: "+56 9 1111 2222", texto: "Hola\n\nmundo", iniciado: true });
  assert.deepStrictEqual(r, { id: "wamid.OK" });
  const [l] = llamadas;
  assert.strictEqual(l.url, "https://graph.facebook.com/v21.0/12345/messages");
  assert.strictEqual(l.opciones.headers.Authorization, "Bearer token-de-prueba");
  assert.strictEqual(l.cuerpo.to, "56911112222");
  assert.strictEqual(l.cuerpo.type, "template");
  assert.strictEqual(l.cuerpo.template.name, "recordatorio_hora");
  assert.strictEqual(l.cuerpo.template.language.code, "es");
  assert.strictEqual(l.cuerpo.template.components[0].parameters[0].text, "Hola mundo");
  await meta.enviar({ telefono: "+56911112222", texto: "Gracias" });
  assert.strictEqual(llamadas[1].cuerpo.type, "text");
  await assert.rejects(() => new WhatsAppMeta({ env: { ...env, WHATSAPP_PLANTILLA: "" }, fetchFn }).enviar({ telefono: "+56911112222", texto: "x", iniciado: true }), /WHATSAPP_PLANTILLA_FALTANTE/);
  assert.strictEqual(llamadas.length, 2);
  const rechaza = new WhatsAppMeta({ env, fetchFn: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "plantilla no aprobada" } }) }) });
  await assert.rejects(() => rechaza.enviar({ telefono: "+56911112222", texto: "x", iniciado: true }), (e) => /400.*plantilla no aprobada/.test(e.message) && !e.message.includes("token-de-prueba"));
});

test("bot: sin consentimiento de comunicaciones no envía y avisa para llamar", async () => {
  const c = crearContenedor();
  const r = await c.bot.procesar("2026-11-16 10:00");
  assert.strictEqual(r.enviados, 0);
  assert.ok(r.omitidos >= 1);
  assert.ok(c.extras.listar("notificaciones").some((n) => n.tipo === "SIN_CONSENTIMIENTO"));
  assert.strictEqual(bandejaSaliente(c).length, 0);
});

test("bot: si el proveedor falla el ciclo continúa, reintenta después y al agotar intentos avisa para llamar", async () => {
  const c = crearContenedor();
  consentir(c, (await c.citaRepo.buscarPorId(1)).rut);
  const real = c.bot.transporte;
  c.bot.transporte = { enviar: async () => { throw new Error("WHATSAPP_NO_CONFIGURADO"); }, registrarEntrante: async () => {} };
  const r = await c.bot.procesar("2026-11-16 10:00");
  assert.strictEqual(r.errores, 1);
  const m = c.extras.listar("mensajes").find((x) => x.tipo === "SEMANA");
  assert.strictEqual(m.estado, "PROGRAMADO");
  assert.strictEqual(m.intentos, 1);
  assert.strictEqual(m.programadoPara, "2026-11-16 10:05");
  c.bot.transporte = real;
  const r2 = await c.bot.procesar("2026-11-16 10:05");
  assert.strictEqual(r2.enviados, 1);
  assert.strictEqual(c.extras.buscar("mensajes", m.id).estado, "ENVIADO");
  const d = crearContenedor();
  consentir(d, (await d.citaRepo.buscarPorId(1)).rut);
  d.bot.transporte = { enviar: async () => { throw new Error("caído"); }, registrarEntrante: async () => {} };
  for (const t of ["2026-11-16 10:00", "2026-11-16 10:05", "2026-11-16 10:15"]) await d.bot.procesar(t);
  assert.strictEqual(d.extras.listar("mensajes").find((x) => x.tipo === "SEMANA").estado, "ERROR");
  assert.ok(d.extras.listar("notificaciones").some((n) => n.tipo === "ERROR_ENVIO"));
});

test("mensajes automáticos: un ciclo despacha la bandeja y pide guardar solo si hubo cambios", async () => {
  const c = crearContenedor();
  let guardados = 0;
  c.guardar = () => { guardados++; };
  assert.strictEqual((await ejecutarCiclo(c)).hubo, false);
  assert.strictEqual(guardados, 0);
  const m = await pendiente(c);
  const r = await ejecutarCiclo(c);
  assert.strictEqual(r.hubo, true);
  assert.strictEqual(r.bandeja.simulados, 1);
  assert.strictEqual(guardados, 1);
  assert.strictEqual(c.extras.buscar("comunicaciones", m.id).estado, "Simulado");
});

test("despachador: una reserva cancelada tras encolar no recibe recordatorio ni comprobante", async () => {
  for (const tipo of ["Recordatorio", "Comprobante de reserva"]) {
    const c = crearContenedor();
    const m = await pendiente(c, tipo);
    await c.agendamiento.cancelar(1, "ASISTIDA");
    const r = await c.despachador.procesar();
    assert.deepStrictEqual(r, { enviados: 0, simulados: 0, errores: 1, reintentos: 0 }, tipo);
    const f = c.extras.buscar("comunicaciones", m.id);
    assert.strictEqual(f.estado, "Error", tipo);
    assert.match(f.detalle, /ya no está activa/);
    assert.strictEqual(bandejaSaliente(c).length, 0, `no sale ningún mensaje de una cita cancelada (${tipo})`);
  }
});

test("despachador: el aviso de cancelación sí se envía, porque su razón de ser es esa cancelación", async () => {
  const c = crearContenedor();
  const m = await pendiente(c, "Cancelación institucional");
  await c.agendamiento.cancelar(1, "INSTITUCIONAL");
  await c.despachador.procesar();
  assert.strictEqual(c.extras.buscar("comunicaciones", m.id).estado, "Simulado");
  assert.match(bandejaSaliente(c)[0].texto, /fue cancelada por la institución/);
});

async function citaTelemedicina(c, enlace) {
  const profs = await c.catalogo.profesionales();
  const bloque = (await c.catalogo.bloques()).find((b) => {
    const p = profs.find((x) => x.id === b.idProfesional);
    return p && c.operacion.lugares(p).includes(7);
  });
  const cita = await c.agendamiento.agendar({ rut: "11111111-1", idBloque: bloque.id });
  consentir(c, "11111111-1");
  (c.operacion.meta.citas[cita.id] ||= {}).enlace = enlace;
  return c.citaRepo.buscarPorId(cita.id);
}

test("despachador: un enlace de Telemedicina reemplazado no se envía con la solicitud anterior", async () => {
  const c = crearContenedor();
  const tele = { id: "u3", nombre: "Telemedicina", rol: "TELEMEDICINA", idPoliclinico: 7 };
  const cita = await citaTelemedicina(c, "https://videollamada.ejemplo.cl/SALA-A");
  const m = await c.operacion.comunicar(tele, cita, "WhatsApp", "Enlace de atención");
  assert.strictEqual(m.estado, "Pendiente");
  c.operacion.meta.citas[cita.id].enlace = "https://videollamada.ejemplo.cl/SALA-B";
  await c.despachador.procesar();
  const f = c.extras.buscar("comunicaciones", m.id);
  assert.strictEqual(f.estado, "Error");
  assert.match(f.detalle, /reemplazado/);
  assert.strictEqual(bandejaSaliente(c).length, 0, "no sale ni el enlace viejo ni el nuevo");
  const vigente = await c.citaRepo.buscarPorId(cita.id);
  assert.strictEqual(c.operacion.estadoEnvioEnlace(vigente).estado, "Enlace guardado");
  await c.operacion.comunicar(tele, vigente, "WhatsApp", "Enlace de atención");
  await c.despachador.procesar();
  assert.match(bandejaSaliente(c)[0].texto, /SALA-B$/);
  assert.strictEqual(c.operacion.estadoEnvioEnlace(vigente).estado, "Enlace simulado");
});

test("despachador: el enlace que no cambió se envía igual que antes", async () => {
  const c = crearContenedor();
  const tele = { id: "u3", nombre: "Telemedicina", rol: "TELEMEDICINA", idPoliclinico: 7 };
  const cita = await citaTelemedicina(c, "https://videollamada.ejemplo.cl/SALA-A");
  const m = await c.operacion.comunicar(tele, cita, "WhatsApp", "Enlace de atención");
  await c.despachador.procesar();
  assert.strictEqual(c.extras.buscar("comunicaciones", m.id).estado, "Simulado");
  assert.match(bandejaSaliente(c)[0].texto, /SALA-A$/);
});

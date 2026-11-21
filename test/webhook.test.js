"use strict";
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

const SECRETO = "secreto-de-prueba-de-la-app";
const TOKEN = "token-de-verificacion";
const PACIENTE_A = "56911111111";

function transporteFalso() {
  const enviados = [];
  let n = 0;
  return { enviados, simulado: false, enviar: async (x) => { enviados.push(x); return { id: `wamid.${++n}` }; }, registrarEntrante: async () => null };
}

async function levantar({ activo = true } = {}) {
  if (activo) Object.assign(process.env, { WHATSAPP_APP_SECRET: SECRETO, WHATSAPP_VERIFY_TOKEN: TOKEN });
  const c = crearContenedor();
  await c.inicializar();
  const t = transporteFalso();
  c.bot.transporte = t;
  c.despachador.transportes.WhatsApp = t;
  (c.operacion.meta.pacientes["11111111-1"] ||= {}).consentimientoComunicaciones = true;
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return {
    c, t, base,
    cerrar: async () => {
      await new Promise((r) => srv.close(r));
      delete process.env.WHATSAPP_APP_SECRET;
      delete process.env.WHATSAPP_VERIFY_TOKEN;
    },
  };
}
const firmar = (crudo, secreto = SECRETO) => "sha256=" + crypto.createHmac("sha256", secreto).update(crudo).digest("hex");
const avisar = (base, cuerpo, { firma = true, secreto } = {}) => {
  const crudo = JSON.stringify(cuerpo);
  return fetch(`${base}/webhook/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", ...(firma ? { "X-Hub-Signature-256": firmar(crudo, secreto) } : {}) }, body: crudo });
};
const aviso = (valor) => ({ object: "whatsapp_business_account", entry: [{ id: "WABA-ID", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "123" }, ...valor } }] }] });
const boton = (id, texto, contexto, de = PACIENTE_A) => aviso({ messages: [{ from: de, id, timestamp: "1763500000", type: "button", button: { text: texto, payload: texto }, ...(contexto ? { context: { from: "56900000000", id: contexto } } : {}) }] });
const texto = (id, cuerpo, de = PACIENTE_A) => aviso({ messages: [{ from: de, id, timestamp: "1763500000", type: "text", text: { body: cuerpo } }] });
const estado = (id, status, extra = {}) => aviso({ statuses: [{ id, status, timestamp: "1763500000", recipient_id: PACIENTE_A, ...extra }] });
async function recordatorio(s) {
  await s.c.bot.procesar("2026-11-16 10:00");
  const m = s.c.extras.listar("mensajes").find((x) => x.idCita === 1 && x.estado === "ENVIADO");
  assert.ok(m?.proveedorId, "el recordatorio guarda el identificador de Meta");
  return m;
}

test("webhook: sin secreto ni token configurados no existe", async () => {
  const s = await levantar({ activo: false });
  try {
    assert.strictEqual((await fetch(`${s.base}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=x&hub.challenge=1`)).status, 404);
    assert.strictEqual((await avisar(s.base, estado("wamid.x", "delivered"), { secreto: "cualquiera" })).status, 404);
  } finally { await s.cerrar(); }
});

test("webhook: la suscripción solo se acepta con el token de verificación correcto", async () => {
  const s = await levantar();
  try {
    const ok = await fetch(`${s.base}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=1158201444`);
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(await ok.text(), "1158201444");
    assert.strictEqual((await fetch(`${s.base}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1`)).status, 403);
  } finally { await s.cerrar(); }
});

test("webhook: un aviso sin firma o con firma falsa se rechaza y no cambia nada", async () => {
  const s = await levantar();
  try {
    const m = await recordatorio(s);
    assert.strictEqual((await avisar(s.base, boton("wamid.in1", "Cancelar mi hora", m.proveedorId), { firma: false })).status, 401);
    assert.strictEqual((await avisar(s.base, boton("wamid.in1", "Cancelar mi hora", m.proveedorId), { secreto: "secreto-falso" })).status, 401);
    assert.strictEqual((await s.c.citaRepo.buscarPorId(1)).estadoReserva, "ACTIVA", "la cita no se canceló");
  } finally { await s.cerrar(); }
});

test("webhook: el paciente confirma con el botón del recordatorio; recibe la respuesta y queda en la auditoría", async () => {
  const s = await levantar();
  try {
    const m = await recordatorio(s);
    const r = await avisar(s.base, boton("wamid.in2", "Confirmar", m.proveedorId));
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await s.c.citaRepo.buscarPorId(1)).estadoConfirmacion, "CONFIRMADA");
    const respuesta = s.t.enviados.at(-1);
    assert.match(respuesta.texto, /confirmada/);
    assert.ok(!respuesta.iniciado, "la respuesta va como texto dentro de la conversación, no como plantilla");
    assert.ok(s.c.auditoria.listar().some((x) => x.accion === "Respuesta por WhatsApp" && /cita 1: Confirmar/.test(x.detalle)));
  } finally { await s.cerrar(); }
});

test("webhook: «Cancelar mi hora» cancela con origen WhatsApp", async () => {
  const s = await levantar();
  try {
    const m = await recordatorio(s);
    await avisar(s.base, boton("wamid.in3", "Cancelar mi hora", m.proveedorId));
    const cita = await s.c.citaRepo.buscarPorId(1);
    assert.strictEqual(cita.estadoReserva, "CANCELADA");
    assert.strictEqual(cita.origenCancelacion, "WHATSAPP");
  } finally { await s.cerrar(); }
});

test("webhook: Meta repite el mismo aviso y se procesa una sola vez", async () => {
  const s = await levantar();
  try {
    const m = await recordatorio(s);
    const antes = s.t.enviados.length;
    const aviso1 = boton("wamid.repetido", "Confirmar", m.proveedorId);
    assert.strictEqual((await avisar(s.base, aviso1)).status, 200);
    assert.strictEqual((await avisar(s.base, aviso1)).status, 200, "a Meta siempre se le responde 200, aunque sea repetido");
    assert.strictEqual(s.t.enviados.length - antes, 1, "el paciente recibe una sola respuesta");
  } finally { await s.cerrar(); }
});

test("webhook: un texto libre no confirma ni cancela: recibe la ayuda", async () => {
  const s = await levantar();
  try {
    await recordatorio(s);
    await avisar(s.base, texto("wamid.in4", "hola, ¿a qué hora era?"));
    assert.strictEqual((await s.c.citaRepo.buscarPorId(1)).estadoConfirmacion, "PENDIENTE");
    assert.match(s.t.enviados.at(-1).texto, /botones/);
  } finally { await s.cerrar(); }
});

test("webhook: sin referencia al mensaje, se asocia por teléfono solo si hay una única cita consultada", async () => {
  const s = await levantar();
  try {
    await recordatorio(s);
    await avisar(s.base, boton("wamid.in5", "Confirmar", null));
    assert.strictEqual((await s.c.citaRepo.buscarPorId(1)).estadoConfirmacion, "CONFIRMADA");
  } finally { await s.cerrar(); }
});

test("webhook: un número que no corresponde a ninguna cita queda como aviso para el personal", async () => {
  const s = await levantar();
  try {
    const r = await avisar(s.base, texto("wamid.in6", "quiero una hora", "56999999999"));
    assert.strictEqual(r.status, 200);
    assert.ok(s.c.extras.listar("notificaciones").some((n) => n.tipo === "WHATSAPP_SIN_CITA" && /\+56999999999/.test(n.texto)));
  } finally { await s.cerrar(); }
});

test("webhook: estados del comprobante: Entregado solo con la confirmación de Meta, sin retroceder; fallido queda en Error", async () => {
  const s = await levantar();
  try {
    const cita = await s.c.citaRepo.buscarPorId(1);
    const pedir = async () => s.c.despachador.enviar(await s.c.operacion.comunicar({ id: "u2", nombre: "TENS", rol: "TENS_TONS", idPoliclinico: 1 }, cita, "WhatsApp", "Comprobante de reserva"));
    const m = await pedir();
    assert.strictEqual(m.estado, "Enviado");
    const ver = () => s.c.extras.buscar("comunicaciones", m.id);
    await avisar(s.base, estado(m.proveedorId, "read"));
    assert.strictEqual(ver().estado, "Entregado");
    assert.strictEqual(ver().leido, true);
    await avisar(s.base, estado(m.proveedorId, "delivered"));
    assert.strictEqual(ver().leido, true);
    assert.match(ver().detalle, /Leído/);
    const otra = await pedir();
    await avisar(s.base, estado(otra.proveedorId, "failed", { errors: [{ code: 131026, title: "Message undeliverable" }] }));
    assert.strictEqual(s.c.extras.buscar("comunicaciones", otra.id).estado, "Error");
    assert.match(s.c.extras.buscar("comunicaciones", otra.id).detalle, /Message undeliverable/);
  } finally { await s.cerrar(); }
});

test("webhook: si un recordatorio no se pudo entregar, el personal recibe el aviso para llamar", async () => {
  const s = await levantar();
  try {
    const m = await recordatorio(s);
    await avisar(s.base, estado(m.proveedorId, "failed", { errors: [{ code: 131026, title: "Message undeliverable" }] }));
    assert.strictEqual(s.c.extras.buscar("mensajes", m.id).entrega, "FALLIDO");
    assert.ok(s.c.extras.listar("notificaciones").some((n) => n.tipo === "ERROR_ENVIO"));
    assert.strictEqual((await s.c.citaRepo.buscarPorId(1)).estadoReserva, "ACTIVA", "el fallo no cancela la cita");
  } finally { await s.cerrar(); }
});

test("webhook: con dos horas consultadas y sin referencia no se adivina: no cancela ninguna y avisa al personal", async () => {
  const s = await levantar();
  try {
    const { sumarDias } = require("../src/herramientas/tiempo");
    const c1 = await s.c.citaRepo.buscarPorId(1);
    const b1 = await s.c.catalogo.bloque(c1.idBloque);
    const libre = (await s.c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 })).sort((x, y) => `${x.fecha}${x.hora}`.localeCompare(`${y.fecha}${y.hora}`))[0];
    const c2 = await s.c.agendamiento.agendar({ rut: "11111111-1", idBloque: libre.id });
    for (const fecha of [b1.fecha, libre.fecha].sort()) await s.c.bot.procesar(`${sumarDias(fecha, -1)} 10:00`);
    const consultadas = new Set(s.c.extras.listar("mensajes").filter((m) => m.estado === "ENVIADO").map((m) => m.idCita));
    assert.ok(consultadas.has(1) && consultadas.has(c2.id), "el bot consultó por las dos horas");
    await avisar(s.base, boton("wamid.ambiguo", "Cancelar mi hora", null));
    assert.strictEqual((await s.c.citaRepo.buscarPorId(1)).estadoReserva, "ACTIVA", "no canceló la hora 1");
    assert.strictEqual((await s.c.citaRepo.buscarPorId(c2.id)).estadoReserva, "ACTIVA", "no canceló la hora 2");
    assert.ok(s.c.extras.listar("notificaciones").some((n) => n.tipo === "WHATSAPP_SIN_CITA" && /2 horas activas/.test(n.texto)));
  } finally { await s.cerrar(); }
});

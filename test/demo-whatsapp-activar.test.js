"use strict";
require("./helpers/reloj");
const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

const A = "11111111-1";

async function sitio() {
  process.env.DIR_DOCUMENTOS = fs.mkdtempSync(path.join(os.tmpdir(), "demo-wa-"));
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return {
    c,
    base,
    get: (ruta) => fetch(base + ruta).then(async (x) => ({ estado: x.status, html: await x.text() })),
    post: (ruta, d) => fetch(base + ruta, { method: "POST", redirect: "manual", body: new URLSearchParams(d) }).then(async (x) => ({ estado: x.status, location: x.headers.get("location"), html: await x.text() })),
    cerrar: async () => { await new Promise((r) => srv.close(r)); fs.rmSync(process.env.DIR_DOCUMENTOS, { recursive: true, force: true }); },
  };
}
const bandeja = (c) => c.extras.listar("bandeja").filter((b) => b.direccion === "SALIENTE");

test("Reserva: «El celular tiene WhatsApp» viene marcado de entrada para un paciente nuevo", async () => {
  const s = await sitio();
  try {
    let ck = "";
    const req = async (ruta, datos) => {
      const r = await fetch(s.base + ruta, { method: datos ? "POST" : "GET", body: datos ? new URLSearchParams(datos) : undefined, redirect: "manual", headers: ck ? { Cookie: ck } : {} });
      const sc = r.headers.get("set-cookie");
      if (sc && sc.startsWith("psid=")) ck = sc.split(";")[0];
      return r;
    };
    const paso1 = await req("/agendar", { rut: "12.345.678-5", lugar: "1", modo: "esp", esp: "Medicina General", consentimiento: "1" });
    const t = new URL(paso1.headers.get("location"), "http://x").searchParams.get("t");
    const cal = await (await req(`/agendar/calendario?t=${t}`)).text();
    const bloque = cal.match(/bloque=(\d+)/)[1];
    const datos = await (await req(`/agendar/datos?t=${t}&bloque=${bloque}`)).text();
    assert.match(datos, /<input type="checkbox" name="tieneWhatsapp" value="1" checked>/);
  } finally { await s.cerrar(); }
});

test("Demo: un paciente con hora reservada pero sin WhatsApp ofrece activarlo para la demostración", async () => {
  const s = await sitio();
  try {
    await s.c.catalogo.actualizarPaciente(A, { ...(await s.c.catalogo.paciente(A)), tieneWhatsapp: false });
    const chat = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`)).html;
    assert.match(chat, /action="\/demo\/mensajes\/activar-whatsapp"/);
    assert.match(chat, /Mostrar este paciente en WhatsApp/);
  } finally { await s.cerrar(); }
});

test("Demo: activar WhatsApp marca al paciente, deja el consentimiento y envía el comprobante una sola vez", async () => {
  const s = await sitio();
  try {
    await s.c.catalogo.actualizarPaciente(A, { ...(await s.c.catalogo.paciente(A)), tieneWhatsapp: false });
    const r = await s.post("/demo/mensajes/activar-whatsapp", { rut: A });
    assert.match(r.location, /canal=whatsapp/);
    assert.equal((await s.c.catalogo.paciente(A)).tieneWhatsapp, true);
    assert.equal(s.c.bot.consiente(A), true);
    const comprobantes = bandeja(s.c).filter((b) => b.tipo === "Comprobante de reserva" && !b.canal);
    assert.equal(comprobantes.length, 1);
    await s.post("/demo/mensajes/activar-whatsapp", { rut: A });
    assert.equal(bandeja(s.c).filter((b) => b.tipo === "Comprobante de reserva" && !b.canal).length, 1, "no se duplica");
    const chat = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`)).html;
    assert.match(chat, /su hora quedó reservada/);
    assert.doesNotMatch(chat, /activar-whatsapp/);
  } finally { await s.cerrar(); }
});

test("Demo: sin horas reservadas no se ofrece activar y se explica", async () => {
  const s = await sitio();
  try {
    const conCita = new Set((await s.c.citaRepo.listar()).filter((x) => x.estadoReserva === "ACTIVA").map((x) => x.rut));
    const libre = (await s.c.catalogo.pacientes()).find((p) => !conCita.has(p.rut));
    assert.ok(libre, "hay un paciente sin horas");
    await s.c.catalogo.actualizarPaciente(libre.rut, { ...libre, tieneWhatsapp: false });
    const chat = (await s.get(`/demo/mensajes?rut=${libre.rut}&canal=whatsapp`)).html;
    assert.doesNotMatch(chat, /activar-whatsapp/);
    assert.match(chat, /no tiene horas reservadas/);
  } finally { await s.cerrar(); }
});

test("Demo: el listado también muestra a los pacientes con horas reservadas aunque aún no tengan mensajes", async () => {
  const s = await sitio();
  try {
    const indice = (await s.get("/demo/mensajes")).html;
    assert.match(indice, /Pacientes con horas reservadas/);
    assert.match(indice, new RegExp(`href="/demo/mensajes\\?rut=${A}`));
  } finally { await s.cerrar(); }
});

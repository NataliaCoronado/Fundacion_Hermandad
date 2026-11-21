"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const login = async (correo, clave = "demo1234") => {
    const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave }), headers: { "X-Forwarded-For": "9.9.9." + Math.floor(Math.random() * 200) } });
    const sc = r.headers.get("set-cookie");
    return sc ? sc.split(";")[0] : null;
  };
  const pedir = (ck, ruta, d, ip) => fetch(base + ruta, { method: d ? "POST" : "GET", redirect: "manual", headers: { ...(ck ? { Cookie: ck } : {}), ...(ip ? { "X-Forwarded-For": ip } : {}) }, body: d ? new URLSearchParams(d) : undefined });
  return { c, base, login, pedir, cerrar: () => new Promise((r) => srv.close(r)) };
}
const ultimo = (c) => c.auditoria.listar()[0];

test("Auditoría: toda operación registra el campo resultado (EXITOSO por defecto)", async () => {
  const s = await sitio();
  try {
    const tens = await s.login("tens@ejemplo.cl");
    await s.pedir(tens, "/tens/recepcion/llegada", { idCita: "1" });
    const r = s.c.auditoria.listar().find((a) => a.accion === "Llegada registrada");
    assert.ok(r, "se registró la llegada");
    assert.equal(r.resultado, "EXITOSO");
    assert.ok(s.c.auditoria.listar().every((a) => ["EXITOSO", "RECHAZADO", "ERROR"].includes(a.resultado)), "todas las filas tienen resultado");
  } finally { await s.cerrar(); }
});

test("Auditoría: un intento fuera de la sede o del rol queda como RECHAZADO", async () => {
  const s = await sitio();
  try {
    const tele = await s.login("telemedicina.usuario@ejemplo.cl");
    const tens = await s.login("tens@ejemplo.cl");
    const r = await s.pedir(tens, "/admin/resumen");
    assert.equal(r.status, 403);
    const a = ultimo(s.c);
    assert.equal(a.resultado, "RECHAZADO");
    assert.match(a.accion, /Acceso rechazado/);
    assert.equal(a.usuario, "TENS/TONS San Isidro");
    assert.match(a.detalle, /\/admin\/resumen/);
    await s.c.documentos.registrar({ rut: "11111111-1", tipo: "Cartola FONASA", usuario: { nombre: "TENS", idPoliclinico: 1 } });
    const id = s.c.documentos.listar()[0].id;
    const antes = s.c.auditoria.listar().length;
    const r2 = await s.pedir(tele, "/tens/documentos/verificar", { id });
    assert.equal(r2.status, 403);
    assert.equal(s.c.auditoria.listar().length, antes + 1);
    assert.equal(ultimo(s.c).resultado, "RECHAZADO");
    assert.equal(ultimo(s.c).usuario, "Telemedicina");
    assert.equal(s.c.documentos.listar()[0].verificado, false);
  } finally { await s.cerrar(); }
});

test("Auditoría: el login fallido y el límite de intentos se registran sin guardar la contraseña", async () => {
  const s = await sitio();
  try {
    const r = await s.login("tens@ejemplo.cl", "clave-mala-123");
    assert.equal(r, null);
    const a = ultimo(s.c);
    assert.equal(a.resultado, "RECHAZADO");
    assert.match(a.accion, /Inicio de sesión rechazado/);
    assert.doesNotMatch(JSON.stringify(a), /clave-mala-123/);
  } finally { await s.cerrar(); }
});

test("Auditoría: una regla de negocio (RF31) rechazada queda registrada; un error de tipeo no", async () => {
  const s = await sitio();
  try {
    const admin = await s.login("admin@ejemplo.cl");
    const tens = await s.login("tens@ejemplo.cl");
    const r = await s.pedir(admin, "/admin/profesionales/estado", { idProfesional: "1", activo: "0" });
    assert.equal(r.status, 400);
    const a = ultimo(s.c);
    assert.equal(a.resultado, "RECHAZADO");
    assert.match(a.detalle, /reserva/i);
    const antes = s.c.auditoria.listar().length;
    await s.pedir(tens, "/tens/agendar", { rut: "123", idBloque: "3" });
    assert.equal(s.c.auditoria.listar().length, antes, "un RUT mal escrito no se audita como rechazo");
  } finally { await s.cerrar(); }
});

test("Auditoría: el sexto intento de la consulta pública (429) queda registrado", async () => {
  const s = await sitio();
  try {
    for (let i = 0; i < 6; i++) await s.pedir(null, "/paciente/consulta", { rut: "11111111-1", fechaNacimiento: "2000-01-01", celular4: "0000" }, "7.7.7.7");
    const a = s.c.auditoria.listar().find((x) => /Límite de intentos/.test(x.accion));
    assert.ok(a, "se registró el bloqueo");
    assert.equal(a.resultado, "RECHAZADO");
    assert.doesNotMatch(JSON.stringify(a), /11111111-1/, "sin datos personales en el rechazo");
  } finally { await s.cerrar(); }
});

"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/contenedor");
const { crearServidor } = require("../src/server");
const { hoy } = require("../src/util/tiempo");

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  await c.catalogo.actualizarBloque(1, { fecha: hoy() });
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const login = async (correo) => (await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) })).headers.get("set-cookie").split(";")[0];
  const pedir = (ck, ruta, d) => fetch(base + ruta, { method: d ? "POST" : "GET", headers: { Cookie: ck }, body: d ? new URLSearchParams(d) : undefined }).then((x) => x.text());
  return { c, login, pedir, cerrar: () => new Promise((r) => srv.close(r)) };
}
const U = { nombre: "TENS/TONS San Isidro", idPoliclinico: 1 };

test("Documentos: Observar exige motivo, deja el documento observado y lo muestra el personal", async () => {
  const s = await sitio();
  try {
    const tens = await s.login("tens@ejemplo.cl");
    const d = await s.c.documentos.registrar({ rut: "11111111-1", tipo: "Cartola FONASA", usuario: U });
    let h = await s.pedir(tens, "/tens/documentos");
    assert.match(h, /action="\/tens\/documentos\/observar"/);
    assert.match(h, /Marcar verificado/);

    h = await s.pedir(tens, "/tens/documentos/observar", { id: d.id, motivo: "  " });
    assert.match(h, /Indica el motivo/);
    assert.equal(s.c.documentos.listar()[0].estadoRevision, "PENDIENTE");

    h = await s.pedir(tens, "/tens/documentos/observar", { id: d.id, motivo: "Cartola vencida" });
    assert.match(h, /Documento observado/);
    const doc = s.c.documentos.listar()[0];
    assert.equal(doc.estadoRevision, "OBSERVADO");
    assert.equal(doc.verificado, false);
    assert.equal(doc.observacion, "Cartola vencida");
    assert.ok(doc.revisadoEn);
    assert.ok(s.c.auditoria.listar().some((a) => a.accion === "Documento observado" && a.resultado === "EXITOSO"));

    h = await s.pedir(tens, "/tens/documentos");
    assert.match(h, /<b>Observado<\/b> por TENS\/TONS San Isidro[^<]*: Cartola vencida/);
  } finally { await s.cerrar(); }
});

test("Documentos: un documento observado no cuenta como pendiente y Recepción lo avisa", async () => {
  const s = await sitio();
  try {
    const tens = await s.login("tens@ejemplo.cl");
    const d = await s.c.documentos.registrar({ rut: "11111111-1", tipo: "Cartola FONASA", usuario: U });
    assert.match(await s.pedir(tens, "/tens/documentos?pendiente=1"), /Marcar verificado/);
    await s.c.documentos.observar(d.id, U, "Imagen ilegible");
    assert.doesNotMatch(await s.pedir(tens, "/tens/documentos?pendiente=1"), /Imagen ilegible/, "ya no está por revisar");
    const rec = await s.pedir(tens, "/tens/recepcion");
    const fila = rec.match(/<li class="rec-fila"[\s\S]*?<\/li>/g).find((f) => f.includes("11111111-1"));
    assert.match(fila, /Documento observado/);
    assert.match(fila, /Imagen ilegible/);
    assert.match(fila, /Subir documento/);
  } finally { await s.cerrar(); }
});

test("Auditoría: la pantalla muestra la columna Resultado y filtra por ella", async () => {
  const s = await sitio();
  try {
    const admin = await s.login("admin@ejemplo.cl");
    const tens = await s.login("tens@ejemplo.cl");
    await s.pedir(tens, "/admin/resumen"); // rechazado (rol)
    let h = await s.pedir(admin, "/admin/auditoria");
    assert.match(h, /<th>Resultado<\/th>/);
    assert.match(h, /Seleccionar resultado…/);
    assert.match(h, /Acceso rechazado/);
    assert.match(h, /<span class="status red">Rechazado<\/span>/);
    h = await s.pedir(admin, "/admin/auditoria?resultado=EXITOSO");
    assert.doesNotMatch(h, /Acceso rechazado/);
  } finally { await s.cerrar(); }
});

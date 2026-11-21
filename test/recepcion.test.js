"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");
const { hoy } = require("../src/herramientas/tiempo");

const USUARIO = { nombre: "TENS Prueba", idPoliclinico: 1 };

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const bloques = await c.catalogo.bloques();
  const rutB = "22222222-2", rutC = "33333333-3";
  const bC = bloques.find((b) => b.id !== 1 && b.id !== 2 && b.publicado && b.idProfesional === 1);
  const citaC = await c.agendamiento.agendar({ rut: rutC, idBloque: bC.id, idUsuario: "u2" });
  for (const id of [1, 2, bC.id]) await c.catalogo.actualizarBloque(id, { fecha: hoy() });
  await c.documentos.registrar({ rut: rutB, tipo: "Cartola FONASA", usuario: USUARIO });
  const dC = await c.documentos.registrar({ rut: rutC, tipo: "Credencial CESFAM", usuario: USUARIO });
  await c.documentos.verificar((dC.id ?? dC), { nombre: "TENS Prueba" });
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo: "tens@ejemplo.cl", clave: "demo1234" }) });
  const a = r.headers.get("set-cookie").split(";")[0];
  return {
    c, citaC,
    get: (ruta) => fetch(base + ruta, { headers: { Cookie: a } }).then((x) => x.text()),
    post: (ruta, d) => fetch(base + ruta, { method: "POST", headers: { Cookie: a }, body: new URLSearchParams(d) }).then((x) => x.text()),
    cerrar: () => new Promise((r) => srv.close(r)),
  };
}
const filas = (h) => h.match(/<li class="rec-fila"[\s\S]*?<\/li>/g) || [];
const fila = (h, rut) => filas(h).find((f) => f.includes(rut));

test("Recepción: lista las citas de hoy con hora, paciente (nombre y RUT) y especialidad/profesional", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/recepcion");
    assert.equal(filas(h).length, 3);
    const f = fila(h, "11111111-1");
    assert.match(f, /<time[^>]*>\d{2}:\d{2}<\/time>/);
    assert.match(f, /Paciente A/);
    assert.match(f, /Medicina General/);
    assert.match(f, /Profesional 1/);
  } finally { await s.cerrar(); }
});

test("Recepción: el buscador encuentra por RUT o por nombre", async () => {
  const s = await sitio();
  try {
    assert.match(await s.get("/tens/recepcion"), /<form class="rec-buscar"[^>]*>/);
    const porRut = await s.get("/tens/recepcion?q=22222222");
    assert.equal(filas(porRut).length, 1);
    assert.ok(fila(porRut, "22222222-2"));
    const porNombre = await s.get("/tens/recepcion?q=paciente%20c");
    assert.equal(filas(porNombre).length, 1);
    assert.ok(fila(porNombre, "33333333-3"));
    assert.match(await s.get("/tens/recepcion?q=zzz"), /Ninguna cita de hoy coincide/);
  } finally { await s.cerrar(); }
});

test("Recepción: estado del documento en tres escenarios", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/recepcion");
    const a = fila(h, "11111111-1");
    assert.match(a, /Documento faltante/);
    assert.match(a, /Subir documento/);
    assert.match(a, /href="\/tens\/documentos\?rut=11111111-1"/);
    const b = fila(h, "22222222-2");
    assert.match(b, /Pendiente de validación/);
    assert.match(b, /Verificar y validar/);
    assert.match(b, /action="\/tens\/documentos\/verificar"/);
    assert.match(b, /name="volver" value="recepcion"/);
    const c = fila(h, "33333333-3");
    assert.match(c, /Documento validado ✔/);
    assert.doesNotMatch(c, /Verificar y validar|Subir documento/);
  } finally { await s.cerrar(); }
});

test("Recepción: solo dos acciones de asistencia y nada clínico", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/recepcion");
    const f = fila(h, "11111111-1");
    assert.match(f, />Registrar llegada</);
    assert.match(f, />No asiste</);
    assert.doesNotMatch(f, /Asistió|Cancelar \(asistida\)/);
    const contenido = h.match(/<main[\s\S]*<\/main>/)?.[0] || h;
    assert.doesNotMatch(contenido, /Ficha cl[ií]nica|Historial m[eé]dico|>Atenci[oó]n</i);
  } finally { await s.cerrar(); }
});

test("Recepción: registrar llegada, no asiste y verificar documento vuelven a Recepción", async () => {
  const s = await sitio();
  try {
    let h = await s.post("/tens/recepcion/llegada", { idCita: "1" });
    assert.match(h, /Llegada registrada/);
    assert.match(fila(h, "11111111-1"), /Llegó/);
    assert.doesNotMatch(fila(h, "11111111-1"), />Registrar llegada</);
    assert.equal((s.c.operacion.meta.citas[1] || {}).flujo, "Llegó");

    h = await s.post("/tens/recepcion", { idCita: "2", asistio: "0" });
    assert.match(h, /Asistencia registrada/);
    assert.match(fila(h, "22222222-2"), /No asistió/);

    const idDoc = [...s.c.documentos.listar()].find((d) => d.rut === "22222222-2").id;
    h = await s.post("/tens/documentos/verificar", { id: idDoc, volver: "recepcion" });
    assert.match(h, /Documento verificado/);
    assert.match(h, /class="rec-fila"/);
    assert.match(fila(h, "22222222-2"), /Documento validado ✔/);
  } finally { await s.cerrar(); }
});

test("Menú de TENS/TONS incluye Recepción", async () => {
  const s = await sitio();
  try {
    assert.match(await s.get("/tens/resumen"), /<a href="\/tens\/recepcion">[\s\S]*?<span>Recepción<\/span>/);
  } finally { await s.cerrar(); }
});

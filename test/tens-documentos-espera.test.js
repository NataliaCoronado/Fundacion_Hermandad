"use strict";
require("./helpers/reloj");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

const USUARIO = { nombre: "TENS Prueba", idPoliclinico: 1 };

async function sitio({ liberada = false } = {}) {
  const c = crearContenedor();
  await c.inicializar();
  await c.documentos.registrar({ rut: "22222222-2", tipo: "Cartola FONASA", usuario: USUARIO });
  const ps = (await c.catalogo.pacientes()).slice(0, 3);
  for (const p of ps) { c.operacion.meta.pacientes[p.rut] = c.operacion.meta.pacientes[p.rut] || {}; c.operacion.meta.pacientes[p.rut].sedes = [1]; }
  const esps = ["Kinesiología", "Fonoaudiología", "Medicina General"];
  for (const e of ["Fonoaudiología", "Medicina General"]) (c.operacion.meta.especialidades[e] ||= {}).listaEspera = true;
  for (const [i, p] of ps.entries()) await c.espera.registrar({ rut: p.rut, idPoliclinico: 1, especialidad: esps[i], idUsuario: "u2" });
  if (liberada) await c.agendamiento.avisarCupoLiberado({ idBloque: 1 });
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const entrar = async (correo) => {
    const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
    return r.headers.get("set-cookie").split(";")[0];
  };
  const t = await entrar("tens@ejemplo.cl"), tm = await entrar("telemedicina.usuario@ejemplo.cl");
  return {
    c,
    get: (ruta, ck = t) => fetch(base + ruta, { headers: { Cookie: ck } }).then((x) => x.text()),
    post: (ruta, d, ck = t) => fetch(base + ruta, { method: "POST", headers: { Cookie: ck }, body: new URLSearchParams(d) }).then((x) => x.text()),
    tm,
    cerrar: () => new Promise((r) => srv.close(r)),
  };
}
const filaDe = (h, texto) => (h.match(/<tr>[\s\S]*?<\/tr>/g) || []).find((f) => f.includes(texto)) || "";

test("Documentos: TENS/TONS y Telemedicina lo tienen en el menú, abriendo lo pendiente", async () => {
  const s = await sitio();
  try {
    for (const ck of [undefined, s.tm]) {
      const h = await s.get("/tens/resumen", ck);
      assert.match(h, /<a href="\/tens\/documentos\?pendiente=1"><svg[\s\S]*?<span>Documentos<\/span><\/a>/);
    }
  } finally { await s.cerrar(); }
});

test("Documentos: la página existente muestra pendientes con validar y observar", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/documentos?pendiente=1");
    assert.match(h, /Documentos pendientes de verificar/);
    assert.match(h, /action="\/tens\/documentos\/verificar"/);
    assert.match(h, /action="\/tens\/documentos\/observar"/);
  } finally { await s.cerrar(); }
});

test("Lista de espera: avisa las horas liberadas de su policlínico", async () => {
  const s = await sitio({ liberada: true });
  try {
    const h = await s.get("/tens/espera");
    assert.match(h, /<section class="espera-liberadas"[^>]*>[\s\S]*?Se liberó 1 hora[\s\S]*?<\/section>/);
    assert.match(filaDe(h, "Medicina General"), /<span class="espera-liberada">Hora liberada<\/span>/);
    assert.doesNotMatch(filaDe(h, "Kinesiología"), /Hora liberada/);
  } finally { await s.cerrar(); }
});

test("Lista de espera: sin horas liberadas no aparece la franja", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/espera");
    assert.doesNotMatch(h, /<section class="espera-liberadas"/);
  } finally { await s.cerrar(); }
});

test("Lista de espera: cada fila trae «Retirar de la lista» con motivo obligatorio", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/espera");
    const f = filaDe(h, "Kinesiología");
    assert.match(f, /<details class="espera-retirar"><summary>Retirar de la lista<\/summary>/);
    assert.match(f, /action="\/tens\/espera\/retirar"[\s\S]*?name="motivo" required/);
  } finally { await s.cerrar(); }
});

test("Lista de espera: asignar la hora vuelve a la misma pantalla y marca el aviso como leído", async () => {
  const s = await sitio({ liberada: true });
  try {
    const fila = (await s.c.espera.vigentes()).find((e) => e.idPoliclinico === 1 && e.especialidad === "Medicina General");
    const h = await s.post("/tens/espera/asignar", { idSolicitud: fila.id, idBloque: fila.cupos[0].id });
    assert.match(h, /Cupo asignado/);
    assert.match(h, /<details class="espera-nueva"/, "se ve la pantalla actual, no la antigua");
    assert.ok(s.c.extras.listar("notificaciones").filter((n) => n.tipo === "CUPO_LIBERADO").every((n) => n.leida), "el aviso queda leído");
  } finally { await s.cerrar(); }
});

test("Lista de espera: retirar con motivo vuelve a la pantalla actual y la persona sale de la lista", async () => {
  const s = await sitio();
  try {
    const fila = (await s.c.espera.vigentes()).find((e) => e.idPoliclinico === 1 && e.especialidad === "Kinesiología");
    const h = await s.post("/tens/espera/retirar", { idSolicitud: fila.id, motivo: "El paciente ya se atendió" });
    assert.match(h, /Solicitud retirada/);
    assert.match(h, /<details class="espera-nueva"/);
    assert.ok(!(await s.c.espera.vigentes()).some((e) => e.id === fila.id));
  } finally { await s.cerrar(); }
});

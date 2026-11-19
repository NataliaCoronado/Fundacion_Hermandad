"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { crearContenedor } = require("../src/contenedor");
const { crearPg } = require("./helpers/pglite");

const PDF = { nombre: "cartola.pdf", datos: Buffer.from("%PDF-1.4\nprueba") };
const RUT = "11111111-1";

async function contenedor() {
  process.env.DIR_DOCUMENTOS = fs.mkdtempSync(path.join(os.tmpdir(), "pg-docs-"));
  const { pg, db } = await crearPg();
  const guardados = [];
  const persistencia = { leer: () => null, guardar: (x) => guardados.push(JSON.parse(JSON.stringify(x))) };
  const c = crearContenedor({ db, persistencia });
  await c.inicializar();
  const usuarios = await c.catalogo.usuarios();
  const tens = usuarios.find((u) => u.rol === "TENS_TONS");
  return { c, db, pg, tens, guardados, persistencia, recrear: async () => { const c2 = crearContenedor({ db, persistencia }); await c2.inicializar(); return c2; } };
}
const limpiar = () => { delete process.env.DIR_DOCUMENTOS; };

test("BD: la auditoría se guarda en la tabla auditoria con su resultado", async () => {
  const s = await contenedor();
  try {
    await s.c.auditoria.registrar(s.tens, "Cita agendada", "cita 1", { modulo: "Citas", registro: "1", idPoliclinico: 1 });
    await s.c.auditoria.registrar(s.tens, "Acceso rechazado", "FUERA_DE_SEDE", { modulo: "Seguridad", registro: "/tens/x", resultado: "RECHAZADO" });
    await s.c.extras.esperarEscrituras();
    const filas = await s.db.query("SELECT operacion, entidad, id_entidad, resultado, id_usuario::text AS u, id_policlinico FROM auditoria ORDER BY id_auditoria");
    assert.equal(filas.length, 2);
    assert.deepEqual([filas[0].operacion, filas[0].entidad, filas[0].resultado], ["Cita agendada", "Citas", "EXITOSO"]);
    assert.equal(filas[0].u, s.tens.id);
    assert.deepEqual([filas[1].operacion, filas[1].resultado], ["Acceso rechazado", "RECHAZADO"]);
    // al reiniciar la aplicación el historial vuelve desde la base
    const c2 = await s.recrear();
    assert.equal(c2.auditoria.listar().length, 2);
    assert.equal(c2.auditoria.listar()[0].resultado, "RECHAZADO");
  } finally { limpiar(); await s.db.cerrar(); }
});

test("BD: el documento vive en la tabla documento, con estado de revisión, revisor y fecha", async () => {
  const s = await contenedor();
  try {
    const d = await s.c.documentos.registrar({ rut: RUT, tipo: "Cartola FONASA", usuario: s.tens, archivo: PDF });
    await s.c.extras.esperarEscrituras();
    let f = (await s.db.query("SELECT tipo, formato, origen, estado_revision, revisado_por, revisado_en, tamano_kb, ruta_archivo FROM documento"))[0];
    assert.deepEqual([f.tipo, f.formato, f.origen, f.estado_revision], ["FONASA", "PDF", "PERSONAL", "PENDIENTE"]);
    assert.equal(f.revisado_por, null);
    assert.match(f.ruta_archivo, /\.pdf$/);
    assert.doesNotMatch(f.ruta_archivo, /^(\/|https?:)/, "no es una URL ni una ruta pública");

    await s.c.documentos.verificar(d.id, s.tens);
    await s.c.extras.esperarEscrituras();
    f = (await s.db.query("SELECT estado_revision, revisado_por::text AS por, revisado_en FROM documento"))[0];
    assert.equal(f.estado_revision, "VALIDADO");
    assert.equal(f.por, s.tens.id);
    assert.ok(f.revisado_en);

    const d2 = await s.c.documentos.registrar({ rut: RUT, tipo: "Credencial CESFAM", usuario: s.tens, archivo: PDF });
    await assert.rejects(() => s.c.documentos.observar(d2.id, s.tens, ""), /MOTIVO_REQUERIDO/);
    await s.c.documentos.observar(d2.id, s.tens, "Imagen ilegible");
    await s.c.extras.esperarEscrituras();
    const g = (await s.db.query("SELECT estado_revision, observacion, revisado_en FROM documento WHERE tipo='CESFAM'"))[0];
    assert.deepEqual([g.estado_revision, g.observacion], ["OBSERVADO", "Imagen ilegible"]);
    assert.ok(g.revisado_en);

    const c2 = await s.recrear();
    const lista = c2.documentos.listar();
    assert.equal(lista.length, 2);
    assert.equal(lista.find((x) => x.tipo === "Cartola FONASA").verificado, true);
    assert.equal(lista.find((x) => x.tipo === "Credencial CESFAM").estadoRevision, "OBSERVADO");
  } finally { limpiar(); await s.db.cerrar(); }
});

test("BD: con PostgreSQL, extras.json ya no guarda auditoría, documentos ni historial", async () => {
  const s = await contenedor();
  try {
    await s.c.documentos.registrar({ rut: RUT, tipo: "Cartola FONASA", usuario: s.tens, archivo: PDF });
    await s.c.auditoria.registrar(s.tens, "Prueba", "x");
    await s.c.extras.esperarEscrituras();
    s.c.guardar();
    const ultimo = s.guardados.at(-1);
    for (const k of ["auditoria", "documentos", "historial"]) assert.ok(!(k in ultimo) || ultimo[k].length === 0, `extras.json no debe guardar ${k}`);
    assert.ok("mensajes" in ultimo, "lo demás sigue en extras.json");
  } finally { limpiar(); await s.db.cerrar(); }
});

test("BD: cada cambio de estado de una cita deja una fila en cita_historial", async () => {
  const s = await contenedor();
  try {
    const bloque = (await s.c.catalogo.bloques()).find((b) => b.publicado && b.id > 2);
    const cita = await s.c.agendamiento.agendar({ rut: RUT, idBloque: bloque.id, idUsuario: s.tens.id });
    await s.c.agendamiento.registrarAsistencia(cita.id, true);
    await s.c.extras.esperarEscrituras();
    const h = await s.db.query("SELECT operacion, estado_anterior, estado_nuevo, origen FROM cita_historial WHERE id_cita = $1 ORDER BY id_historial", [cita.id]);
    assert.deepEqual(h.map((x) => x.operacion), ["RESERVA", "ASISTENCIA"]);
    assert.equal(h[0].estado_nuevo, "RESERVADA");
    assert.deepEqual([h[1].estado_anterior, h[1].estado_nuevo], ["RESERVADA", "ASISTIO"]);
  } finally { limpiar(); await s.db.cerrar(); }
});

test("BD: la migración agrega lo necesario y se puede repetir sin error", async () => {
  const { pg, db } = await crearPg();
  try {
    const sql = fs.readFileSync(path.join(__dirname, "..", "db", "04_migracion_auditoria_documentos.sql"), "utf8");
    await pg.exec("ALTER TABLE auditoria DROP COLUMN IF EXISTS resultado");
    await pg.exec(sql);
    await pg.exec(sql);
    const cols = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='auditoria'")).map((x) => x.column_name);
    assert.ok(cols.includes("resultado"));
  } finally { await db.cerrar(); }
});

test("Migración: auditoría y documentos de extras.json pasan a las tablas sin duplicarse", async () => {
  const s = await contenedor();
  try {
    const { migrar } = require("../src/repositories/MigracionExtras");
    const extras = {
      auditoria: [{ id: 1, fecha: "2026-11-18 10:00", usuario: "TENS", accion: "Cita agendada", detalle: "cita 1", idUsuario: s.tens.id, modulo: "Citas", registro: "1", idPoliclinico: 1 }],
      documentos: [{ id: 1, rut: RUT, tipo: "Orden médica / derivación", registradoPor: "TENS", fecha: "2026-11-18 10:05", verificado: true, verificadoPor: s.tens.nombre, idPoliclinico: 1, observacion: "", adjunto: { guardado: "11111111-1_Orden_2026-11-18_abc123.pdf", original: "orden.pdf", formato: "PDF", mime: "application/pdf", kb: 3 } }],
    };
    const r1 = await migrar(s.db, extras);
    const r2 = await migrar(s.db, extras);
    assert.deepEqual(r1, { auditoria: 1, documentos: 1 });
    assert.deepEqual(r2, { auditoria: 0, documentos: 0 }, "idempotente");
    assert.equal((await s.db.query("SELECT count(*)::int AS n FROM auditoria"))[0].n, 1);
    const d = (await s.db.query("SELECT tipo, estado_revision FROM documento"))[0];
    assert.deepEqual([d.tipo, d.estado_revision], ["ORDEN_MEDICA", "VALIDADO"]);
  } finally { limpiar(); await s.db.cerrar(); }
});

// Simula una base creada antes de este cambio: sin resultado en auditoria y sin las columnas nuevas de documento.
const dejarComoAntes = async (pg) => {
  await pg.exec(`ALTER TABLE auditoria DROP CONSTRAINT IF EXISTS ck_auditoria_resultado;
    ALTER TABLE auditoria DROP COLUMN resultado;
    ALTER TABLE auditoria ALTER COLUMN operacion TYPE VARCHAR(40);
    ALTER TABLE auditoria ALTER COLUMN id_entidad TYPE VARCHAR(40);
    ALTER TABLE documento DROP COLUMN etiqueta_tipo, DROP COLUMN nombre_original, DROP COLUMN id_policlinico, DROP COLUMN especialidad, DROP COLUMN vigente_hasta, DROP COLUMN reemplaza, DROP COLUMN archivado;`);
};
const extrasHeredados = (c) => ({
  ...require("../src/models/datos").crearDatos().extras,
  auditoria: [
    { id: 1, fecha: "2026-11-18 10:00", usuario: "TENS", accion: "Cita agendada", detalle: "cita 1", idUsuario: null, modulo: "Citas", registro: "1", idPoliclinico: 1 },
    { id: 2, fecha: "2026-11-18 10:05", usuario: "TENS", accion: "Estado del integrante actualizado con un nombre bastante largo para la columna", detalle: "x", idUsuario: null, modulo: "Equipo", registro: "7", idPoliclinico: 1 },
  ],
  documentos: [
    { id: 1, rut: RUT, tipo: "Cartola FONASA", registradoPor: "TENS", fecha: "2026-11-18 10:05", verificado: false, verificadoPor: null, idPoliclinico: 1, observacion: "", adjunto: null },
    { id: 2, rut: "99999999-9", tipo: "Cartola FONASA", registradoPor: "TENS", fecha: "2026-11-18 10:06", verificado: false, verificadoPor: null, idPoliclinico: 1, observacion: "", adjunto: null },
  ],
});

test("Arranque con una base antigua: aplica la migración de esquema y trae lo que había en extras.json", async () => {
  const { pg, db } = await crearPg();
  try {
    await dejarComoAntes(pg);
    const guardados = [];
    const persistencia = { leer: () => extrasHeredados(), guardar: (x) => guardados.push(JSON.parse(JSON.stringify(x))) };
    const c = crearContenedor({ db, persistencia });
    await c.inicializar();
    const cols = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='auditoria'")).map((x) => x.column_name);
    assert.ok(cols.includes("resultado"), "el arranque agregó la columna");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM auditoria"))[0].n, 2, "la auditoría heredada pasó a la tabla");
    assert.equal((await db.query("SELECT count(*)::int AS n FROM documento"))[0].n, 1);
    assert.equal(c.auditoria.listar().length, 2);
  } finally { await db.cerrar(); }
});

test("Arranque: lo que no se puede migrar no se pierde, queda en extras.json y se avisa", async () => {
  const { pg, db } = await crearPg();
  const avisos = [];
  const original = console.error;
  console.error = (...a) => avisos.push(a.join(" "));
  try {
    await dejarComoAntes(pg);
    const guardados = [];
    const persistencia = { leer: () => extrasHeredados(), guardar: (x) => guardados.push(JSON.parse(JSON.stringify(x))) };
    const c = crearContenedor({ db, persistencia });
    await c.inicializar();
    c.guardar();
    const ultimo = guardados.at(-1);
    assert.equal(ultimo.legado_no_migrado.documentos.length, 1, "el documento de un paciente inexistente se conserva");
    assert.equal(ultimo.legado_no_migrado.documentos[0].rut, "99999999-9");
    assert.ok(!("auditoria" in ultimo), "lo migrado ya no se guarda en el JSON");
    assert.ok(avisos.some((a) => /no se pudieron migrar/i.test(a)), "se avisó en el registro");
  } finally { console.error = original; await db.cerrar(); }
});

"use strict";
// RNF06 / CP-42: respaldo y restauración de los datos y los archivos.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const R = require("../src/util/respaldo");

function escenario() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "respaldo-"));
  const datos = path.join(raiz, "datos");
  const respaldos = path.join(raiz, "respaldos");
  fs.mkdirSync(path.join(datos, "documentos"), { recursive: true });
  fs.writeFileSync(path.join(datos, "estado.json"), JSON.stringify({ citas: [1, 2, 3] }));
  fs.writeFileSync(path.join(datos, "documentos", "a.pdf"), "%PDF-1.4 original");
  fs.writeFileSync(path.join(datos, ".DS_Store"), "basura de macOS");
  fs.writeFileSync(path.join(datos, "estado.json.tmp"), "escritura a medias");
  return { raiz, datos, respaldos, fin: () => fs.rmSync(raiz, { recursive: true, force: true }) };
}
const leer = (...p) => fs.readFileSync(path.join(...p), "utf8");

test("respaldo: copia todos los datos con su huella e ignora archivos del sistema y temporales", () => {
  const e = escenario();
  try {
    const { carpeta, manifiesto } = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: "" });
    assert.deepStrictEqual(manifiesto.archivos.map((a) => a.ruta), ["datos/documentos/a.pdf", "datos/estado.json"]);
    assert.strictEqual(manifiesto.modo, "memoria");
    assert.ok(manifiesto.archivos.every((a) => /^[0-9a-f]{64}$/.test(a.sha256) && a.bytes > 0));
    assert.strictEqual(leer(carpeta, "datos", "documentos", "a.pdf"), "%PDF-1.4 original");
    assert.ok(R.verificarRespaldo(carpeta).ok);
  } finally { e.fin(); }
});

test("respaldo: detecta un archivo alterado o faltante", () => {
  const e = escenario();
  try {
    const { carpeta } = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: "" });
    fs.writeFileSync(path.join(carpeta, "datos", "estado.json"), "{}");
    fs.rmSync(path.join(carpeta, "datos", "documentos", "a.pdf"));
    const v = R.verificarRespaldo(carpeta);
    assert.strictEqual(v.ok, false);
    assert.ok(v.problemas.some((p) => /estado\.json no coincide/.test(p)));
    assert.ok(v.problemas.some((p) => /Falta datos\/documentos\/a\.pdf/.test(p)));
  } finally { e.fin(); }
});

test("restaurar: deja los datos exactamente como en el respaldo, sin mezclar, y antes respalda lo actual", () => {
  const e = escenario();
  try {
    const { carpeta } = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: "" });
    // Después del respaldo: se modifica un archivo, se borra un documento y aparece uno nuevo.
    fs.writeFileSync(path.join(e.datos, "estado.json"), JSON.stringify({ citas: [] }));
    fs.rmSync(path.join(e.datos, "documentos", "a.pdf"));
    fs.writeFileSync(path.join(e.datos, "documentos", "nuevo.pdf"), "%PDF posterior");
    const r = R.restaurar({ respaldo: carpeta, datos: e.datos, destinoSeguridad: e.respaldos, baseDatos: "" });
    assert.deepStrictEqual(JSON.parse(leer(e.datos, "estado.json")), { citas: [1, 2, 3] });
    assert.strictEqual(leer(e.datos, "documentos", "a.pdf"), "%PDF-1.4 original", "el documento borrado vuelve");
    assert.ok(!fs.existsSync(path.join(e.datos, "documentos", "nuevo.pdf")), "no mezcla: lo posterior al respaldo no queda");
    assert.ok(!fs.existsSync(`${e.datos}.restaurando`), "no deja la carpeta temporal");
    // La copia de seguridad tiene el estado de justo antes de restaurar, para poder deshacer.
    assert.match(path.basename(r.seguridad), /antes-de-restaurar/);
    assert.strictEqual(leer(r.seguridad, "datos", "documentos", "nuevo.pdf"), "%PDF posterior");
  } finally { e.fin(); }
});

test("restaurar: un respaldo dañado no toca los datos actuales", () => {
  const e = escenario();
  try {
    const { carpeta } = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: "" });
    fs.writeFileSync(path.join(carpeta, "datos", "estado.json"), "dañado");
    fs.writeFileSync(path.join(e.datos, "estado.json"), '{"actual":true}');
    assert.throws(() => R.restaurar({ respaldo: carpeta, datos: e.datos, destinoSeguridad: e.respaldos, baseDatos: "" }), /no se puede usar/);
    assert.strictEqual(leer(e.datos, "estado.json"), '{"actual":true}');
  } finally { e.fin(); }
});

test("respaldo con PostgreSQL: incluye el volcado de la base; si pg_dump falla no queda un respaldo a medias", () => {
  const e = escenario();
  try {
    const url = "postgres://u:clave%20secreta@localhost:5432/hermandad";
    let llamada;
    const falso = (programa, args, conexion) => { llamada = { programa, args, conexion }; fs.writeFileSync(args[args.indexOf("--file") + 1], "PGDMP volcado"); };
    const { carpeta, manifiesto } = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: url, ejecutar: falso });
    assert.strictEqual(manifiesto.modo, "postgresql");
    assert.ok(manifiesto.archivos.some((a) => a.ruta === "base.dump"));
    assert.strictEqual(llamada.programa, "pg_dump");
    assert.ok(!llamada.args.join(" ").includes("secreta"), "la clave no va en la línea de comandos");
    assert.ok(R.verificarRespaldo(carpeta).ok);
    // Sin pg_dump instalado: error claro y ninguna carpeta que parezca un respaldo válido.
    const antes = R.listarRespaldos(e.respaldos).length;
    const sinPg = () => { const err = new Error("pg_dump no está instalado en este equipo"); throw err; };
    assert.throws(() => R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: url, ejecutar: sinPg }), /no está instalado/);
    assert.strictEqual(R.listarRespaldos(e.respaldos).length, antes);
  } finally { e.fin(); }
});

test("restaurar: no mezcla modos (respaldo con base sin DATABASE_URL, o al revés)", () => {
  const e = escenario();
  try {
    const falso = (p, args) => { if (p === "pg_dump") fs.writeFileSync(args[args.indexOf("--file") + 1], "x"); };
    const conBase = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: "postgres://u:c@h/db", ejecutar: falso }).carpeta;
    assert.throws(() => R.restaurar({ respaldo: conBase, datos: e.datos, destinoSeguridad: e.respaldos, baseDatos: "" }), /define DATABASE_URL/);
    const sinBase = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: "" }).carpeta;
    assert.throws(() => R.restaurar({ respaldo: sinBase, datos: e.datos, destinoSeguridad: e.respaldos, baseDatos: "postgres://u:c@h/db" }), /desalineados/);
  } finally { e.fin(); }
});

test("respaldo: dos respaldos en el mismo segundo no se pisan", () => {
  const e = escenario();
  try {
    const ahora = new Date(2026, 10, 18, 23, 30, 0);
    const a = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: "", ahora }).carpeta;
    const b = R.crearRespaldo({ datos: e.datos, destino: e.respaldos, baseDatos: "", ahora }).carpeta;
    assert.notStrictEqual(a, b);
    assert.strictEqual(R.listarRespaldos(e.respaldos).length, 2);
  } finally { e.fin(); }
});

"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { cargarEnv } = require("../src/herramientas/entorno");

const conArchivo = (contenido, fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "env-"));
  const archivo = path.join(dir, ".env");
  fs.writeFileSync(archivo, contenido);
  try {
    return fn(archivo);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};
const limpiar = (...claves) => claves.forEach((c) => delete process.env[c]);

test("entorno: lee claves, ignora comentarios y líneas vacías, y quita las comillas", () => {
  limpiar("PRUEBA_UNO", "PRUEBA_DOS", "PRUEBA_TRES");
  const n = conArchivo('# un comentario\n\nPRUEBA_UNO=valor1\nPRUEBA_DOS="con espacios"\nexport PRUEBA_TRES=\'simples\'\nsin_igual\n', cargarEnv);
  assert.strictEqual(n, 3);
  assert.strictEqual(process.env.PRUEBA_UNO, "valor1");
  assert.strictEqual(process.env.PRUEBA_DOS, "con espacios");
  assert.strictEqual(process.env.PRUEBA_TRES, "simples");
  limpiar("PRUEBA_UNO", "PRUEBA_DOS", "PRUEBA_TRES");
});

test("entorno: no sobrescribe lo que ya viene del sistema", () => {
  process.env.PRUEBA_SISTEMA = "del sistema";
  conArchivo("PRUEBA_SISTEMA=del archivo\n", cargarEnv);
  assert.strictEqual(process.env.PRUEBA_SISTEMA, "del sistema");
  limpiar("PRUEBA_SISTEMA");
});

test("entorno: acepta un archivo guardado en Windows (CRLF)", () => {
  limpiar("PRUEBA_CRLF");
  conArchivo("PRUEBA_CRLF=valor\r\nOTRA=x\r\n", cargarEnv);
  assert.strictEqual(process.env.PRUEBA_CRLF, "valor", "no debe quedar el retorno de carro pegado al valor");
  limpiar("PRUEBA_CRLF", "OTRA");
});

test("entorno: sin archivo .env no falla ni carga nada", () => {
  assert.strictEqual(cargarEnv(path.join(os.tmpdir(), "no-existe-" + Date.now(), ".env")), 0);
});

test("entorno: un valor con = adentro se conserva completo", () => {
  limpiar("PRUEBA_URL");
  conArchivo("PRUEBA_URL=postgres://u:c@localhost:5432/db?x=1\n", cargarEnv);
  assert.strictEqual(process.env.PRUEBA_URL, "postgres://u:c@localhost:5432/db?x=1");
  limpiar("PRUEBA_URL");
});

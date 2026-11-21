"use strict";
const fs = require("node:fs");
const path = require("node:path");

async function crearPg({ migracion = false } = {}) {
  const { PGlite } = require("@electric-sql/pglite");
  const pg = new PGlite();
  const archivos = ["01_estructura.sql", "02_datos_ejemplo.sql", "03_credenciales.sql"];
  for (const f of archivos) await pg.exec(fs.readFileSync(path.join(__dirname, "..", "..", "base-de-datos", f), "utf8"));
  const db = {
    query: async (sql, params) => (await pg.query(sql, params)).rows,
    tx: async (fn) => pg.transaction((tx) => fn(async (sql, params) => (await tx.query(sql, params)).rows)),
    cerrar: async () => pg.close(),
  };
  return { pg, db };
}
module.exports = { crearPg };

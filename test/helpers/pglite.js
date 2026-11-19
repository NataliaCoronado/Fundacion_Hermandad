"use strict";
const fs = require("node:fs");
const path = require("node:path");

// Base PostgreSQL embebida (PGlite) con el esquema real del proyecto, para probar los repositorios sin servidor externo.
async function crearPg({ migracion = false } = {}) {
  const { PGlite } = require("@electric-sql/pglite");
  const pg = new PGlite();
  const archivos = ["hermandad_postgresql.sql", "datos_ejemplo.sql", "03_credencial.sql"];
  for (const f of archivos) await pg.exec(fs.readFileSync(path.join(__dirname, "..", "..", "db", f), "utf8"));
  const db = {
    query: async (sql, params) => (await pg.query(sql, params)).rows,
    tx: async (fn) => pg.transaction((tx) => fn(async (sql, params) => (await tx.query(sql, params)).rows)),
    cerrar: async () => pg.close(),
  };
  return { pg, db };
}
module.exports = { crearPg };

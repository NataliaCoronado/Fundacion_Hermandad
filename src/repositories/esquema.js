"use strict";
const fs = require("node:fs");
const path = require("node:path");

// Pone al día una base creada antes de que la auditoría llevara resultado y los documentos se guardaran completos.
// Es seguro repetirlo: el archivo de migración solo agrega lo que falta.
async function asegurarEsquema(db) {
  const hay = await db.query(
    "SELECT 1 AS ok FROM information_schema.columns WHERE table_name = 'auditoria' AND column_name = 'resultado' AND table_schema = current_schema()",
  );
  const doc = await db.query(
    "SELECT 1 AS ok FROM information_schema.columns WHERE table_name = 'documento' AND column_name = 'etiqueta_tipo' AND table_schema = current_schema()",
  );
  if (hay.length && doc.length) return false;
  const sql = fs.readFileSync(path.join(__dirname, "..", "..", "db", "04_migracion_auditoria_documentos.sql"), "utf8");
  const sentencias = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  try {
    await db.tx(async (q) => {
      for (const s of sentencias) await q(s);
    });
  } catch (e) {
    throw new Error(`No se pudo actualizar el esquema de la base (db/04_migracion_auditoria_documentos.sql): ${e.message}. Ejecuta ese archivo con un usuario que pueda modificar tablas.`);
  }
  console.log("Base de datos actualizada: auditoría con resultado y documentos completos.");
  return true;
}
module.exports = { asegurarEsquema };

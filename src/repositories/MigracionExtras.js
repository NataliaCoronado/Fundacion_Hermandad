"use strict";
const { MAPEOS, upsert } = require("./mapeoExtras");

// Pasa a las tablas la auditoría, los documentos y el historial que antes se guardaban en extras.json.
// Es repetible: lo que ya está en la base (mismo id) no se vuelve a insertar.
async function migrar(db, extras) {
  const resultado = { auditoria: 0, documentos: 0 };
  const usuarios = await db.query("SELECT id_usuario::text AS id, trim(nombres || ' ' || apellidos) AS nombre FROM usuario");
  const idPorNombre = new Map(usuarios.map((u) => [u.nombre, u.id]));
  let revalidar = 0;
  let omitidos = 0;
  const noMigrados = {};

  for (const tipo of ["documentos", "auditoria", "historial"]) {
    for (const original of extras[tipo] || []) {
      const obj = structuredClone(original);
      if (tipo === "documentos") {
        obj.verificadoPorId ||= idPorNombre.get(obj.verificadoPor);
        obj.registradoPorId ||= idPorNombre.get(obj.registradoPor);
        if (obj.verificado && !obj.verificadoPorId) {
          // Sin un usuario identificable no se puede dejar "validado" (la tabla exige quién revisó).
          obj.verificado = false;
          obj.observacion = `${obj.observacion || ""} [Validado antes de la migración por ${obj.verificadoPor || "alguien sin identificar"}: validar de nuevo]`.trim();
          revalidar++;
        }
        if (obj.verificado && !obj.revisadoEn) obj.revisadoEn = obj.fecha;
      }
      const { sql, params } = upsert(MAPEOS[tipo], obj);
      const soloNuevo = sql.slice(0, sql.indexOf("ON CONFLICT")) + `ON CONFLICT (${MAPEOS[tipo].clave}) DO NOTHING RETURNING 1 AS ok`;
      try {
        const filas = await db.query(soloNuevo, params);
        if (filas.length && resultado[tipo] !== undefined) resultado[tipo]++;
      } catch (e) {
        omitidos++;
        (noMigrados[tipo] ||= []).push(original);
        if (omitidos <= 3) console.error(`Migración: se omitió ${tipo} #${original.id}: ${e.message}`);
      }
    }
  }
  if (revalidar) resultado.revalidar = revalidar;
  if (omitidos) {
    resultado.omitidos = omitidos;
    resultado.noMigrados = noMigrados;
  }
  return resultado;
}
module.exports = { migrar };

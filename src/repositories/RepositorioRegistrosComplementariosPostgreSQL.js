"use strict";
const { RepositorioRegistrosComplementariosEnMemoria } = require("./RepositorioRegistrosComplementariosEnMemoria");
const { MAPEOS, upsert } = require("./mapeoRegistrosComplementarios");

const TABLAS = Object.keys(MAPEOS);

class RepositorioRegistrosComplementariosPostgreSQL extends RepositorioRegistrosComplementariosEnMemoria {
  constructor(extras, db) {
    super(extras);
    this.db = db;
    this.cola = Promise.resolve();
    this.errores = [];
    for (const t of TABLAS) this.extras[t] ||= [];
  }

  static get TABLAS() {
    return TABLAS;
  }

  encolar(fn) {
    this.cola = this.cola.then(fn).catch((e) => {
      this.errores.push(e);
      console.error("No se pudo escribir en la base de datos:", e.message);
    });
    return this.cola;
  }

  escribir(tipo, objeto) {
    const { sql, params } = upsert(MAPEOS[tipo], structuredClone(objeto));
    return this.encolar(async () => {
      await this.db.query(sql, params);
    });
  }

  agregar(tipo, obj) {
    const agregado = super.agregar(tipo, obj);
    if (MAPEOS[tipo]) this.escribir(tipo, agregado);
    return agregado;
  }

  actualizar(tipo, id, cambios) {
    const actualizado = super.actualizar(tipo, id, cambios);
    if (MAPEOS[tipo]) this.escribir(tipo, actualizado);
    return actualizado;
  }

  async esperarEscrituras() {
    await this.cola;
    if (this.errores.length) {
      const [primero] = this.errores.splice(0);
      throw primero;
    }
  }

  async cargar(heredado = {}) {
    const { migrar } = require("./MigracionRegistrosComplementarios");
    await require("./prepararBaseDeDatos").asegurarEsquema(this.db);
    const conDatos = Object.fromEntries(TABLAS.filter((t) => (heredado[t] || []).length).map((t) => [t, heredado[t]]));
    this.legado = {};
    if (Object.keys(conDatos).length) {
      const resultadoMigracion = await migrar(this.db, conDatos);
      if (resultadoMigracion.noMigrados) {
        this.legado = resultadoMigracion.noMigrados;
        console.error(`Migración: ${resultadoMigracion.omitidos} registros no se pudieron migrar y se conservan en extras.json (clave legado_no_migrado).`);
      }
    }
    for (const t of TABLAS) {
      const filas = await this.db.query(MAPEOS[t].selectSql);
      this.extras[t].length = 0;
      this.extras[t].push(...filas.map((f) => MAPEOS[t].desdeFila(f)));
    }
    await this.completarRevisores();
  }

  async completarRevisores() {
    const usuarios = await this.db.query("SELECT id_usuario::text AS id, trim(nombres || ' ' || apellidos) AS nombre FROM usuario");
    const nombre = new Map(usuarios.map((u) => [u.id, u.nombre]));
    for (const d of this.extras.documentos) {
      if (d.verificadoPorId) d.verificadoPor = nombre.get(d.verificadoPorId) || d.verificadoPor;
      if (d.registradoPorId && d.registradoPor === "Personal") d.registradoPor = nombre.get(d.registradoPorId) || d.registradoPor;
    }
  }
}
module.exports = { RepositorioRegistrosComplementariosPostgreSQL };

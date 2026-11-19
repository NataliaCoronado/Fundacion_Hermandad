"use strict";
const { ExtrasRepositoryMemoria } = require("./ExtrasRepositoryMemoria");
const { MAPEOS, upsert } = require("./mapeoExtras");

// Con PostgreSQL, la auditoría, los documentos y el historial de citas viven en sus tablas.
// La aplicación trabaja sobre una copia en memoria (lecturas inmediatas) y cada alta o cambio
// se escribe en la base en orden, por una cola. `esperarEscrituras()` espera a que termine.
const TABLAS = Object.keys(MAPEOS);

class ExtrasRepositoryPg extends ExtrasRepositoryMemoria {
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
    // La instantánea se toma ahora: la fila escrita es la del momento del cambio.
    const { sql, params } = upsert(MAPEOS[tipo], structuredClone(objeto));
    return this.encolar(async () => {
      await this.db.query(sql, params);
    });
  }

  agregar(tipo, obj) {
    const n = super.agregar(tipo, obj);
    if (MAPEOS[tipo]) this.escribir(tipo, n);
    return n;
  }

  actualizar(tipo, id, cambios) {
    const o = super.actualizar(tipo, id, cambios);
    if (MAPEOS[tipo]) this.escribir(tipo, o);
    return o;
  }

  async esperarEscrituras() {
    await this.cola;
    if (this.errores.length) {
      const [primero] = this.errores.splice(0);
      throw primero;
    }
  }

  // Carga las tablas en memoria. Si una tabla está vacía y había datos antiguos en extras.json, los migra.
  async cargar(heredado = {}) {
    const { migrar } = require("./MigracionExtras");
    await require("./esquema").asegurarEsquema(this.db);
    const conDatos = Object.fromEntries(TABLAS.filter((t) => (heredado[t] || []).length).map((t) => [t, heredado[t]]));
    this.legado = {};
    if (Object.keys(conDatos).length) {
      const r = await migrar(this.db, conDatos);
      // Lo que no se pudo pasar a la base no se descarta: sigue en extras.json hasta que se pueda migrar.
      if (r.noMigrados) {
        this.legado = r.noMigrados;
        console.error(`Migración: ${r.omitidos} registros no se pudieron migrar y se conservan en extras.json (clave legado_no_migrado).`);
      }
    }
    for (const t of TABLAS) {
      const filas = await this.db.query(MAPEOS[t].selectSql);
      this.extras[t].length = 0;
      this.extras[t].push(...filas.map((f) => MAPEOS[t].desdeFila(f)));
    }
    await this.completarRevisores();
  }

  // El nombre de quien revisó se obtiene del usuario guardado en la base.
  async completarRevisores() {
    const usuarios = await this.db.query("SELECT id_usuario::text AS id, trim(nombres || ' ' || apellidos) AS nombre FROM usuario");
    const nombre = new Map(usuarios.map((u) => [u.id, u.nombre]));
    for (const d of this.extras.documentos) {
      if (d.verificadoPorId) d.verificadoPor = nombre.get(d.verificadoPorId) || d.verificadoPor;
      if (d.registradoPorId && d.registradoPor === "Personal") d.registradoPor = nombre.get(d.registradoPorId) || d.registradoPor;
    }
  }
}
module.exports = { ExtrasRepositoryPg };

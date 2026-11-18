'use strict';
// Conexión a PostgreSQL. Solo se carga el paquete "pg" cuando existe DATABASE_URL.
function crearDb(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url });
  const consulta = (cliente) => async (sql, params = []) => (await cliente.query(sql, params)).rows;
  return {
    query: consulta(pool),
    async tx(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const r = await fn(consulta(cliente));
        await cliente.query('COMMIT');
        return r;
      } catch (e) { await cliente.query('ROLLBACK'); throw e; } finally { cliente.release(); }
    },
    cerrar: () => pool.end(),
  };
}
module.exports = { crearDb };

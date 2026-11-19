'use strict';
const { spawnSync } = require('node:child_process');

const literal = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const interpolar = (sql, params) => sql.replace(/\$(\d+)/g, (_, n) => literal(params[Number(n) - 1]));

function crearDbPsql(args, nombreBd) {
  const base = args.split(/\s+/).filter(Boolean);
  const ejecutar = (sql, extra = []) => {
    const r = spawnSync('psql', [...base, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', ...extra, '-c', sql], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'psql falló');
    return r.stdout;
  };
  const query = async (sql, params = []) => {
    const s = interpolar(sql, params);
    if (/^\s*select/i.test(s) || /returning/i.test(s)) {
      const salida = ejecutar(`WITH r AS (${s}) SELECT COALESCE(json_agg(r), '[]'::json) FROM r`, ['-d', nombreBd]);
      return JSON.parse(salida);
    }
    ejecutar(s, ['-d', nombreBd]);
    return [];
  };
  return { query, tx: async (fn) => fn(query), ejecutar };
}
module.exports = { crearDbPsql, ejecutarSql: (args, archivo, bd) => {
  const r = spawnSync('psql', [...args.split(/\s+/).filter(Boolean), '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', bd, '-f', archivo], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
} };

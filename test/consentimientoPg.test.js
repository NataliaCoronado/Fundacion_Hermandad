'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('PostgreSQL: el consentimiento de un paciente nuevo se guarda por la web y de forma asistida', async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const pg = new PGlite();
  for (const f of ['hermandad_postgresql.sql', 'datos_ejemplo.sql', '03_credencial.sql']) {
    await pg.exec(fs.readFileSync(path.join(__dirname, '../db', f), 'utf8'));
  }
  const db = {
    query: async (sql, params) => (await pg.query(sql, params)).rows,
    tx: async (fn) => pg.transaction((tx) => fn(async (sql, params) => (await tx.query(sql, params)).rows)),
  };
  const c = require('../src/contenedor').crearContenedor({ db });
  await c.inicializar();
  const ficha = { nombres: 'Ana', apellidos: 'Prueba', fechaNacimiento: '1990-01-01', genero: 'FEMENINO', nacionalidad: 'Chilena',
    telefono: '+56911112222', tieneWhatsapp: '1', correo: '', direccion: 'Calle 1', idComuna: '1', consentimiento: true };
  await c.pacientes.crear({ ...ficha, rut: '12345678-5' });
  // Registro asistido por TENS/TONS.
  const tens = (await c.catalogo.usuarios()).find((u) => u.rol === 'TENS_TONS');
  await c.pacientes.crear({ ...ficha, rut: '44444444-4', idUsuario: tens.id });

  const filas = await db.query(`SELECT p.numero_documento AS rut, c.canal, c.registrado_por::text AS por
    FROM consentimiento c JOIN paciente p ON p.id_paciente = c.id_paciente WHERE p.numero_documento IN ('12345678-5', '44444444-4') ORDER BY 1`);
  assert.deepEqual(filas, [
    { rut: '12345678-5', canal: 'WEB', por: null },
    { rut: '44444444-4', canal: 'PRESENCIAL', por: tens.id },
  ]);
  await pg.close();
});

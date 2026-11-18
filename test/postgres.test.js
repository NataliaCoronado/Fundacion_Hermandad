'use strict';
// Prueba de los repositorios PostgreSQL contra una base real (esquema + datos de ejemplo + credencial).
// Solo corre si existe PSQL_TEST_ARGS, p. ej.:  PSQL_TEST_ARGS="-h localhost -U postgres" npm test
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { crearContenedor } = require('../src/contenedor');
const { crearDbPsql, ejecutarSql } = require('./helpers/dbPsql');

const ARGS = process.env.PSQL_TEST_ARGS;
const BD = 'hermandad_prueba_app';
const A = '11111111-1'; const C = '33333333-3';

test('PostgreSQL: repositorios y reglas con la base real', { skip: !ARGS && 'define PSQL_TEST_ARGS para probar con PostgreSQL' }, async () => {
  const admin = (sql) => spawnSync('psql', [...ARGS.split(/\s+/), '-X', '-q', '-d', 'postgres', '-c', sql], { encoding: 'utf8' });
  admin(`DROP DATABASE IF EXISTS ${BD}`); admin(`CREATE DATABASE ${BD}`);
  for (const f of ['hermandad_postgresql.sql', 'datos_ejemplo.sql', '03_credencial.sql']) ejecutarSql(ARGS, path.join(__dirname, '..', 'db', f), BD);

  process.env.CLAVE_DEMO = 'demo1234';
  const db = crearDbPsql(ARGS, BD);
  const c = crearContenedor({ db });
  await c.inicializar();
  delete process.env.CLAVE_DEMO;
  const admUser = (await c.catalogo.usuarios()).find((u) => u.rol === 'ADMINISTRACION');
  const tens = (await c.catalogo.usuarios()).find((u) => u.rol === 'TENS_TONS');
  assert.strictEqual(c.modo, 'postgresql');

  // catálogo y sesión
  assert.strictEqual((await c.catalogo.policlinicos()).length, 7);
  assert.strictEqual((await c.catalogo.profesionales()).length, 47);
  assert.strictEqual((await c.auth.iniciarSesion('admin@ejemplo.cl', 'demo1234')).usuario.rol, 'ADMINISTRACION');
  await assert.rejects(() => c.auth.iniciarSesion('admin@ejemplo.cl', 'mala'), /CREDENCIALES_INVALIDAS/);

  // citas existentes y reglas
  assert.strictEqual((await c.citaRepo.listar()).length, 2);
  assert.strictEqual((await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 })).length, 78);
  const cita = await c.agendamiento.agendar({ rut: C, idBloque: 3, idUsuario: tens.id });
  assert.strictEqual(cita.estadoReserva, 'ACTIVA');
  await assert.rejects(() => c.agendamiento.agendar({ rut: A, idBloque: 3, idUsuario: tens.id }), /BLOQUE_OCUPADO/);
  // el disparador de la base también lo impide aunque se salte el servicio (RNF04)
  await assert.rejects(() => c.citaRepo.crear({ rut: A, idBloque: 3, idUsuario: tens.id }), /BLOQUE_OCUPADO/);

  // confirmación, cancelación y reoferta
  await c.confirmacion.registrarContacto({ idCita: cita.id, resultado: 'No contestó', responsable: 'x', idUsuario: tens.id });
  assert.strictEqual((await c.citaRepo.buscarPorId(cita.id)).estadoConfirmacion, 'PENDIENTE');
  await c.confirmacion.registrarContacto({ idCita: cita.id, resultado: 'Confirmó', responsable: 'x', idUsuario: tens.id });
  assert.strictEqual((await c.citaRepo.buscarPorId(cita.id)).estadoConfirmacion, 'CONFIRMADA');
  assert.strictEqual((await c.catalogo.contactos())[0].resultado, 'Confirmó');
  await c.agendamiento.cancelar(cita.id, 'WHATSAPP');
  const cancelada = await c.citaRepo.buscarPorId(cita.id);
  assert.deepStrictEqual([cancelada.estadoReserva, cancelada.origenCancelacion], ['CANCELADA', 'WHATSAPP']);
  assert.ok((await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 })).some((b) => b.id === 3));

  // asistencia y encuesta
  await c.agendamiento.registrarAsistencia(1, true);
  assert.strictEqual((await c.citaRepo.buscarPorId(1)).asistencia, 'ASISTIO');
  await c.encuestas.registrar({ rut: A, nota: 5 });

  // paciente nuevo, bloque nuevo y lista de espera
  const rut = await c.pacientes.crear({ rut: '12345678-5', nombres: 'Ana', apellidos: 'Prueba', fechaNacimiento: '1990-01-01', genero: 'FEMENINO', telefono: '+56911112222', direccion: 'Calle 1', idComuna: 1, consentimiento: true, tieneWhatsapp: true, idUsuario: tens.id });
  assert.strictEqual((await c.catalogo.paciente(rut)).nombre, 'Ana Prueba');

  // adulto responsable: viene de los datos de ejemplo, se cambia al editar y se puede quitar
  assert.deepStrictEqual((await c.catalogo.paciente(C)).responsable, { nombre: 'Responsable de prueba', relacion: 'Madre', rut: '44444444-4', telefono: '+56944444444' });
  const fichaC = { nombres: 'Paciente de prueba', apellidos: 'C', fechaNacimiento: '2015-09-09', genero: 'FEMENINO', nacionalidad: 'Venezolana', telefono: '+56933333333', direccion: 'Dirección nueva 9', idComuna: 1 };
  await c.pacientes.actualizar(C, { ...fichaC, respNombre: 'Tía Prueba', respRelacion: 'Tía', respRut: '44444444-4', respTelefono: '+56944444555' });
  assert.deepStrictEqual((await c.catalogo.paciente(C)).responsable, { nombre: 'Tía Prueba', relacion: 'Tía', rut: '44444444-4', telefono: '+56944444555' });
  await c.pacientes.actualizar(rut, { nombres: 'Ana María', apellidos: 'Prueba', fechaNacimiento: '1990-01-01', genero: 'FEMENINO', telefono: '+56911112222', direccion: 'Calle 2', idComuna: 1 });
  assert.strictEqual((await c.catalogo.paciente(rut)).nombre, 'Ana María Prueba');
  assert.strictEqual((await c.catalogo.paciente(rut)).responsable, null);
  await assert.rejects(() => c.pacientes.actualizar('99999999-9', fichaC), /PACIENTE_NO_ENCONTRADO/);

  // caracterización: usa fecha de nacimiento, género y nacionalidad de la base
  const carac = await c.reportes.caracterizacion();
  assert.ok(carac.ninos >= 1 && carac.mayores >= 1);
  assert.ok(carac.nacionalidades.some((x) => x.nombre === 'Venezolana'));
  assert.ok((await c.reportes.porProfesional()).length >= 47);

  // liberar y bloquear cupos sin cita (los reservados no cambian)
  const libres24 = (await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1, fecha: '2026-11-24' })).filter((b) => b.idProfesional === 1).length;
  assert.strictEqual(await c.catalogo.cambiarPublicacion({ idProfesional: 1, desde: '2026-11-24', hasta: '2026-11-24', publicar: false }), libres24);
  assert.strictEqual((await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1, fecha: '2026-11-24' })).filter((b) => b.idProfesional === 1).length, 0);
  assert.strictEqual(await c.catalogo.cambiarPublicacion({ idProfesional: 1, desde: '2026-11-24', hasta: '2026-11-24', publicar: true }), libres24);
  assert.ok((await c.catalogo.bloque(1)).publicado, 'el cupo con cita sigue publicado');
  await assert.rejects(() => c.pacientes.crear({ rut, nombres: 'Ana', apellidos: 'Prueba', fechaNacimiento: '1990-01-01', genero: 'FEMENINO', telefono: '+56911112222', direccion: 'Calle 1', idComuna: 1, consentimiento: true }), /PACIENTE_EXISTE/);
  const nuevo = await c.catalogo.crearBloque({ idProfesional: 1, fecha: '2026-11-25', hora: '09:00', publicado: true });
  assert.strictEqual(nuevo.hora, '09:00');
  await assert.rejects(() => c.catalogo.crearBloque({ idProfesional: 1, fecha: '2026-11-25', hora: '09:00', publicado: true }), /BLOQUE_DUPLICADO/);
  await assert.rejects(() => c.catalogo.crearBloque({ idProfesional: 1, fecha: '2027-06-01', hora: '09:00', publicado: true }), /SIN_AGENDA/);
  await c.espera.registrar({ rut: C, idPoliclinico: 2, especialidad: 'Kinesiología', idUsuario: tens.id }).catch((e) => assert.match(e.message, /YA_EN_ESPERA/));
  await assert.rejects(() => c.espera.registrar({ rut: A, idPoliclinico: 2, especialidad: 'Odontología', idUsuario: tens.id }), /ESPECIALIDAD_NO_EN_SEDE/);
  await c.espera.registrar({ rut: A, idPoliclinico: 2, especialidad: 'Kinesiología', idUsuario: tens.id });
  const vig = await c.espera.vigentes();
  assert.ok(vig.length >= 1 && vig[0].cupos.length > 0);
  const asignada = await c.espera.asignar({ idSolicitud: vig[0].id, idBloque: vig[0].cupos[0].id, idUsuario: tens.id });
  assert.strictEqual(asignada.estadoReserva, 'ACTIVA');

  // cambio de agenda: ausencia del profesional 1 el 24/11 (cierra cupos libres)
  const r = await c.cambios.ausencia({ idProfesional: 1, fecha: '2026-11-24', motivo: 'Licencia', idUsuario: admUser.id });
  assert.strictEqual(r.bloquesCerrados, 4);
  assert.ok(!(await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1, fecha: '2026-11-24' })).some((b) => b.idProfesional === 1));
  // reemplazo se guarda en la cita
  await c.cambios.reemplazo({ idProfesional: 1, idReemplazo: 1 + 0, fecha: '2026-11-23', motivo: 'x', idUsuario: admUser.id }).catch((e) => assert.match(e.message, /REEMPLAZO_IGUAL/));

  // profesional inactivo y reportes
  await c.catalogo.setProfesionalActivo(2, false);
  assert.strictEqual((await c.catalogo.profesional(2)).activo, false);
  const csv = await c.reportes.csvResumen();
  assert.match(csv, /Citas registradas/);
  assert.ok((await c.reportes.resumen()).totalCitas >= 3);
});

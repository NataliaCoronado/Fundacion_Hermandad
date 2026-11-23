require("./helpers/reloj");
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { crearContenedor } = require('../src/armarAplicacion');
const { rutValido, normalizarRut } = require('../src/herramientas/rut');

const A = '11111111-1'; const C = '33333333-3';
const consentir = (c, rut) => { (c.operacion.meta.pacientes[rut] ||= {}).consentimientoComunicaciones = true; };

test('RUT: valida el dígito verificador y normaliza puntos', () => {
  assert.strictEqual(rutValido('11.111.111-1'), true);
  assert.strictEqual(rutValido('11111111-2'), false);
  assert.strictEqual(normalizarRut('11.111.111-1'), '11111111-1');
});

test('ficha de paciente: exige RUT válido y consentimiento', async () => {
  const { pacientes, catalogo } = crearContenedor();
  const base = { rut: '12345678-5', nombres: 'Ana', apellidos: 'Prueba', fechaNacimiento: '1990-01-01', genero: 'FEMENINO', telefono: '+56911112222', direccion: 'Calle 1', idComuna: 1, consentimiento: true };
  await assert.rejects(() => pacientes.crear({ ...base, rut: '12345678-9' }), /RUT_INVALIDO/);
  await assert.rejects(() => pacientes.crear({ ...base, consentimiento: false }), /CONSENTIMIENTO_REQUERIDO/);
  await assert.rejects(() => pacientes.crear({ ...base, telefono: '123' }), /TELEFONO_INVALIDO/);
  await pacientes.crear(base);
  assert.ok(catalogo.paciente('12345678-5'));
  await assert.rejects(() => pacientes.crear(base), /PACIENTE_EXISTE/);
});

test('bot: calendario fijo, sin duplicados y sin enviar a quien ya confirmó', async () => {
  const c = crearContenedor();
  consentir(c, (await c.citaRepo.buscarPorId(1)).rut);
  await c.bot.procesar('2026-11-16 09:00');
  assert.strictEqual(c.extras.listar('mensajes').length, 3);
  const r = await c.bot.procesar('2026-11-16 10:00');
  assert.strictEqual(r.enviados, 1);
  await c.bot.procesar('2026-11-16 10:30');
  assert.strictEqual(c.extras.listar('mensajes').filter((m) => m.tipo === 'SEMANA' && m.estado === 'ENVIADO').length, 1);
  assert.strictEqual(c.extras.listar('bandeja').filter((b) => b.direccion === 'SALIENTE').length, 1);
});

test('bot: botones Confirmar y Cancelar mi hora; cualquier otro texto solo recibe ayuda', async () => {
  const c = crearContenedor();
  const ayuda = await c.bot.responder({ idCita: 1, boton: 'Hola, ¿me puedes ayudar?' });
  assert.match(ayuda, /botones/);
  assert.strictEqual((await c.citaRepo.buscarPorId(1)).estadoConfirmacion, 'PENDIENTE');
  await c.bot.responder({ idCita: 1, boton: 'Confirmar' });
  assert.strictEqual((await c.citaRepo.buscarPorId(1)).estadoConfirmacion, 'CONFIRMADA');
  await c.bot.responder({ idCita: 2, boton: 'Cancelar mi hora' });
  const cancelada = await c.citaRepo.buscarPorId(2);
  assert.strictEqual(cancelada.estadoReserva, 'CANCELADA');
  assert.strictEqual(cancelada.origenCancelacion, 'WHATSAPP');
});

test('bot: tras el reintento sin respuesta la cita queda "sin respuesta" pero sigue reservada', async () => {
  const c = crearContenedor();
  consentir(c, (await c.citaRepo.buscarPorId(1)).rut);
  await c.bot.procesar('2026-11-22 14:00');
  const cita = await c.citaRepo.buscarPorId(1);
  assert.strictEqual(cita.estadoReserva, 'ACTIVA');
  assert.strictEqual(cita.estadoConfirmacion, 'SIN_RESPUESTA');
  assert.ok((await c.confirmacion.pendientes()).some((x) => x.id === 1));
});

test('bot: paciente sin WhatsApp no recibe mensajes; se avisa para llamar', async () => {
  const c = crearContenedor();
  await c.agendamiento.agendar({ rut: C, idBloque: 3 });
  await c.bot.procesar('2026-11-22 10:00');
  assert.ok(c.extras.listar('notificaciones').some((n) => n.tipo === 'SIN_WHATSAPP'));
  assert.ok(!c.extras.listar('bandeja').some((b) => b.telefono === '+56933333333'));
});

test('lista de espera: no asigna sola; asignar usa un cupo compatible', async () => {
  const c = crearContenedor();
  const [e] = await c.espera.vigentes();
  assert.strictEqual(e.rut, C);
  assert.ok(e.cupos.length > 0);
  assert.strictEqual((await c.citaRepo.buscarPorRut(C)).length, 0);
  await assert.rejects(() => c.espera.asignar({ idSolicitud: e.id, idBloque: 1 }), /BLOQUE_NO_DISPONIBLE/);
  await c.espera.asignar({ idSolicitud: e.id, idBloque: e.cupos[0].id });
  assert.strictEqual((await c.citaRepo.buscarPorRut(C)).length, 1);
  assert.strictEqual((await c.espera.vigentes()).length, 0);
});

test('cambio de agenda: ausencia cierra cupos libres y deja las citas para llamar', async () => {
  const c = crearContenedor();
  await c.confirmacion.registrarContacto({ idCita: 1, resultado: 'Confirmó', responsable: 't' });
  const r = await c.cambios.ausencia({ idProfesional: 1, fecha: '2026-11-23', motivo: 'Licencia', idUsuario: 'u1' });
  assert.strictEqual(r.citasAfectadas, 2);
  assert.strictEqual(r.bloquesCerrados, 2);
  assert.strictEqual((await c.citaRepo.buscarPorId(1)).estadoConfirmacion, 'PENDIENTE');
  assert.strictEqual((await c.citaRepo.buscarPorId(2)).estadoConfirmacion, 'PENDIENTE');
  assert.strictEqual((await c.citaRepo.buscarPorId(1)).estadoReserva, 'ACTIVA');
  await assert.rejects(() => c.cambios.ausencia({ idProfesional: 1, fecha: '2026-11-23', motivo: '', idUsuario: 'u1' }), /MOTIVO_REQUERIDO/);
});

test('cambio de agenda: reemplazo solo con profesional compatible', async () => {
  const c = crearContenedor();
  await assert.rejects(() => c.cambios.reemplazo({ idProfesional: 1, idReemplazo: 3, fecha: '2026-11-23', motivo: 'x', idUsuario: 'u1' }), /REEMPLAZO_NO_COMPATIBLE/);
  await assert.rejects(() => c.cambios.reemplazo({ idProfesional: 1, idReemplazo: 1, fecha: '2026-11-23', motivo: 'x', idUsuario: 'u1' }), /REEMPLAZO_IGUAL/);
});

test('encuesta: solo con asistencia registrada y una vez por atención', async () => {
  const c = crearContenedor();
  await assert.rejects(() => c.encuestas.registrar({ rut: A, nota: 5 }), /SIN_ATENCION/);
  await c.agendamiento.registrarAsistencia(1, true);
  await assert.rejects(() => c.encuestas.registrar({ rut: A, nota: 9 }), /NOTA_INVALIDA/);
  await c.encuestas.registrar({ rut: A, nota: 4, comentario: 'bien' });
  await assert.rejects(() => c.encuestas.registrar({ rut: A, nota: 4 }), /YA_RESPONDIDA/);
  assert.deepStrictEqual(c.encuestas.resumen(), { respuestas: 1, promedio: 4 });
});

test('documentos: se registran y verifican', async () => {
  const c = crearContenedor();
  const u = { nombre: 'Tens' };
  await assert.rejects(() => c.documentos.registrar({ rut: '99999999-9', tipo: 'Cartola FONASA', usuario: u }), /PACIENTE_NO_ENCONTRADO/);
  const d = await c.documentos.registrar({ rut: A, tipo: 'Cartola FONASA', usuario: u });
  await c.documentos.verificar(d.id, u);
  assert.strictEqual(c.documentos.listar()[0].verificado, true);
});

test('reportes: resumen y CSV sin datos de pacientes', async () => {
  const c = crearContenedor();
  await c.agendamiento.registrarAsistencia(2, false);
  const r = await c.reportes.resumen();
  assert.strictEqual(r.noAsistio, 1);
  assert.strictEqual(r.tasaInasistencia, 100);
  const csv = await c.reportes.csvDetalle();
  assert.ok(csv.startsWith('﻿Fecha;Hora'));
  assert.ok(!csv.includes(A) && !csv.includes('Paciente'));
});

test('ficha: adulto responsable obligatorio en menores, opcional en adultos, y la ficha se puede corregir', async () => {
  const c = crearContenedor();
  const base = { nombres: 'Niña', apellidos: 'Prueba', direccion: 'Calle 1', telefono: '+56955555555', fechaNacimiento: '2018-03-03', genero: 'FEMENINO', idComuna: 1, consentimiento: true };
  await assert.rejects(() => c.pacientes.crear({ ...base, rut: '55555555-5' }), /RESPONSABLE_REQUERIDO/);
  await assert.rejects(() => c.pacientes.crear({ ...base, rut: '55555555-5', respNombre: 'Mamá Prueba' }), /RESPONSABLE_INCOMPLETO/);
  await assert.rejects(() => c.pacientes.crear({ ...base, rut: '55555555-5', respNombre: 'Mamá Prueba', respRelacion: 'Madre', respRut: '1-1', respTelefono: '+56966666666' }), /RESPONSABLE_RUT_INVALIDO/);
  await c.pacientes.crear({ ...base, rut: '55555555-5', respNombre: 'Mamá Prueba', respRelacion: 'Madre', respRut: '66666666-6', respTelefono: '+56966666666' });
  assert.deepStrictEqual((await c.catalogo.paciente('55555555-5')).responsable, { nombre: 'Mamá Prueba', relacion: 'Madre', rut: '66666666-6', telefono: '+56966666666' });
  await c.pacientes.actualizar('11111111-1', { ...base, fechaNacimiento: '1980-01-01', nombres: 'Corregida', respNombre: 'Hijo Prueba', respRelacion: 'Hijo', respRut: '77777777-7', respTelefono: '+56977777777' });
  let a = await c.catalogo.paciente('11111111-1');
  assert.strictEqual(a.nombre, 'Corregida Prueba'); assert.strictEqual(a.responsable.relacion, 'Hijo');
  await c.pacientes.actualizar('11111111-1', { ...base, fechaNacimiento: '1980-01-01' });
  a = await c.catalogo.paciente('11111111-1');
  assert.strictEqual(a.responsable, null);
  await assert.rejects(() => c.pacientes.actualizar('99999999-9', base), /PACIENTE_NO_ENCONTRADO/);
  await assert.rejects(() => c.pacientes.actualizar('11111111-1', { ...base, fechaNacimiento: '2999-01-01' }), /FECHA_INVALIDA/);
});

test('cupos: se bloquean y liberan por rango o de a uno, sin tocar los que tienen cita', async () => {
  const c = crearContenedor();
  const rango = { idProfesional: 1, desde: '2026-11-23', hasta: '2026-11-23' };
  const antes = (await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 })).length;
  const n = await c.catalogo.cambiarPublicacion({ ...rango, publicar: false });
  assert.strictEqual(n, 2, 'del día hay 4 cupos: 2 con cita y 2 libres');
  assert.strictEqual((await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 })).length, antes - 2);
  assert.ok((await c.catalogo.bloque(1)).publicado, 'el cupo con cita sigue publicado');
  await assert.rejects(() => c.agendamiento.agendar({ rut: '33333333-3', idBloque: 3 }), /BLOQUE_NO_DISPONIBLE/);
  assert.strictEqual(await c.catalogo.cambiarPublicacion({ ...rango, idBloque: 3, publicar: true }), 1);
  await c.agendamiento.agendar({ rut: '33333333-3', idBloque: 3 });
  assert.strictEqual(await c.catalogo.cambiarPublicacion({ ...rango, publicar: true }), 1);
});

test('reportes: caracterización de pacientes y demanda por profesional, sin datos personales', async () => {
  const c = crearContenedor();
  await c.agendamiento.agendar({ rut: '33333333-3', idBloque: 3 });
  await c.agendamiento.registrarAsistencia(1, true);
  const k = await c.reportes.caracterizacion();
  assert.deepStrictEqual([k.registrados, k.conCita, k.atendidos, k.adultos, k.ninos, k.mayores], [3, 3, 1, 1, 0, 0]);
  assert.strictEqual(k.edades.reduce((s, x) => s + x.n, 0), 1);
  assert.deepStrictEqual(k.generos[0], { nombre: 'Femenino', n: 1 });
  const pp = await c.reportes.porProfesional();
  assert.strictEqual(pp.length, 47);
  assert.deepStrictEqual([pp[0].citas, pp[0].asistio, pp[0].cupos], [3, 1, 8]);
  for (const texto of [await c.reportes.csvProfesionales(), await c.reportes.csvResumen()]) assert.ok(!/11111111|\bPaciente [A-C0-9]+\b/.test(texto));
});

test('documentos: adjunto PDF/JPG/PNG reconocido por contenido; se rechaza otro formato o más de 5 MB', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  process.env.DIR_DOCUMENTOS = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-'));
  try {
    const c = crearContenedor(); const u = { nombre: 'TENS' };
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 1)]);
    const d = await c.documentos.registrar({ rut: '11111111-1', tipo: 'Cartola FONASA', usuario: u, archivo: { nombre: '../../etc/cartola fonasa.pdf', datos: pdf } });
    assert.strictEqual(d.adjunto.formato, 'PDF'); assert.strictEqual(d.adjunto.original, 'cartola fonasa.pdf');
    const a = c.documentos.archivo(d.id);
    assert.ok(a.ruta.startsWith(process.env.DIR_DOCUMENTOS) && fs.readFileSync(a.ruta).equals(pdf));
    assert.match(path.basename(a.ruta), /^11111111-1_Cartola-FONASA_\d{4}-\d{2}-\d{2}_[0-9a-f]{6}\.pdf$/, 'el archivo en disco tiene un nombre legible');
    await assert.rejects(() => c.documentos.registrar({ rut: '11111111-1', tipo: 'Otro', usuario: u, archivo: { nombre: 'x.pdf', datos: Buffer.from('<html>hola</html>') } }), /ARCHIVO_INVALIDO/);
    await assert.rejects(() => c.documentos.registrar({ rut: '11111111-1', tipo: 'Otro', usuario: u, archivo: { nombre: 'x.pdf', datos: Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(5 * 1024 * 1024)]) } }), /ARCHIVO_MUY_GRANDE/);
    const sin = await c.documentos.registrar({ rut: '11111111-1', tipo: 'Otro', usuario: u });
    assert.throws(() => c.documentos.archivo(sin.id), /SIN_ARCHIVO/);
    assert.strictEqual(fs.readdirSync(process.env.DIR_DOCUMENTOS).length, 1, 'los rechazados no dejan archivos');
  } finally { fs.rmSync(process.env.DIR_DOCUMENTOS, { recursive: true, force: true }); delete process.env.DIR_DOCUMENTOS; }
});

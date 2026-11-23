require("./helpers/reloj");
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { crearContenedor } = require('../src/armarAplicacion');

const A = '11111111-1'; const C = '33333333-3';

test('un bloque no admite dos citas activas (RNF04)', async () => {
  const { agendamiento } = crearContenedor();
  await agendamiento.agendar({ rut: C, idBloque: 3 });
  await assert.rejects(() => agendamiento.agendar({ rut: A, idBloque: 3 }), /BLOQUE_OCUPADO/);
});

test('no se reserva un bloque no publicado', async () => {
  const c = crearContenedor();
  await c.catalogo.cambiarPublicacion({idProfesional:1,desde:'2026-11-23',hasta:'2026-11-23',idBloque:3,publicar:false});
  await assert.rejects(() => c.agendamiento.agendar({ rut: C, idBloque: 3 }), /BLOQUE_NO_DISPONIBLE/);
});

test('al cancelar, el bloque vuelve a estar disponible y se avisa a TENS/TONS', async () => {
  const c = crearContenedor();
  await c.agendamiento.cancelar(1, 'ASISTIDA');
  await assert.doesNotThrow(async () => c.agendamiento.agendar({ rut: C, idBloque: 1 }));
  assert.ok(c.extras.listar('notificaciones').some((n) => n.tipo === 'CUPO_LIBERADO'));
});

test('"No contestó" no cancela ni confirma (el silencio no decide)', async () => {
  const c = crearContenedor();
  await c.confirmacion.registrarContacto({ idCita: 1, resultado: 'No contestó', responsable: 't' });
  const cita = await c.citaRepo.buscarPorId(1);
  assert.strictEqual(cita.estadoReserva, 'ACTIVA');
  assert.strictEqual(cita.estadoConfirmacion, 'PENDIENTE');
});

test('la cancelación solo acepta WhatsApp, asistida o institucional', async () => {
  const { agendamiento } = crearContenedor();
  await assert.rejects(() => agendamiento.cancelar(1, 'SILENCIO'), /ORIGEN_INVALIDO/);
});

test('no se puede cancelar dos veces la misma cita', async () => {
  const { agendamiento } = crearContenedor();
  await agendamiento.cancelar(1, 'WHATSAPP');
  await assert.rejects(() => agendamiento.cancelar(1, 'WHATSAPP'), /CITA_NO_ACTIVA/);
});

test('un profesional inactivo no ofrece cupos', async () => {
  const c = crearContenedor();
  c.catalogo.setProfesionalActivo(1, false);
  const disp = await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 });
  assert.ok(disp.every((b) => b.idProfesional !== 1));
  await assert.rejects(() => c.agendamiento.agendar({ rut: C, idBloque: 3 }), /BLOQUE_NO_DISPONIBLE/);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert');
const reserva = require('../src/views/reserva');

const html = reserva.datos({
  t: 'x', modo: 'existente-sin-sesion', rut: '12345678-5', cita: 'lunes 10:00',
  ficha: { nombre: 'Ana Perez', telefono: '+56912345678', correo: 'ana@correo.cl', direccion: 'Calle 1', idComuna: 1, fechaNacimiento: '1990-01-01' },
  comunas: [{ id: 1, nombre: 'Santiago' }], tipos: [], pendientes: [], registrados: [],
});

test('Datos de contacto usa clase propia, sin chocar con la franja .contacto del portal', () => {
  assert.match(html, /class="datos-contacto"/);
  assert.doesNotMatch(html, /class="contacto"/);
});

test('Celular y Correo comparten fila; Dirección y Comuna van debajo', () => {
  const bloque = html.slice(html.indexOf('id="nTelefono"') - 40);
  const pos = (id) => bloque.indexOf(`id="${id}"`);
  assert.ok(pos('nTelefono') < pos('nCorreo') && pos('nCorreo') < pos('nDireccion') && pos('nDireccion') < pos('nIdComuna'));
  assert.match(html, /class="form2"><div><label for="nTelefono"/);
  assert.match(html, /<div class="full"><label for="nDireccion"/);
  assert.match(html, /<div class="full"><label for="nIdComuna"/);
});

test('estilos responsivos propios del bloque', () => {
  assert.match(reserva.ESTILOS, /\.datos-contacto\s*\.form2\{[^}]*minmax\(0,1fr\)/);
  assert.match(reserva.ESTILOS, /@media\(max-width:640px\)\{[^}]*\.datos-contacto\s*\.form2\{grid-template-columns:1fr\}/);
  assert.match(reserva.ESTILOS, /\.datos-contacto-t/);
});

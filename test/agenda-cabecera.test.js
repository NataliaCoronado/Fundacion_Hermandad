'use strict';
const test = require('node:test');
const assert = require('node:assert');
const css = require('../src/views/agenda.css');

const regla = (sel) => { const m = css.match(new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)); return m ? m[1] : ''; };

test('el pin de ubicación de la cabecera de Agendas tiene tamaño fijo (24px) y no se encoge', () => {
  const r = regla('.agenda-heading p svg');
  assert.match(r, /width:\s*24px/);
  assert.match(r, /height:\s*24px/);
  assert.match(r, /flex:\s*none/);
});

test('el texto de ubicación se alinea con el pin en una sola línea', () => {
  const r = regla('.agenda-heading p');
  assert.match(r, /display:\s*flex/);
  assert.match(r, /align-items:\s*center/);
});

test('la cabecera separa el texto de los botones en una misma línea', () => {
  const r = regla('.agenda-heading, .agenda-detail-heading');
  assert.match(r, /display:\s*flex/);
  assert.match(r, /justify-content:\s*space-between/);
  assert.match(r, /align-items:\s*center/);
});

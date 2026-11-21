"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");
const portalCss = require("../src/views/portal.css");

async function paginaInicio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const html = await fetch(`http://127.0.0.1:${srv.address().port}/`).then((x) => x.text());
  await new Promise((r) => srv.close(r));
  return html;
}

test("Paso 1: la tarjeta abre con la pregunta «¿Quién es el paciente?» y conserva todos los datos", async () => {
  const h = await paginaInicio();
  const form = h.match(/<form method="post" action="\/agendar"[\s\S]*?<\/form>/)[0];
  assert.match(form, /<h2[^>]*>¿Quién es el paciente\?<\/h2>/);
  for (const campo of ['name="rut"', 'name="lugar"', 'name="modo"', 'name="esp"', 'name="prof"', 'name="consentimiento"', 'name="comunicaciones"'])
    assert.ok(form.includes(campo), `sigue el campo ${campo}`);
});

test("Paso 1: el botón principal es «Continuar», redondeado, y avisa cuando aún faltan datos", async () => {
  const h = await paginaInicio();
  assert.match(h, /<button class="btn blq continuar" type="submit">Continuar<\/button>/);
  assert.doesNotMatch(h, /Ver días y horas disponibles/);
  assert.match(h, /classList\.toggle\('pendiente'/);
  assert.match(portalCss, /\.continuar\s*\{[^}]*border-radius:\s*999px/);
  assert.match(portalCss, /\.continuar\.pendiente\s*\{/);
});

test("Pasos: «Paso N de 4 · Nombre» y una línea con puntos, con el paso actual como círculo numerado", async () => {
  const h = await paginaInicio();
  assert.match(h, /<p class="paso-n">Paso 1 de 4 · Buscar<\/p>/);
  assert.match(portalCss, /\.barra li:not\(\.actual\) \.cuenta\s*\{[^}]*width:\s*9px/);
  assert.match(portalCss, /\.barra \.actual \.cuenta\s*\{[^}]*width:\s*22px/);
});

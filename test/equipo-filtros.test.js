"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/contenedor");
const { crearServidor } = require("../src/server");

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo: "admin@ejemplo.cl", clave: "demo1234" }) });
  const a = r.headers.get("set-cookie").split(";")[0];
  return { get: (ruta) => fetch(base + ruta, { headers: { Cookie: a } }).then((x) => x.text()), cerrar: () => new Promise((r) => srv.close(r)) };
}

test("Equipo de salud: filtros con placeholder en lugar de 'Todos'", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/admin/profesionales");
    const form = h.match(/<form class="filters">[\s\S]*?<\/form>/)[0];
    for (const [nombre, texto] of [["sede", "Seleccionar lugar…"], ["esp", "Seleccionar especialidad…"], ["tipo", "Seleccionar tipo…"], ["estado", "Seleccionar estado…"]]) {
      assert.match(form, new RegExp(`<select name="${nombre}"[^>]*><option value=""[^>]*>${texto}</option>`), nombre);
    }
    assert.doesNotMatch(form, /<option value="">Todos?a?s?<\/option>/);
  } finally { await s.cerrar(); }
});

test("Equipo de salud: 'Abrir ficha' pasa a 'Editar' y se conserva el enlace de edición", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/admin/profesionales");
    assert.doesNotMatch(h, />Abrir ficha</);
    assert.match(h, /<a class="btn sec" href="\/admin\/profesionales\?editar=1">Editar<\/a>/);
    assert.match(h, /<a class="btn sec" href="\/admin\/agendas\?prof=1">Agenda<\/a>/);
  } finally { await s.cerrar(); }
});

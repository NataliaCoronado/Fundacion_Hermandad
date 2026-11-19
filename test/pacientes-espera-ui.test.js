"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/contenedor");
const { crearServidor } = require("../src/server");

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const ps = (await c.catalogo.pacientes()).slice(0, 3);
  for (const p of ps) { c.operacion.meta.pacientes[p.rut] = c.operacion.meta.pacientes[p.rut] || {}; c.operacion.meta.pacientes[p.rut].sedes = [1]; }
  const esps = ["Kinesiología", "Fonoaudiología", "Medicina General"];
  for (const [i, p] of ps.entries()) {
    const e = await c.espera.registrar({ rut: p.rut, idPoliclinico: 1, especialidad: esps[i], idUsuario: "u2" });
    c.operacion.meta.espera[e.id] = { prioridad: "Alta" };
  }
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo: "tens@ejemplo.cl", clave: "demo1234" }) });
  const a = r.headers.get("set-cookie").split(";")[0];
  return { ps, get: (ruta) => fetch(base + ruta, { headers: { Cookie: a } }).then((x) => x.text()), cerrar: () => new Promise((r) => srv.close(r)) };
}

test("Lista de espera: filtros con placeholder 'Seleccionar…' en vez de Todos/Todas", async () => {
  const s = await sitio();
  try {
    const f = (await s.get("/tens/espera")).match(/<form class="filters">[\s\S]*?<\/form>/)[0];
    for (const t of ["especialidad", "profesional", "prioridad", "estado", "seguimiento"]) assert.match(f, new RegExp(`<option value=""[^>]*>Seleccionar ${t}…</option>`), t);
    assert.doesNotMatch(f, /<option value=""[^>]*>Todos?a?s?<\/option>/);
  } finally { await s.cerrar(); }
});

test("Lista de espera: columna PACIENTE con nombre y RUT debajo; Contacto y Asignar cupo separadas", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/espera");
    const ths = [...h.match(/<thead>[\s\S]*?<\/thead>/)[0].matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1]);
    assert.deepEqual(ths, ["Paciente", "Edad", "Especialidad", "Preferencia", "Días de espera", "Prioridad", "Estado", "Contacto", "Asignar cupo"]);
    const fila = h.match(/<tbody>\s*<tr>([\s\S]*?)<\/tr>/)[1];
    const celdas = [...fila.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    assert.match(celdas[0], /Paciente [ABC][\s\S]*<small class="sec">\d{7,8}-[\dkK]<\/small>/);
    assert.match(celdas[7], /Registrar contacto/);
    assert.doesNotMatch(celdas[7], /Reservar/);
    assert.match(celdas[8], /Asignar cupo/);
    assert.doesNotMatch(celdas[8], /Registrar contacto/);
  } finally { await s.cerrar(); }
});

test("Pacientes: buscador compacto, sin 'Abrir ficha', acciones de ícono y datos secundarios suaves", async () => {
  const s = await sitio();
  try {
    const h = await s.get("/tens/pacientes");
    assert.match(h, /<form class="filters filters-busqueda"/);
    assert.doesNotMatch(h, />Abrir ficha</);
    assert.match(h, /<td><a class="paciente-link" href="\/tens\/ficha\?rut=\d{7,8}-[\dkK]">Paciente [ABC]<\/a><\/td>/);
    assert.match(h, /<a class="btn-icono" href="\/tens\/ficha\?tab=reservas&amp;rut=[^"]+" aria-label="Ver reservas de Paciente [ABC]" title="Ver reservas">/);
    assert.match(h, /<a class="btn-icono" href="\/tens\/pacientes\/editar\?rut=[^"]+" aria-label="Editar a Paciente [ABC]" title="Editar">/);
    assert.doesNotMatch(h, /<a class="btn sec" href="\/tens\/ficha\?tab=reservas/);
    assert.match(h, /<td class="dato-sec">\d{7,8}-[\dkK]<\/td>/);
  } finally { await s.cerrar(); }
});

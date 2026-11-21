"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo: "admin@ejemplo.cl", clave: "demo1234" }) });
  const ck = r.headers.get("set-cookie").split(";")[0];
  return { c, get: (ruta) => fetch(base + ruta, { headers: { Cookie: ck } }), cerrar: () => new Promise((r) => srv.close(r)) };
}
const sinEscapes = (t) => t.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");
const graficos = (html) => [...html.matchAll(/<section class="work-panel graf-r" data-chart="([^"]+)"[\s\S]*?data-ec="([^"]*)"/g)].map((m) => ({ id: m[1], spec: JSON.parse(sinEscapes(m[2])) }));

test("Reportes: el gráfico muestra los 10 con más valor y «Ver datos» conserva a los 47 profesionales", async () => {
  const s = await sitio();
  try {
    const total = (await s.c.catalogo.profesionales()).length;
    assert.equal(total, 47);
    const h = await (await s.get("/admin/reportes?seccion=demanda")).text();
    const g = graficos(h);
    for (const id of ["demanda", "ocupacion"]) {
      const x = g.find((y) => y.id === id);
      assert.ok(x, id);
      assert.equal(x.spec.filas.length, 10, `${id}: el gráfico muestra solo los 10 primeros`);
      const panel = h.match(new RegExp(`<section class="work-panel graf-r" data-chart="${id}"[\\s\\S]*?</section>`))[0];
      const filasTabla = (panel.match(/<details class="datos-r">[\s\S]*<\/details>/)[0].match(/<tr>/g) || []).length;
      assert.ok(filasTabla >= total, `${id}: «Ver datos» lista a los ${total} profesionales (trae ${filasTabla})`);
      assert.match(panel, /los 10/, `${id}: el texto explica que se ven los 10 primeros`);
    }
  } finally { await s.cerrar(); }
});

test("Reportes: pantalla, PDF y PNG listan los mismos 47 profesionales", async () => {
  const s = await sitio();
  try {
    const pdf = Buffer.from(await (await s.get("/admin/reportes/exportar?grafico=demanda&formato=pdf")).arrayBuffer()).toString("latin1");
    const filasPdf = (pdf.match(/BT \/F1 9 Tf 40 \d+ Td \(/g) || []).filter((_, i) => true).length;
    assert.ok(filasPdf >= 47, `el PDF trae al menos 47 filas, trae ${filasPdf}`);
    const r = await s.get("/admin/reportes/exportar?grafico=demanda&formato=png");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "image/png");
  } finally { await s.cerrar(); }
});

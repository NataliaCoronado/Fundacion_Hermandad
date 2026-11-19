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
  return { get: (ruta) => fetch(base + ruta, { headers: { Cookie: a } }), cerrar: () => new Promise((r) => srv.close(r)) };
}

test("Reportes: 'todos' en PNG entrega un ZIP con un PNG por gráfico", async () => {
  const s = await sitio();
  try {
    const r = await s.get("/admin/reportes/exportar?grafico=todos&formato=png");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "application/zip");
    assert.match(r.headers.get("content-disposition"), /reporte-todos\.zip/);
    const b = Buffer.from(await r.arrayBuffer());
    assert.equal(b.subarray(0, 2).toString(), "PK");
    const nombres = b.toString("latin1").match(/[a-z0-9-]+\.png/g) || [];
    const unicos = new Set(nombres);
    assert.ok(unicos.size >= 8, "un PNG por gráfico, hay " + unicos.size);
    const cabeceraPng = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    assert.ok(b.includes(cabeceraPng), "contiene imágenes PNG reales");
  } finally { await s.cerrar(); }
});

test("Reportes: botones para descargar todos y de a uno, visibles sin abrir el detalle", async () => {
  const s = await sitio();
  try {
    const h = await (await s.get("/admin/reportes")).text();
    assert.match(h, /grafico=todos&amp;formato=png[^>]*>[^<]*PNG[^<]*ZIP/);
    assert.match(h, /grafico=todos&amp;formato=pdf/);
    assert.match(h, /grafico=todos&amp;formato=xlsx/);
    const tarjeta = h.match(/<section class="work-panel graf-r"[\s\S]*?<\/section>/)[0];
    const fuera = tarjeta.replace(/<details class="datos-r">[\s\S]*?<\/details>/, "");
    assert.match(fuera, /formato=png/);
    assert.match(fuera, /formato=pdf/);
    assert.match(fuera, /formato=xlsx/);
  } finally { await s.cerrar(); }
});

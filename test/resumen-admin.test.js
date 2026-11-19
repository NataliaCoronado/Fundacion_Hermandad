"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/contenedor");
const { crearServidor } = require("../src/server");
const css = require("../src/views/resumen.css");

async function html() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo: "admin@ejemplo.cl", clave: "demo1234" }) });
  const a = r.headers.get("set-cookie").split(";")[0];
  const h = await (await fetch(base + "/admin/resumen", { headers: { Cookie: a } })).text();
  await new Promise((r) => srv.close(r));
  return h;
}
const cuerpo = (h) => h.slice(h.indexOf('<div class="workspace res-workspace">'));

test("Resumen Administración: estructura simple y en orden", async () => {
  const h = cuerpo(await html());
  const orden = ["Actividad de la red", "Crear bloque horario", "Ver agendas", "Citas hoy", "Por confirmar", "En lista de espera", "Inasistencia en 30 días", "Alertas críticas y pendientes", "Citas de hoy", "Indicadores del período", "Aplicar filtros", "Ocupación de cupos", "Evolución de reservas", "Inasistencias", "Confirmación de citas"];
  let ultimo = -1;
  for (const t of orden) {
    const i = h.indexOf(t, ultimo + 1);
    assert.ok(i > ultimo, `"${t}" debe aparecer después del anterior`);
    ultimo = i;
  }
});

test("Resumen Administración: dos gráficos de línea grandes y dos métricas pequeñas con ▲/▼", async () => {
  const h = cuerpo(await html());
  const graficos = h.match(/<section class="res-grafico">/g) || [];
  assert.equal(graficos.length, 2, "solo dos gráficos grandes");
  assert.match(h, /<section class="res-grafico"><h4>Ocupación de cupos<\/h4>/);
  assert.match(h, /<section class="res-grafico"><h4>Evolución de reservas<\/h4>/);
  const metricas = h.match(/<(?:div|section) class="res-metrica"[\s\S]*?<\/(?:div|section)>/g) || [];
  assert.equal(metricas.length, 2);
  assert.match(metricas[0], /Inasistencias/);
  assert.match(metricas[1], /Confirmación de citas/);
  for (const m of metricas) { assert.match(m, /res-delta/); assert.doesNotMatch(m, /<svg|echarts|data-grafico/i); }
});

test("Resumen Administración: sin paneles extra", async () => {
  const h = cuerpo(await html());
  for (const t of ["Situación por policlínico", "Cuándo se concentra la demanda", "Capacidad de los próximos 7 días"]) assert.doesNotMatch(h, new RegExp(t), t);
});

test("Resumen: las tarjetas de números son tarjetas separadas", () => {
  const kpis = css.match(/\.res-kpis\s*\{([^}]*)\}/)[1];
  assert.match(kpis, /gap:\s*\d+px/);
  assert.doesNotMatch(kpis, /overflow:\s*hidden/);
  const kpi = css.match(/\.res-kpi\s*\{([^}]*)\}/)[1];
  assert.match(kpi, /border:\s*1px solid/);
  assert.match(kpi, /border-radius/);
  assert.match(kpi, /background:\s*#fff/);
});

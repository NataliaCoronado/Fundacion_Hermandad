"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

async function sitio(correo) {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
  const a = r.headers.get("set-cookie").split(";")[0];
  return { get: (ruta) => fetch(base + ruta, { headers: { Cookie: a } }).then((x) => x.text()), cerrar: () => new Promise((r) => srv.close(r)) };
}

test("Resumen TENS/TONS: solo lo operativo del día, sin analítica ni capacidad", async () => {
  const s = await sitio("tens@ejemplo.cl");
  try {
    const h = await s.get("/tens/resumen");
    for (const t of ["Citas hoy", "Por confirmar", "En lista de espera", "Cupos libres", "Alertas críticas y pendientes", "Citas de hoy"]) assert.match(h, new RegExp(t), t);
    for (const t of ["Indicadores del período", "Capacidad de los próximos 7 días", "Aplicar filtros", "<div class=\"res-graficos\">", "Situación por policlínico"]) assert.doesNotMatch(h, new RegExp(t), t);
  } finally { await s.cerrar(); }
});

test("Resumen Administración conserva los indicadores del período", async () => {
  const s = await sitio("admin@ejemplo.cl");
  try {
    const h = await s.get("/admin/resumen");
    assert.match(h, /Indicadores del período/);
    assert.match(h, /Aplicar filtros/);
  } finally { await s.cerrar(); }
});

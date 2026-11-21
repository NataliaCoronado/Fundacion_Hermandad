"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

async function levantar() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(`${base}/login`, { method: "POST", redirect: "manual", body: new URLSearchParams({ correo: "admin@ejemplo.cl", clave: "demo1234" }) });
  const ck = r.headers.get("set-cookie").split(";")[0];
  const get = (ruta) => fetch(base + ruta, { headers: { Cookie: ck } });
  return { c, get, cerrar: () => new Promise((ok) => srv.close(ok)) };
}
const AÑO = "desde=2026-01-01&hasta=2026-12-31&periodo=rango";

test("reportes: sección Encuestas con agendamiento y atención por separado, nunca sumadas", async () => {
  const s = await levantar();
  try {
    await s.c.encuestas.registrarAgendamiento({ idCita: 1, nota: 4 });
    await s.c.encuestas.registrarAgendamiento({ idCita: 2, nota: 5 });
    await s.c.agendamiento.registrarAsistencia(1, true);
    await s.c.encuestas.registrar({ rut: "11111111-1", nota: 3 });
    const h = await (await s.get(`/admin/reportes?${AÑO}&seccion=encuestas`)).text();
    assert.match(h, /class="act" aria-current="page">Encuestas<\/a>/);
    assert.match(h, /Encuesta de agendamiento[\s\S]*?Hubo 2 respuesta\(s\), con promedio 4,5 de 5/);
    assert.match(h, /Encuesta de atención[\s\S]*?Hubo 1 respuesta\(s\), con promedio 3 de 5/);
    assert.match(h, /Cómo leerlo/);
    assert.match(h, /data-chart="encuesta-agendamiento"/);
    assert.match(h, /data-chart="encuesta-atencion"/);
  } finally { await s.cerrar(); }
});

test("reportes: las encuestas siguen el filtro del reporte (otro lugar u otro período no las cuenta)", async () => {
  const s = await levantar();
  try {
    await s.c.encuestas.registrarAgendamiento({ idCita: 1, nota: 4 });
    const sedeCita = (await s.c.catalogo.profesional((await s.c.catalogo.bloque((await s.c.citaRepo.buscarPorId(1)).idBloque)).idProfesional)).idPoliclinico;
    const otraSede = (await s.c.catalogo.policlinicos()).find((x) => x.id !== sedeCita).id;
    const agend = (h) => /data-chart="encuesta-agendamiento"[\s\S]*?<\/section>/.exec(h)[0];
    assert.match(agend(await (await s.get(`/admin/reportes?${AÑO}&sede=${sedeCita}&seccion=encuestas`)).text()), /Hubo 1 respuesta\(s\)/);
    assert.match(agend(await (await s.get(`/admin/reportes?${AÑO}&sede=${otraSede}&seccion=encuestas`)).text()), /Aún no hay respuestas en el período/);
    assert.match(agend(await (await s.get("/admin/reportes?desde=2025-01-01&hasta=2025-01-31&periodo=rango&seccion=encuestas")).text()), /Aún no hay respuestas en el período/);
  } finally { await s.cerrar(); }
});

test("reportes: las encuestas se descargan en PDF y Excel, solas o en el reporte completo", async () => {
  const s = await levantar();
  try {
    await s.c.encuestas.registrarAgendamiento({ idCita: 1, nota: 4 });
    for (const formato of ["pdf", "xlsx"]) {
      const solo = await s.get(`/admin/reportes/exportar?${AÑO}&grafico=encuesta-agendamiento&formato=${formato}`);
      assert.strictEqual(solo.status, 200, `encuesta sola en ${formato}`);
      const todo = await s.get(`/admin/reportes/exportar?${AÑO}&grafico=todos&formato=${formato}`);
      assert.strictEqual(todo.status, 200, `reporte completo en ${formato}`);
      const bytes = Buffer.from(await todo.arrayBuffer()).toString("latin1");
      assert.ok(bytes.includes("Encuesta de agendamiento"), `el reporte completo en ${formato} trae la encuesta de agendamiento`);
      assert.ok(bytes.includes("Encuesta de atenci"), `el reporte completo en ${formato} trae la encuesta de atención`);
    }
  } finally { await s.cerrar(); }
});

"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { crearContenedor } = require("../src/contenedor");
const { crearServidor } = require("../src/server");
const css = require("../src/views/agenda.css");

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const login = async (correo) => {
    const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
    return r.headers.get("set-cookie").split(";")[0];
  };
  const a = await login("admin@ejemplo.cl");
  const t = await login("tens@ejemplo.cl");
  const ver = async (ruta, cookie) => (await fetch(base + ruta, { headers: { Cookie: cookie } })).text();
  return { a, t, ver, cerrar: () => new Promise((r) => srv.close(r)) };
}
const SEMANA = "/admin/agendas?vista=semana&fecha=2026-11-23";

test("admin: las acciones importantes son enlaces visibles, no un menú escondido", async () => {
  const s = await sitio();
  try {
    const html = await s.ver("/admin/agendas", s.a);
    assert.ok(!html.includes('class="agenda-actions"'), "no debe haber desplegable «Más acciones»");
    assert.ok(!html.includes("Más acciones"));
    const nav = /<nav class="agenda-acciones"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] || "";
    for (const [href, texto] of [["/admin/cupos/rango", "Cupos por rango"], ["/admin/cambios", "Cambios de agenda"], ["/admin/cancelaciones", "Cancelaciones"]]) {
      assert.match(nav, new RegExp(`<a class="btn sec" href="${href}">${texto}</a>`));
    }
    assert.ok(!nav.includes("/admin/colores"));
  } finally { await s.cerrar(); }
});

test("admin: «Configurar colores» queda bajo la agenda como ajuste general", async () => {
  const s = await sitio();
  try {
    const html = await s.ver("/admin/agendas", s.a);
    const finAgenda = html.indexOf("</section>", html.indexOf('aria-label="Calendario y filtros"'));
    const ajustes = html.indexOf('class="agenda-ajustes"');
    assert.ok(finAgenda > 0 && ajustes > finAgenda, "los ajustes van después del panel de la agenda");
    assert.match(html.slice(ajustes, ajustes + 400), /href="\/admin\/colores"[^>]*>Configurar colores/);
    assert.equal((html.match(/\/admin\/colores/g) || []).length, 1);
  } finally { await s.cerrar(); }
});

test("admin: una sola barra con contadores siempre visibles que filtran por estado", async () => {
  const s = await sitio();
  try {
    const html = await s.ver("/admin/agendas?fecha=2026-11-23", s.a);
    assert.equal((html.match(/data-agenda-toolbar/g) || []).length, 1);
    assert.ok(!html.includes('class="agenda-estados"'), "la leyenda ya no se esconde");
    const resumen = /<nav class="agenda-resumen"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] || "";
    for (const [rotulo, estado] of [["Disponibles", "Disponible"], ["Reservados", "Reservado"], ["Bloqueados", "Bloqueado"], ["Sin publicar", "Sin\\+publicar"]]) {
      assert.match(resumen, new RegExp(`<a[^>]*href="[^"]*estado=${estado}[^"]*"[^>]*><b>\\d+</b> ${rotulo}</a>`), rotulo);
    }
    const filtrado = await s.ver("/admin/agendas?fecha=2026-11-23&estado=Disponible", s.a);
    assert.match(filtrado, /<a[^>]*aria-current="true"[^>]*><b>\d+<\/b> Disponibles<\/a>/);
  } finally { await s.cerrar(); }
});

test("admin semana: matriz profesional × día con capacidad, sin una tarjeta por cupo", async () => {
  const s = await sitio();
  try {
    const html = await s.ver(SEMANA, s.a);
    assert.ok(html.includes('<table class="matriz-semana"'), "existe la matriz");
    const filas = html.match(/<tr data-profesional="\d+"/g) || [];
    assert.ok(filas.length >= 2, "una fila por profesional con cupos esa semana");
    assert.match(html, /\d+ de \d+ reservados/);
    assert.match(html, /<a class="mx-celda"[^>]*href="\/admin\/agendas\?(?=[^"]*vista=dia)(?=[^"]*prof=\d+)/);
    assert.ok(!html.includes('class="calendar-week-lists"'), "ya no es el muro de tarjetas");
    assert.ok(!html.includes('class="schedule-block"'));
  } finally { await s.cerrar(); }
});

test("TENS/TONS: su agenda semanal no cambia", async () => {
  const s = await sitio();
  try {
    const html = await s.ver("/tens/agenda?vista=semana&fecha=2026-11-23", s.t);
    assert.ok(!html.includes('<table class="matriz-semana"'));
    assert.ok(!html.includes('<nav class="agenda-resumen"'));
    assert.ok(html.includes('class="agenda-estados"'), "su leyenda de estados sigue igual");
  } finally { await s.cerrar(); }
});

test("estilos: la barra de la agenda tiene reglas propias (antes no tenía ninguna)", () => {
  for (const sel of [".agenda-tools", ".agenda-resumen", ".agenda-acciones", ".agenda-ajustes", ".matriz-semana"]) {
    assert.ok(css.includes(sel), `falta ${sel}`);
  }
});

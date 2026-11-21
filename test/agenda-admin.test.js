"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { crearContenedor } = require("../src/armarAplicacion");
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

test("admin: la agenda no repite «Configurar colores» (los colores se cambian en Policlínicos y especialidades)", async () => {
  const s = await sitio();
  try {
    const html = await s.ver("/admin/agendas", s.a);
    assert.doesNotMatch(html, /Ajustes de la agenda/);
    assert.doesNotMatch(html, /Configurar colores/);
    assert.doesNotMatch(html, /href="\/admin\/colores"/);
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

test("estilos: «‹ Hoy ›» alinea los tres botones con la misma altura", () => {
  assert.match(css, /\.agenda-paging[^{]*\{[^}]*display:\s*flex[^}]*align-items:\s*center/, "los botones de fecha van en una fila centrada");
  assert.match(css, /\.agenda-paging\s+\.btn\s*\{[^}]*height:\s*var\(--control\)/, "los tres botones miden lo mismo");
});

test("estilos: la barra de la agenda tiene reglas propias (antes no tenía ninguna)", () => {
  for (const sel of [".agenda-tools", ".agenda-resumen", ".agenda-acciones", ".matriz-semana"]) {
    assert.ok(css.includes(sel), `falta ${sel}`);
  }
});

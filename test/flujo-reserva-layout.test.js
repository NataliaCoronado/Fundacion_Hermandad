"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");
const portalCss = require("../src/views/portal.css");

async function levantar() {
  process.env.DIR_DOCUMENTOS = fs.mkdtempSync(path.join(os.tmpdir(), "flujo-docs-"));
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  let ck = "";
  const req = async (ruta, datos) => {
    const r = await fetch(base + ruta, { method: datos ? "POST" : "GET", body: datos ? new URLSearchParams(datos) : undefined, redirect: "manual", headers: ck ? { Cookie: ck } : {} });
    const sc = r.headers.get("set-cookie");
    if (sc && sc.startsWith("psid=")) ck = sc.split(";")[0];
    return r;
  };
  const texto = async (ruta, datos) => (await req(ruta, datos)).text();
  const cerrar = async () => { await new Promise((r) => srv.close(r)); fs.rmSync(process.env.DIR_DOCUMENTOS, { recursive: true, force: true }); delete process.env.DIR_DOCUMENTOS; };
  const r = await req("/agendar", { rut: "33333333-3", lugar: "1", modo: "prof", prof: "1", consentimiento: "1" });
  const t = /t=([a-f0-9]+)/.exec(r.headers.get("location"))[1];
  return { req, texto, cerrar, t };
}
const flujo = (h) => h.match(/<div class="flujo">[\s\S]*<\/aside>/)?.[0] || "";
const aside = (h) => h.match(/<aside class="flujo-resumen"[^>]*>[\s\S]*?<\/aside>/)?.[0] || "";

test("Paso 1: formulario y resumen «Tu reserva» en dos columnas, sin filas vacías", async () => {
  const s = await levantar();
  try {
    const h = await s.texto("/");
    assert.ok(flujo(h), "existe el contenedor del flujo");
    assert.match(h, /<div class="flujo-main">[\s\S]*id="buscar"/);
    const a = aside(h);
    assert.match(a, /aria-label="Tu reserva"/);
    assert.doesNotMatch(a, /Sin elegir|Sin indicar/, "el resumen vacío no lista filas pendientes");
    assert.match(a, /class="vacio-res"/, "explica qué verá al avanzar");
  } finally { await s.cerrar(); }
});

test("Paso 1: «Buscar por» es un selector agrupado, la ayuda aparece una vez y los consentimientos se distinguen", async () => {
  const s = await levantar();
  try {
    const h = await s.texto("/");
    const modo = h.match(/<fieldset class="buscar-modo conmut">[\s\S]*?<\/fieldset>/)?.[0] || "";
    assert.match(modo, /name="modo" value="esp"/);
    assert.match(modo, /name="modo" value="prof"/);
    assert.equal((h.match(/¿Necesitas ayuda\?/g) || []).length, 1, "la ayuda de WhatsApp no se duplica");
    const ok = h.match(/<div class="buscar-ok">[\s\S]*?<\/div>/)?.[0] || "";
    assert.match(ok, /name="consentimiento"[^>]*required/);
    assert.match(ok, /<span class="req"[^>]*>\*<\/span><\/span><\/label>/, "el asterisco queda dentro del texto");
    assert.match(ok, /class="check opc"[\s\S]*\(opcional\)/);
    assert.equal((h.match(/class="nota ayuda-campo"/g) || []).length, 2, "cada columna de la fila 1 tiene su ayuda corta");
  } finally { await s.cerrar(); }
});

test("Paso 2: calendario y horas del día, lado a lado, y el resumen muestra la búsqueda", async () => {
  const s = await levantar();
  try {
    const h = await s.texto(`/agendar/calendario?t=${s.t}`);
    const grupo = h.match(/<div class="fecha-hora">[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="aviso"|<\/div>)/)?.[0] || h.match(/<div class="fecha-hora">[\s\S]*/)?.[0] || "";
    assert.ok(grupo.includes('class="mes"'), "el calendario está en el grupo");
    assert.match(grupo, /class="dia-panel"/, "el panel de horas está en el mismo grupo");
    assert.match(aside(h), /<dt>Atención<\/dt>\s*<dd>[^<]*Profesional|<dt>Atención<\/dt>\s*<dd>[^<]+/);
    const dia = /dia=(\d{4}-\d{2}-\d{2})/.exec(h)?.[1];
    assert.ok(dia, "hay un día disponible");
    const conDia = await s.texto(`/agendar/calendario?t=${s.t}&dia=${dia}`);
    assert.match(conDia.match(/<div class="fecha-hora">[\s\S]*/)[0], /class="dia-t"[\s\S]*class="profs"/);
    assert.match(aside(conDia), new RegExp(`<dt>Fecha y hora</dt>\\s*<dd>[^<]*(?:${dia.slice(8)})`));
  } finally { await s.cerrar(); }
});

test("Paso 3: resumen con el RUT y la hora elegida, y sin la franja «Hora elegida» suelta", async () => {
  const s = await levantar();
  try {
    const cal = await s.texto(`/agendar/calendario?t=${s.t}`);
    const dia = /dia=(\d{4}-\d{2}-\d{2})/.exec(cal)[1];
    const conDia = await s.texto(`/agendar/calendario?t=${s.t}&dia=${dia}`);
    const bloque = /bloque=(\d+)/.exec(conDia)[1];
    const h = await s.texto(`/agendar/datos?t=${s.t}&bloque=${bloque}`);
    assert.ok(flujo(h));
    const a = aside(h);
    assert.match(a, /<dt>Paciente<\/dt>\s*<dd>[^<]*33333333-3/);
    assert.match(a, /href="\/agendar\/calendario\?[^"]*">Cambiar hora<\/a>/);
    assert.doesNotMatch(h, /<div class="busqueda-r"><span>Hora elegida/);
  } finally { await s.cerrar(); }
});

test("Estilos: columnas del flujo, calendario de filas fijas y cabecera en una línea", () => {
  assert.match(portalCss, /\.flujo\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:[^}]*minmax\(0,\s*1fr\)\s*300px/);
  assert.match(portalCss, /\.flujo-main\s*\{[^}]*container-type:\s*inline-size/);
  assert.match(portalCss, /@container[^{]*min-width:\s*\d+px\)\s*\{[^}]*\.fecha-hora/);
  assert.match(portalCss, /\.mes-g\s*\{[^}]*grid-auto-rows:\s*\d+px/);
  assert.match(portalCss, /\.portada:has\(\.barra\)\s*\{[^}]*display:\s*grid/);
  assert.match(portalCss, /\.flujo\s+\.tarjeta\s+details\.docs/);
  assert.match(portalCss, /#buscar\s+\.conmut\s+label[^{]*\{/, "selector tipo pastilla");
  assert.match(portalCss, /#buscar\s+\.buscar-ok[^{]*\{[^}]*text-wrap:\s*pretty/);
});

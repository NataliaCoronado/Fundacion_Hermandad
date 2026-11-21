"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

const TIENE_VOLVER = /<a [^>]*\bdata-volver\b|<a [^>]*class="[^"]*\bvolver(-btn)?\b|<a [^>]*class="[^"]*\bmp-regresar\b|<a [^>]*aria-label="Volver"/;
const MAX_POR_SESION = 120;

async function recorrer(base, cookie, inicio) {
  const vistas = new Set(),
    cola = [inicio],
    sin = [];
  while (cola.length && vistas.size < MAX_POR_SESION) {
    const u = cola.shift();
    if (vistas.has(u)) continue;
    vistas.add(u);
    const r = await fetch(base + u, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual" });
    if (!(r.headers.get("content-type") || "").includes("text/html")) continue;
    const html = await r.text();
    if (r.status === 200 && !TIENE_VOLVER.test(html)) sin.push(u.split("?")[0]);
    for (const m of html.matchAll(/(?:href|action)="(\/[^"#]*)"/g)) {
      const v = m[1].replace(/&amp;/g, "&");
      if (!/\.(png|jpg|jpeg|css|js|ico|pdf)$/.test(v) && !v.startsWith("/logout") && !v.startsWith("/img")) cola.push(v);
    }
  }
  return [...new Set(sin)];
}

test("Excepción pedida: el ingreso del personal no lleva «Volver»", async () => {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const html = await fetch(`http://127.0.0.1:${srv.address().port}/login`).then((x) => x.text());
    assert.match(html, /Ingreso del personal/);
    assert.doesNotMatch(html, TIENE_VOLVER);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test("Toda vista (personal, Administración, Telemedicina, portal y demostración) trae la opción de volver", async () => {
  const c = crearContenedor({ demo: true });
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const entrar = async (correo) => {
    const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
    return r.headers.get("set-cookie").split(";")[0];
  };
  try {
    const sesiones = [
      ["Administración", await entrar("admin@ejemplo.cl"), "/admin/agendas"],
      ["TENS/TONS", await entrar("tens@ejemplo.cl"), "/tens/agenda"],
      ["Telemedicina", await entrar("telemedicina.usuario@ejemplo.cl"), "/tens/agenda"],
      ["Portal de pacientes", "", "/"],
      ["Mensajes de demostración", "", "/demo/mensajes"],
      ["Página inexistente", "", "/esta-pagina-no-existe"],
    ];
    const faltan = [];
    for (const [nombre, cookie, inicio] of sesiones) {
      for (const ruta of await recorrer(base, cookie, inicio)) faltan.push(`${nombre}: ${ruta}`);
    }
    assert.deepEqual(faltan, [], `Estas vistas no tienen «Volver»:\n  ${faltan.join("\n  ")}`);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

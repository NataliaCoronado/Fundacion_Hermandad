"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");

const MAX_POR_ROL = 250;
let pngDisponible = true;
try { require("@resvg/resvg-js"); } catch { pngDisponible = false; }
const SOSPECHAS = /Ocurrió un error inesperado|>undefined|undefined<|\[object Object\]|>NaN</;

(async () => {
  process.env.DIR_DOCUMENTOS = fs.mkdtempSync(path.join(os.tmpdir(), "humo-"));
  process.env.BOT_WHATSAPP = "1";
  const c = crearContenedor({ demo: true });
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;

  const entrar = async (correo) => {
    const r = await fetch(`${base}/login`, { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
    const ck = (r.headers.get("set-cookie") || "").split(";")[0];
    if (!ck.startsWith("sid=")) throw new Error(`No se pudo entrar con ${correo}: ¿está CLAVE_DEMO o el modo memoria?`);
    return ck;
  };
  const roles = [
    ["Administración", await entrar("admin@ejemplo.cl"), "/admin/agendas"],
    ["TENS/TONS", await entrar("tens@ejemplo.cl"), "/tens/agenda"],
    ["Telemedicina", await entrar("telemedicina.usuario@ejemplo.cl"), "/tens/agenda"],
    ["Paciente (sin cuenta)", "", "/"],
  ];

  const malas = [];
  const pngOmitidas = new Set();
  let total = 0;
  for (const [quien, ck, inicio] of roles) {
    const vistas = new Set();
    const cola = [inicio];
    while (cola.length && vistas.size < MAX_POR_ROL) {
      const u = cola.shift();
      if (vistas.has(u)) continue;
      vistas.add(u);
      let r;
      let cuerpo = "";
      try {
        r = await fetch(base + u, { headers: ck ? { Cookie: ck } : {}, redirect: "manual" });
        if (r.headers.get("content-type")?.includes("text/html")) cuerpo = await r.text();
      } catch (e) {
        malas.push(`[${quien}] ${u} → excepción: ${e.message}`);
        continue;
      }
      total++;
      const pista = (cuerpo.match(SOSPECHAS) || [])[0];
      const esPng = /formato=png/.test(u);
      if (r.status >= 500 && esPng && !pngDisponible) pngOmitidas.add(u.replace(/.*grafico=/, "").replace(/&.*/, ""));
      else if (r.status >= 500) malas.push(`[${quien}] ${u} → HTTP ${r.status}`);
      else if (pista) malas.push(`[${quien}] ${u} → la página muestra «${pista}»`);
      for (const m of cuerpo.matchAll(/(?:href|action)="(\/[^"#]*)"/g)) {
        const v = m[1].replace(/&amp;/g, "&");
        if (!/\.(png|jpg|jpeg|css|js|ico)$/.test(v) && !v.startsWith("/logout")) cola.push(v);
      }
    }
    console.log(`${quien.padEnd(22)} ${vistas.size} páginas`);
  }

  srv.close();
  fs.rmSync(process.env.DIR_DOCUMENTOS, { recursive: true, force: true });
  console.log(`\n${total} respuestas revisadas.`);
  if (pngOmitidas.size)
    console.log(`Nota: ${pngOmitidas.size} descarga(s) PNG no se pudieron comprobar en este sistema porque falta el\n` +
      `binario de @resvg para ${process.platform}-${process.arch}. No es un fallo de la página: ejecútalo en el equipo\n` +
      "de la entrega, o reinstala con `npm ci` en ese equipo, para comprobarlas.");
  if (!malas.length) return console.log("Sin páginas caídas.");
  console.log(`${malas.length} problema(s):`);
  for (const m of malas) console.log(` ✘ ${m}`);
  process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

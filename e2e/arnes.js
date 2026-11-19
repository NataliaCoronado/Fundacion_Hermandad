'use strict';
// Arnés de pruebas de extremo a extremo: levanta el sistema en memoria con pacientes y cuentas de prueba
// (sin base real ni envíos reales) y lo recorre con Chrome mediante Playwright.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'evidencias-funcionales');
const PUERTO = 3056;
const BASE = `http://127.0.0.1:${PUERTO}`;
const CLAVE = 'demo1234';
const resultados = [];
const hallazgos = [];

async function levantar() {
  process.env.DIR_DOCUMENTOS = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-docs-'));
  process.env.MENSAJES_AUTOMATICOS = '0';
  delete process.env.DATABASE_URL;
  const { crearContenedor } = require(path.join(RAIZ, 'src/contenedor'));
  const { crearServidor } = require(path.join(RAIZ, 'src/server'));
  const c = crearContenedor({ demo: true });
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(PUERTO, '127.0.0.1', r));
  return { c, srv };
}

const dv = (n) => { let s = 0, m = 2; for (const d of String(n).split('').reverse()) { s += Number(d) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return r === 11 ? '0' : r === 10 ? 'K' : String(r); };
const rutNuevo = (n) => `${n}-${dv(n)}`;

async function nuevoContexto(browser, flujo, opciones = {}) {
  fs.mkdirSync(path.join(SALIDA, 'videos'), { recursive: true });
  fs.mkdirSync(path.join(SALIDA, 'trazas'), { recursive: true });
  fs.mkdirSync(path.join(SALIDA, 'capturas'), { recursive: true });
  const ancho = opciones.movil ? 390 : 1280, alto = opciones.movil ? 844 : 800;
  const context = await browser.newContext({
    baseURL: BASE, viewport: { width: ancho, height: alto }, isMobile: !!opciones.movil, hasTouch: !!opciones.movil,
    recordVideo: { dir: path.join(SALIDA, 'videos', flujo), size: { width: ancho, height: alto } }, locale: 'es-CL', acceptDownloads: true,
  });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const registro = { flujo, consola: [], red: [] };
  const observar = (page) => {
    page.on('console', (m) => { if (m.type() === 'error') registro.consola.push(`${m.text()} (${page.url().replace(BASE, '')})`); });
    page.on('pageerror', (e) => registro.consola.push(`Excepción: ${e.message} (${page.url().replace(BASE, '')})`));
    page.on('requestfailed', (r) => registro.red.push(`FALLÓ ${r.method()} ${r.url().replace(BASE, '')}: ${r.failure()?.errorText}`));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('fonts.g')) registro.red.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
  };
  context.on('page', (p) => { p.on('dialog', (d) => d.accept()); observar(p); });
  return { context, registro, nueva: async () => { const p = await context.newPage(); return p; } };
}

async function cerrarContexto(ctx, flujo) {
  await ctx.context.tracing.stop({ path: path.join(SALIDA, 'trazas', `${flujo}.zip`) });
  await ctx.context.close();
}

// Ejecuta un paso; si falla guarda captura y lo registra sin detener el resto del flujo.
async function paso(flujo, nombre, page, fn, esperadoRed = []) {
  const antes = resultados.length;
  try {
    const detalle = await fn();
    resultados.push({ flujo, paso: nombre, estado: 'aprobado', detalle: detalle || '' });
  } catch (e) {
    const cap = `${flujo}-${nombre}`.replace(/[^a-z0-9áéíóúñ]+/gi, '_').slice(0, 80) + '.png';
    try { await page.screenshot({ path: path.join(SALIDA, 'capturas', cap), fullPage: true }); } catch {}
    resultados.push({ flujo, paso: nombre, estado: 'fallido', detalle: String(e.message).split('\n')[0].slice(0, 300), captura: `capturas/${cap}` });
  }
  return resultados[antes] || resultados[resultados.length - 1];
}
const noVerificado = (flujo, nombre, motivo) => resultados.push({ flujo, paso: nombre, estado: 'no verificado', detalle: motivo });
const afirmar = (cond, msg) => { if (!cond) throw new Error(msg); };

async function ingresar(page, correo, clave = CLAVE) {
  await page.goto('/login');
  await page.fill('#correo', correo);
  await page.fill('#clave', clave);
  await page.click('button[type=submit]');
  await page.waitForLoadState('networkidle');
}

module.exports = { chromium, levantar, nuevoContexto, cerrarContexto, paso, noVerificado, afirmar, ingresar, resultados, hallazgos, rutNuevo, BASE, SALIDA, CLAVE, fs, path };

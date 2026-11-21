"use strict";
// Aísla la suite del .env y del shell del desarrollador: debe fijarse ANTES de cargar src/server.js.
for (const k of ["NODE_ENV", "COOKIE_SECURE", "TRUST_PROXY", "DATOS_DEMO", "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN"]) delete process.env[k];
process.env.CLAVE_DEMO = "demo1234";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");
const { esProduccion, datosDemoActivos, cookieSegura } = require("../src/herramientas/entorno");
const { validarAccesoPorSede } = require("../src/controllers/validarAccesoPorSede");

async function levantar() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { c, base: `http://127.0.0.1:${srv.address().port}`, cerrar: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(r); }) };
}
const conEntorno = async (vars, fn) => {
  const previo = {};
  for (const k of Object.keys(vars)) { previo[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(vars)) { if (previo[k] === undefined) delete process.env[k]; else process.env[k] = previo[k]; } }
};

// ---- #1 valores por defecto inseguros ----
test("entorno: en producción los datos demo y la clave demo no se activan solos", () => {
  assert.strictEqual(esProduccion({ NODE_ENV: "production" }), true);
  assert.strictEqual(datosDemoActivos({}), true);
  assert.strictEqual(datosDemoActivos({ DATOS_DEMO: "0" }), false);
  assert.strictEqual(datosDemoActivos({ NODE_ENV: "production" }), false);
  assert.strictEqual(datosDemoActivos({ NODE_ENV: "production", DATOS_DEMO: "1" }), true);
});

test("producción: el contenedor se niega a arrancar con CLAVE_DEMO y no siembra la clave demo en memoria", async () => {
  await conEntorno({ NODE_ENV: "production", CLAVE_DEMO: "demo1234" }, async () => {
    await assert.rejects(() => crearContenedor().inicializar(), /CLAVE_DEMO/);
  });
  await conEntorno({ NODE_ENV: "production", CLAVE_DEMO: undefined }, async () => {
    const c = crearContenedor();
    await c.inicializar();
    await assert.rejects(() => c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234"), /CREDENCIALES_INVALIDAS/);
  });
});

test("docker-compose: sin claves por defecto y la base solo escucha en localhost", () => {
  const compose = fs.readFileSync(path.join(__dirname, "..", "docker-compose.yml"), "utf8");
  assert.ok(!/cambiar_en_local/.test(compose), "clave de Postgres escrita en el compose");
  assert.ok(!/CLAVE_DEMO:\s*["']?demo1234/.test(compose), "clave demo fija en el compose");
  const publicadosBd = [...compose.matchAll(/-\s*["']?([^"'\s]*:5432)["']?\s*$/gm)].map((m) => m[1]);
  assert.ok(publicadosBd.length > 0 && publicadosBd.every((x) => x.startsWith("127.0.0.1:")), `5432 publicado: ${publicadosBd}`);
  assert.match(compose, /POSTGRES_PASSWORD:\s*\$\{POSTGRES_PASSWORD:\?/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", ".env.example")));
});

// ---- #2 cookie Secure, HSTS y CSP ----
test("cookieSegura: por defecto en producción, apagable solo con COOKIE_SECURE=0", () => {
  assert.strictEqual(cookieSegura({}), false);
  assert.strictEqual(cookieSegura({ COOKIE_SECURE: "1" }), true);
  assert.strictEqual(cookieSegura({ NODE_ENV: "production" }), true);
  assert.strictEqual(cookieSegura({ NODE_ENV: "production", COOKIE_SECURE: "0" }), false);
});

test("cabeceras: CSP siempre; Secure y HSTS cuando la cookie es segura", async () => {
  const normal = await levantar();
  try {
    const r = await fetch(`${normal.base}/`);
    assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
    assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.strictEqual(r.headers.get("strict-transport-security"), null);
  } finally { await normal.cerrar(); }
  await conEntorno({ NODE_ENV: "production", CLAVE_DEMO: undefined }, async () => {
    const s = await levantar();
    try {
      const r = await fetch(`${s.base}/logout`, { method: "POST", redirect: "manual" });
      assert.match(r.headers.get("set-cookie"), /; Secure/);
      assert.match(r.headers.get("strict-transport-security"), /max-age=\d+/);
    } finally { await s.cerrar(); }
  });
});

// ---- #5 fotos privadas ----
const DIR_FOTOS = path.join(__dirname, "..", "datos", "fotos");
const conFoto = async (fn) => {
  const nombre = `profesional-prueba-${process.pid}.jpg`;
  const archivo = path.join(DIR_FOTOS, nombre);
  fs.mkdirSync(DIR_FOTOS, { recursive: true });
  fs.writeFileSync(archivo, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  try { return await fn(`/img/${nombre}`); } finally { fs.rmSync(archivo, { force: true }); }
};
const ponerFoto = (c, prof, ruta) => { c.operacion.meta.equipo[prof.id] = { ...(c.operacion.meta.equipo[prof.id] || {}), foto: ruta }; };
const entrar = async (base, correo) => {
  const r = await fetch(`${base}/login`, { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
  return r.headers.get("set-cookie").split(";")[0];
};

test("fotos de profesionales: privadas, solo con sesión y de la propia sede", async () => {
  await conFoto(async (ruta) => {
    const s = await levantar();
    try {
      const tens = (await s.c.catalogo.usuarios()).find((u) => u.correo === "tens@ejemplo.cl");
      const sede = Number(tens.idPoliclinico);
      const profs = await s.c.catalogo.profesionales();
      const propio = profs.find((p) => s.c.operacion.lugares(p).includes(sede));
      ponerFoto(s.c, propio, ruta);
      const admin = await entrar(s.base, "admin@ejemplo.cl");
      const personal = await entrar(s.base, "tens@ejemplo.cl");

      assert.strictEqual((await fetch(`${s.base}${ruta}`)).status, 403, "sin sesión");
      const r = await fetch(`${s.base}${ruta}`, { headers: { Cookie: admin } });
      assert.strictEqual(r.status, 200);
      assert.match(r.headers.get("cache-control"), /private/);
      assert.ok(!/public/.test(r.headers.get("cache-control")));
      assert.strictEqual((await fetch(`${s.base}${ruta}`, { headers: { Cookie: personal } })).status, 200, "misma sede");

      ponerFoto(s.c, propio, "");
      const ajeno = profs.find((p) => !s.c.operacion.lugares(p).includes(sede));
      ponerFoto(s.c, ajeno, ruta);
      assert.strictEqual((await fetch(`${s.base}${ruta}`, { headers: { Cookie: personal } })).status, 403, "otra sede");

      const publica = await fetch(`${s.base}/img/logo.png`);
      assert.strictEqual(publica.status, 200);
      assert.match(publica.headers.get("cache-control"), /public/);
      assert.strictEqual((await fetch(`${s.base}/img/..%2f..%2fpackage.json`)).status, 404);
    } finally { await s.cerrar(); }
  });
});

// ---- #3 límite de login por IP ----
test("login: los fallos desde una IP no bloquean a esa cuenta para otra IP", async () => {
  const c = crearContenedor();
  await c.inicializar();
  for (let i = 0; i < 5; i++) await assert.rejects(() => c.auth.iniciarSesion("admin@ejemplo.cl", "mala", "10.0.0.1"), /CREDENCIALES_INVALIDAS/);
  await assert.rejects(() => c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234", "10.0.0.1"), /DEMASIADOS_INTENTOS/);
  const ok = await c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234", "10.0.0.2");
  assert.strictEqual(ok.usuario.rol, "ADMINISTRACION");
});

test("login: una IP que prueba muchas cuentas queda limitada", async () => {
  const c = crearContenedor();
  await c.inicializar();
  for (let i = 0; i < 20; i++) await assert.rejects(() => c.auth.iniciarSesion(`persona${i}@ejemplo.cl`, "x", "10.0.0.9"), /CREDENCIALES_INVALIDAS/);
  await assert.rejects(() => c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234", "10.0.0.9"), /DEMASIADOS_INTENTOS/);
});

test("login: muchos fallos repartidos en IPs distintas igual frenan la cuenta (tope global)", async () => {
  const c = crearContenedor();
  await c.inicializar();
  for (let i = 0; i < 25; i++) await assert.rejects(() => c.auth.iniciarSesion("admin@ejemplo.cl", "mala", `10.1.0.${i}`), /CREDENCIALES_INVALIDAS/);
  await assert.rejects(() => c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234", "10.1.1.1"), /DEMASIADOS_INTENTOS/);
});

// ---- #4 control de sede por defecto negado ----
async function escenarioSedes() {
  const c = crearContenedor();
  await c.inicializar();
  const tens = (await c.catalogo.usuarios()).find((u) => u.rol === "TENS_TONS");
  const bloques = await c.catalogo.bloques();
  const profs = new Map((await c.catalogo.profesionales()).map((p) => [p.id, p]));
  const sede = (b) => c.operacion.sedeBloque(b, profs.get(b.idProfesional));
  return {
    c, tens,
    propio: bloques.find((b) => sede(b) === Number(tens.idPoliclinico)),
    ajeno: bloques.find((b) => sede(b) !== Number(tens.idPoliclinico)),
  };
}
const vacio = () => new URLSearchParams();

test("sede: un bloque de otra sede se rechaza y uno propio pasa", async () => {
  const e = await escenarioSedes();
  assert.ok(e.propio && e.ajeno);
  await assert.rejects(() => validarAccesoPorSede(e.c, e.tens, "/tens/flujo", vacio(), { idBloque: String(e.ajeno.id) }), /FUERA_DE_SEDE/);
  await validarAccesoPorSede(e.c, e.tens, "/tens/flujo", vacio(), { idBloque: String(e.propio.id) });
});

test("sede: un idPoliclinico distinto al del usuario se rechaza", async () => {
  const e = await escenarioSedes();
  const otra = Number(e.tens.idPoliclinico) + 1;
  await assert.rejects(() => validarAccesoPorSede(e.c, e.tens, "/tens/agenda", vacio(), { idPoliclinico: String(otra) }), /FUERA_DE_SEDE/);
  await validarAccesoPorSede(e.c, e.tens, "/tens/agenda", vacio(), { idPoliclinico: String(e.tens.idPoliclinico) });
});

test("sede: un parámetro id*/rut* desconocido se rechaza por defecto (en cuerpo y en URL)", async () => {
  const e = await escenarioSedes();
  await assert.rejects(() => validarAccesoPorSede(e.c, e.tens, "/tens/nueva", vacio(), { idNuevoRecurso: "1" }), /FUERA_DE_SEDE/);
  await assert.rejects(() => validarAccesoPorSede(e.c, e.tens, "/tens/nueva", new URLSearchParams({ rutOculto: "1-9" }), {}), /FUERA_DE_SEDE/);
  await validarAccesoPorSede(e.c, e.tens, "/tens/agenda", vacio(), { fecha: "2028-01-03", q: "x" });
});

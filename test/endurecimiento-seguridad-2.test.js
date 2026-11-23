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
const { crearRutas } = require("../src/rutas");
const { validarAccesoPorSede } = require("../src/controllers/validarAccesoPorSede");
const { error } = require("../src/controllers/mensajesDeError");

const VENTANA = 15 * 60 * 1000;
async function levantar(preparar) {
  const c = crearContenedor();
  await c.inicializar();
  preparar?.(c);
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { c, base: `http://127.0.0.1:${srv.address().port}`, cerrar: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(r); }) };
}
const conEntorno = async (vars, fn) => {
  const previo = {};
  for (const k of Object.keys(vars)) { previo[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return await fn(); } finally { for (const k of Object.keys(vars)) { if (previo[k] === undefined) delete process.env[k]; else process.env[k] = previo[k]; } }
};
const envejecer = (auth, ms) => { for (const [k, lista] of auth.intentos) auth.intentos.set(k, lista.map((t) => t - ms)); };
const loginHttp = (base, correo, clave, xff) =>
  fetch(`${base}/login`, { method: "POST", redirect: "manual", headers: xff ? { "x-forwarded-for": xff } : {}, body: new URLSearchParams({ correo, clave }) });

// Ventana de 15 minutos y reinicio tras éxito
test("login: los fallos dejan de contar al cumplirse la ventana de 15 minutos y el mapa se limpia", async () => {
  const c = crearContenedor();
  await c.inicializar();
  for (let i = 0; i < 5; i++) await assert.rejects(() => c.auth.iniciarSesion("admin@ejemplo.cl", "mala", "10.2.0.1"), /CREDENCIALES_INVALIDAS/);
  envejecer(c.auth, VENTANA - 1000);
  await assert.rejects(() => c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234", "10.2.0.1"), /DEMASIADOS_INTENTOS/, "1 s antes de cumplirse");
  envejecer(c.auth, 2000);
  assert.ok((await c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234", "10.2.0.1")).token);
  assert.ok(![...c.auth.intentos.keys()].some((k) => k.startsWith("par:")), "el par ya no queda registrado");
});

test("login: un ingreso correcto reinicia el contador del par, pero no el de IP ni el de la cuenta", async () => {
  const c = crearContenedor();
  await c.inicializar();
  const fallar = (n) => Promise.all(Array.from({ length: n }, () => c.auth.iniciarSesion("admin@ejemplo.cl", "mala", "10.2.0.2").catch(() => null)));
  await fallar(4);
  await c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234", "10.2.0.2");
  await fallar(4);
  assert.ok((await c.auth.iniciarSesion("admin@ejemplo.cl", "demo1234", "10.2.0.2")).token, "8 fallos en total pero nunca 5 seguidos");
  assert.strictEqual(c.auth.intentos.get("ip:10.2.0.2").length, 8, "el contador de IP sigue acumulando");
  assert.strictEqual(c.auth.intentos.get("cuenta:admin@ejemplo.cl").length, 8, "el contador de la cuenta sigue acumulando");
});

test("login: el barrido elimina las listas vencidas y el correo no puede inflar las claves", async () => {
  const c = crearContenedor();
  await c.inicializar();
  await assert.rejects(() => c.auth.iniciarSesion("x".repeat(1_000_000) + "@ejemplo.cl", "mala", "10.2.0.3"), /CREDENCIALES_INVALIDAS/);
  assert.ok([...c.auth.intentos.keys()].every((k) => k.length < 300), "claves acotadas");
  envejecer(c.auth, VENTANA + 1);
  c.auth.limpiar();
  assert.strictEqual(c.auth.intentos.size, 0);
});

// Login por HTTP: IP real del cliente
test("login HTTP con TRUST_PROXY=1: limita por la última IP de X-Forwarded-For y 429 al exceder", async () => {
  await conEntorno({ TRUST_PROXY: "1" }, async () => {
    const s = await levantar();
    try {
      for (let i = 0; i < 5; i++) assert.strictEqual((await loginHttp(s.base, "admin@ejemplo.cl", "mala", "9.9.9.9, 1.1.1.1")).status, 401);
      assert.strictEqual((await loginHttp(s.base, "admin@ejemplo.cl", "demo1234", "1.1.1.1")).status, 429);
      assert.strictEqual((await loginHttp(s.base, "admin@ejemplo.cl", "demo1234", `${Math.random()}, 1.1.1.1`)).status, 429, "un valor falsificado a la izquierda no esquiva el límite");
      assert.strictEqual((await loginHttp(s.base, "admin@ejemplo.cl", "demo1234", "2.2.2.2")).status, 302, "otra IP sí entra");
      assert.ok(s.c.auditoria.listar().some((x) => /1\.1\.1\.1/.test(x.detalle)), "el rechazo audita la IP");
    } finally { await s.cerrar(); }
  });
});

test("login HTTP sin TRUST_PROXY: X-Forwarded-For se ignora", async () => {
  const s = await levantar();
  try {
    for (let i = 0; i < 5; i++) await loginHttp(s.base, "admin@ejemplo.cl", "mala", `3.3.3.${i}`);
    assert.strictEqual((await loginHttp(s.base, "admin@ejemplo.cl", "demo1234", "4.4.4.4")).status, 429);
  } finally { await s.cerrar(); }
});

// Errores de infraestructura no se disfrazan de credenciales
test("login: una falla de la base no se muestra como 401 ni filtra el mensaje interno", async () => {
  const s = await levantar((c) => { c.catalogo.usuarioPorCorreo = () => { throw new Error("connect ECONNREFUSED 127.0.0.1:5432"); }; });
  const silencio = console.error; console.error = () => {};
  try {
    const r = await loginHttp(s.base, "admin@ejemplo.cl", "demo1234");
    assert.strictEqual(r.status, 500);
    assert.ok(!/ECONNREFUSED|5432/.test(await r.text()));
  } finally { console.error = silencio; await s.cerrar(); }
});

test("mensajes: los errores de infraestructura no se muestran tal cual a un anónimo", () => {
  const silencio = console.error; console.error = () => {};
  try {
    for (const m of ["connect ECONNREFUSED 127.0.0.1:5432", 'password authentication failed for user "hermandad"', 'relation "cita" does not exist', "Connection terminated unexpectedly"])
      assert.match(error(new Error(m)).texto, /Ocurrió un error inesperado/, m);
    assert.strictEqual(error(new Error("Sube un PDF, JPG o PNG.")).texto, "Sube un PDF, JPG o PNG.");
  } finally { console.error = silencio; }
});

// Descarga de archivos
test("fotos: un error de lectura no tumba el servidor", async () => {
  const dir = path.join(__dirname, "..", "datos", "fotos");
  const nombre = `profesional-error-${process.pid}.jpg`;
  const carpeta = path.join(dir, nombre); // una carpeta con nombre de imagen: existe, pero no se puede leer
  fs.mkdirSync(carpeta, { recursive: true });
  const s = await levantar();
  const silencio = console.error; console.error = () => {};
  try {
    const prof = (await s.c.catalogo.profesionales())[0];
    s.c.operacion.meta.equipo[prof.id] = { ...(s.c.operacion.meta.equipo[prof.id] || {}), foto: `/img/${nombre}` };
    const r = await loginHttp(s.base, "admin@ejemplo.cl", "demo1234");
    const cookie = r.headers.get("set-cookie").split(";")[0];
    await fetch(`${s.base}/img/${nombre}`, { headers: { Cookie: cookie } }).then((x) => x.arrayBuffer()).catch(() => null);
    assert.strictEqual((await fetch(`${s.base}/`)).status, 200, "el servidor sigue atendiendo");
  } finally { console.error = silencio; await s.cerrar(); fs.rmSync(carpeta, { recursive: true, force: true }); }
});

// Control de sede
async function escenario() {
  const c = crearContenedor();
  await c.inicializar();
  const tens = (await c.catalogo.usuarios()).find((u) => u.rol === "TENS_TONS");
  const sede = Number(tens.idPoliclinico);
  const profs = await c.catalogo.profesionales();
  return { c, tens, sede, propio: profs.find((p) => c.operacion.lugares(p).includes(sede)), ajeno: profs.find((p) => !c.operacion.lugares(p).includes(sede)) };
}
const vacio = () => new URLSearchParams();

test("sede: idProfesional de otra sede o inexistente se rechaza; el propio pasa", async () => {
  const e = await escenario();
  assert.ok(e.propio && e.ajeno);
  await assert.rejects(() => validarAccesoPorSede(e.c, e.tens, "/tens/agenda", vacio(), { idProfesional: String(e.ajeno.id) }), /FUERA_DE_SEDE/);
  await assert.rejects(() => validarAccesoPorSede(e.c, e.tens, "/tens/agenda", vacio(), { idProfesional: "999999" }), /FUERA_DE_SEDE/);
  await validarAccesoPorSede(e.c, e.tens, "/tens/agenda", vacio(), { idProfesional: String(e.propio.id) });
});

test("sede: idBloque e idProfesional que no son enteros positivos se rechazan sin llegar a la base", async () => {
  const e = await escenario();
  e.c.catalogo.bloque = () => { throw new Error("no debe llegar a la base"); };
  e.c.catalogo.profesional = () => { throw new Error("no debe llegar a la base"); };
  for (const malo of ["abc", "-1", "1.5", "0", "1e3", ""].filter(Boolean)) {
    await assert.rejects(() => validarAccesoPorSede(e.c, e.tens, "/tens/flujo", vacio(), { idBloque: malo }), /FUERA_DE_SEDE/, `idBloque=${malo}`);
    await assert.rejects(() => validarAccesoPorSede(e.c, e.tens, "/tens/agenda", vacio(), { idProfesional: malo }), /FUERA_DE_SEDE/, `idProfesional=${malo}`);
  }
});

test("sede por HTTP: los parámetros de la URL de un GET también pasan por el control", async () => {
  const s = await levantar();
  try {
    const tens = (await s.c.catalogo.usuarios()).find((u) => u.correo === "tens@ejemplo.cl");
    const cookie = (await loginHttp(s.base, "tens@ejemplo.cl", "demo1234")).headers.get("set-cookie").split(";")[0];
    const otra = Number(tens.idPoliclinico) + 1;
    assert.strictEqual((await fetch(`${s.base}/tens/agenda?idPoliclinico=${otra}`, { headers: { Cookie: cookie } })).status, 403);
    assert.strictEqual((await fetch(`${s.base}/tens/agenda?idNuevo=1`, { headers: { Cookie: cookie } })).status, 403);
    assert.strictEqual((await fetch(`${s.base}/tens/agenda?idBloque=abc`, { headers: { Cookie: cookie } })).status, 403);
    assert.strictEqual((await fetch(`${s.base}/tens/agenda`, { headers: { Cookie: cookie } })).status, 200);
  } finally { await s.cerrar(); }
});

test("rutas: toda ruta /tens/* declara el área tens, para que el control de sede la alcance", async () => {
  const c = crearContenedor();
  await c.inicializar();
  const mal = crearRutas(c).filter((r) => r.ruta.startsWith("/tens") && r.area !== "tens").map((r) => `${r.metodo} ${r.ruta}`);
  assert.deepStrictEqual(mal, []);
});

// Primer administrador en producción
test("producción: se puede crear el primer administrador con un enlace de un solo uso", async () => {
  await conEntorno({ NODE_ENV: "production", CLAVE_DEMO: undefined }, async () => {
    const { crearEnlaceAdministrador } = require("../src/herramientas/crearAdministrador");
    const c = crearContenedor();
    await c.inicializar();
    const ruta = await crearEnlaceAdministrador(c, { correo: "Directora@Fundacion.cl", nombre: "Directora" });
    assert.match(ruta, /^\/restablecer\?token=[0-9a-f]{64}$/);
    const token = ruta.split("=")[1];
    await assert.rejects(() => c.operacion.restablecer(token, "corta"), /10 caracteres/);
    await c.operacion.restablecer(token, "clave-larga-segura-1");
    const { usuario } = await c.auth.iniciarSesion("directora@fundacion.cl", "clave-larga-segura-1");
    assert.strictEqual(usuario.rol, "ADMINISTRACION");
    await assert.rejects(() => c.operacion.restablecer(token, "otra-clave-larga-2"), /expiró o ya se utilizó/);
    const otra = await crearEnlaceAdministrador(c, { correo: "directora@fundacion.cl", nombre: "Directora" });
    assert.match(otra, /^\/restablecer\?token=/, "un correo ya existente reutiliza la cuenta");
    await assert.rejects(() => crearEnlaceAdministrador(c, { correo: "no-es-correo", nombre: "X" }), /correo/i);
  });
});

"use strict";
const test = require("node:test");
const assert = require("node:assert");
const net = require("node:net");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SCRIPT = path.join(__dirname, "..", "scripts", "crearAdministrador.js");
const puertoLibre = () => new Promise((ok) => { const s = net.createServer().listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => ok(port)); }); });
const correr = (args, env) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env: { ...process.env, DATABASE_URL: "", CLAVE_DEMO: "", ...env } });
const carpeta = () => fs.mkdtempSync(path.join(os.tmpdir(), "crear-admin-"));

test("crear-admin: con la aplicación detenida imprime el enlace de un solo uso", async () => {
  const dir = carpeta();
  try {
    const r = correr(["directora@fundacion.cl", "Directora"], { ARCHIVO_DATOS: path.join(dir, "estado.json"), PORT: String(await puertoLibre()), PORT_PERSONAL: String(await puertoLibre()) });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /\/restablecer\?token=[0-9a-f]{64}/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("crear-admin: se niega si la aplicación está en marcha (su siguiente guardado borraría el enlace)", async () => {
  const dir = carpeta();
  const ocupado = net.createServer();
  await new Promise((ok) => ocupado.listen(0, "127.0.0.1", ok));
  try {
    const r = correr(["directora@fundacion.cl", "Directora"], { ARCHIVO_DATOS: path.join(dir, "estado.json"), PORT: String(ocupado.address().port), PORT_PERSONAL: String(await puertoLibre()) });
    assert.strictEqual(r.status, 1);
    assert.match(r.stderr, /detén la aplicación/i);
    assert.ok(!/token=/.test(r.stdout));
    assert.ok(!fs.existsSync(path.join(dir, "estado.json")), "no debe escribir el estado");
  } finally { ocupado.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("crear-admin: sin correo muestra el uso", () => {
  const r = correr([], {});
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /Uso:/);
});

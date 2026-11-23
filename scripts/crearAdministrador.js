"use strict";
require("../src/herramientas/entorno").cargarEnv();
const net = require("node:net");
const path = require("node:path");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearEnlaceAdministrador } = require("../src/herramientas/crearAdministrador");

const [correo, ...resto] = process.argv.slice(2);
if (!correo) {
  console.error('Uso: npm run crear-admin -- correo@dominio.cl "Nombre Apellido"');
  process.exit(1);
}
const escuchando = (puerto) => new Promise((ok) => {
  const s = net.connect({ port: puerto, host: "127.0.0.1" });
  s.setTimeout(500);
  s.once("connect", () => { s.destroy(); ok(true); });
  s.once("error", () => ok(false));
  s.once("timeout", () => { s.destroy(); ok(false); });
});

(async () => {
  // La aplicación en marcha guarda su propio estado en memoria y borraría el enlace.
  const puertos = [Number(process.env.PORT || 3000), Number(process.env.PORT_PERSONAL ?? 3001)].filter(Boolean);
  for (const puerto of puertos)
    if (await escuchando(puerto)) {
      console.error(`✘ La aplicación está en marcha (puerto ${puerto}). Detén la aplicación, ejecuta crear-admin y vuelve a iniciarla.`);
      process.exit(1);
    }
  const url = process.env.DATABASE_URL;
  const db = url ? require("../src/db/conexion-postgres").crearDb(url) : null;
  const persistencia = new (require("../src/repositories/GuardadoEnArchivoJson").GuardadoEnArchivoJson)(
    process.env.ARCHIVO_DATOS || path.join(__dirname, "../datos", db ? "extras.json" : "estado.json"),
  );
  const aplicacion = crearContenedor({ db, persistencia, demo: false });
  await aplicacion.inicializar();
  const ruta = await crearEnlaceAdministrador(aplicacion, { correo, nombre: resto.join(" ") });
  const base = (process.env.URL_PERSONAL || "http://localhost:3001").replace(/\/$/, "");
  console.log(`Enlace de un solo uso (vale 30 minutos):\n${base}${ruta}`);
  process.exit(0);
})().catch((e) => {
  console.error(`✘ ${e.message}`);
  process.exit(1);
});

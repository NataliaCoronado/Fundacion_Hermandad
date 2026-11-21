"use strict";
require("../src/herramientas/entorno").cargarEnv();
const path = require("node:path");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearEnlaceAdministrador } = require("../src/herramientas/crearAdministrador");

const [correo, ...resto] = process.argv.slice(2);
if (!correo) {
  console.error('Uso: npm run crear-admin -- correo@dominio.cl "Nombre Apellido"');
  process.exit(1);
}
(async () => {
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

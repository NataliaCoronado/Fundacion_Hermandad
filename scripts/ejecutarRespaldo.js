"use strict";
require("../src/herramientas/entorno").cargarEnv();
const net = require("node:net");
const path = require("node:path");
const R = require("../src/herramientas/logicaDeRespaldo");

const RAIZ = path.join(__dirname, "..");
const DATOS = path.resolve(process.env.DIR_DATOS || path.join(RAIZ, "datos"));
const RESPALDOS = path.resolve(process.env.DIR_RESPALDOS || path.join(RAIZ, "respaldos"));
const kb = (n) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const mostrar = (p) => (p.startsWith(RAIZ + path.sep) ? path.relative(RAIZ, p) : p);
const salir = (texto) => { console.error(`✘ ${texto}`); process.exit(1); };

for (const v of ["ARCHIVO_DATOS", "DIR_DOCUMENTOS"]) {
  const p = process.env[v] && path.resolve(process.env[v]);
  if (p && !p.startsWith(DATOS + path.sep)) salir(`${v} apunta fuera de ${DATOS}. Define DIR_DATOS con la carpeta que contiene todos los datos para respaldarlos completos.`);
}

const escuchando = (puerto) => new Promise((ok) => {
  const s = net.connect({ port: puerto, host: "127.0.0.1" });
  s.setTimeout(500);
  s.once("connect", () => { s.destroy(); ok(true); });
  s.once("error", () => ok(false));
  s.once("timeout", () => { s.destroy(); ok(false); });
});

(async () => {
  const [orden = "crear", arg] = process.argv.slice(2);
  if (orden === "crear") {
    const { carpeta, manifiesto } = R.crearRespaldo({ datos: DATOS, destino: RESPALDOS });
    const total = manifiesto.archivos.reduce((s, a) => s + a.bytes, 0);
    console.log(`✔ Respaldo creado: ${mostrar(carpeta)}`);
    console.log(`  ${manifiesto.archivos.length} archivo(s), ${kb(total)}, modo ${manifiesto.modo}.`);
    console.log("  Guarda una copia FUERA de este computador: si el equipo se pierde, el respaldo se pierde con él.");
    console.log("  Contiene datos personales: no lo subas al repositorio ni lo compartas por canales abiertos.");
    return;
  }
  if (orden === "listar") {
    const l = R.listarRespaldos(RESPALDOS);
    if (!l.length) return console.log(`No hay respaldos en ${mostrar(RESPALDOS)}.`);
    for (const r of l) console.log(`${r.nombre.padEnd(40)} ${String(r.archivos).padStart(4)} archivos  ${kb(r.bytes).padStart(9)}  ${r.modo}`);
    return;
  }
  if (orden === "verificar") {
    if (!arg) salir("Indica la carpeta del respaldo. Usa «npm run respaldo -- listar» para verlas.");
    const v = R.verificarRespaldo(path.resolve(arg));
    if (!v.ok) salir(`Respaldo dañado o incompleto:\n  ${v.problemas.join("\n  ")}`);
    return console.log(`✔ Respaldo íntegro: ${v.manifiesto.archivos.length} archivo(s) coinciden con su huella.`);
  }
  if (orden === "restaurar") {
    if (!arg) {
      console.log("Indica qué respaldo restaurar:  npm run restaurar -- respaldos/<carpeta>\n");
      const l = R.listarRespaldos(RESPALDOS);
      return console.log(l.length ? l.map((r) => `  respaldos/${r.nombre}`).join("\n") : "No hay respaldos.");
    }
    for (const p of [Number(process.env.PORT || 3000), Number(process.env.PORT_PERSONAL || 3001)])
      if (await escuchando(p)) salir(`Hay un servidor en el puerto ${p}. Detén la aplicación (Ctrl+C en su terminal) antes de restaurar: si sigue en marcha, volverá a guardar sus datos en memoria encima de lo restaurado.`);
    const r = R.restaurar({ respaldo: path.resolve(arg), datos: DATOS, destinoSeguridad: RESPALDOS });
    console.log(`✔ Restaurado: ${r.archivos} archivo(s).`);
    if (r.seguridad) console.log(`  Lo que había antes quedó respaldado en ${mostrar(r.seguridad)} por si necesitas volver atrás.`);
    console.log("  Ya puedes iniciar la aplicación con npm start.");
    return;
  }
  salir(`Orden desconocida: ${orden}. Usa crear, listar, verificar o restaurar.`);
})().catch((e) => salir(e.message));

'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Carga el archivo .env del proyecto en process.env, sin sobrescribir lo que ya venga del sistema
// (igual que --env-file de Node). Se hace en código y no con un flag porque --env-file-if-exists existe
// solo desde Node 22.9, y el proyecto debe arrancar con Node 20 o superior en macOS, Linux y Windows.
// Si no hay .env no pasa nada: la aplicación funciona con sus valores predeterminados.
function cargarEnv(archivo = path.join(__dirname, '..', '..', '.env')) {
  let texto;
  try {
    texto = fs.readFileSync(archivo, 'utf8');
  } catch {
    return 0;
  }
  let cargadas = 0;
  for (const linea of texto.split(/\r?\n/)) {        // \r?\n: también acepta archivos guardados en Windows
    const l = linea.trim();
    if (!l || l.startsWith('#')) continue;
    const corte = l.indexOf('=');
    if (corte < 1) continue;
    const clave = l.slice(0, corte).trim().replace(/^export\s+/, '');
    let valor = l.slice(corte + 1).trim();
    const comillas = (valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"));
    if (comillas && valor.length >= 2) valor = valor.slice(1, -1);
    if (!(clave in process.env)) {
      process.env[clave] = valor;
      cargadas++;
    }
  }
  return cargadas;
}
module.exports = { cargarEnv };

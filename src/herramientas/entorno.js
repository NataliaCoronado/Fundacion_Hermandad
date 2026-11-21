'use strict';
const fs = require('node:fs');
const path = require('node:path');

function cargarEnv(archivo = path.join(__dirname, '..', '..', '.env')) {
  let texto;
  try {
    texto = fs.readFileSync(archivo, 'utf8');
  } catch {
    return 0;
  }
  let cargadas = 0;
  for (const linea of texto.split(/\r?\n/)) {
    const lineaLimpia = linea.trim();
    if (!lineaLimpia || lineaLimpia.startsWith('#')) continue;
    const corte = lineaLimpia.indexOf('=');
    if (corte < 1) continue;
    const clave = lineaLimpia.slice(0, corte).trim().replace(/^export\s+/, '');
    let valor = lineaLimpia.slice(corte + 1).trim();
    const comillas = (valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"));
    if (comillas && valor.length >= 2) valor = valor.slice(1, -1);
    if (!(clave in process.env)) {
      process.env[clave] = valor;
      cargadas++;
    }
  }
  return cargadas;
}
const esProduccion = (env = process.env) => env.NODE_ENV === 'production';
const datosDemoActivos = (env = process.env) =>
  esProduccion(env) ? env.DATOS_DEMO === '1' : env.DATOS_DEMO !== '0';
const cookieSegura = (env = process.env) =>
  env.COOKIE_SECURE === '1' || (esProduccion(env) && env.COOKIE_SECURE !== '0');
module.exports = { cargarEnv, esProduccion, datosDemoActivos, cookieSegura };

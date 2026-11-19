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

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const IGNORAR = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$|\.tmp$/;
const pad = (n) => String(n).padStart(2, '0');
const sello = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const huella = (archivo) => crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');

function listarArchivos(dir, rel = '') {
  const salida = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (IGNORAR.test(r)) continue;
    if (e.isDirectory()) salida.push(...listarArchivos(dir, r));
    else if (e.isFile()) salida.push(r);
  }
  return salida.sort();
}

function entornoPg(url) {
  const u = new URL(url);
  return {
    ...process.env,
    PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
  };
}
const correrPg = (programa, args, url) => {
  try {
    execFileSync(programa, args, { env: entornoPg(url), stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`${programa} no está instalado en este equipo: instala las herramientas de PostgreSQL o ejecútalo dentro del contenedor de la base.`);
    throw new Error(`${programa} falló: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }
};

function carpetaNueva(destino, nombre) {
  let carpeta = path.join(destino, nombre);
  for (let i = 2; fs.existsSync(carpeta); i++) carpeta = path.join(destino, `${nombre}-${i}`);
  return carpeta;
}

function crearRespaldo({ datos, destino, baseDatos = process.env.DATABASE_URL, etiqueta = '', ahora = new Date(), ejecutar = correrPg }) {
  if (!fs.existsSync(datos)) throw new Error(`No existe la carpeta de datos: ${datos}`);
  fs.mkdirSync(destino, { recursive: true, mode: 0o700 });
  const carpeta = carpetaNueva(destino, sello(ahora) + (etiqueta ? `_${etiqueta}` : ''));
  try {
    const archivos = [];
    for (const rel of listarArchivos(datos)) {
      const origen = path.join(datos, ...rel.split('/'));
      const copia = path.join(carpeta, 'datos', ...rel.split('/'));
      fs.mkdirSync(path.dirname(copia), { recursive: true, mode: 0o700 });
      fs.copyFileSync(origen, copia);
      fs.chmodSync(copia, 0o600);
      archivos.push({ ruta: `datos/${rel}`, bytes: fs.statSync(copia).size, sha256: huella(copia) });
    }
    if (baseDatos) {
      const volcado = path.join(carpeta, 'base.dump');
      ejecutar('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', volcado], baseDatos);
      archivos.push({ ruta: 'base.dump', bytes: fs.statSync(volcado).size, sha256: huella(volcado) });
    }
    const paquete = (() => { try { return require('../../package.json'); } catch { return {}; } })();
    const manifiesto = {
      creado: ahora.toISOString(),
      aplicacion: `${paquete.name || 'hermandad-citas'} ${paquete.version || ''}`.trim(),
      modo: baseDatos ? 'postgresql' : 'memoria',
      archivos,
    };
    fs.writeFileSync(path.join(carpeta, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2), { mode: 0o600 });
    return { carpeta, manifiesto };
  } catch (e) {
    fs.rmSync(carpeta, { recursive: true, force: true });
    throw e;
  }
}

function verificarRespaldo(carpeta) {
  const archivoManifiesto = path.join(carpeta, 'manifiesto.json');
  if (!fs.existsSync(archivoManifiesto)) return { ok: false, problemas: ['Falta manifiesto.json: no es un respaldo de este sistema.'], manifiesto: null };
  const manifiesto = JSON.parse(fs.readFileSync(archivoManifiesto, 'utf8'));
  const problemas = [];
  for (const a of manifiesto.archivos) {
    const f = path.join(carpeta, ...a.ruta.split('/'));
    if (!fs.existsSync(f)) problemas.push(`Falta ${a.ruta}.`);
    else if (fs.statSync(f).size !== a.bytes || huella(f) !== a.sha256) problemas.push(`${a.ruta} no coincide con el original.`);
  }
  return { ok: problemas.length === 0, problemas, manifiesto };
}

function restaurar({ respaldo, datos, destinoSeguridad, baseDatos = process.env.DATABASE_URL, ejecutar = correrPg }) {
  const v = verificarRespaldo(respaldo);
  if (!v.ok) throw new Error(`El respaldo no se puede usar: ${v.problemas.join(' ')}`);
  const { manifiesto } = v;
  if (manifiesto.modo === 'postgresql' && !baseDatos) throw new Error('Este respaldo incluye la base PostgreSQL: define DATABASE_URL para restaurarla.');
  if (manifiesto.modo === 'memoria' && baseDatos) throw new Error('Este respaldo es del modo sin base de datos y DATABASE_URL está definida: restaurarlo dejaría la base y los archivos desalineados.');
  let seguridad = null;
  if (fs.existsSync(datos) && listarArchivos(datos).length)
    seguridad = crearRespaldo({ datos, destino: destinoSeguridad, baseDatos, etiqueta: 'antes-de-restaurar', ejecutar }).carpeta;
  const temporal = `${datos}.restaurando`;
  fs.rmSync(temporal, { recursive: true, force: true });
  fs.mkdirSync(temporal, { recursive: true, mode: 0o700 });
  for (const a of manifiesto.archivos.filter((x) => x.ruta.startsWith('datos/'))) {
    const destino = path.join(temporal, ...a.ruta.slice('datos/'.length).split('/'));
    fs.mkdirSync(path.dirname(destino), { recursive: true, mode: 0o700 });
    fs.copyFileSync(path.join(respaldo, ...a.ruta.split('/')), destino);
    fs.chmodSync(destino, 0o600);
  }
  if (manifiesto.modo === 'postgresql')
    ejecutar('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', entornoPg(baseDatos).PGDATABASE, path.join(respaldo, 'base.dump')], baseDatos);
  fs.rmSync(datos, { recursive: true, force: true });
  fs.renameSync(temporal, datos);
  return { seguridad, archivos: manifiesto.archivos.length };
}

function listarRespaldos(destino) {
  if (!fs.existsSync(destino)) return [];
  return fs.readdirSync(destino, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(destino, e.name, 'manifiesto.json')))
    .map((e) => {
      const m = JSON.parse(fs.readFileSync(path.join(destino, e.name, 'manifiesto.json'), 'utf8'));
      return { nombre: e.name, carpeta: path.join(destino, e.name), creado: m.creado, modo: m.modo, archivos: m.archivos.length, bytes: m.archivos.reduce((s, a) => s + a.bytes, 0) };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

module.exports = { crearRespaldo, verificarRespaldo, restaurar, listarRespaldos, listarArchivos };

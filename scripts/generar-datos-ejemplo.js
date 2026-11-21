'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { SEDES, ESPECIALIDADES, profesionalesDeMuestra } = require('../src/models/informacionDeSedes');

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const dv = (n) => { let s = 0; let m = 2; for (const c of String(n).split('').reverse()) { s += Number(c) * m; m = m === 7 ? 2 : m + 1; } const r = 11 - (s % 11); return r === 10 ? 'K' : r === 11 ? '0' : String(r); };
const comunas = [...new Set(SEDES.filter((s) => !s.telemedicina).map((s) => s.comuna))];
const idEsp = (n) => ESPECIALIDADES.indexOf(n) + 1;
const ADMIN = '00000000-0000-0000-0000-000000000001';
const profs = profesionalesDeMuestra();

const seccion1 = `INSERT INTO especialidad (nombre, requiere_orden) VALUES
${ESPECIALIDADES.map((e) => ` (${q(e)},FALSE)`).join(',\n')};

INSERT INTO policlinico (nombre, direccion, id_comuna, correo, whatsapp, telefono, es_telemedicina) VALUES
${SEDES.map((s) => ` (${q(s.nombre)},${q(s.direccion)},${s.telemedicina ? 'NULL' : comunas.indexOf(s.comuna) + 1},${q(s.correo)},${q(s.whatsapp)},NULL,${s.telemedicina ? 'TRUE' : 'FALSE'})`).join(',\n')};

INSERT INTO policlinico_especialidad (id_policlinico, id_especialidad) VALUES
${SEDES.flatMap((s) => s.especialidades.map((e) => ` (${s.id},${idEsp(e)})`)).join(',\n')};

`;

const horas = [['09:00', '09:30'], ['09:30', '10:00'], ['10:00', '10:30'], ['10:30', '11:00']];
const seccion2 = `INSERT INTO profesional (rut, nombres, apellidos, correo_institucional) VALUES
${profs.map((p) => ` ('${18000000 + p.id}-${dv(18000000 + p.id)}','Profesional','${p.id}','profesional${p.id}@ejemplo.cl')`).join(',\n')};

INSERT INTO profesional_asignacion (id_profesional, id_policlinico, id_especialidad) VALUES
${profs.map((p) => ` (${p.id},${p.idPoliclinico},${idEsp(p.especialidad)})`).join(',\n')};

INSERT INTO agenda (id_profesional, id_policlinico, id_especialidad, vigente_desde, vigente_hasta, hora_inicio, hora_termino, duracion_min, estado_publicacion, creado_por) VALUES
${profs.map((p) => ` (${p.id},${p.idPoliclinico},${idEsp(p.especialidad)},'2026-11-01','2026-12-31','09:00','11:00',30,'PUBLICADA','${ADMIN}')`).join(',\n')};

INSERT INTO agenda_dia (id_agenda, dia_semana) VALUES
${profs.flatMap((p) => [1, 2].map((d) => ` (${p.id},${d})`)).join(',\n')};

INSERT INTO bloque_horario (id_agenda, fecha, hora_inicio, hora_termino, estado) VALUES
${profs.flatMap((p) => ['2026-11-23', '2026-11-24'].flatMap((f) => horas.map(([a, b]) => ` (${p.id},'${f}','${a}','${b}','DISPONIBLE')`))).join(',\n')};

`;

const archivo = path.join(__dirname, '..', 'base-de-datos', '02_datos_ejemplo.sql');
let sql = fs.readFileSync(archivo, 'utf8');
const corta = (desde, hasta, nuevo) => {
  const i = sql.indexOf(desde); const j = sql.indexOf(hasta, i);
  if (i < 0 || j < 0) throw new Error(`No se encontró ${desde} / ${hasta}`);
  sql = sql.slice(0, i) + nuevo + sql.slice(j);
};
corta('INSERT INTO especialidad', 'INSERT INTO usuario', seccion1);
corta('INSERT INTO profesional (', 'INSERT INTO paciente', seccion2);
sql = sql.replace(/INSERT INTO solicitud_espera \(id_paciente, id_policlinico, id_especialidad, registrado_por\) VALUES\n \(3,2,3,/,
  `INSERT INTO solicitud_espera (id_paciente, id_policlinico, id_especialidad, registrado_por) VALUES\n (3,2,${idEsp('Kinesiología')},`);
fs.writeFileSync(archivo, sql);
console.log(`02_datos_ejemplo.sql actualizado: ${profs.length} profesionales, ${profs.length * 8} bloques.`);

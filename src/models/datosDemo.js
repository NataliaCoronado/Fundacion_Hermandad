'use strict';
// Historial FICTICIO y reproducible para demostrar el panel de Administración (modo memoria).
// Genera ~13 semanas de agenda alrededor de la fecha actual, con citas, asistencia, lista de espera,
// encuestas, cambios de agenda y auditoría. No se usa con PostgreSQL ni en las pruebas automáticas.
const { SEDES } = require('./sedesInfo');
const { hoy, sumarDias } = require('../util/tiempo');
const { normalizarRut } = require('../util/rut');

// Generador pseudoaleatorio con semilla fija: los mismos datos en cada arranque.
function crearAzar(semilla) {
  let a = semilla >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.entre = (n) => Math.floor(r() * n);
  r.elige = (l) => l[r.entre(l.length)];
  r.pesos = (pares) => { const t = pares.reduce((s, [, p]) => s + p, 0); let x = r() * t; for (const [v, p] of pares) { x -= p; if (x <= 0) return v; } return pares[pares.length - 1][0]; };
  return r;
}

const dv = (num) => { let s = 0; [...String(num)].reverse().forEach((d, i) => { s += Number(d) * (2 + (i % 6)); }); const e = (11 - (s % 11)) % 11; return e === 10 ? 'K' : String(e); };
const rutDe = (n) => normalizarRut(`${n}-${dv(n)}`);
const diaSemana = (fecha) => { const [a, m, d] = fecha.split('-').map(Number); return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7; };   // 0 = lunes
const lunesDe = (fecha) => sumarDias(fecha, -diaSemana(fecha));
const pad = (n) => String(n).padStart(2, '0');
const sumarMin = (hora, min) => { const [h, m] = hora.split(':').map(Number); const t = h * 60 + m + min; return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };

const PESO_SEDE = { 1: 1, 2: 0.72, 3: 0.66, 4: 0.78, 5: 0.6, 6: 0.55, 7: 0.82 };
const PESO_ESP = { 'Medicina General': 1, 'Psicología': 0.9, 'Kinesiología': 0.95, 'Nutrición': 0.7, 'Podología': 0.85, 'Fonoaudiología': 0.6, 'Matrona': 0.66, 'Odontología': 1, 'Pediatría': 0.82, 'Ecografías': 0.78, 'Psicología adultos': 0.7 };

function agregarDemo(datos) {
  const azar = crearAzar(20260816);
  const hoyTxt = hoy();
  const ahora = (f, h) => `${f} ${h}`;

  // ---- Pacientes ficticios ----
  const NAC = [['Chilena', 78], ['Venezolana', 10], ['Haitiana', 5], ['Peruana', 4], ['Colombiana', 3]];
  const nPrueba = datos.pacientes.length;
  for (let i = 1; i <= 170; i++) {
    const grupo = azar.pesos([['nino', 17], ['adulto', 45], ['mayor', 38]]);
    const anios = grupo === 'nino' ? 1 + azar.entre(17) : grupo === 'adulto' ? 18 + azar.entre(42) : 60 + azar.entre(30);
    const genero = azar.pesos([['FEMENINO', 62], ['MASCULINO', 36], ['NO_INFORMA', 2]]);
    const nac = azar.pesos(grupo === 'mayor' ? [['Chilena', 94], ['Venezolana', 3], ['Peruana', 3]] : NAC);
    const nacimiento = `${Number(hoyTxt.slice(0, 4)) - anios}-${pad(1 + azar.entre(12))}-${pad(1 + azar.entre(28))}`;
    const p = {
      rut: rutDe(6000000 + i * 4817), nombre: `Paciente demo ${i}`, nombres: 'Paciente demo', apellidos: String(i),
      telefono: `+5695${String(1000000 + i * 3719).slice(0, 7)}`, tieneWhatsapp: azar() < 0.85, correo: '', fechaNacimiento: nacimiento,
      genero, nacionalidad: nac, direccion: `Calle de ejemplo ${100 + i}`, idComuna: 1 + azar.entre(datos.comunas.length), responsable: null, _grupo: grupo,
    };
    if (grupo === 'nino') p.responsable = { nombre: `Responsable demo ${i}`, relacion: azar.elige(['Madre', 'Padre', 'Abuela']), rut: rutDe(9000000 + i * 3571), telefono: `+5698${String(2000000 + i * 1237).slice(0, 7)}` };
    datos.pacientes.push(p);
  }
  const demo = datos.pacientes.slice(nPrueba);
  const ninos = demo.filter((p) => p._grupo === 'nino'); const mayores = demo.filter((p) => p._grupo === 'mayor');
  const mujeres = demo.filter((p) => p.genero === 'FEMENINO' && p._grupo !== 'nino');
  const elegir = (esp) => {
    if (esp === 'Pediatría') return azar.elige(ninos);
    if (esp === 'Matrona') return azar.elige(mujeres);
    if (esp === 'Podología' || esp === 'Kinesiología') return azar() < 0.72 ? azar.elige(mayores) : azar.elige(demo);
    return azar() < 0.4 ? azar.elige(mayores) : azar.elige(demo);
  };
  demo.forEach((p) => delete p._grupo);

  // ---- Dos profesionales inactivos para mostrar el estado ----
  [43, 46].forEach((id) => { const p = datos.profesionales.find((x) => x.id === id); if (p) p.activo = false; });

  // ---- Agendas: 2 días por semana y profesional, 4 cupos por día ----
  // Los cupos fijos de muestra (sin cita) se reemplazan por la agenda generada, para no duplicar días.
  const conCita = new Set(datos.citas.map((c) => c.idBloque));
  datos.bloques = datos.bloques.filter((b) => conCita.has(b.id));
  const existentes = new Set(datos.bloques.map((b) => `${b.idProfesional}|${b.fecha}|${b.hora}`));
  const inicio = lunesDe(sumarDias(hoyTxt, -84)); const fin = sumarDias(lunesDe(hoyTxt), 25);
  const citasPorBloque = new Set(datos.citas.map((c) => c.idBloque));
  for (const prof of datos.profesionales) {
    const sede = prof.idPoliclinico;
    const dias = [...new Set([prof.id % 5, (prof.id + 2) % 5])];
    const arranque = prof.id % 2 ? '09:00' : '14:00';
    const wSede = PESO_SEDE[sede] || 0.6; const wEsp = PESO_ESP[prof.especialidad] || 0.7;
    const pReserva = Math.min(0.88, 0.32 + 0.52 * wSede * wEsp * (0.85 + 0.3 * azar()));
    for (let f = inicio; f <= fin; f = sumarDias(f, 1)) {
      if (!dias.includes(diaSemana(f))) continue;
      const pasado = f < hoyTxt; const dFuturo = pasado ? 0 : Math.round((Date.parse(f) - Date.parse(hoyTxt)) / 86400000);
      for (let k = 0; k < 4; k++) {
        const hora = sumarMin(arranque, k * 30);
        if (existentes.has(`${prof.id}|${f}|${hora}`)) continue;
        const publicado = pasado || dFuturo <= 21 || azar() < 0.2;   // más allá de 3 semanas se libera de a poco
        const b = { id: datos.secuencias.bloque++, idProfesional: prof.id, fecha: f, hora, publicado };
        datos.bloques.push(b);
        if (!prof.activo && !pasado) continue;
        const factor = pasado ? 1 : dFuturo <= 7 ? 0.85 : dFuturo <= 14 ? 0.55 : 0.28;
        if (!publicado || azar() > pReserva * factor) continue;
        if (citasPorBloque.has(b.id)) continue;
        const pac = elegir(prof.especialidad);
        const cita = { id: datos.secuencias.cita++, rut: pac.rut, idBloque: b.id, estadoReserva: 'ACTIVA', estadoConfirmacion: 'CONFIRMADA', asistencia: null, origenCancelacion: null, idProfesionalReemplazo: null };
        if (f < hoyTxt) {
          const avance = Math.max(0, Math.min(1, (Date.parse(f) - Date.parse(sumarDias(hoyTxt, -84))) / (84 * 86400000)));
          const pNoAsiste = 0.25 - 0.11 * avance;       // la inasistencia baja con el tiempo
          if (azar() < 0.07) { cita.estadoReserva = 'CANCELADA'; cita.origenCancelacion = azar.pesos([['WHATSAPP', 5], ['ASISTIDA', 3], ['INSTITUCIONAL', 1]]); }
          else if (azar() < pNoAsiste) { cita.asistencia = 'NO_ASISTIO'; cita.estadoConfirmacion = azar.pesos([['SIN_RESPUESTA', 5], ['PENDIENTE', 2], ['CONFIRMADA', 3]]); }
          else cita.asistencia = 'ASISTIO';
        } else if (azar() < 0.04) { cita.estadoReserva = 'CANCELADA'; cita.origenCancelacion = 'WHATSAPP'; }
        else {
          const cerca = f <= sumarDias(hoyTxt, 3);
          cita.estadoConfirmacion = cerca ? azar.pesos([['CONFIRMADA', 62], ['SIN_RESPUESTA', 14], ['PENDIENTE', 24]]) : azar.pesos([['CONFIRMADA', 30], ['PENDIENTE', 70]]);
        }
        datos.citas.push(cita);
      }
    }
  }

  // ---- Encuestas de atención (≈ un tercio de las asistencias) ----
  datos.extras.encuestas.push(...datos.citas.filter((c) => c.asistencia === 'ASISTIO' && c.id > 2 && azar() < 0.34).map((c, i) => ({
    id: i + 1, idCita: c.id, nota: azar.pesos([[5, 56], [4, 28], [3, 10], [2, 4], [1, 2]]), comentario: '', fecha: ahora(hoyTxt, '09:00'),
  })));

  // ---- Lista de espera ----
  const usados = new Set();
  for (let i = 0; i < 16; i++) {
    const sede = azar.elige(SEDES.filter((s) => !s.telemedicina)); const esp = azar.elige(sede.especialidades); const pac = azar.elige(demo);
    const clave = `${pac.rut}|${sede.id}|${esp}`;
    if (usados.has(clave)) continue; usados.add(clave);
    datos.espera.push({ id: datos.secuencias.espera++, rut: pac.rut, idPoliclinico: sede.id, especialidad: esp, registradaEn: sumarDias(hoyTxt, -1 - azar.entre(40)), estado: 'EN_ESPERA' });
  }

  // ---- Usuarios de la red (un TENS por policlínico) ----
  SEDES.filter((s) => !s.telemedicina && s.id !== 1).forEach((s, i) => datos.usuarios.push({ id: `u${10 + i}`, nombre: `Usuario de prueba TENS/TONS ${s.nombre}`, correo: `tens.${s.nombre.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@ejemplo.cl`, rol: 'TENS_TONS', idPoliclinico: s.id, activo: i !== 3 }));

  // ---- Cambios de agenda y auditoría ----
  const prof = (id) => datos.profesionales.find((p) => p.id === id);
  [[-9, 12, 'AUSENCIA', 'Licencia médica', 3, 4], [-5, 7, 'REEMPLAZO', 'Capacitación institucional', 4, 0], [-2, 2, 'AUSENCIA', 'Trámite personal', 2, 3]].forEach(([dReg, id, tipo, motivo, afectadas, cerrados], i) => {
    const f = sumarDias(hoyTxt, dReg + 3);
    datos.extras.cambios.push({ id: i + 1, tipo, fechaRegistro: ahora(sumarDias(hoyTxt, dReg), '10:15'), fecha: f, idProfesional: prof(id).id, idReemplazo: tipo === 'REEMPLAZO' ? prof(id).id : null, motivo, citasAfectadas: afectadas, bloquesCerrados: cerrados });
  });
  const admin = datos.usuarios[0].nombre;
  [['Inicio de sesión', ''], ['Cupos liberados', 'prof 5, rango de 7 días: 16'], ['Cambio de agenda (AUSENCIA)', 'prof 12'], ['Profesional desactivado', '43'], ['Cupos bloqueados', 'prof 8, rango de 3 días: 12'], ['Cupos liberados', 'prof 21, rango de 14 días: 28'], ['Inicio de sesión', ''], ['Reporte descargado', 'citas.csv']].forEach(([accion, detalle], i, l) => {
    datos.extras.auditoria.push({ id: i + 1, fecha: ahora(sumarDias(hoyTxt, -(l.length - i)), `${pad(8 + i)}:${pad(10 + i * 4)}`), usuario: admin, accion, detalle });
  });
  return datos;
}
module.exports = { agregarDemo };

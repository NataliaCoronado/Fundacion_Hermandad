"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const { cargarEnv } = require("../src/herramientas/entorno");
cargarEnv();
const { crearDatos } = require("../src/models/datosIniciales");
const { agregarDemo } = require("../src/models/datosDeDemostracion");
const { SEDES } = require("../src/models/informacionDeSedes");
const { hoy, sumarDias } = require("../src/herramientas/tiempo");

const ADMIN = "00000000-0000-0000-0000-000000000001";
const DESDE = "2026-08-01", HASTA = "2027-01-31";
const ARCHIVO_EXTRAS = process.env.ARCHIVO_DATOS || path.join(__dirname, "..", "datos", "extras.json");
const quitar = process.argv.includes("quitar");

const NOMBRES = ["Camila", "Javier", "Valentina", "Matías", "Francisca", "Sebastián", "Daniela", "Felipe", "Constanza", "Nicolás", "Catalina", "Tomás", "Fernanda", "Diego", "Antonia", "Cristóbal", "Paula", "Rodrigo", "Macarena", "Andrés", "Javiera", "Ignacio", "Carolina", "Claudio", "Marcela", "Gonzalo", "Loreto", "Patricio", "Ximena", "Esteban"];
const APELLIDOS = ["González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras", "Silva", "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López", "Fuentes", "Hernández", "Torres", "Araya", "Flores", "Espinoza", "Valenzuela", "Castillo", "Tapia", "Reyes", "Gutiérrez", "Castro", "Pizarro", "Álvarez", "Vásquez", "Sánchez", "Fernández"];
const nombreDe = (n, desfase = 0) => ({ nombres: NOMBRES[(n * 7 + desfase) % NOMBRES.length], apellidos: `${APELLIDOS[(n * 11 + desfase) % APELLIDOS.length]} ${APELLIDOS[(n * 13 + 5 + desfase) % APELLIDOS.length]}` });
const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pad = (n) => String(n).padStart(2, "0");
const sumarMin = (h, m) => { const [a, b] = h.split(":").map(Number); const t = a * 60 + b + m; return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; };

async function insertar(cli, tabla, columnas, filas, extra = "") {
  for (let i = 0; i < filas.length; i += 400) {
    const trozo = filas.slice(i, i + 400);
    const valores = [];
    const marcas = trozo.map((f) => `(${f.map((v) => { valores.push(v); return `$${valores.length}`; }).join(",")})`).join(",");
    await cli.query(`INSERT INTO ${tabla} (${columnas.join(",")}) VALUES ${marcas} ${extra}`, valores);
  }
}

async function quitarDemo(cli) {
  await cli.query("SET LOCAL session_replication_role = replica");
  await cli.query("DELETE FROM solicitud_espera WHERE id_paciente IN (SELECT id_paciente FROM paciente WHERE correo LIKE 'demo%@ejemplo.cl')");
  await cli.query("DELETE FROM cita WHERE id_paciente IN (SELECT id_paciente FROM paciente WHERE correo LIKE 'demo%@ejemplo.cl')");
  await cli.query("DELETE FROM bloque_horario WHERE id_agenda IN (SELECT id_agenda FROM agenda WHERE vigente_desde = $1 AND vigente_hasta = $2)", [DESDE, HASTA]);
  await cli.query("DELETE FROM agenda WHERE vigente_desde = $1 AND vigente_hasta = $2", [DESDE, HASTA]);
  await cli.query("DELETE FROM paciente WHERE correo LIKE 'demo%@ejemplo.cl'");
  await cli.query("DELETE FROM usuario WHERE correo LIKE 'tens.demo.%@ejemplo.cl'");
  await cli.query("UPDATE profesional SET nombres = 'Profesional', apellidos = id_profesional::text WHERE correo_institucional LIKE 'profesional%@ejemplo.cl'");
  await cli.query("UPDATE usuario SET nombres = 'Usuario de prueba', apellidos = CASE correo WHEN 'admin@ejemplo.cl' THEN 'Administración' WHEN 'tens@ejemplo.cl' THEN 'TENS/TONS San Isidro' ELSE 'Telemedicina' END WHERE correo IN ('admin@ejemplo.cl','tens@ejemplo.cl','telemedicina.usuario@ejemplo.cl')");
}

function extrasSinDemo() {
  let e;
  try { e = JSON.parse(fs.readFileSync(ARCHIVO_EXTRAS, "utf8")); } catch { e = null; }
  if (!e) return null;
  for (const k of ["encuestas", "encuestasAgendamiento", "auditoria"]) e[k] = (e[k] || []).filter((x) => !x.demo);
  return e;
}
function guardarExtras(e) {
  fs.copyFileSync(ARCHIVO_EXTRAS, ARCHIVO_EXTRAS + ".respaldo-antes-demo");
  fs.writeFileSync(ARCHIVO_EXTRAS, JSON.stringify(e, null, 2));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL: este script carga datos de demostración en PostgreSQL.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const cli = await pool.connect();
  try {
    await cli.query("BEGIN");
    await quitarDemo(cli);
    const extras = extrasSinDemo();
    if (quitar) {
      await cli.query("COMMIT");
      if (extras) guardarExtras(extras);
      console.log("Datos de demostración eliminados y nombres de prueba restaurados.");
      return;
    }
    await cli.query("SET LOCAL session_replication_role = replica");

    const base = crearDatos();
    const idsBaseBloque = new Set(base.bloques.map((b) => b.id));
    const rutsBase = new Set(base.pacientes.map((p) => p.rut));
    const mem = agregarDemo(crearDatos());
    const pacientes = mem.pacientes.filter((p) => !rutsBase.has(p.rut));

    const profs = (await cli.query("SELECT id_profesional::int AS id FROM profesional ORDER BY id_profesional")).rows;
    for (const p of profs) {
      const n = nombreDe(p.id, 3);
      await cli.query("UPDATE profesional SET nombres = $1, apellidos = $2 WHERE id_profesional = $3", [n.nombres, n.apellidos, p.id]);
    }
    await cli.query("UPDATE usuario SET nombres = 'Marcela', apellidos = 'Contreras Ibáñez (Administración)' WHERE correo = 'admin@ejemplo.cl'");
    await cli.query("UPDATE usuario SET nombres = 'Rodrigo', apellidos = 'Soto Vera (TENS San Isidro)' WHERE correo = 'tens@ejemplo.cl'");
    await cli.query("UPDATE usuario SET nombres = 'Paula', apellidos = 'Araya Núñez (Telemedicina)' WHERE correo = 'telemedicina.usuario@ejemplo.cl'");

    const rol = (await cli.query("SELECT id_rol FROM rol WHERE codigo = 'TENS_TONS'")).rows[0].id_rol;
    for (const s of SEDES.filter((x) => !x.telemedicina && x.id !== 1)) {
      const n = nombreDe(s.id, 9);
      await cli.query(
        "INSERT INTO usuario (nombres, apellidos, correo, id_rol, id_policlinico) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (correo) DO NOTHING",
        [n.nombres, `${n.apellidos} (TENS ${s.nombre})`, `tens.demo.${slug(s.nombre)}@ejemplo.cl`, rol, s.id],
      );
    }
    const usuarioDeSede = new Map();
    for (const u of (await cli.query("SELECT id_usuario, id_policlinico::int AS sede FROM usuario WHERE id_policlinico IS NOT NULL ORDER BY creado_en")).rows) if (!usuarioDeSede.has(u.sede)) usuarioDeSede.set(u.sede, u.id_usuario);

    await insertar(cli, "paciente", ["numero_documento", "nombres", "apellidos", "fecha_nacimiento", "genero", "nacionalidad", "telefono_celular", "tiene_whatsapp", "correo", "direccion", "id_comuna"],
      pacientes.map((p, i) => { const n = nombreDe(i + 1, 17); return [p.rut, n.nombres, n.apellidos, p.fechaNacimiento, p.genero, p.nacionalidad, p.telefono, p.tieneWhatsapp, `demo${i + 1}@ejemplo.cl`, p.direccion, p.idComuna]; }));
    const idPaciente = new Map((await cli.query("SELECT numero_documento, id_paciente FROM paciente WHERE correo LIKE 'demo%@ejemplo.cl'")).rows.map((r) => [r.numero_documento, r.id_paciente]));
    const telDe = new Map(pacientes.map((p) => [p.rut, p.telefono]));

    const agendaDe = new Map();
    for (const p of mem.profesionales) {
      const ini = p.id % 2 ? "09:00" : "14:00";
      const r = await cli.query(
        `INSERT INTO agenda (id_profesional, id_policlinico, id_especialidad, vigente_desde, vigente_hasta, hora_inicio, hora_termino, duracion_min, estado_publicacion, creado_por)
         SELECT $1, pa.id_policlinico, pa.id_especialidad, $2, $3, $4::time, $5::time, 30, 'PUBLICADA', $6
         FROM profesional_asignacion pa WHERE pa.id_profesional = $1 RETURNING id_agenda`,
        [p.id, DESDE, HASTA, ini, sumarMin(ini, 120), ADMIN],
      );
      if (r.rows[0]) agendaDe.set(p.id, r.rows[0].id_agenda);
    }
    const ocupadosBd = new Set((await cli.query(
      `SELECT a.id_profesional || '|' || to_char(b.fecha,'YYYY-MM-DD') || '|' || to_char(b.hora_inicio,'HH24:MI') AS k
       FROM bloque_horario b JOIN agenda a ON a.id_agenda = b.id_agenda WHERE a.vigente_desde <> $1`, [DESDE])).rows.map((r) => r.k));
    const citasMem = mem.citas.filter((c) => telDe.has(c.rut));
    const conCita = new Set(citasMem.filter((c) => c.estadoReserva === "ACTIVA").map((c) => c.idBloque));
    const bloques = mem.bloques.filter((b) => !idsBaseBloque.has(b.id) && agendaDe.has(b.idProfesional) && !ocupadosBd.has(`${b.idProfesional}|${b.fecha}|${b.hora}`));
    await insertar(cli, "bloque_horario", ["id_agenda", "fecha", "hora_inicio", "hora_termino", "estado"],
      bloques.map((b) => [agendaDe.get(b.idProfesional), b.fecha, b.hora, sumarMin(b.hora, 30), conCita.has(b.id) ? "RESERVADO" : b.publicado ? "DISPONIBLE" : "NO_PUBLICADO"]), "ON CONFLICT DO NOTHING");
    const agendaProf = new Map([...agendaDe].map(([p, a]) => [a, p]));
    const idBloque = new Map((await cli.query(
      "SELECT b.id_bloque, b.id_agenda, to_char(b.fecha,'YYYY-MM-DD') AS f, to_char(b.hora_inicio,'HH24:MI') AS h FROM bloque_horario b WHERE b.id_agenda = ANY($1)", [[...agendaDe.values()]])).rows
      .map((r) => [`${agendaProf.get(r.id_agenda)}|${r.f}|${r.h}`, r.id_bloque]));
    const bloquePorMem = new Map(bloques.map((b) => [b.id, idBloque.get(`${b.idProfesional}|${b.fecha}|${b.hora}`)]));
    const sedeDeProf = new Map(mem.profesionales.map((p) => [p.id, p.idPoliclinico]));
    const bloqueMem = new Map(bloques.map((b) => [b.id, b]));

    const ORIGEN = { WHATSAPP: "PACIENTE_WSP", ASISTIDA: "ASISTIDA", INSTITUCIONAL: "INSTITUCIONAL" };
    const filas = [], memDeFila = [];
    for (const c of citasMem) {
      const idB = bloquePorMem.get(c.idBloque), idP = idPaciente.get(c.rut), b = bloqueMem.get(c.idBloque);
      if (!idB || !idP) continue;
      const cancelada = c.estadoReserva === "CANCELADA";
      const yaPaso = b.fecha === hoy() && b.hora < new Date().toTimeString().slice(0, 5);
      const asistencia = c.asistencia || (!cancelada && yaPaso && c.id % 6 !== 0 ? (c.id % 7 === 0 ? "NO_ASISTIO" : "ASISTIO") : null);
      const estado = cancelada ? "CANCELADA" : asistencia || "RESERVADA";
      const presencial = c.id % 5 === 0;
      const creada = `${sumarDias(b.fecha, -3)} 10:00`;
      filas.push([idP, idB, presencial ? "PRESENCIAL" : "WEB", telDe.get(c.rut), estado, c.estadoConfirmacion,
        cancelada ? ORIGEN[c.origenCancelacion] || "PACIENTE_WSP" : null, cancelada ? `${sumarDias(b.fecha, -1)} 12:00` : null,
        presencial ? usuarioDeSede.get(sedeDeProf.get(b.idProfesional)) || ADMIN : null, creada, c.idProfesionalReemplazo || null]);
      memDeFila.push(c);
    }
    await insertar(cli, "cita", ["id_paciente", "id_bloque", "canal_reserva", "telefono_contacto", "estado_reserva", "estado_confirmacion", "origen_cancelacion", "cancelada_en", "creada_por", "creada_en", "id_profesional_reemplazo"], filas);
    const pgCita = new Map((await cli.query("SELECT id_cita, id_bloque FROM cita WHERE estado_reserva <> 'CANCELADA' AND id_paciente = ANY($1)", [[...idPaciente.values()]])).rows.map((r) => [String(r.id_bloque), r.id_cita]));

    const espera = [];
    for (const [i, e] of mem.espera.filter((x) => idPaciente.has(x.rut)).entries()) {
      const esp = (await cli.query("SELECT id_especialidad FROM especialidad WHERE nombre = $1", [e.especialidad])).rows[0];
      if (esp) espera.push([idPaciente.get(e.rut), e.idPoliclinico, esp.id_especialidad, `${e.registradaEn} 09:00`, "EN_ESPERA", usuarioDeSede.get(e.idPoliclinico) || ADMIN, 1 + (i % 4)]);
    }
    await insertar(cli, "solicitud_espera", ["id_paciente", "id_policlinico", "id_especialidad", "ingresada_en", "estado", "registrado_por", "prioridad"], espera, "ON CONFLICT DO NOTHING");

    if (extras) {
      const cita = (c) => pgCita.get(String(bloquePorMem.get(c.idBloque)));
      const hoyTxt = hoy();
      const asistidas = citasMem.filter((c) => c.asistencia === "ASISTIO" && cita(c));
      const nota = (i, pesos) => { let x = (i * 37) % 100; for (const [v, p] of pesos) { if (x < p) return v; x -= p; } return pesos[0][0]; };
      let n1 = 1, n2 = 1;
      extras.encuestas.push(...asistidas.filter((_, i) => i % 3 === 0).map((c, i) => ({ id: n1++, idCita: cita(c), nota: nota(i, [[5, 55], [4, 28], [3, 10], [2, 5], [1, 2]]), comentario: "", fecha: `${bloqueMem.get(c.idBloque).fecha} 18:00`, demo: true })));
      extras.encuestasAgendamiento.push(...citasMem.filter((c) => c.estadoReserva === "ACTIVA" && cita(c) && c.id % 4 === 0).map((c, i) => ({ id: n2++, idCita: cita(c), canal: "WEB", nota: nota(i + 3, [[5, 62], [4, 24], [3, 8], [2, 4], [1, 2]]), comentario: "", fecha: `${sumarDias(bloqueMem.get(c.idBloque).fecha, -3)} 10:30`, demo: true })));
      const ACCIONES = [["Inicio de sesión", ""], ["Cupos liberados", "Rango de 7 días"], ["Reserva asistida", "Reserva creada en mesón"], ["Cancelación asistida", "Solicitada por el paciente"], ["Asistencia registrada", ""], ["Cambio de agenda (AUSENCIA)", "Licencia médica"], ["Reporte descargado", "Formato PDF"], ["Documento verificado", "Orden médica"], ["Contacto de lista de espera registrado", "Hora ofrecida"], ["Cupos bloqueados", "Capacitación institucional"]];
      const usuarios = (await cli.query("SELECT id_usuario, nombres || ' ' || apellidos AS nombre, id_policlinico::int AS sede FROM usuario ORDER BY creado_en")).rows;
      let id = (extras.auditoria.at(-1)?.id || 0) + 1;
      for (let i = 0; i < 60; i++) {
        const u = usuarios[(i * 5) % usuarios.length], [accion, detalle] = ACCIONES[(i * 7) % ACCIONES.length];
        extras.auditoria.push({ id: id++, fecha: `${sumarDias(hoyTxt, -(1 + (i * 3) % 30))} ${pad(8 + (i * 5) % 10)}:${pad((i * 13) % 60)}`, usuario: u.nombre, accion, detalle, idUsuario: u.id_usuario, idPoliclinico: u.sede, demo: true });
      }
      extras.auditoria.sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((x, i) => { x.id = i + 1; });
    }
    await cli.query("COMMIT");
    if (extras) guardarExtras(extras);
    console.log(`Datos de demostración cargados: ${pacientes.length} pacientes, ${bloques.length} bloques, ${filas.length} citas${extras ? `, ${extras.encuestas.length + extras.encuestasAgendamiento.length} encuestas, auditoría` : " (extras.json no encontrado: sin encuestas ni auditoría)"}.`);
    console.log("Reinicia el servidor para verlos. Para quitarlos: npm run datos:demo -- quitar");
  } catch (e) {
    await cli.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cli.release();
    await pool.end();
  }
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });

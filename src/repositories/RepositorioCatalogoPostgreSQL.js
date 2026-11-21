"use strict";
const { traducir } = require("./pgErrores");

const USUARIO = `SELECT u.id_usuario::text AS id, u.nombres || ' ' || u.apellidos AS nombre, u.correo, r.codigo AS rol,
  u.id_policlinico::int AS "idPoliclinico", u.activo FROM usuario u JOIN rol r ON r.id_rol = u.id_rol`;
const PACIENTE = `SELECT p.numero_documento AS rut, p.nombres || ' ' || p.apellidos AS nombre, p.nombres, p.apellidos,
  p.telefono_celular AS telefono, p.tiene_whatsapp AS "tieneWhatsapp", COALESCE(p.correo, '') AS correo,
  to_char(p.fecha_nacimiento, 'YYYY-MM-DD') AS "fechaNacimiento", p.genero, p.nacionalidad, p.direccion, p.id_comuna::int AS "idComuna",
  r.nombre AS "respNombre", r.relacion AS "respRelacion", r.rut AS "respRut", r.telefono AS "respTelefono"
  FROM paciente p LEFT JOIN LATERAL (
    SELECT trim(re.nombres || ' ' || re.apellidos) AS nombre, pr.relacion, re.rut, re.telefono
    FROM paciente_responsable pr JOIN responsable re ON re.id_responsable = pr.id_responsable
    WHERE pr.id_paciente = p.id_paciente AND pr.vigente ORDER BY pr.id_responsable DESC LIMIT 1) r ON TRUE
  WHERE p.tipo_documento = 'RUT'`;
const aPaciente = ({
  respNombre,
  respRelacion,
  respRut,
  respTelefono,
  ...p
}) => ({
  ...p,
  responsable: respNombre
    ? {
        nombre: respNombre,
        relacion: respRelacion,
        rut: respRut,
        telefono: respTelefono,
      }
    : null,
});
async function guardarResponsable(q, idPaciente, r) {
  await q(
    "UPDATE paciente_responsable SET vigente = FALSE WHERE id_paciente = $1::bigint AND vigente RETURNING id_paciente",
    [idPaciente],
  );
  if (!r) return;
  const [nombres, ...resto] = r.nombre.split(" ");
  const [fila] = await q(
    `INSERT INTO responsable (rut, nombres, apellidos, telefono) VALUES ($1, $2, $3, $4)
     ON CONFLICT (rut) DO UPDATE SET nombres = EXCLUDED.nombres, apellidos = EXCLUDED.apellidos, telefono = EXCLUDED.telefono
     RETURNING id_responsable::int AS id`,
    [r.rut, nombres, resto.join(" "), r.telefono],
  );
  await q(
    `INSERT INTO paciente_responsable (id_paciente, id_responsable, relacion, es_representante) VALUES ($1::bigint, $2::bigint, $3, TRUE)
     ON CONFLICT (id_paciente, id_responsable) DO UPDATE SET relacion = EXCLUDED.relacion, vigente = TRUE RETURNING id_paciente`,
    [idPaciente, fila.id, r.relacion],
  );
}
const BLOQUE = `SELECT b.id_bloque::int AS id, a.id_profesional::int AS "idProfesional", to_char(b.fecha, 'YYYY-MM-DD') AS fecha,
  to_char(b.hora_inicio, 'HH24:MI') AS hora, a.id_policlinico::int AS "idPoliclinico", a.duracion_min::int AS duracion, e.nombre AS especialidad,
  (b.estado IN ('DISPONIBLE', 'RESERVADO')) AS publicado, (b.estado = 'BLOQUEADO') AS bloqueado
  FROM bloque_horario b JOIN agenda a ON a.id_agenda = b.id_agenda JOIN especialidad e ON e.id_especialidad=a.id_especialidad`;
const PROFESIONAL = `SELECT pr.id_profesional::int AS id, pr.nombres || ' ' || pr.apellidos AS nombre, min(e.nombre) AS especialidad,
  min(a.id_policlinico)::int AS "idPoliclinico", pr.activo AS activo
  FROM profesional pr JOIN profesional_asignacion a ON a.id_profesional = pr.id_profesional
  JOIN especialidad e ON e.id_especialidad = a.id_especialidad`;
const ESPERA = `SELECT s.id_solicitud::int AS id, p.numero_documento AS rut, s.id_policlinico::int AS "idPoliclinico",
  e.nombre AS especialidad, to_char(s.ingresada_en, 'YYYY-MM-DD') AS "registradaEn", s.estado
  FROM solicitud_espera s JOIN paciente p ON p.id_paciente = s.id_paciente JOIN especialidad e ON e.id_especialidad = s.id_especialidad`;

const RESULTADO_A_BD = {
  Confirmó: "CONFIRMA",
  Canceló: "CANCELA",
  "No contestó": "NO_CONTESTA",
};

class RepositorioCatalogoPostgreSQL {
  constructor(db) {
    this.db = db;
  }
  policlinicos() {
    return this.db
      .query(`SELECT p.id_policlinico::int AS id, p.nombre, COALESCE(c.nombre, 'Modalidad remota') AS comuna, p.es_telemedicina AS telemedicina
      FROM policlinico p LEFT JOIN comuna c ON c.id_comuna = p.id_comuna ORDER BY p.id_policlinico`);
  }
  async policlinico(id) {
    return (await this.policlinicos()).find((p) => p.id === Number(id)) || null;
  }
  async comunas() {
    const filas = await this.db.query("SELECT id_comuna::int AS id, nombre FROM comuna");
    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  async especialidades() {
    return (
      await this.db.query(
        "SELECT nombre FROM especialidad WHERE activo ORDER BY nombre",
      )
    ).map((r) => r.nombre);
  }
  profesionales() {
    return this.db.query(
      `${PROFESIONAL} GROUP BY pr.id_profesional ORDER BY pr.id_profesional`,
    );
  }
  async profesional(id) {
    return (
      (
        await this.db.query(
          `${PROFESIONAL} WHERE pr.id_profesional = $1 GROUP BY pr.id_profesional`,
          [Number(id)],
        )
      )[0] || null
    );
  }
  async setProfesionalActivo(id, activo) {
    const r = await this.db.query(
      "UPDATE profesional SET activo = $2::boolean WHERE id_profesional = $1 RETURNING id_profesional",
      [Number(id), !!activo],
    );
    if (!r.length) throw new Error("PROFESIONAL_NO_ENCONTRADO");
  }
  async pacientes() {
    return (await this.db.query(`${PACIENTE} ORDER BY p.id_paciente`)).map(
      aPaciente,
    );
  }
  async paciente(rut) {
    const f = (
      await this.db.query(`${PACIENTE} AND p.numero_documento = $1`, [rut])
    )[0];
    return f ? aPaciente(f) : null;
  }
  async crearPaciente(p) {
    try {
      await this.db.tx(async (q) => {
        const [fila] = await q(
          `INSERT INTO paciente (tipo_documento, numero_documento, nombres, apellidos, fecha_nacimiento, genero, nacionalidad,
             telefono_celular, tiene_whatsapp, correo, direccion, id_comuna)
           VALUES ('RUT', $1, $2, $3, $4::date, $5, $6, $7, $8::boolean, $9, $10, $11::smallint) RETURNING id_paciente::int AS id`,
          [
            p.rut,
            p.nombres,
            p.apellidos,
            p.fechaNacimiento,
            p.genero,
            p.nacionalidad,
            p.telefono,
            !!p.tieneWhatsapp,
            p.correo || null,
            p.direccion,
            Number(p.idComuna),
          ],
        );
        const canal = p.idUsuario ? p.canalConsentimiento || "PRESENCIAL" : "WEB";
        await q(
          `INSERT INTO consentimiento (id_paciente, version_texto, canal, registrado_por) VALUES ($1::bigint, 'v1', $2, $3::uuid)`,
          [fila.id, canal, p.idUsuario || null],
        );
        await guardarResponsable(q, fila.id, p.responsable);
      });
    } catch (e) {
      throw traducir(e, [[/uq_paciente/, "PACIENTE_EXISTE"]]);
    }
  }
  async actualizarPaciente(rut, p) {
    await this.db.tx(async (q) => {
      const [fila] = await q(
        `UPDATE paciente SET nombres = $2, apellidos = $3, fecha_nacimiento = $4::date, genero = $5, nacionalidad = $6, telefono_celular = $7,
           tiene_whatsapp = $8::boolean, correo = $9, direccion = $10, id_comuna = $11::smallint, actualizado_en = now()
         WHERE tipo_documento = 'RUT' AND numero_documento = $1 RETURNING id_paciente::int AS id`,
        [
          rut,
          p.nombres,
          p.apellidos,
          p.fechaNacimiento,
          p.genero,
          p.nacionalidad,
          p.telefono,
          !!p.tieneWhatsapp,
          p.correo || null,
          p.direccion,
          Number(p.idComuna),
        ],
      );
      if (!fila) throw new Error("PACIENTE_NO_ENCONTRADO");
      await guardarResponsable(q, fila.id, p.responsable);
    });
  }
  bloques() {
    return this.db.query(
      `${BLOQUE} ORDER BY b.fecha, b.hora_inicio, b.id_bloque`,
    );
  }
  async bloque(id) {
    return (
      (
        await this.db.query(`${BLOQUE} WHERE b.id_bloque = $1`, [Number(id)])
      )[0] || null
    );
  }
  async crearBloque({
    idProfesional,
    fecha,
    hora,
    publicado,
    idPoliclinico,
    especialidad,
    duracion,
    idUsuario,
  }) {
    if (idPoliclinico && duracion && idUsuario) {
      const [agenda] = await this.db.query(
        `INSERT INTO agenda(id_profesional,id_policlinico,id_especialidad,vigente_desde,vigente_hasta,hora_inicio,hora_termino,duracion_min,estado_publicacion,creado_por)
        SELECT $1,$2,e.id_especialidad,$3::date,$3::date,$4::time,$4::time+make_interval(mins=>$5::int),$5,'PUBLICADA',$6::uuid FROM especialidad e WHERE e.nombre=$7 RETURNING id_agenda AS id`,
        [
          Number(idProfesional),
          Number(idPoliclinico),
          fecha,
          hora,
          duracion,
          idUsuario,
          especialidad,
        ],
      );
      const [b] = await this.db.query(
        `INSERT INTO bloque_horario(id_agenda,fecha,hora_inicio,hora_termino,estado) VALUES($1,$2::date,$3::time,$3::time+make_interval(mins=>$4::int),$5) RETURNING id_bloque::int AS id`,
        [
          agenda.id,
          fecha,
          hora,
          duracion,
          publicado ? "DISPONIBLE" : "NO_PUBLICADO",
        ],
      );
      return this.bloque(b.id);
    }
    let r;
    try {
      r = await this.db.query(
        `INSERT INTO bloque_horario (id_agenda, fecha, hora_inicio, hora_termino, estado)
         SELECT a.id_agenda, $2::date, $3::time, $3::time + make_interval(mins => a.duracion_min::int),
                CASE WHEN $4::boolean THEN 'DISPONIBLE' ELSE 'NO_PUBLICADO' END
         FROM agenda a WHERE a.id_profesional = $1 AND $2::date BETWEEN a.vigente_desde AND a.vigente_hasta AND a.estado_publicacion <> 'OCULTA'
         ORDER BY a.id_agenda LIMIT 1 RETURNING id_bloque::int AS id`,
        [Number(idProfesional), fecha, hora, !!publicado],
      );
    } catch (e) {
      throw traducir(e, [[/uq_bloque_horario/, "BLOQUE_DUPLICADO"]]);
    }
    if (!r.length) throw new Error("SIN_AGENDA");
    return this.bloque(r[0].id);
  }
  async cambiarPublicacion({
    idProfesional,
    desde,
    hasta,
    idBloque,
    publicar,
  }) {
    const r = await this.db.query(
      `UPDATE bloque_horario bh SET estado = $5 FROM agenda a
       WHERE a.id_agenda = bh.id_agenda AND a.id_profesional = $1 AND bh.fecha BETWEEN $2::date AND $3::date
         AND ($4::bigint IS NULL OR bh.id_bloque = $4::bigint) AND bh.estado = $6 RETURNING bh.id_bloque`,
      [
        Number(idProfesional),
        desde,
        hasta,
        idBloque ? Number(idBloque) : null,
        publicar ? "DISPONIBLE" : "NO_PUBLICADO",
        publicar ? "NO_PUBLICADO" : "DISPONIBLE",
      ],
    );
    return r.length;
  }
  async bloquearLibres({ idProfesional, fecha, motivo, idUsuario }) {
    return this.db.tx(async (q) => {
      const [b] = await q(
        `INSERT INTO bloqueo (id_profesional, inicio, termino, motivo, creado_por)
         VALUES ($1::bigint, $2::date, $2::date + 1, $3, $4::uuid) RETURNING id_bloqueo::bigint AS id`,
        [Number(idProfesional), fecha, motivo, idUsuario],
      );
      const r = await q(
        `UPDATE bloque_horario bh SET estado = 'BLOQUEADO', id_bloqueo = $3::bigint
         FROM agenda a WHERE a.id_agenda = bh.id_agenda AND a.id_profesional = $1 AND bh.fecha = $2::date
           AND bh.estado IN ('DISPONIBLE', 'NO_PUBLICADO') RETURNING bh.id_bloque`,
        [Number(idProfesional), fecha, b.id],
      );
      return r.length;
    });
  }
  espera() {
    return this.db.query(
      `${ESPERA} ORDER BY s.prioridad, s.ingresada_en, s.id_solicitud`,
    );
  }
  async agregarEspera({ rut, idPoliclinico, especialidad, idUsuario }) {
    let r;
    try {
      r = await this.db.query(
        `INSERT INTO solicitud_espera (id_paciente, id_policlinico, id_especialidad, registrado_por)
         SELECT p.id_paciente, $2::smallint, e.id_especialidad, $4::uuid FROM paciente p, especialidad e
         WHERE p.numero_documento = $1 AND e.nombre = $3 RETURNING id_solicitud::int AS id`,
        [rut, Number(idPoliclinico), especialidad, idUsuario],
      );
    } catch (e) {
      throw traducir(e, [
        [/ux_espera_activa/, "YA_EN_ESPERA"],
        [
          /fk_solicitud_espera_policlinico_especialidad|23503/,
          "ESPECIALIDAD_NO_EN_SEDE",
        ],
      ]);
    }
    if (!r.length) throw new Error("ESPECIALIDAD_INVALIDA");
    return { id: r[0].id };
  }
  async actualizarEspera(id, estado) {
    const r = await this.db.query(
      "UPDATE solicitud_espera SET estado = $2 WHERE id_solicitud = $1 RETURNING id_solicitud",
      [Number(id), estado],
    );
    if (!r.length) throw new Error("ESPERA_NO_ENCONTRADA");
  }
  contactos() {
    return this.db
      .query(`SELECT to_char(c.realizado_en, 'YYYY-MM-DD HH24:MI') AS fecha, c.id_cita::int AS "idCita", initcap(lower(c.canal)) AS canal,
      CASE c.resultado WHEN 'CONFIRMA' THEN 'Confirmó' WHEN 'CANCELA' THEN 'Canceló' WHEN 'NO_CONTESTA' THEN 'No contestó' ELSE c.resultado END AS resultado,
      u.nombres || ' ' || u.apellidos AS responsable
      FROM contacto_seguimiento c JOIN usuario u ON u.id_usuario = c.id_usuario ORDER BY c.id_contacto DESC`);
  }
  async agregarContacto({ idCita, canal, resultado, idUsuario }) {
    await this.db.query(
      `INSERT INTO contacto_seguimiento (id_cita, id_usuario, canal, motivo, resultado) VALUES ($1::bigint, $2::uuid, $3, 'CONFIRMACION', $4)`,
      [
        Number(idCita),
        idUsuario,
        String(canal).toUpperCase(),
        RESULTADO_A_BD[resultado] || resultado,
      ],
    );
  }
  usuarios() {
    return this.db.query(`${USUARIO} ORDER BY u.creado_en, u.correo`);
  }
  async usuarioPorCorreo(correo) {
    return (
      (
        await this.db.query(`${USUARIO} WHERE lower(u.correo) = lower($1)`, [
          correo,
        ])
      )[0] || null
    );
  }
  async credencial(idUsuario) {
    const filas = await this.db.query(
      "SELECT hash FROM credencial WHERE id_usuario = $1::uuid",
      [idUsuario],
    );
    return filas[0] ? filas[0].hash : null;
  }
  async guardarCredencial(idUsuario, hash) {
    await this.db.query(
      `INSERT INTO credencial (id_usuario, hash) VALUES ($1::uuid, $2)
       ON CONFLICT (id_usuario) DO UPDATE SET hash = EXCLUDED.hash, actualizada_en = now()`,
      [idUsuario, hash],
    );
  }
}
Object.assign(RepositorioCatalogoPostgreSQL.prototype, require("./eliminacionesPg"));
module.exports = { RepositorioCatalogoPostgreSQL };

'use strict';
const { ICitaRepository } = require('./ICitaRepository');
const { traducir } = require('./pgErrores');

// Misma forma de objeto que la versión en memoria. Los estados de la base (RESERVADA/ASISTIO/NO_ASISTIO/CANCELADA)
// se traducen a estadoReserva ACTIVA|CANCELADA + asistencia.
const SELECT = `
SELECT c.id_cita::int AS id, p.numero_documento AS rut, c.id_bloque::int AS "idBloque",
  CASE WHEN c.estado_reserva = 'CANCELADA' THEN 'CANCELADA' ELSE 'ACTIVA' END AS "estadoReserva",
  c.estado_confirmacion AS "estadoConfirmacion",
  CASE c.estado_reserva WHEN 'ASISTIO' THEN 'ASISTIO' WHEN 'NO_ASISTIO' THEN 'NO_ASISTIO' ELSE NULL END AS asistencia,
  CASE c.origen_cancelacion WHEN 'PACIENTE_WSP' THEN 'WHATSAPP' ELSE c.origen_cancelacion END AS "origenCancelacion",
  c.id_profesional_reemplazo::int AS "idProfesionalReemplazo"
FROM cita c JOIN paciente p ON p.id_paciente = c.id_paciente`;

class CitaRepositoryPg extends ICitaRepository {
  constructor(db) { super(); this.db = db; }
  listar() { return this.db.query(`${SELECT} ORDER BY c.id_cita`); }
  async buscarPorId(id) { return (await this.db.query(`${SELECT} WHERE c.id_cita = $1`, [Number(id)]))[0] || null; }
  buscarPorRut(rut) { return this.db.query(`${SELECT} WHERE p.numero_documento = $1 ORDER BY c.id_cita`, [rut]); }
  async buscarActivaPorBloque(idBloque) {
    return (await this.db.query(`${SELECT} WHERE c.id_bloque = $1 AND c.estado_reserva <> 'CANCELADA'`, [Number(idBloque)]))[0] || null;
  }
  async crear({ rut, idBloque, idUsuario, canal = 'PRESENCIAL' }) {
    let fila;
    try {
      fila = (await this.db.query(
        `INSERT INTO cita (id_paciente, id_bloque, canal_reserva, telefono_contacto, correo_contacto, creada_por)
         SELECT id_paciente, $2, $4, telefono_celular, correo, $3::uuid
         FROM paciente WHERE numero_documento = $1 AND tipo_documento = 'RUT'
         RETURNING id_cita::int AS id`, [rut, Number(idBloque), idUsuario || null, canal]))[0];
    } catch (e) {
      // El disparador de la base y el índice único impiden dos citas en el mismo cupo (RNF04).
      throw traducir(e, [[/DISPONIBLE|ux_cita_bloque_activa/, 'BLOQUE_OCUPADO']]);
    }
    if (!fila) throw new Error('PACIENTE_NO_ENCONTRADO');
    return this.buscarPorId(fila.id);
  }
  async actualizar(c) {
    const estado = c.estadoReserva === 'CANCELADA' ? 'CANCELADA' : (c.asistencia || 'RESERVADA');
    const origen = c.estadoReserva === 'CANCELADA' ? (c.origenCancelacion === 'WHATSAPP' ? 'PACIENTE_WSP' : c.origenCancelacion) : null;
    const r = await this.db.query(
      `UPDATE cita SET estado_reserva = $2::varchar, estado_confirmacion = $3::varchar, origen_cancelacion = $4::varchar,
         cancelada_en = CASE WHEN $4::varchar IS NULL THEN NULL ELSE COALESCE(cancelada_en, now()) END,
         id_profesional_reemplazo = $5::bigint, actualizada_en = now()
       WHERE id_cita = $1 RETURNING id_cita`, [c.id, estado, c.estadoConfirmacion, origen, c.idProfesionalReemplazo ?? null]);
    if (!r.length) throw new Error('CITA_NO_ENCONTRADA');
    return this.buscarPorId(c.id);
  }
}
module.exports = { CitaRepositoryPg };

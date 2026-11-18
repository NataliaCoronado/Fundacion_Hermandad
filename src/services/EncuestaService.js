'use strict';
const { normalizarRut } = require('../util/rut');
const { textoLocal } = require('../util/tiempo');

// CU-07 / RF30: la encuesta de atención solo se responde si hubo asistencia registrada (igual que el disparador de la base).
class EncuestaService {
  constructor({ citaRepo, extras }) { Object.assign(this, { citaRepo, extras }); }

  async registrar({ rut, nota, comentario }) {
    rut = normalizarRut(rut);
    const n = Number(nota);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error('NOTA_INVALIDA');
    const respondidas = new Set(this.extras.listar('encuestas').map((e) => e.idCita));
    const citas = (await this.citaRepo.buscarPorRut(rut)).filter((c) => c.asistencia === 'ASISTIO');
    if (!citas.length) throw new Error('SIN_ATENCION');          // misma respuesta si el RUT no existe
    const cita = citas.find((c) => !respondidas.has(c.id));
    if (!cita) throw new Error('YA_RESPONDIDA');
    return this.extras.agregar('encuestas', { idCita: cita.id, nota: n, comentario: String(comentario || '').trim().slice(0, 300), fecha: textoLocal() });
  }

  resumen() {
    const l = this.extras.listar('encuestas');
    return { respuestas: l.length, promedio: l.length ? Math.round((l.reduce((s, e) => s + e.nota, 0) / l.length) * 10) / 10 : null };
  }
}
module.exports = { EncuestaService };

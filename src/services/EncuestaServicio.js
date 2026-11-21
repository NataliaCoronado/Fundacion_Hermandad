'use strict';
const { normalizarRut } = require('../herramientas/rut');
const { textoLocal } = require('../herramientas/tiempo');

class EncuestaServicio {
  constructor({ citaRepo, extras }) {
    Object.assign(this, { citaRepo, extras });
    this.extras.extras.encuestasAgendamiento ||= [];
  }

  async registrarAgendamiento({ idCita, nota, comentario, canal = 'WEB' }) {
    const notaNumerica = Number(nota);
    if (!Number.isInteger(notaNumerica) || notaNumerica < 1 || notaNumerica > 5) throw new Error('NOTA_INVALIDA');
    const cita = await this.citaRepo.buscarPorId(idCita);
    if (!cita) throw new Error('CITA_NO_ENCONTRADA');
    if (this.extras.listar('encuestasAgendamiento').some((e) => e.idCita === cita.id)) throw new Error('YA_RESPONDIDA_AGENDAMIENTO');
    return this.extras.agregar('encuestasAgendamiento', { idCita: cita.id, canal, nota: notaNumerica, comentario: String(comentario || '').trim().slice(0, 300), fecha: textoLocal() });
  }

  resumenAgendamiento() {
    const encuestasAgendamiento = this.extras.listar('encuestasAgendamiento');
    return { respuestas: encuestasAgendamiento.length, promedio: encuestasAgendamiento.length ? Math.round((encuestasAgendamiento.reduce((s, e) => s + e.nota, 0) / encuestasAgendamiento.length) * 10) / 10 : null };
  }

  async registrar({ rut, nota, comentario }, idCita) {
    rut = normalizarRut(rut);
    const notaNumerica = Number(nota);
    if (!Number.isInteger(notaNumerica) || notaNumerica < 1 || notaNumerica > 5) throw new Error('NOTA_INVALIDA');
    const respondidas = new Set(this.extras.listar('encuestas').map((e) => e.idCita));
    const citas = (await this.citaRepo.buscarPorRut(rut)).filter((c) => c.asistencia === 'ASISTIO' && (idCita == null || c.id === idCita));
    if (!citas.length) throw new Error('SIN_ATENCION');
    const cita = citas.find((c) => !respondidas.has(c.id));
    if (!cita) throw new Error('YA_RESPONDIDA');
    return this.extras.agregar('encuestas', { idCita: cita.id, nota: notaNumerica, comentario: String(comentario || '').trim().slice(0, 300), fecha: textoLocal() });
  }

  resumen() {
    const encuestas = this.extras.listar('encuestas');
    return { respuestas: encuestas.length, promedio: encuestas.length ? Math.round((encuestas.reduce((s, e) => s + e.nota, 0) / encuestas.length) * 10) / 10 : null };
  }
}
module.exports = { EncuestaServicio };

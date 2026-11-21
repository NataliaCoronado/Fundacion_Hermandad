'use strict';
const { textoLocal } = require('../herramientas/tiempo');

class ConfirmacionServicio {
  constructor(citaRepo, catalogo, agendamiento) { this.citaRepo = citaRepo; this.catalogo = catalogo; this.agendamiento = agendamiento; }

  async pendientes() {
    return (await this.citaRepo.listar()).filter((c) => c.estadoReserva === 'ACTIVA' && c.estadoConfirmacion !== 'CONFIRMADA');
  }

  async registrarContacto({ idCita, canal = 'Llamada', resultado, responsable, idUsuario }) {
    const cita = await this.citaRepo.buscarPorId(idCita);
    if (!cita) throw new Error('CITA_NO_ENCONTRADA');
    if (cita.estadoReserva !== 'ACTIVA') throw new Error('CITA_NO_ACTIVA');
    if (!['Confirmó', 'Canceló', 'No contestó'].includes(resultado)) throw new Error('RESULTADO_INVALIDO');
    await this.catalogo.agregarContacto({ idCita: cita.id, canal, resultado, responsable, idUsuario, fecha: textoLocal() });
    if (resultado === 'Confirmó') await this.citaRepo.actualizar({ ...cita, estadoConfirmacion: 'CONFIRMADA' });
    if (resultado === 'Canceló') await this.agendamiento.cancelar(cita.id, 'ASISTIDA');
  }
}
module.exports = { ConfirmacionServicio };

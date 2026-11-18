'use strict';
const { textoLocal } = require('../util/tiempo');

// Confirmación separada de la reserva (RF09, RF10, RF27). El silencio NO cancela ni confirma.
class ConfirmacionService {
  constructor(citaRepo, catalogo, agendamiento) { this.citaRepo = citaRepo; this.catalogo = catalogo; this.agendamiento = agendamiento; }

  // Citas activas que aún no confirmó el paciente: incluye las que no respondieron al bot y requieren llamada.
  async pendientes() {
    return (await this.citaRepo.listar()).filter((c) => c.estadoReserva === 'ACTIVA' && c.estadoConfirmacion !== 'CONFIRMADA');
  }

  /** TENS/TONS registra el resultado de una llamada o mensaje. */
  async registrarContacto({ idCita, canal = 'Llamada', resultado, responsable, idUsuario }) {
    const cita = await this.citaRepo.buscarPorId(idCita);
    if (!cita) throw new Error('CITA_NO_ENCONTRADA');
    if (cita.estadoReserva !== 'ACTIVA') throw new Error('CITA_NO_ACTIVA');
    if (!['Confirmó', 'Canceló', 'No contestó'].includes(resultado)) throw new Error('RESULTADO_INVALIDO');
    await this.catalogo.agregarContacto({ idCita: cita.id, canal, resultado, responsable, idUsuario, fecha: textoLocal() });
    if (resultado === 'Confirmó') await this.citaRepo.actualizar({ ...cita, estadoConfirmacion: 'CONFIRMADA' });
    if (resultado === 'Canceló') await this.agendamiento.cancelar(cita.id, 'ASISTIDA');
    // 'No contestó': la reserva sigue activa y la confirmación no cambia.
  }
}
module.exports = { ConfirmacionService };

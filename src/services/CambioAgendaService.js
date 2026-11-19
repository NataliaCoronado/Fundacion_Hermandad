'use strict';
const { textoLocal } = require('../util/tiempo');

class CambioAgendaService {
  constructor({ citaRepo, catalogo, extras }) { Object.assign(this, { citaRepo, catalogo, extras }); }

  async citasDelDia(idProfesional, fecha) {
    const ids = new Set((await this.catalogo.bloques()).filter((b) => b.idProfesional === Number(idProfesional) && b.fecha === fecha).map((b) => b.id));
    return (await this.citaRepo.listar()).filter((c) => c.estadoReserva === 'ACTIVA' && ids.has(c.idBloque));
  }

  validar({ idProfesional, fecha, motivo }) {
    if (!idProfesional || !fecha) throw new Error('DATOS_INCOMPLETOS');
    if (!(motivo || '').trim()) throw new Error('MOTIVO_REQUERIDO');
  }

  async ausencia({ idProfesional, fecha, motivo, idUsuario }) {
    this.validar({ idProfesional, fecha, motivo });
    const prof = await this.catalogo.profesional(idProfesional);
    if (!prof) throw new Error('PROFESIONAL_NO_ENCONTRADO');
    const afectadas = await this.citasDelDia(idProfesional, fecha);
    const cerrados = await this.catalogo.bloquearLibres({ idProfesional, fecha, motivo: motivo.trim(), idUsuario });
    for (const c of afectadas) await this.citaRepo.actualizar({ ...c, estadoConfirmacion: 'PENDIENTE' });
    await this.aviso(prof, fecha, `Ausencia de ${prof.nombre} el ${fecha}: ${afectadas.length} cita(s) afectada(s). Llamar a los pacientes.`);
    return this.registrar('AUSENCIA', prof, null, fecha, motivo, afectadas.length, cerrados);
  }

  async reemplazo({ idProfesional, idReemplazo, fecha, motivo, idUsuario }) {
    this.validar({ idProfesional, fecha, motivo });
    const prof = await this.catalogo.profesional(idProfesional);
    const rem = await this.catalogo.profesional(idReemplazo);
    if (!prof || !rem) throw new Error('PROFESIONAL_NO_ENCONTRADO');
    if (prof.id === rem.id) throw new Error('REEMPLAZO_IGUAL');
    if (!rem.activo || rem.especialidad !== prof.especialidad || rem.idPoliclinico !== prof.idPoliclinico) throw new Error('REEMPLAZO_NO_COMPATIBLE');
    const afectadas = await this.citasDelDia(idProfesional, fecha);
    for (const c of afectadas) await this.citaRepo.actualizar({ ...c, idProfesionalReemplazo: rem.id });
    await this.aviso(prof, fecha, `Cambio de profesional el ${fecha}: ${prof.nombre} es reemplazado por ${rem.nombre}. Avisar a ${afectadas.length} paciente(s).`);
    return this.registrar('REEMPLAZO', prof, rem, fecha, motivo, afectadas.length, 0, idUsuario);
  }

  aviso(prof, fecha, texto) {
    return this.extras.agregar('notificaciones', { tipo: 'CAMBIO_AGENDA', fecha: textoLocal(), idPoliclinico: prof.idPoliclinico, leida: false, texto });
  }
  registrar(tipo, prof, rem, fecha, motivo, citasAfectadas, bloquesCerrados) {
    return this.extras.agregar('cambios', { tipo, fechaRegistro: textoLocal(), fecha, idProfesional: prof.id, idReemplazo: rem ? rem.id : null, motivo: motivo.trim(), citasAfectadas, bloquesCerrados });
  }
  listar() { return [...this.extras.listar('cambios')].reverse(); }
}
module.exports = { CambioAgendaService };

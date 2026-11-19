"use strict";
const { textoLocal } = require("../util/tiempo");
const { origen: origenActual, actual } = require("../util/contextoSolicitud");

// Envuelve el repositorio de citas: cada alta o cambio de estado deja una fila en el historial de la cita
// (tabla cita_historial con PostgreSQL), sin que cada servicio tenga que acordarse de registrarlo.
const estadoAdministrativo = (c) => (c.estadoReserva === "CANCELADA" ? "CANCELADA" : c.asistencia || "RESERVADA");

class CitaRepositoryConHistorial {
  constructor(interno, extras) {
    this.interno = interno;
    this.extras = extras;
  }
  listar() { return this.interno.listar(); }
  buscarPorId(id) { return this.interno.buscarPorId(id); }
  buscarPorRut(rut) { return this.interno.buscarPorRut(rut); }
  buscarActivaPorBloque(id) { return this.interno.buscarActivaPorBloque(id); }

  registrar(idCita, operacion, estadoAnterior, estadoNuevo, origen, detalle = "") {
    const usuario = actual()?.usuario;
    return this.extras.agregar("historial", {
      idCita, operacion, estadoAnterior: estadoAnterior || null, estadoNuevo: estadoNuevo || null,
      origen, idUsuario: usuario?.id || null, fecha: textoLocal(), detalle,
    });
  }

  async crear(datos) {
    const cita = await this.interno.crear(datos);
    this.registrar(cita.id, "RESERVA", null, "RESERVADA", datos.canal === "WEB" ? "PACIENTE" : origenActual());
    return cita;
  }

  async actualizar(c) {
    const antes = await this.interno.buscarPorId(c.id);
    const despues = await this.interno.actualizar(c);
    if (!antes) return despues;
    const origen = origenActual();
    const ea = estadoAdministrativo(antes), ed = estadoAdministrativo(despues);
    if (ea !== ed) {
      const operacion = ed === "CANCELADA" ? "CANCELACION" : ed === "ASISTIO" ? "ASISTENCIA" : ed === "NO_ASISTIO" ? "NO_ASISTENCIA" : "CAMBIO_ESTADO";
      this.registrar(despues.id, operacion, ea, ed, origen, ed === "CANCELADA" ? `origen: ${despues.origenCancelacion || "-"}` : "");
    }
    if (antes.estadoConfirmacion !== despues.estadoConfirmacion)
      this.registrar(despues.id, "CONFIRMACION", antes.estadoConfirmacion, despues.estadoConfirmacion, origen);
    if (antes.idBloque !== despues.idBloque || (antes.idProfesionalReemplazo ?? null) !== (despues.idProfesionalReemplazo ?? null))
      this.registrar(despues.id, "CAMBIO_AGENDA", null, null, origen, "Cambio de cupo o de profesional");
    return despues;
  }
}
module.exports = { CitaRepositoryConHistorial };

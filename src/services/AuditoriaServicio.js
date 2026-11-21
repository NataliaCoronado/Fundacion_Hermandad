"use strict";
const { textoLocal } = require("../herramientas/tiempo");
class AuditoriaServicio {
  constructor(extras) {
    this.extras = extras;
  }
  registrar(usuario, accion, detalle = "", contexto = {}) {
    return this.extras.agregar("auditoria", {
      fecha: textoLocal(),
      usuario: usuario ? usuario.nombre : "(anónimo)",
      accion,
      detalle,
      idUsuario: usuario?.id || null,
      resultado: "EXITOSO",
      ...contexto,
    });
  }
  rechazo(usuario, accion, detalle = "", contexto = {}) {
    return this.registrar(usuario, accion, detalle, { modulo: "Seguridad", ...contexto, resultado: "RECHAZADO" });
  }
  listar() {
    return [...this.extras.listar("auditoria")].reverse();
  }
}
module.exports = { AuditoriaServicio };

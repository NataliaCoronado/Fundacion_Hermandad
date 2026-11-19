"use strict";
const { textoLocal } = require("../util/tiempo");
class AuditoriaService {
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
  // Intento que el sistema no permitió (acceso fuera de rol o sede, regla de negocio, límite de intentos, login fallido).
  rechazo(usuario, accion, detalle = "", contexto = {}) {
    return this.registrar(usuario, accion, detalle, { modulo: "Seguridad", ...contexto, resultado: "RECHAZADO" });
  }
  listar() {
    return [...this.extras.listar("auditoria")].reverse();
  }
}
module.exports = { AuditoriaService };

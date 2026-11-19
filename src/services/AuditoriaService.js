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
      ...contexto,
    });
  }
  listar() {
    return [...this.extras.listar("auditoria")].reverse();
  }
}
module.exports = { AuditoriaService };

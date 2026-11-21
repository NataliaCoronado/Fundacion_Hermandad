'use strict';
const { textoLocal } = require('../herramientas/tiempo');

class WhatsAppSimulado {
  constructor(extras) { this.extras = extras; }
  get simulado() { return true; }
  async enviar({ telefono, idCita, texto, botones = [], idComunicacion, tipo, encuestaReserva = false }) {
    return this.extras.agregar('bandeja', {
      direccion: 'SALIENTE', telefono, idCita, texto, botones, fecha: textoLocal(),
      ...(idComunicacion ? { idComunicacion, tipo } : {}),
      ...(encuestaReserva ? { encuestaReserva: true } : {}),
    });
  }
  async registrarEntrante({ telefono, idCita, texto }) {
    return this.extras.agregar('bandeja', { direccion: 'ENTRANTE', telefono, idCita, texto, botones: [], fecha: textoLocal() });
  }
}
module.exports = { WhatsAppSimulado };

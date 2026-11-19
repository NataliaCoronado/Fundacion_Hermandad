'use strict';
const { textoLocal } = require('../util/tiempo');

class WhatsAppSimulado {
  constructor(extras) { this.extras = extras; }
  get simulado() { return true; }
  async enviar({ telefono, idCita, texto, botones = [] }) {
    return this.extras.agregar('bandeja', { direccion: 'SALIENTE', telefono, idCita, texto, botones, fecha: textoLocal() });
  }
  async registrarEntrante({ telefono, idCita, texto }) {
    return this.extras.agregar('bandeja', { direccion: 'ENTRANTE', telefono, idCita, texto, botones: [], fecha: textoLocal() });
  }
}
module.exports = { WhatsAppSimulado };

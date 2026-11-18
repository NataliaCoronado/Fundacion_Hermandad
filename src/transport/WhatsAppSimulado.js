'use strict';
const { textoLocal } = require('../util/tiempo');

// Transporte de WhatsApp SIMULADO: no envía nada real; deja los mensajes en una bandeja visible en /tens/bot.
// Mismo contrato que un transporte real: enviar({ telefono, idCita, texto, botones }).
class WhatsAppSimulado {
  constructor(extras) { this.extras = extras; }
  // Permite que el despachador rotule el resultado como "Simulado" y nunca como "Enviado".
  get simulado() { return true; }
  async enviar({ telefono, idCita, texto, botones = [] }) {
    return this.extras.agregar('bandeja', { direccion: 'SALIENTE', telefono, idCita, texto, botones, fecha: textoLocal() });
  }
  async registrarEntrante({ telefono, idCita, texto }) {
    return this.extras.agregar('bandeja', { direccion: 'ENTRANTE', telefono, idCita, texto, botones: [], fecha: textoLocal() });
  }
}
module.exports = { WhatsAppSimulado };

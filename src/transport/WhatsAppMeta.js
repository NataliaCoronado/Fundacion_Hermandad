'use strict';
// Transporte REAL: API oficial de WhatsApp Cloud (Meta). No usar bibliotecas no oficiales (tipo WhatsApp Web):
// pueden bloquear el número. Se activa con WHATSAPP_MODO=meta y estas variables (nunca en el repositorio):
//   WHATSAPP_TOKEN        token de acceso permanente de Meta Business
//   WHATSAPP_PHONE_ID     identificador del número de la Fundación
//   WHATSAPP_PLANTILLA    nombre de la plantilla APROBADA (1 variable de cuerpo). Meta la exige para los mensajes
//                         iniciados por la Fundación (recordatorios, comprobantes, avisos).
//   WHATSAPP_IDIOMA       idioma de la plantilla (predeterminado es)
//   WHATSAPP_API_VERSION  versión de la API (predeterminado v21.0)
// Sin configuración, enviar() falla con WHATSAPP_NO_CONFIGURADO y el despachador reintenta o deja el error registrado.
// ESTADO: implementado según la documentación oficial y probado solo con un servidor simulado; falta probarlo con
// una cuenta real de Meta. No marca "Entregado": eso requiere recibir los estados por webhook (no incluido).
class WhatsAppMeta {
  constructor({ env = process.env, fetchFn = globalThis.fetch } = {}) {
    this.env = env;
    this.fetchFn = fetchFn;
  }
  get simulado() { return false; }
  get configurado() { return Boolean(this.env.WHATSAPP_TOKEN && this.env.WHATSAPP_PHONE_ID); }

  // iniciado = true: mensaje iniciado por la Fundación (requiere plantilla). false: respuesta dentro de las 24 h.
  async enviar({ telefono, texto, iniciado = false }) {
    if (!this.configurado) throw new Error('WHATSAPP_NO_CONFIGURADO');
    const para = String(telefono || '').replace(/\D/g, '');
    if (para.length < 8) throw new Error('TELEFONO_INVALIDO');
    const limpio = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 1000); // las plantillas no admiten saltos de línea
    let cuerpo;
    if (iniciado) {
      if (!this.env.WHATSAPP_PLANTILLA) throw new Error('WHATSAPP_PLANTILLA_FALTANTE');
      cuerpo = {
        messaging_product: 'whatsapp', to: para, type: 'template',
        template: {
          name: this.env.WHATSAPP_PLANTILLA,
          language: { code: this.env.WHATSAPP_IDIOMA || 'es' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: limpio }] }],
        },
      };
    } else {
      cuerpo = { messaging_product: 'whatsapp', to: para, type: 'text', text: { body: limpio } };
    }
    const version = this.env.WHATSAPP_API_VERSION || 'v21.0';
    const res = await this.fetchFn(`https://graph.facebook.com/${version}/${this.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10_000),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`WhatsApp rechazó el mensaje (${res.status}): ${datos?.error?.message || 'sin detalle'}`);
    return { id: datos?.messages?.[0]?.id || null };
  }
  // Las respuestas del paciente llegan por webhook (no incluido todavía); aquí no hay nada que registrar.
  async registrarEntrante() { return null; }
}
module.exports = { WhatsAppMeta };

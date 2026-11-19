'use strict';
class WhatsAppMeta {
  constructor({ env = process.env, fetchFn = globalThis.fetch } = {}) {
    this.env = env;
    this.fetchFn = fetchFn;
  }
  get simulado() { return false; }
  get configurado() { return Boolean(this.env.WHATSAPP_TOKEN && this.env.WHATSAPP_PHONE_ID); }

  async enviar({ telefono, texto, iniciado = false }) {
    if (!this.configurado) throw new Error('WHATSAPP_NO_CONFIGURADO');
    const para = String(telefono || '').replace(/\D/g, '');
    if (para.length < 8) throw new Error('TELEFONO_INVALIDO');
    const limpio = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
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
  async registrarEntrante() { return null; }
}
module.exports = { WhatsAppMeta };

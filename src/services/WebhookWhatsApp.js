'use strict';
const crypto = require('node:crypto');
const { textoLocal } = require('../herramientas/tiempo');

const ETIQUETAS = { delivered: 'Entregado al teléfono del paciente.', read: 'Leído por el paciente.' };
const digitos = (t) => String(t || '').replace(/\D/g, '');
const MAX_VISTOS = 5000;

class WebhookWhatsApp {
  constructor({ extras, catalogo, citaRepo, bot, auditoria, env = process.env }) {
    Object.assign(this, { extras, catalogo, citaRepo, bot, auditoria, env });
    this.extras.extras.webhookVistos ||= [];
  }

  get activo() { return Boolean(this.env.WHATSAPP_APP_SECRET && this.env.WHATSAPP_VERIFY_TOKEN); }

  verificarSuscripcion(q) {
    const token = String(q.get('hub.verify_token') || '');
    const esperado = String(this.env.WHATSAPP_VERIFY_TOKEN || '');
    const ok = q.get('hub.mode') === 'subscribe' && token.length === esperado.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
    return ok ? { estado: 200, cuerpo: String(q.get('hub.challenge') || '') } : { estado: 403, cuerpo: 'Token de verificación incorrecto.' };
  }

  firmaValida(cruda, cabecera) {
    const recibida = String(cabecera || '').replace(/^sha256=/, '');
    const calculada = crypto.createHmac('sha256', this.env.WHATSAPP_APP_SECRET).update(cruda).digest('hex');
    return recibida.length === calculada.length && crypto.timingSafeEqual(Buffer.from(recibida), Buffer.from(calculada));
  }

  primeraVez(clave) {
    const vistos = this.extras.listar('webhookVistos');
    if (vistos.includes(clave)) return false;
    vistos.push(clave);
    if (vistos.length > MAX_VISTOS) vistos.splice(0, vistos.length - MAX_VISTOS);
    return true;
  }

  async procesar(cuerpo) {
    const conteo = { estados: 0, respuestas: 0, avisos: 0, duplicados: 0, ignorados: 0 };
    if (cuerpo?.object !== 'whatsapp_business_account') { conteo.ignorados++; return conteo; }
    for (const entrada of cuerpo.entry || [])
      for (const cambio of entrada.changes || []) {
        const v = cambio.value || {};
        for (const s of v.statuses || []) {
          if (!this.primeraVez(`estado:${s.id}:${s.status}`)) { conteo.duplicados++; continue; }
          (await this.estado(s)) ? conteo.estados++ : conteo.ignorados++;
        }
        for (const m of v.messages || []) {
          if (!this.primeraVez(`mensaje:${m.id}`)) { conteo.duplicados++; continue; }
          (await this.mensaje(m)) === 'aviso' ? conteo.avisos++ : conteo.respuestas++;
        }
      }
    return conteo;
  }

  async estado(s) {
    const cuando = s.timestamp ? textoLocal(new Date(Number(s.timestamp) * 1000)) : textoLocal();
    const com = this.extras.listar('comunicaciones').find((x) => x.proveedorId && x.proveedorId === s.id);
    if (com) {
      if (s.status === 'failed' && com.estado === 'Enviado') {
        const e = (s.errors || [])[0] || {};
        this.extras.actualizar('comunicaciones', com.id, { estado: 'Error', detalle: `WhatsApp no pudo entregarlo: ${e.title || e.message || 'sin detalle'}.`, entregaEn: cuando });
      } else if (ETIQUETAS[s.status] && ['Enviado', 'Entregado'].includes(com.estado)) {
        if (com.estado === 'Entregado' && com.leido && s.status === 'delivered') return true;
        this.extras.actualizar('comunicaciones', com.id, { estado: 'Entregado', detalle: ETIQUETAS[s.status], leido: com.leido || s.status === 'read', entregaEn: com.entregaEn || cuando });
      }
      return true;
    }
    const msj = this.extras.listar('mensajes').find((x) => x.proveedorId && x.proveedorId === s.id);
    if (msj) {
      const entrega = { delivered: 'ENTREGADO', read: 'LEIDO', failed: 'FALLIDO' }[s.status];
      if (!entrega || (msj.entrega === 'LEIDO' && entrega === 'ENTREGADO')) return true;
      this.extras.actualizar('mensajes', msj.id, { entrega, entregaEn: cuando });
      if (entrega === 'FALLIDO') {
        const cita = await this.citaRepo.buscarPorId(msj.idCita);
        if (cita) await this.bot.avisarSinWhatsapp(cita, await this.bot.detalle(cita), 'ERROR_ENVIO');
      }
      return true;
    }
    return false;
  }

  async mensaje(m) {
    const texto = m.type === 'button' ? m.button?.text
      : m.type === 'interactive' ? m.interactive?.button_reply?.title
      : m.type === 'text' ? m.text?.body
      : '(mensaje que no es texto)';
    const idCita = await this.citaDe(m);
    if (!idCita) return this.avisarSinCita(m, texto);
    const cita = await this.citaRepo.buscarPorId(idCita);
    const detalle = await this.bot.detalle(cita);
    const sede = detalle.prof ? detalle.prof.idPoliclinico : null;
    this.auditoria.registrar({ nombre: 'Paciente (WhatsApp)', id: null }, 'Respuesta por WhatsApp', `cita ${idCita}: ${String(texto || '').slice(0, 80)}`, { modulo: 'Comunicaciones', registro: String(idCita), idPoliclinico: sede });
    await this.bot.responder({ idCita, boton: String(texto || '').trim() });
    return 'respuesta';
  }

  async citaDe(m) {
    const ref = m.context?.id;
    if (ref) {
      const enviado = this.extras.listar('mensajes').find((x) => x.proveedorId === ref) || this.extras.listar('comunicaciones').find((x) => x.proveedorId === ref);
      if (enviado) return enviado.idCita;
    }
    const tel = digitos(m.from);
    if (!tel) return null;
    const ruts = new Set((await this.catalogo.pacientes()).filter((p) => digitos(p.telefono) === tel).map((p) => p.rut));
    if (!ruts.size) return null;
    const preguntadas = new Set(this.extras.listar('mensajes').filter((x) => x.estado === 'ENVIADO').map((x) => x.idCita));
    const candidatas = (await this.citaRepo.listar()).filter((c) => ruts.has(c.rut) && c.estadoReserva === 'ACTIVA' && preguntadas.has(c.id));
    return candidatas.length === 1 ? candidatas[0].id : null;
  }

  async avisarSinCita(m, texto) {
    const tel = digitos(m.from);
    const pac = (await this.catalogo.pacientes()).find((p) => digitos(p.telefono) === tel);
    const citas = pac ? (await this.citaRepo.buscarPorRut(pac.rut)).filter((c) => c.estadoReserva === 'ACTIVA') : [];
    let sede = null;
    if (citas.length) { const detalle = await this.bot.detalle(citas[citas.length - 1]); sede = detalle.prof ? detalle.prof.idPoliclinico : null; }
    const quien = pac ? `${pac.nombre} (+${tel})` : `+${tel}`;
    const motivo = citas.length > 1 ? `tiene ${citas.length} horas activas y no se sabe a cuál responde` : 'no se pudo asociar a una cita';
    this.extras.agregar('notificaciones', { tipo: 'WHATSAPP_SIN_CITA', fecha: textoLocal(), idPoliclinico: sede, leida: false,
      texto: `Mensaje de WhatsApp de ${quien} que ${motivo}: «${String(texto || '').slice(0, 120)}». Contactar al paciente.` });
    this.auditoria.registrar({ nombre: 'Paciente (WhatsApp)', id: null }, 'Mensaje de WhatsApp sin cita asociada', `+${tel}`, { modulo: 'Comunicaciones', idPoliclinico: sede });
    return 'aviso';
  }
}
module.exports = { WebhookWhatsApp };

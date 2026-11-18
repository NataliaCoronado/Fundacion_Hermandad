'use strict';
const { textoLocal, sumarMinutos } = require('../util/tiempo');

const MAX_INTENTOS = 3;
const ESPERA_MIN = 5; // espera entre reintentos: 5, 10 min…

// Correo SIMULADO: no hay proveedor de correo conectado. Deja el mensaje en la bandeja de demostración.
class CorreoSimulado {
  constructor(extras) { this.extras = extras; }
  get simulado() { return true; }
  async enviar({ destino, idCita, texto }) {
    return this.extras.agregar('bandeja', { direccion: 'SALIENTE', canal: 'Correo', correo: destino, telefono: '', idCita, texto, botones: [], fecha: textoLocal() });
  }
}

// Envía las comunicaciones que quedaron "Pendiente" en la bandeja (comprobantes, avisos de cambios, enlaces de
// Telemedicina…). Estados que escribe, y solo estos:
//   Simulado  → el transporte es de demostración: NO salió ningún mensaje real.
//   Enviado   → el proveedor real aceptó el mensaje (no significa que el paciente lo haya recibido).
//   Pendiente → falló y se reintenta (hasta 3 veces), o no hay proveedor para ese canal.
//   Error     → sin consentimiento, sin datos del destinatario o 3 intentos fallidos.
// Nunca escribe "Entregado": eso requiere el estado de entrega que informa el proveedor.
class DespachadorComunicaciones {
  constructor({ extras, catalogo, citaRepo, transportes, ahora = textoLocal }) {
    Object.assign(this, { extras, catalogo, citaRepo, transportes, ahora });
  }

  async texto(m, cita) {
    const b = await this.catalogo.bloque(cita.idBloque);
    const prof = b && (await this.catalogo.profesional(b.idProfesional));
    const sede = await this.catalogo.policlinico(m.idPoliclinico);
    const hora = b ? `${b.fecha} a las ${b.hora}` : 'la fecha indicada';
    const lugar = `${sede ? sede.nombre : 'el policlínico'}${prof ? ` (${prof.especialidad})` : ''}`;
    const marca = 'Hermandad de Dolores:';
    switch (m.tipo) {
      case 'Comprobante de reserva':
        return `${marca} su hora quedó reservada para el ${hora} en ${lugar}. Puede descargar su comprobante desde el portal de pacientes.`;
      case 'Cancelación institucional':
        return `${marca} su hora del ${hora} en ${lugar} fue cancelada por la institución. Nos comunicaremos con usted para reprogramarla.`;
      case 'Reprogramación institucional':
        return `${marca} su hora fue reprogramada: ahora es el ${hora} en ${lugar}.`;
      case 'Cambio institucional':
        return `${marca} hubo un cambio en la agenda de su hora del ${hora} en ${lugar}. El policlínico se comunicará con usted.`;
      case 'Enlace de atención':
        return `${marca} su atención de Telemedicina es el ${hora}. Conéctese con este enlace: ${cita.enlace}`;
      default:
        return `${marca} recordatorio de su hora del ${hora} en ${lugar}.`;
    }
  }

  async enviar(m) {
    if (!m || m.estado !== 'Pendiente') return m;
    const transporte = this.transportes[m.canal];
    if (!transporte) return m; // sin proveedor para este canal: queda Pendiente, no se inventa un resultado
    const ahora = this.ahora();
    const cerrar = (cambios) => this.extras.actualizar('comunicaciones', m.id, cambios);
    const p = await this.catalogo.paciente(m.rut);
    const cita = await this.citaRepo.buscarPorId(m.idCita);
    const consiente = this.extras.extras.operacion?.pacientes?.[m.rut]?.consentimientoComunicaciones === true;
    const destino = m.canal === 'WhatsApp' ? (p?.tieneWhatsapp ? p.telefono : '') : p?.correo;
    if (!cita || !consiente || !destino)
      return cerrar({ estado: 'Error', proximoIntento: null, detalle: !consiente ? 'Falta el consentimiento del paciente.' : 'Faltan datos del destinatario.' });
    const intentos = (m.intentos || 0) + 1;
    try {
      const r = await transporte.enviar({ telefono: destino, destino, idCita: m.idCita, texto: await this.texto(m, cita), botones: [], iniciado: true });
      return cerrar({
        estado: transporte.simulado ? 'Simulado' : 'Enviado',
        detalle: transporte.simulado ? 'Envío simulado: no salió ningún mensaje real.' : 'Aceptado por el proveedor; la entrega no está confirmada.',
        proveedorId: transporte.simulado ? null : r?.id ?? null,
        enviadoEn: ahora, intentos, proximoIntento: null,
      });
    } catch (e) {
      const motivo = e.message === 'WHATSAPP_NO_CONFIGURADO' ? 'WhatsApp no está configurado' : e.message;
      if (intentos >= MAX_INTENTOS)
        return cerrar({ estado: 'Error', intentos, proximoIntento: null, detalle: `No se pudo enviar tras ${MAX_INTENTOS} intentos: ${motivo}.` });
      return cerrar({ intentos, proximoIntento: sumarMinutos(ahora, ESPERA_MIN * intentos), detalle: `Intento ${intentos} de ${MAX_INTENTOS} fallido: ${motivo}. Se reintentará.` });
    }
  }

  // Un ciclo: procesa todo lo pendiente cuya hora de reintento ya llegó.
  async procesar() {
    const ahora = this.ahora();
    const r = { enviados: 0, simulados: 0, errores: 0, reintentos: 0 };
    const cola = this.extras.listar('comunicaciones').filter((x) => x.estado === 'Pendiente' && this.transportes[x.canal] && (!x.proximoIntento || x.proximoIntento <= ahora));
    for (const m of cola) {
      const f = await this.enviar(m);
      if (f.estado === 'Enviado') r.enviados++;
      else if (f.estado === 'Simulado') r.simulados++;
      else if (f.estado === 'Error') r.errores++;
      else r.reintentos++;
    }
    return r;
  }
}
module.exports = { DespachadorComunicaciones, CorreoSimulado, MAX_INTENTOS };

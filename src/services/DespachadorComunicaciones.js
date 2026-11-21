'use strict';
const { textoLocal, sumarMinutos } = require('../herramientas/tiempo');
const { huellaEnlace } = require('../herramientas/codigoDelEnlace');
const { lineasDeCita } = require('../herramientas/detalleDeCita');
const { ENCUESTA_ATENCION, webAtendida } = require('./ComunicacionesPaciente');

const MAX_INTENTOS = 3;
const REQUIERE_RESERVA_ACTIVA = new Set(['Recordatorio', 'Comprobante de reserva', 'Enlace de atención']);
const ESPERA_MIN = 5;

class CorreoSimulado {
  constructor(extras) { this.extras = extras; }
  get simulado() { return true; }
  async enviar({ destino, idCita, texto, idComunicacion, tipo, botones = [], encuestaReserva = false }) {
    return this.extras.agregar('bandeja', { direccion: 'SALIENTE', canal: 'Correo', correo: destino, telefono: '', idCita, texto, botones, fecha: textoLocal(), idComunicacion, tipo, ...(encuestaReserva ? { encuestaReserva: true } : {}) });
  }
}

class DespachadorComunicaciones {
  constructor({ extras, catalogo, citaRepo, transportes, ahora = textoLocal }) {
    Object.assign(this, { extras, catalogo, citaRepo, transportes, ahora });
  }

  async texto(m, cita) {
    const bloque = await this.catalogo.bloque(cita.idBloque);
    const prof = bloque && (await this.catalogo.profesional(bloque.idProfesional));
    const sede = await this.catalogo.policlinico(m.idPoliclinico);
    const hora = bloque ? `${bloque.fecha} a las ${bloque.hora}` : 'la fecha indicada';
    const lugar = `${sede ? sede.nombre : 'el policlínico'}${prof ? ` (${prof.especialidad})` : ''}`;
    const marca = 'Hermandad de Dolores:';
    switch (m.tipo) {
      case 'Comprobante de reserva':
        return `${marca} su hora quedó reservada.\n\n${lineasDeCita({ bloque, profesional: prof, sede })}\n\nPuede descargar su comprobante desde el portal de pacientes.`;
      case ENCUESTA_ATENCION:
        return `${marca} gracias por asistir a su atención. Le invitamos a responder una breve encuesta sobre su experiencia.`;
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
    const cerrar = (cambios) => this.extras.actualizar('comunicaciones', m.id, cambios);
    if (m.tipo === ENCUESTA_ATENCION && transporte?.simulado !== true)
      return cerrar({ estado: 'Error', proximoIntento: null, detalle: 'Encuesta disponible en la demostración de mensajería.' });
    if (!transporte) return m;
    const ahora = this.ahora();
    const paciente = await this.catalogo.paciente(m.rut);
    const cita = await this.citaRepo.buscarPorId(m.idCita);
    const consiente = this.extras.extras.operacion?.pacientes?.[m.rut]?.consentimientoComunicaciones === true;
    const destino = m.canal === 'WhatsApp' ? (paciente?.tieneWhatsapp ? paciente.telefono : '') : paciente?.correo;
    if (!cita || !consiente || !destino)
      return cerrar({ estado: 'Error', proximoIntento: null, detalle: !consiente ? 'Falta el consentimiento del paciente.' : 'Faltan datos del destinatario.' });
    if (m.tipo === ENCUESTA_ATENCION && !webAtendida(cita))
      return cerrar({ estado: 'Error', proximoIntento: null, detalle: 'La encuesta requiere una reserva web atendida.' });
    if (REQUIERE_RESERVA_ACTIVA.has(m.tipo) && cita.estadoReserva !== 'ACTIVA')
      return cerrar({ estado: 'Error', proximoIntento: null, detalle: 'La reserva ya no está activa: no se envió este mensaje.' });
    if (m.tipo === 'Enlace de atención' && m.huellaEnlace && huellaEnlace(cita.enlace) !== m.huellaEnlace)
      return cerrar({ estado: 'Error', proximoIntento: null, detalle: 'El enlace de atención fue reemplazado: solicita el envío del enlace vigente.' });
    const intentos = (m.intentos || 0) + 1;
    const conEncuestaDeReserva = transporte.simulado === true && m.tipo === 'Comprobante de reserva' && cita.canal === 'WEB';
    try {
      const r = await transporte.enviar({
        telefono: destino,
        destino,
        idCita: m.idCita,
        texto: await this.texto(m, cita),
        botones: [],
        encuestaReserva: conEncuestaDeReserva,
        iniciado: true,
        idComunicacion: m.id,
        tipo: m.tipo,
      });
      return cerrar({
        estado: transporte.simulado ? 'Simulado' : 'Enviado',
        detalle: transporte.simulado ? 'Envío simulado: no salió ningún mensaje real.' : 'Aceptado por el proveedor; la entrega no está confirmada.',
        proveedorId: transporte.simulado ? null : r?.id ?? null,
        destino,
        enviadoEn: ahora, intentos, proximoIntento: null,
      });
    } catch (e) {
      const motivo = e.message === 'WHATSAPP_NO_CONFIGURADO' ? 'WhatsApp no está configurado' : e.message;
      if (intentos >= MAX_INTENTOS)
        return cerrar({ estado: 'Error', intentos, proximoIntento: null, detalle: `No se pudo enviar tras ${MAX_INTENTOS} intentos: ${motivo}.` });
      return cerrar({ intentos, proximoIntento: sumarMinutos(ahora, ESPERA_MIN * intentos), detalle: `Intento ${intentos} de ${MAX_INTENTOS} fallido: ${motivo}. Se reintentará.` });
    }
  }

  async procesar() {
    const ahora = this.ahora();
    const conteo = { enviados: 0, simulados: 0, errores: 0, reintentos: 0 };
    const cola = this.extras.listar('comunicaciones').filter((x) => x.estado === 'Pendiente' && this.transportes[x.canal] && (!x.proximoIntento || x.proximoIntento <= ahora));
    for (const m of cola) {
      const f = await this.enviar(m);
      if (f.estado === 'Enviado') conteo.enviados++;
      else if (f.estado === 'Simulado') conteo.simulados++;
      else if (f.estado === 'Error') conteo.errores++;
      else conteo.reintentos++;
    }
    return conteo;
  }
}
module.exports = { DespachadorComunicaciones, CorreoSimulado, MAX_INTENTOS };

'use strict';
const { textoLocal, sumarDias, sumarMinutos } = require('../util/tiempo');

const MAX_INTENTOS = 3;

const BOTONES = ['Confirmar', 'Cancelar mi hora'];
const AYUDA = 'Para responder use los botones: Confirmar o Cancelar mi hora.';

// Bot de reglas FIJAS (sin IA y sin texto libre). Calendario: recordatorio 1 semana antes y la víspera a las 10:00;
// si no hay respuesta, un reintento la víspera a las 14:00; después la cita pasa a "sin respuesta" y TENS/TONS llama (RF27).
// El silencio no cancela ni confirma.
class BotWhatsAppService {
  constructor({ citaRepo, catalogo, extras, transporte, agendamiento }) {
    Object.assign(this, { citaRepo, catalogo, extras, transporte, agendamiento });
  }

  async detalle(cita) {
    const b = await this.catalogo.bloque(cita.idBloque);
    const prof = b && await this.catalogo.profesional(b.idProfesional);
    const sede = prof && await this.catalogo.policlinico(prof.idPoliclinico);
    return { b, prof, sede, pac: await this.catalogo.paciente(cita.rut) };
  }

  texto(tipo, d) {
    const hora = `${d.b.fecha} a las ${d.b.hora} en ${d.sede ? d.sede.nombre : 'el policlínico'} (${d.prof ? d.prof.especialidad : ''})`;
    if (tipo === 'SEMANA') return `Hermandad de Dolores: tiene una hora el ${hora}. ¿Confirma su asistencia?`;
    if (tipo === 'VISPERA') return `Recordatorio: mañana tiene una hora el ${hora}. ¿Confirma su asistencia?`;
    return `Aún no recibimos su respuesta para la hora del ${hora}. Si no responde, le llamaremos por teléfono.`;
  }

  // Crea (sin duplicar) los mensajes que faltan para citas activas sin confirmar. No crea los que ya pasaron.
  async programar(ahora = textoLocal()) {
    const existentes = this.extras.listar('mensajes');
    for (const cita of await this.citaRepo.listar()) {
      if (cita.estadoReserva !== 'ACTIVA' || cita.estadoConfirmacion === 'CONFIRMADA') continue;
      const b = await this.catalogo.bloque(cita.idBloque);
      if (!b) continue;
      const plan = [['SEMANA', `${sumarDias(b.fecha, -7)} 10:00`], ['VISPERA', `${sumarDias(b.fecha, -1)} 10:00`], ['REINTENTO', `${sumarDias(b.fecha, -1)} 14:00`]];
      for (const [tipo, cuando] of plan) {
        if (cuando < ahora || existentes.some((m) => m.idCita === cita.id && m.tipo === tipo)) continue;
        await this.extras.agregar('mensajes', { idCita: cita.id, tipo, programadoPara: cuando, estado: 'PROGRAMADO', enviadoEn: null, respuesta: null });
      }
    }
  }

  // Envía los mensajes cuya hora ya llegó. "ahora" se puede simular para la demostración.
  async procesar(ahora = textoLocal()) {
    await this.programar(ahora);
    let enviados = 0; let omitidos = 0; let errores = 0;
    for (const m of this.extras.listar('mensajes').filter((x) => x.estado === 'PROGRAMADO' && x.programadoPara <= ahora)) {
      const cita = await this.citaRepo.buscarPorId(m.idCita);
      if (!cita || cita.estadoReserva !== 'ACTIVA' || cita.estadoConfirmacion === 'CONFIRMADA') { await this.extras.actualizar('mensajes', m.id, { estado: 'OMITIDO' }); omitidos++; continue; }
      const d = await this.detalle(cita);
      if (!d.pac || !d.pac.telefono || !d.pac.tieneWhatsapp) {
        await this.extras.actualizar('mensajes', m.id, { estado: 'OMITIDO' }); omitidos++;
        await this.avisarSinWhatsapp(cita, d);
        continue;
      }
      // RF07: los recordatorios solo salen con el consentimiento de comunicaciones del paciente.
      if (!this.consiente(d.pac.rut)) {
        await this.extras.actualizar('mensajes', m.id, { estado: 'OMITIDO' }); omitidos++;
        await this.avisarSinWhatsapp(cita, d, 'SIN_CONSENTIMIENTO');
        continue;
      }
      let enviado;
      try {
        enviado = await this.transporte.enviar({ telefono: d.pac.telefono, idCita: cita.id, texto: this.texto(m.tipo, d), botones: BOTONES, iniciado: true });
      } catch (e) {
        // Un fallo del proveedor no detiene el ciclo: se reintenta más tarde y, al agotar los intentos, se avisa para llamar.
        const intentos = (m.intentos || 0) + 1;
        if (intentos >= MAX_INTENTOS) {
          await this.extras.actualizar('mensajes', m.id, { estado: 'ERROR', intentos, detalle: e.message });
          await this.avisarSinWhatsapp(cita, d, 'ERROR_ENVIO');
        } else {
          await this.extras.actualizar('mensajes', m.id, { intentos, detalle: e.message, programadoPara: sumarMinutos(ahora, 5 * intentos) });
        }
        errores++;
        continue;
      }
      // Con el proveedor real se guarda el identificador de Meta: así el webhook asocia el estado de entrega y la
      // respuesta del paciente a este recordatorio y a su cita.
      await this.extras.actualizar('mensajes', m.id, { estado: 'ENVIADO', enviadoEn: ahora, proveedorId: this.transporte.simulado === false ? enviado?.id ?? null : null });
      enviados++;
      // Último intento del bot: la cita queda para llamada, pero sigue reservada.
      if (m.tipo === 'REINTENTO' && cita.estadoConfirmacion === 'PENDIENTE') await this.citaRepo.actualizar({ ...cita, estadoConfirmacion: 'SIN_RESPUESTA' });
    }
    return { enviados, omitidos, errores };
  }

  consiente(rut) {
    return this.extras.extras?.operacion?.pacientes?.[rut]?.consentimientoComunicaciones === true;
  }

  async avisarSinWhatsapp(cita, d, tipo = 'SIN_WHATSAPP') {
    const motivo = { SIN_WHATSAPP: 'Paciente sin WhatsApp', SIN_CONSENTIMIENTO: 'Paciente sin consentimiento de comunicaciones', ERROR_ENVIO: 'No se pudo enviar el recordatorio por WhatsApp' }[tipo];
    const texto = `${motivo} (cita ${cita.id}, ${d.b.fecha} ${d.b.hora}): confirmar por llamada.`;
    if (this.extras.listar('notificaciones').some((n) => n.texto === texto)) return;
    await this.extras.agregar('notificaciones', { tipo, fecha: textoLocal(), idPoliclinico: d.prof ? d.prof.idPoliclinico : null, leida: false, texto });
  }

  // Respuesta del paciente (botón). Cualquier otra cosa recibe siempre la misma ayuda: no hay texto libre ni IA.
  async responder({ idCita, boton }) {
    const cita = await this.citaRepo.buscarPorId(idCita);
    if (!cita) throw new Error('CITA_NO_ENCONTRADA');
    const d = await this.detalle(cita);
    const telefono = d.pac ? d.pac.telefono : '';
    await this.transporte.registrarEntrante({ telefono, idCita: cita.id, texto: boton });
    let respuesta = AYUDA; let marca = null;
    if (cita.estadoReserva === 'ACTIVA') {
      if (boton === 'Confirmar') {
        await this.citaRepo.actualizar({ ...cita, estadoConfirmacion: 'CONFIRMADA' });
        respuesta = 'Gracias. Su hora quedó confirmada.'; marca = 'CONFIRMAR';
      } else if (boton === 'Cancelar mi hora') {
        await this.agendamiento.cancelar(cita.id, 'WHATSAPP');
        respuesta = 'Su hora fue cancelada. Si necesita otra, comuníquese con el policlínico.'; marca = 'CANCELAR';
      }
    } else {
      respuesta = 'Esa hora ya no está activa.';
    }
    await this.transporte.enviar({ telefono, idCita: cita.id, texto: respuesta, botones: [] });
    if (marca) {
      const ultimo = this.extras.listar('mensajes').filter((m) => m.idCita === cita.id && m.estado === 'ENVIADO').pop();
      if (ultimo) await this.extras.actualizar('mensajes', ultimo.id, { respuesta: marca });
    }
    return respuesta;
  }
}
module.exports = { BotWhatsAppService, BOTONES, AYUDA };

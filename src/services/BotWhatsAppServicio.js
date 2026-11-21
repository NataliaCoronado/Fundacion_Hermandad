'use strict';
const { textoLocal, sumarDias, sumarMinutos } = require('../herramientas/tiempo');
const { lineasDeCita } = require('../herramientas/detalleDeCita');

const MAX_INTENTOS = 3;

const BOTONES = ['Confirmar', 'Cancelar mi hora'];
const AYUDA = 'Para responder use los botones: Confirmar o Cancelar mi hora.';

class BotWhatsAppServicio {
  constructor({ citaRepo, catalogo, extras, transporte, agendamiento }) {
    Object.assign(this, { citaRepo, catalogo, extras, transporte, agendamiento });
  }

  async detalle(cita) {
    const bloque = await this.catalogo.bloque(cita.idBloque);
    const prof = bloque && await this.catalogo.profesional(bloque.idProfesional);
    const sede = prof && await this.catalogo.policlinico(prof.idPoliclinico);
    return { b: bloque, prof, sede, pac: await this.catalogo.paciente(cita.rut) };
  }

  texto(tipo, d) {
    const detalle = lineasDeCita({ bloque: d.b, profesional: d.prof, sede: d.sede });
    if (tipo === 'SEMANA') return `Hermandad de Dolores: tiene una hora agendada próximamente.\n\n${detalle}\n\n¿Confirma su asistencia?`;
    if (tipo === 'VISPERA') return `Recordatorio: mañana tiene una hora.\n\n${detalle}\n\n¿Confirma su asistencia?`;
    return `Aún no recibimos su respuesta para su hora.\n\n${detalle}\n\nSi no responde, le llamaremos por teléfono.`;
  }

  async programar(ahora = textoLocal()) {
    const existentes = this.extras.listar('mensajes');
    for (const cita of await this.citaRepo.listar()) {
      if (cita.estadoReserva !== 'ACTIVA' || cita.estadoConfirmacion === 'CONFIRMADA') continue;
      const bloque = await this.catalogo.bloque(cita.idBloque);
      if (!bloque) continue;
      const plan = [['SEMANA', `${sumarDias(bloque.fecha, -7)} 10:00`], ['VISPERA', `${sumarDias(bloque.fecha, -1)} 10:00`], ['REINTENTO', `${sumarDias(bloque.fecha, -1)} 14:00`]];
      for (const [tipo, cuando] of plan) {
        if (cuando < ahora || existentes.some((m) => m.idCita === cita.id && m.tipo === tipo)) continue;
        await this.extras.agregar('mensajes', { idCita: cita.id, tipo, programadoPara: cuando, estado: 'PROGRAMADO', enviadoEn: null, respuesta: null });
      }
    }
  }

  async procesar(ahora = textoLocal(), { rut = null } = {}) {
    await this.programar(ahora);
    let enviados = 0; let omitidos = 0; let errores = 0;
    for (const m of this.extras.listar('mensajes').filter((x) => x.estado === 'PROGRAMADO' && x.programadoPara <= ahora)) {
      const cita = await this.citaRepo.buscarPorId(m.idCita);
      if (rut && cita?.rut !== rut) continue;
      if (!cita || cita.estadoReserva !== 'ACTIVA' || cita.estadoConfirmacion === 'CONFIRMADA') { await this.extras.actualizar('mensajes', m.id, { estado: 'OMITIDO' }); omitidos++; continue; }
      const detalle = await this.detalle(cita);
      if (!detalle.pac || !detalle.pac.telefono || !detalle.pac.tieneWhatsapp) {
        await this.extras.actualizar('mensajes', m.id, { estado: 'OMITIDO' }); omitidos++;
        await this.avisarSinWhatsapp(cita, detalle);
        continue;
      }
      if (!this.consiente(detalle.pac.rut)) {
        await this.extras.actualizar('mensajes', m.id, { estado: 'OMITIDO' }); omitidos++;
        await this.avisarSinWhatsapp(cita, detalle, 'SIN_CONSENTIMIENTO');
        continue;
      }
      let enviado;
      try {
        enviado = await this.transporte.enviar({ telefono: detalle.pac.telefono, idCita: cita.id, texto: this.texto(m.tipo, detalle), botones: BOTONES, iniciado: true });
      } catch (e) {
        const intentos = (m.intentos || 0) + 1;
        if (intentos >= MAX_INTENTOS) {
          await this.extras.actualizar('mensajes', m.id, { estado: 'ERROR', intentos, detalle: e.message });
          await this.avisarSinWhatsapp(cita, detalle, 'ERROR_ENVIO');
        } else {
          await this.extras.actualizar('mensajes', m.id, { intentos, detalle: e.message, programadoPara: sumarMinutos(ahora, 5 * intentos) });
        }
        errores++;
        continue;
      }
      await this.extras.actualizar('mensajes', m.id, { estado: 'ENVIADO', enviadoEn: ahora, proveedorId: this.transporte.simulado === false ? enviado?.id ?? null : null });
      enviados++;
      if (m.tipo === 'REINTENTO' && cita.estadoConfirmacion === 'PENDIENTE') await this.citaRepo.actualizar({ ...cita, estadoConfirmacion: 'SIN_RESPUESTA' });
    }
    return { enviados, omitidos, errores };
  }

  // Demostración: adelanta el reloj hasta el próximo aviso programado de este paciente y lo envía.
  async avanzarAlSiguienteAviso(rut) {
    const ahora = textoLocal();
    const existentes = this.extras.listar('mensajes');
    const futuros = [];
    for (const cita of await this.citaRepo.buscarPorRut(rut)) {
      if (cita.estadoReserva !== 'ACTIVA' || cita.estadoConfirmacion === 'CONFIRMADA') continue;
      const bloque = await this.catalogo.bloque(cita.idBloque);
      if (!bloque) continue;
      for (const [tipo, cuando] of [['SEMANA', `${sumarDias(bloque.fecha, -7)} 10:00`], ['VISPERA', `${sumarDias(bloque.fecha, -1)} 10:00`], ['REINTENTO', `${sumarDias(bloque.fecha, -1)} 14:00`]]) {
        if (cuando >= ahora && !existentes.some((m) => m.idCita === cita.id && m.tipo === tipo)) futuros.push({ tipo, cuando });
      }
    }
    futuros.sort((a, b) => a.cuando.localeCompare(b.cuando));
    if (!futuros.length) return null;
    return { ...futuros[0], ...(await this.procesar(futuros[0].cuando, { rut })) };
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

  async responder({ idCita, boton }) {
    const cita = await this.citaRepo.buscarPorId(idCita);
    if (!cita) throw new Error('CITA_NO_ENCONTRADA');
    const detalle = await this.detalle(cita);
    const telefono = detalle.pac ? detalle.pac.telefono : '';
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
      respuesta = 'Esa hora ya no está activa, por lo que no podemos registrar su respuesta. Si necesita ayuda, comuníquese con el policlínico.';
    }
    await this.transporte.enviar({ telefono, idCita: cita.id, texto: respuesta, botones: [] });
    if (marca) {
      const ultimo = this.extras.listar('mensajes').filter((m) => m.idCita === cita.id && m.estado === 'ENVIADO').pop();
      if (ultimo) await this.extras.actualizar('mensajes', ultimo.id, { respuesta: marca });
    }
    return respuesta;
  }
}
module.exports = { BotWhatsAppServicio, BOTONES, AYUDA };

'use strict';

const ENCUESTA_ATENCION = 'Encuesta de atención';
const enviosEnCurso = new WeakMap();

const webAtendida = (cita) =>
  cita?.canal === 'WEB' && cita.estadoReserva === 'ACTIVA' && cita.asistencia === 'ASISTIO';

async function notificarEncuestaAtencion(aplicacion, cita, usuario) {
  if (!webAtendida(cita) || !aplicacion.operacion.meta.pacientes[cita.rut]?.consentimientoComunicaciones) return null;

  const comunicaciones = aplicacion.extras.listar('comunicaciones');
  const deLaCita = (m) => m.idCita === cita.id && m.rut === cita.rut;
  const comprobante = comunicaciones.findLast((m) =>
    deLaCita(m) && m.tipo === 'Comprobante de reserva' && m.estado === 'Simulado' &&
    aplicacion.despachador.transportes[m.canal]?.simulado === true,
  );
  if (!comprobante || comunicaciones.some((m) => deLaCita(m) && m.tipo === ENCUESTA_ATENCION)) return null;

  let pendientes = enviosEnCurso.get(aplicacion);
  if (!pendientes) {
    pendientes = new Set();
    enviosEnCurso.set(aplicacion, pendientes);
  }
  if (pendientes.has(cita.id)) return null;
  pendientes.add(cita.id);
  try {
    const paciente = await aplicacion.catalogo.paciente(cita.rut);
    const destino = comprobante.canal === 'WhatsApp'
      ? paciente?.tieneWhatsapp && paciente.telefono
      : paciente?.correo;
    if (!destino) return null;

    const comunicacion = await aplicacion.operacion.comunicar(usuario, cita, comprobante.canal, ENCUESTA_ATENCION);
    return await aplicacion.despachador.enviar(comunicacion);
  } finally {
    pendientes.delete(cita.id);
  }
}

async function enviarComprobanteDeReserva(aplicacion, cita, usuario) {
  if (aplicacion.operacion.meta.pacientes[cita.rut]?.consentimientoComunicaciones !== true) return null;
  const paciente = await aplicacion.catalogo.paciente(cita.rut);
  const canal = paciente?.tieneWhatsapp && paciente.telefono ? 'WhatsApp' : paciente?.correo ? 'Correo' : null;
  if (!canal) return null;
  const comunicacion = await aplicacion.operacion.comunicar(usuario, cita, canal, 'Comprobante de reserva');
  return aplicacion.despachador.enviar(comunicacion);
}

module.exports = { notificarEncuestaAtencion, enviarComprobanteDeReserva, ENCUESTA_ATENCION, webAtendida };

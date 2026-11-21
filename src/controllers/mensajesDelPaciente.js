"use strict";
const { paginaMensajesPaciente, paginaEncuestaPaciente } = require("../views/mensajesDelPaciente");
const { ENCUESTA_ATENCION, webAtendida } = require("../services/ComunicacionesPaciente");
const { BOTONES } = require("../services/BotWhatsAppServicio");
const { textoLocal } = require("../herramientas/tiempo");
const { error } = require("./mensajesDeError");

const RUTA = "/paciente/mensajes";
const COMPROBANTE = "Comprobante de reserva";
const { crearLogicaMensajes, canalDe, idDe, activo, habilitado } = require("./logicaMensajes");
const rutaBandeja = (canal, id) => RUTA + "?" + new URLSearchParams({ canal: canal.toLowerCase(), mensaje: canal === "Correo" ? id : "hermandad" });

function crearControladorMensajesDelPaciente(aplicacion) {
  const { contexto, citaDe, disponible, respondida, decidir } = crearLogicaMensajes(aplicacion);
  const conCuenta = (fn) => async (a) => {
    if (!habilitado(aplicacion)) return { estado: 404, html: "<p>Página no disponible.</p>" };
    if (!a.paciente) return { redirigir: "/paciente/cuenta" };
    return fn(a, await contexto(a.paciente));
  };
  const construir = async ({ consulta, paciente }, ctx, estado) => {
    const eleccion = consulta.get("canal");
    const canal = eleccion === "correo" || (eleccion !== "whatsapp" && !ctx.mensajes.some((m) => canalDe(m) === "WhatsApp") &&
      ctx.mensajes.some((m) => canalDe(m) === "Correo")) ? "Correo" : "WhatsApp";
    const mensajes = await Promise.all(ctx.mensajes.filter((m) => canalDe(m) === canal).map(async (m) => {
      const cita = citaDe(ctx, m), id = idDe(m);
      const citaEditable = await disponible(ctx, m);
      const botones = citaEditable ? BOTONES.filter((b) => m.botones.includes(b) && (b !== BOTONES[0] || cita.estadoConfirmacion !== "CONFIRMADA")) : [];
      const encuesta = m.tipo === ENCUESTA_ATENCION && webAtendida(cita);
      return {
        ...m,
        id,
        titulo: m.tipo || (canal === "Correo" ? "Aviso de Hermandad de Dolores" : ""),
        acciones: botones.map((texto) => ({ texto, post: { id, decision: texto, canal } })),
        enlaceComprobante: m.tipo === COMPROBANTE && cita.estadoReserva === "ACTIVA" ? `/paciente/comprobante.pdf?idCita=${cita.id}` : null,
        enlaceEncuesta: encuesta ? RUTA + "/encuesta?" + new URLSearchParams({ id }) : null,
        encuestaRespondida: encuesta && respondida(cita),
        resultado: m.botones?.length && canal === "Correo" ?
          (cita.estadoReserva === "CANCELADA" ? "Tu hora quedó cancelada." :
            cita.estadoConfirmacion === "CONFIRMADA" ? "Tu asistencia quedó confirmada." : "") : "",
      };
    }));
    const ultimo = mensajes.at(-1);
    const elementos = canal === "Correo" ? [...mensajes].reverse().map((m) => ({
      id: m.id, titulo: m.titulo, nombre: paciente.nombre, destino: m.correo, fecha: m.fecha, mensajes: [m],
    })) : ultimo ? [{ id: "hermandad", fecha: ultimo.fecha, resumen: ultimo.texto, mensajes }] : [];
    const seleccionado = elementos.find((e) => e.id === consulta.get("mensaje"));
    return paginaMensajesPaciente({ canal, elementos, seleccionado: seleccionado || elementos[0], seleccionExplicita: !!seleccionado, estado });
  };
  const encuesta = (post) => conCuenta(async (a, ctx) => {
    const id = post ? a.cuerpo.id : a.consulta.get("id");
    const mensaje = ctx.mensajes.find((x) => idDe(x) === id && x.tipo === ENCUESTA_ATENCION && x.direccion === "SALIENTE");
    if (!mensaje || !webAtendida(citaDe(ctx, mensaje))) return { estado: 404, html: "<p>Encuesta no disponible.</p>" };
    const cita = citaDe(ctx, mensaje), volver = rutaBandeja(canalDe(mensaje), id);
    if (post && !respondida(cita)) {
      try {
        await aplicacion.encuestas.registrar({ rut: a.paciente.rut, nota: a.cuerpo.nota, comentario: a.cuerpo.comentario }, cita.id);
      } catch (e) {
        return { estado: 400, html: paginaEncuestaPaciente({ id, volver, estado: error(e), nota: a.cuerpo.nota, comentario: a.cuerpo.comentario }) };
      }
      return { redirigir: RUTA + "/encuesta?" + new URLSearchParams({ id }) };
    }
    return { html: paginaEncuestaPaciente({ id, volver, respondida: respondida(cita) }) };
  });
  return {
    bandeja: conCuenta(async (a, ctx) => ({ html: await construir(a, ctx) })),
    responder: conCuenta(async (a, ctx) => {
      const cuerpo = a.cuerpo;
      const mensaje = ctx.mensajes.find((x) => idDe(x) === cuerpo.id);
      if (!mensaje || canalDe(mensaje) !== cuerpo.canal) return { estado: 404, html: "<p>Mensaje no disponible.</p>" };
      if (!BOTONES.includes(cuerpo.decision) || !mensaje.botones?.includes(cuerpo.decision) || !(await disponible(ctx, mensaje)))
        return { redirigir: rutaBandeja(canalDe(mensaje), cuerpo.id) };
      await decidir(ctx, mensaje, cuerpo.decision);
      return { redirigir: rutaBandeja(canalDe(mensaje), cuerpo.id) };
    }),
    encuesta: encuesta(false),
    responderEncuesta: encuesta(true),
  };
}

module.exports = { crearControladorMensajesDelPaciente, habilitado };

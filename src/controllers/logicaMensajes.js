"use strict";
const { BOTONES } = require("../services/BotWhatsAppServicio");
const { textoLocal } = require("../herramientas/tiempo");

const canalDe = (m) => m.canal || "WhatsApp";
const idDe = (m) => "b-" + m.id;
const activo = (aplicacion, canal) => aplicacion.despachador.transportes[canal]?.simulado === true;
const habilitado = (aplicacion) => activo(aplicacion, "Correo") || activo(aplicacion, "WhatsApp");

function crearLogicaMensajes(aplicacion) {
  const contexto = async (paciente) => {
    const citas = new Map((await aplicacion.citaRepo.buscarPorRut(paciente.rut)).map((x) => [x.id, x]));
    const ficha = await aplicacion.catalogo.paciente(paciente.rut);
    const mensajes = aplicacion.extras.listar("bandeja").filter((m) => citas.has(Number(m.idCita)) && activo(aplicacion, canalDe(m)));
    return { citas, mensajes, ficha };
  };
  const citaDe = (ctx, m) => ctx.citas.get(Number(m.idCita));
  const disponible = async (ctx, m) => {
    const cita = citaDe(ctx, m);
    if (m.direccion !== "SALIENTE" || !m.botones?.some((b) => BOTONES.includes(b)) ||
        cita.estadoReserva !== "ACTIVA" || cita.asistencia || !aplicacion.bot.consiente(cita.rut)) return false;
    const whatsapp = canalDe(m) === "WhatsApp";
    if (whatsapp ? !ctx.ficha?.tieneWhatsapp || ctx.ficha.telefono !== m.telefono : !m.correo || ctx.ficha?.correo !== m.correo) return false;
    const bloque = await aplicacion.catalogo.bloque(cita.idBloque);
    return !!bloque && `${bloque.fecha} ${bloque.hora}` > textoLocal();
  };
  const respondida = (cita) => aplicacion.extras.listar("encuestas").some((e) => e.idCita === cita.id);
  const reservaRespondida = (cita) => aplicacion.extras.listar("encuestasAgendamiento").some((e) => e.idCita === cita.id);

  // Aplica Confirmar o Cancelar mi hora desde un mensaje. Devuelve false si ya no corresponde.
  const decidir = async (ctx, mensaje, decision) => {
    if (!BOTONES.includes(decision) || !mensaje.botones?.includes(decision) || !(await disponible(ctx, mensaje))) return false;
    const cita = citaDe(ctx, mensaje);
    const confirmar = decision === BOTONES[0];
    if (confirmar && cita.estadoConfirmacion === "CONFIRMADA") return false;
    if (canalDe(mensaje) === "WhatsApp") await aplicacion.bot.responder({ idCita: cita.id, boton: decision });
    else if (confirmar) await aplicacion.citaRepo.actualizar({ ...cita, estadoConfirmacion: "CONFIRMADA" });
    else await aplicacion.agendamiento.cancelar(cita.id, "ASISTIDA");
    aplicacion.operacion.aud({ id: null, nombre: `Paciente (${canalDe(mensaje)} simulado)` },
      confirmar ? "Asistencia confirmada desde el mensaje" : "Reserva cancelada desde el mensaje",
      "Comunicaciones", cita.id, null, { canal: canalDe(mensaje), idMensaje: mensaje.id });
    return true;
  };
  return { contexto, citaDe, disponible, respondida, reservaRespondida, decidir };
}

module.exports = { crearLogicaMensajes, canalDe, idDe, activo, habilitado };

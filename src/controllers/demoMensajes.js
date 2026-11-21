"use strict";
const vistas = require("../views/demoMensajes");
const { crearLogicaMensajes, canalDe, idDe, activo, habilitado } = require("./logicaMensajes");
const { ENCUESTA_ATENCION, webAtendida } = require("../services/ComunicacionesPaciente");
const { BOTONES } = require("../services/BotWhatsAppServicio");
const { normalizarRut } = require("../herramientas/rut");
const { hoy } = require("../herramientas/tiempo");
const { error } = require("./mensajesDeError");

const RUTA = "/demo/mensajes";
const urlPaciente = (rut, canal, id, aviso) => RUTA + "?" + new URLSearchParams({ rut, canal: canal.toLowerCase(), ...(id ? { mensaje: id } : {}), ...(aviso ? { aviso } : {}) });
const AVISOS = {
  enviado: { tipo: "ok", texto: "El bot envió el siguiente aviso programado." },
  nada: { tipo: "ok", texto: "No hay más avisos programados para este paciente." },
  activado: { tipo: "ok", texto: "Listo: el paciente quedó con WhatsApp y con consentimiento para la demostración, y se envió el comprobante de su próxima hora." },
  "sin-horas": { tipo: "error", texto: "Este paciente no tiene horas reservadas: reserva una hora y vuelve a intentarlo." },
  "no-se-pudo": { tipo: "error", texto: "No se pudo activar WhatsApp para este paciente. Revisa que su ficha tenga celular." },
  omitido: { tipo: "error", texto: "El aviso no se envió: la hora ya está confirmada o cancelada." },
  "sin-whatsapp": { tipo: "error", texto: "Este paciente no tiene WhatsApp registrado, así que el bot no le envía mensajes. Sus avisos llegan por correo." },
  "sin-consentimiento": { tipo: "error", texto: "Este paciente no aceptó recibir avisos por WhatsApp o correo, así que el bot no le envía mensajes." },
};
const ATAJOS = { confirmar: 0, "confirmar cita": 0, "confirmar mi hora": 0, cancelar: 1, "cancelar mi hora": 1, "cancelar cita": 1 };

function crearControladorDemoMensajes(aplicacion) {
  const logica = crearLogicaMensajes(aplicacion);
  const noDisponible = { estado: 404, html: "<p>Página no disponible.</p>" };
  const conDemo = (fn) => async (a) => (habilitado(aplicacion) ? fn(a) : noDisponible);

  const motivoSinWhatsapp = (ficha) =>
    !ficha.tieneWhatsapp || !ficha.telefono ? "sin-whatsapp" : !aplicacion.bot.consiente(ficha.rut) ? "sin-consentimiento" : null;

  const fichaDe = async (rut) => (rut ? aplicacion.catalogo.paciente(normalizarRut(rut)) : null);

  const proximaCita = async (rut) => {
    const bloques = new Map((await aplicacion.catalogo.bloques()).map((b) => [b.id, b]));
    return (await aplicacion.citaRepo.buscarPorRut(rut))
      .filter((c) => c.estadoReserva === "ACTIVA" && bloques.get(c.idBloque)?.fecha >= hoy())
      .sort((a, b) => `${bloques.get(a.idBloque).fecha} ${bloques.get(a.idBloque).hora}`.localeCompare(`${bloques.get(b.idBloque).fecha} ${bloques.get(b.idBloque).hora}`))[0] || null;
  };

  const conHorasSinMensajes = async (excluidos) => {
    const bloques = new Map((await aplicacion.catalogo.bloques()).map((b) => [b.id, b]));
    const proxima = new Map();
    for (const cita of await aplicacion.citaRepo.listar()) {
      const fecha = bloques.get(cita.idBloque)?.fecha;
      if (cita.estadoReserva !== "ACTIVA" || !fecha || fecha < hoy() || excluidos.has(cita.rut)) continue;
      if (!proxima.has(cita.rut) || fecha < proxima.get(cita.rut)) proxima.set(cita.rut, fecha);
    }
    const lista = [];
    for (const [rut, fecha] of [...proxima].sort((a, b) => a[1].localeCompare(b[1])).slice(0, 12)) {
      const ficha = await aplicacion.catalogo.paciente(rut);
      if (ficha) lista.push({ rut, nombre: ficha.nombre || rut, fecha, whatsapp: !!ficha.tieneWhatsapp });
    }
    return lista;
  };

  const tarjetas = async () => {
    const porRut = new Map();
    for (const m of aplicacion.extras.listar("bandeja")) {
      if (m.direccion !== "SALIENTE" || !activo(aplicacion, canalDe(m))) continue;
      const cita = await aplicacion.citaRepo.buscarPorId(m.idCita);
      if (!cita) continue;
      const ficha = await aplicacion.catalogo.paciente(cita.rut);
      const fila = porRut.get(cita.rut) || { rut: cita.rut, nombre: ficha?.nombre || cita.rut, whatsapp: 0, correo: 0 };
      fila[canalDe(m) === "Correo" ? "correo" : "whatsapp"]++;
      porRut.set(cita.rut, fila);
    }
    return [...porRut.values()];
  };

  const modelo = async (ctx, m, rut) => {
    const cita = logica.citaDe(ctx, m);
    const id = idDe(m);
    const editable = await logica.disponible(ctx, m);
    const acciones = editable ? BOTONES.filter((b) => m.botones.includes(b) && (b !== BOTONES[0] || cita.estadoConfirmacion !== "CONFIRMADA")) : [];
    const deAtencion = m.tipo === ENCUESTA_ATENCION && webAtendida(cita);
    const deReserva = m.direccion === "SALIENTE" && m.encuestaReserva === true;
    const hayEncuesta = deAtencion || deReserva;
    const esCorreo = canalDe(m) === "Correo";
    return {
      ...m,
      id,
      titulo: m.tipo || "Aviso de Hermandad de Dolores",
      acciones,
      enlaceEncuesta: hayEncuesta ? `${RUTA}/encuesta?` + new URLSearchParams({ rut, id }) : null,
      encuestaRespondida: hayEncuesta && (deAtencion ? logica.respondida(cita) : logica.reservaRespondida(cita)),
      resultado: esCorreo && m.botones?.length
        ? (cita.estadoReserva === "CANCELADA" ? "Tu hora quedó cancelada." : cita.estadoConfirmacion === "CONFIRMADA" ? "Tu asistencia quedó confirmada." : "")
        : "",
    };
  };

  const encuestaDe = async (rut, id) => {
    const ficha = await fichaDe(rut);
    if (!ficha) return null;
    const ctx = await logica.contexto(ficha);
    const mensaje = ctx.mensajes.find((m) => idDe(m) === id && m.direccion === "SALIENTE");
    if (!mensaje) return null;
    const cita = logica.citaDe(ctx, mensaje);
    const tipo = mensaje.tipo === ENCUESTA_ATENCION && webAtendida(cita) ? "atencion" : mensaje.encuestaReserva === true ? "reserva" : null;
    return tipo ? { ficha, mensaje, cita, tipo } : null;
  };

  return {
    ver: conDemo(async ({ consulta }) => {
      const rut = consulta.get("rut");
      if (!rut) {
        const pacientes = await tarjetas();
        return { html: vistas.indice({ pacientes, conHoras: await conHorasSinMensajes(new Set(pacientes.map((p) => p.rut))) }) };
      }
      const ficha = await fichaDe(rut);
      if (!ficha) return { estado: 404, html: vistas.indice({ pacientes: await tarjetas(), conHoras: [], estado: { tipo: "error", texto: "No encontramos a ese paciente." } }) };
      const ctx = await logica.contexto(ficha);
      const salientes = (canal) => ctx.mensajes.filter((m) => canalDe(m) === canal);
      const eleccion = consulta.get("canal");
      const canal = eleccion === "correo" || (eleccion !== "whatsapp" && !salientes("WhatsApp").length && salientes("Correo").length) ? "correo" : "whatsapp";
      const mensajes = await Promise.all(salientes(canal === "correo" ? "Correo" : "WhatsApp").map((m) => modelo(ctx, m, ficha.rut)));
      const seleccionado = mensajes.find((m) => m.id === consulta.get("mensaje")) || (canal === "correo" ? mensajes.at(-1) : null);
      const vacio = canal === "whatsapp" && !mensajes.length ? motivoSinWhatsapp(ficha) || "sin-mensajes" : null;
      const activable = vacio ? !!(await proximaCita(ficha.rut)) : false;
      return { html: vistas.paciente({ paciente: ficha, canal, mensajes, seleccionado, vacio, activable, estado: AVISOS[consulta.get("aviso")] }) };
    }),
    responder: conDemo(async ({ cuerpo }) => {
      const ficha = await fichaDe(cuerpo.rut);
      if (!ficha) return noDisponible;
      const ctx = await logica.contexto(ficha);
      const mensaje = ctx.mensajes.find((m) => idDe(m) === cuerpo.id && canalDe(m) === cuerpo.canal);
      if (!mensaje) return noDisponible;
      await logica.decidir(ctx, mensaje, cuerpo.decision);
      return { redirigir: urlPaciente(ficha.rut, canalDe(mensaje), cuerpo.id) };
    }),
    enviar: conDemo(async ({ cuerpo }) => {
      const ficha = await fichaDe(cuerpo.rut);
      if (!ficha) return noDisponible;
      const ctx = await logica.contexto(ficha);
      const texto = String(cuerpo.texto || "").trim().slice(0, 300);
      const ultimo = ctx.mensajes.filter((m) => canalDe(m) === "WhatsApp" && m.direccion === "SALIENTE").at(-1);
      if (texto && ultimo && ficha.tieneWhatsapp && aplicacion.bot.consiente(ficha.rut)) {
        const atajo = ATAJOS[texto.toLowerCase().replace(/\s+/g, " ")];
        const boton = atajo === undefined ? texto : BOTONES[atajo];
        await aplicacion.bot.responder({ idCita: ultimo.idCita, boton });
        if (atajo !== undefined)
          aplicacion.operacion.aud({ id: null, nombre: "Paciente (WhatsApp simulado)" }, atajo === 0 ? "Asistencia confirmada desde el mensaje" : "Reserva cancelada desde el mensaje", "Comunicaciones", ultimo.idCita, null, { canal: "WhatsApp", escrito: true });
      }
      return { redirigir: urlPaciente(ficha.rut, "WhatsApp") };
    }),
    activarWhatsapp: conDemo(async ({ cuerpo }) => {
      const ficha = await fichaDe(cuerpo.rut);
      if (!ficha) return noDisponible;
      const cita = await proximaCita(ficha.rut);
      if (!cita) return { redirigir: urlPaciente(ficha.rut, "WhatsApp", null, "sin-horas") };
      try {
        if (!ficha.tieneWhatsapp) await aplicacion.catalogo.actualizarPaciente(ficha.rut, { ...ficha, tieneWhatsapp: true });
        if (!aplicacion.bot.consiente(ficha.rut))
          aplicacion.operacion.registrarConsentimiento(ficha.rut, { canal: "Demostración", comunicaciones: true, usuario: { id: null, nombre: "Demostración" } });
        const yaEnviado = aplicacion.extras.listar("bandeja").some((m) => m.idCita === cita.id && m.tipo === "Comprobante de reserva" && canalDe(m) === "WhatsApp");
        if (!yaEnviado) {
          const comunicacion = await aplicacion.operacion.comunicar({ id: null, nombre: "Demostración" }, cita, "WhatsApp", "Comprobante de reserva");
          await aplicacion.despachador.enviar(comunicacion);
        }
      } catch (e) {
        console.error("No se pudo activar WhatsApp en la demostración:", e.message);
        return { redirigir: urlPaciente(ficha.rut, "WhatsApp", null, "no-se-pudo") };
      }
      return { redirigir: urlPaciente(ficha.rut, "WhatsApp", null, "activado") };
    }),
    avanzar: conDemo(async ({ cuerpo }) => {
      const ficha = await fichaDe(cuerpo.rut);
      if (!ficha) return noDisponible;
      const motivo = motivoSinWhatsapp(ficha);
      if (motivo) return { redirigir: urlPaciente(ficha.rut, "WhatsApp", null, motivo) };
      const resultado = await aplicacion.bot.avanzarAlSiguienteAviso(ficha.rut);
      return { redirigir: urlPaciente(ficha.rut, "WhatsApp", null, !resultado ? "nada" : resultado.enviados > 0 ? "enviado" : "omitido") };
    }),
    encuesta: conDemo(async ({ consulta }) => {
      const e = await encuestaDe(consulta.get("rut"), consulta.get("id"));
      if (!e) return { estado: 404, html: "<p>Encuesta no disponible.</p>" };
      const respondida = e.tipo === "atencion" ? logica.respondida(e.cita) : logica.reservaRespondida(e.cita);
      return { html: vistas.encuesta({ rut: e.ficha.rut, id: consulta.get("id"), tipo: e.tipo, respondida }) };
    }),
    responderEncuesta: conDemo(async ({ cuerpo }) => {
      const e = await encuestaDe(cuerpo.rut, cuerpo.id);
      if (!e) return { estado: 404, html: "<p>Encuesta no disponible.</p>" };
      const ya = e.tipo === "atencion" ? logica.respondida(e.cita) : logica.reservaRespondida(e.cita);
      if (!ya) {
        try {
          if (e.tipo === "atencion") await aplicacion.encuestas.registrar({ rut: e.ficha.rut, nota: cuerpo.nota, comentario: cuerpo.comentario }, e.cita.id);
          else await aplicacion.encuestas.registrarAgendamiento({ idCita: e.cita.id, nota: cuerpo.nota, comentario: cuerpo.comentario, canal: canalDe(e.mensaje) });
        } catch (fallo) {
          return { estado: 400, html: vistas.encuesta({ rut: e.ficha.rut, id: cuerpo.id, tipo: e.tipo, estado: error(fallo), nota: cuerpo.nota, comentario: cuerpo.comentario }) };
        }
      }
      return { redirigir: urlPaciente(e.ficha.rut, canalDe(e.mensaje), cuerpo.id) };
    }),
  };
}

module.exports = { crearControladorDemoMensajes };

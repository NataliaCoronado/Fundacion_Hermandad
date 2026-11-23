"use strict";
const { crearControladorAdmin } = require("./controllers/admin");
const { crearControladorAtencionDelDia } = require("./controllers/atencionDelDia");
const { crearControladorPaciente } = require("./controllers/paciente");
const { crearControladorAuth } = require("./controllers/autenticacion");
const { crearControladorReserva } = require("./controllers/reserva");
const { rutaAgenda } = require("./auth/permisos");

function crearRutas(aplicacion) {
  const admin = crearControladorAdmin(aplicacion);
  const tens = crearControladorAtencionDelDia(aplicacion);
  const paciente = crearControladorPaciente(aplicacion);
  const auth = crearControladorAuth(aplicacion);
  const reserva = crearControladorReserva(aplicacion);
  const cuenta = require("./controllers/cuentaDelPaciente").crearControladorCuentaDelPaciente(aplicacion, reserva);
  const r = (metodo, ruta, area, manejador) => ({
    metodo,
    ruta,
    area,
    manejador,
  });
  const irAAgenda = ({ usuario, consulta }) => {
    const filtros = new URLSearchParams(consulta);
    filtros.delete("q");
    const agenda = rutaAgenda(usuario.rol);
    return { redirigir: filtros.size ? agenda + "?" + filtros : agenda };
  };
  const get = (ruta, area, m) => r("GET", ruta, area, m);
  const post = (ruta, area, m) => r("POST", ruta, area, m);
  const mensajesPaciente = require("./controllers/mensajesDelPaciente").crearControladorMensajesDelPaciente(aplicacion);
  const demoMensajes = require("./controllers/demoMensajes").crearControladorDemoMensajes(aplicacion);
  const controladorOperacion = require("./controllers/operacion").crearControladorOperacion(aplicacion);
  const rep = require("./controllers/reportes").crearControladorReportes(aplicacion);
  const extra = require("./controllers/cancelacionesYReprogramaciones").crearControladorCancelacionesYReprogramaciones(aplicacion);
  const nuevas = [
    get("/admin/cancelaciones", "admin", extra.cancelaciones),
    post("/admin/cancelaciones", "admin", extra.cancelar),
    get("/admin/cancelaciones/reprogramar", "admin", extra.reprogramar),
    post("/admin/cancelaciones/reprogramar", "admin", extra.reprogramarGuardar),
    get("/admin/cupos/rango", "admin", extra.rango),
    post("/admin/cupos/rango", "admin", extra.rangoAplicar),
    post("/admin/equipo/eliminar", "admin", extra.equipoEliminar),
    post("/admin/comunicacion","admin",controladorOperacion.comunicacion),post("/admin/reagendar","admin",controladorOperacion.reagendar),
    get("/admin/reportes", "admin", rep.ver),
    get("/admin/reportes/exportar", "admin", rep.exportar),
    get("/admin/reportes/agenda.json", "admin", rep.agendaJson),
    get("/admin/resumen", "admin", controladorOperacion.resumen),
    get("/admin/panel", "admin", irAAgenda),
    get("/admin/agendas", "admin", controladorOperacion.adminAgenda),
    get("/admin/bloque/nuevo", "admin", controladorOperacion.bloqueNuevo),
    post("/admin/bloque/revisar", "admin", controladorOperacion.bloqueRevisar),
    post("/admin/bloque/guardar", "admin", controladorOperacion.bloqueGuardar),
    get("/admin/profesionales", "admin", controladorOperacion.equipo),
    post("/admin/profesionales/estado", "admin", controladorOperacion.equipoEstado),
    post("/admin/equipo/revisar", "admin", controladorOperacion.equipoRevisar),
    post("/admin/equipo/guardar", "admin", controladorOperacion.equipoGuardar),
    get("/admin/policlinicos", "admin", controladorOperacion.lugares),
    post("/admin/lugar", "admin", controladorOperacion.lugarGuardar),
    post("/admin/especialidad", "admin", controladorOperacion.especialidadGuardar),
    get("/admin/colores", "admin", controladorOperacion.colores),
    get("/admin/cambios", "admin", controladorOperacion.cambios),
    post("/admin/cambio/revisar", "admin", controladorOperacion.cambioRevisar),
    post("/admin/cambio/guardar", "admin", controladorOperacion.cambioGuardar),
    get("/admin/cupo", "admin", controladorOperacion.cupo),
    post("/admin/cupo/estado", "admin", controladorOperacion.cupoEstado),
    get("/admin/espera", "admin", controladorOperacion.supervision),
    get("/admin/comunicaciones", "admin", controladorOperacion.comunicaciones),
    get("/admin/usuarios", "admin", controladorOperacion.usuarios),
    post("/admin/usuario", "admin", controladorOperacion.usuarioGuardar),
    post("/admin/usuario/enlace", "admin", controladorOperacion.usuarioEnlace),
    get("/admin/auditoria", "admin", controladorOperacion.auditoria),
    get("/restablecer", null, controladorOperacion.restablecer),
    post("/restablecer", null, controladorOperacion.guardarClave),
    get("/tens/resumen", "tens", controladorOperacion.resumen),
    get("/tens/panel", "tens", irAAgenda),
    get("/tens/agenda", "tens", controladorOperacion.tensAgenda),
    get("/tens/pacientes", "tens", controladorOperacion.pacientes),
    get("/tens/ficha", "tens", controladorOperacion.ficha),
    post("/tens/paciente/preferencias", "tens", controladorOperacion.preferencias),
    post("/tens/paciente/desactivar", "tens", controladorOperacion.desactivar),
    get("/tens/reserva", "tens", controladorOperacion.reserva),
    post("/tens/flujo", "tens", controladorOperacion.flujo),
    post("/tens/cancelar", "tens", controladorOperacion.cancelar),
    post("/tens/reagendar", "tens", controladorOperacion.reagendar),
    get("/tens/espera", "tens", controladorOperacion.espera),
    post("/tens/espera/gestion", "tens", controladorOperacion.esperaGestion),
    post("/tens/comunicacion", "tens", controladorOperacion.comunicacion),
    post("/tens/enlace", "tens", controladorOperacion.enlace),
    post("/tens/documentos/archivar", "tens", controladorOperacion.documentoArchivar),
  ];
  const todas = [
    ...nuevas,
    get("/paciente/cuenta", null, cuenta.acceso),
    get("/paciente/cuenta/crear", null, cuenta.crear),
    get("/paciente/cuenta/recuperar", null, cuenta.recuperar),
    post("/paciente/cuenta/acceso", null, cuenta.enviar),
    post("/paciente/salir", null, cuenta.salir),
    get("/paciente/mis-horas", null, cuenta.misHoras),
    get("/demo/mensajes", null, demoMensajes.ver),
    post("/demo/mensajes/responder", null, demoMensajes.responder),
    post("/demo/mensajes/enviar", null, demoMensajes.enviar),
    post("/demo/mensajes/avanzar", null, demoMensajes.avanzar),
    post("/demo/mensajes/activar-whatsapp", null, demoMensajes.activarWhatsapp),
    get("/demo/mensajes/encuesta", null, demoMensajes.encuesta),
    post("/demo/mensajes/encuesta", null, demoMensajes.responderEncuesta),
    get("/paciente/mensajes", null, mensajesPaciente.bandeja),
    post("/paciente/mensajes/responder", null, mensajesPaciente.responder),
    get("/paciente/mensajes/encuesta", null, mensajesPaciente.encuesta),
    post("/paciente/mensajes/encuesta", null, mensajesPaciente.responderEncuesta),
    get("/paciente/mis-datos", null, cuenta.misDatos),
    post("/paciente/mis-datos", null, cuenta.guardarDatos),
    get("/paciente/mis-documentos", null, cuenta.misDocumentos),
    post("/paciente/mis-documentos", null, cuenta.subirDocumento),
    get("/paciente/mis-documentos/archivo", null, cuenta.archivoDocumento),
    get("/paciente/familiares", null, cuenta.familiares),
    post("/paciente/familiares/solicitar", null, cuenta.solicitarFamiliar),
    get("/paciente/comprobante.pdf", null, cuenta.comprobante),
    get("/", null, reserva.inicio),
    get("/agendar", null, reserva.inicio),
    post("/agendar", null, reserva.iniciar),
    get("/agendar/calendario", null, reserva.calendario),
    get("/agendar/datos", null, reserva.datos),
    post("/agendar/datos", null, reserva.guardarDatos),
    get("/agendar/revisar", null, reserva.revisar),
    post("/agendar/confirmar", null, reserva.confirmar),
    get("/agendar/comprobante.pdf", null, reserva.comprobante),
    get("/agendar/encuesta", null, reserva.encuestaAgendamiento),
    post("/agendar/encuesta", null, reserva.responderEncuestaAgendamiento),
    get("/ayuda", null, paciente.ayuda),
    get("/privacidad", null, paciente.privacidad),
    get("/login", null, auth.formulario),
    post("/login", null, auth.entrar),
    post("/logout", null, auth.salir),
    get("/paciente/consulta", null, paciente.formulario),
    post("/paciente/consulta", null, paciente.consultar),
    get("/paciente/encuesta", null, paciente.encuesta),
    post("/paciente/encuesta", null, paciente.responderEncuesta),

    get("/tens/agenda", "tens", tens.agenda),
    get("/tens/pacientes", "tens", tens.pacientes),
    post("/tens/pacientes", "tens", tens.crearPaciente),
    get("/tens/pacientes/editar", "tens", tens.editarPaciente),
    post("/tens/pacientes/editar", "tens", tens.guardarPaciente),
    get("/tens/agendar", "tens", tens.agendar),
    post("/tens/agendar", "tens", tens.registrarCita),
    get("/tens/confirmaciones", "tens", tens.confirmaciones),
    post("/tens/confirmaciones", "tens", tens.registrarContacto),
    get("/tens/espera", "tens", tens.espera),
    post("/tens/espera", "tens", tens.registrarEspera),
    post("/tens/espera/asignar", "tens", tens.asignarEspera),
    post("/tens/espera/retirar", "tens", tens.retirarEspera),
    post("/tens/espera/soltar", "tens", tens.soltarEspera),
    get("/tens/recepcion", "tens", tens.recepcion),
    post("/tens/recepcion", "tens", tens.registrarAsistencia),
    post("/tens/recepcion/llegada", "tens", tens.registrarLlegada),
    post("/tens/recepcion/cancelar", "tens", tens.cancelarAsistida),
    get("/tens/documentos", "tens", tens.documentos),
    post("/tens/documentos", "tens", tens.registrarDocumento),
    post("/tens/documentos/verificar", "tens", tens.verificarDocumento),
    post("/tens/documentos/observar", "tens", tens.observarDocumento),
    get("/tens/documentos/archivo", "tens", tens.descargarDocumento),
    get("/tens/avisos", "tens", tens.avisos),
    post("/tens/avisos/leer", "tens", tens.leerAviso),

    get("/admin/policlinicos", "admin", admin.policlinicos),
    get("/admin/profesionales", "admin", admin.profesionales),
    post(
      "/admin/profesionales/estado",
      "admin",
      admin.cambiarEstadoProfesional,
    ),
    post("/admin/agendas", "admin", admin.crearBloque),
    post("/admin/agendas/publicar", "admin", admin.publicarCupos),
    post("/admin/agendas/serie", "admin", admin.serieCupos),
    post("/admin/agendas/masivo", "admin", admin.publicarMasivo),
    get("/admin/cambios", "admin", admin.cambios),
    post("/admin/cambios", "admin", admin.registrarCambio),
    get("/admin/reportes", "admin", admin.reportes),
    get("/admin/reportes/resumen.csv", "admin", admin.csvResumen),
    get("/admin/reportes/citas.csv", "admin", admin.csvCitas),
    get("/admin/reportes/profesionales.csv", "admin", admin.csvProfesionales),
    get("/admin/usuarios", "admin", admin.usuarios),
    get("/admin/auditoria", "admin", admin.auditoria),
  ];
  return todas;
}
module.exports = { crearRutas };

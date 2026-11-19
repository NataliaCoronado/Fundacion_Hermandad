"use strict";
const { crearAdminController } = require("./controllers/admin");
const { crearTensController } = require("./controllers/tens");
const { crearPacienteController } = require("./controllers/paciente");
const { crearAuthController } = require("./controllers/auth");
const { crearReservaController } = require("./controllers/reserva");
const { rutaAgenda } = require("./auth/permisos");

function crearRutas(c) {
  const admin = crearAdminController(c);
  const tens = crearTensController(c);
  const paciente = crearPacienteController(c);
  const auth = crearAuthController(c);
  const reserva = crearReservaController(c);
  const cuenta = require("./controllers/cuenta").crearCuentaController(c, reserva);
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
  const botActivo = process.env.BOT_WHATSAPP === "1";
  const op = require("./controllers/operacion").crearOperacionController(c);
  const rep = require("./controllers/reportes").crearReportesController(c);
  const extra = require("./controllers/gestionAdicional").crearGestionAdicionalController(c);
  const nuevas = [
    get("/admin/cancelaciones", "admin", extra.cancelaciones),
    post("/admin/cancelaciones", "admin", extra.cancelar),
    get("/admin/cancelaciones/reprogramar", "admin", extra.reprogramar),
    post("/admin/cancelaciones/reprogramar", "admin", extra.reprogramarGuardar),
    get("/admin/cupos/rango", "admin", extra.rango),
    post("/admin/cupos/rango", "admin", extra.rangoAplicar),
    post("/admin/equipo/eliminar", "admin", extra.equipoEliminar),
    post("/admin/comunicacion","admin",op.comunicacion),post("/admin/reagendar","admin",op.reagendar),
    get("/admin/reportes", "admin", rep.ver),
    get("/admin/reportes/exportar", "admin", rep.exportar),
    get("/admin/reportes/agenda.json", "admin", rep.agendaJson),
    get("/admin/resumen", "admin", op.resumen),
    get("/admin/panel", "admin", irAAgenda),
    get("/admin/agendas", "admin", op.adminAgenda),
    get("/admin/bloque/nuevo", "admin", op.bloqueNuevo),
    post("/admin/bloque/revisar", "admin", op.bloqueRevisar),
    post("/admin/bloque/guardar", "admin", op.bloqueGuardar),
    get("/admin/profesionales", "admin", op.equipo),
    post("/admin/profesionales/estado", "admin", op.equipoEstado),
    post("/admin/equipo/revisar", "admin", op.equipoRevisar),
    post("/admin/equipo/guardar", "admin", op.equipoGuardar),
    get("/admin/policlinicos", "admin", op.lugares),
    post("/admin/lugar", "admin", op.lugarGuardar),
    post("/admin/especialidad", "admin", op.especialidadGuardar),
    get("/admin/colores", "admin", op.colores),
    get("/admin/cambios", "admin", op.cambios),
    post("/admin/cambio/revisar", "admin", op.cambioRevisar),
    post("/admin/cambio/guardar", "admin", op.cambioGuardar),
    get("/admin/cupo", "admin", op.cupo),
    post("/admin/cupo/estado", "admin", op.cupoEstado),
    get("/admin/espera", "admin", op.supervision),
    get("/admin/comunicaciones", "admin", op.comunicaciones),
    get("/admin/usuarios", "admin", op.usuarios),
    post("/admin/usuario", "admin", op.usuarioGuardar),
    post("/admin/usuario/enlace", "admin", op.usuarioEnlace),
    get("/admin/auditoria", "admin", op.auditoria),
    get("/restablecer", null, op.restablecer),
    post("/restablecer", null, op.guardarClave),
    get("/tens/resumen", "tens", op.resumen),
    get("/tens/panel", "tens", irAAgenda),
    get("/tens/agenda", "tens", op.tensAgenda),
    get("/tens/pacientes", "tens", op.pacientes),
    get("/tens/ficha", "tens", op.ficha),
    post("/tens/paciente/preferencias", "tens", op.preferencias),
    post("/tens/paciente/desactivar", "tens", op.desactivar),
    get("/tens/reserva", "tens", op.reserva),
    post("/tens/flujo", "tens", op.flujo),
    post("/tens/cancelar", "tens", op.cancelar),
    post("/tens/reagendar", "tens", op.reagendar),
    get("/tens/espera", "tens", op.espera),
    post("/tens/espera/gestion", "tens", op.esperaGestion),
    get("/tens/comunicaciones", "tens", op.comunicaciones),
    post("/tens/comunicacion", "tens", op.comunicacion),
    post("/tens/enlace", "tens", op.enlace),
    post("/tens/documentos/archivar", "tens", op.documentoArchivar),
  ];
  const todas = [
    ...nuevas,
    get("/paciente/cuenta", null, cuenta.acceso),
    get("/paciente/cuenta/crear", null, cuenta.crear),
    get("/paciente/cuenta/recuperar", null, cuenta.recuperar),
    post("/paciente/cuenta/acceso", null, cuenta.enviar),
    post("/paciente/salir", null, cuenta.salir),
    get("/paciente/mis-horas", null, cuenta.misHoras),
    get("/paciente/mis-datos", null, cuenta.misDatos),
    post("/paciente/mis-datos", null, cuenta.guardarDatos),
    post("/paciente/mis-datos/correccion", null, cuenta.correccion),
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
    get("/tens/recepcion", "tens", tens.recepcion),
    post("/tens/recepcion", "tens", tens.registrarAsistencia),
    post("/tens/recepcion/llegada", "tens", tens.registrarLlegada),
    post("/tens/recepcion/cancelar", "tens", tens.cancelarAsistida),
    get("/tens/documentos", "tens", tens.documentos),
    post("/tens/documentos", "tens", tens.registrarDocumento),
    post("/tens/documentos/verificar", "tens", tens.verificarDocumento),
    post("/tens/documentos/observar", "tens", tens.observarDocumento),
    get("/tens/documentos/archivo", "tens", tens.descargarDocumento),
    get("/tens/bot", "tens", tens.bot),
    post("/tens/bot/ejecutar", "tens", tens.ejecutarBot),
    post("/tens/bot/responder", "tens", tens.responderBot),
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
  return todas.filter((x) => botActivo || !x.ruta.startsWith("/tens/bot"));
}
module.exports = { crearRutas };

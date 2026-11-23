"use strict";
const { crearDatos } = require("./models/datosIniciales");
const {
  RepositorioCitasEnMemoria,
} = require("./repositories/RepositorioCitasEnMemoria");
const {
  RepositorioCatalogoEnMemoria,
} = require("./repositories/RepositorioCatalogoEnMemoria");
const {
  RepositorioRegistrosComplementariosEnMemoria,
} = require("./repositories/RepositorioRegistrosComplementariosEnMemoria");
const { Sesiones } = require("./auth/Sesiones");
const { WhatsAppSimulado } = require("./mensajeria/WhatsAppSimulado");
const { WhatsAppMeta } = require("./mensajeria/WhatsAppMeta");
const { AgendamientoServicio } = require("./services/AgendamientoServicio");
const { ConfirmacionServicio } = require("./services/ConfirmacionServicio");
const { PacienteServicio } = require("./services/PacienteServicio");
const { EsperaServicio } = require("./services/EsperaServicio");
const { BotWhatsAppServicio } = require("./services/BotWhatsAppServicio");
const { CambioAgendaServicio } = require("./services/CambioAgendaServicio");
const { EncuestaServicio } = require("./services/EncuestaServicio");
const { DocumentoServicio } = require("./services/DocumentoServicio");
const { AuditoriaServicio } = require("./services/AuditoriaServicio");
const { AuthServicio } = require("./services/AuthServicio");
const { esProduccion } = require("./herramientas/entorno");
const { enviarComprobanteDeReserva } = require("./services/ComunicacionesPaciente");
const { textoLocal } = require("./herramientas/tiempo");
const { ReporteServicio } = require("./services/ReporteServicio");
const { WebhookWhatsApp } = require("./services/WebhookWhatsApp");
const {
  DespachadorComunicaciones,
  CorreoSimulado,
} = require("./services/DespachadorComunicaciones");

function crearContenedor({
  datos,
  db,
  demo = false,
  persistencia,
  whatsapp = process.env.WHATSAPP_MODO || "simulado",
} = {}) {
  const guardado = persistencia?.leer();
  const base =
    datos ||
    (!db && guardado) ||
    (demo && !db
      ? require("./models/datosDeDemostracion").agregarDemo(crearDatos())
      : crearDatos());
  let citaRepo;
  let catalogo;
  if (db) {
    const { RepositorioCitasPostgreSQL } = require("./repositories/RepositorioCitasPostgreSQL");
    const {
      RepositorioCatalogoPostgreSQL,
    } = require("./repositories/RepositorioCatalogoPostgreSQL");
    citaRepo = new RepositorioCitasPostgreSQL(db);
    catalogo = new RepositorioCatalogoPostgreSQL(db);
  } else {
    citaRepo = new RepositorioCitasEnMemoria(base);
    catalogo = new RepositorioCatalogoEnMemoria(base);
  }
  if (db && guardado) base.extras = guardado;
  base.extras.historial ||= [];
  for (const a of base.extras.auditoria || []) a.resultado ||= "EXITOSO";
  const TABLAS_EN_BD = ["auditoria", "documentos", "historial"];
  const rezagados = base.extras.legado_no_migrado || {};
  const heredado = db ? Object.fromEntries(TABLAS_EN_BD.map((t) => [t, [...(base.extras[t] || []), ...(rezagados[t] || [])]])) : {};
  if (db) delete base.extras.legado_no_migrado;
  const extras = db
    ? new (require("./repositories/RepositorioRegistrosComplementariosPostgreSQL").RepositorioRegistrosComplementariosPostgreSQL)(base.extras, db)
    : new RepositorioRegistrosComplementariosEnMemoria(base.extras);
  let extrasCargados = !db;
  citaRepo = new (require("./repositories/RepositorioCitasConHistorial").RepositorioCitasConHistorial)(citaRepo, extras);
  const sesiones = new Sesiones();
  const transporte =
    whatsapp === "meta" ? new WhatsAppMeta() : new WhatsAppSimulado(extras);
  const auditoria = new AuditoriaServicio(extras);
  const agendamiento = new AgendamientoServicio(citaRepo, catalogo, extras);
  const confirmacion = new ConfirmacionServicio(
    citaRepo,
    catalogo,
    agendamiento,
  );
  const pacientes = new PacienteServicio(catalogo);
  const espera = new EsperaServicio(catalogo, agendamiento, extras);
  agendamiento.alCancelar = async (cita, origen) => {
    if (!(await espera.retenerSiCorresponde(cita, origen))) return;
    const resultado = await espera.asignarAutomaticamente(cita.idBloque, cita.idUsuario);
    if (resultado) await avisarAsignacionAutomatica(resultado);
  };
  async function avisarAsignacionAutomatica({ cita, solicitud, bloque }) {
    const sistema = { id: null, nombre: "Lista de espera (automático)" };
    const paciente = await catalogo.paciente(cita.rut);
    const prof = await catalogo.profesional(bloque.idProfesional);
    const idPoliclinico = bloque.idPoliclinico || prof?.idPoliclinico;
    for (const aviso of extras.listar("notificaciones"))
      if (aviso.tipo === "CUPO_LIBERADO" && !aviso.leida && aviso.idBloque === bloque.id)
        extras.actualizar("notificaciones", aviso.id, { leida: true });
    let estadoComprobante;
    try {
      const comprobante = await enviarComprobanteDeReserva({ operacion, catalogo, despachador }, cita, sistema);
      estadoComprobante = comprobante?.estado;
    } catch {
      estadoComprobante = "Error";
    }
    const mensajesDeComprobante = {
      Enviado: "Se le envió el comprobante.",
      Simulado: "El comprobante quedó en la bandeja de simulación.",
      Pendiente: "El envío del comprobante está pendiente. Puedes llamar para avisarle.",
      Error: "Falló el envío del comprobante. Llámalo para avisarle.",
    };
    const contacto = mensajesDeComprobante[estadoComprobante]
      || "El paciente no tiene un canal de mensajería habilitado. Llámalo para avisarle.";
    await extras.agregar("notificaciones", {
      tipo: "CUPO_ASIGNADO_ESPERA",
      fecha: textoLocal(),
      idPoliclinico,
      leida: false,
      idBloque: bloque.id,
      idCita: cita.id,
      especialidad: solicitud.especialidad,
      texto: `Hora del ${bloque.fecha} ${bloque.hora} (${solicitud.especialidad}) asignada automáticamente a ${paciente?.nombre || cita.rut}, primero en la lista de espera. ${contacto} Si hay que cambiarla, puedes hacerlo desde la agenda.`,
    });
    auditoria.registrar(sistema, "Cupo asignado automáticamente desde lista de espera", `cita ${cita.id}`);
  }
  const bot = new BotWhatsAppServicio({
    citaRepo,
    catalogo,
    extras,
    transporte,
    agendamiento,
  });
  const despachador = new DespachadorComunicaciones({
    extras,
    catalogo,
    citaRepo,
    transportes: {
      WhatsApp: transporte,
      Correo: whatsapp === "meta" ? null : new CorreoSimulado(extras),
    },
  });
  const webhook = new WebhookWhatsApp({ extras, catalogo, citaRepo, bot, auditoria });
  const cambios = new CambioAgendaServicio({ citaRepo, catalogo, extras });
  const encuestas = new EncuestaServicio({ citaRepo, extras });
  const documentos = new DocumentoServicio({ catalogo, extras });
  const auth = new AuthServicio({ catalogo, sesiones, auditoria });
  const reportes = new ReporteServicio({
    citaRepo,
    catalogo,
    extras,
    encuestas,
  });

  const operacion =
    new (require("./services/OperacionServicio").OperacionServicio)({
      catalogo,
      citaRepo,
      extras,
      sesiones,
      auditoria,
      agendamiento,
    });
  async function inicializar() {
    if (!extrasCargados) {
      await extras.cargar(heredado);
      extrasCargados = true;
    }
    if (esProduccion() && process.env.CLAVE_DEMO)
      throw new Error("CLAVE_DEMO no puede usarse con NODE_ENV=production: elimina la variable y crea las cuentas con enlace de un solo uso.");
    const demo = esProduccion() ? null : process.env.CLAVE_DEMO || (db ? null : "demo1234");
    if (demo) await auth.sembrarClaveDemo(demo);
  }
  const sesionesPaciente = new Sesiones();
  const cuentas = new (require("./services/CuentaPacienteServicio").CuentaPacienteServicio)({
    catalogo,
    extras,
    citaRepo,
  });
  return {
    guardar: () => {
      if (!db) return persistencia?.guardar(base);
      const { auditoria, documentos, historial, ...resto } = base.extras;
      if (Object.values(extras.legado || {}).some((l) => l.length)) resto.legado_no_migrado = extras.legado;
      return persistencia?.guardar(resto);
    },
    operacion,
    sesionesPaciente,
    cuentas,
    modo: db ? "postgresql" : "memoria",
    citaRepo,
    catalogo,
    extras,
    sesiones,
    agendamiento,
    confirmacion,
    pacientes,
    espera,
    bot,
    despachador,
    webhook,
    cambios,
    encuestas,
    documentos,
    auditoria,
    auth,
    reportes,
    inicializar,
  };
}
module.exports = { crearContenedor };

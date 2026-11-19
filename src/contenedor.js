"use strict";
const { crearDatos } = require("./models/datos");
const {
  CitaRepositoryMemoria,
} = require("./repositories/CitaRepositoryMemoria");
const {
  CatalogoRepositoryMemoria,
} = require("./repositories/CatalogoRepositoryMemoria");
const {
  ExtrasRepositoryMemoria,
} = require("./repositories/ExtrasRepositoryMemoria");
const { Sesiones } = require("./auth/Sesiones");
const { WhatsAppSimulado } = require("./transport/WhatsAppSimulado");
const { WhatsAppMeta } = require("./transport/WhatsAppMeta");
const { AgendamientoService } = require("./services/AgendamientoService");
const { ConfirmacionService } = require("./services/ConfirmacionService");
const { PacienteService } = require("./services/PacienteService");
const { EsperaService } = require("./services/EsperaService");
const { BotWhatsAppService } = require("./services/BotWhatsAppService");
const { CambioAgendaService } = require("./services/CambioAgendaService");
const { EncuestaService } = require("./services/EncuestaService");
const { DocumentoService } = require("./services/DocumentoService");
const { AuditoriaService } = require("./services/AuditoriaService");
const { AuthService } = require("./services/AuthService");
const { ReporteService } = require("./services/ReporteService");
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
      ? require("./models/datosDemo").agregarDemo(crearDatos())
      : crearDatos());
  let citaRepo;
  let catalogo;
  if (db) {
    const { CitaRepositoryPg } = require("./repositories/CitaRepositoryPg");
    const {
      CatalogoRepositoryPg,
    } = require("./repositories/CatalogoRepositoryPg");
    citaRepo = new CitaRepositoryPg(db);
    catalogo = new CatalogoRepositoryPg(db);
  } else {
    citaRepo = new CitaRepositoryMemoria(base);
    catalogo = new CatalogoRepositoryMemoria(base);
  }
  if (db && guardado) base.extras = guardado;
  base.extras.historial ||= [];
  for (const a of base.extras.auditoria || []) a.resultado ||= "EXITOSO";
  // Con PostgreSQL, la auditoría, los documentos y el historial de citas se guardan en sus tablas.
  // Lo que hubiera en extras.json se migra una sola vez al iniciar.
  const TABLAS_EN_BD = ["auditoria", "documentos", "historial"];
  const rezagados = base.extras.legado_no_migrado || {};
  const heredado = db ? Object.fromEntries(TABLAS_EN_BD.map((t) => [t, [...(base.extras[t] || []), ...(rezagados[t] || [])]])) : {};
  if (db) delete base.extras.legado_no_migrado;
  const extras = db
    ? new (require("./repositories/ExtrasRepositoryPg").ExtrasRepositoryPg)(base.extras, db)
    : new ExtrasRepositoryMemoria(base.extras);
  let extrasCargados = !db;
  citaRepo = new (require("./repositories/CitaRepositoryConHistorial").CitaRepositoryConHistorial)(citaRepo, extras);
  const sesiones = new Sesiones();
  const transporte =
    whatsapp === "meta" ? new WhatsAppMeta() : new WhatsAppSimulado(extras);
  const auditoria = new AuditoriaService(extras);
  const agendamiento = new AgendamientoService(citaRepo, catalogo, extras);
  const confirmacion = new ConfirmacionService(
    citaRepo,
    catalogo,
    agendamiento,
  );
  const pacientes = new PacienteService(catalogo);
  const espera = new EsperaService(catalogo, agendamiento);
  const bot = new BotWhatsAppService({
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
  const cambios = new CambioAgendaService({ citaRepo, catalogo, extras });
  const encuestas = new EncuestaService({ citaRepo, extras });
  const documentos = new DocumentoService({ catalogo, extras });
  const auth = new AuthService({ catalogo, sesiones, auditoria });
  const reportes = new ReporteService({
    citaRepo,
    catalogo,
    extras,
    encuestas,
  });

  const operacion =
    new (require("./services/OperacionService").OperacionService)({
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
    const demo = process.env.CLAVE_DEMO || (db ? null : "demo1234");
    if (demo) await auth.sembrarClaveDemo(demo);
  }
  const sesionesPaciente = new Sesiones();
  const cuentas = new (require("./services/CuentaPacienteService").CuentaPacienteService)({
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

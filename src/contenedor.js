"use strict";
// Composición: aquí se eligen las implementaciones. Sin DATABASE_URL = datos de muestra en memoria; con DATABASE_URL = PostgreSQL.
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
  // demo = historial ficticio para mostrar el panel de Administración (solo modo memoria; las pruebas no lo usan).
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
  const extras = new ExtrasRepositoryMemoria(base.extras);
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
  // Envío de la bandeja de comunicaciones. Sin proveedor de correo real, el correo solo existe en modo simulado.
  const despachador = new DespachadorComunicaciones({
    extras,
    catalogo,
    citaRepo,
    transportes: {
      WhatsApp: transporte,
      Correo: whatsapp === "meta" ? null : new CorreoSimulado(extras),
    },
  });
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
  // En memoria siempre hay clave de demostración; con PostgreSQL solo si se define CLAVE_DEMO (nunca en producción).
  async function inicializar() {
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
    guardar: () => persistencia?.guardar(db ? base.extras : base),
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

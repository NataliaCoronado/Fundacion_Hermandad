"use strict";
const { notificarEncuestaAtencion } = require("../services/ComunicacionesPaciente");
const vistas = require("../views/operacion"),
  { tabla, raw, esc } = require("../views/componentesComunes");
const { cargarContexto } = require("./cargarListasBase");
const { normalizarRut } = require("../herramientas/rut");
const { hoy, sumarDias, textoLocal } = require("../herramientas/tiempo");
const { infoSede } = require("../models/informacionDeSedes");
const { fechaValida, ids } = require("../services/OperacionServicio");
const RUTA_AGENDA_PERSONAL = "/tens/agenda";
const RUTA_AGENDA_ADMIN = "/admin/agendas";

function urlAgenda(valor, ruta) {
  if (typeof valor !== "string" || valor.length > 4096) return undefined;
  if (valor === ruta) return valor;
  if (!valor.startsWith(ruta + "?")) return undefined;

  const filtros = new URLSearchParams(valor.slice(ruta.length + 1));
  const destino = new URLSearchParams();
  const fecha = filtros.get("fecha");
  const vista = filtros.get("vista");
  if (fechaValida(fecha)) destino.set("fecha", fecha);
  if (["dia", "semana", "lista"].includes(vista)) destino.set("vista", vista);
  const nombres = ruta === RUTA_AGENDA_ADMIN ? ["sede", "esp", "prof", "estado", "q"] : ["esp", "prof", "estado", "q"];
  for (const nombre of nombres) {
    const filtro = filtros.get(nombre);
    if (filtro) destino.set(nombre, filtro);
  }
  return destino.size ? ruta + "?" + destino : ruta;
}
const urlAgendaPersonal = (valor) => urlAgenda(valor, RUTA_AGENDA_PERSONAL);
const urlAgendaAdmin = (valor) => urlAgenda(valor, RUTA_AGENDA_ADMIN);

function crearControladorOperacion(aplicacion) {
  const {
    operacion: servicioOperacion,
    catalogo,
    citaRepo,
    extras,
    agendamiento,
    espera,
    auditoria,
  } = aplicacion;
  const contexto = async () => ({
    ...(await cargarContexto(catalogo)),
    comunas: await catalogo.comunas(),
    especialidades: await catalogo.especialidades(),
  });
  const visible = async (u, contextoExistente) => {
    const ctx = contextoExistente || await contexto();
    return (await citaRepo.listar()).filter(
      (x) =>
        servicioOperacion.sedeBloque(
          ctx.bloques.get(x.idBloque),
          ctx.profs.get(ctx.bloques.get(x.idBloque)?.idProfesional),
        ) === Number(u.idPoliclinico),
    );
  };
  const safe = (volver, fn) => async (r) => {
    try {
      return await fn(r);
    } catch (e) {
      if (e.message === "FUERA_DE_SEDE") throw e;
      const destino = typeof volver === "function" ? volver(r) : volver;
      return { estado: 400, html: vistas.errorPage(r.usuario, e, destino), rechazo: e.message };
    }
  };
  const redirect = (redirigir) => ({ redirigir });
  const detalleReserva = (idCita, volver, admin = false) => {
    const params = new URLSearchParams({ idCita });
    const volverAgenda = admin ? urlAgendaAdmin(volver) : urlAgendaPersonal(volver);
    if (volverAgenda) params.set("volverAgenda", volverAgenda);
    return (admin ? "/admin/cupo?" : "/tens/reserva?") + params;
  };
  const volverAgenda = ({ cuerpo }) =>
    urlAgendaPersonal(cuerpo.volverAgenda) || RUTA_AGENDA_PERSONAL;
  const volverAgendaAdmin = ({ cuerpo }) =>
    urlAgendaAdmin(cuerpo.volverAgenda) || RUTA_AGENDA_ADMIN;
  const getAgenda = async ({ usuario: u, consulta: q, token }, admin) => {
    const ruta = admin ? RUTA_AGENDA_ADMIN : RUTA_AGENDA_PERSONAL;
    const ctx = await contexto();
    return {
      html: vistas.calendario({
        u, q, ctx, op: servicioOperacion, admin,
        citas: admin ? await citaRepo.listar() : await visible(u, ctx),
        mensaje: aplicacion.sesiones.tomarAviso(token, urlAgenda(ruta + "?" + q, ruta)),
      }),
    };
  };
  const pacienteVisible = async (u, rut) => {
    await servicioOperacion.exigirPaciente(u, rut);
    return catalogo.paciente(normalizarRut(rut));
  };
  const documentoVisible = async (u, id) => {
    const documento = extras.buscar("documentos", id);
    if (!documento || (documento.idPoliclinico && documento.idPoliclinico !== +u.idPoliclinico))
      throw new Error("FUERA_DE_SEDE");
    await servicioOperacion.exigirPaciente(u, documento.rut);
    return documento;
  };
  const camposCancelacion = (d) => {
    if (!d.motivo?.trim())
      throw new Error("Indica el motivo y canal de solicitud.");
    if (/no responde|sin respuesta|no contest/i.test(d.motivo))
      throw new Error(
        "La falta de respuesta no es motivo para cancelar una reserva.",
      );
  };
  const planCambio = async (d) => {
    if (!fechaValida(d.fecha) || !d.motivo?.trim())
      throw new Error("Completa fecha y motivo.");
    const profesional = await catalogo.profesional(d.idProfesional);
    if (!profesional) throw new Error("PROFESIONAL_NO_ENCONTRADO");
    const bloques = (await catalogo.bloques()).filter(
      (b) => b.idProfesional === profesional.id && b.fecha === d.fecha,
    );
    const afectadas = await servicioOperacion.afectados(profesional.id, d.fecha);
    if (
      !["AUSENCIA", "REEMPLAZO", "CANCELACION", "LUGAR", "HORARIO"].includes(
        d.tipo,
      )
    )
      throw new Error("Tipo de cambio inválido.");
    if (d.tipo === "REEMPLAZO") {
      const reemplazo = await catalogo.profesional(d.idReemplazo);
      if (
        !reemplazo?.activo ||
        reemplazo.id === profesional.id ||
        !(reemplazo.especialidades || [reemplazo.especialidad]).includes(profesional.especialidad)
      )
        throw new Error("Reemplazo no compatible.");
      for (const b of bloques) {
        if (!servicioOperacion.lugares(reemplazo, b.fecha).includes(servicioOperacion.sedeBloque(b, profesional)))
          throw new Error("El reemplazo no está asignado al lugar.");
        if (
          (await catalogo.bloques()).some(
            (x) =>
              x.idProfesional === reemplazo.id &&
              x.fecha === b.fecha &&
              require("../services/OperacionServicio").minutos(x.hora) <
                require("../services/OperacionServicio").minutos(b.hora) +
                  (b.duracion || 30) &&
              require("../services/OperacionServicio").minutos(x.hora) +
                (x.duracion || 30) >
                require("../services/OperacionServicio").minutos(b.hora),
          )
        )
          throw new Error("El reemplazo tiene un cruce horario.");
      }
    }
    if (
      d.tipo === "LUGAR" &&
      !servicioOperacion.lugares(profesional, d.fecha).includes(+d.idPoliclinico)
    )
      throw new Error("Lugar no asignado al profesional.");
    const propuestos=[];
    if (d.tipo === "HORARIO") {
      if(!fechaValida(d.nuevaFecha)) throw new Error('Selecciona una nueva fecha.');
      const {minutos,hora}=require('../services/OperacionServicio');
      const inicio=Math.min(...bloques.map(b=>minutos(b.hora)));
      const delta=d.nuevaHoraInicio?minutos(d.nuevaHoraInicio)-inicio:0;
      const todos=await catalogo.bloques();
      for(const b of bloques){
        const m=minutos(b.hora)+delta;
        if(m<0||m+(b.duracion||30)>1440) throw new Error('El bloque propuesto excede el día.');
        const propuesta={...b,fecha:d.nuevaFecha,hora:hora(m)};
        if(!servicioOperacion.lugares(profesional,d.nuevaFecha).includes(servicioOperacion.sedeBloque(b,profesional))) throw new Error('Asignación no vigente en la fecha propuesta.');
        if(todos.some(x=>!bloques.some(y=>y.id===x.id)&&x.idProfesional===profesional.id&&x.fecha===d.nuevaFecha&&minutos(x.hora)<m+(b.duracion||30)&&minutos(x.hora)+(x.duracion||30)>m)) throw new Error('El horario propuesto tiene cruces.');
        propuestos.push(propuesta);
      }
    }
    return { p: profesional, bloques, afectadas, propuestos, datos: d };
  };
  const cambiosVista = async (u, d = {}, plan) => {
    const ctx = await contexto();
    return {
      html: vistas.page(
        u,
        "Cambios de agenda",
        vistas.cab(
          "Revisa las reservas afectadas antes de aplicar una modificación.",
          vistas.btn("Volver a agendas", "/admin/agendas", true)+vistas.btn("Estado de notificaciones","/admin/comunicaciones",true),
        ) +
          vistas.panel(
            "Proponer cambio",
            `<form class="form-grid" method="post" action="/admin/cambio/revisar">${vistas.select("idProfesional", "Profesional", ctx.listaProfs, d.idProfesional)}${vistas.input("fecha", "Fecha de agenda", d.fecha || hoy(), "date", "required")}${vistas.select(
              "tipo",
              "Cambio",
              [
                { id: "AUSENCIA", nombre: "Registrar ausencia" },
                { id: "REEMPLAZO", nombre: "Reemplazar profesional" },
                { id: "LUGAR", nombre: "Cambiar lugar" },
                { id: "HORARIO", nombre: "Modificar fecha y horario" },
                { id: "CANCELACION", nombre: "Cancelación institucional" },
              ],
              d.tipo,
            )}${vistas.select("idReemplazo", "Profesional reemplazante", ctx.listaProfs, d.idReemplazo)}${vistas.select("idPoliclinico", "Lugar propuesto", ctx.listaSedes, d.idPoliclinico)}${vistas.input("nuevaFecha", "Fecha propuesta", d.nuevaFecha || hoy(), "date")}${vistas.input("nuevaHoraInicio", "Nueva hora inicial (opcional)", d.nuevaHoraInicio || "", "time")}${vistas.input("motivo", "Motivo", d.motivo || "", "text", "required")}${vistas.select("destino", "Horario cancelado", vistas.opcionesTexto(["Bloqueado", "Disponible"]), d.destino || "Bloqueado")}<label class="check"><input type="checkbox" name="whatsapp" value="1" ${d.whatsapp === "1" ? "checked" : ""}>Notificar por WhatsApp</label><label class="check"><input type="checkbox" name="correo" value="1" ${d.correo === "1" ? "checked" : ""}>Notificar por correo</label><button type="submit">Ver Agenda actual versus Cambio propuesto</button></form>`,
          ) +
          (plan
            ? vistas.panel(
                "Agenda actual versus Cambio propuesto",
                `<div class="comparison"><div><h3>Agenda actual</h3><p>${esc(plan.p.nombre)} · ${esc(d.fecha)}</p><p>${plan.bloques.length} cupos · ${plan.afectadas.length} reservas</p></div><div><h3>Cambio propuesto</h3><p>${esc(d.tipo)} · ${esc(d.motivo)}</p><p>${esc(d.nuevaFecha||d.fecha)} ${esc(d.nuevaHoraInicio||'')} · ${esc(ctx.sedes.get(+d.idPoliclinico)?.nombre||'')}</p><p>Responsable: ${esc(u.nombre)}</p></div></div><form method="post" action="/admin/cambio/guardar">${vistas.hidden({ ...d, huella: require("node:crypto").createHash("sha256").update(JSON.stringify(plan.afectadas)).digest("hex") })}<p>${plan.afectadas.length} reservas afectadas. Selecciona las citas para cancelar si corresponde.</p>${tabla(
                  [
                    "Seleccionar",
                    "Paciente",
                    "RUT",
                    "Fecha / hora",
                    "Alternativas",
                  ],
                  plan.afectadas.map((x) => [
                    raw(
                      `<input type="checkbox" aria-label="Seleccionar reserva ${x.id}" data-list="idCitas" value="${x.id}" checked>`,
                    ),
                    ctx.pacientes.get(x.rut)?.nombre,
                    x.rut,
                    `${ctx.bloques.get(x.idBloque)?.fecha} ${ctx.bloques.get(x.idBloque)?.hora}`,
                    raw(
                      vistas.btn(
                        "Buscar alternativas",
                        "/admin/agendas?esp=" +
                          encodeURIComponent(plan.p.especialidad),
                        true,
                      ),
                    ),
                  ]),
                )}${vistas.hidden({ idCitas: plan.afectadas.map((x) => x.id).join(",") })}<button type="submit">Confirmar cambio · ${esc(u.nombre)}</button></form>`,
              )
            : "") +
          vistas.panel(
            "Cambios registrados",
            tabla(
              ["Fecha", "Tipo", "Motivo", "Reservas afectadas", "Responsable"],
              aplicacion.cambios
                .listar()
                .map((x) => [
                  x.fecha,
                  x.tipo,
                  x.motivo,
                  x.citasAfectadas,
                  x.responsable || "—",
                ]),
            ),
          ),
      ),
    };
  };
  return {
    resumen: async ({ usuario: u, consulta = new URLSearchParams() }) => {
      const vistaResumen = require("../views/resumen");
      const { indicadoresResumen, pct } = require("./resumen");
      const admin = u.rol === "ADMINISTRACION";
      const ctx = await contexto();
      const ahora = textoLocal();
      const fHoy = ahora.slice(0, 10),
        hora = ahora.slice(11),
        manana = sumarDias(fHoy, 1),
        semana = sumarDias(fHoy, 6),
        hace30 = sumarDias(fHoy, -30);
      const sedeDe = (b) => servicioOperacion.sedeBloque(b, ctx.profs.get(b?.idProfesional));
      const miSede = (idSede) => admin || idSede === Number(u.idPoliclinico);
      const citas = (await citaRepo.listar())
        .map((x) => ({ x, b: ctx.bloques.get(x.idBloque) }))
        .filter(({ b }) => b && miSede(sedeDe(b)));
      const base = admin ? "/admin" : "/tens";
      const sedes = ctx.listaSedes.filter((s) => miSede(s.id));
      const profesionales = ctx.listaProfs.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre, sedes: servicioOperacion.lugares(p) })).sort((x, y) => x.nombre.localeCompare(y.nombre, "es", { numeric: true }));
      const indicadores = indicadoresResumen({ consulta, fecha: fHoy, bloques: ctx.bloques, citas, sedes, sedeDe, idPoliclinico: admin ? undefined : Number(u.idPoliclinico), profesionales });
      if (consulta.get("fragmento") === "indicadores")
        return { html: vistaResumen.indicadores(indicadores, base, consulta.get("alerta")) };
      const activas = citas.filter(({ x }) => x.estadoReserva === "ACTIVA");
      const tele = (b) => !!ctx.sedes.get(sedeDe(b))?.telemedicina;
      const esPendiente = ({ x }) => !x.asistencia && x.estadoConfirmacion !== "CONFIRMADA";
      const hoyC = activas.filter(({ b }) => b.fecha === fHoy).sort((a, z) => a.b.hora.localeCompare(z.b.hora));
      const proximas48 = activas.filter(({ b }) => b.fecha === fHoy || b.fecha === manana);
      const sinConfirmar = proximas48.filter(esPendiente);
      const sinAsistencia = hoyC.filter(({ x, b }) => !x.asistencia && b.hora <= hora);
      const sinEnlace = proximas48.filter(({ x, b }) => tele(b) && !x.asistencia && ["Enlace pendiente", "Error de envío"].includes(servicioOperacion.estadoEnvioEnlace(x).estado));
      const reservados = new Set(activas.map(({ x }) => x.idBloque));
      const cuposSemana = [...ctx.bloques.values()].filter((b) => b.publicado && b.fecha >= fHoy && b.fecha <= semana && miSede(sedeDe(b)));
      const ocupadosSemana = cuposSemana.filter((b) => reservados.has(b.id)).length;
      const libresSemana = cuposSemana.filter((b) => !reservados.has(b.id) && (b.fecha > fHoy || b.hora > hora));
      const esperaV = (await espera.vigentes()).filter((e) => miSede(e.idPoliclinico));
      const esperaConCupo = esperaV.filter((e) => e.estado === "EN_ESPERA" && e.cupos.length);
      const esperaAntigua = esperaV.filter((e) => e.registradaEn && e.registradaEn <= hace30);
      const comErr = extras.listar("comunicaciones").filter((m) => m.estado === "Error" && (admin || m.idPoliclinico === +u.idPoliclinico));
      const docsPend = extras.listar("documentos").filter((d) => (d.estadoRevision || (d.verificado ? "VALIDADO" : "PENDIENTE")) === "PENDIENTE" && !d.archivado && (admin || d.idPoliclinico === +u.idPoliclinico));
      const ultimos30 = citas.filter(({ x, b }) => b.fecha >= hace30 && b.fecha <= fHoy && x.asistencia);
      const inasist = pct(ultimos30.filter(({ x }) => x.asistencia === "NO_ASISTIO").length, ultimos30.length);
      const profInactivos = activas.filter(({ x, b }) => b.fecha >= fHoy && !x.idProfesionalReemplazo && ctx.profs.get(b.idProfesional)?.activo === false);
      const confirmadasHoy = hoyC.filter(({ x }) => x.estadoConfirmacion === "CONFIRMADA").length;
      const atendidasHoy = hoyC.filter(({ x }) => x.asistencia === "ASISTIO").length;
      const agendaDia = admin ? "/admin/agendas?vista=lista" : "/tens/agenda?vista=lista";
      const urlAlerta = (alerta) => {
        const filtro = new URLSearchParams(consulta);
        filtro.set("alerta", alerta);
        return `${base}/resumen?${filtro}#detalle-alerta`;
      };
      const kpis = [
        { href: agendaDia, icono: "calendario", valor: hoyC.length, texto: "Citas hoy", nota: `${atendidasHoy} atendidas · ${confirmadasHoy} confirmadas` },
        { href: admin && sinConfirmar.length ? urlAlerta("confirmaciones") : admin ? "/admin/comunicaciones" : "/tens/confirmaciones", clase: sinConfirmar.length ? "res-kpi-aviso" : "", icono: "telefono", valor: sinConfirmar.length, texto: "Por confirmar", nota: "Hoy y mañana" },
        { href: `${base}/espera`, icono: "lista", valor: esperaV.length, texto: "En lista de espera", nota: esperaConCupo.length ? `${esperaConCupo.length} con cupo disponible` : "Solicitudes vigentes" },
        admin
          ? { href: `/admin/reportes?seccion=lugares&desde=${hace30}&hasta=${fHoy}`, clase: inasist >= 20 ? "res-kpi-crit" : "", icono: "grafico", valor: inasist == null ? "—" : `${inasist}%`, texto: "Inasistencia en 30 días", nota: `Ocupación 7 días: ${cuposSemana.length ? `${pct(ocupadosSemana, cuposSemana.length)}%` : "—"}` }
          : { href: "/tens/agenda?vista=semana&estado=Disponible", icono: "reloj", valor: libresSemana.length, texto: "Cupos libres", nota: "Próximos 7 días" },
      ];
      const alertas = [
        { id: "asistencia", nivel: "crit", titulo: "Citas de hoy sin registrar asistencia", detalle: "Falta registrar el resultado de la atención.", filas: sinAsistencia, origen: admin ? agendaDia : "/tens/recepcion", accion: admin ? "Abrir agenda" : "Abrir recepción" },
        { id: "confirmaciones", nivel: "crit", titulo: "Citas de hoy o mañana sin confirmar", detalle: "Requieren contacto con el paciente.", filas: sinConfirmar, origen: admin ? "/admin/comunicaciones" : "/tens/confirmaciones", accion: admin ? "Abrir comunicaciones" : "Gestionar confirmaciones" },
        ...(admin || tele({ idPoliclinico: +u.idPoliclinico })
          ? [{ id: "enlaces", nivel: "crit", titulo: "Telemedicina sin enlace enviado", detalle: "Citas de hoy o mañana con enlace pendiente o error de envío.", filas: sinEnlace, origen: agendaDia, accion: "Abrir agenda" }]
          : []),
        ...(admin
          ? [{ id: "profesionales", nivel: "crit", titulo: "Citas con profesional inactivo", detalle: "Reservas futuras sin reemplazo asignado.", filas: profInactivos, origen: "/admin/cancelaciones", accion: "Abrir cancelaciones" }]
          : []),
        { nivel: "crit", titulo: "Mensajes con error de envío", detalle: "Comunicaciones que requieren revisión o reenvío.", n: comErr.length, href: `${base}/comunicaciones?estado=Error` },
        { nivel: "aviso", titulo: "Lista de espera con cupo disponible", detalle: "Hay horas libres compatibles con la solicitud.", n: esperaConCupo.length, href: `${base}/espera?pendiente=con-cupo` },
        { nivel: "aviso", titulo: "Solicitudes en espera hace más de 30 días", detalle: "Requieren revisar la prioridad o contactar al paciente.", n: esperaAntigua.length, href: `${base}/espera?pendiente=antigua` },
        ...(admin ? [] : [{ nivel: "aviso", titulo: "Documentos por revisar", detalle: "Documentos administrativos pendientes de verificar.", n: docsPend.length, href: "/tens/documentos?pendiente=1#documentos-registrados" }]),
      ].map((a) => a.filas ? { ...a, n: a.filas.length, href: urlAlerta(a.id) } : a);
      const aCita = ({ x, b }) => {
        const prof = ctx.profs.get(x.idProfesionalReemplazo || b.idProfesional);
        const est = vistas.estado(x, tele(b), servicioOperacion);
        return {
          fecha: b.fecha,
          hora: b.hora,
          paciente: ctx.pacientes.get(x.rut)?.nombre || x.rut,
          detalle: [b.especialidad || prof?.especialidad, prof?.nombre, admin ? ctx.sedes.get(sedeDe(b))?.nombre : ""].filter(Boolean).join(" · "),
          href: admin ? "/admin/cupo?idCita=" + x.id : detalleReserva(x.id),
          badge: vistas.badge(est),
        };
      };
      const citasHoy = hoyC.slice(0, admin ? 10 : 12).map(aCita);
      const seleccion = alertas.find((a) => a.id && a.id === consulta.get("alerta"));
      const detalleAlerta = seleccion && {
        ...seleccion,
        filas: [...seleccion.filas]
          .sort((a, z) => a.b.fecha.localeCompare(z.b.fecha) || a.b.hora.localeCompare(z.b.hora))
          .map(aCita),
      };
      const capacidad = admin ? null : Array.from({ length: 7 }, (_, i) => {
        const dia = sumarDias(fHoy, i);
        const delDia = cuposSemana.filter((b) => b.fecha === dia);
        const ocupados = delDia.filter((b) => reservados.has(b.id)).length;
        return { fecha: dia, reservados: ocupados, libres: delDia.length - ocupados };
      });
      const porSede = admin
        ? ctx.listaSedes.map((s) => {
            const deSede = (b) => sedeDe(b) === s.id;
            const cuposDeLaSede = cuposSemana.filter(deSede);
            return {
              id: s.id,
              nombre: s.nombre,
              hoy: hoyC.filter(({ b }) => deSede(b)).length,
              porConfirmar: sinConfirmar.filter(({ b }) => deSede(b)).length,
              espera: esperaV.filter((e) => e.idPoliclinico === s.id).length,
              ocupacion: pct(cuposDeLaSede.filter((b) => reservados.has(b.id)).length, cuposDeLaSede.length),
            };
          })
        : null;
      return {
        html: vistaResumen.resumen({ usuario: u, admin, sede: ctx.sedes.get(+u.idPoliclinico), kpis, alertas, detalleAlerta, citasHoy, porSede, capacidad, indicadores, hora, consulta }),
      };
    },
    adminAgenda: (r) => getAgenda(r, true),
    tensAgenda: (r) => getAgenda(r, false),
    bloqueNuevo: async ({ usuario: u }) => ({
      html: vistas.bloqueNuevo({ u, ctx: await contexto() }),
    }),
    bloqueRevisar: safe(
      "/admin/bloque/nuevo",
      async ({ usuario: u, cuerpo: d }) => ({
        html: vistas.bloqueNuevo({
          u,
          ctx: await contexto(),
          d,
          plan: await servicioOperacion.plan(d),
        }),
      }),
    ),
    bloqueGuardar: safe(
      "/admin/bloque/nuevo",
      async ({ usuario: u, cuerpo: d, token }) => {
        await servicioOperacion.crearSerie(d, u);
        const destino = RUTA_AGENDA_ADMIN + "?" + new URLSearchParams({
          fecha: d.desde,
          sede: d.idPoliclinico,
          prof: d.idProfesional,
        });
        aplicacion.sesiones.guardarAviso(token, destino, { tipo: "exito", texto: "Cupo guardado." });
        return redirect(destino);
      },
    ),
    equipo: async ({ usuario: u, consulta: q }) => ({
      html: vistas.equipo({ u, ctx: await contexto(), op: servicioOperacion, q }),
    }),
    equipoRevisar: safe(
      "/admin/profesionales",
      async ({ usuario: u, cuerpo: d }) => {
        if (d.fotografia?.datos?.length) {
          const b = d.fotografia.datos;
          let ext;
          if (b.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
            ext = "jpg";
          else if (
            b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          )
            ext = "png";
          if (!ext || b.length > 5 * 1024 * 1024)
            throw new Error("La fotografía debe ser JPG o PNG, máximo 5 MB.");
          const nombre =
            "profesional-" + require("node:crypto").randomUUID() + "." + ext;
          const dir=require("node:path").join(__dirname,"../../datos/fotos");
          require("node:fs").mkdirSync(dir,{recursive:true});
          require("node:fs").writeFileSync(require("node:path").join(dir,nombre),b,{mode:0o600});
          d.foto = "/img/" + nombre;
        }
        delete d.fotografia;
        return {
          html: vistas.equipo({
            u,
            ctx: await contexto(),
            op: servicioOperacion,
            q: new URLSearchParams(),
            d,
            revision: await servicioOperacion.equipo(d, u),
          }),
        };
      },
    ),
    equipoGuardar: safe(
      "/admin/profesionales",
      async ({ usuario: u, cuerpo: d }) => {
        const r = await servicioOperacion.equipo(d, u, true);
        if (!r.guardado)
          throw new Error(
            "Reprograma las reservas afectadas antes de cambiar la asignación.",
          );
        return redirect("/admin/profesionales");
      },
    ),
    equipoEstado: safe(
      "/admin/profesionales",
      async ({ usuario: u, cuerpo: d }) => {
        const profesional = await catalogo.profesional(d.idProfesional);
        if (!profesional) throw new Error("Profesional no encontrado.");
        if (d.activo !== "1") {
          const suyos = new Set(
            (await catalogo.bloques())
              .filter((b) => b.idProfesional === profesional.id && b.fecha >= hoy())
              .map((b) => b.id),
          );
          const vigentes = (await citaRepo.listar()).filter(
            (x) => x.estadoReserva === "ACTIVA" && !x.asistencia && suyos.has(x.idBloque),
          ).length;
          if (vigentes)
            throw new Error(
              `${profesional.nombre} tiene ${vigentes} reserva(s) vigente(s). Reprográmalas o cancélalas (Cambios de agenda o Cancelaciones) antes de desactivarlo.`,
            );
        }
        await catalogo.setProfesionalActivo(profesional.id, d.activo === "1");
        servicioOperacion.aud(u, "Estado del integrante actualizado", "Equipo", profesional.id, profesional, {
          ...profesional,
          activo: d.activo === "1",
        });
        return redirect("/admin/profesionales");
      },
    ),
    lugares: async ({ usuario: u, consulta: q }) => ({
      html: vistas.lugares({ u, ctx: await contexto(), op: servicioOperacion, q }),
    }),
    lugarGuardar: safe(
      "/admin/policlinicos",
      async ({ usuario: u, cuerpo: d }) => {
        if (!d.nombre?.trim() || !/^#[\da-f]{6}$/i.test(d.color || ""))
          throw new Error("Revisa nombre y color.");
        const especialidades = d.especialidades
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          previo = d.id ? await catalogo.policlinico(d.id) : null;
        const n = await catalogo.guardarLugar({
          ...d,
          id: d.id ? +d.id : null,
          activo: d.activo === "1",
          telemedicina: d.telemedicina === "1",
        });
        servicioOperacion.meta.sedes[n.id] = {
          nombre: d.nombre,
          direccion: d.direccion,
          especialidades,
          color: d.color,
          activo: d.activo === "1",
        };
        servicioOperacion.aud(
          u,
          "Lugar actualizado",
          "Policlínicos",
          n.id,
          previo,
          servicioOperacion.meta.sedes[n.id],
          n.id,
        );
        return redirect("/admin/policlinicos");
      },
    ),
    especialidadGuardar: safe(
      "/admin/policlinicos?tab=especialidades",
      async ({ usuario: u, cuerpo: d }) => {
        if (!d.nombre?.trim() || !/^#[\da-f]{6}$/i.test(d.color || ""))
          throw new Error("Revisa especialidad y color.");
        const antes = servicioOperacion.meta.especialidades[d.nombre];
        await catalogo.guardarEspecialidad({
          nombre: d.nombre.trim(),
          activo: d.activo === "1",
        });
        servicioOperacion.meta.especialidades[d.nombre] = {
          color: d.color,
          activo: d.activo === "1",
          listaEspera: d.listaEspera === "1",
        };
        servicioOperacion.aud(
          u,
          "Especialidad actualizada",
          "Especialidades",
          d.nombre,
          antes,
          servicioOperacion.meta.especialidades[d.nombre],
        );
        return redirect("/admin/policlinicos?tab=especialidades");
      },
    ),
    colores: async ({ usuario: u }) => ({
      html: vistas.page(
        u,
        "Colores de agenda",
        vistas.cab(
          "Los cupos de toda la red muestran el color del lugar. Al elegir una sede, muestran el color de la especialidad.",
        ) +
          vistas.btn("Colores por lugar", "/admin/policlinicos", true) +
          vistas.btn(
            "Colores por especialidad",
            "/admin/policlinicos?tab=especialidades",
            true,
          ),
      ),
    }),
    cambios: ({ usuario: u }) => cambiosVista(u),
    cambioRevisar: safe("/admin/cambios", async ({ usuario: u, cuerpo: d }) =>
      cambiosVista(u, d, await planCambio(d)),
    ),
    cambioGuardar: safe("/admin/cambios", async ({ usuario: u, cuerpo: d }) => {
      const plan = await planCambio(d),
        huella = require("node:crypto")
          .createHash("sha256")
          .update(JSON.stringify(plan.afectadas))
          .digest("hex");
      if (huella !== d.huella)
        throw new Error("Las reservas cambiaron. Vuelve a revisar el impacto.");
      const seleccion = ids(d.idCitas);
      const citas =
        d.tipo === "CANCELACION"
          ? plan.afectadas.filter((x) => seleccion.includes(x.id))
          : plan.afectadas;
      if (d.tipo === "REEMPLAZO")
        for (const x of citas)
          await citaRepo.actualizar({
            ...x,
            idProfesionalReemplazo: +d.idReemplazo,
          });
      if (d.tipo === "CANCELACION") {
        camposCancelacion(d);
        for (const x of citas) {
          await agendamiento.cancelar(x.id, "INSTITUCIONAL");
          if (d.destino === "Bloqueado") {
            const bloque = await catalogo.bloque(x.idBloque);
            await catalogo.cambiarPublicacion({
              idProfesional: bloque.idProfesional,
              desde: bloque.fecha,
              hasta: bloque.fecha,
              idBloque: bloque.id,
              publicar: false,
            });
            (servicioOperacion.meta.bloques[bloque.id] ||= {}).estado = "Bloqueado";
          }
        }
      }
      if (d.tipo === "AUSENCIA") {
        await aplicacion.cambios.ausencia({
          idProfesional: plan.p.id,
          fecha: d.fecha,
          motivo: d.motivo,
          idUsuario: u.id,
        });
        for (const b of plan.bloques)
          if (!plan.afectadas.some((x) => x.idBloque === b.id))
            (servicioOperacion.meta.bloques[b.id] ||= {}).estado = "Bloqueado";
      }
      if (d.tipo === "LUGAR" || d.tipo === "HORARIO")
        for (const b of plan.bloques) {
          const m = (servicioOperacion.meta.bloques[b.id] ||= {});
          if (d.tipo === "LUGAR") {
            await catalogo.actualizarBloque(b.id, {
              idPoliclinico: +d.idPoliclinico,
            });
            m.idPoliclinico = +d.idPoliclinico;
          } else {const nuevo=plan.propuestos.find(x=>x.id===b.id);await catalogo.actualizarBloque(b.id,{fecha:nuevo.fecha,hora:nuevo.hora});}
        }
      for (const x of citas) {
        if (d.whatsapp === "1")
          await servicioOperacion.comunicar(u, x, "WhatsApp", "Cambio institucional");
        if (d.correo === "1")
          await servicioOperacion.comunicar(u, x, "Correo", "Cambio institucional");
      }
      const sede = servicioOperacion.sedeBloque(plan.bloques[0], plan.p);
      extras.agregar("notificaciones", {
        tipo: "CAMBIO_AGENDA",
        fecha: textoLocal(),
        idPoliclinico: sede,
        leida: false,
        texto: `${d.tipo}: ${plan.p.nombre}, ${d.fecha}. ${citas.length} reservas afectadas. ${d.motivo}. Responsable: ${u.nombre}. Revisar y reprogramar.`,
      });
      extras.agregar("cambios", {
        tipo: d.tipo,
        fecha: d.fecha,
        motivo: d.motivo,
        citasAfectadas: citas.length,
        responsable: u.nombre,
      });
      servicioOperacion.aud(
        u,
        "Cambio de agenda aplicado",
        "Agendas",
        plan.p.id,
        plan.bloques,
        { ...d, reservas: citas.map((x) => x.id) },
        sede,
      );
      return redirect("/admin/cambios");
    }),
    cupo: async ({ usuario: u, consulta: q, token }) => {
      let cita = q.get("idCita")
          ? await servicioOperacion.exigirCita(u, q.get("idCita"))
          : null,
        bloque = await catalogo.bloque(cita?.idBloque || q.get("idBloque"));
      if (!bloque) throw new Error("CITA_NO_ENCONTRADA");
      if (!cita) {
        const activa = await citaRepo.buscarActivaPorBloque(bloque.id);
        if (activa) cita = await servicioOperacion.exigirCita(u, activa.id);
      }
      const ctx = await contexto();
      if (cita?.estadoReserva === "ACTIVA") {
        ctx.disponibles = await agendamiento.bloquesDisponibles({
          especialidad: bloque.especialidad || ctx.profs.get(bloque.idProfesional)?.especialidad,
        });
      }
      return {
        html: vistas.reserva({
          u, ctx, c: cita, b: bloque, op: servicioOperacion, admin: true,
          volverAgenda: urlAgendaAdmin(q.get("volverAgenda")),
          mensaje: cita && aplicacion.sesiones.tomarAviso(token, detalleReserva(cita.id, q.get("volverAgenda"), true)),
        }),
      };
    },
    cupoEstado: safe(volverAgendaAdmin, async ({ usuario: u, cuerpo: d, token }) => {
      const bloque = await catalogo.bloque(d.idBloque);
      if (!bloque || !["Disponible", "Bloqueado", "Sin publicar"].includes(d.estado))
        throw new Error("Cupo o estado inválido.");
      if (await citaRepo.buscarActivaPorBloque(bloque.id))
        throw new Error("El cupo tiene una reserva activa.");
      await catalogo.cambiarPublicacion({
        idProfesional: bloque.idProfesional,
        desde: bloque.fecha,
        hasta: bloque.fecha,
        idBloque: bloque.id,
        publicar: d.estado === "Disponible",
      });
      (servicioOperacion.meta.bloques[bloque.id] ||= {}).estado = d.estado;
      servicioOperacion.aud(u, "Estado del cupo actualizado", "Agendas", bloque.id, bloque, {
        estado: d.estado,
      });
      const destino = urlAgendaAdmin(d.volverAgenda) || RUTA_AGENDA_ADMIN + "?fecha=" + bloque.fecha;
      aplicacion.sesiones.guardarAviso(token, destino, { tipo: "exito", texto: "Estado del cupo actualizado." });
      return redirect(destino);
    }),
    pacientes: async ({ usuario: u, consulta: q }) => {
      if (q.get("nuevo"))
        return {
          html: require("../views/atencionDelDia").pacientes({
            usuario: u,
            lista: [],
            comunas: await catalogo.comunas(),
          }),
        };
      const lista = [];
      for (const p of await catalogo.pacientes())
        if (await servicioOperacion.acceso(u, p.rut)) lista.push(p);
      return { html: vistas.pacientes({ u, lista, ctx: await contexto(), citas: await visible(u), q }) };
    },
    ficha: async ({ usuario: u, consulta: q }) => {
      const paciente = await pacienteVisible(u, q.get("rut"));
      servicioOperacion.aud(u, "Ficha consultada", "Pacientes", paciente.rut, null, null);
      return {
        html: vistas.ficha({
          u,
          p: paciente,
          q,
          ctx: await contexto(),
          citas: (await visible(u)).filter((x) => x.rut === paciente.rut),
          documentos: aplicacion.documentos
            .listar()
            .filter(
              (d) =>
                d.rut === paciente.rut &&
                (!d.idPoliclinico || d.idPoliclinico === +u.idPoliclinico),
            ),
          mensajes: extras
            .listar("comunicaciones")
            .filter(
              (m) => m.rut === paciente.rut && m.idPoliclinico === +u.idPoliclinico,
            ),
          op: servicioOperacion,
        }),
      };
    },
    preferencias: safe("/tens/pacientes", async ({ usuario: u, cuerpo: d }) => {
      const paciente = await pacienteVisible(u, d.rut),
        antes = structuredClone(servicioOperacion.meta.pacientes[paciente.rut] || {});
      Object.assign((servicioOperacion.meta.pacientes[paciente.rut] ||= {}), {
        contactoPreferido: d.contactoPreferido,
        consentimientoComunicaciones: d.consentimientoComunicaciones === "1",
      });
      servicioOperacion.aud(
        u,
        "Preferencias actualizadas",
        "Pacientes",
        paciente.rut,
        antes,
        servicioOperacion.meta.pacientes[paciente.rut],
      );
      return redirect("/tens/ficha?rut=" + paciente.rut);
    }),
    desactivar: safe("/tens/pacientes", async ({ usuario: u, cuerpo: d }) => {
      const paciente = await pacienteVisible(u, d.rut);
      (servicioOperacion.meta.pacientes[paciente.rut] ||= {}).activo = paciente.activo === false;
      servicioOperacion.aud(
        u,
        "Estado paciente actualizado",
        "Pacientes",
        paciente.rut,
        { activo: paciente.activo !== false },
        { activo: paciente.activo === false },
      );
      return redirect("/tens/pacientes");
    }),
    reserva: async ({ usuario: u, consulta: q, token }) => {
      let cita = q.get("idCita")
          ? await servicioOperacion.exigirCita(u, q.get("idCita"))
          : null,
        bloque = await catalogo.bloque(cita?.idBloque || q.get("idBloque")),
        ctx = await contexto();
      if (
        !bloque ||
        servicioOperacion.sedeBloque(bloque, ctx.profs.get(bloque.idProfesional)) !== +u.idPoliclinico
      )
        throw new Error("FUERA_DE_SEDE");
      if (!cita) {
        const activa = await citaRepo.buscarActivaPorBloque(bloque.id);
        if (activa) cita = await servicioOperacion.exigirCita(u, activa.id);
      }
      if (cita?.estadoReserva === "ACTIVA") {
        ctx.disponibles = await agendamiento.bloquesDisponibles({
          idPoliclinico: u.idPoliclinico,
          especialidad: bloque.especialidad || ctx.profs.get(bloque.idProfesional)?.especialidad,
        });
      }
      return {
        html: vistas.reserva({
          u, ctx, c: cita, b: bloque, op: servicioOperacion,
          volverAgenda: urlAgendaPersonal(q.get("volverAgenda")),
          mensaje: cita && aplicacion.sesiones.tomarAviso(token, detalleReserva(cita.id, q.get("volverAgenda"))),
        }),
      };
    },
    flujo: safe(volverAgenda, async (r) => {
      const { usuario: u, cuerpo: d, token } = r;
      const x = await servicioOperacion.exigirCita(u, d.idCita);
      if (x.estadoReserva !== "ACTIVA")
        throw new Error("La reserva está cancelada.");
      const permitidos =
        u.rol === "TELEMEDICINA"
          ? [
              "Confirmada",
              "Conectado",
              "Atendida",
              "No se conectó",
            ]
          : ["Llegó", "En sala", "Confirmada", "Atendida", "No asistió"];
      if (!permitidos.includes(d.estado)) throw new Error("Estado inválido.");
      if (d.estado === "Atendida" && u.puedeTerminarAtencion === false)
        throw new Error("No tienes permiso para terminar la atención.");
      if (d.estado === "Confirmada")
        await citaRepo.actualizar({ ...x, estadoConfirmacion: "CONFIRMADA" });
      if (["Atendida", "No asistió", "No se conectó"].includes(d.estado)) {
        const cita = await agendamiento.registrarAsistencia(x.id, d.estado === "Atendida");
        await notificarEncuestaAtencion(aplicacion, cita, u).catch((e) => console.error("No se pudo registrar la encuesta:", e.message));
      }
      (servicioOperacion.meta.citas[x.id] ||= {}).flujo = d.estado;
      servicioOperacion.aud(u, "Flujo de atención actualizado", "Atención", x.id, x, {
        estado: d.estado,
      });
      const destino = volverAgenda(r);
      aplicacion.sesiones.guardarAviso(token, destino, {
        tipo: "exito",
        texto: "Estado de la reserva actualizado.",
      });
      return redirect(destino);
    }),
    cancelar: safe(volverAgenda, async ({ usuario: u, cuerpo: d }) => {
      camposCancelacion(d);
      if (!["WhatsApp", "Llamada", "Presencial"].includes(d.canal))
        throw new Error("Canal de solicitud inválido.");
      const cita = await servicioOperacion.exigirCita(u, d.idCita);
      await agendamiento.cancelar(cita.id, "ASISTIDA");
      const bloque = await catalogo.bloque(cita.idBloque);
      if (d.destino === "Bloqueado") {
        await catalogo.cambiarPublicacion({
          idProfesional: bloque.idProfesional,
          desde: bloque.fecha,
          hasta: bloque.fecha,
          idBloque: bloque.id,
          publicar: false,
        });
        (servicioOperacion.meta.bloques[bloque.id] ||= {}).estado = "Bloqueado";
        delete servicioOperacion.meta.bloques[bloque.id].retenidoEspera;
      }
      servicioOperacion.aud(u, "Cancelación solicitada por paciente", "Reservas", cita.id, cita, {
        motivo: d.motivo,
        canal: d.canal,
        destino: d.destino,
      });
      return redirect("/tens/espera");
    }),
    reagendar: safe(
      (r) => r.usuario.rol === "ADMINISTRACION" ? volverAgendaAdmin(r) : volverAgenda(r),
      async ({ usuario: u, cuerpo: d, token }) => {
        const admin = u.rol === "ADMINISTRACION";
        const cita = await servicioOperacion.exigirCita(u, d.idCita),
          bloque = await catalogo.bloque(d.idBloque),
          p = bloque && (await catalogo.profesional(bloque.idProfesional));
        if (!bloque || (!admin && servicioOperacion.sedeBloque(bloque, p) !== +u.idPoliclinico))
          throw new Error("FUERA_DE_SEDE");
        if (!d.motivo?.trim()) throw new Error("Indica un motivo.");
        const nueva = await agendamiento.agendar({
          rut: cita.rut,
          idBloque: bloque.id,
          idUsuario: u.id,
        });
        try {
          await agendamiento.cancelar(cita.id, "ASISTIDA");
        } catch (e) {
          await agendamiento.cancelar(nueva.id, "ASISTIDA");
          throw e;
        }
        servicioOperacion.aud(u, "Reserva reprogramada", "Reservas", cita.id, cita, {
          nuevaReserva: nueva.id,
          motivo: d.motivo,
        });
        if (admin) await servicioOperacion.comunicar(u, nueva, "Correo", "Reprogramación institucional");
        const destino = detalleReserva(nueva.id, d.volverAgenda, admin);
        aplicacion.sesiones.guardarAviso(token, destino, { tipo: "exito", texto: "Reserva reprogramada." });
        return redirect(destino);
      },
    ),
    espera: async ({ usuario: u, consulta: q, token }) => ({
      html: vistas.espera({
        u,
        q,
        mensaje: aplicacion.sesiones.tomarAviso(token, "/tens/espera"),
        avisos: aplicacion.extras.listar("notificaciones").filter((n) => n.tipo === "CUPO_LIBERADO" && !n.leida && n.idPoliclinico === +u.idPoliclinico),
        ctx: {
          ...(await contexto()),
          listaProfs:(await catalogo.profesionales()).filter(p=>servicioOperacion.lugares(p).includes(+u.idPoliclinico)),
          especialidades:
            servicioOperacion.meta.sedes[u.idPoliclinico]?.especialidades ||
            infoSede(u.idPoliclinico)?.especialidades ||
            [],
        },
        lista: (await espera.vigentes()).filter(
          (x) => x.idPoliclinico === +u.idPoliclinico,
        ),
        retenidos: await espera.retenidos(u.idPoliclinico),
      }),
    }),
    supervision: async ({ usuario: u, consulta: q }) => ({
      html: vistas.espera({
        u,
        q,
        ctx: await contexto(),
        lista: await espera.vigentes(),
        retenidos: await espera.retenidos(),
        admin: true,
      }),
    }),
    esperaGestion: safe("/tens/espera", async ({ usuario: u, cuerpo: d }) => {
      const e = (await catalogo.espera()).find((x) => x.id === +d.idSolicitud);
      if (!e || e.idPoliclinico !== +u.idPoliclinico)
        throw new Error("FUERA_DE_SEDE");
      if (!["Contactado", "Hora ofrecida", "No responde"].includes(d.estado))
        throw new Error("Estado inválido.");
      const metaEspera = (servicioOperacion.meta.espera[e.id] ||= {});
      metaEspera.estadoOperativo = d.estado;
      metaEspera.contactos ||= [];
      metaEspera.contactos.push({
        fecha: textoLocal(),
        canal: d.canal,
        resultado: d.estado,
        responsable: u.nombre,
      });
      servicioOperacion.aud(
        u,
        "Contacto de lista de espera registrado",
        "Lista de espera",
        e.id,
        e,
        metaEspera,
      );
      return redirect("/tens/espera");
    }),
    comunicaciones: async ({ usuario: u, consulta = new URLSearchParams() }) => {
      const admin = u.rol === "ADMINISTRACION",
        errores = consulta.get("estado") === "Error",
        ruta = admin ? "/admin/comunicaciones" : "/tens/comunicaciones",
        lista = extras
          .listar("comunicaciones")
          .filter((m) => (admin || m.idPoliclinico === +u.idPoliclinico) && (!errores || m.estado === "Error"));
      return {
        html: vistas.page(
          u,
          "Comunicaciones",
          vistas.cab(
            "Estado de los mensajes que el sistema envía solo: comprobantes, recordatorios y encuestas. El personal no los envía; para quienes no responden, usa «Confirmaciones / llamadas».",
            (errores ? vistas.btn("Ver todos los mensajes", ruta, true) : "") +
              (!admin ? vistas.btn("Confirmaciones / llamadas", "/tens/confirmaciones", true) : ""),
          ) +
            vistas.panel(
              errores ? "Mensajes con error de envío" : "Bandeja operativa",
              tabla(
                [
                  "Destinatario",
                  "Reserva",
                  "Canal",
                  "Estado",
                  "Fecha",
                  "Responsable",
                  "Detalle",
                  "Acción",
                ],
                lista.map((m) => [
                  m.destinatario,
                  m.idCita,
                  m.canal,
                  m.estado,
                  m.fecha,
                  m.responsable,
                  m.detalle,
                  m.tipo === "Enlace de atención"
                    ? raw(vistas.post(admin ? "/admin/comunicacion" : "/tens/comunicacion", { idCita: m.idCita, canal: m.canal, tipo: m.tipo }, "Solicitar envío", true))
                    : "Automático",
                ]),
                errores ? "No hay mensajes con error de envío." : undefined,
              ),
            ),
        ),
      };
    },
    comunicacion: safe(
      "/tens/comunicaciones",
      async ({ usuario: u, cuerpo: d }) => {
        const cita = await servicioOperacion.exigirCita(u, d.idCita);
        if (!["WhatsApp", "Correo"].includes(d.canal))
          throw new Error("Canal inválido.");
        const tipo = d.tipo || "Recordatorio";
        if (tipo !== "Enlace de atención")
          throw new Error("Los mensajes los envía el sistema automáticamente.");
        if (!["TELEMEDICINA", "ADMINISTRACION"].includes(u.rol))
          throw new Error("FUERA_DE_SEDE");
        await servicioOperacion.comunicar(u, cita, d.canal, tipo);
        if (tipo === "Enlace de atención" && d.origen === "reserva" && u.rol === "TELEMEDICINA")
          return redirect(detalleReserva(cita.id, d.volverAgenda));
        return redirect(u.rol === "ADMINISTRACION" ? "/admin/comunicaciones" : "/tens/comunicaciones");
      },
    ),
    enlace: safe(volverAgenda, async ({ usuario: u, cuerpo: d, token }) => {
      if (u.rol !== "TELEMEDICINA") throw new Error("FUERA_DE_SEDE");
      const cita = await servicioOperacion.exigirCita(u, d.idCita);
      let url;
      try {
        url = new URL(d.enlace);
      } catch {
        throw new Error("Enlace inválido.");
      }
      if (url.protocol !== "https:") throw new Error("Usa un enlace HTTPS.");
      (servicioOperacion.meta.citas[cita.id] ||= {}).enlace = url.href;
      servicioOperacion.aud(u, "Enlace de Telemedicina actualizado", "Telemedicina", cita.id, cita, {
        enlace: url.href,
      });
      const destino = detalleReserva(cita.id, d.volverAgenda);
      aplicacion.sesiones.guardarAviso(token, destino, { tipo: "exito", texto: "Enlace de atención guardado." });
      return redirect(destino);
    }),
    documentoArchivar: safe(
      "/tens/pacientes",
      async ({ usuario: u, cuerpo: d }) => {
        const doc = await documentoVisible(u, d.id),
          antes = structuredClone(doc);
        extras.actualizar("documentos", doc.id, {
          archivado: true,
          archivadoPor: u.nombre,
        });
        servicioOperacion.aud(u, "Documento archivado", "Documentos", doc.id, antes, {
          archivado: true,
        });
        return redirect("/tens/ficha?tab=documentos&rut=" + doc.rut);
      },
    ),
    usuarios: async ({ usuario: u, consulta: q }) => {
      const ctx = await contexto(),
        lista = await catalogo.usuarios(),
        v = lista.find((x) => x.id === q.get("editar")) || {};
      return {
        html: vistas.page(
          u,
          "Usuarios y permisos",
          vistas.cab(
            "Configuración administrativa de accesos y lugares.",
            vistas.btn("Auditoría", "/admin/auditoria", true),
          ) +
            tabla(
              [
                "Usuario",
                "Correo",
                "Rol",
                "Lugares",
                "Estado",
                "Último acceso",
                "Acciones",
              ],
              lista.map((x) => [
                x.nombre,
                x.correo,
                x.rol,
                (x.lugares || [x.idPoliclinico])
                  .filter(Boolean)
                  .map((id) => ctx.sedes.get(id)?.nombre)
                  .join(", ") || "Toda la red",
                x.activo ? "Activo" : "Inactivo",
                x.ultimoAcceso || "Sin acceso registrado",
                raw(
                  vistas.btn("Editar", "/admin/usuarios?editar=" + x.id, true) +
                    vistas.post(
                      "/admin/usuario/enlace",
                      { id: x.id },
                      "Enlace seguro",
                      true,
                    ),
                ),
              ]),
            ) +
            vistas.panel(
              v.id ? "Editar acceso" : "Crear acceso",
              `<form class="form-grid" method="post" action="/admin/usuario">${vistas.hidden({ id: v.id || "" })}${vistas.input("nombre", "Nombre", v.nombre || "", "text", "required")}${vistas.input("correo", "Correo", v.correo || "", "email", "required")}${vistas.select(
                "rol",
                "Rol",
                [
                  { id: "ADMINISTRACION", nombre: "Administración" },
                  { id: "TENS_TONS", nombre: "TENS/TONS" },
                  { id: "TELEMEDICINA", nombre: "Gestión de Telemedicina" },
                ],
                v.rol,
              )}${vistas.select("idIntegrante", "Vincular a integrante", [{ id: "", nombre: "Usuario administrativo" }, ...ctx.listaProfs], v.idIntegrante)}<fieldset class="full"><legend>Lugares asignados</legend>${ctx.listaSedes.map((s) => `<label class="check"><input type="checkbox" data-list="lugares" value="${s.id}" ${(v.lugares || [v.idPoliclinico]).includes(s.id) ? "checked" : ""}>${esc(s.nombre)}</label>`).join("")}${vistas.hidden({ lugares: (v.lugares || [v.idPoliclinico]).filter(Boolean).join(",") })}</fieldset>${vistas.select(
                "activo",
                "Estado",
                [
                  { id: 1, nombre: "Activo" },
                  { id: 0, nombre: "Inactivo" },
                ],
                v.activo === false ? 0 : 1,
              )}${vistas.select("sedePrincipal","Lugar principal al ingresar",[{id:"",nombre:"Primer lugar asignado"},...ctx.listaSedes],v.idPoliclinico||"")}${vistas.select("puedeTerminarAtencion","Finalizar flujo administrativo de atención",[{id:"1",nombre:"Permitido"},{id:"0",nombre:"Restringido"}],v.puedeTerminarAtencion===false?"0":"1")}<button type="submit">Guardar acceso</button></form>`,
            ),
        ),
      };
    },
    usuarioGuardar: safe(
      "/admin/usuarios",
      async ({ usuario: u, cuerpo: d }) => {
        await servicioOperacion.usuario(d, u);
        return redirect("/admin/usuarios");
      },
    ),
    usuarioEnlace: safe(
      "/admin/usuarios",
      async ({ usuario: u, cuerpo: d }) => {
        const enlace = await servicioOperacion.enlaceClave(d.id, u);
        return {
          html: vistas.page(
            u,
            "Enlace seguro",
            vistas.panel(
              "Restablecer contraseña",
              `<p>Enlace de un solo uso, válido por 30 minutos. Entrégalo al titular mediante un canal autorizado.</p><a href="${esc(enlace)}">Abrir enlace de restablecimiento</a><input aria-label="Enlace de restablecimiento" value="${esc(enlace)}" readonly>`,
            ),
          ),
        };
      },
    ),
    restablecer: ({ consulta: q }) => ({
      html: vistas.page(
        null,
        "Restablecer contraseña",
        vistas.panel(
          "Crear contraseña",
          `<form method="post" action="/restablecer">${vistas.hidden({ token: q.get("token") || "" })}${vistas.input("clave", "Nueva contraseña (mínimo 10 caracteres)", "", "password", 'minlength="10" required')}<button type="submit">Guardar contraseña</button></form>`,
        ),
      ),
    }),
    guardarClave: safe("/login", async ({ cuerpo: d }) => {
      await servicioOperacion.restablecer(d.token, d.clave);
      return redirect("/login");
    }),
    auditoria: async ({ usuario: u, consulta: q }) => {
      let lista = auditoria
        .listar()
        .filter(
          (x) =>
            (!q.get("desde") || x.fecha.slice(0, 10) >= q.get("desde")) &&
            (!q.get("hasta") || x.fecha.slice(0, 10) <= q.get("hasta")) &&
            (!q.get("usuario") ||
              x.usuario
                .toLowerCase()
                .includes(q.get("usuario").toLowerCase())) &&
            (!q.get("accion") ||
              x.accion.toLowerCase().includes(q.get("accion").toLowerCase())) &&
            (!q.get("sede") || x.idPoliclinico === +q.get("sede")) &&
            (!q.get("resultado") || x.resultado === q.get("resultado")) &&
            (!q.get("q") ||
              `${x.accion} ${x.detalle}`
                .toLowerCase()
                .includes(q.get("q").toLowerCase())),
        );
      return {
        html: vistas.page(
          u,
          "Auditoría",
          vistas.cab(
            "Registro de accesos y operaciones sensibles, con valores anteriores y posteriores.",
          ) +
            `<form class="filters">${vistas.input("desde", "Desde", q.get("desde") || "", "date")}${vistas.input("hasta", "Hasta", q.get("hasta") || "", "date")}${vistas.input("usuario", "Usuario", q.get("usuario") || "")}${vistas.input("accion", "Acción", q.get("accion") || "")}${vistas.select("sede", "Lugar", [{ id: "", nombre: "Seleccionar lugar…" }, ...(await catalogo.policlinicos())], q.get("sede") || "")}${vistas.select("resultado", "Resultado", [{ id: "", nombre: "Seleccionar resultado…" }, { id: "EXITOSO", nombre: "Exitoso" }, { id: "RECHAZADO", nombre: "Rechazado" }, { id: "ERROR", nombre: "Error" }], q.get("resultado") || "")}<button type="submit">Filtrar</button></form>` +
            tabla(
              [
                "Fecha",
                "Usuario",
                "Acción",
                "Resultado",
                "Módulo / registro",
                "Antes / después",
              ],
              lista
                .slice(0, 300)
                .map((x) => [
                  x.fecha,
                  x.usuario,
                  x.accion,
                  raw(vistas.badge({ EXITOSO: "Exitoso", RECHAZADO: "Rechazado", ERROR: "Error" }[x.resultado] || "Exitoso")),
                  x.resultado === "RECHAZADO" ? `${x.modulo || ""} ${x.registro || ""} · ${x.detalle}` : `${x.modulo || ""} ${x.registro || x.detalle}`,
                  raw(
                    `<details><summary>Ver valores</summary><pre>${esc(JSON.stringify({ antes: x.antes, despues: x.despues }, null, 2))}</pre></details>`,
                  ),
                ]),
            ),
        ),
      };
    },
  };
}
module.exports = { crearControladorOperacion };

"use strict";
const V = require("../views/operacion"),
  { tabla, raw, esc } = require("../views/util");
const { cargarContexto } = require("./contexto");
const { normalizarRut } = require("../util/rut");
const { hoy, sumarDias, textoLocal } = require("../util/tiempo");
const { infoSede } = require("../models/sedesInfo");
const { fechaValida, ids } = require("../services/OperacionService");
const RUTA_AGENDA_PERSONAL = "/tens/agenda";

function urlAgendaPersonal(valor) {
  if (typeof valor !== "string" || valor.length > 4096) return undefined;
  if (valor === RUTA_AGENDA_PERSONAL) return valor;
  if (!valor.startsWith(RUTA_AGENDA_PERSONAL + "?")) return undefined;

  const filtros = new URLSearchParams(valor.slice(RUTA_AGENDA_PERSONAL.length + 1));
  const destino = new URLSearchParams();
  const fecha = filtros.get("fecha");
  const vista = filtros.get("vista");
  if (fechaValida(fecha)) destino.set("fecha", fecha);
  if (["dia", "semana", "lista"].includes(vista)) destino.set("vista", vista);
  for (const nombre of ["esp", "prof", "estado", "q"]) {
    const filtro = filtros.get(nombre);
    if (filtro) destino.set(nombre, filtro);
  }
  return destino.size ? RUTA_AGENDA_PERSONAL + "?" + destino : RUTA_AGENDA_PERSONAL;
}

function crearOperacionController(c) {
  const {
    operacion: op,
    catalogo,
    citaRepo,
    extras,
    agendamiento,
    espera,
    auditoria,
  } = c;
  const contexto = async () => ({
    ...(await cargarContexto(catalogo)),
    comunas: await catalogo.comunas(),
    especialidades: await catalogo.especialidades(),
  });
  const visible = async (u) => {
    const ctx = await contexto();
    return (await citaRepo.listar()).filter(
      (x) =>
        op.sedeBloque(
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
      return { estado: 400, html: V.errorPage(r.usuario, e, destino) };
    }
  };
  const redirect = (redirigir) => ({ redirigir });
  const detalleReserva = (idCita, volver) => {
    const params = new URLSearchParams({ idCita });
    const volverAgenda = urlAgendaPersonal(volver);
    if (volverAgenda) params.set("volverAgenda", volverAgenda);
    return "/tens/reserva?" + params;
  };
  const volverAgenda = ({ cuerpo }) =>
    urlAgendaPersonal(cuerpo.volverAgenda) || RUTA_AGENDA_PERSONAL;
  const getAgenda = async ({ usuario: u, consulta: q, token }, admin) => ({
    html: V.calendario({
      u,
      q,
      ctx: await contexto(),
      citas: admin ? await citaRepo.listar() : await visible(u),
      op,
      admin,
      mensaje: admin
        ? undefined
        : c.sesiones.tomarAviso(token, urlAgendaPersonal(RUTA_AGENDA_PERSONAL + "?" + q)),
    }),
  });
  const pacienteVisible = async (u, rut) => {
    await op.exigirPaciente(u, rut);
    return catalogo.paciente(normalizarRut(rut));
  };
  const documentoVisible = async (u, id) => {
    const d = extras.buscar("documentos", id);
    if (!d || (d.idPoliclinico && d.idPoliclinico !== +u.idPoliclinico))
      throw new Error("FUERA_DE_SEDE");
    await op.exigirPaciente(u, d.rut);
    return d;
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
    const p = await catalogo.profesional(d.idProfesional);
    if (!p) throw new Error("PROFESIONAL_NO_ENCONTRADO");
    const bloques = (await catalogo.bloques()).filter(
      (b) => b.idProfesional === p.id && b.fecha === d.fecha,
    );
    const afectadas = await op.afectados(p.id, d.fecha);
    if (
      !["AUSENCIA", "REEMPLAZO", "CANCELACION", "LUGAR", "HORARIO"].includes(
        d.tipo,
      )
    )
      throw new Error("Tipo de cambio inválido.");
    if (d.tipo === "REEMPLAZO") {
      const r = await catalogo.profesional(d.idReemplazo);
      if (
        !r?.activo ||
        r.id === p.id ||
        !(r.especialidades || [r.especialidad]).includes(p.especialidad)
      )
        throw new Error("Reemplazo no compatible.");
      for (const b of bloques) {
        if (!op.lugares(r, b.fecha).includes(op.sedeBloque(b, p)))
          throw new Error("El reemplazo no está asignado al lugar.");
        if (
          (await catalogo.bloques()).some(
            (x) =>
              x.idProfesional === r.id &&
              x.fecha === b.fecha &&
              require("../services/OperacionService").minutos(x.hora) <
                require("../services/OperacionService").minutos(b.hora) +
                  (b.duracion || 30) &&
              require("../services/OperacionService").minutos(x.hora) +
                (x.duracion || 30) >
                require("../services/OperacionService").minutos(b.hora),
          )
        )
          throw new Error("El reemplazo tiene un cruce horario.");
      }
    }
    if (
      d.tipo === "LUGAR" &&
      !op.lugares(p, d.fecha).includes(+d.idPoliclinico)
    )
      throw new Error("Lugar no asignado al profesional.");
    const propuestos=[];
    if (d.tipo === "HORARIO") {
      if(!fechaValida(d.nuevaFecha)) throw new Error('Selecciona una nueva fecha.');
      const {minutos,hora}=require('../services/OperacionService');
      const inicio=Math.min(...bloques.map(b=>minutos(b.hora)));
      const delta=d.nuevaHoraInicio?minutos(d.nuevaHoraInicio)-inicio:0;
      const todos=await catalogo.bloques();
      for(const b of bloques){
        const m=minutos(b.hora)+delta;
        if(m<0||m+(b.duracion||30)>1440) throw new Error('El bloque propuesto excede el día.');
        const propuesta={...b,fecha:d.nuevaFecha,hora:hora(m)};
        if(!op.lugares(p,d.nuevaFecha).includes(op.sedeBloque(b,p))) throw new Error('Asignación no vigente en la fecha propuesta.');
        if(todos.some(x=>!bloques.some(y=>y.id===x.id)&&x.idProfesional===p.id&&x.fecha===d.nuevaFecha&&minutos(x.hora)<m+(b.duracion||30)&&minutos(x.hora)+(x.duracion||30)>m)) throw new Error('El horario propuesto tiene cruces.');
        propuestos.push(propuesta);
      }
    }
    return { p, bloques, afectadas, propuestos, datos: d };
  };
  const cambiosVista = async (u, d = {}, plan) => {
    const ctx = await contexto();
    return {
      html: V.page(
        u,
        "Cambios de agenda",
        V.cab(
          "Cambios de agenda",
          "Revisa las reservas afectadas antes de aplicar una modificación.",
          V.btn("Volver a agendas", "/admin/agendas", true)+V.btn("Estado de notificaciones","/admin/comunicaciones",true),
        ) +
          V.panel(
            "Proponer cambio",
            `<form class="form-grid" method="post" action="/admin/cambio/revisar">${V.select("idProfesional", "Profesional", ctx.listaProfs, d.idProfesional)}${V.input("fecha", "Fecha de agenda", d.fecha || hoy(), "date", "required")}${V.select(
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
            )}${V.select("idReemplazo", "Profesional reemplazante", ctx.listaProfs, d.idReemplazo)}${V.select("idPoliclinico", "Lugar propuesto", ctx.listaSedes, d.idPoliclinico)}${V.input("nuevaFecha", "Fecha propuesta", d.nuevaFecha || hoy(), "date")}${V.input("nuevaHoraInicio", "Nueva hora inicial (opcional)", d.nuevaHoraInicio || "", "time")}${V.input("motivo", "Motivo", d.motivo || "", "text", "required")}${V.select("destino", "Horario cancelado", V.opcionesTexto(["Bloqueado", "Disponible"]), d.destino || "Bloqueado")}<label class="check"><input type="checkbox" name="whatsapp" value="1" ${d.whatsapp === "1" ? "checked" : ""}>Notificar por WhatsApp</label><label class="check"><input type="checkbox" name="correo" value="1" ${d.correo === "1" ? "checked" : ""}>Notificar por correo</label><button type="submit">Ver Agenda actual versus Cambio propuesto</button></form>`,
          ) +
          (plan
            ? V.panel(
                "Agenda actual versus Cambio propuesto",
                `<div class="comparison"><div><h3>Agenda actual</h3><p>${esc(plan.p.nombre)} · ${esc(d.fecha)}</p><p>${plan.bloques.length} cupos · ${plan.afectadas.length} reservas</p></div><div><h3>Cambio propuesto</h3><p>${esc(d.tipo)} · ${esc(d.motivo)}</p><p>${esc(d.nuevaFecha||d.fecha)} ${esc(d.nuevaHoraInicio||'')} · ${esc(ctx.sedes.get(+d.idPoliclinico)?.nombre||'')}</p><p>Responsable: ${esc(u.nombre)}</p></div></div><form method="post" action="/admin/cambio/guardar">${V.hidden({ ...d, huella: require("node:crypto").createHash("sha256").update(JSON.stringify(plan.afectadas)).digest("hex") })}<p>${plan.afectadas.length} reservas afectadas. Selecciona las citas para cancelar si corresponde.</p>${tabla(
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
                      V.btn(
                        "Buscar alternativas",
                        "/admin/agendas?esp=" +
                          encodeURIComponent(plan.p.especialidad),
                        true,
                      ),
                    ),
                  ]),
                )}${V.hidden({ idCitas: plan.afectadas.map((x) => x.id).join(",") })}<button type="submit">Confirmar cambio · ${esc(u.nombre)}</button></form>`,
              )
            : "") +
          V.panel(
            "Cambios registrados",
            tabla(
              ["Fecha", "Tipo", "Motivo", "Reservas afectadas", "Responsable"],
              c.cambios
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
    resumen: async ({ usuario: u }) => {
      const R = require("../views/resumen");
      const admin = u.rol === "ADMINISTRACION";
      const ctx = await contexto();
      const ahora = textoLocal();
      const fHoy = ahora.slice(0, 10),
        hora = ahora.slice(11),
        manana = sumarDias(fHoy, 1),
        semana = sumarDias(fHoy, 7),
        hace30 = sumarDias(fHoy, -30);
      const sedeDe = (b) => op.sedeBloque(b, ctx.profs.get(b?.idProfesional));
      const miSede = (idSede) => admin || idSede === Number(u.idPoliclinico);
      const citas = (admin ? await citaRepo.listar() : await visible(u))
        .map((x) => ({ x, b: ctx.bloques.get(x.idBloque) }))
        .filter(({ b }) => b);
      const activas = citas.filter(({ x }) => x.estadoReserva === "ACTIVA");
      const tele = (b) => !!ctx.sedes.get(sedeDe(b))?.telemedicina;
      const esPendiente = ({ x }) => !x.asistencia && x.estadoConfirmacion !== "CONFIRMADA";
      const hoyC = activas.filter(({ b }) => b.fecha === fHoy).sort((a, z) => a.b.hora.localeCompare(z.b.hora));
      const proximas48 = activas.filter(({ b }) => b.fecha === fHoy || b.fecha === manana);
      const sinConfirmar = proximas48.filter(esPendiente);
      const sinAsistencia = hoyC.filter(({ x, b }) => !x.asistencia && b.hora <= hora);
      const sinEnlace = proximas48.filter(({ x, b }) => tele(b) && !x.asistencia && ["Enlace pendiente", "Error de envío"].includes(op.estadoEnvioEnlace(x).estado));
      const reservados = new Set(activas.map(({ x }) => x.idBloque));
      const cuposSemana = [...ctx.bloques.values()].filter((b) => b.publicado && b.fecha >= fHoy && b.fecha <= semana && miSede(sedeDe(b)));
      const libresSemana = cuposSemana.filter((b) => !reservados.has(b.id) && (b.fecha > fHoy || b.hora > hora));
      const esperaV = (await espera.vigentes()).filter((e) => miSede(e.idPoliclinico));
      const esperaConCupo = esperaV.filter((e) => e.estado === "EN_ESPERA" && e.cupos.length);
      const esperaAntigua = esperaV.filter((e) => e.registradaEn && e.registradaEn <= hace30);
      const comErr = extras.listar("comunicaciones").filter((m) => m.estado === "Error" && (admin || m.idPoliclinico === +u.idPoliclinico));
      const docsPend = extras.listar("documentos").filter((d) => !d.verificado && !d.archivado && (admin || d.idPoliclinico === +u.idPoliclinico));
      const ultimos30 = citas.filter(({ x, b }) => b.fecha >= hace30 && b.fecha <= fHoy && x.asistencia);
      const inasist = R.pct(ultimos30.filter(({ x }) => x.asistencia === "NO_ASISTIO").length, ultimos30.length);
      const profInactivos = activas.filter(({ x, b }) => b.fecha >= fHoy && !x.idProfesionalReemplazo && ctx.profs.get(b.idProfesional)?.activo === false);
      const confirmadasHoy = hoyC.filter(({ x }) => x.estadoConfirmacion === "CONFIRMADA").length;
      const atendidasHoy = hoyC.filter(({ x }) => x.asistencia === "ASISTIO").length;
      const base = admin ? "/admin" : "/tens";
      const agendaDia = admin ? "/admin/agendas?vista=lista" : "/tens/agenda?vista=lista";
      const kpis = [
        { href: agendaDia, clase: "dest", icono: "calendario", valor: hoyC.length, texto: "Citas hoy", nota: `${atendidasHoy} atendidas · ${confirmadasHoy} confirmadas` },
        { href: admin ? "/admin/comunicaciones" : "/tens/confirmaciones", clase: sinConfirmar.length ? "am" : "", icono: "telefono", valor: sinConfirmar.length, texto: "Por confirmar (hoy y mañana)" },
        { href: `${base}/espera`, clase: "az", icono: "lista", valor: esperaV.length, texto: "Pacientes en lista de espera", nota: esperaConCupo.length ? `${esperaConCupo.length} con cupo disponible` : "" },
        admin
          ? { href: "/admin/reportes", clase: inasist >= 20 ? "rojo" : "gr", icono: "grafico", valor: inasist == null ? "—" : `${inasist}%`, texto: "Inasistencia últimos 30 días", nota: `Ocupación 7 días: ${(R.pct(cuposSemana.length - libresSemana.length, cuposSemana.length) ?? "—") + (cuposSemana.length ? "%" : "")}` }
          : { href: "/tens/agenda?vista=semana", clase: "gr", icono: "reloj", valor: libresSemana.length, texto: "Cupos libres próximos 7 días" },
      ];
      const alertas = [
        { nivel: "crit", titulo: "Citas de hoy sin registrar asistencia", detalle: "La hora ya pasó y falta marcar si llegó o no", n: sinAsistencia.length, href: agendaDia },
        { nivel: "crit", titulo: "Citas de hoy o mañana sin confirmar", detalle: "Llamar o enviar recordatorio al paciente", n: sinConfirmar.length, href: admin ? "/admin/comunicaciones" : "/tens/confirmaciones" },
        ...(admin || tele({ idPoliclinico: +u.idPoliclinico })
          ? [{ nivel: "crit", titulo: "Telemedicina sin enlace enviado", detalle: "Citas de hoy o mañana sin enlace de atención o con error de envío", n: sinEnlace.length, href: agendaDia }]
          : []),
        ...(admin
          ? [{ nivel: "crit", titulo: "Citas con profesional inactivo", detalle: "Reservas futuras sin reemplazo asignado: reagendar o reasignar", n: profInactivos.length, href: "/admin/cancelaciones" }]
          : []),
        { nivel: "crit", titulo: "Mensajes con error de envío", detalle: "Comunicaciones que no llegaron al paciente", n: comErr.length, href: `${base}/comunicaciones` },
        { nivel: "aviso", titulo: "Lista de espera con cupo disponible", detalle: "Hay horas libres que calzan con la solicitud", n: esperaConCupo.length, href: `${base}/espera` },
        { nivel: "aviso", titulo: "Solicitudes en espera hace más de 30 días", detalle: "Revisar prioridad o contactar al paciente", n: esperaAntigua.length, href: `${base}/espera` },
        ...(admin ? [] : [{ nivel: "aviso", titulo: "Documentos por revisar", detalle: "Órdenes o documentos subidos sin verificar", n: docsPend.length, href: "/tens/documentos" }]),
      ].sort((a, z) => (z.n ? 1 : 0) - (a.n ? 1 : 0) || (a.nivel === "crit" ? -1 : 1) - (z.nivel === "crit" ? -1 : 1));
      const citasHoy = hoyC.slice(0, admin ? 10 : 12).map(({ x, b }) => {
        const prof = ctx.profs.get(b.idProfesional);
        const est = V.estado(x, tele(b), op);
        return {
          fecha: b.fecha,
          hora: b.hora,
          paciente: ctx.pacientes.get(x.rut)?.nombre || x.rut,
          detalle: [b.especialidad, prof?.nombre, admin ? ctx.sedes.get(sedeDe(b))?.nombre : ""].filter(Boolean).join(" · "),
          href: admin ? "/admin/cupo?idCita=" + x.id : detalleReserva(x.id),
          badge: V.badge(est),
        };
      });
      const porSede = admin
        ? ctx.listaSedes.map((s) => {
            const deSede = (b) => sedeDe(b) === s.id;
            const cs = cuposSemana.filter(deSede);
            return {
              nombre: s.nombre,
              hoy: hoyC.filter(({ b }) => deSede(b)).length,
              porConfirmar: sinConfirmar.filter(({ b }) => deSede(b)).length,
              espera: esperaV.filter((e) => e.idPoliclinico === s.id).length,
              ocupacion: R.pct(cs.filter((b) => reservados.has(b.id)).length, cs.length),
            };
          })
        : null;
      return {
        html: R.resumen({ usuario: u, admin, sede: ctx.sedes.get(+u.idPoliclinico), kpis, alertas, citasHoy, porSede, hora }),
      };
    },
    adminAgenda: (r) => getAgenda(r, true),
    tensAgenda: (r) => getAgenda(r, false),
    bloqueNuevo: async ({ usuario: u }) => ({
      html: V.bloqueNuevo({ u, ctx: await contexto() }),
    }),
    bloqueRevisar: safe(
      "/admin/bloque/nuevo",
      async ({ usuario: u, cuerpo: d }) => ({
        html: V.bloqueNuevo({
          u,
          ctx: await contexto(),
          d,
          plan: await op.plan(d),
        }),
      }),
    ),
    bloqueGuardar: safe(
      "/admin/bloque/nuevo",
      async ({ usuario: u, cuerpo: d }) => {
        await op.crearSerie(d, u);
        return redirect(
          "/admin/agendas?" +
            new URLSearchParams({
              fecha: d.desde,
              sede: d.idPoliclinico,
              prof: d.idProfesional,
            }),
        );
      },
    ),
    equipo: async ({ usuario: u, consulta: q }) => ({
      html: V.equipo({ u, ctx: await contexto(), op, q }),
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
          html: V.equipo({
            u,
            ctx: await contexto(),
            op,
            q: new URLSearchParams(),
            d,
            revision: await op.equipo(d, u),
          }),
        };
      },
    ),
    equipoGuardar: safe(
      "/admin/profesionales",
      async ({ usuario: u, cuerpo: d }) => {
        const r = await op.equipo(d, u, true);
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
        const p = await catalogo.profesional(d.idProfesional);
        if (!p) throw new Error("Profesional no encontrado.");
        if (d.activo !== "1") {
          const suyos = new Set(
            (await catalogo.bloques())
              .filter((b) => b.idProfesional === p.id && b.fecha >= hoy())
              .map((b) => b.id),
          );
          const vigentes = (await citaRepo.listar()).filter(
            (x) => x.estadoReserva === "ACTIVA" && !x.asistencia && suyos.has(x.idBloque),
          ).length;
          if (vigentes)
            throw new Error(
              `${p.nombre} tiene ${vigentes} reserva(s) vigente(s). Reprográmalas o cancélalas (Cambios de agenda o Cancelaciones) antes de desactivarlo.`,
            );
        }
        await catalogo.setProfesionalActivo(p.id, d.activo === "1");
        op.aud(u, "Estado del integrante actualizado", "Equipo", p.id, p, {
          ...p,
          activo: d.activo === "1",
        });
        return redirect("/admin/profesionales");
      },
    ),
    lugares: async ({ usuario: u, consulta: q }) => ({
      html: V.lugares({ u, ctx: await contexto(), op, q }),
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
        op.meta.sedes[n.id] = {
          nombre: d.nombre,
          direccion: d.direccion,
          especialidades,
          color: d.color,
          activo: d.activo === "1",
        };
        op.aud(
          u,
          "Lugar actualizado",
          "Policlínicos",
          n.id,
          previo,
          op.meta.sedes[n.id],
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
        const antes = op.meta.especialidades[d.nombre];
        await catalogo.guardarEspecialidad({
          nombre: d.nombre.trim(),
          activo: d.activo === "1",
        });
        op.meta.especialidades[d.nombre] = {
          color: d.color,
          activo: d.activo === "1",
        };
        op.aud(
          u,
          "Especialidad actualizada",
          "Especialidades",
          d.nombre,
          antes,
          op.meta.especialidades[d.nombre],
        );
        return redirect("/admin/policlinicos?tab=especialidades");
      },
    ),
    colores: async ({ usuario: u }) => ({
      html: V.page(
        u,
        "Colores de agenda",
        V.cab(
          "Colores de agenda",
          "En Toda la red se usa el color del lugar; al elegir una sede se usa el color de especialidad.",
        ) +
          V.btn("Colores por lugar", "/admin/policlinicos", true) +
          V.btn(
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
            const b = await catalogo.bloque(x.idBloque);
            await catalogo.cambiarPublicacion({
              idProfesional: b.idProfesional,
              desde: b.fecha,
              hasta: b.fecha,
              idBloque: b.id,
              publicar: false,
            });
            (op.meta.bloques[b.id] ||= {}).estado = "Bloqueado";
          }
        }
      }
      if (d.tipo === "AUSENCIA") {
        await c.cambios.ausencia({
          idProfesional: plan.p.id,
          fecha: d.fecha,
          motivo: d.motivo,
          idUsuario: u.id,
        });
        for (const b of plan.bloques)
          if (!plan.afectadas.some((x) => x.idBloque === b.id))
            (op.meta.bloques[b.id] ||= {}).estado = "Bloqueado";
      }
      if (d.tipo === "LUGAR" || d.tipo === "HORARIO")
        for (const b of plan.bloques) {
          const m = (op.meta.bloques[b.id] ||= {});
          if (d.tipo === "LUGAR") {
            await catalogo.actualizarBloque(b.id, {
              idPoliclinico: +d.idPoliclinico,
            });
            m.idPoliclinico = +d.idPoliclinico;
          } else {const nuevo=plan.propuestos.find(x=>x.id===b.id);await catalogo.actualizarBloque(b.id,{fecha:nuevo.fecha,hora:nuevo.hora});}
        }
      for (const x of citas) {
        if (d.whatsapp === "1")
          await op.comunicar(u, x, "WhatsApp", "Cambio institucional");
        if (d.correo === "1")
          await op.comunicar(u, x, "Correo", "Cambio institucional");
      }
      const sede = op.sedeBloque(plan.bloques[0], plan.p);
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
      op.aud(
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
    cupo: async ({ usuario: u, consulta: q }) => {
      const x = q.get("idCita")
          ? await op.exigirCita(u, q.get("idCita"))
          : null,
        b = await catalogo.bloque(x?.idBloque || q.get("idBloque"));
      if (!b) throw new Error("CITA_NO_ENCONTRADA");
      return {
        html: V.reserva({ u, ctx: {...await contexto(), disponibles:await agendamiento.bloquesDisponibles({especialidad:b.especialidad||(await catalogo.profesional(b.idProfesional)).especialidad})}, c: x, b, op, admin: true }),
      };
    },
    cupoEstado: safe("/admin/agendas", async ({ usuario: u, cuerpo: d }) => {
      const b = await catalogo.bloque(d.idBloque);
      if (!b || !["Disponible", "Bloqueado", "Sin publicar"].includes(d.estado))
        throw new Error("Cupo o estado inválido.");
      if (await citaRepo.buscarActivaPorBloque(b.id))
        throw new Error("El cupo tiene una reserva activa.");
      await catalogo.cambiarPublicacion({
        idProfesional: b.idProfesional,
        desde: b.fecha,
        hasta: b.fecha,
        idBloque: b.id,
        publicar: d.estado === "Disponible",
      });
      (op.meta.bloques[b.id] ||= {}).estado = d.estado;
      op.aud(u, "Estado del cupo actualizado", "Agendas", b.id, b, {
        estado: d.estado,
      });
      return redirect("/admin/agendas?fecha=" + b.fecha);
    }),
    pacientes: async ({ usuario: u, consulta: q }) => {
      if (q.get("nuevo"))
        return {
          html: require("../views/tens").pacientes({
            usuario: u,
            lista: [],
            comunas: await catalogo.comunas(),
          }),
        };
      const lista = [];
      for (const p of await catalogo.pacientes())
        if (await op.acceso(u, p.rut)) lista.push(p);
      return { html: V.pacientes({ u, lista, ctx: await contexto(), citas: await visible(u), q }) };
    },
    ficha: async ({ usuario: u, consulta: q }) => {
      const p = await pacienteVisible(u, q.get("rut"));
      op.aud(u, "Ficha consultada", "Pacientes", p.rut, null, null);
      return {
        html: V.ficha({
          u,
          p,
          q,
          ctx: await contexto(),
          citas: (await visible(u)).filter((x) => x.rut === p.rut),
          documentos: c.documentos
            .listar()
            .filter(
              (d) =>
                d.rut === p.rut &&
                (!d.idPoliclinico || d.idPoliclinico === +u.idPoliclinico),
            ),
          mensajes: extras
            .listar("comunicaciones")
            .filter(
              (m) => m.rut === p.rut && m.idPoliclinico === +u.idPoliclinico,
            ),
          op,
        }),
      };
    },
    preferencias: safe("/tens/pacientes", async ({ usuario: u, cuerpo: d }) => {
      const p = await pacienteVisible(u, d.rut),
        antes = structuredClone(op.meta.pacientes[p.rut] || {});
      Object.assign((op.meta.pacientes[p.rut] ||= {}), {
        contactoPreferido: d.contactoPreferido,
        consentimientoComunicaciones: d.consentimientoComunicaciones === "1",
      });
      op.aud(
        u,
        "Preferencias actualizadas",
        "Pacientes",
        p.rut,
        antes,
        op.meta.pacientes[p.rut],
      );
      return redirect("/tens/ficha?rut=" + p.rut);
    }),
    desactivar: safe("/tens/pacientes", async ({ usuario: u, cuerpo: d }) => {
      const p = await pacienteVisible(u, d.rut);
      (op.meta.pacientes[p.rut] ||= {}).activo = p.activo === false;
      op.aud(
        u,
        "Estado paciente actualizado",
        "Pacientes",
        p.rut,
        { activo: p.activo !== false },
        { activo: p.activo === false },
      );
      return redirect("/tens/pacientes");
    }),
    reserva: async ({ usuario: u, consulta: q }) => {
      const x = q.get("idCita")
          ? await op.exigirCita(u, q.get("idCita"))
          : null,
        b = await catalogo.bloque(x?.idBloque || q.get("idBloque")),
        ctx = await contexto();
      if (
        !b ||
        op.sedeBloque(b, ctx.profs.get(b.idProfesional)) !== +u.idPoliclinico
      )
        throw new Error("FUERA_DE_SEDE");
      ctx.disponibles = await agendamiento.bloquesDisponibles({
        idPoliclinico: u.idPoliclinico,
        especialidad:
          b.especialidad || ctx.profs.get(b.idProfesional)?.especialidad,
      });
      return {
        html: V.reserva({
          u, ctx, c: x, b, op,
          volverAgenda: urlAgendaPersonal(q.get("volverAgenda")),
        }),
      };
    },
    flujo: safe(volverAgenda, async (r) => {
      const { usuario: u, cuerpo: d, token } = r;
      const x = await op.exigirCita(u, d.idCita);
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
      if (["Atendida", "No asistió", "No se conectó"].includes(d.estado))
        await agendamiento.registrarAsistencia(x.id, d.estado === "Atendida");
      (op.meta.citas[x.id] ||= {}).flujo = d.estado;
      op.aud(u, "Flujo de atención actualizado", "Atención", x.id, x, {
        estado: d.estado,
      });
      const destino = volverAgenda(r);
      c.sesiones.guardarAviso(token, destino, {
        tipo: "exito",
        texto: "El estado de la reserva se guardó.",
      });
      return redirect(destino);
    }),
    cancelar: safe("/tens/agenda", async ({ usuario: u, cuerpo: d }) => {
      camposCancelacion(d);
      if (!["WhatsApp", "Llamada", "Presencial"].includes(d.canal))
        throw new Error("Canal de solicitud inválido.");
      const x = await op.exigirCita(u, d.idCita);
      await agendamiento.cancelar(x.id, "ASISTIDA");
      const b = await catalogo.bloque(x.idBloque);
      if (d.destino === "Bloqueado") {
        await catalogo.cambiarPublicacion({
          idProfesional: b.idProfesional,
          desde: b.fecha,
          hasta: b.fecha,
          idBloque: b.id,
          publicar: false,
        });
        (op.meta.bloques[b.id] ||= {}).estado = "Bloqueado";
      }
      op.aud(u, "Cancelación solicitada por paciente", "Reservas", x.id, x, {
        motivo: d.motivo,
        canal: d.canal,
        destino: d.destino,
      });
      return redirect("/tens/espera");
    }),
    reagendar: safe("/tens/agenda", async ({ usuario: u, cuerpo: d }) => {
      const x = await op.exigirCita(u, d.idCita),
        b = await catalogo.bloque(d.idBloque),
        p = b && (await catalogo.profesional(b.idProfesional));
      if (!b || (u.rol!=="ADMINISTRACION" && op.sedeBloque(b, p) !== +u.idPoliclinico))
        throw new Error("FUERA_DE_SEDE");
      if (!d.motivo?.trim()) throw new Error("Indica un motivo.");
      const nueva = await agendamiento.agendar({
        rut: x.rut,
        idBloque: b.id,
        idUsuario: u.id,
      });
      try {
        await agendamiento.cancelar(x.id, "ASISTIDA");
      } catch (e) {
        await agendamiento.cancelar(nueva.id, "ASISTIDA");
        throw e;
      }
      op.aud(u, "Reserva reprogramada", "Reservas", x.id, x, {
        nuevaReserva: nueva.id,
        motivo: d.motivo,
      });
      if(u.rol==="ADMINISTRACION"){await op.comunicar(u,nueva,"Correo","Reprogramación institucional");return redirect("/admin/cupo?idCita="+nueva.id);}
      return redirect("/tens/reserva?idCita=" + nueva.id);
    }),
    espera: async ({ usuario: u, consulta: q }) => ({
      html: V.espera({
        u,
        q,
        ctx: {
          ...(await contexto()),
          listaProfs:(await catalogo.profesionales()).filter(p=>op.lugares(p).includes(+u.idPoliclinico)),
          especialidades:
            op.meta.sedes[u.idPoliclinico]?.especialidades ||
            infoSede(u.idPoliclinico)?.especialidades ||
            [],
        },
        lista: (await espera.vigentes()).filter(
          (x) => x.idPoliclinico === +u.idPoliclinico,
        ),
      }),
    }),
    supervision: async ({ usuario: u, consulta: q }) => ({
      html: V.espera({
        u,
        q,
        ctx: await contexto(),
        lista: await espera.vigentes(),
        admin: true,
      }),
    }),
    esperaGestion: safe("/tens/espera", async ({ usuario: u, cuerpo: d }) => {
      const e = (await catalogo.espera()).find((x) => x.id === +d.idSolicitud);
      if (!e || e.idPoliclinico !== +u.idPoliclinico)
        throw new Error("FUERA_DE_SEDE");
      if (!["Contactado", "Hora ofrecida", "No responde"].includes(d.estado))
        throw new Error("Estado inválido.");
      const m = (op.meta.espera[e.id] ||= {});
      m.estadoOperativo = d.estado;
      m.contactos ||= [];
      m.contactos.push({
        fecha: textoLocal(),
        canal: d.canal,
        resultado: d.estado,
        responsable: u.nombre,
      });
      op.aud(
        u,
        "Contacto de lista de espera registrado",
        "Lista de espera",
        e.id,
        e,
        m,
      );
      return redirect("/tens/espera");
    }),
    comunicaciones: async ({ usuario: u }) => {
      const admin = u.rol === "ADMINISTRACION",
        lista = extras
          .listar("comunicaciones")
          .filter((m) => admin || m.idPoliclinico === +u.idPoliclinico);
      return {
        html: V.page(
          u,
          "Comunicaciones",
          V.cab(
            "Comunicaciones",
            "Confirmaciones, recordatorios y contacto administrativo. Los envíos permanecen pendientes hasta conectar un proveedor.",
            !admin
              ? V.btn("Confirmaciones / llamadas", "/tens/confirmaciones", true)
              : "",
          ) +
            V.panel(
              "Bandeja operativa",
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
                  raw(
                    V.post(
                      admin?"/admin/comunicacion":"/tens/comunicacion",
                      { idCita: m.idCita, canal: m.canal, tipo: m.tipo },
                      m.tipo === "Enlace de atención" ? "Solicitar envío" : "Reenviar",
                      true,
                    ),
                  ),
                ]),
              ),
            ) +
            (!admin
              ? V.panel(
                  "Crear recordatorio",
                  `<form class="form-grid" method="post" action="/tens/comunicacion">${V.select(
                    "idCita",
                    "Reserva",
                    (await visible(u)).filter(
                      (x) => x.estadoReserva === "ACTIVA",
                    ),
                    "",
                    (x) => x.id,
                    (x) => `${x.rut} · Reserva ${x.id}`,
                  )}${V.select("canal", "Canal", V.opcionesTexto(["WhatsApp", "Correo"]))}<button type="submit">Preparar recordatorio</button></form>`,
                )
              : ""),
        ),
      };
    },
    comunicacion: safe(
      "/tens/comunicaciones",
      async ({ usuario: u, cuerpo: d }) => {
        const x = await op.exigirCita(u, d.idCita);
        if (!["WhatsApp", "Correo"].includes(d.canal))
          throw new Error("Canal inválido.");
        const tipo = d.tipo || "Recordatorio";
        if (tipo === "Enlace de atención" && !["TELEMEDICINA", "ADMINISTRACION"].includes(u.rol))
          throw new Error("FUERA_DE_SEDE");
        await op.comunicar(u, x, d.canal, tipo);
        if (tipo === "Enlace de atención" && d.origen === "reserva" && u.rol === "TELEMEDICINA")
          return redirect(detalleReserva(x.id, d.volverAgenda));
        return redirect(u.rol === "ADMINISTRACION" ? "/admin/comunicaciones" : "/tens/comunicaciones");
      },
    ),
    enlace: safe("/tens/agenda", async ({ usuario: u, cuerpo: d }) => {
      if (u.rol !== "TELEMEDICINA") throw new Error("FUERA_DE_SEDE");
      const x = await op.exigirCita(u, d.idCita);
      let url;
      try {
        url = new URL(d.enlace);
      } catch {
        throw new Error("Enlace inválido.");
      }
      if (url.protocol !== "https:") throw new Error("Usa un enlace HTTPS.");
      (op.meta.citas[x.id] ||= {}).enlace = url.href;
      op.aud(u, "Enlace de Telemedicina actualizado", "Telemedicina", x.id, x, {
        enlace: url.href,
      });
      return redirect(detalleReserva(x.id, d.volverAgenda));
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
        op.aud(u, "Documento archivado", "Documentos", doc.id, antes, {
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
        html: V.page(
          u,
          "Usuarios y permisos",
          V.cab(
            "Usuarios y permisos",
            "Configuración administrativa de accesos y lugares.",
            V.btn("Auditoría", "/admin/auditoria", true),
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
                  V.btn("Editar", "/admin/usuarios?editar=" + x.id, true) +
                    V.post(
                      "/admin/usuario/enlace",
                      { id: x.id },
                      "Enlace seguro",
                      true,
                    ),
                ),
              ]),
            ) +
            V.panel(
              v.id ? "Editar acceso" : "Crear acceso",
              `<form class="form-grid" method="post" action="/admin/usuario">${V.hidden({ id: v.id || "" })}${V.input("nombre", "Nombre", v.nombre || "", "text", "required")}${V.input("correo", "Correo", v.correo || "", "email", "required")}${V.select(
                "rol",
                "Rol",
                [
                  { id: "ADMINISTRACION", nombre: "Administración" },
                  { id: "TENS_TONS", nombre: "TENS/TONS" },
                  { id: "TELEMEDICINA", nombre: "Gestión de Telemedicina" },
                ],
                v.rol,
              )}${V.select("idIntegrante", "Vincular a integrante", [{ id: "", nombre: "Usuario administrativo" }, ...ctx.listaProfs], v.idIntegrante)}<fieldset class="full"><legend>Lugares asignados</legend>${ctx.listaSedes.map((s) => `<label class="check"><input type="checkbox" data-list="lugares" value="${s.id}" ${(v.lugares || [v.idPoliclinico]).includes(s.id) ? "checked" : ""}>${esc(s.nombre)}</label>`).join("")}${V.hidden({ lugares: (v.lugares || [v.idPoliclinico]).filter(Boolean).join(",") })}</fieldset>${V.select(
                "activo",
                "Estado",
                [
                  { id: 1, nombre: "Activo" },
                  { id: 0, nombre: "Inactivo" },
                ],
                v.activo === false ? 0 : 1,
              )}${V.select("sedePrincipal","Lugar principal al ingresar",[{id:"",nombre:"Primer lugar asignado"},...ctx.listaSedes],v.idPoliclinico||"")}${V.select("puedeTerminarAtencion","Finalizar flujo administrativo de atención",[{id:"1",nombre:"Permitido"},{id:"0",nombre:"Restringido"}],v.puedeTerminarAtencion===false?"0":"1")}<button type="submit">Guardar acceso</button></form>`,
            ),
        ),
      };
    },
    usuarioGuardar: safe(
      "/admin/usuarios",
      async ({ usuario: u, cuerpo: d }) => {
        await op.usuario(d, u);
        return redirect("/admin/usuarios");
      },
    ),
    usuarioEnlace: safe(
      "/admin/usuarios",
      async ({ usuario: u, cuerpo: d }) => {
        const enlace = await op.enlaceClave(d.id, u);
        return {
          html: V.page(
            u,
            "Enlace seguro",
            V.panel(
              "Restablecer contraseña",
              `<p>Enlace de un solo uso, válido por 30 minutos. Entrégalo al titular mediante un canal autorizado.</p><a href="${esc(enlace)}">Abrir enlace de restablecimiento</a><input aria-label="Enlace de restablecimiento" value="${esc(enlace)}" readonly>`,
            ),
          ),
        };
      },
    ),
    restablecer: ({ consulta: q }) => ({
      html: V.page(
        null,
        "Restablecer contraseña",
        V.panel(
          "Crear contraseña",
          `<form method="post" action="/restablecer">${V.hidden({ token: q.get("token") || "" })}${V.input("clave", "Nueva contraseña (mínimo 10 caracteres)", "", "password", 'minlength="10" required')}<button type="submit">Guardar contraseña</button></form>`,
        ),
      ),
    }),
    guardarClave: safe("/login", async ({ cuerpo: d }) => {
      await op.restablecer(d.token, d.clave);
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
            (!q.get("q") ||
              `${x.accion} ${x.detalle}`
                .toLowerCase()
                .includes(q.get("q").toLowerCase())),
        );
      return {
        html: V.page(
          u,
          "Auditoría",
          V.cab(
            "Auditoría",
            "Registro de accesos y operaciones sensibles, con valores anteriores y posteriores.",
          ) +
            `<form class="filters">${V.input("desde", "Desde", q.get("desde") || "", "date")}${V.input("hasta", "Hasta", q.get("hasta") || "", "date")}${V.input("usuario", "Usuario", q.get("usuario") || "")}${V.input("accion", "Acción", q.get("accion") || "")}${V.select("sede", "Lugar", [{ id: "", nombre: "Todos" }, ...(await catalogo.policlinicos())], q.get("sede") || "")}<button type="submit">Filtrar</button></form>` +
            tabla(
              [
                "Fecha",
                "Usuario",
                "Acción",
                "Módulo / registro",
                "Antes / después",
              ],
              lista
                .slice(0, 300)
                .map((x) => [
                  x.fecha,
                  x.usuario,
                  x.accion,
                  `${x.modulo || ""} ${x.registro || x.detalle}`,
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
module.exports = { crearOperacionController };

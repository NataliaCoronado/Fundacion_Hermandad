"use strict";
const vistas = require("../views/operacion");
const { tabla, raw, esc } = require("../views/componentesComunes");
const { cargarContexto } = require("./cargarListasBase");
const { hoy, sumarDias, textoLocal } = require("../herramientas/tiempo");
const { fechaValida, ids } = require("../services/OperacionServicio");

const ESTADOS = ["Disponible", "Bloqueado", "Sin publicar"];
const MAX_DIAS_RANGO = 190;
const LIMITE_LISTA = 300;

function crearControladorCancelacionesYReprogramaciones(c) {
  const { operacion: servicioOperacion, catalogo, citaRepo, extras, agendamiento } = c;
  extras.extras.cancelaciones ||= [];
  const redirect = (redirigir) => ({ redirigir });
  const safe = (volver, fn) => async (r) => {
    try {
      return await fn(r);
    } catch (e) {
      return { estado: 400, html: vistas.errorPage(r.usuario, e, volver) };
    }
  };

  async function candidatas(consulta) {
    const ctx = await cargarContexto(catalogo);
    const desde = fechaValida(consulta.desde) && consulta.desde > hoy() ? consulta.desde : hoy();
    const hasta = fechaValida(consulta.hasta) ? consulta.hasta : "";
    const salida = [];
    for (const x of await citaRepo.listar()) {
      if (x.estadoReserva !== "ACTIVA" || x.asistencia) continue;
      const bloque = ctx.bloques.get(x.idBloque);
      const profesional = bloque && ctx.profs.get(bloque.idProfesional);
      if (!bloque || bloque.fecha < desde || (hasta && bloque.fecha > hasta)) continue;
      const sede = servicioOperacion.sedeBloque(bloque, profesional);
      const esp = bloque.especialidad || profesional?.especialidad || "";
      if (consulta.sede && sede !== +consulta.sede) continue;
      if (consulta.prof && profesional?.id !== +consulta.prof) continue;
      if (consulta.esp && esp !== consulta.esp) continue;
      salida.push({
        cita: x,
        fecha: bloque.fecha,
        hora: bloque.hora,
        paciente: ctx.pacientes.get(x.rut)?.nombre || x.rut,
        rut: x.rut,
        profesional: profesional?.nombre || "",
        especialidad: esp,
        lugar: ctx.sedes.get(sede)?.nombre || "",
      });
    }
    return {
      ctx,
      lista: salida.sort((a, b) =>
        `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`),
      ),
    };
  }

  const items = () =>
    extras
      .listar("cancelaciones")
      .flatMap((r) => (r.items || []).map((it) => ({ it, r })));
  function pendientes() {
    return items()
      .filter(({ it }) => !it.reprogramadaA)
      .map(({ it, r }) => ({ ...it, motivo: r.motivo, registrada: r.fecha }))
      .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
  }
  function itemPendiente(idCita) {
    const x = items().find(({ it }) => it.idCita === Number(idCita));
    if (!x) throw new Error("La reserva no está en la lista de cancelaciones.");
    if (x.it.reprogramadaA) throw new Error("La reserva ya fue reprogramada.");
    return x.it;
  }
  async function alternativas(it) {
    const ctx = await cargarContexto(catalogo);
    const ahora = textoLocal();
    return (await agendamiento.bloquesDisponibles({ especialidad: it.especialidad }))
      .filter((b) => `${b.fecha} ${b.hora}` > ahora)
      .map((b) => {
        const profesional = ctx.profs.get(b.idProfesional);
        const sede = servicioOperacion.sedeBloque(b, profesional);
        return {
          idBloque: b.id,
          fecha: b.fecha,
          hora: b.hora,
          profesional: profesional?.nombre || "",
          lugar: ctx.sedes.get(sede)?.nombre || "",
          mismoLugar: ctx.sedes.get(sede)?.nombre === it.lugar,
        };
      })
      .sort(
        (a, b) =>
          Number(b.mismoLugar) - Number(a.mismoLugar) ||
          `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`),
      );
  }
  async function vistaReprogramar(u, idCita, mensaje) {
    const pendiente = itemPendiente(idCita);
    const ops = (await alternativas(pendiente)).slice(0, 15);
    const cuerpo = ops.length
      ? `<form method="post" action="/admin/cancelaciones/reprogramar">${vistas.hidden({ idCita: pendiente.idCita })}${tabla(
          ["", "Fecha", "Hora", "Profesional", "Lugar"],
          ops.map((o, i) => [
            raw(`<input type="radio" name="idBloque" value="${o.idBloque}" ${i ? "" : "checked"} aria-label="Elegir ${esc(o.fecha)} ${esc(o.hora)}">`),
            o.fecha,
            o.hora,
            o.profesional,
            `${o.lugar}${o.mismoLugar ? " (mismo lugar)" : ""}`,
          ]),
        )}<div class="form-grid"><label class="check"><input type="checkbox" name="whatsapp" value="1">Notificar por WhatsApp</label><label class="check"><input type="checkbox" name="correo" value="1">Notificar por correo</label><button type="submit">Reservar nueva hora</button></div></form>`
      : '<p class="empty-inline">No hay horas disponibles de esta especialidad. Publica cupos o deja al paciente en lista de espera.</p>';
    return {
      html: vistas.page(
        u,
        "Reprogramar reserva cancelada",
        vistas.cab(
          `${esc(pendiente.paciente)} · ${esc(pendiente.rut)} — antes: ${esc(pendiente.fecha)} ${esc(pendiente.hora)}, ${esc(pendiente.especialidad)}, ${esc(pendiente.lugar)}.`,
          vistas.btn("Volver a cancelaciones", "/admin/cancelaciones", true),
        ) + vistas.panel("Horas disponibles", cuerpo),
        mensaje,
      ),
    };
  }

  async function vistaCancelaciones(u, q, mensaje) {
    const filtros = Object.fromEntries(
      ["sede", "prof", "esp", "desde", "hasta"].map((k) => [k, q.get(k) || ""]),
    );
    const { ctx, lista } = await candidatas(filtros);
    const especialidades = await catalogo.especialidades();
    const pend = pendientes();
    const historial = [...extras.listar("cancelaciones")].reverse().slice(0, 20);
    const formFiltros = `<form class="filters">${vistas.select("sede", "Lugar", [{ id: "", nombre: "Todos" }, ...ctx.listaSedes], filtros.sede)}${vistas.select("esp", "Especialidad", [{ id: "", nombre: "Todas" }, ...vistas.opcionesTexto(especialidades)], filtros.esp)}${vistas.select("prof", "Profesional", [{ id: "", nombre: "Todos" }, ...ctx.listaProfs], filtros.prof)}${vistas.input("desde", "Desde", filtros.desde || hoy(), "date")}${vistas.input("hasta", "Hasta", filtros.hasta, "date")}<button type="submit">Filtrar</button></form>`;
    const formCancelar = lista.length
      ? `<form method="post" action="/admin/cancelaciones" onsubmit="return confirm('Se cancelarán las reservas seleccionadas. ¿Continuar?')">${vistas.hidden({ idCitas: "" })}${lista.length > LIMITE_LISTA ? `<p class="muted">Se muestran las primeras ${LIMITE_LISTA} de ${lista.length}. Usa los filtros para acotar.</p>` : ""}${tabla(
          ["", "Fecha", "Hora", "Paciente", "Profesional", "Especialidad", "Lugar"],
          lista.slice(0, LIMITE_LISTA).map((x) => [
            raw(`<input type="checkbox" data-list="idCitas" value="${x.cita.id}" aria-label="Seleccionar reserva ${x.cita.id}">`),
            x.fecha,
            x.hora,
            `${x.paciente} · ${x.rut}`,
            x.profesional,
            x.especialidad,
            x.lugar,
          ]),
        )}<div class="form-grid">${vistas.input("motivo", "Motivo", "", "text", "required")}${vistas.select("destino", "Horario cancelado", vistas.opcionesTexto(["Bloqueado", "Disponible"]), "Bloqueado")}<label class="check"><input type="checkbox" name="whatsapp" value="1">Notificar por WhatsApp</label><label class="check"><input type="checkbox" name="correo" value="1">Notificar por correo</label><button type="submit">Cancelar reservas seleccionadas</button></div></form>`
      : '<p class="empty-inline">No hay reservas activas que coincidan con los filtros.</p>';
    const tablaPend = pend.length
      ? tabla(
          ["Fecha original", "Paciente", "Especialidad", "Lugar", "Motivo", ""],
          pend.map((x) => [
            `${x.fecha} ${x.hora}`,
            `${x.paciente} · ${x.rut}`,
            x.especialidad,
            x.lugar,
            x.motivo,
            raw(vistas.btn("Reprogramar", `/admin/cancelaciones/reprogramar?idCita=${x.idCita}`, true)),
          ]),
        )
      : '<p class="empty-inline">No hay reservas pendientes de reprogramar.</p>';
    const tablaHist = historial.length
      ? tabla(
          ["Registrada", "Motivo", "Reservas", "Horario", "Responsable"],
          historial.map((r) => [r.fecha, r.motivo, r.items.length, r.destino, r.responsable]),
        )
      : '<p class="empty-inline">Aún no hay cancelaciones registradas.</p>';
    return {
      html: vistas.page(
        u,
        "Cancelaciones institucionales",
        vistas.cab(
          "Cancela reservas en lote con motivo y aviso al paciente. La falta de respuesta no es motivo de cancelación.",
          vistas.btn("Volver a agendas", "/admin/agendas", true) +
            vistas.btn("Estado de notificaciones", "/admin/comunicaciones", true),
        ) +
          formFiltros +
          vistas.panel(`Reservas activas (${lista.length})`, formCancelar) +
          vistas.panel(`Pendientes de reprogramar (${pend.length})`, tablaPend) +
          vistas.panel("Últimas cancelaciones", tablaHist),
        mensaje,
      ),
    };
  }

  async function vistaRango(u, datos = {}, mensaje) {
    const ctx = await cargarContexto(catalogo);
    const especialidades = await catalogo.especialidades();
    return {
      html: vistas.page(
        u,
        "Cupos por rango",
        vistas.cab(
          "Publica, bloquea o deja sin publicar todos los cupos libres de un periodo. Los cupos con reserva activa no se modifican.",
          vistas.btn("Volver a agendas", "/admin/agendas", true),
        ) +
          vistas.panel(
            "Rango y filtros",
            `<form class="form-grid" method="post" action="/admin/cupos/rango" onsubmit="return confirm('Se cambiará el estado de todos los cupos libres que coincidan. ¿Continuar?')">${vistas.input("desde", "Desde", datos.desde || hoy(), "date", "required")}${vistas.input("hasta", "Hasta", datos.hasta || sumarDias(hoy(), 6), "date", "required")}${vistas.select("sede", "Lugar", [{ id: "", nombre: "Toda la red" }, ...ctx.listaSedes], datos.sede)}${vistas.select("esp", "Especialidad", [{ id: "", nombre: "Todas" }, ...vistas.opcionesTexto(especialidades)], datos.esp)}${vistas.select("prof", "Profesional", [{ id: "", nombre: "Todos" }, ...ctx.listaProfs], datos.prof)}${vistas.select("estado", "Nuevo estado", vistas.opcionesTexto(ESTADOS), datos.estado || "Disponible")}<button type="submit">Aplicar cambio</button></form>`,
          ),
        mensaje,
      ),
    };
  }

  return {
    cancelaciones: ({ usuario: u, consulta: q }) => vistaCancelaciones(u, q),
    cancelar: safe("/admin/cancelaciones", async ({ usuario: u, cuerpo: d }) => {
      const seleccion = ids(d.idCitas);
      if (!seleccion.length) throw new Error("Selecciona al menos una reserva.");
      if (!d.motivo?.trim()) throw new Error("Indica el motivo de la cancelación.");
      if (/no responde|sin respuesta|no contest/i.test(d.motivo))
        throw new Error("La falta de respuesta no es motivo para cancelar una reserva.");
      if (!["Bloqueado", "Disponible"].includes(d.destino))
        throw new Error("Indica si el horario queda bloqueado o disponible.");
      const { lista } = await candidatas({});
      const elegidas = lista.filter((x) => seleccion.includes(x.cita.id));
      if (!elegidas.length) throw new Error("Las reservas seleccionadas ya no están activas.");
      const items = [];
      for (const x of elegidas) {
        await agendamiento.cancelar(x.cita.id, "INSTITUCIONAL");
        if (d.destino === "Bloqueado") {
          const bloque = await catalogo.bloque(x.cita.idBloque);
          await catalogo.cambiarPublicacion({
            idProfesional: bloque.idProfesional,
            desde: bloque.fecha,
            hasta: bloque.fecha,
            idBloque: bloque.id,
            publicar: false,
          });
          (servicioOperacion.meta.bloques[bloque.id] ||= {}).estado = "Bloqueado";
        }
        const avisos = [];
        if (d.whatsapp === "1") avisos.push(await servicioOperacion.comunicar(u, x.cita, "WhatsApp", "Cancelación institucional"));
        if (d.correo === "1") avisos.push(await servicioOperacion.comunicar(u, x.cita, "Correo", "Cancelación institucional"));
        const { cita, ...resto } = x;
        items.push({ ...resto, idCita: cita.id, avisos: avisos.map((a) => `${a.canal}: ${a.estado}`) });
      }
      const cancelacion = extras.agregar("cancelaciones", {
        fecha: textoLocal(),
        motivo: d.motivo.trim(),
        destino: d.destino,
        responsable: u.nombre,
        items,
      });
      servicioOperacion.aud(u, "Cancelación institucional", "Reservas", cancelacion.id ?? items.map((x) => x.idCita).join(","), null, cancelacion);
      return vistaCancelaciones(u, new URLSearchParams(), {
        tipo: "ok",
        texto: `${items.length} reserva(s) cancelada(s). El horario quedó ${d.destino === "Bloqueado" ? "bloqueado" : "disponible"}. Reprográmalas desde "Pendientes de reprogramar".`,
      });
    }),

    reprogramar: safe("/admin/cancelaciones", ({ usuario: u, consulta: q }) =>
      vistaReprogramar(u, q.get("idCita")),
    ),
    reprogramarGuardar: safe("/admin/cancelaciones", async ({ usuario: u, cuerpo: d }) => {
      const pendiente = itemPendiente(d.idCita);
      const o = (await alternativas(pendiente)).find((x) => x.idBloque === +d.idBloque);
      if (!o) throw new Error("La hora elegida ya no está disponible. Elige otra.");
      const nueva = await agendamiento.agendar({ rut: pendiente.rut, idBloque: o.idBloque, idUsuario: u.id });
      pendiente.reprogramadaA = `${o.fecha} ${o.hora}`;
      pendiente.idCitaNueva = nueva.id;
      if (d.whatsapp === "1") await servicioOperacion.comunicar(u, nueva, "WhatsApp", "Reprogramación institucional");
      if (d.correo === "1") await servicioOperacion.comunicar(u, nueva, "Correo", "Reprogramación institucional");
      servicioOperacion.aud(u, "Reserva reprogramada", "Reservas", pendiente.idCita, { hora: `${pendiente.fecha} ${pendiente.hora}` }, {
        nuevaReserva: nueva.id,
        hora: pendiente.reprogramadaA,
        profesional: o.profesional,
        lugar: o.lugar,
      });
      return vistaCancelaciones(u, new URLSearchParams(), {
        tipo: "ok",
        texto: `Nueva hora reservada para ${pendiente.paciente}: ${pendiente.reprogramadaA}, ${o.profesional}, ${o.lugar}.`,
      });
    }),

    rango: ({ usuario: u }) => vistaRango(u),
    rangoAplicar: async ({ usuario: u, cuerpo: d }) => {
      try {
        if (!fechaValida(d.desde) || !fechaValida(d.hasta)) throw new Error("Indica fechas válidas.");
        if (d.desde > d.hasta) throw new Error("La fecha inicial es posterior a la final.");
        if ((Date.parse(d.hasta) - Date.parse(d.desde)) / 86400000 > MAX_DIAS_RANGO)
          throw new Error(`El rango no puede superar ${MAX_DIAS_RANGO} días.`);
        if (!ESTADOS.includes(d.estado)) throw new Error("Estado inválido.");
        const ctx = await cargarContexto(catalogo);
        const activas = new Set(
          (await citaRepo.listar()).filter((x) => x.estadoReserva === "ACTIVA").map((x) => x.idBloque),
        );
        let n = 0;
        for (const b of ctx.bloques.values()) {
          const profesional = ctx.profs.get(b.idProfesional);
          if (b.fecha < d.desde || b.fecha > d.hasta || activas.has(b.id)) continue;
          if (d.sede && servicioOperacion.sedeBloque(b, profesional) !== +d.sede) continue;
          if (d.prof && b.idProfesional !== +d.prof) continue;
          if (d.esp && (b.especialidad || profesional?.especialidad) !== d.esp) continue;
          const actual = servicioOperacion.meta.bloques[b.id]?.estado || (b.publicado ? "Disponible" : "Sin publicar");
          if (actual === d.estado) continue;
          await catalogo.cambiarPublicacion({
            idProfesional: b.idProfesional,
            desde: b.fecha,
            hasta: b.fecha,
            idBloque: b.id,
            publicar: d.estado === "Disponible",
          });
          (servicioOperacion.meta.bloques[b.id] ||= {}).estado = d.estado;
          n++;
        }
        servicioOperacion.aud(u, "Estado de cupos por rango", "Agendas", `${d.desde} a ${d.hasta}`, null, {
          ...d,
          cupos: n,
        }, d.sede ? +d.sede : null);
        return vistaRango(u, d, {
          tipo: "ok",
          texto: n
            ? `${n} cupo(s) quedaron en estado "${d.estado}".`
            : "No había cupos libres que cambiar con esos filtros y fechas (los reservados no se modifican).",
        });
      } catch (e) {
        return { estado: 400, ...(await vistaRango(u, d, { tipo: "error", texto: e.message })) };
      }
    },

    equipoEliminar: safe("/admin/profesionales", async ({ usuario: u, cuerpo: d }) => {
      const profesional = await catalogo.profesional(d.idProfesional);
      if (!profesional) throw new Error("Profesional no encontrado.");
      const bloques = new Set(
        (await catalogo.bloques()).filter((b) => b.idProfesional === profesional.id).map((b) => b.id),
      );
      if ((await citaRepo.listar()).some((x) => bloques.has(x.idBloque)))
        throw new Error("El integrante tiene reservas o historial de atenciones; desactívalo en vez de eliminarlo.");
      await catalogo.eliminarProfesional(profesional.id);
      delete servicioOperacion.meta.equipo[profesional.id];
      servicioOperacion.aud(u, "Integrante eliminado", "Equipo", profesional.id, profesional, null);
      return redirect("/admin/profesionales");
    }),
  };
}
module.exports = { crearControladorCancelacionesYReprogramaciones };

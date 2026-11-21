"use strict";
const vistas = require("../views/admin");
const { error, ok } = require("./mensajesDeError");
const { cargarContexto } = require("./cargarListasBase");
const { hoy, sumarDias, diaSemana, lunesDe } = require("../herramientas/tiempo");

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;
const aMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const aHora = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

function crearControladorAdmin({
  catalogo,
  reportes,
  cambios,
  auditoria,
  citaRepo,
  espera,
}) {
  const verProfesionales = async (
    usuario,
    mensaje,
    consulta = new URLSearchParams(),
  ) => {
    const ctx = await cargarContexto(catalogo);
    const hoyTexto = hoy();
    const filtro = {
      q: (consulta.get("q") || "").trim(),
      sede: consulta.get("sede") || "",
      esp: consulta.get("esp") || "",
      estado: consulta.get("estado") || "",
    };
    const [p30, prox] = await Promise.all([
      reportes.porProfesional({ desde: sumarDias(hoyTexto, -29), hasta: hoyTexto }),
      reportes.porProfesional({ desde: hoyTexto, hasta: sumarDias(hoyTexto, 13) }),
    ]);
    const futuro = new Map(prox.map((x) => [x.id, x]));
    const textoBuscado = filtro.q.toLowerCase();
    const filas = p30
      .map((x) => ({
        ...x,
        idPoliclinico: ctx.profs.get(x.id)?.idPoliclinico,
        tasaInasistencia: pct(x.noAsistio, x.asistio + x.noAsistio),
        libres: Math.max(
          0,
          (futuro.get(x.id)?.cupos || 0) - (futuro.get(x.id)?.activas || 0),
        ),
      }))
      .filter(
        (x) =>
          (!filtro.sede || String(x.idPoliclinico) === filtro.sede) &&
          (!filtro.esp || x.especialidad === filtro.esp) &&
          (!filtro.estado || (filtro.estado === "1") === x.activo) &&
          (!textoBuscado ||
            `${x.profesional} ${x.especialidad}`.toLowerCase().includes(textoBuscado)),
      )
      .sort(
        (a, b) =>
          a.policlinico.localeCompare(b.policlinico, "es") ||
          a.especialidad.localeCompare(b.especialidad, "es") ||
          a.profesional.localeCompare(b.profesional, "es", { numeric: true }),
      );
    return {
      html: vistas.profesionales({
        filas,
        ctx,
        filtro,
        especialidades: await catalogo.especialidades(),
        mensaje,
        usuario,
      }),
    };
  };

  const verAgendas = async (
    usuario,
    mensaje,
    { sede, prof: idProf, semana } = {},
  ) => {
    const ctx = await cargarContexto(catalogo);
    const activos = ctx.listaProfs.filter((p) => p.activo);
    let sel = ctx.profs.get(Number(idProf)) || null;
    const sedeSel =
      Number(sede) || sel?.idPoliclinico || activos[0]?.idPoliclinico;
    const delaSede = activos.filter((p) => p.idPoliclinico === sedeSel);
    if (!sel || sel.idPoliclinico !== sedeSel) sel = delaSede[0] || null;
    const lunes = lunesDe(FECHA.test(semana || "") ? semana : hoy());
    const fin = sumarDias(lunes, 6);
    const bloques = sel
      ? [...ctx.bloques.values()].filter(
          (b) =>
            b.idProfesional === sel.id && b.fecha >= lunes && b.fecha <= fin,
        )
      : [];
    const ids = new Set(bloques.map((b) => b.id));
    const reservados = new Set(
      (await citaRepo.listar())
        .filter((c) => c.estadoReserva === "ACTIVA" && ids.has(c.idBloque))
        .map((c) => c.idBloque),
    );
    const dias = Array.from({ length: 7 }, (_, i) => ({
      i,
      fecha: sumarDias(lunes, i),
    })).filter((d) => d.i < 5 || bloques.some((b) => b.fecha === d.fecha));
    return {
      html: vistas.agendas({
        prof: sel,
        sedeSel,
        sedes: ctx.listaSedes,
        profesionales: delaSede,
        semana: lunes,
        anterior: sumarDias(lunes, -7),
        siguiente: sumarDias(lunes, 7),
        hoyLunes: lunesDe(hoy()),
        bloques,
        reservados,
        dias,
        mensaje,
        usuario,
        ctx: {
          ...ctx,
          hoy: hoy(),
          especialidades: await catalogo.especialidades(),
        },
      }),
    };
  };
  const verCambios = async (usuario, mensaje) => {
    const ctx = await cargarContexto(catalogo);
    return {
      html: vistas.cambios({
        profesionales: ctx.listaProfs.filter((p) => p.activo),
        lista: cambios.listar(),
        ctx,
        mensaje,
        usuario,
      }),
    };
  };
  const descarga = (nombre, texto) => ({ csv: texto, nombreArchivo: nombre });

  const filtroDe = (consulta, porDefecto) => {
    let desde = consulta.get("desde");
    let hasta = consulta.get("hasta");
    if (!FECHA.test(desde || "") || !FECHA.test(hasta || ""))
      ({ desde, hasta } = porDefecto || {});
    if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];
    const filtro = { desde, hasta };
    const sede = Number(consulta.get("sede"));
    if (sede) filtro.idPoliclinico = sede;
    if (consulta.get("esp")) filtro.especialidad = consulta.get("esp");
    return filtro;
  };
  const filtroTexto = (f) =>
    `${f.desde || ""} a ${f.hasta || ""}${f.idPoliclinico ? `, sede ${f.idPoliclinico}` : ""}${f.especialidad ? `, ${f.especialidad}` : ""}`;
  const csvDe =
    (nombre, fn) =>
    async ({ consulta, usuario }) => {
      const filtro = filtroDe(consulta, {});
      await auditoria.registrar(
        usuario,
        "Reporte descargado",
        `${nombre}${filtro.desde ? ` (${filtroTexto(filtro)})` : ""}`,
      );
      return descarga(nombre, await fn(filtro));
    };

  return {
    panel: async ({ usuario }) => {
      const hoyTexto = hoy();
      const [ctx, a30, a12, op, vigentes] = await Promise.all([
        cargarContexto(catalogo),
        reportes.analitica({ desde: sumarDias(hoyTexto, -29), hasta: hoyTexto }),
        reportes.analitica({
          desde: sumarDias(lunesDe(hoyTexto), -84),
          hasta: sumarDias(lunesDe(hoyTexto), -1),
        }),
        reportes.operacion(),
        espera.vigentes(),
      ]);
      return {
        html: vistas.panel({
          usuario,
          a30,
          a12,
          op,
          espera: {
            vigentes: vigentes.length,
            conCupo: vigentes.filter((e) => e.cupos.length).length,
          },
          cambios: cambios.listar().slice(0, 4),
          auditoria: auditoria.listar().slice(0, 5),
          ctx,
        }),
      };
    },
    policlinicos: async ({ usuario }) => {
      const hoyTexto = hoy();
      const ctx = await cargarContexto(catalogo);
      const [hoy30, prox] = await Promise.all([
        reportes.porPoliclinico({ desde: sumarDias(hoyTexto, -29), hasta: hoyTexto }),
        reportes.porPoliclinico({ desde: hoyTexto, hasta: sumarDias(hoyTexto, 13) }),
      ]);
      return {
        html: vistas.policlinicos({
          lista: ctx.listaSedes,
          hoy30,
          prox,
          profesionales: ctx.listaProfs,
          usuario,
        }),
      };
    },
    profesionales: ({ usuario, consulta }) =>
      verProfesionales(usuario, null, consulta),
    cambiarEstadoProfesional: async ({ cuerpo, usuario }) => {
      try {
        await catalogo.setProfesionalActivo(
          cuerpo.idProfesional,
          cuerpo.activo === "1",
        );
        await auditoria.registrar(
          usuario,
          cuerpo.activo === "1"
            ? "Profesional activado"
            : "Profesional desactivado",
          cuerpo.idProfesional,
        );
        return verProfesionales(usuario, ok("Estado actualizado."));
      } catch (e) {
        return verProfesionales(usuario, error(e));
      }
    },
    agendas: ({ usuario, consulta }) =>
      verAgendas(usuario, null, {
        sede: consulta.get("sede"),
        prof: consulta.get("prof"),
        semana: consulta.get("semana"),
      }),
    crearBloque: async ({ cuerpo, usuario }) => {
      const vista = { prof: cuerpo.idProfesional, semana: cuerpo.semana };
      if (!cuerpo.idProfesional || !cuerpo.fecha || !cuerpo.hora)
        return verAgendas(
          usuario,
          error(new Error("DATOS_INCOMPLETOS")),
          vista,
        );
      try {
        if (!(await catalogo.profesional(cuerpo.idProfesional)))
          throw new Error("PROFESIONAL_NO_ENCONTRADO");
        await catalogo.crearBloque({
          idProfesional: Number(cuerpo.idProfesional),
          fecha: cuerpo.fecha,
          hora: cuerpo.hora,
          publicado: cuerpo.publicado === "1",
        });
        await auditoria.registrar(
          usuario,
          "Bloque creado",
          `${cuerpo.fecha} ${cuerpo.hora} prof ${cuerpo.idProfesional}`,
        );
        return verAgendas(usuario, ok("Cupo creado."), {
          prof: cuerpo.idProfesional,
          semana: FECHA.test(cuerpo.fecha) ? cuerpo.fecha : cuerpo.semana,
        });
      } catch (e) {
        return verAgendas(usuario, error(e), vista);
      }
    },
    publicarCupos: async ({ cuerpo, usuario }) => {
      const vista = { prof: cuerpo.idProfesional, semana: cuerpo.semana };
      try {
        if (!(await catalogo.profesional(cuerpo.idProfesional)))
          throw new Error("PROFESIONAL_NO_ENCONTRADO");
        if (!FECHA.test(cuerpo.desde || "") || !FECHA.test(cuerpo.hasta || ""))
          throw new Error("DATOS_INCOMPLETOS");
        if (cuerpo.desde > cuerpo.hasta) throw new Error("RANGO_INVALIDO");
        const publicar = cuerpo.accion === "publicar";
        const n = await catalogo.cambiarPublicacion({
          idProfesional: cuerpo.idProfesional,
          desde: cuerpo.desde,
          hasta: cuerpo.hasta,
          idBloque: cuerpo.idBloque || null,
          publicar,
        });
        await auditoria.registrar(
          usuario,
          publicar ? "Cupos liberados" : "Cupos bloqueados",
          `prof ${cuerpo.idProfesional} ${cuerpo.desde} a ${cuerpo.hasta}: ${n}`,
        );
        return verAgendas(
          usuario,
          ok(
            n
              ? `${n} cupo(s) ${publicar ? "liberado(s): ya se pueden reservar" : "bloqueado(s): ya no se ofrecen"}.`
              : "No había cupos que cambiar en ese rango (los que tienen una cita no se modifican).",
          ),
          vista,
        );
      } catch (e) {
        return verAgendas(usuario, error(e), vista);
      }
    },
    serieCupos: async ({ cuerpo, usuario }) => {
      const vista = { prof: cuerpo.idProfesional, semana: cuerpo.semana };
      try {
        if (!(await catalogo.profesional(cuerpo.idProfesional)))
          throw new Error("PROFESIONAL_NO_ENCONTRADO");
        if (
          !FECHA.test(cuerpo.desde || "") ||
          !FECHA.test(cuerpo.hasta || "") ||
          !HORA.test(cuerpo.horaInicio || "") ||
          !HORA.test(cuerpo.horaFin || "")
        )
          throw new Error("DATOS_INCOMPLETOS");
        if (cuerpo.desde > cuerpo.hasta) throw new Error("RANGO_INVALIDO");
        const dur = Number(cuerpo.duracion);
        const ini = aMin(cuerpo.horaInicio);
        const fin = aMin(cuerpo.horaFin);
        if (!Number.isInteger(dur) || dur < 10 || dur > 120 || ini >= fin)
          throw new Error("HORARIO_INVALIDO");
        const dias = [0, 1, 2, 3, 4, 5].filter(
          (i) => cuerpo[`dia${i}`] === "1",
        );
        if (!dias.length) throw new Error("SIN_DIAS");
        if (
          Date.parse(cuerpo.hasta) - Date.parse(cuerpo.desde) >
          122 * 86400000
        )
          throw new Error("RANGO_MUY_LARGO");
        let creados = 0;
        let repetidos = 0;
        let sinAgenda = 0;
        for (let f = cuerpo.desde; f <= cuerpo.hasta; f = sumarDias(f, 1)) {
          if (!dias.includes(diaSemana(f))) continue;
          for (let m = ini; m + dur <= fin; m += dur) {
            if (creados + repetidos + sinAgenda >= 1000)
              throw new Error("RANGO_MUY_LARGO");
            try {
              await catalogo.crearBloque({
                idProfesional: Number(cuerpo.idProfesional),
                fecha: f,
                hora: aHora(m),
                duracion: dur,
                publicado: cuerpo.publicado === "1",
              });
              creados++;
            } catch (e) {
              if (e.message === "BLOQUE_DUPLICADO") repetidos++;
              else if (e.message === "SIN_AGENDA") sinAgenda++;
              else throw e;
            }
          }
        }
        if (!creados && sinAgenda) throw new Error("SIN_AGENDA");
        await auditoria.registrar(
          usuario,
          "Cupos creados en serie",
          `prof ${cuerpo.idProfesional} ${cuerpo.desde} a ${cuerpo.hasta}: ${creados}`,
        );
        const notas = [
          repetidos && `${repetidos} ya existían`,
          sinAgenda && `${sinAgenda} fuera de la vigencia de la agenda`,
        ]
          .filter(Boolean)
          .join("; ");
        return verAgendas(
          usuario,
          ok(
            `${creados} cupo(s) creado(s)${cuerpo.publicado === "1" ? " y disponibles" : " (bloqueados: libéralos cuando corresponda)"}${notas ? `. ${notas}` : ""}.`,
          ),
          { prof: cuerpo.idProfesional, semana: cuerpo.desde },
        );
      } catch (e) {
        return verAgendas(usuario, error(e), vista);
      }
    },
    publicarMasivo: async ({ cuerpo, usuario }) => {
      const vista = {
        prof: cuerpo.idProfesional,
        semana: cuerpo.semana,
        sede: cuerpo.idPoliclinico,
      };
      try {
        if (!FECHA.test(cuerpo.desde || "") || !FECHA.test(cuerpo.hasta || ""))
          throw new Error("DATOS_INCOMPLETOS");
        if (cuerpo.desde > cuerpo.hasta) throw new Error("RANGO_INVALIDO");
        const profs = (await catalogo.profesionales()).filter(
          (p) =>
            p.activo &&
            (!cuerpo.idPoliclinico ||
              p.idPoliclinico === Number(cuerpo.idPoliclinico)) &&
            (!cuerpo.especialidad || p.especialidad === cuerpo.especialidad),
        );
        if (!profs.length) throw new Error("SIN_PROFESIONALES");
        const publicar = cuerpo.accion === "publicar";
        let n = 0;
        for (const p of profs)
          n += await catalogo.cambiarPublicacion({
            idProfesional: p.id,
            desde: cuerpo.desde,
            hasta: cuerpo.hasta,
            idBloque: null,
            publicar,
          });
        await auditoria.registrar(
          usuario,
          publicar
            ? "Cupos liberados (varios profesionales)"
            : "Cupos bloqueados (varios profesionales)",
          `${profs.length} profesionales, ${cuerpo.desde} a ${cuerpo.hasta}: ${n}`,
        );
        return verAgendas(
          usuario,
          ok(
            `${n} cupo(s) ${publicar ? "liberado(s)" : "bloqueado(s)"} en ${profs.length} profesional(es).`,
          ),
          vista,
        );
      } catch (e) {
        return verAgendas(usuario, error(e), vista);
      }
    },
    cambios: ({ usuario }) => verCambios(usuario),
    registrarCambio: async ({ cuerpo, usuario }) => {
      try {
        const datos = {
          idProfesional: cuerpo.idProfesional,
          idReemplazo: cuerpo.idReemplazo,
          fecha: cuerpo.fecha,
          motivo: cuerpo.motivo,
          idUsuario: usuario.id,
        };
        const r =
          cuerpo.tipo === "REEMPLAZO"
            ? await cambios.reemplazo(datos)
            : await cambios.ausencia(datos);
        await auditoria.registrar(
          usuario,
          `Cambio de agenda (${r.tipo})`,
          `prof ${r.idProfesional} ${r.fecha}`,
        );
        return verCambios(
          usuario,
          ok(
            `Cambio registrado: ${r.citasAfectadas} cita(s) afectada(s), ${r.bloquesCerrados} cupo(s) cerrado(s).`,
          ),
        );
      } catch (e) {
        return verCambios(usuario, error(e));
      }
    },
    reportes: async ({ usuario, consulta }) => {
      const hoyTexto = hoy();
      const filtro = filtroDe(consulta, { desde: sumarDias(hoyTexto, -89), hasta: hoyTexto });
      const ctx = await cargarContexto(catalogo);
      const extra = { sede: filtro.idPoliclinico, esp: filtro.especialidad };
      const rango = (d, a) =>
        `?${new URLSearchParams(Object.entries({ desde: d, hasta: a, ...extra }).filter(([, v]) => v)).toString()}`;
      const rapidos = [
        ["Últimos 7 días", sumarDias(hoyTexto, -6), hoyTexto],
        ["Últimos 30 días", sumarDias(hoyTexto, -29), hoyTexto],
        ["Últimos 90 días", sumarDias(hoyTexto, -89), hoyTexto],
        ["Próximos 14 días", hoyTexto, sumarDias(hoyTexto, 13)],
      ].map(([t, d, a]) => ({
        t,
        qs: rango(d, a),
        act: filtro.desde === d && filtro.hasta === a,
      }));
      const qsDescarga = rango(filtro.desde, filtro.hasta);
      const analitica = await reportes.analitica(filtro);
      const completas = analitica.semanal.filter(
        (w) =>
          w.semana >= filtro.desde && sumarDias(w.semana, 6) <= filtro.hasta,
      );
      if (completas.length >= 2) analitica.semanal = completas;
      return {
        html: vistas.reportes({
          a: analitica,
          filtro,
          sedes: ctx.listaSedes,
          especialidades: await catalogo.especialidades(),
          rapidos,
          qsDescarga,
          usuario,
        }),
      };
    },
    csvProfesionales: csvDe("profesionales.csv", (f) =>
      reportes.csvProfesionales(f),
    ),
    csvResumen: csvDe("resumen.csv", (f) => reportes.csvResumen(f)),
    csvCitas: csvDe("citas.csv", (f) => reportes.csvDetalle(f)),
    usuarios: async ({ usuario }) => ({
      html: vistas.usuarios({
        lista: await catalogo.usuarios(),
        ctx: await cargarContexto(catalogo),
        usuario,
      }),
    }),
    auditoria: ({ usuario, consulta }) => {
      const textoBuscado = (consulta.get("q") || "").trim().toLowerCase();
      const todo = auditoria.listar();
      const lista = (
        textoBuscado
          ? todo.filter((x) =>
              `${x.usuario} ${x.accion} ${x.detalle}`.toLowerCase().includes(textoBuscado),
            )
          : todo
      ).slice(0, 200);
      return {
        html: vistas.auditoria({
          lista,
          q: consulta.get("q") || "",
          total: textoBuscado
            ? todo.filter((x) =>
                `${x.usuario} ${x.accion} ${x.detalle}`
                  .toLowerCase()
                  .includes(textoBuscado),
              ).length
            : todo.length,
          usuario,
        }),
      };
    },
  };
}
module.exports = { crearControladorAdmin };

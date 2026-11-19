"use strict";
const vistas = require("../views/tens");
const { normalizarRut } = require("../util/rut");
const { textoLocal, hoy } = require("../util/tiempo");
const { error, ok } = require("./mensajes");
const { cargarContexto, detalleCita } = require("./contexto");

function crearTensController(c) {
  const {
    citaRepo,
    catalogo,
    agendamiento,
    confirmacion,
    pacientes,
    espera,
    bot,
    documentos,
    extras,
    auditoria,
  } = c;
  const sedeDe = (u) => (u && u.idPoliclinico ? Number(u.idPoliclinico) : null); // TENS/TONS solo ve su sede; un usuario sin sede asignada ve todas
  const citasVisibles = async (u, ctx, soloActivas = false) => {
    const sede = sedeDe(u);
    return (await citaRepo.listar()).filter(
      (x) =>
        (!soloActivas || x.estadoReserva === "ACTIVA") &&
        (!sede || detalleCita(x, ctx).pol?.id === sede),
    );
  };
  const aud = (u, accion, detalle) => auditoria.registrar(u, accion, detalle);

  const verAgenda = async ({ usuario, consulta }) => {
    const ctx = await cargarContexto(catalogo);
    const sede =
      sedeDe(usuario) ||
      (ctx.sedes.has(Number(consulta.get("sede")))
        ? Number(consulta.get("sede"))
        : ctx.listaSedes[0]?.id);
    const bloquesSede = [...ctx.bloques.values()].filter(
      (b) => ctx.profs.get(b.idProfesional)?.idPoliclinico === sede,
    );
    const fechas = [...new Set(bloquesSede.map((b) => b.fecha))].sort();
    const pedida = /^\d{4}-\d{2}-\d{2}$/.test(consulta.get("fecha") || "")
      ? consulta.get("fecha")
      : "";
    const fecha =
      pedida ||
      fechas.find((f) => f >= hoy()) ||
      fechas[fechas.length - 1] ||
      hoy();
    return {
      html: vistas.agenda({
        citas: await citasVisibles(usuario, ctx),
        ctx,
        usuario,
        sede,
        fecha,
        sedes: sedeDe(usuario)
          ? ctx.listaSedes.filter((p) => p.id === sede)
          : ctx.listaSedes,
      }),
    };
  };
  const verPanel = async ({ usuario }) => {
    const ctx = await cargarContexto(catalogo);
    const sede = sedeDe(usuario);
    const f0 = hoy();
    const enSede = (c) => !sede || detalleCita(c, ctx).pol?.id === sede;
    const clave = (c) => {
      const b = ctx.bloques.get(c.idBloque);
      return b ? `${b.fecha} ${b.hora}` : "";
    };
    const activas = (await citaRepo.listar())
      .filter(
        (c) => c.estadoReserva === "ACTIVA" && enSede(c) && clave(c) >= f0,
      )
      .sort((a, b) => clave(a).localeCompare(clave(b)));
    const pendientes = (await confirmacion.pendientes()).filter(enSede);
    const libres = (
      await agendamiento.bloquesDisponibles({ idPoliclinico: sede || "" })
    ).filter((b) => b.fecha >= f0);
    const espera_ = (await espera.vigentes()).filter(
      (e) => !sede || e.idPoliclinico === sede,
    );
    const avisos = extras
      .listar("notificaciones")
      .filter((n) => !n.leida && (!sede || n.idPoliclinico === sede));
    const porSede = sede
      ? []
      : ctx.listaSedes.map((s) => ({
          nombre: s.nombre,
          n: activas.filter(
            (c) => detalleCita(c, ctx).prof?.idPoliclinico === s.id,
          ).length,
        }));
    return {
      html: vistas.panel({
        usuario,
        ctx,
        activas,
        pendientes,
        libres: libres.length,
        espera: espera_.length,
        avisos: avisos.length,
        porSede,
        sede: sede ? ctx.sedes.get(sede) : null,
      }),
    };
  };
  const verPacientes = async (usuario, mensaje, valores) => ({
    html: vistas.pacientes({
      lista: (await catalogo.pacientes()).filter((p) =>
        c.operacion.meta.pacientes[p.rut]?.sedes?.includes(sedeDe(usuario)),
      ),
      comunas: await catalogo.comunas(),
      mensaje,
      usuario,
      valores,
    }),
  });
  const verEditar = async (usuario, rut, mensaje, valores) => {
    const p = await catalogo.paciente(normalizarRut(rut || ""));
    if (!p)
      return verPacientes(usuario, error(new Error("PACIENTE_NO_ENCONTRADO")));
    return {
      html: vistas.editarPaciente({
        p,
        comunas: await catalogo.comunas(),
        mensaje,
        usuario,
        valores,
      }),
    };
  };
  const verAgendar = async (usuario, filtro = {}, mensaje) => {
    const sede = sedeDe(usuario);
    let precarga = null;
    if (filtro.rut && (await c.operacion.acceso(usuario, filtro.rut)))
      precarga = await catalogo.paciente(normalizarRut(filtro.rut));
    const f = { ...filtro, idPoliclinico: sede || filtro.idPoliclinico || "" };
    const ctx = await cargarContexto(catalogo);
    const policlinicos = sede
      ? ctx.listaSedes.filter((p) => p.id === sede)
      : ctx.listaSedes;
    return {
      html: vistas.agendar({
        policlinicos,
        disponibles: await agendamiento.bloquesDisponibles(f),
        ctx,
        filtro: f,
        mensaje,
        usuario,
        precarga,
      }),
    };
  };
  const verConfirmaciones = async (usuario, mensaje) => {
    const ctx = await cargarContexto(catalogo);
    const sede = sedeDe(usuario);
    const pendientes = (await confirmacion.pendientes()).filter(
      (x) => !sede || detalleCita(x, ctx).pol?.id === sede,
    );
    return {
      html: vistas.confirmaciones({
        pendientes,
        ctx,
        contactos: (await catalogo.contactos()).filter((x) =>
          pendientes.some((y) => y.id === x.idCita),
        ),
        mensaje,
        usuario,
      }),
    };
  };
  const verEspera = async (usuario, mensaje) => {
    const ctx = await cargarContexto(catalogo);
    const sede = sedeDe(usuario);
    const vigentes = (await espera.vigentes()).filter(
      (e) => !sede || e.idPoliclinico === sede,
    );
    return {
      html: vistas.espera({
        vigentes,
        policlinicos: sede
          ? ctx.listaSedes.filter((p) => p.id === sede)
          : ctx.listaSedes,
        especialidades:
          require("../models/sedesInfo").infoSede(sede)?.especialidades ||
          (await catalogo.especialidades()),
        ctx,
        mensaje,
        usuario,
      }),
    };
  };
  const verRecepcion = async (usuario, mensaje) => {
    const ctx = await cargarContexto(catalogo);
    return {
      html: vistas.recepcion({
        citas: await citasVisibles(usuario, ctx, true),
        ctx,
        mensaje,
        usuario,
      }),
    };
  };
  const verDocumentos = async (usuario, mensaje, valores = {}) => {
    const lista = [];
    for (const d of documentos.listar())
      if (
        (!d.idPoliclinico || d.idPoliclinico === sedeDe(usuario)) &&
        (await c.operacion.acceso(usuario, d.rut))
      )
        lista.push(d);
    return {
      html: vistas.documentos({
        lista,
        tipos: documentos.tipos(),
        mensaje,
        usuario,
        valores,
      }),
    };
  };
  const verBot = async (usuario, mensaje, ahora = textoLocal()) => {
    const ctx = await cargarContexto(catalogo);
    return {
      html: vistas.bot({
        ahora,
        mensajes: extras.listar("mensajes"),
        bandeja: extras.listar("bandeja"),
        citas: await citasVisibles(usuario, ctx, true),
        ctx,
        mensaje,
        usuario,
      }),
    };
  };
  const verAvisos = async (usuario, mensaje) => {
    const sede = sedeDe(usuario);
    const lista = [...extras.listar("notificaciones")]
      .reverse()
      .filter((n) => !sede || n.idPoliclinico === sede);
    return { html: vistas.avisos({ lista, mensaje, usuario }) };
  };
  // Guardia: un TENS/TONS no opera sobre citas de otra sede.
  const citaDeMiSede = async (usuario, idCita) => {
    const cita = await citaRepo.buscarPorId(idCita);
    if (!cita) throw new Error("CITA_NO_ENCONTRADA");
    const sede = sedeDe(usuario);
    if (
      sede &&
      detalleCita(cita, await cargarContexto(catalogo)).pol?.id !== sede
    )
      throw new Error("FUERA_DE_SEDE");
    return cita;
  };

  return {
    panel: verPanel,
    agenda: verAgenda,
    pacientes: ({ usuario }) => verPacientes(usuario),
    crearPaciente: async ({ cuerpo, usuario }) => {
      try {
        const rut = await pacientes.crear({
          ...cuerpo,
          tieneWhatsapp: cuerpo.tieneWhatsapp === "1",
          consentimiento: cuerpo.consentimiento === "1",
          idUsuario: usuario.id,
        });
        c.operacion.asociarPaciente(usuario, rut);
        c.operacion.registrarConsentimiento(rut, { canal: "Presencial / asistido", comunicaciones: cuerpo.consentimientoComunicaciones === "1", usuario });
        await aud(usuario, "Ficha de paciente creada", rut);
        return verPacientes(usuario, ok(`Ficha creada: ${rut}.`));
      } catch (e) {
        return verPacientes(usuario, error(e), cuerpo);
      }
    },
    editarPaciente: ({ consulta, usuario }) =>
      verEditar(usuario, consulta.get("rut")),
    guardarPaciente: async ({ cuerpo, usuario }) => {
      try {
        const antes = await catalogo.paciente(normalizarRut(cuerpo.rut));
        const rut = await pacientes.actualizar(cuerpo.rut, {
          ...cuerpo,
          tieneWhatsapp: cuerpo.tieneWhatsapp === "1",
        });
        c.operacion.aud(
          usuario,
          "Ficha de paciente actualizada",
          "Pacientes",
          rut,
          antes,
          await catalogo.paciente(rut),
        );
        return verPacientes(usuario, ok(`Ficha actualizada: ${rut}.`));
      } catch (e) {
        return verEditar(usuario, cuerpo.rut, error(e), cuerpo);
      }
    },
    agendar: ({ consulta, usuario }) =>
      verAgendar(usuario, {
        idPoliclinico: consulta.get("idPoliclinico") || "",
        fecha: consulta.get("fecha") || "",
        rut: consulta.get("rut") || "",
        idBloque: consulta.get("idBloque") || "",
      }),
    registrarCita: async ({ cuerpo, usuario }) => {
      try {
        const sede = sedeDe(usuario);
        if (sede) {
          const ctx = await cargarContexto(catalogo);
          const b = ctx.bloques.get(Number(cuerpo.idBloque));
          if (
            !b ||
            c.operacion.sedeBloque(b, ctx.profs.get(b.idProfesional)) !== sede
          )
            throw new Error("FUERA_DE_SEDE");
        }
        const cita = await agendamiento.agendar({
          rut: normalizarRut(cuerpo.rut),
          idBloque: cuerpo.idBloque,
          idUsuario: usuario.id,
        });
        c.operacion.asociarPaciente(usuario, cita.rut);
        await aud(usuario, "Cita agendada", `cita ${cita.id}`);
        return verAgendar(
          usuario,
          {},
          ok("Cita registrada. Queda con confirmación pendiente."),
        );
      } catch (e) {
        return verAgendar(usuario, {}, error(e));
      }
    },
    confirmaciones: ({ usuario }) => verConfirmaciones(usuario),
    registrarContacto: async ({ cuerpo, usuario }) => {
      try {
        await citaDeMiSede(usuario, cuerpo.idCita);
        await confirmacion.registrarContacto({
          idCita: cuerpo.idCita,
          canal: "Llamada",
          resultado: cuerpo.resultado,
          responsable: usuario.nombre,
          idUsuario: usuario.id,
        });
        await aud(
          usuario,
          "Contacto registrado",
          `cita ${cuerpo.idCita}: ${cuerpo.resultado}`,
        );
        return verConfirmaciones(usuario, ok("Contacto registrado."));
      } catch (e) {
        return verConfirmaciones(usuario, error(e));
      }
    },
    espera: ({ usuario }) => verEspera(usuario),
    registrarEspera: async ({ cuerpo, usuario }) => {
      try {
        const sede = sedeDe(usuario);
        if (sede && Number(cuerpo.idPoliclinico) !== sede)
          throw new Error("FUERA_DE_SEDE");
        const nuevaEspera = await espera.registrar({
          rut: cuerpo.rut,
          idPoliclinico: cuerpo.idPoliclinico,
          especialidad: cuerpo.especialidad,
          idUsuario: usuario.id,
        });
        c.operacion.meta.espera[nuevaEspera.id] = {
          prioridad: ["Alta", "Media", "Normal"].includes(cuerpo.prioridad)
            ? cuerpo.prioridad
            : "Normal",
          preferencia: String(cuerpo.preferencia || "").slice(0, 100),
        };
        await aud(
          usuario,
          "Solicitud de espera registrada",
          normalizarRut(cuerpo.rut),
        );
        return verEspera(
          usuario,
          ok("Solicitud registrada en la lista de espera."),
        );
      } catch (e) {
        return verEspera(usuario, error(e));
      }
    },
    asignarEspera: async ({ cuerpo, usuario }) => {
      try {
        const cita = await espera.asignar({
          idSolicitud: cuerpo.idSolicitud,
          idBloque: cuerpo.idBloque,
          idUsuario: usuario.id,
        });
        (c.operacion.meta.espera[cuerpo.idSolicitud] ||= {}).estadoOperativo =
          "Reservado";
        await aud(
          usuario,
          "Cupo asignado desde lista de espera",
          `cita ${cita.id}`,
        );
        return verEspera(
          usuario,
          ok("Cupo asignado. La cita queda con confirmación pendiente."),
        );
      } catch (e) {
        return verEspera(usuario, error(e));
      }
    },
    retirarEspera: async ({ cuerpo, usuario }) => {
      try {
        if (
          !cuerpo.motivo?.trim() ||
          /no responde|sin respuesta|no contest/i.test(cuerpo.motivo)
        )
          throw new Error("MOTIVO_REQUERIDO");
        await espera.retirar(cuerpo.idSolicitud);
        await aud(usuario, "Solicitud de espera retirada", cuerpo.idSolicitud);
        return verEspera(usuario, ok("Solicitud retirada."));
      } catch (e) {
        return verEspera(usuario, error(e));
      }
    },
    recepcion: ({ usuario }) => verRecepcion(usuario),
    registrarAsistencia: async ({ cuerpo, usuario }) => {
      try {
        await citaDeMiSede(usuario, cuerpo.idCita);
        // Misma regla que en Agenda: cerrar la atención como realizada exige el permiso del usuario.
        if (cuerpo.asistio === "1" && usuario.puedeTerminarAtencion === false)
          throw new Error("No tienes permiso para terminar la atención.");
        await agendamiento.registrarAsistencia(
          cuerpo.idCita,
          cuerpo.asistio === "1",
        );
        await aud(usuario, "Asistencia registrada", `cita ${cuerpo.idCita}`);
        return verRecepcion(usuario, ok("Asistencia registrada."));
      } catch (e) {
        return verRecepcion(usuario, error(e));
      }
    },
    cancelarAsistida: async ({ cuerpo, usuario }) => {
      try {
        await citaDeMiSede(usuario, cuerpo.idCita);
        if (!cuerpo.motivo?.trim() || !cuerpo.canal)
          throw new Error("MOTIVO_REQUERIDO");
        await agendamiento.cancelar(cuerpo.idCita, "ASISTIDA");
        await aud(
          usuario,
          "Cita cancelada (asistida)",
          `cita ${cuerpo.idCita}`,
        );
        return verRecepcion(
          usuario,
          ok("Cita cancelada. El cupo quedó libre."),
        );
      } catch (e) {
        return verRecepcion(usuario, error(e));
      }
    },
    documentos: ({ usuario, consulta }) =>
      verDocumentos(usuario, null, {
        rut: consulta.get("rut") || "",
        reemplazar: consulta.get("reemplazar") || "",
      }),
    registrarDocumento: async ({ cuerpo, usuario }) => {
      try {
        await documentos.registrar({ ...cuerpo, usuario });
        await aud(usuario, "Documento registrado", normalizarRut(cuerpo.rut));
        return verDocumentos(usuario, ok("Documento registrado."));
      } catch (e) {
        return verDocumentos(usuario, error(e));
      }
    },
    descargarDocumento: async ({ consulta, usuario }) => {
      try {
        const archivo = documentos.archivo(consulta.get("id"));
        archivo.inline = consulta.get("ver") === "1";
        await aud(usuario, "Documento descargado", consulta.get("id"));
        return { archivo };
      } catch (e) {
        return verDocumentos(usuario, error(e));
      }
    },
    verificarDocumento: async ({ cuerpo, usuario }) => {
      try {
        await documentos.verificar(cuerpo.id, usuario);
        await aud(usuario, "Documento verificado", cuerpo.id);
        return verDocumentos(usuario, ok("Documento verificado."));
      } catch (e) {
        return verDocumentos(usuario, error(e));
      }
    },
    bot: ({ usuario }) => verBot(usuario),
    ejecutarBot: async ({ cuerpo, usuario }) => {
      try {
        const ahora = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(
          (cuerpo.ahora || "").trim(),
        )
          ? cuerpo.ahora.trim()
          : textoLocal();
        const r = await bot.procesar(ahora);
        return verBot(
          usuario,
          ok(
            `Bot ejecutado (${ahora}): ${r.enviados} mensaje(s) enviado(s), ${r.omitidos} omitido(s), ${r.errores} con error.`,
          ),
          ahora,
        );
      } catch (e) {
        return verBot(usuario, error(e));
      }
    },
    responderBot: async ({ cuerpo, usuario }) => {
      try {
        await citaDeMiSede(usuario, cuerpo.idCita);
        const r = await bot.responder({
          idCita: cuerpo.idCita,
          boton: cuerpo.boton,
        });
        await aud(
          usuario,
          "Respuesta simulada del paciente",
          `cita ${cuerpo.idCita}: ${cuerpo.boton}`,
        );
        return verBot(usuario, ok(`Respuesta del bot: ${r}`));
      } catch (e) {
        return verBot(usuario, error(e));
      }
    },
    avisos: ({ usuario }) => verAvisos(usuario),
    leerAviso: async ({ cuerpo, usuario }) => {
      try {
        extras.actualizar("notificaciones", cuerpo.id, { leida: true });
      } catch (e) {
        return verAvisos(usuario, error(e));
      }
      return verAvisos(usuario);
    },
  };
}
module.exports = { crearTensController };

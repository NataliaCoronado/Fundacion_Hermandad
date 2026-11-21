"use strict";
const vistas = require("../views/cuentaDelPaciente");
const { habilitado: mensajesSimulados } = require("./mensajesDelPaciente");
const { normalizarRut, rutValido } = require("../herramientas/rut");
const { textoLocal } = require("../herramientas/tiempo");
const { error } = require("./mensajesDeError");
const { crearLimitador } = require("../herramientas/limitador");
const { cargarContexto, detalleCita } = require("./cargarListasBase");

const LIMITE_IP = 10;
const LIMITE_RUT = 8;
const VENTANA_MS = 60_000;
const TIPOS = ["Cartola FONASA", "Credencial CESFAM", "Orden médica / derivación", "Certificado", "Otro"];
const REQUISITOS = ["Cartola FONASA", "Credencial CESFAM"];

function crearControladorCuentaDelPaciente(c, reserva) {
  const { catalogo, citaRepo, cuentas, sesionesPaciente, documentos, pacientes, operacion: servicioOperacion } = c;
  const excedido = crearLimitador(VENTANA_MS);
  const portal = (cuenta, idPoliclinico = null) => ({ id: null, nombre: `Paciente (portal) ${cuenta.rut}`, idPoliclinico });
  const conCuenta = (fn) => async (a) => (a.paciente ? fn(a) : { redirigir: "/paciente/cuenta" });
  const abrirSesion = (p) => ({ redirigir: "/paciente/mis-horas", cookiePaciente: sesionesPaciente.crear({ id: p.rut, rut: p.rut, nombre: p.nombre }) });

  async function lugarDe(rut) {
    const metaPaciente = servicioOperacion.meta.pacientes[rut];
    if (metaPaciente?.lugarHabitual) return metaPaciente.lugarHabitual;
    const ctx = await cargarContexto(catalogo);
    const ult = (await citaRepo.buscarPorRut(rut)).map((x) => detalleCita(x, ctx)).filter((d) => d.b).sort((a, b) => b.b.fecha.localeCompare(a.b.fecha))[0];
    return ult ? servicioOperacion.sedeBloque(ult.b, ult.prof) : null;
  }
  async function horasDe(rut) {
    const ctx = await cargarContexto(catalogo);
    const ahora = textoLocal();
    const lista = (await citaRepo.buscarPorRut(rut))
      .map((x) => {
        const detalle = detalleCita(x, ctx);
        if (!detalle.b) return null;
        const sede = ctx.sedes.get(servicioOperacion.sedeBloque(detalle.b, detalle.prof));
        const estado = x.estadoReserva === "CANCELADA" ? "Cancelada" : x.asistencia === "ASISTIO" ? "Atendida" : x.asistencia === "NO_ASISTIO" ? "No asistió" : x.estadoConfirmacion === "CONFIRMADA" ? "Reservada · asistencia confirmada" : "Reservada · por confirmar";
        return {
          id: x.id, fecha: detalle.b.fecha, hora: detalle.b.hora, especialidad: detalle.b.especialidad || detalle.prof?.especialidad, profesional: (detalle.reemplazo || detalle.prof)?.nombre,
          lugar: sede?.telemedicina ? "Telemedicina" : sede?.nombre, estado, activa: x.estadoReserva === "ACTIVA" && !x.asistencia, futura: `${detalle.b.fecha} ${detalle.b.hora}` >= ahora,
        };
      })
      .filter(Boolean)
      .sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
    return { proximas: lista.filter((h) => h.activa && h.futura), historial: lista.filter((h) => !(h.activa && h.futura)).reverse() };
  }
  const docsDe = (rut) => documentos.listar().filter((d) => d.rut === rut && !d.archivado);

  const ctl = {
    acceso: ({ paciente }) => (paciente ? { redirigir: "/paciente/mis-horas" } : { html: vistas.acceso({ modo: "ingresar" }) }),
    crear: () => ({ html: vistas.acceso({ modo: "crear" }) }),
    recuperar: () => ({ html: vistas.acceso({ modo: "recuperar" }) }),
    enviar: async ({ cuerpo: d, ip }) => {
      const modo = ["crear", "recuperar"].includes(d.modo) ? d.modo : "ingresar";
      const fallo = (texto, estado = 400) => ({ estado, html: vistas.acceso({ modo, d: { rut: d.rut, fechaNacimiento: d.fechaNacimiento }, mensaje: { tipo: "error", texto } }) });
      const rut = normalizarRut(d.rut || "");
      if (excedido(ip, LIMITE_IP) | excedido(`rut:${rut}`, LIMITE_RUT)) return fallo("Demasiados intentos. Espera un minuto.", 429);
      if (!rutValido(rut)) return fallo("Revisa el RUT: escribe los números y el dígito verificador, sin puntos.");
      try {
        if (modo === "ingresar") {
          const p = await cuentas.ingresar({ rut, clave: d.clave });
          if (!p) return fallo("RUT o contraseña incorrectos.", 401);
          return abrirSesion(p);
        }
        if (modo === "crear") {
          const p = await cuentas.crear({ ...d, rut });
          servicioOperacion.aud(portal({ rut }), "Cuenta de paciente creada", "Portal", rut, null, { rut });
          return abrirSesion(p);
        }
        const p = await cuentas.restablecer({ ...d, rut });
        sesionesPaciente.revocarUsuario(rut);
        servicioOperacion.aud(portal({ rut }), "Contraseña de paciente restablecida", "Portal", rut, null, { rut });
        return abrirSesion(p);
      } catch (e) {
        return fallo(error(e).texto);
      }
    },
    salir: ({ tokenPaciente }) => {
      if (tokenPaciente) sesionesPaciente.cerrar(tokenPaciente);
      return { redirigir: "/", cookiePaciente: "" };
    },

    misHoras: conCuenta(async ({ paciente }) => ({ html: vistas.misHoras({ cuenta: paciente, mensajesSimulados: mensajesSimulados(c), ...(await horasDe(paciente.rut)) }) })),
    misDatos: conCuenta(async ({ paciente }) => ({ html: vistas.misDatos({ cuenta: paciente, ficha: await catalogo.paciente(paciente.rut), comunas: await catalogo.comunas() }) })),
    guardarDatos: conCuenta(async ({ paciente, cuerpo: d }) => {
      const ficha = await catalogo.paciente(paciente.rut);
      const datos = { ...d, tieneWhatsapp: d.tieneWhatsapp === "1", nombres: ficha.nombres, apellidos: ficha.apellidos, fechaNacimiento: ficha.fechaNacimiento };
      try {
        await pacientes.actualizar(paciente.rut, datos);
        servicioOperacion.aud(portal(paciente), "Datos actualizados desde el portal", "Pacientes", paciente.rut, ficha, await catalogo.paciente(paciente.rut), await lugarDe(paciente.rut));
        return { html: vistas.misDatos({ cuenta: paciente, ficha: await catalogo.paciente(paciente.rut), comunas: await catalogo.comunas(), mensaje: { tipo: "ok", texto: "Datos guardados." } }) };
      } catch (e) {
        return { estado: 400, html: vistas.misDatos({ cuenta: paciente, ficha, v: d, comunas: await catalogo.comunas(), mensaje: error(e) }) };
      }
    }),
    misDocumentos: conCuenta(async ({ paciente, mensaje }) => {
      const fams = await cuentas.familiares(paciente.rut);
      const personas = [{ id: paciente.rut, nombre: `${paciente.nombre} (yo)` }, ...fams.map((f) => ({ id: f.rut, nombre: f.nombre }))];
      const docs = personas.flatMap((p) => docsDe(p.id).map((d) => ({ ...d, persona: p.nombre })));
      const propios = docsDe(paciente.rut);
      return { estado: mensaje?.tipo === "error" ? 400 : 200, html: vistas.misDocumentos({ cuenta: paciente, personas, docs, tipos: TIPOS, pendientes: REQUISITOS.filter((r) => !propios.some((d) => d.tipo === r)), mensaje }) };
    }),
    subirDocumento: conCuenta(async (a) => {
      const { paciente, cuerpo: d } = a;
      const rut = normalizarRut(d.rut || paciente.rut);
      let mensaje;
      try {
        await cuentas.exigir(paciente.rut, rut);
        if (!TIPOS.includes(d.tipo)) throw new Error("Elige el tipo de documento.");
        if (!d.archivo || typeof d.archivo === "string") throw new Error("Selecciona un archivo.");
        const anterior = d.reemplazar ? documentos.listar().find((x) => x.id === Number(d.reemplazar) && !x.archivado) : null;
        if (d.reemplazar && (!anterior || anterior.rut !== rut)) throw new Error("El documento a reemplazar no corresponde a ese paciente.");
        const doc = await documentos.registrar({
          rut, tipo: d.tipo, archivo: d.archivo, reemplazar: anterior?.id,
          usuario: portal(paciente, anterior ? anterior.idPoliclinico : await lugarDe(rut)),
          observacion: anterior ? "Reemplazado por el paciente en el portal" : "Adjuntado por el paciente en el portal",
        });
        servicioOperacion.aud(portal(paciente), "Documento adjuntado desde el portal", "Documentos", doc.id, null, { rut, tipo: d.tipo }, doc.idPoliclinico || null);
        mensaje = { tipo: "ok", texto: d.reemplazar ? "Documento reemplazado. El anterior quedó archivado y el nuevo, pendiente de revisión." : "Documento adjuntado. Queda pendiente de revisión por el personal." };
      } catch (e) {
        mensaje = e.message === "FUERA_DE_SEDE" ? { tipo: "error", texto: "Solo puedes adjuntar documentos tuyos o de familiares vinculados." } : error(e);
      }
      return ctl.misDocumentos({ ...a, mensaje });
    }),
    archivoDocumento: conCuenta(async ({ paciente, consulta }) => {
      const documento = documentos.listar().find((x) => x.id === Number(consulta.get("id")));
      if (!documento) throw new Error("DOCUMENTO_NO_ENCONTRADO");
      await cuentas.exigir(paciente.rut, documento.rut);
      return { archivo: documentos.archivo(documento.id) };
    }),

    familiares: conCuenta(async ({ paciente, mensaje }) => {
      const lista = [];
      for (const f of await cuentas.familiares(paciente.rut))
        lista.push({ ...f, relacion: f.responsable?.relacion ? `Tú eres: ${f.responsable.relacion}` : "", proximas: (await horasDe(f.rut)).proximas, docs: docsDe(f.rut) });
      return { estado: mensaje?.tipo === "error" ? 400 : 200, html: vistas.familiares({ cuenta: paciente, lista, mensaje }) };
    }),
    solicitarFamiliar: conCuenta(async (a) => {
      const { paciente, cuerpo: d } = a;
      const rut = normalizarRut(d.rutFamiliar || "");
      let mensaje;
      if (!rutValido(rut) || !String(d.relacion || "").trim()) mensaje = { tipo: "error", texto: "Escribe un RUT válido (con guion) y tu relación con el familiar, por ejemplo hijo/a o madre." };
      else {
        cuentas.solicitar({ rut: paciente.rut, tipo: "Vinculación de familiar", detalle: `Familiar ${rut} (${String(d.relacion).trim().slice(0, 30)}). ${d.detalle || ""}`, idPoliclinico: await lugarDe(paciente.rut) });
        mensaje = { tipo: "ok", texto: "Solicitud enviada. El personal revisará la autorización antes de vincular al familiar." };
      }
      return ctl.familiares({ ...a, mensaje });
    }),

    comprobante: conCuenta(async ({ paciente, consulta }) => {
      const cita = await citaRepo.buscarPorId(consulta.get("idCita"));
      if (!cita || cita.estadoReserva !== "ACTIVA") throw new Error("CITA_NO_ENCONTRADA");
      await cuentas.exigir(paciente.rut, cita.rut);
      return { binario: await reserva.pdfDeCita(cita.id, true), mime: "application/pdf", nombreArchivo: "comprobante-reserva.pdf" };
    }),
  };
  return ctl;
}
module.exports = { crearControladorCuentaDelPaciente };

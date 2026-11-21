"use strict";
const crypto = require("node:crypto");
const vistas = require("../views/reserva");
const { fechaLarga } = require("../views/paciente");
const { normalizarRut, rutValido } = require("../herramientas/rut");
const { hoy, textoLocal } = require("../herramientas/tiempo");
const { error, ok } = require("./mensajesDeError");
const { crearLimitador } = require("../herramientas/limitador");
const { comprobantePdf } = require("../services/ComprobanteServicio");
const { MAX_BYTES } = require("../services/DocumentoServicio");

const TTL_MS = 20 * 60_000;
const LIMITE = 10;
const VENTANA_MS = 60_000;
const TIPOS_PORTAL = ["Cartola FONASA", "Credencial CESFAM", "Orden médica / derivación", "Certificado", "Otro"];
const REQUISITOS = ["Cartola FONASA", "Credencial CESFAM"];
const maxBytesFlujos = () => Number(process.env.MAX_MB_ADJUNTOS_EN_ESPERA || 150) * 1024 * 1024;
const FIRMAS = [Buffer.from("%PDF"), Buffer.from([0xff, 0xd8, 0xff]), Buffer.from([0x89, 0x50, 0x4e, 0x47])];

function crearControladorReserva(aplicacion) {
  const { catalogo, agendamiento, pacientes, documentos, operacion: servicioOperacion, cuentas, encuestas } = aplicacion;
  const flujos = new Map();
  const limitar = crearLimitador(VENTANA_MS);
  const excedido = (ip) => limitar(ip, LIMITE);
  const activo = () => process.env.RESERVA_WEB !== "0";
  const apagado = (usuario) => ({ estado: 503, html: vistas.apagado({ usuario }) });
  const sesion = (t) => {
    const ahora = Date.now();
    for (const [k, v] of flujos) if (v.vence < ahora) flujos.delete(k);
    const flujo = t && flujos.get(t);
    if (flujo) flujo.vence = ahora + TTL_MS;
    return flujo || null;
  };
  const guard = (fn) => async (a) => {
    if (!activo()) return apagado(a.usuario);
    const token = a.consulta.get("t") || a.cuerpo.t;
    const flujo = sesion(token);
    if (!flujo) return { redirigir: "/agendar" };
    return fn({ ...a, t: token, f: flujo });
  };

  const espsDe = (p) => (p.especialidades?.length ? p.especialidades : [p.especialidad]);
  async function oferta() {
    const sedes = (await catalogo.policlinicos()).filter((s) => s.activo !== false);
    const ids = new Set(sedes.map((s) => s.id));
    const profs = (await catalogo.profesionales())
      .filter((p) => p.activo)
      .map((p) => ({ ...p, lugares: servicioOperacion.lugares(p).filter((id) => ids.has(id)), esps: espsDe(p).filter((e) => catalogo.especialidadActiva?.(e) !== false) }))
      .filter((p) => p.lugares.length && p.esps.length)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
    const espsPorLugar = {};
    for (const p of profs) for (const l of p.lugares) espsPorLugar[l] = [...new Set([...(espsPorLugar[l] || []), ...p.esps])];
    return { sedes, profs, espsPorLugar };
  }
  async function libres(f) {
    let bloquesDisponibles = await agendamiento.bloquesDisponibles({
      idPoliclinico: f.lugar === "red" ? undefined : f.lugar,
      especialidad: f.modo === "esp" ? f.esp : undefined,
    });
    if (f.modo === "prof") bloquesDisponibles = bloquesDisponibles.filter((b) => b.idProfesional === f.prof);
    const ahora = textoLocal();
    return bloquesDisponibles.filter((b) => `${b.fecha} ${b.hora}` > ahora);
  }
  const ctxBloque = async (idBloque) => {
    const bloque = await catalogo.bloque(idBloque);
    const prof = bloque && (await catalogo.profesional(bloque.idProfesional));
    const sede = prof && (await catalogo.policlinico(servicioOperacion.sedeBloque(bloque, prof)));
    return bloque && prof && sede ? { b: bloque, prof, sede, esp: bloque.especialidad || prof.especialidad } : null;
  };
  const resumenBusqueda = async (f) => {
    const lugar = f.lugar === "red" ? "Toda la red" : (await catalogo.policlinico(f.lugar))?.nombre;
    const que = f.modo === "esp" ? f.esp : (await catalogo.profesional(f.prof))?.nombre;
    return `${que} · ${lugar}`;
  };
  async function datosCuenta(paciente) {
    if (!paciente) return null;
    return { ...paciente, familiares: await cuentas.familiares(paciente.rut) };
  }
  async function docsDe(rut) {
    return documentos.listar().filter((d) => d.rut === rut && !d.archivado);
  }
  const pendientesDe = (docs) => REQUISITOS.filter((r) => !docs.some((d) => d.tipo === r));

  async function vistaDatos({ t, f, usuario, mensaje, v }) {
    const ficha = await catalogo.paciente(f.rut);
    const contextoBloque = await ctxBloque(f.idBloque);
    const cita = `${contextoBloque.esp} · ${contextoBloque.prof.nombre} · ${fechaLarga(contextoBloque.b.fecha)}, ${contextoBloque.b.hora} · ${contextoBloque.sede.nombre}`;
    const modo = !ficha ? "nuevo" : f.verificado ? "existente" : "existente-sin-sesion";
    const docs = ficha && f.verificado ? await docsDe(f.rut) : [];
    return {
      estado: mensaje ? 400 : 200,
      html: vistas.datos({
        t, modo, ficha, v: v || f.entrada || {}, comunas: await catalogo.comunas(), tipos: TIPOS_PORTAL,
        registrados: docs, pendientes: !ficha || f.verificado ? pendientesDe(docs) : [], rut: f.rut, cita, mensaje, usuario,
      }),
    };
  }
  async function resumen(f) {
    const ficha = await catalogo.paciente(f.rut);
    const contextoBloque = await ctxBloque(f.idBloque);
    const identificado = !ficha || f.verificado;
    const nombre = ficha ? ficha.nombre : `${f.nuevo.nombres} ${f.nuevo.apellidos}`.trim();
    const contacto = ficha && !f.actualizar ? ficha : { ...(f.nuevo || {}), ...(f.actualizar || {}) };
    const canal = !f.comunicaciones || !identificado ? null : contacto.tieneWhatsapp && contacto.telefono ? "WhatsApp" : contacto.correo ? "Correo" : null;
    return {
      nombre, identificado, rut: f.rut, nuevo: !ficha, actualiza: !!f.actualizar, lugar: contextoBloque.sede.nombre, tele: !!contextoBloque.sede.telemedicina, idSede: contextoBloque.sede.id,
      esp: contextoBloque.esp, prof: contextoBloque.prof.nombre, fecha: contextoBloque.b.fecha, hora: contextoBloque.b.hora, docs: f.docs.map((d) => ({ tipo: d.tipo, nombre: d.archivo.nombre })), cambio: f.cambioDatos || "", canal,
    };
  }

  return {
    inicio: async ({ usuario, paciente, consulta }) => {
      if (!activo()) return apagado(usuario);
      const flujo = sesion(consulta.get("t"));
      const d = flujo ? { rut: flujo.rut, quien: flujo.quien, lugar: flujo.lugar, modo: flujo.modo, esp: flujo.esp, prof: flujo.prof, consentimiento: true, comunicaciones: flujo.comunicaciones } : { quien: consulta.get("quien") || undefined, lugar: consulta.get("lugar") || undefined };
      return { html: vistas.inicio({ oferta: await oferta(), d, usuario, cuenta: await datosCuenta(paciente) }) };
    },
    iniciar: async ({ cuerpo: d, ip, usuario, paciente }) => {
      if (!activo()) return apagado(usuario);
      const cuenta = await datosCuenta(paciente);
      const of = await oferta();
      const fallo = (texto, estado = 400) => ({ estado, html: vistas.inicio({ oferta: of, d, usuario, cuenta, mensaje: { tipo: "error", texto } }) });
      if (excedido(ip)) return fallo("Demasiados intentos. Espera un minuto.", 429);
      const rut = normalizarRut(cuenta && d.quien && d.quien !== "otra" ? d.quien : d.rut);
      if (!rutValido(rut)) return fallo("Revisa el RUT: escribe los números y el dígito verificador, sin puntos.");
      if (d.consentimiento !== "1") return fallo("Debes aceptar el tratamiento de los datos para continuar.");
      const lugar = d.lugar === "red" ? "red" : Number(d.lugar);
      if (lugar !== "red" && !of.sedes.some((s) => s.id === lugar)) return fallo("Elige un lugar de atención.");
      const modo = d.modo === "prof" ? "prof" : "esp";
      let esp = null, prof = null;
      if (modo === "esp") {
        esp = d.esp;
        const disponibles = lugar === "red" ? Object.values(of.espsPorLugar).flat() : of.espsPorLugar[lugar] || [];
        if (!esp || !disponibles.includes(esp)) return fallo("Elige una especialidad disponible en el lugar seleccionado.");
      } else {
        prof = Number(d.prof);
        const p = of.profs.find((x) => x.id === prof);
        if (!p || (lugar !== "red" && !p.lugares.includes(lugar))) return fallo("Elige un profesional que atienda en el lugar seleccionado.");
      }
      const ficha = await catalogo.paciente(rut);
      if (ficha && ficha.activo === false) return fallo("Este RUT no puede reservar por internet. Comunícate con tu policlínico.");
      const verificado = !!(cuenta && (await cuentas.puedeVer(cuenta.rut, rut)));
      const token = crypto.randomBytes(18).toString("hex");
      flujos.set(token, { rut, quien: d.quien, lugar, modo, esp, prof, comunicaciones: d.comunicaciones === "1", verificado, docs: [], vence: Date.now() + TTL_MS });
      return { redirigir: `/agendar/calendario?t=${token}` };
    },

    calendario: guard(async ({ t, f, consulta, usuario }) => {
      const bloquesLibres = await libres(f);
      const dias = new Map();
      for (const b of bloquesLibres) dias.set(b.fecha, (dias.get(b.fecha) || 0) + 1);
      const fechas = [...dias.keys()].sort();
      const MES = /^\d{4}-\d{2}$/;
      const mesHoy = hoy().slice(0, 7);
      const ultimo = (fechas[fechas.length - 1] || hoy()).slice(0, 7);
      const pedidoDia = /^\d{4}-\d{2}-\d{2}$/.test(consulta.get("dia") || "") && dias.has(consulta.get("dia")) ? consulta.get("dia") : "";
      let mes = MES.test(consulta.get("mes") || "") ? consulta.get("mes") : (pedidoDia || fechas[0] || hoy()).slice(0, 7);
      if (mes < mesHoy) mes = mesHoy;
      if (mes > ultimo) mes = ultimo;
      const delMes = new Map([...dias].filter(([k]) => k.startsWith(mes)));
      const dia = pedidoDia && pedidoDia.startsWith(mes) ? pedidoDia : [...delMes.keys()].sort()[0] || "";
      const mover = (n) => {
        const [a, m] = mes.split("-").map(Number);
        const fecha = new Date(Date.UTC(a, m - 1 + n, 1));
        return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
      };
      const antes = mes > mesHoy ? mover(-1) : "";
      const despues = mes < ultimo ? mover(1) : "";
      const grupos = [];
      for (const b of bloquesLibres.filter((x) => x.fecha === dia).sort((x, y) => x.hora.localeCompare(y.hora))) {
        const contextoBloque = await ctxBloque(b.id);
        if (!contextoBloque) continue;
        let g = grupos.find((y) => y.prof.id === contextoBloque.prof.id && y.sede.id === contextoBloque.sede.id);
        if (!g) grupos.push((g = { prof: contextoBloque.prof, sede: contextoBloque.sede, esp: contextoBloque.esp, bloques: [] }));
        g.bloques.push(b);
      }
      return { html: vistas.calendario({ t, resumen: await resumenBusqueda(f), rut: f.rut, mes, antes, despues, dias: delMes, dia, grupos, usuario }) };
    }),

    datos: guard(async ({ t, f, consulta, usuario }) => {
      const pedido = Number(consulta.get("bloque"));
      if (pedido) {
        if (!(await libres(f)).some((b) => b.id === pedido)) return { redirigir: `/agendar/calendario?t=${t}` };
        f.idBloque = pedido;
      }
      if (!f.idBloque) return { redirigir: `/agendar/calendario?t=${t}` };
      return vistaDatos({ t, f, usuario });
    }),
    guardarDatos: guard(async ({ t, f, cuerpo: d, usuario }) => {
      if (!f.idBloque) return { redirigir: `/agendar/calendario?t=${t}` };
      const ficha = await catalogo.paciente(f.rut);
      const entrada = Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === "string"));
      try {
        const docs = [];
        for (const i of [1, 2, 3]) {
          const a = d[`doc${i}`];
          if (!a || typeof a === "string") continue;
          if (!TIPOS_PORTAL.includes(d[`tipo${i}`])) throw new Error(`Elige el tipo del documento ${i}.`);
          if (a.datos.length > MAX_BYTES) throw new Error(`El documento ${i} supera los 5 MB.`);
          if (!FIRMAS.some((s) => a.datos.subarray(0, s.length).equals(s))) throw new Error(`El documento ${i} no es un PDF, JPG o PNG válido. Sube otro archivo.`);
          docs.push({ tipo: d[`tipo${i}`], archivo: { nombre: a.nombre, datos: a.datos } });
        }
        const base = { ...entrada, tieneWhatsapp: d.tieneWhatsapp === "1" };
        if (!ficha) {
          pacientes.validar(base);
          f.nuevo = base;
          f.actualizar = null;
        } else if (f.verificado && "telefono" in entrada) {
          const datos = { ...base, nombres: ficha.nombres, apellidos: ficha.apellidos, fechaNacimiento: ficha.fechaNacimiento };
          pacientes.validar(datos);
          f.actualizar = datos;
        } else f.actualizar = null;
        f.cambioDatos = "";
        if (ficha && !f.verificado) {
          const val = (k, n) => String(entrada[k] || "").trim().slice(0, n);
          const tel = val("nTelefono", 20), correo = val("nCorreo", 120), dir = val("nDireccion", 150);
          const comuna = entrada.nIdComuna ? (await catalogo.comunas()).find((x) => String(x.id) === String(entrada.nIdComuna)) : null;
          if (tel && !/^\+?[\d\s-]{8,}$/.test(tel)) throw new Error("Revisa el celular: escribe solo números, por ejemplo +56912345678.");
          if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error("Revisa el correo electrónico.");
          if (entrada.nIdComuna && !comuna) throw new Error("Elige una comuna de la lista.");
          f.cambioDatos = [tel && `Celular: ${tel}`, correo && `Correo: ${correo}`, dir && `Dirección: ${dir}`, comuna && `Comuna: ${comuna.nombre}`].filter(Boolean).join(" · ");
        }
        if (docs.length) {
          const enEspera = [...flujos.values()].filter((x) => x !== f).reduce((n, x) => n + x.docs.reduce((m, y) => m + y.archivo.datos.length, 0), 0);
          const propios = [...f.docs, ...docs].slice(-3).reduce((m, y) => m + y.archivo.datos.length, 0);
          if (enEspera + propios > maxBytesFlujos())
            throw new Error("En este momento no podemos recibir más archivos. Continúa sin adjuntarlos y entrégalos en tu policlínico, o inténtalo más tarde.");
        }
        f.entrada = entrada;
        f.docs = [...f.docs, ...docs].slice(-3);
      } catch (e) {
        return vistaDatos({ t, f, usuario, v: entrada, mensaje: { ...error(e), texto: `${error(e).texto} Si habías elegido archivos, vuelve a seleccionarlos.` } });
      }
      return { redirigir: `/agendar/revisar?t=${t}` };
    }),

    revisar: guard(async ({ t, f, usuario }) => {
      if (!f.idBloque) return { redirigir: `/agendar/calendario?t=${t}` };
      if (!(await catalogo.paciente(f.rut)) && !f.nuevo) return { redirigir: `/agendar/datos?t=${t}` };
      return { html: vistas.revisar({ t, r: await resumen(f), usuario }) };
    }),
    confirmar: guard(async ({ t, f, usuario, paciente }) => {
      if (f.confirmada) return { html: vistas.confirmada({ t, r: f.confirmada.r, envio: f.confirmada.envio, verMensajes: paciente?.rut === f.rut ? f.confirmada.verMensajes : null, cuenta: !!paciente, usuario }) };
      if (!f.idBloque) return { redirigir: `/agendar/calendario?t=${t}` };
      const contextoBloque = await ctxBloque(f.idBloque);
      const portal = { id: null, nombre: "Paciente (portal web)", idPoliclinico: contextoBloque?.sede.id };
      try {
        if (!contextoBloque || !(await libres(f)).some((b) => b.id === f.idBloque)) throw new Error("BLOQUE_NO_DISPONIBLE");
        const ficha = await catalogo.paciente(f.rut);
        if (!ficha) {
          if (!f.nuevo) return { redirigir: `/agendar/datos?t=${t}` };
          await pacientes.crear({ ...f.nuevo, rut: f.rut, consentimiento: true });
          servicioOperacion.aud(portal, "Ficha creada desde el portal", "Pacientes", f.rut, null, { rut: f.rut }, contextoBloque.sede.id);
        } else if (f.actualizar) {
          await pacientes.actualizar(f.rut, f.actualizar);
          servicioOperacion.aud(portal, "Datos actualizados desde el portal", "Pacientes", f.rut, ficha, await catalogo.paciente(f.rut), contextoBloque.sede.id);
        }
        const identificado = !ficha || f.verificado;
        if (identificado) servicioOperacion.registrarConsentimiento(f.rut, { canal: "Portal web", comunicaciones: f.comunicaciones, usuario: portal });
        const cita = await agendamiento.agendar({ rut: f.rut, idBloque: f.idBloque, canal: "WEB" });
        servicioOperacion.asociarPaciente({ idPoliclinico: contextoBloque.sede.id }, f.rut);
        for (const doc of f.docs)
          await documentos.registrar({
            rut: f.rut, tipo: doc.tipo, archivo: doc.archivo, usuario: portal,
            observacion: identificado ? "Adjuntado por el paciente en el portal" : "Adjuntado en el portal sin iniciar sesión: confirmar la identidad al revisar",
          });
        if (f.cambioDatos)
          cuentas.solicitar({ rut: f.rut, tipo: "Actualización de datos (portal, sin iniciar sesión)", detalle: f.cambioDatos, idPoliclinico: contextoBloque.sede.id });
        servicioOperacion.aud(portal, "Reserva web registrada", "Reservas", cita.id, null, { rut: f.rut, idBloque: f.idBloque, documentos: f.docs.length }, contextoBloque.sede.id);
        f.verificado ||= !ficha;
        const r = await resumen({ ...f, actualizar: null, nuevo: null });
        let envio = "", verMensajes;
        if (r.canal) {
          let m = await servicioOperacion.comunicar(portal, cita, r.canal, "Comprobante de reserva");
          try { m = await aplicacion.despachador.enviar(m); } catch (e) { console.error(e); }
          if (m.estado === "Simulado") {
            const mensaje = aplicacion.extras.listar("bandeja").findLast((x) => x.idComunicacion === m.id && x.idCita === cita.id);
            if (mensaje) verMensajes = "/paciente/mensajes?" + new URLSearchParams({
              canal: r.canal.toLowerCase(), mensaje: r.canal === "Correo" ? "b-" + mensaje.id : "hermandad",
            });
          }
          envio = {
            Enviado: `Te enviamos el comprobante por ${r.canal}.`,
            Simulado: `El envío automático por ${r.canal} aún no está activo, por lo que no se envió ningún mensaje. Descarga el comprobante.`,
            Pendiente: `El envío del comprobante por ${r.canal} quedó registrado y se reintentará automáticamente. Mientras tanto, descarga el comprobante.`,
          }[m.estado] || `No fue posible enviar el comprobante por ${r.canal}. Descarga el comprobante.`;
        } else if (!f.comunicaciones) envio = "No autorizaste el envío por WhatsApp o correo: descarga o imprime el comprobante.";
        else if (!r.identificado) envio = "Por seguridad, el comprobante no se envía a los datos de contacto guardados si no has iniciado sesión. Descárgalo o imprímelo.";
        f.confirmada = { idCita: cita.id, r, envio, verMensajes };
        f.docs = [];
        return { html: vistas.confirmada({ t, r, envio, verMensajes: paciente?.rut === f.rut ? verMensajes : null, cuenta: !!paciente, usuario }) };
      } catch (e) {
        if (["BLOQUE_OCUPADO", "BLOQUE_NO_DISPONIBLE"].includes(e.message))
          return { estado: 409, html: vistas.revisar({ t, r: await resumen(f), usuario, mensaje: { tipo: "error", texto: "Esa hora ya no está disponible. Elige otra hora en el calendario." } }) };
        return { estado: 400, html: vistas.revisar({ t, r: await resumen(f), usuario, mensaje: error(e) }) };
      }
    }),
    encuestaAgendamiento: guard(async ({ t, f, usuario }) => {
      if (!f.confirmada) return { redirigir: "/agendar" };
      return { html: vistas.encuestaAgendamiento({ t, respondida: !!f.encuestaAgendamiento, usuario }) };
    }),
    responderEncuestaAgendamiento: guard(async ({ t, f, cuerpo: d, usuario }) => {
      if (!f.confirmada) return { redirigir: "/agendar" };
      try {
        await encuestas.registrarAgendamiento({ idCita: f.confirmada.idCita, nota: d.nota, comentario: d.comentario });
        f.encuestaAgendamiento = true;
        return { html: vistas.encuestaAgendamiento({ t, respondida: true, mensaje: ok("Gracias por responder."), usuario }) };
      } catch (e) {
        return { estado: 400, html: vistas.encuestaAgendamiento({ t, respondida: false, mensaje: error(e), usuario }) };
      }
    }),
    comprobante: guard(async ({ f }) => {
      if (!f.confirmada) return { redirigir: "/agendar" };
      try {
        return { binario: await pdfDeCita(f.confirmada.idCita), mime: "application/pdf", nombreArchivo: "comprobante-reserva.pdf" };
      } catch (e) {
        if (e.message !== "CITA_NO_ENCONTRADA") throw e;
        return { redirigir: "/paciente/consulta" };
      }
    }),
    pdfDeCita,
  };

  async function pdfDeCita(idCita) {
    const cita = await aplicacion.citaRepo.buscarPorId(idCita);
    const contextoBloque = cita && (await ctxBloque(cita.idBloque));
    const paciente = cita && (await catalogo.paciente(cita.rut));
    if (!cita || cita.estadoReserva === "CANCELADA" || !contextoBloque || !paciente) throw new Error("CITA_NO_ENCONTRADA");
    return comprobantePdf({
      paciente: { rut: paciente.rut, nombre: paciente.nombre },
      bloque: { ...contextoBloque.b, especialidad: contextoBloque.esp },
      profesional: cita.idProfesionalReemplazo ? await catalogo.profesional(cita.idProfesionalReemplazo) : contextoBloque.prof,
      sede: contextoBloque.sede,
      emitido: textoLocal(),
    });
  }
}
module.exports = { crearControladorReserva };

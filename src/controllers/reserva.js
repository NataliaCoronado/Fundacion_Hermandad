"use strict";
const crypto = require("node:crypto");
const vistas = require("../views/reserva");
const { normalizarRut, rutValido } = require("../util/rut");
const { hoy, textoLocal } = require("../util/tiempo");
const { error } = require("./mensajes");
const { crearLimitador } = require("../util/limitador");
const { comprobantePdf } = require("../services/ComprobanteService");
const { MAX_BYTES } = require("../services/DocumentoService");

const TTL_MS = 20 * 60_000; // el flujo de reserva vive 20 minutos (se renueva en cada paso)
const LIMITE = 10;
const VENTANA_MS = 60_000;
const TIPOS_PORTAL = ["Cartola FONASA", "Credencial CESFAM", "Orden médica / derivación", "Certificado", "Otro"];
const REQUISITOS = ["Cartola FONASA", "Credencial CESFAM"];
// Los adjuntos esperan en memoria hasta confirmar: tope global para que muchos flujos abiertos no agoten la RAM.
const maxBytesFlujos = () => Number(process.env.MAX_MB_ADJUNTOS_EN_ESPERA || 150) * 1024 * 1024;
const FIRMAS = [Buffer.from("%PDF"), Buffer.from([0xff, 0xd8, 0xff]), Buffer.from([0x89, 0x50, 0x4e, 0x47])];

// Reserva web del paciente (canal WEB). El avance se guarda en el servidor con un token aleatorio,
// así el RUT nunca viaja en la dirección de la página. Se apaga con RESERVA_WEB=0.
// Pasos: buscar (RUT, lugar, especialidad o profesional) → calendario → datos y documentos → confirmar → comprobante.
function crearReservaController(c) {
  const { catalogo, agendamiento, pacientes, documentos, operacion: op, cuentas, auditoria } = c;
  const flujos = new Map();
  const limitar = crearLimitador(VENTANA_MS);
  const excedido = (ip) => limitar(ip, LIMITE);
  const activo = () => process.env.RESERVA_WEB !== "0";
  const apagado = (usuario) => ({ estado: 503, html: vistas.apagado({ usuario }) });
  const sesion = (t) => {
    const n = Date.now();
    for (const [k, v] of flujos) if (v.vence < n) flujos.delete(k);
    const f = t && flujos.get(t);
    if (f) f.vence = n + TTL_MS;
    return f || null;
  };
  const guard = (fn) => async (a) => {
    if (!activo()) return apagado(a.usuario);
    const t = a.consulta.get("t") || a.cuerpo.t;
    const f = sesion(t);
    if (!f) return { redirigir: "/agendar" };
    return fn({ ...a, t, f });
  };

  // Oferta del portal: lugares activos, profesionales activos con sus lugares y especialidades.
  const espsDe = (p) => (p.especialidades?.length ? p.especialidades : [p.especialidad]);
  async function oferta() {
    const sedes = (await catalogo.policlinicos()).filter((s) => s.activo !== false);
    const ids = new Set(sedes.map((s) => s.id));
    const profs = (await catalogo.profesionales())
      .filter((p) => p.activo)
      .map((p) => ({ ...p, lugares: op.lugares(p).filter((id) => ids.has(id)), esps: espsDe(p).filter((e) => catalogo.especialidadActiva?.(e) !== false) }))
      .filter((p) => p.lugares.length && p.esps.length)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
    const espsPorLugar = {};
    for (const p of profs) for (const l of p.lugares) espsPorLugar[l] = [...new Set([...(espsPorLugar[l] || []), ...p.esps])];
    return { sedes, profs, espsPorLugar };
  }
  // Horas libres que cumplen la búsqueda (solo futuras).
  async function libres(f) {
    let bs = await agendamiento.bloquesDisponibles({
      idPoliclinico: f.lugar === "red" ? undefined : f.lugar,
      especialidad: f.modo === "esp" ? f.esp : undefined,
    });
    if (f.modo === "prof") bs = bs.filter((b) => b.idProfesional === f.prof);
    const ahora = textoLocal();
    return bs.filter((b) => `${b.fecha} ${b.hora}` > ahora);
  }
  const ctxBloque = async (idBloque) => {
    const b = await catalogo.bloque(idBloque);
    const prof = b && (await catalogo.profesional(b.idProfesional));
    const sede = prof && (await catalogo.policlinico(op.sedeBloque(b, prof)));
    return b && prof && sede ? { b, prof, sede, esp: b.especialidad || prof.especialidad } : null;
  };
  const resumenBusqueda = async (f) => {
    const lugar = f.lugar === "red" ? "Toda la red" : (await catalogo.policlinico(f.lugar))?.nombre;
    const que = f.modo === "esp" ? f.esp : (await catalogo.profesional(f.prof))?.nombre;
    return `${que} · ${lugar}`;
  };
  // Cuenta con sesión: el titular y sus familiares vinculados.
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
    const x = await ctxBloque(f.idBloque);
    const cita = `${x.esp} · ${x.prof.nombre} · ${x.b.fecha} ${x.b.hora} · ${x.sede.nombre}`;
    // Con sesión (titular o familiar vinculado) ve y edita sus datos; sin sesión usa la ficha guardada sin mostrarla.
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
    const x = await ctxBloque(f.idBloque);
    const nombre = ficha ? ficha.nombre : `${f.nuevo.nombres} ${f.nuevo.apellidos}`.trim();
    const contacto = ficha && !f.actualizar ? ficha : { ...(f.nuevo || {}), ...(f.actualizar || {}) };
    const canal = !f.comunicaciones ? null : contacto.tieneWhatsapp && contacto.telefono ? "WhatsApp" : contacto.correo ? "Correo" : null;
    return {
      nombre, rut: f.rut, nuevo: !ficha, actualiza: !!f.actualizar, lugar: x.sede.nombre, tele: !!x.sede.telemedicina, idSede: x.sede.id,
      esp: x.esp, prof: x.prof.nombre, fecha: x.b.fecha, hora: x.b.hora, docs: f.docs.map((d) => ({ tipo: d.tipo, nombre: d.archivo.nombre })), cambio: f.cambioDatos || "", canal,
    };
  }

  return {
    // Paso 1: la página principal del portal abre aquí. ?lugar=ID deja un policlínico preseleccionado.
    inicio: async ({ usuario, paciente, consulta }) => {
      if (!activo()) return apagado(usuario);
      const f = sesion(consulta.get("t"));
      const d = f ? { rut: f.rut, quien: f.quien, lugar: f.lugar, modo: f.modo, esp: f.esp, prof: f.prof, consentimiento: true, comunicaciones: f.comunicaciones } : { quien: consulta.get("quien") || undefined, lugar: consulta.get("lugar") || undefined };
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
      const t = crypto.randomBytes(18).toString("hex");
      flujos.set(t, { rut, quien: d.quien, lugar, modo, esp, prof, comunicaciones: d.comunicaciones === "1", verificado, docs: [], vence: Date.now() + TTL_MS });
      return { redirigir: `/agendar/calendario?t=${t}` };
    },

    // Paso 2: calendario mensual con los días disponibles y las horas del día elegido.
    calendario: guard(async ({ t, f, consulta, usuario }) => {
      const bs = await libres(f);
      const dias = new Map();
      for (const b of bs) dias.set(b.fecha, (dias.get(b.fecha) || 0) + 1);
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
        const d = new Date(Date.UTC(a, m - 1 + n, 1));
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      };
      const antes = mes > mesHoy ? mover(-1) : "";
      const despues = mes < ultimo ? mover(1) : "";
      const grupos = [];
      for (const b of bs.filter((x) => x.fecha === dia).sort((x, y) => x.hora.localeCompare(y.hora))) {
        const x = await ctxBloque(b.id);
        if (!x) continue;
        let g = grupos.find((y) => y.prof.id === x.prof.id && y.sede.id === x.sede.id);
        if (!g) grupos.push((g = { prof: x.prof, sede: x.sede, esp: x.esp, bloques: [] }));
        g.bloques.push(b);
      }
      return { html: vistas.calendario({ t, resumen: await resumenBusqueda(f), mes, antes, despues, dias: delMes, dia, grupos, usuario }) };
    }),

    // Paso 3: datos del paciente y documentos.
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
        // Los adjuntos se guardan siempre, con o sin cuenta. Si el paciente ya existía y no inició sesión,
        // quedan marcados para que el personal confirme la identidad al revisarlos.
        for (const i of [1, 2, 3]) {
          const a = d[`doc${i}`];
          if (!a || typeof a === "string") continue;
          if (!TIPOS_PORTAL.includes(d[`tipo${i}`])) throw new Error(`Elige el tipo del documento ${i}.`);
          if (a.datos.length > MAX_BYTES) throw new Error(`El documento ${i} supera los 5 MB.`);
          if (!FIRMAS.some((s) => a.datos.subarray(0, s.length).equals(s))) throw new Error(`El documento ${i} debe ser PDF, JPG o PNG.`);
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
        // Sin sesión, los cambios de contacto no se aplican directo: llegan al policlínico como solicitud.
        f.cambioDatos = ficha && !f.verificado ? String(d.cambioDatos || "").trim().slice(0, 300) : "";
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

    // Paso 4: resumen y confirmación.
    revisar: guard(async ({ t, f, usuario }) => {
      if (!f.idBloque) return { redirigir: `/agendar/calendario?t=${t}` };
      if (!(await catalogo.paciente(f.rut)) && !f.nuevo) return { redirigir: `/agendar/datos?t=${t}` };
      return { html: vistas.revisar({ t, r: await resumen(f), usuario }) };
    }),
    confirmar: guard(async ({ t, f, usuario, paciente }) => {
      if (f.confirmada) return { html: vistas.confirmada({ t, r: f.confirmada.r, envio: f.confirmada.envio, cuenta: !!paciente, usuario }) };
      if (!f.idBloque) return { redirigir: `/agendar/calendario?t=${t}` };
      const x = await ctxBloque(f.idBloque);
      const portal = { id: null, nombre: "Paciente (portal web)", idPoliclinico: x?.sede.id };
      try {
        if (!x || !(await libres(f)).some((b) => b.id === f.idBloque)) throw new Error("BLOQUE_NO_DISPONIBLE");
        const ficha = await catalogo.paciente(f.rut);
        if (!ficha) {
          if (!f.nuevo) return { redirigir: `/agendar/datos?t=${t}` };
          await pacientes.crear({ ...f.nuevo, rut: f.rut, consentimiento: true });
          op.aud(portal, "Ficha creada desde el portal", "Pacientes", f.rut, null, { rut: f.rut }, x.sede.id);
        } else if (f.actualizar) {
          await pacientes.actualizar(f.rut, f.actualizar);
          op.aud(portal, "Datos actualizados desde el portal", "Pacientes", f.rut, ficha, await catalogo.paciente(f.rut), x.sede.id);
        }
        // Paciente nuevo o con sesión: identificado. Si no, la reserva y lo que adjuntó se guardan igual,
        // pero el consentimiento no se registra a nombre de otra persona y los cambios quedan para revisión.
        const identificado = !ficha || f.verificado;
        if (identificado) op.registrarConsentimiento(f.rut, { canal: "Portal web", comunicaciones: f.comunicaciones, usuario: portal });
        const cita = await agendamiento.agendar({ rut: f.rut, idBloque: f.idBloque, canal: "WEB" });
        op.asociarPaciente({ idPoliclinico: x.sede.id }, f.rut);
        for (const doc of f.docs)
          await documentos.registrar({
            rut: f.rut, tipo: doc.tipo, archivo: doc.archivo, usuario: portal,
            observacion: identificado ? "Adjuntado por el paciente en el portal" : "Adjuntado en el portal sin iniciar sesión: confirmar la identidad al revisar",
          });
        if (f.cambioDatos)
          cuentas.solicitar({ rut: f.rut, tipo: "Actualización de datos (portal, sin iniciar sesión)", detalle: f.cambioDatos, idPoliclinico: x.sede.id });
        op.aud(portal, "Reserva web registrada", "Reservas", cita.id, null, { rut: f.rut, idBloque: f.idBloque, documentos: f.docs.length }, x.sede.id);
        f.verificado ||= !ficha;
        const r = await resumen({ ...f, actualizar: null, nuevo: null });
        let envio = "";
        if (r.canal) {
          let m = await op.comunicar(portal, cita, r.canal, "Comprobante de reserva");
          // Se intenta enviar de inmediato; si falla, la reserva no se afecta y el ciclo automático reintenta.
          try { m = await c.despachador.enviar(m); } catch (e) { console.error(e); }
          envio = {
            Enviado: `Te enviamos el comprobante por ${r.canal}.`,
            Simulado: `Modo demostración: el envío del comprobante por ${r.canal} quedó registrado como simulado y no salió ningún mensaje real. Descarga el comprobante.`,
            Pendiente: `El envío del comprobante por ${r.canal} quedó registrado y se reintentará automáticamente. Mientras tanto, descarga el comprobante.`,
          }[m.estado] || `No fue posible enviar el comprobante por ${r.canal}. Descarga el comprobante.`;
        } else if (!f.comunicaciones) envio = "No autorizaste el envío por WhatsApp o correo: descarga o imprime el comprobante.";
        f.confirmada = { idCita: cita.id, r, envio };
        f.docs = [];
        return { html: vistas.confirmada({ t, r, envio, cuenta: !!paciente, usuario }) };
      } catch (e) {
        if (["BLOQUE_OCUPADO", "BLOQUE_NO_DISPONIBLE"].includes(e.message))
          return { estado: 409, html: vistas.revisar({ t, r: await resumen(f), usuario, mensaje: { tipo: "error", texto: "Esa hora ya no está disponible. Elige otra hora en el calendario." } }) };
        return { estado: 400, html: vistas.revisar({ t, r: await resumen(f), usuario, mensaje: error(e) }) };
      }
    }),
    comprobante: guard(async ({ f }) => {
      if (!f.confirmada) return { redirigir: "/agendar" };
      try {
        return { binario: await pdfDeCita(f.confirmada.idCita, true), mime: "application/pdf", nombreArchivo: "comprobante-reserva.pdf" };
      } catch (e) {
        if (e.message !== "CITA_NO_ENCONTRADA") throw e;
        return { redirigir: "/paciente/consulta" }; // la cita ya no está vigente: se revisa en Consultar mi reserva
      }
    }),
    pdfDeCita,
  };

  async function pdfDeCita(idCita, mostrarNombre = true) {
    const cita = await c.citaRepo.buscarPorId(idCita);
    const x = cita && (await ctxBloque(cita.idBloque));
    const p = cita && (await catalogo.paciente(cita.rut));
    // Cita cancelada, borrada o ficha ya no disponible: no hay comprobante que emitir.
    if (!cita || cita.estadoReserva === "CANCELADA" || !x || !p) throw new Error("CITA_NO_ENCONTRADA");
    return comprobantePdf({
      paciente: { rut: p.rut, nombre: mostrarNombre ? p.nombre : vistas.mascaraNombre(p.nombre) },
      bloque: { ...x.b, especialidad: x.esp },
      profesional: cita.idProfesionalReemplazo ? await catalogo.profesional(cita.idProfesionalReemplazo) : x.prof,
      sede: x.sede,
      emitido: textoLocal(),
    });
  }
}
module.exports = { crearReservaController };

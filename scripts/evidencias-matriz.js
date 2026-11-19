"use strict";
// Ejecuta los casos de la Matriz de Pruebas (CP-xx) contra el sistema real (modo memoria, servidor HTTP local)
// y guarda una evidencia por caso: EV-CP-xx.txt con fecha, pasos, datos observados y resultado.
// El estado (Aprobada/Fallida) se calcula a partir de lo observado; nada se escribe a mano.
// Uso: node scripts/evidencias-matriz.js <carpeta-de-salida>
const fs = require("node:fs");
const path = require("node:path");
const { crearContenedor } = require("../src/contenedor");
const { crearServidor } = require("../src/server");
const { textoLocal, hoy, sumarDias } = require("../src/util/tiempo");

const SALIDA = path.resolve(process.argv[2] || "Evidencias_Pruebas");
const A = "11111111-1", B = "22222222-2", C = "33333333-3";

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const login = async (correo) => {
    const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
    return r.status === 302 ? r.headers.get("set-cookie").split(";")[0] : null;
  };
  const s = {
    c, base, login,
    a: await login("admin@ejemplo.cl"),
    t: await login("tens@ejemplo.cl"),
    tm: await login("telemedicina.usuario@ejemplo.cl"),
    req: (ruta, cookie, d) => fetch(base + ruta, { method: d ? "POST" : "GET", headers: cookie ? { Cookie: cookie } : {}, body: d ? new URLSearchParams(d) : undefined, redirect: "manual" }),
    form: (ruta, d) => fetch(base + ruta, { method: "POST", redirect: "manual", body: new URLSearchParams(d) }),
    cerrar: () => new Promise((r) => srv.close(r)),
  };
  return s;
}

// Registro de un caso: cada verificación queda escrita con ✔ o ✘.
function caso() {
  const log = [];
  let ok = true;
  return {
    log,
    paso: (t) => log.push(`· ${t}`),
    dato: (t, v) => log.push(`  ${t}: ${typeof v === "string" ? v : JSON.stringify(v)}`),
    chk: (cond, t) => { log.push(`${cond ? "✔" : "✘"} ${t}`); if (!cond) ok = false; return cond; },
    get ok() { return ok; },
  };
}
// Crea (o usa) la cuenta del paciente y devuelve un cliente con su cookie de sesión.
async function cuentaDe(s, rut, fechaNacimiento, celular4, clave = "una clave suficientemente larga") {
  const r = await s.form("/paciente/cuenta/acceso", { modo: "crear", rut, fechaNacimiento, celular4, clave, confirmarClave: clave, acepto: "1" });
  const ck = (r.headers.get("set-cookie") || "").startsWith("psid=") ? r.headers.get("set-cookie").split(";")[0] : null;
  const h = ck ? { Cookie: ck } : {};
  return {
    ck,
    get: (ruta) => fetch(s.base + ruta, { headers: h, redirect: "manual" }),
    post: (ruta, d) => fetch(s.base + ruta, { method: "POST", headers: h, body: new URLSearchParams(d), redirect: "manual" }),
    multi: async (ruta, d) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(d)) Array.isArray(v) ? fd.append(k, v[0], v[1]) : fd.append(k, v);
      return (await fetch(s.base + ruta, { method: "POST", headers: h, body: fd })).text();
    },
  };
}
const bloqueLibre = async (c, f = {}) => (await c.agendamiento.bloquesDisponibles(f)).sort((x, y) => `${x.fecha}${x.hora}`.localeCompare(`${y.fecha}${y.hora}`))[0];
const nombreDe = async (c, rut) => (await c.catalogo.paciente(rut)).nombre;

const CASOS = {
  "CP-01": { req: "RF01", titulo: "Ficha única por RUT: precarga, alta y actualización", async run(k) {
    const s = await sitio();
    try {
      k.paso("TENS/TONS (San Isidro) abre la ficha de un paciente existente (RUT 11.111.111-1).");
      const h = await (await s.req(`/tens/pacientes/editar?rut=${A}`, s.t)).text();
      k.chk(h.includes("Dirección de prueba 1") && h.includes("+56911111111"), "La ficha aparece con los datos existentes precargados (dirección y teléfono).");
      k.paso("TENS/TONS abre el formulario para un paciente nuevo (RUT 12.345.678-5).");
      const f = await (await s.req("/tens/pacientes?nuevo=1", s.t)).text();
      k.chk(/name="nombres"/.test(f) && /name="rut"/.test(f), "«+ Registrar paciente» abre el formulario de paciente nuevo.");
      const r = await s.req("/tens/pacientes", s.t, { rut: "12345678-5", nombres: "Ana", apellidos: "Prueba", fechaNacimiento: "1990-01-01", genero: "FEMENINO", nacionalidad: "Chilena", telefono: "+56911112222", direccion: "Calle 1", idComuna: "1", consentimiento: "1", tieneWhatsapp: "1" });
      k.dato("Respuesta HTTP al guardar paciente nuevo", r.status);
      const nuevo = await s.c.catalogo.paciente("12345678-5");
      k.chk(!!nuevo && nuevo.nombre === "Ana Prueba", "El paciente nuevo queda guardado en el registro único por RUT.");
      k.paso("TENS/TONS actualiza la dirección del paciente existente.");
      const p = await s.c.catalogo.paciente(A);
      await s.req("/tens/pacientes/editar", s.t, { rut: A, nombres: p.nombres, apellidos: p.apellidos, fechaNacimiento: p.fechaNacimiento, genero: p.genero, nacionalidad: p.nacionalidad, telefono: p.telefono, direccion: "Nueva dirección 123", idComuna: String(p.idComuna), tieneWhatsapp: "1", consentimiento: "1" });
      const p2 = await s.c.catalogo.paciente(A);
      k.dato("Dirección después de actualizar", p2.direccion);
      k.chk(p2.direccion === "Nueva dirección 123", "La actualización queda guardada.");
      return k.ok ? "Paciente existente con datos precargados; formulario disponible para el nuevo, que quedó registrado (12.345.678-5); la dirección actualizada quedó guardada." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-02": { req: "RF02", titulo: "Adulto responsable de un menor", async run(k) {
    const c = crearContenedor();
    const base = { nombres: "Niña", apellidos: "Prueba", direccion: "Calle 1", telefono: "+56955555555", fechaNacimiento: "2018-03-03", genero: "FEMENINO", idComuna: 1, consentimiento: true };
    k.paso("Registrar a una paciente menor (nacida en 2018) sin adulto responsable.");
    let rechazo = "";
    try { await c.pacientes.crear({ ...base, rut: "55555555-5" }); } catch (e) { rechazo = e.message; }
    k.chk(rechazo === "RESPONSABLE_REQUERIDO", `Sin adulto responsable se rechaza (${rechazo}).`);
    k.paso("Registrar a la misma menor con adulto responsable (madre).");
    await c.pacientes.crear({ ...base, rut: "55555555-5", respNombre: "Mamá Prueba", respRelacion: "Madre", respRut: "66666666-6", respTelefono: "+56966666666" });
    const r = (await c.catalogo.paciente("55555555-5")).responsable;
    k.dato("Responsable guardado en la ficha", r);
    k.chk(r && r.relacion === "Madre" && r.rut === "66666666-6", "El vínculo y los datos del adulto responsable quedan en la ficha.");
    return k.ok ? "Sin responsable la ficha de la menor se rechaza; con responsable quedan en la ficha nombre, relación (Madre), RUT y teléfono del adulto." : null;
  } },

  "CP-03": { req: "RF03", titulo: "Consulta de cupos publicados con filtros", async run(k) {
    const s = await sitio();
    try {
      const c = s.c;
      const b0 = await bloqueLibre(c, { idPoliclinico: 1, especialidad: "Medicina General" });
      k.paso(`Filtro: policlínico San Isidro (1), especialidad Medicina General, fecha ${b0.fecha}.`);
      const lista = await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1, especialidad: "Medicina General", fecha: b0.fecha });
      const profs = new Map((await c.catalogo.profesionales()).map((p) => [p.id, p]));
      k.dato("Cupos devueltos", lista.length);
      k.chk(lista.length > 0 && lista.every((b) => b.publicado && b.fecha === b0.fecha && (b.idPoliclinico || profs.get(b.idProfesional).idPoliclinico) === 1 && (b.especialidad || profs.get(b.idProfesional).especialidad) === "Medicina General"), "Todos los cupos devueltos están publicados y cumplen sede, especialidad y fecha.");
      k.paso(`Se despublica el cupo ${b0.id} y se repite la consulta.`);
      await c.catalogo.cambiarPublicacion({ idProfesional: b0.idProfesional, desde: b0.fecha, hasta: b0.fecha, idBloque: b0.id, publicar: false });
      const lista2 = await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1, especialidad: "Medicina General", fecha: b0.fecha });
      k.chk(!lista2.some((b) => b.id === b0.id), "El cupo sin publicar ya no aparece.");
      k.paso("Filtro: Telemedicina como séptimo policlínico (7).");
      const tele = await c.agendamiento.bloquesDisponibles({ idPoliclinico: 7 });
      k.dato("Cupos de Telemedicina", tele.length);
      k.chk(tele.length > 0 && tele.every((b) => (b.idPoliclinico || profs.get(b.idProfesional).idPoliclinico) === 7), "Telemedicina devuelve solo cupos propios.");
      k.paso("Filtro por profesional en la agenda (Administración, profesional 3).");
      const h = await (await s.req(`/admin/agendas?prof=3&fecha=${b0.fecha}`, s.a)).text();
      const columnas = [...h.matchAll(/professional-head[\s\S]*?<b>([^<]+)<\/b>/g)].map((m) => m[1]).filter((n) => n.startsWith("Profesional"));
      k.dato("Columnas de profesionales mostradas", columnas);
      k.chk(columnas.length === 1 && columnas[0] === "Profesional de prueba 3", "La agenda filtrada muestra solo al profesional seleccionado.");
      return k.ok ? `Con sede 1 + Medicina General + ${b0.fecha} se obtuvieron ${lista.length} cupos, todos publicados y conformes; el cupo despublicado desapareció; Telemedicina devolvió ${tele.length} cupos propios; el filtro por profesional mostró solo al profesional 3.` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-04": { req: "RF04", titulo: "Reserva de una cita en un cupo disponible", async run(k) {
    const c = crearContenedor();
    const b = await bloqueLibre(c, { idPoliclinico: 1 });
    k.paso(`Reservar el cupo ${b.id} (${b.fecha} ${b.hora}) para el RUT ${C}.`);
    const cita = await c.agendamiento.agendar({ rut: C, idBloque: b.id, idUsuario: "u2" });
    const p = await c.catalogo.profesional(b.idProfesional);
    k.dato("Cita creada", { id: cita.id, rut: cita.rut, idBloque: cita.idBloque, estadoReserva: cita.estadoReserva });
    k.dato("Sede / profesional / fecha / hora", `${b.idPoliclinico || p.idPoliclinico} / ${p.nombre} / ${b.fecha} / ${b.hora}`);
    k.chk(cita.estadoReserva === "ACTIVA" && cita.idBloque === b.id, "La cita queda registrada y activa en el bloque elegido.");
    k.chk(!(await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 })).some((x) => x.id === b.id), "El cupo deja de estar disponible.");
    return k.ok ? `Se creó la cita ${cita.id} (${p.nombre}, ${b.fecha} ${b.hora}, San Isidro) y el cupo ${b.id} dejó de ofrecerse.` : null;
  } },

  "CP-05": { req: "RF05", titulo: "TENS/TONS agenda en nombre del paciente", async run(k) {
    const s = await sitio();
    try {
      const b = await bloqueLibre(s.c, { idPoliclinico: 1 });
      k.paso(`Sesión TENS/TONS (San Isidro). Paciente llama por teléfono; se agenda el cupo ${b.id} para ${C}.`);
      const h = await (await s.req("/tens/agendar", s.t, { rut: C, idBloque: String(b.id) })).text();
      const cita = (await s.c.citaRepo.buscarPorRut(C)).find((x) => x.idBloque === b.id);
      k.chk(/Cita registrada/.test(h), "El sistema responde «Cita registrada. Queda con confirmación pendiente.».");
      k.chk(!!cita && cita.estadoReserva === "ACTIVA", "La cita queda registrada sin que el paciente use la web.");
      k.chk(s.c.auditoria.listar().some((x) => x.accion === "Cita agendada"), "La auditoría registra quién agendó.");
      return k.ok ? `TENS/TONS registró la cita ${cita.id} para ${C} en el cupo ${b.id}; quedó activa con confirmación pendiente y registrada en auditoría.` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-06": { req: "RF06", titulo: "Lista de espera sin asignación automática", async run(k) {
    const s = await sitio();
    try {
      const antes = (await s.c.citaRepo.buscarPorRut(A)).length;
      k.paso("TENS/TONS registra a 11.111.111-1 en lista de espera de Psicología, San Isidro.");
      await s.c.espera.registrar({ rut: A, idPoliclinico: 1, especialidad: "Psicología", idUsuario: "u2" });
      const sol = (await s.c.espera.vigentes()).find((e) => e.rut === A);
      k.chk(!!sol, "La solicitud queda en la lista de espera.");
      k.paso("TENS/TONS registra un contacto «No responde».");
      const r = await s.req("/tens/espera/gestion", s.t, { idSolicitud: String(sol.id), estado: "No responde", canal: "Llamada" });
      k.dato("Respuesta HTTP", r.status);
      k.chk((await s.c.espera.vigentes()).some((e) => e.id === sol.id), "«No responde» conserva la solicitud.");
      k.chk((await s.c.citaRepo.buscarPorRut(A)).length === antes, "No se creó ninguna cita automáticamente.");
      return k.ok ? `La solicitud ${sol.id} quedó vigente en la lista; tras registrar «No responde» se conservó y no se asignó ninguna cita automáticamente.` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-09": { req: "RF09", titulo: "El silencio no cancela", async run(k) {
    const c = crearContenedor();
    k.paso("Cita 1 con confirmación pendiente; TENS/TONS registra «No contestó».");
    await c.confirmacion.registrarContacto({ idCita: 1, resultado: "No contestó", responsable: "TENS de prueba" });
    const x = await c.citaRepo.buscarPorId(1);
    k.dato("Estado de reserva / confirmación", `${x.estadoReserva} / ${x.estadoConfirmacion}`);
    k.chk(x.estadoReserva === "ACTIVA" && x.estadoConfirmacion === "PENDIENTE", "La confirmación queda pendiente y la reserva sigue activa.");
    return k.ok ? "Tras «No contestó», la cita 1 sigue ACTIVA y su confirmación sigue PENDIENTE." : null;
  } },

  "CP-10": { req: "RF10", titulo: "Listado de pendientes de confirmación", async run(k) {
    const s = await sitio();
    try {
      k.paso("TENS/TONS abre Confirmaciones.");
      const h = await (await s.req("/tens/confirmaciones", s.t)).text();
      const pend = await s.c.confirmacion.pendientes();
      k.dato("Citas pendientes según el sistema", pend.map((x) => x.id));
      const sinEsp = h.replace(/\s/g, "");
      k.chk(h.includes(await nombreDe(s.c, A)), "Aparece la cita pendiente del paciente A.");
      k.chk(/56911111111|911111111|91111\D?1111/.test(sinEsp), "Aparece el teléfono de contacto del paciente.");
      return k.ok ? "El listado mostró la cita pendiente de Paciente de prueba A con su teléfono de contacto." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-11": { req: "RF11", titulo: "Origen de la cancelación", async run(k) {
    const s = await sitio();
    try {
      const c = s.c;
      k.paso("Cita 2: el paciente pulsa «Cancelar mi hora» en el bot de WhatsApp (modo simulado, sin proveedor real).");
      await c.bot.responder({ idCita: 2, boton: "Cancelar mi hora" });
      k.paso("Cita nueva: TENS/TONS registra la cancelación solicitada por llamada.");
      const b1 = await bloqueLibre(c, { idPoliclinico: 1 });
      const x1 = await c.agendamiento.agendar({ rut: C, idBloque: b1.id });
      await s.req("/tens/cancelar", s.t, { idCita: String(x1.id), motivo: "Paciente viaja", canal: "Llamada", destino: "Disponible" });
      k.paso("Cita 1: Administración la cancela desde Cancelaciones institucionales.");
      await s.req("/admin/cancelaciones", s.a, { idCitas: "1", motivo: "Corte de luz", destino: "Bloqueado" });
      const o = async (id) => (await c.citaRepo.buscarPorId(id)).origenCancelacion;
      k.dato("Orígenes", { cita2: await o(2), [`cita${x1.id}`]: await o(x1.id), cita1: await o(1) });
      k.chk(await o(2) === "WHATSAPP" && await o(x1.id) === "ASISTIDA" && await o(1) === "INSTITUCIONAL", "Cada cancelación registra su origen distinto.");
      return k.ok ? `Orígenes registrados: WHATSAPP (cita 2, bot en modo simulado), ASISTIDA (cita ${x1.id}, TENS/TONS) e INSTITUCIONAL (cita 1, Administración).` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-12": { req: "RF12", titulo: "Agenda, bloqueo y publicación gradual", async run(k) {
    const s = await sitio();
    try {
      const c = s.c;
      const f = sumarDias(hoy(), 60);
      k.paso(`Administración crea una agenda sin publicar para el profesional 1 el ${f}, 09:00–10:00, cupos de 20 min.`);
      const r = await s.req("/admin/bloque/guardar", s.a, { idProfesional: "1", idPoliclinico: "1", especialidad: "Medicina General", desde: f, hasta: f, repeticion: "unica", horaInicio: "09:00", horaFin: "10:00", duracion: "20", publicado: "0" });
      k.dato("Respuesta HTTP", r.status);
      const bs = (await c.catalogo.bloques()).filter((b) => b.idProfesional === 1 && b.fecha === f).sort((a, b) => a.hora.localeCompare(b.hora));
      k.dato("Cupos creados", bs.map((b) => `${b.id} ${b.hora}`));
      const disp = async () => new Set((await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 })).map((b) => b.id));
      const d0 = await disp();
      k.chk(bs.length === 3 && bs.every((b) => !d0.has(b.id)), "Se crearon 3 cupos y ninguno, sin publicar, es visible.");
      k.paso(`Se bloquea el cupo ${bs[0].id} y se publica solo el cupo ${bs[1].id}.`);
      await s.req("/admin/cupo/estado", s.a, { idBloque: String(bs[0].id), estado: "Bloqueado" });
      await s.req("/admin/cupo/estado", s.a, { idBloque: String(bs[1].id), estado: "Disponible" });
      const d = await disp();
      k.chk(d.has(bs[1].id) && !d.has(bs[0].id) && !d.has(bs[2].id), "Solo el cupo publicado es visible.");
      let err = "";
      try { await c.agendamiento.agendar({ rut: C, idBloque: bs[0].id }); } catch (e) { err = e.message; }
      k.chk(!!err, `El cupo bloqueado no se puede reservar (${err}).`);
      const ok = await c.agendamiento.agendar({ rut: C, idBloque: bs[1].id });
      k.chk(ok.estadoReserva === "ACTIVA", "El cupo publicado sí se puede reservar.");
      return k.ok ? `Se crearon 3 cupos sin publicar (${f}); tras bloquear uno y publicar otro, solo el publicado fue visible y reservable; el bloqueado se rechazó (${err}).` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-13": { req: "RF13", titulo: "Reservas afectadas por un cambio de agenda", async run(k) {
    const s = await sitio();
    try {
      const b = await s.c.catalogo.bloque(1);
      k.paso(`Administración propone una ausencia del profesional 1 el ${b.fecha} (día con 2 reservas).`);
      const h = await (await s.req("/admin/cambio/revisar", s.a, { idProfesional: "1", fecha: b.fecha, tipo: "AUSENCIA", motivo: "Licencia médica" })).text();
      k.chk(/2 reservas afectadas/.test(h), "El sistema indica «2 reservas afectadas».");
      k.chk(h.includes(await nombreDe(s.c, A)) && h.includes(await nombreDe(s.c, B)), "Lista a los dos pacientes afectados.");
      k.chk(/Agenda actual/.test(h) && /Cambio propuesto/.test(h), "Muestra la agenda actual frente al cambio propuesto.");
      return k.ok ? `Antes de aplicar la ausencia del ${b.fecha}, el sistema listó 2 reservas afectadas (Paciente de prueba A y B) y comparó agenda actual con cambio propuesto.` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-14": { req: "RF14", titulo: "Registro de asistencia e inasistencia", async run(k) {
    const s = await sitio();
    try {
      k.paso("TENS/TONS marca la cita 1 como «Atendida» y la cita 2 como «No asistió».");
      await s.req("/tens/flujo", s.t, { idCita: "1", estado: "Atendida" });
      await s.req("/tens/flujo", s.t, { idCita: "2", estado: "No asistió" });
      const x1 = await s.c.citaRepo.buscarPorId(1), x2 = await s.c.citaRepo.buscarPorId(2);
      k.dato("Asistencia cita 1 / cita 2", `${x1.asistencia} / ${x2.asistencia}`);
      k.chk(x1.asistencia === "ASISTIO" && x2.asistencia === "NO_ASISTIO", "Cada resultado queda registrado.");
      const aud = s.c.auditoria.listar().filter((x) => x.accion === "Flujo de atención actualizado");
      k.dato("Auditoría", aud.map((x) => `${x.fecha} · ${x.usuario} · cita ${x.registro} · ${x.despues?.estado}`));
      k.chk(aud.length >= 2 && aud.every((x) => x.usuario && x.usuario !== "(anónimo)"), "Cada resultado queda con su responsable.");
      return k.ok ? `Cita 1 = ASISTIO y cita 2 = NO_ASISTIO; la auditoría registró ambas con fecha y responsable (${aud[0].usuario}).` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-15": { req: "RF15", titulo: "Estado administrativo separado de la confirmación", async run(k) {
    const c = crearContenedor();
    k.paso("Cita 1 reservada (confirmación PENDIENTE). Se registra la asistencia.");
    await c.agendamiento.registrarAsistencia(1, true);
    let x = await c.citaRepo.buscarPorId(1);
    k.chk(x.asistencia === "ASISTIO" && x.estadoConfirmacion === "PENDIENTE", "Registrar la asistencia no altera la confirmación.");
    k.paso("Cita 2 (CONFIRMADA) se cancela de forma asistida.");
    await c.agendamiento.cancelar(2, "ASISTIDA");
    x = await c.citaRepo.buscarPorId(2);
    k.dato("Cita 2", `${x.estadoReserva} / ${x.estadoConfirmacion}`);
    k.chk(x.estadoReserva === "CANCELADA" && x.estadoConfirmacion === "CONFIRMADA", "Cancelar no altera el estado de confirmación.");
    let err = "";
    try { await c.agendamiento.registrarAsistencia(2, true); } catch (e) { err = e.message; }
    k.chk(err === "CITA_NO_ACTIVA", `No se puede marcar asistencia en una cita cancelada (${err}).`);
    return k.ok ? "La asistencia de la cita 1 se registró sin cambiar su confirmación (PENDIENTE); la cita 2 se canceló conservando CONFIRMADA; el cambio inválido (asistencia en cita cancelada) fue rechazado." : null;
  } },

  "CP-16": { req: "RF16", titulo: "Historial de cambios de una cita", async run(k) {
    const s = await sitio();
    try {
      k.paso("La cita 1 se modifica dos veces: «Llegó» y luego «En sala».");
      await s.req("/tens/flujo", s.t, { idCita: "1", estado: "Llegó" });
      await s.req("/tens/flujo", s.t, { idCita: "1", estado: "En sala" });
      const h = s.c.auditoria.listar().filter((x) => String(x.registro) === "1");
      k.dato("Historial de la cita 1", h.map((x) => `${x.fecha} · ${x.accion} · ${x.usuario} · ${x.despues?.estado}`));
      k.chk(h.length >= 2 && h.every((x) => x.fecha && x.accion && x.usuario), "Cada cambio muestra fecha, operación y responsable.");
      return k.ok ? `El historial de la cita 1 muestra ${h.length} cambios, cada uno con fecha, operación y responsable.` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-17": { req: "RF17", titulo: "Revisión manual de documentos FONASA/CESFAM", async run(k) {
    const s = await sitio();
    try {
      const d = await s.c.documentos.registrar({ rut: A, tipo: "Cartola FONASA", usuario: { nombre: "TENS de prueba" } });
      k.paso(`Documento ${d.id} (Cartola FONASA) del paciente A. TENS/TONS registra la revisión.`);
      await s.req("/tens/documentos/verificar", s.t, { id: String(d.id) });
      const v = s.c.documentos.listar().find((x) => x.id === d.id);
      const a = s.c.auditoria.listar().find((x) => x.accion === "Documento verificado");
      k.dato("Documento", { verificado: v.verificado, verificadoPor: v.verificadoPor });
      k.dato("Auditoría", a && `${a.fecha} · ${a.usuario}`);
      k.chk(v.verificado === true && !!v.verificadoPor && !!a?.fecha, "Quedan estado, fecha y responsable de la revisión.");
      return k.ok ? `El documento quedó verificado por ${v.verificadoPor}; la auditoría registra la fecha (${a.fecha}).` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-18": { req: "RF18", titulo: "Datos administrativos centralizados, sin ficha clínica", async run(k) {
    const c = crearContenedor();
    const p = await c.catalogo.paciente(A);
    k.dato("Campos del paciente", Object.keys(p));
    const sql = fs.readFileSync(path.join(__dirname, "../db/hermandad_postgresql.sql"), "utf8").toLowerCase();
    const clinicos = ["diagnostic", "anamnesis", "receta", "alergia", "tratamiento", "evolucion_clinica", "ficha_clinica"];
    const hallados = clinicos.filter((t) => Object.keys(p).join(" ").toLowerCase().includes(t) || new RegExp(`\\b${t}\\w*\\s+(varchar|text|jsonb)`).test(sql));
    k.chk(["rut", "telefono", "direccion", "fechaNacimiento"].every((x) => x in p), "Hay datos administrativos centralizados del paciente.");
    k.chk((await c.citaRepo.listar()).length > 0 && (await c.catalogo.contactos()) !== undefined, "Citas y contactos están en el mismo repositorio.");
    k.chk(hallados.length === 0, `Ningún campo de ficha clínica en el modelo ni en el esquema SQL (buscados: ${clinicos.join(", ")}).`);
    return k.ok ? "El registro del paciente contiene solo datos administrativos; ni el modelo ni el esquema SQL tienen campos clínicos." : null;
  } },

  "CP-19": { req: "RF19", titulo: "Consulta de citas según perfil", async run(k) {
    const s = await sitio();
    try {
      const b = await bloqueLibre(s.c, { idPoliclinico: 2 });
      const x = await s.c.agendamiento.agendar({ rut: C, idBloque: b.id });
      k.paso(`Cita ${x.id} en Sagrada Familia (sede 2). TENS/TONS de San Isidro y Administración intentan verla.`);
      const t1 = (await s.req("/tens/reserva?idCita=1", s.t)).status;
      const t2 = (await s.req(`/tens/reserva?idCita=${x.id}`, s.t)).status;
      const a2 = (await s.req(`/admin/cupo?idCita=${x.id}`, s.a)).status;
      k.dato("TENS cita propia / cita de otra sede / Administración cita de otra sede", `${t1} / ${t2} / ${a2}`);
      k.chk(t1 === 200 && t2 === 403 && a2 === 200, "El TENS/TONS ve su sede y Administración ve todas.");
      return k.ok ? `TENS/TONS de San Isidro abrió su cita (200) y se le negó la de Sagrada Familia (403); Administración la abrió (200).` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-20": { req: "RF20", titulo: "Filtros de reportes", async run(k) {
    const c = crearContenedor({ demo: true });
    const citas = await c.citaRepo.listar();
    const bs = new Map((await c.catalogo.bloques()).map((b) => [b.id, b]));
    const ps = new Map((await c.catalogo.profesionales()).map((p) => [p.id, p]));
    const manual = (f) => citas.filter((x) => { const b = bs.get(x.idBloque), p = ps.get(b.idProfesional); return (!f.idPoliclinico || (b.idPoliclinico || p.idPoliclinico) === f.idPoliclinico) && (!f.especialidad || (b.especialidad || p.especialidad) === f.especialidad) && (!f.idProfesional || p.id === f.idProfesional) && (!f.desde || b.fecha >= f.desde) && (!f.hasta || b.fecha <= f.hasta); }).length;
    const d = hoy();
    const filtros = [
      ["Período (últimos 30 días)", { desde: sumarDias(d, -30), hasta: d }],
      ["Sede San Isidro", { idPoliclinico: 1 }],
      ["Modalidad Telemedicina", { idPoliclinico: 7 }],
      ["Profesional 1", { idProfesional: 1 }],
      ["Especialidad Kinesiología", { especialidad: "Kinesiología" }],
    ];
    const filas = [];
    for (const [n, f] of filtros) {
      const r = await c.reportes.resumen(f), m = manual(f);
      filas.push(`${n}: sistema ${r.totalCitas} / conteo manual ${m}`);
      k.chk(r.totalCitas === m && m > 0, `${n}: el total del reporte (${r.totalCitas}) coincide con el conteo manual (${m}).`);
    }
    return k.ok ? `Con datos de demostración, los cinco filtros dieron totales iguales al conteo manual (${filas.join("; ")}).` : null;
  } },

  "CP-21": { req: "RF21", titulo: "Cálculo de indicadores", async run(k) {
    const c = crearContenedor();
    k.paso("Datos conocidos: cita 1 asistió, cita 2 no asistió; se crea una cita 3 y se cancela.");
    await c.agendamiento.registrarAsistencia(1, true);
    await c.agendamiento.registrarAsistencia(2, false);
    const x = await c.agendamiento.agendar({ rut: C, idBloque: (await bloqueLibre(c, { idPoliclinico: 1 })).id });
    await c.agendamiento.cancelar(x.id, "ASISTIDA");
    const r = await c.reportes.resumen();
    k.dato("Indicadores del sistema", { totalCitas: r.totalCitas, activas: r.activas, canceladas: r.canceladas, asistio: r.asistio, noAsistio: r.noAsistio, tasaInasistencia: r.tasaInasistencia, tasaCancelacion: r.tasaCancelacion, cupos: r.cupos, ocupados: r.ocupados, ocupacion: r.ocupacion });
    const cupos = (await c.catalogo.bloques()).length;
    k.chk(r.totalCitas === 3 && r.canceladas === 1 && r.asistio === 1 && r.noAsistio === 1, "Totales, canceladas, asistencias e inasistencias coinciden con el conteo manual (3, 1, 1, 1).");
    k.chk(r.tasaInasistencia === 50, `Tasa de inasistencia = 1/2 = 50 % (sistema: ${r.tasaInasistencia}).`);
    k.chk(r.tasaCancelacion === 33, `Tasa de cancelación = 1/3 ≈ 33 % (sistema: ${r.tasaCancelacion}).`);
    k.chk(r.cupos === cupos, `Cupos totales coinciden (${cupos}).`);
    return k.ok ? `Indicadores iguales al cálculo manual: 3 citas, 1 cancelada (33 %), 1 asistió, 1 no asistió (inasistencia 50 %), ${cupos} cupos.` : null;
  } },

  "CP-22": { req: "RF22", titulo: "Familias de reportes", async run(k) {
    const c = crearContenedor({ demo: true });
    const f = { desde: sumarDias(hoy(), -90), hasta: hoy() };
    const fam = {
      "General (resumen)": await c.reportes.resumen(f),
      "Por área (por policlínico)": await c.reportes.porPoliclinico(f),
      "Caracterización de pacientes": await c.reportes.caracterizacion(f),
      "Ocupación / demanda por profesional": await c.reportes.porProfesional(f),
      "Encuestas": c.encuestas.resumen(),
    };
    for (const [n, v] of Object.entries(fam)) {
      const vacio = v == null || (Array.isArray(v) ? !v.length : !Object.keys(v).length);
      k.chk(!vacio, `${n}: generado (${Array.isArray(v) ? v.length + " filas" : Object.keys(v).slice(0, 6).join(", ")}).`);
    }
    return k.ok ? "Se generaron las cinco familias (general, por policlínico, caracterización, ocupación por profesional y encuestas) con los datos del período." : null;
  } },

  "CP-23": { req: "RF23", titulo: "Descarga de reportes", async run(k) {
    const s = await sitio();
    try {
      const r = await s.c.reportes.resumen();
      const csv = await (await s.req("/admin/reportes/resumen.csv", s.a)).text();
      fs.writeFileSync(path.join(SALIDA, "EV-CP-23_resumen.csv"), csv);
      k.dato("CSV resumen (primeras líneas)", csv.split("\n").slice(0, 6).join(" | "));
      k.dato("Mismos indicadores en el sistema", { totalCitas: r.totalCitas, activas: r.activas, canceladas: r.canceladas, confirmadas: r.confirmadas });
      k.chk(csv.includes(`Citas registradas;${r.totalCitas}`) && csv.includes(`Citas activas;${r.activas}`) && csv.includes(`Canceladas;${r.canceladas}`) && csv.includes(`Confirmadas;${r.confirmadas}`), "El CSV contiene los mismos totales que el reporte en pantalla.");
      const formatos = [["pdf", "application/pdf", "%PDF"], ["xlsx", "spreadsheetml", "PK"], ["png", "image/png", "\x89PNG"]];
      for (const [fmt, tipo, firma] of formatos) {
        const g = fmt === "png" ? "sexo" : "todos";
        const resp = await s.req(`/admin/reportes/exportar?grafico=${g}&formato=${fmt}`, s.a);
        const buf = Buffer.from(await resp.arrayBuffer());
        k.dato(`Exportación ${fmt}`, `HTTP ${resp.status}, ${resp.headers.get("content-type")}, ${buf.length} bytes`);
        if (resp.status === 200) {
          fs.writeFileSync(path.join(SALIDA, `EV-CP-23_reporte.${fmt}`), buf);
          k.dato("Archivo guardado", `EV-CP-23_reporte.${fmt}`);
        }
        k.chk(resp.status === 200 && (resp.headers.get("content-type") || "").includes(tipo) && buf.subarray(0, firma.length).toString("latin1") === firma, `Descarga ${fmt.toUpperCase()} válida.`);
      }
      return k.ok ? "El CSV coincide con los totales en pantalla y las descargas PDF, Excel (XLSX) y PNG se generaron con su formato válido." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-24": { req: "RF24", titulo: "Control de acceso por rol", async run(k) {
    const s = await sitio();
    try {
      const st = async (r, ck) => (await s.req(r, ck)).status;
      const v = { tensAdmin: await st("/admin/agendas", s.t), teleAdmin: await st("/admin/agendas", s.tm), teleFichaSede: await st(`/tens/ficha?rut=${A}`, s.tm), sinSesion: await st("/tens/panel"), admin: await st("/admin/agendas", s.a), webPaciente: await st("/agendar") };
      k.dato("Códigos HTTP", v);
      k.chk(v.tensAdmin === 403 && v.teleAdmin === 403, "TENS/TONS y Telemedicina no entran a Administración.");
      k.chk(v.teleFichaSede === 403, "Telemedicina no abre fichas de una sede presencial.");
      k.chk(v.sinSesion === 302, "Sin sesión se redirige al ingreso.");
      k.chk(v.admin === 200, "Administración entra a su módulo.");
      k.chk(v.webPaciente === 200, "El paciente reserva por la web sin cuenta institucional.");
      return k.ok ? `Acceso ajeno rechazado (403 para TENS/TONS y Telemedicina en Administración; 403 Telemedicina en ficha de sede); sin sesión 302; Administración 200; portal del paciente 200 sin cuenta.` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-27": { req: "RF27", titulo: "Bitácora de contactos de TENS/TONS", async run(k) {
    const s = await sitio();
    try {
      k.paso("TENS/TONS llama al paciente de la cita 1 y registra «No contestó» desde Confirmaciones.");
      const r = await s.req("/tens/confirmaciones", s.t, { idCita: "1", resultado: "No contestó", canal: "Llamada" });
      k.dato("Respuesta HTTP", r.status);
      const ct = (await s.c.catalogo.contactos()).filter((x) => x.idCita === 1);
      k.dato("Bitácora de la cita 1", ct.map((x) => ({ fecha: x.fecha, canal: x.canal, responsable: x.responsable, resultado: x.resultado })));
      const x = ct[ct.length - 1];
      k.chk(!!x && !!x.fecha && x.canal === "Llamada" && !!x.responsable && x.resultado === "No contestó", "La bitácora muestra fecha, canal, responsable y resultado.");
      return k.ok ? `La bitácora registró el contacto: ${x.fecha}, ${x.canal}, ${x.responsable}, «${x.resultado}».` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-28": { req: "RF28", titulo: "Comprobante en pantalla, WhatsApp y correo", async run(k) {
    const s = await sitio();
    try {
      const { html, cita, t } = await reservaWeb(s, A);
      const p = await s.c.catalogo.paciente(A), b = await s.c.catalogo.bloque(cita.idBloque), prof = await s.c.catalogo.profesional(b.idProfesional);
      k.chk(html.includes(p.rut) && html.includes(prof.nombre) && html.includes(b.hora) && html.includes(prof.especialidad), "El comprobante en pantalla muestra paciente (RUT), policlínico, especialidad, profesional, fecha y hora.");
      k.chk(!/c[oó]digo de reserva/i.test(html), "El comprobante no muestra código de reserva.");
      const pdf = Buffer.from(await (await fetch(`${s.base}/agendar/comprobante.pdf?t=${t}`)).arrayBuffer());
      fs.writeFileSync(path.join(SALIDA, "EV-CP-28_comprobante.pdf"), pdf);
      const txt = pdf.toString("latin1");
      k.dato("Comprobante PDF", `${pdf.length} bytes, guardado como EV-CP-28_comprobante.pdf`);
      k.chk(pdf.subarray(0, 5).toString() === "%PDF-" && txt.includes(A) && txt.includes("Medicina General") && !/C.digo de reserva:/i.test(txt), "El comprobante se descarga en PDF con los datos de la cita y sin código.");
      const envios = (s.c.extras.listar("comunicaciones") || []).filter((m) => m.idCita === cita.id && m.tipo === "Comprobante de reserva");
      k.dato("Envíos del comprobante registrados", envios.map((m) => `${m.canal}: ${m.estado} (${m.detalle})`));
      k.chk(envios.some((m) => ["Enviado", "Entregado"].includes(m.estado)), "El comprobante fue enviado por el canal disponible (WhatsApp o correo).");
      return k.ok ? "Comprobante en pantalla, en PDF y enviado por el canal disponible." : `El comprobante se muestra en pantalla y se descarga en PDF con paciente, policlínico, especialidad, profesional, fecha y hora, sin código. El envío por ${envios[0]?.canal || "WhatsApp"} quedó registrado como «${envios[0]?.estado || "sin registro"}»: no se entrega porque aún no hay proveedor de mensajería conectado.`;
    } finally { await s.cerrar(); }
  } },

  "CP-29": { req: "RF29", titulo: "Consulta de reserva con verificación", async run(k) {
    const s = await sitio();
    try {
      const q = async (d) => s.form("/paciente/consulta", d);
      const t = async (d) => (await q(d)).text();
      const bien = await t({ rut: "11.111.111-1", fechaNacimiento: "1980-01-01", celular4: "1111" });
      k.chk(/VIGENTE ·/.test(bien) && !/<form[^>]*action="\/tens/.test(bien), "Con datos correctos muestra la reserva propia, en solo lectura.");
      k.chk(!/c[oó]digo de reserva/i.test(bien), "No pide ni muestra código.");
      const otro = await t({ rut: "22.222.222-2", fechaNacimiento: "1980-01-01", celular4: "1111" });
      k.chk(/No pudimos verificar/.test(otro) && !/VIGENTE ·/.test(otro), "Con el RUT de otra persona y datos propios no muestra nada.");
      const malo = await t({ rut: "11.111.111-1", fechaNacimiento: "1980-01-02", celular4: "1111" });
      k.chk(/No pudimos verificar/.test(malo) && !/VIGENTE ·/.test(malo), "Con un dato de verificación incorrecto no muestra nada.");
      await q({ rut: "1-9" }); await q({ rut: "1-9" });
      const r6 = await q({ rut: "1-9" });
      k.dato("Sexto intento en el mismo minuto", `HTTP ${r6.status}`);
      k.chk(r6.status === 429, "Los intentos repetidos se limitan (HTTP 429).");
      return k.ok ? "Con RUT, fecha de nacimiento y 4 dígitos del celular correctos se mostró la reserva en solo lectura y sin código; con RUT ajeno o dato incorrecto respondió «No pudimos verificar tus datos»; el sexto intento del minuto se bloqueó (429)." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-31": { req: "RF31", titulo: "Desactivación de profesional con reservas", async run(k) {
    const s = await sitio();
    try {
      const h = await (await s.req("/admin/profesionales?q=Profesional de prueba 1", s.a)).text();
      k.chk(/Profesional de prueba 1/.test(h), "Administración encuentra al profesional 1 en la búsqueda.");
      const vig = (await s.c.citaRepo.listar()).filter((x) => x.estadoReserva === "ACTIVA" && [1, 2].includes(x.id));
      k.paso(`El profesional 1 tiene ${vig.length} reservas vigentes. Administración intenta desactivarlo.`);
      const r = await s.req("/admin/profesionales/estado", s.a, { idProfesional: "1", activo: "0" });
      const p = await s.c.catalogo.profesional(1);
      k.dato("Respuesta HTTP / profesional activo después", `${r.status} / ${p.activo}`);
      k.chk(p.activo === true, "La desactivación se bloquea hasta gestionar las citas afectadas.");
      return k.ok ? `El sistema rechazó desactivar al profesional 1 porque tiene ${vig.length} reservas vigentes (respuesta ${r.status}); sigue activo hasta gestionar las citas afectadas.` : `El sistema permitió desactivar al profesional 1 aunque tenía ${vig.length} reservas vigentes (respuesta ${r.status}, activo = ${p.activo}); no exige gestionar antes las citas afectadas.`;
    } finally { await s.cerrar(); }
  } },

  "CP-32": { req: "RF32", titulo: "Catálogo institucional", async run(k) {
    const s = await sitio();
    try {
      const { SEDES, infoSede } = require("../src/models/sedesInfo");
      const h = await (await s.req("/admin/policlinicos", s.a)).text();
      k.dato("Lugares", SEDES.map((x) => x.nombre));
      k.chk(SEDES.length === 7 && SEDES.filter((x) => x.telemedicina).length === 1, "Hay seis policlínicos y Telemedicina.");
      k.chk(SEDES.every((x) => h.includes(x.nombre)), "Los siete lugares aparecen en la pantalla de Administración.");
      k.chk(SEDES.every((x) => (infoSede(x.id)?.whatsapp || infoSede(x.id)?.telefono || infoSede(x.id)?.correo) && infoSede(x.id)?.especialidades?.length), "Cada lugar tiene contacto y especialidades.");
      return k.ok ? "Administración ve los seis policlínicos y Telemedicina, cada uno con contacto y especialidades." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-33": { req: "RF33", titulo: "Cuentas institucionales", async run(k) {
    const s = await sitio();
    try {
      const admin = { id: "u1", nombre: "Administración", rol: "ADMINISTRACION" };
      k.paso("Administración crea una cuenta TENS/TONS para San Isidro.");
      const n = await s.c.operacion.usuario({ nombre: "Cuenta Prueba", correo: "cuenta.prueba@ejemplo.cl", rol: "TENS_TONS", lugares: "1", activo: "1" }, admin);
      k.chk(!!(await s.c.catalogo.usuarioPorCorreo("cuenta.prueba@ejemplo.cl")), "La cuenta queda creada.");
      k.paso("La edita (nombre y lugares) y revisa sus permisos.");
      await s.c.operacion.usuario({ id: n.id, nombre: "Cuenta Editada", correo: "cuenta.prueba@ejemplo.cl", rol: "TENS_TONS", lugares: "1,3", activo: "1" }, admin);
      const e = await s.c.catalogo.usuarioPorCorreo("cuenta.prueba@ejemplo.cl");
      k.dato("Cuenta editada", { nombre: e.nombre, lugares: e.lugares, rol: e.rol });
      k.chk(e.nombre === "Cuenta Editada" && (e.lugares || []).length === 2, "Los cambios se aplican.");
      k.paso("Desactiva la cuenta demo tens@ejemplo.cl y esta intenta ingresar.");
      const t = await s.c.catalogo.usuarioPorCorreo("tens@ejemplo.cl");
      await s.c.operacion.usuario({ ...t, lugares: (t.lugares || [t.idPoliclinico]).join(","), activo: "0" }, admin);
      const cookie = await s.login("tens@ejemplo.cl");
      k.chk(cookie === null, "La cuenta desactivada no ingresa.");
      return k.ok ? "Se creó la cuenta «Cuenta Prueba», se editó (nombre y dos lugares) y la cuenta desactivada tens@ejemplo.cl no pudo ingresar." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-34": { req: "RF34", titulo: "Consulta de auditoría", async run(k) {
    const s = await sitio();
    try {
      await s.req("/tens/flujo", s.t, { idCita: "1", estado: "Llegó" });
      await s.req("/admin/cancelaciones", s.a, { idCitas: "2", motivo: "Prueba de auditoría", destino: "Disponible" });
      const d = hoy();
      const h = await (await s.req(`/admin/auditoria?desde=${d}&hasta=${d}&sede=1`, s.a)).text();
      k.chk(/Flujo de atención actualizado/.test(h), "Filtrando por fecha de hoy y sede San Isidro aparece la operación de TENS/TONS.");
      const h2 = await (await s.req(`/admin/auditoria?desde=${sumarDias(d, -30)}&hasta=${d}&accion=Cancelación`, s.a)).text();
      k.chk(/Cancelación institucional/.test(h2), "Filtrando por período y operación aparece la cancelación institucional.");
      const fut = await (await s.req(`/admin/auditoria?desde=${sumarDias(d, 1)}&hasta=${sumarDias(d, 2)}`, s.a)).text();
      k.chk(!/Flujo de atención actualizado/.test(fut), "Un período sin operaciones no muestra registros.");
      return k.ok ? "La auditoría filtrada por fecha, sede, período y operación mostró las operaciones de prueba con sus datos; un período futuro no mostró registros." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-35": { req: "RF35", titulo: "Agenda de Telemedicina", async run(k) {
    const s = await sitio();
    try {
      const acceso = await s.form("/login", { correo: "telemedicina.usuario@ejemplo.cl", clave: "demo1234" });
      k.chk(acceso.status === 302 && acceso.headers.get("location") === "/tens/agenda", "Telemedicina abre directamente la Agenda al iniciar sesión.");
      const h = await (await s.req("/tens/agenda", s.tm)).text();
      for (const m of ["Agendas y reservas", "Lista de espera", "Pacientes", "Comunicaciones"]) k.chk(h.includes(m), `El menú de Telemedicina incluye «${m}».`);
      k.chk(!h.includes('href="/tens/panel"'), "El menú omite el acceso al panel anterior.");
      const st = {};
      for (const r of ["/tens/agenda", "/tens/espera", "/tens/confirmaciones", "/tens/comunicaciones", "/tens/pacientes"]) st[r] = (await s.req(r, s.tm)).status;
      k.dato("Códigos HTTP", st);
      k.chk(Object.values(st).every((x) => x === 200), "Agenda, lista de espera, confirmaciones, comunicaciones y pacientes funcionan para Telemedicina.");
      return k.ok ? "Telemedicina abre directamente la Agenda. Las pantallas de lista de espera, confirmaciones, comunicaciones y pacientes también respondieron correctamente." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-36": { req: "RF36", titulo: "Encuesta voluntaria de agendamiento, distinta de la posterior a la atención", async run(k) {
    const s = await sitio();
    try {
      k.paso("El paciente B reserva una hora por el portal y, al confirmar, se le ofrece la encuesta del agendamiento.");
      const { html, cita, t } = await reservaWeb(s, B);
      k.chk(/¿Cómo fue reservar tu hora\?/.test(html) && /\/agendar\/encuesta/.test(html), "La reserva confirmada ofrece la encuesta de agendamiento.");
      const form = await (await fetch(`${s.base}/agendar/encuesta?t=${t}`)).text();
      k.chk(/f[aá]cil fue reservar tu hora/.test(form), "La encuesta pregunta por la experiencia de reservar.");
      k.chk(/No es la encuesta de la atenci[oó]n/.test(form), "Se distingue explícitamente de la encuesta posterior a la atención.");
      k.chk(!/name="rut"/.test(form), "No pide el RUT: se responde con el token de la reserva recién hecha.");
      k.paso("Responde con nota 4 y un comentario.");
      const r1 = await (await s.form("/agendar/encuesta", { t, nota: "4", comentario: "Fue sencillo reservar" })).text();
      const guardadas = s.c.extras.listar("encuestasAgendamiento");
      k.dato("Encuestas de agendamiento", guardadas);
      k.dato("Resumen agendamiento", s.c.encuestas.resumenAgendamiento());
      k.dato("Resumen atención (RF30)", s.c.encuestas.resumen());
      k.chk(/qued[oó] registrada/.test(r1) && guardadas.length === 1 && guardadas[0].nota === 4 && guardadas[0].idCita === cita.id, "La respuesta queda registrada y asociada a esa reserva.");
      k.chk(s.c.encuestas.resumen().respuestas === 0, "No se mezcla con las respuestas de la encuesta posterior a la atención, que se guardan aparte.");
      const r2 = await (await s.form("/agendar/encuesta", { t, nota: "1" })).text();
      k.chk(/Ya respondiste la encuesta de esta reserva/.test(r2) && s.c.extras.listar("encuestasAgendamiento").length === 1, "No se puede responder dos veces por la misma reserva.");
      k.chk((await s.c.citaRepo.buscarPorId(cita.id)).estadoReserva === "ACTIVA", "Responder (o no responder) la encuesta no altera la hora reservada: es voluntaria.");
      return k.ok ? "Al confirmar la reserva web se ofrece una encuesta voluntaria sobre el agendamiento, distinta en texto, ruta y almacenamiento de la encuesta posterior a la atención; se responde una sola vez y no afecta la reserva." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-39": { req: "RNF03", titulo: "Seguridad: roles, consulta protegida y consentimiento", async run(k) {
    const s = await sitio();
    try {
      k.chk((await s.req("/admin/agendas", s.t)).status === 403, "Acceso fuera del rol rechazado (TENS/TONS → Administración: 403).");
      const soloRut = await (await s.form("/paciente/consulta", { rut: A })).text();
      k.chk(/No pudimos verificar/.test(soloRut) && !/VIGENTE ·/.test(soloRut), "La consulta por RUT exige verificar la identidad.");
      const bien = await (await s.form("/paciente/consulta", { rut: A, fechaNacimiento: "1980-01-01", celular4: "1111" })).text();
      k.chk(/VIGENTE ·/.test(bien) && !bien.includes(await nombreDe(s.c, B)), "Con datos correctos muestra solo la reserva propia.");
      for (let i = 0; i < 3; i++) await s.form("/paciente/consulta", { rut: "1-9" });
      k.chk((await s.form("/paciente/consulta", { rut: "1-9" })).status === 429, "Los intentos repetidos se limitan.");
      const N = "30123456-2";
      k.paso(`Una paciente nueva (${N}) reserva por la web, completa sus datos y acepta el tratamiento de datos.`);
      await reservaWeb(s, N, { nuevo: { nombres: "Paciente", apellidos: "Nueva", fechaNacimiento: "1990-01-01", genero: "FEMENINO", nacionalidad: "Chilena", telefono: "+56911112222", tieneWhatsapp: "1", correo: "", direccion: "Calle 1", idComuna: "1" } });
      const meta = s.c.operacion.meta.pacientes[N] || {};
      const cons = meta.consentimiento || {};
      const enAuditoria = s.c.auditoria.listar().some((x) => /consentimiento/i.test(`${x.accion} ${x.detalle}`));
      k.dato("Consentimiento guardado (fecha / canal / auditoría)", `${cons.fecha || "—"} / ${cons.canal || "—"} / ${enAuditoria ? "sí" : "no"}`);
      const registrado = !!(cons.fecha && cons.canal && enAuditoria);
      k.chk(registrado, "El consentimiento queda registrado.");
      return k.ok ? "Acceso fuera de rol rechazado (403); la consulta por RUT exige verificación, muestra solo la reserva propia y limita intentos (429); el consentimiento aceptado al reservar por la web quedó registrado con fecha y canal en el paciente y en la auditoría." : "Acceso fuera de rol rechazado (403), la consulta exige verificación, muestra solo la reserva propia y limita intentos (429); pero el consentimiento aceptado al reservar por la web no queda registrado (no se guarda en el paciente ni en la auditoría).";
    } finally { await s.cerrar(); }
  } },

  "CP-40": { req: "RNF04", titulo: "Concurrencia: sin doble reserva", async run(k) {
    const c = crearContenedor();
    const b = await bloqueLibre(c, { idPoliclinico: 1 });
    const ruts = [A, B, C];
    k.paso(`10 sesiones simultáneas × 10 intentos = 100 intentos concurrentes sobre el cupo ${b.id}.`);
    const t0 = Date.now();
    const res = await Promise.allSettled(Array.from({ length: 100 }, (_, i) => c.agendamiento.agendar({ rut: ruts[i % 3], idBloque: b.id, idUsuario: `sesion-${Math.floor(i / 10) + 1}` })));
    const ok = res.filter((r) => r.status === "fulfilled").length;
    const errores = {};
    for (const r of res) if (r.status === "rejected") errores[r.reason.message] = (errores[r.reason.message] || 0) + 1;
    const activas = (await c.citaRepo.listar()).filter((x) => x.idBloque === b.id && x.estadoReserva === "ACTIVA").length;
    k.dato("Intentos exitosos / rechazados", `${ok} / ${100 - ok}`);
    k.dato("Motivos de rechazo", errores);
    k.dato("Duración", `${Date.now() - t0} ms`);
    k.chk(activas === 1 && ok === 1, "Una sola reserva activa para el bloque (0 dobles reservas).");
    return k.ok ? `De 100 intentos concurrentes, 1 creó la reserva y 99 fueron rechazados (${Object.entries(errores).map(([e, n]) => `${e}: ${n}`).join(", ")}); 0 dobles reservas. Ejecutado en modo memoria; la doble reserva en PostgreSQL embebido se verifica con npm run test:postgres-embebido.` : null;
  } },

  "CP-41": { req: "RNF05", titulo: "Cambio de estado visible en los tres perfiles", async run(k) {
    const s = await sitio();
    try {
      k.paso("TENS/TONS marca la cita 1 como «Confirmada» y se consulta desde los tres perfiles.");
      const t0 = Date.now();
      await s.req("/tens/flujo", s.t, { idCita: "1", estado: "Confirmada" });
      const pac = await (await s.form("/paciente/consulta", { rut: A, fechaNacimiento: "1980-01-01", celular4: "1111" })).text();
      const tens = await (await s.req("/tens/reserva?idCita=1", s.t)).text();
      const adm = await (await s.req("/admin/cupo?idCita=1", s.a)).text();
      const ms = Date.now() - t0;
      k.chk(/ASISTENCIA CONFIRMADA/.test(pac), "Paciente: la consulta muestra «Asistencia confirmada».");
      k.chk(/Confirmada/.test(tens), "TENS/TONS: la reserva muestra «Confirmada».");
      const agenda = await (await s.req(`/admin/agendas?prof=1&fecha=${(await s.c.catalogo.bloque(1)).fecha}`, s.a)).text();
      const fila = (agenda.match(/[^<>]*<\/[^>]+>\s*<[^>]+>[^<]*Paciente de prueba A/) || [""])[0];
      k.dato("Administración — detalle del cupo de la cita 1", (adm.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/Estado \S+/) || ["—"])[0]);
      k.chk(/Confirmada/.test(adm.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "")) || /Confirmada/.test(fila), "Administración: la reserva muestra «Confirmada».");
      k.dato("Tiempo total hasta verlo en los tres perfiles", `${ms} ms`);
      k.chk(ms <= 5000, "El cambio se ve en ≤ 5 s.");
      return k.ok ? `El cambio a «Confirmada» se vio en Pacientes, TENS/TONS y Administración en ${ms} ms (criterio ≤ 5 s), en entorno local.` : `El cambio a «Confirmada» se vio en ${ms} ms en Pacientes («Asistencia confirmada») y en TENS/TONS, pero Administración (agenda y detalle del cupo) sigue mostrando «Reservado» sin el estado de confirmación.`;
    } finally { await s.cerrar(); }
  } },

  "CP-44": { req: "RF04", titulo: "Reserva web y bloque ya tomado", async run(k) {
    const s = await sitio();
    try {
      k.paso("Dos personas eligen por la web la misma hora; la primera confirma antes.");
      const ini = await s.form("/agendar", { rut: A, lugar: "1", modo: "esp", esp: "Medicina General", consentimiento: "1" });
      const t2 = new URL(ini.headers.get("location"), s.base).searchParams.get("t");
      const libre = Number((await (await fetch(`${s.base}/agendar/calendario?t=${t2}`)).text()).match(/bloque=(\d+)/)[1]);
      await fetch(`${s.base}/agendar/datos?t=${t2}&bloque=${libre}`);
      await s.form("/agendar/datos", { t: t2 });
      const { cita } = await reservaWeb(s, C, { bloque: libre });
      k.chk(cita && cita.estadoReserva === "ACTIVA", `La primera reserva web queda registrada (cita ${cita?.id}).`);
      const r = await s.form("/agendar/confirmar", { t: t2 });
      const h = await r.text();
      k.dato("Respuesta al segundo intento", `HTTP ${r.status}`);
      const activas = (await s.c.citaRepo.listar()).filter((x) => x.idBloque === libre && x.estadoReserva === "ACTIVA");
      k.chk(r.status === 409 && /ya no está disponible/.test(h), "La segunda reserva es rechazada con aviso «Esa hora ya no está disponible».");
      k.chk(activas.length === 1, "No se crea una cita duplicada.");
      return k.ok ? `La primera reserva web (cita ${cita.id}) quedó registrada; la segunda persona, al confirmar la misma hora, recibió «Esa hora ya no está disponible» (HTTP 409) y siguió habiendo una sola cita activa.` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-45": { req: "RF28", titulo: "Comprobante y consulta sin código", async run(k) {
    const s = await sitio();
    try {
      const { html } = await reservaWeb(s, C);
      const visible = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "");
      k.chk(!/c[oó]digo( de reserva)?\s*:\s*[A-Z0-9][A-Z0-9-]{3,}|name="codigo"/.test(visible) && /No tiene código/.test(visible), "El comprobante en pantalla no muestra ni solicita un código (indica «No tiene código»).");
      const form = await (await s.req("/paciente/consulta")).text();
      k.chk(!/name="codigo"/i.test(form) && /name="fechaNacimiento"/.test(form) && /name="celular4"/.test(form), "La consulta posterior pide RUT y datos de verificación, no un código.");
      return k.ok ? "El comprobante no muestra ni pide código; la consulta posterior se hace con RUT, fecha de nacimiento y últimos 4 dígitos del celular, sin código." : null;
    } finally { await s.cerrar(); }
  } },

  "CP-26": { req: "RF26", titulo: "Respaldos cargados por el paciente, privados y revisados por TENS/TONS", async run(k) {
    const s = await sitio();
    try {
      const cuenta = await cuentaDe(s, A, "1980-01-01", "1111");
      const pdf = (txt) => new Blob([Buffer.from(`%PDF-1.4 ${txt}`)], { type: "application/pdf" });
      k.paso("El paciente A, con su cuenta, carga una Cartola FONASA (PDF) y luego la reemplaza.");
      await cuenta.multi("/paciente/mis-documentos", { rut: A, tipo: "Cartola FONASA", archivo: [pdf("v1"), "fonasa-2026.pdf"] });
      const d1 = s.c.documentos.listar().find((d) => d.rut === A && d.tipo === "Cartola FONASA");
      const h = await cuenta.multi("/paciente/mis-documentos", { rut: A, tipo: "Cartola FONASA", reemplazar: String(d1.id), archivo: [pdf("v2"), "fonasa-2026-b.pdf"] });
      const d2 = s.c.documentos.listar().find((d) => d.rut === A && d.tipo === "Cartola FONASA" && !d.archivado);
      k.dato("Documentos", s.c.documentos.listar().filter((d) => d.rut === A).map((d) => `${d.id} ${d.tipo} ${d.adjunto?.original} archivado=${!!d.archivado}`));
      k.chk(/Documento reemplazado/.test(h) && s.c.documentos.listar().find((d) => d.id === d1.id).archivado && d2 && d2.id !== d1.id, "El reemplazo deja el anterior archivado y el nuevo vigente.");
      const sinSesion = await fetch(`${s.base}/paciente/mis-documentos/archivo?id=${d2.id}`, { redirect: "manual" });
      const otro = await fetch(`${s.base}/tens/documentos/archivo?id=${d2.id}`, { redirect: "manual" });
      k.dato("Descarga sin sesión (portal / personal)", `${sinSesion.status} / ${otro.status}`);
      k.chk(sinSesion.status === 302 && otro.status === 302 && !fs.existsSync(path.join(__dirname, "../public/img", d2.adjunto.guardado)), "El archivo es privado: sin sesión no se descarga y no tiene enlace público.");
      const r = await s.req(`/tens/documentos/archivo?id=${d2.id}`, s.t);
      k.chk(r.status === 200 && (r.headers.get("content-type") || "").includes("pdf"), "TENS/TONS de su policlínico lo descarga.");
      await s.req("/tens/documentos/verificar", s.t, { id: String(d2.id) });
      const v = s.c.documentos.listar().find((d) => d.id === d2.id);
      k.chk(v.verificado && !!v.verificadoPor, `TENS/TONS lo revisa (verificado por ${v.verificadoPor}).`);
      return k.ok ? `El paciente cargó y reemplazó su Cartola FONASA (la anterior quedó archivada); el archivo no tiene enlace público ni se descarga sin sesión; TENS/TONS lo descargó y lo marcó revisado.` : null;
    } finally { await s.cerrar(); }
  } },

  "CP-46": { req: "RF37", titulo: "Cuenta opcional del paciente y acceso a familiares", async run(k) {
    const s = await sitio();
    try {
      const c = s.c;
      await c.pacientes.crear({ rut: "44444444-4", nombres: "Responsable", apellidos: "Prueba", fechaNacimiento: "1985-02-02", genero: "FEMENINO", telefono: "+56944444444", direccion: "Calle 4", idComuna: 1, consentimiento: true });
      const clave = "una clave suficientemente larga";
      const malo = await s.form("/paciente/cuenta/acceso", { modo: "crear", rut: "44444444-4", fechaNacimiento: "1985-02-03", celular4: "4444", clave, confirmarClave: clave, acepto: "1" });
      k.chk(malo.status === 400, "Con un dato de verificación incorrecto no se crea la cuenta.");
      const cuenta = await cuentaDe(s, "44444444-4", "1985-02-02", "4444", clave);
      k.chk(!!cuenta.ck, "Con RUT, fecha de nacimiento y 4 dígitos del celular se crea la cuenta e inicia sesión.");
      const secciones = {};
      for (const [n, r] of [["Mis horas", "/paciente/mis-horas"], ["Mis datos", "/paciente/mis-datos"], ["Mis documentos", "/paciente/mis-documentos"], ["Familiares", "/paciente/familiares"]]) secciones[n] = (await cuenta.get(r)).status;
      k.dato("Secciones (HTTP)", secciones);
      k.chk(Object.values(secciones).every((x) => x === 200), "Abre Mis horas, Mis datos, Mis documentos y Familiares.");
      const fam = await (await cuenta.get("/paciente/familiares")).text();
      k.chk(fam.includes(await nombreDe(c, C)) && !fam.includes(await nombreDe(c, A)), "Familiares muestra solo a la menor vinculada (su ficha la registra como responsable).");
      await cuenta.post("/paciente/familiares/solicitar", { rutFamiliar: A, relacion: "Hijo" });
      const fam2 = await (await cuenta.get("/paciente/familiares")).text();
      const ajena = await cuenta.get("/paciente/comprobante.pdf?idCita=1");
      k.chk(!fam2.includes(await nombreDe(c, A)) && ajena.status === 403, "Un RUT conocido sin vínculo no da acceso (solicitud registrada, sin acceso; comprobante ajeno 403).");
      const nueva = "otra clave suficientemente larga";
      await s.form("/paciente/cuenta/acceso", { modo: "recuperar", rut: "44444444-4", fechaNacimiento: "1985-02-02", celular4: "4444", clave: nueva, confirmarClave: nueva });
      const vieja = await s.form("/paciente/cuenta/acceso", { modo: "ingresar", rut: "44444444-4", clave });
      const ok = await s.form("/paciente/cuenta/acceso", { modo: "ingresar", rut: "44444444-4", clave: nueva });
      k.dato("Ingreso con clave anterior / nueva", `${vieja.status} / ${ok.status}`);
      k.chk(vieja.status === 401 && ok.status === 302, "Recuperar la contraseña la reemplaza: la anterior deja de servir.");
      return k.ok ? "La cuenta se creó solo tras verificar la identidad; mostró Mis horas, Mis datos, Mis documentos y Familiares; solo aparece la familiar vinculada y un RUT conocido sin vínculo no dio acceso; la recuperación cambió la contraseña." : null;
    } finally { await s.cerrar(); }
  } },

};

// Reserva completa por el portal del paciente (flujo en 4 pasos); devuelve el HTML del comprobante, la cita y el token.
async function reservaWeb(s, rut, { bloque, nuevo } = {}) {
  const ini = await s.form("/agendar", { rut, lugar: "1", modo: "esp", esp: "Medicina General", consentimiento: "1", comunicaciones: "1" });
  const t = new URL(ini.headers.get("location"), s.base).searchParams.get("t");
  const cal = await (await fetch(`${s.base}/agendar/calendario?t=${t}`)).text();
  const id = bloque || Number(cal.match(/bloque=(\d+)/)[1]);
  await fetch(`${s.base}/agendar/datos?t=${t}&bloque=${id}`);
  await s.form("/agendar/datos", { t, ...(nuevo || {}) });
  const html = await (await s.form("/agendar/confirmar", { t })).text();
  const cita = (await s.c.citaRepo.buscarPorRut(rut)).find((x) => x.idBloque === id && x.estadoReserva === "ACTIVA");
  return { html, cita, t, bloque: id };
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const resumen = {};
  const solo = process.argv.slice(3);
  for (const [id, cp] of Object.entries(CASOS)) {
    if (solo.length && !solo.includes(id)) continue;
    const k = caso();
    const inicio = textoLocal();
    let obtenido, estado;
    try {
      const r = await cp.run(k);
      estado = k.ok ? "Aprobada" : "Fallida";
      obtenido = r || "Ver detalle en la evidencia.";
    } catch (e) {
      k.chk(false, `Error durante la ejecución: ${e.message}`);
      estado = "Fallida";
      obtenido = `Error durante la ejecución: ${e.message}`;
    }
    const archivo = `EV-${id}.txt`;
    const texto = [
      `EVIDENCIA ${archivo.replace(".txt", "")} — ${id} (${cp.req})`,
      `Prueba: ${cp.titulo}`,
      `Sistema: Hermandad de Dolores — gestión de citas (versión del repositorio local)`,
      `Entorno: servidor HTTP local (127.0.0.1), datos ficticios en memoria; Node ${process.version}`,
      `Ejecutada: ${inicio} (hora de Chile)`,
      `Script: scripts/evidencias-matriz.js`,
      "",
      "Pasos y verificaciones:",
      ...k.log,
      "",
      `Resultado obtenido: ${obtenido}`,
      `ESTADO: ${estado.toUpperCase()}`,
      "",
    ].join("\n");
    fs.writeFileSync(path.join(SALIDA, archivo), texto);
    resumen[id] = { req: cp.req, estado, obtenido, archivo, fecha: inicio };
    console.log(`${estado === "Aprobada" ? "✔" : "✘"} ${id} ${estado}`);
  }
  fs.writeFileSync(path.join(SALIDA, "_resumen.json"), JSON.stringify(resumen, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");
const { BOTONES } = require("../src/services/BotWhatsAppServicio");

const A = "11111111-1";
const USUARIO = { id: "u2", nombre: "TENS", rol: "TENS_TONS", idPoliclinico: 1 };

const consentir = (c, rut, valor = true) => {
  (c.operacion.meta.pacientes[rut] ||= {}).consentimientoComunicaciones = valor;
};
const bandeja = (c) => c.extras.listar("bandeja").filter((b) => b.direccion === "SALIENTE");

async function aplicacion() {
  const c = crearContenedor();
  await c.inicializar();
  return c;
}

async function comprobanteDeCita1(c, canalDeReserva, canalMensaje = "WhatsApp") {
  const cita = await c.citaRepo.buscarPorId(1);
  await c.citaRepo.actualizar({ ...cita, canal: canalDeReserva });
  consentir(c, cita.rut);
  if (canalMensaje === "Correo") await c.catalogo.actualizarPaciente(cita.rut, { ...(await c.catalogo.paciente(cita.rut)), correo: "paciente.a@ejemplo.cl" });
  const m = await c.operacion.comunicar(USUARIO, await c.citaRepo.buscarPorId(1), canalMensaje, "Comprobante de reserva");
  await c.despachador.procesar();
  return { cita, m };
}

async function sitio(c) {
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const entrar = async (correo) => {
    const r = await fetch(base + "/login", { method: "POST", redirect: "manual", body: new URLSearchParams({ correo, clave: "demo1234" }) });
    return r.headers.get("set-cookie").split(";")[0];
  };
  const tens = await entrar("tens@ejemplo.cl");
  return {
    base,
    get: (ruta, ck) => fetch(base + ruta, ck ? { headers: { Cookie: ck } } : undefined).then(async (x) => ({ estado: x.status, html: await x.text() })),
    post: (ruta, d, ck) => fetch(base + ruta, { method: "POST", redirect: "manual", headers: ck ? { Cookie: ck } : {}, body: new URLSearchParams(d) }).then(async (x) => ({ estado: x.status, html: await x.text() })),
    tens,
    cerrar: () => new Promise((r) => srv.close(r)),
  };
}

test("Comprobante de una reserva por la página: trae el enlace a la encuesta y no pide confirmar todavía", async () => {
  const c = await aplicacion();
  await comprobanteDeCita1(c, "WEB");
  const [mensaje] = bandeja(c);
  assert.deepEqual(mensaje.botones, []);
  assert.equal(mensaje.encuestaReserva, true);
});

test("Comprobante de una reserva hecha por TENS/TONS: sin botones y sin encuesta", async () => {
  const c = await aplicacion();
  await comprobanteDeCita1(c, "PRESENCIAL");
  const [mensaje] = bandeja(c);
  assert.deepEqual(mensaje.botones, []);
  assert.notEqual(mensaje.encuestaReserva, true);
});

test("Por correo solo llega el comprobante (con la encuesta si la reserva fue por la página), sin botones", async () => {
  const c = await aplicacion();
  await comprobanteDeCita1(c, "WEB", "Correo");
  const [mensaje] = bandeja(c);
  assert.equal(mensaje.canal, "Correo");
  assert.deepEqual(mensaje.botones, []);
  assert.equal(mensaje.encuestaReserva, true);
});

test("Cuando TENS/TONS agenda una hora, el paciente con consentimiento recibe el comprobante", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    consentir(c, A);
    const [libre] = await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1, especialidad: "Medicina General" });
    await s.post("/tens/agendar", { rut: A, idBloque: libre.id }, s.tens);
    const nueva = (await c.citaRepo.buscarPorRut(A)).find((x) => x.idBloque === libre.id);
    assert.ok(nueva, "la cita se creó");
    const comprobante = bandeja(c).find((b) => b.idCita === nueva.id && b.tipo === "Comprobante de reserva");
    assert.ok(comprobante, "el comprobante salió automáticamente");
    assert.deepEqual(comprobante.botones, []);
  } finally { await s.cerrar(); }
});

test("Si el paciente no dio consentimiento, TENS/TONS agenda y no sale ningún mensaje", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    consentir(c, A, false);
    const [libre] = await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1, especialidad: "Medicina General" });
    await s.post("/tens/agendar", { rut: A, idBloque: libre.id }, s.tens);
    assert.equal(bandeja(c).length, 0);
  } finally { await s.cerrar(); }
});

test("TENS/TONS no envía mensajes: no hay «Crear recordatorio» ni «Reenviar», y el envío manual se rechaza", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    consentir(c, A);
    await comprobanteDeCita1(c, "WEB");
    const antes = c.extras.listar("comunicaciones").length;
    const pantalla = await s.get("/tens/comunicaciones", s.tens);
    assert.doesNotMatch(pantalla.html, /Crear recordatorio/);
    assert.doesNotMatch(pantalla.html, /action="\/tens\/comunicacion"/);
    await s.post("/tens/comunicacion", { idCita: 1, canal: "WhatsApp", tipo: "Recordatorio" }, s.tens);
    assert.equal(c.extras.listar("comunicaciones").length, antes, "no se creó ningún mensaje");
  } finally { await s.cerrar(); }
});

test("Página aparte de mensajes: se abre sin iniciar sesión, sin menú del personal, y muestra el chat de WhatsApp", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB");
    const indice = await s.get("/demo/mensajes");
    assert.equal(indice.estado, 200);
    assert.doesNotMatch(indice.html, /class="side"/, "no es una pantalla del personal");
    assert.match(indice.html, /href="\/demo\/mensajes\?rut=11111111-1/);
    const chat = await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`);
    assert.equal(chat.estado, 200);
    assert.match(chat.html, /data-canal="whatsapp"/);
    assert.match(chat.html, /su hora quedó reservada/);
    assert.match(chat.html, /href="\/demo\/mensajes\/encuesta\?/, "trae el enlace a la encuesta");
    assert.doesNotMatch(chat.html, /class="side"/);
  } finally { await s.cerrar(); }
});

test("Página aparte: el correo se ve como una bandeja de entrada con asunto, remitente y cuerpo", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB", "Correo");
    const correo = await s.get(`/demo/mensajes?rut=${A}&canal=correo`);
    assert.equal(correo.estado, 200);
    assert.match(correo.html, /data-canal="correo"/);
    assert.match(correo.html, /Comprobante de reserva/);
    assert.match(correo.html, /su hora quedó reservada/);
  } finally { await s.cerrar(); }
});

test("Página aparte: Confirmar desde el chat confirma la hora y Cancelar la cancela", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB");
    await s.post("/demo/mensajes/avanzar", { rut: A });
    const chat = await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`);
    const id = chat.html.match(/name="id" value="(b-\d+)"/)[1];
    await s.post("/demo/mensajes/responder", { rut: A, id, canal: "WhatsApp", decision: BOTONES[0] });
    assert.equal((await c.citaRepo.buscarPorId(1)).estadoConfirmacion, "CONFIRMADA");
  } finally { await s.cerrar(); }
});

test("Página aparte: la encuesta de la reserva por la página se responde desde el mensaje", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB");
    const chat = await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`);
    const id = chat.html.match(/encuesta\?[^"]*id=(b-\d+)/)[1];
    const formulario = await s.get(`/demo/mensajes/encuesta?rut=${A}&id=${id}`);
    assert.equal(formulario.estado, 200);
    assert.match(formulario.html, /name="nota"/);
    await s.post("/demo/mensajes/encuesta", { rut: A, id, nota: "5", comentario: "Fue fácil" });
    const respuestas = c.extras.listar("encuestasAgendamiento");
    assert.equal(respuestas.length, 1);
    assert.equal(respuestas[0].idCita, 1);
    assert.equal(respuestas[0].canal, "WhatsApp");
    const otra = await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`);
    assert.match(otra.html, /Encuesta respondida/);
  } finally { await s.cerrar(); }
});

test("Página aparte: con envío real de mensajes (no simulado) la página no existe", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    c.despachador.transportes.WhatsApp = { simulado: false, enviar: async () => ({}) };
    c.despachador.transportes.Correo = null;
    assert.equal((await s.get("/demo/mensajes")).estado, 404);
  } finally { await s.cerrar(); }
});

test("Los mensajes traen el detalle de la cita en líneas: Día, Hora, Lugar y Atención", async () => {
  const c = await aplicacion();
  await comprobanteDeCita1(c, "WEB");
  const [mensaje] = bandeja(c);
  assert.match(mensaje.texto, /Hermandad de Dolores: su hora quedó reservada\./);
  for (const linea of ["Día", "Hora", "Lugar", "Atención"]) assert.match(mensaje.texto, new RegExp(`\\*${linea}:\\*`));
  assert.match(mensaje.texto, /comprobante/);
});

test("Primero llega el comprobante y después, el día antes, la confirmación con Confirmar y Cancelar (solo WhatsApp)", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB");
    const antes = await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`);
    assert.doesNotMatch(antes.html, /class="dm-wa-boton"[^>]*>\s*Confirmar/, "el comprobante no trae botones de confirmación");
    await s.post("/demo/mensajes/avanzar", { rut: A });
    const despues = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`)).html;
    assert.ok(despues.indexOf("su hora quedó reservada") < despues.indexOf("¿Confirma su asistencia?"), "primero el comprobante, luego la confirmación");
    assert.match(despues, /<button[^>]*class="dm-wa-boton"[^>]*>Confirmar<\/button>/);
    assert.match(despues, /<button[^>]*class="dm-wa-boton"[^>]*>Cancelar mi hora<\/button>/);
  } finally { await s.cerrar(); }
});

test("Por correo no hay confirmación ni recordatorio: avanzar no envía nada y el correo no trae botones", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB", "Correo");
    await c.catalogo.actualizarPaciente(A, { ...(await c.catalogo.paciente(A)), tieneWhatsapp: false });
    const antes = bandeja(c).length;
    const r = await s.post("/demo/mensajes/avanzar", { rut: A });
    assert.equal(bandeja(c).length, antes, "no salió ningún mensaje nuevo");
    assert.ok(r.estado < 400);
    const correo = (await s.get(`/demo/mensajes?rut=${A}&canal=correo`)).html;
    assert.doesNotMatch(correo, />Confirmar</);
    assert.doesNotMatch(correo, /Cancelar mi hora/);
    assert.match(correo, /<strong>Día:<\/strong>/);
    assert.match(correo, /comprobante-de-reserva\.pdf/);
  } finally { await s.cerrar(); }
});

test("Se puede escribir en el chat: «Confirmar» actúa como el botón y el bot responde", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB");
    await s.post("/demo/mensajes/avanzar", { rut: A });
    await s.post("/demo/mensajes/enviar", { rut: A, texto: "confirmar" });
    assert.equal((await c.citaRepo.buscarPorId(1)).estadoConfirmacion, "CONFIRMADA");
    const chat = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`)).html;
    assert.match(chat, /class="dm-burbuja dm-propia"[\s\S]*Confirmar/);
    assert.match(chat, /Gracias\. Su hora quedó confirmada\./);
    assert.match(chat, /class="dm-checks"/, "lo que envía el paciente lleva doble check");
  } finally { await s.cerrar(); }
});

test("Cualquier otro texto recibe la ayuda del bot y no cambia la cita; el HTML se escapa", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB");
    await s.post("/demo/mensajes/enviar", { rut: A, texto: "<b>hola</b>" });
    assert.equal((await c.citaRepo.buscarPorId(1)).estadoConfirmacion, "PENDIENTE");
    const chat = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`)).html;
    assert.match(chat, /&lt;b&gt;hola&lt;\/b&gt;/);
    assert.doesNotMatch(chat, /<b>hola<\/b>/);
    assert.match(chat, /Para responder use los botones/);
    const antes = c.extras.listar("bandeja").length;
    await s.post("/demo/mensajes/enviar", { rut: A, texto: "   " });
    assert.equal(c.extras.listar("bandeja").length, antes, "un texto vacío no envía nada");
  } finally { await s.cerrar(); }
});

test("El chat se ve como WhatsApp: cabecera con llamadas, chip «Hoy», negritas y barra para escribir", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB");
    const chat = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`)).html;
    assert.match(chat, /aria-label="Videollamada"/);
    assert.match(chat, /aria-label="Llamada"/);
    assert.match(chat, /en línea/);
    assert.match(chat, /class="dm-dia">Hoy</);
    assert.match(chat, /<strong>Día:<\/strong>/);
    assert.match(chat, /<form[^>]*action="\/demo\/mensajes\/enviar"[\s\S]*name="texto"/);
    assert.match(chat, /aria-label="Micrófono"|aria-label="Enviar"/);
  } finally { await s.cerrar(); }
});

test("WhatsApp vacío: si el paciente no tiene WhatsApp, el teléfono lo explica y lleva al correo", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB", "Correo");
    await c.catalogo.actualizarPaciente(A, { ...(await c.catalogo.paciente(A)), tieneWhatsapp: false });
    const chat = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`)).html;
    assert.match(chat, /class="dm-vacio-wa"/);
    assert.match(chat, /no tiene WhatsApp registrado/);
    assert.match(chat, /href="\/demo\/mensajes\?rut=11111111-1&amp;canal=correo"/);
    assert.doesNotMatch(chat, /Sin mensajes de WhatsApp\./);
  } finally { await s.cerrar(); }
});

test("WhatsApp vacío: si el paciente no aceptó recibir avisos, lo explica", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    consentir(c, A, false);
    const chat = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp`)).html;
    assert.match(chat, /class="dm-vacio-wa"/);
    assert.match(chat, /no aceptó recibir avisos/);
  } finally { await s.cerrar(); }
});

test("Simular el aviso del bot dice la verdad: sin WhatsApp o sin consentimiento no pretende haber enviado nada", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    await comprobanteDeCita1(c, "WEB", "Correo");
    await c.catalogo.actualizarPaciente(A, { ...(await c.catalogo.paciente(A)), tieneWhatsapp: false });
    const antes = c.extras.listar("bandeja").length;
    let r = await s.post("/demo/mensajes/avanzar", { rut: A });
    assert.equal(c.extras.listar("bandeja").length, antes);
    let pagina = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp&aviso=sin-whatsapp`)).html;
    assert.match(pagina, /no tiene WhatsApp registrado/);
    assert.doesNotMatch(pagina, /El bot envió/);
    await c.catalogo.actualizarPaciente(A, { ...(await c.catalogo.paciente(A)), tieneWhatsapp: true });
    consentir(c, A, false);
    pagina = (await s.get(`/demo/mensajes?rut=${A}&canal=whatsapp&aviso=sin-consentimiento`)).html;
    assert.match(pagina, /no aceptó recibir avisos/);
    assert.ok(r.estado < 400);
  } finally { await s.cerrar(); }
});

test("Avanzar redirige con el motivo real según el paciente", async () => {
  const c = await aplicacion();
  const s = await sitio(c);
  try {
    consentir(c, A, false);
    let r = await fetch(`${s.base}/demo/mensajes/avanzar`, { method: "POST", redirect: "manual", body: new URLSearchParams({ rut: A }) });
    assert.match(r.headers.get("location"), /aviso=sin-consentimiento/);
    await c.catalogo.actualizarPaciente(A, { ...(await c.catalogo.paciente(A)), tieneWhatsapp: false });
    r = await fetch(`${s.base}/demo/mensajes/avanzar`, { method: "POST", redirect: "manual", body: new URLSearchParams({ rut: A }) });
    assert.match(r.headers.get("location"), /aviso=sin-whatsapp/);
  } finally { await s.cerrar(); }
});

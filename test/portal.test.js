'use strict';
// Portal del paciente: reserva en 4 pasos, comprobante PDF, datos recordados con verificación y cuenta opcional.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { crearContenedor } = require('../src/contenedor');
const { crearServidor } = require('../src/server');

async function levantar() {
  process.env.DIR_DOCUMENTOS = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-docs-'));
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  // Cliente con su propia cookie de paciente.
  const cliente = () => {
    let ck = '';
    const req = async (ruta, datos, multi) => {
      let body;
      if (multi) { body = new FormData(); for (const [k, v] of Object.entries(datos)) v && v.blob ? body.append(k, v.blob, v.nombre) : body.append(k, v); }
      else if (datos) body = new URLSearchParams(datos);
      const r = await fetch(base + ruta, { method: datos ? 'POST' : 'GET', body, redirect: 'manual', headers: ck ? { Cookie: ck } : {} });
      const sc = r.headers.get('set-cookie');
      if (sc && sc.startsWith('psid=')) ck = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
      return r;
    };
    return { req, texto: async (ruta, datos, multi) => (await req(ruta, datos, multi)).text() };
  };
  const cerrar = async () => { await new Promise((r) => srv.close(r)); fs.rmSync(process.env.DIR_DOCUMENTOS, { recursive: true, force: true }); delete process.env.DIR_DOCUMENTOS; };
  return { c, base, cliente, cerrar };
}
const tokenDe = (r) => new URL(r.headers.get('location'), 'http://x').searchParams.get('t');
const NUEVO = { nombres: 'Ana', apellidos: 'Prueba', fechaNacimiento: '1990-01-01', genero: 'FEMENINO', nacionalidad: 'Chilena', telefono: '+56911112222', tieneWhatsapp: '1', correo: '', direccion: 'Calle 1', idComuna: '1' };

test('portal: la página principal abre en Reservar hora y admite un policlínico preseleccionado', async () => {
  const s = await levantar();
  try {
    const h = await s.cliente().texto('/');
    assert.match(h, /Reserva tu hora/);
    assert.match(h, /name="rut"/);
    assert.match(h, /href="\/paciente\/cuenta"[^>]*>Iniciar sesión/);
    assert.match(await s.cliente().texto('/?lugar=2'), /<option value="2" selected/);
  } finally { await s.cerrar(); }
});

test('portal: el formulario de reserva pide RUT y lugar', async () => {
  const s = await levantar();
  try {
    const h = await s.cliente().texto('/agendar');
    assert.match(h, /Reserva tu hora/);
    assert.match(h, /name="rut"/);
    assert.match(h, /name="lugar"/);
    assert.match(h, /Toda la red/);
    assert.match(h, /Telemedicina/);
    assert.match(h, /href="\/paciente\/cuenta"[^>]*>Iniciar sesión/);
  } finally { await s.cerrar(); }
});

test('portal: validaciones del primer paso y especialidades según el lugar', async () => {
  const s = await levantar();
  try {
    const p = s.cliente();
    const base = { rut: '12.345.678-5', lugar: 'red', modo: 'esp', esp: 'Medicina General', consentimiento: '1' };
    assert.match(await p.texto('/agendar', { ...base, rut: '1-9' }), /Revisa el RUT/);
    assert.match(await p.texto('/agendar', { ...base, consentimiento: '' }), /aceptar el tratamiento/);
    assert.match(await p.texto('/agendar', { ...base, lugar: '2', esp: 'Ecografías' }), /especialidad disponible en el lugar/);
    assert.match(await p.texto('/agendar', { ...base, modo: 'prof', prof: '3', lugar: '1' }), /profesional que atienda en el lugar/);
    const r = await p.req('/agendar', base);
    assert.strictEqual(r.status, 302);
    assert.ok(!r.headers.get('location').includes('12345678'), 'el RUT no viaja en la dirección');
  } finally { await s.cerrar(); }
});

test('portal: calendario mensual con días disponibles, búsqueda por profesional y parámetros raros', async () => {
  const s = await levantar();
  try {
    const p = s.cliente();
    const t = tokenDe(await p.req('/agendar', { rut: '33333333-3', lugar: '1', modo: 'prof', prof: '1', consentimiento: '1' }));
    const h = await p.texto(`/agendar/calendario?t=${t}`);
    assert.match(h, /class="mes-g"/);
    const ids = [...h.matchAll(/bloque=(\d+)/g)].map((m) => Number(m[1]));
    assert.ok(ids.length > 0, 'muestra horas del primer día disponible');
    for (const id of ids) assert.strictEqual((await s.c.catalogo.bloque(id)).idProfesional, 1, 'solo horas del profesional buscado');
    for (const q of ['mes=basura&dia=x', 'mes=2030-01', 'mes=1999-01', 'dia=2026-13-40']) assert.strictEqual((await p.req(`/agendar/calendario?t=${t}&${q}`)).status, 200, q);
    // Telemedicina devuelve solo horas propias.
    const t2 = tokenDe(await p.req('/agendar', { rut: '33333333-3', lugar: '7', modo: 'esp', esp: (await s.c.catalogo.profesionales()).find((x) => x.idPoliclinico === 7).especialidad, consentimiento: '1' }));
    const h2 = await p.texto(`/agendar/calendario?t=${t2}`);
    assert.match(h2, /Videoconsulta/);
    assert.doesNotMatch(h2, /Presencial<\/span>/);
    // Token inválido vuelve al inicio.
    assert.strictEqual((await p.req('/agendar/calendario?t=falso')).headers.get('location'), '/agendar');
  } finally { await s.cerrar(); }
});

test('portal: paciente nuevo completa datos y documentos, confirma, obtiene PDF y queda registro con consentimiento', async () => {
  const s = await levantar();
  try {
    const p = s.cliente();
    const t = tokenDe(await p.req('/agendar', { rut: '12.345.678-5', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1', comunicaciones: '1' }));
    const bloque = Number((await p.texto(`/agendar/calendario?t=${t}`)).match(/bloque=(\d+)/)[1]);
    const form = await p.texto(`/agendar/datos?t=${t}&bloque=${bloque}`);
    assert.match(form, /Completa los datos del paciente/);
    assert.match(form, /Nombres <span class="req"/, 'los obligatorios llevan asterisco');
    // Falta un dato obligatorio o el archivo no es válido: no avanza.
    assert.strictEqual((await p.req('/agendar/datos', { t, ...NUEVO, direccion: '' }, true)).status, 400);
    assert.match(await p.texto('/agendar/datos', { t, ...NUEVO, tipo1: 'Otro', doc1: { blob: new Blob(['MZ']), nombre: 'x.pdf' } }, true), /debe ser PDF, JPG o PNG/);
    // Datos y documento válidos.
    const pdf = new Blob([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(500, 1)])], { type: 'application/pdf' });
    const r = await p.req('/agendar/datos', { t, ...NUEVO, tipo1: 'Cartola FONASA', doc1: { blob: pdf, nombre: 'fonasa.pdf' } }, true);
    assert.strictEqual(r.headers.get('location'), `/agendar/revisar?t=${t}`);
    const rev = await p.texto(`/agendar/revisar?t=${t}`);
    assert.match(rev, /Se creará el registro del paciente/);
    assert.match(rev, /fonasa\.pdf/);
    const conf = await p.texto('/agendar/confirmar', { t });
    assert.match(conf, /Tu hora fue reservada correctamente/);
    assert.match(conf, /Descargar comprobante \(PDF\)/);
    assert.match(conf, /quedó registrado/);
    // Registro del paciente, cita, consentimiento, documento y envío registrado.
    const ficha = await s.c.catalogo.paciente('12345678-5');
    assert.strictEqual(ficha.nombre, 'Ana Prueba');
    const cita = (await s.c.citaRepo.buscarPorRut('12345678-5')).find((x) => x.idBloque === bloque);
    assert.strictEqual(cita.estadoReserva, 'ACTIVA');
    assert.strictEqual(s.c.operacion.meta.pacientes['12345678-5'].consentimiento.canal, 'Portal web');
    assert.ok(s.c.auditoria.listar().some((x) => x.accion === 'Consentimiento registrado' && x.registro === '12345678-5'));
    const doc = s.c.documentos.listar().find((d) => d.rut === '12345678-5');
    assert.strictEqual(doc.tipo, 'Cartola FONASA');
    assert.strictEqual(doc.adjunto.original, 'fonasa.pdf');
    assert.ok(s.c.extras.listar('comunicaciones').some((m) => m.idCita === cita.id && m.tipo === 'Comprobante de reserva' && m.estado === 'Simulado'));
    // PDF del comprobante.
    const pr = await p.req(`/agendar/comprobante.pdf?t=${t}`);
    assert.strictEqual(pr.headers.get('content-type'), 'application/pdf');
    const buf = Buffer.from(await pr.arrayBuffer());
    assert.strictEqual(buf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(buf.toString('latin1').includes('Ana Prueba') && buf.toString('latin1').includes('12345678-5'));
    assert.ok(!/c.digo de reserva:/i.test(buf.toString('latin1')));
    // Repetir la confirmación no duplica; el cupo ya no se ofrece y otra persona no puede tomarlo.
    await p.req('/agendar/confirmar', { t });
    assert.strictEqual((await s.c.citaRepo.buscarPorRut('12345678-5')).length, 1);
    assert.ok(!(await s.c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 })).some((b) => b.id === bloque));
    const otro = s.cliente();
    const t2 = tokenDe(await otro.req('/agendar', { rut: '33333333-3', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1' }));
    const r2 = await otro.req(`/agendar/datos?t=${t2}&bloque=${bloque}`);
    assert.strictEqual(r2.headers.get('location'), `/agendar/calendario?t=${t2}`, 'una hora tomada no se puede elegir');
  } finally { await s.cerrar(); }
});

test('portal: paciente existente: sin sesión no ve sus datos ni se le pide verificar; con sesión los ve y los actualiza', async () => {
  const s = await levantar();
  try {
    const p = s.cliente();
    const t = tokenDe(await p.req('/agendar', { rut: '11111111-1', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1' }));
    const bloque = Number((await p.texto(`/agendar/calendario?t=${t}`)).match(/bloque=(\d+)/)[1]);
    const sin = await p.texto(`/agendar/datos?t=${t}&bloque=${bloque}`);
    assert.match(sin, /ya tiene un registro/);
    assert.doesNotMatch(sin, /celular4|Verificar/, 'el flujo de reserva ya no pide verificar');
    assert.doesNotMatch(sin, /Paciente de prueba A|Dirección de prueba 1|56911111111/, 'no muestra datos personales sin sesión');
    assert.strictEqual((await p.req('/agendar/verificar', { t })).status, 404, 'la ruta de verificación ya no existe');
    // Con cuenta (titular), los datos se ven bloqueados/editables y se actualizan.
    const clave = 'una clave de prueba larga';
    assert.strictEqual((await p.req('/paciente/cuenta/acceso', { modo: 'crear', rut: '111111111', fechaNacimiento: '1980-01-01', celular4: '1111', clave, confirmarClave: clave, acepto: '1' })).status, 302);
    const t2 = tokenDe(await p.req('/agendar', { quien: '11111111-1', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1' }));
    const con = await p.texto(`/agendar/datos?t=${t2}&bloque=${bloque}`);
    assert.match(con, /Revisa los datos del paciente/);
    assert.match(con, /id="nombreVista"[^>]*value="Paciente de prueba A"[^>]*readonly/);
    assert.match(con, /id="direccion"[^>]*value="Dirección de prueba 1"/);
    const ficha = await s.c.catalogo.paciente('11111111-1');
    await p.req('/agendar/datos', { t: t2, telefono: ficha.telefono, tieneWhatsapp: '1', correo: 'a@ejemplo.cl', direccion: 'Nueva 99', idComuna: '1', genero: ficha.genero, nacionalidad: ficha.nacionalidad, nombres: 'Intento', apellidos: 'Cambio' }, true);
    assert.match(await p.texto('/agendar/confirmar', { t: t2 }), /reservada correctamente/);
    const nueva = await s.c.catalogo.paciente('11111111-1');
    assert.strictEqual(nueva.direccion, 'Nueva 99');
    assert.strictEqual(nueva.nombre, 'Paciente de prueba A', 'el nombre bloqueado no cambia');
  } finally { await s.cerrar(); }
});

// Conocer un RUT no debe revelar de quién es (RNF03). Antes el resumen, el comprobante en pantalla y el PDF
// mostraban el nombre completo de una ficha ajena sin verificar la identidad.
test('portal: sin verificar la identidad el nombre de una ficha ajena va enmascarado, pero la reserva se registra', async () => {
  const s = await levantar();
  try {
    const p = s.cliente();
    const t = tokenDe(await p.req('/agendar', { rut: '22.222.222-2', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1' }));
    const bloque = Number((await p.texto(`/agendar/calendario?t=${t}`)).match(/bloque=(\d+)/)[1]);
    await p.req(`/agendar/datos?t=${t}&bloque=${bloque}`);
    await p.req('/agendar/datos', { t }, true);
    const rev = await p.texto(`/agendar/revisar?t=${t}`);
    assert.doesNotMatch(rev, /Paciente de prueba B/, 'el resumen no revela el nombre');
    assert.match(rev, /P\*\*\*/, 'lo muestra enmascarado');
    const conf = await p.texto('/agendar/confirmar', { t });
    assert.match(conf, /reservada correctamente/);
    assert.doesNotMatch(conf, /Paciente de prueba B/, 'el comprobante en pantalla tampoco');
    const pdf = Buffer.from(await (await p.req(`/agendar/comprobante.pdf?t=${t}`)).arrayBuffer()).toString('latin1');
    assert.match(pdf, /^%PDF/);
    assert.ok(!pdf.includes('Paciente de prueba B'), 'el PDF tampoco');
    // No verificar la identidad no impide reservar: eso sigue igual.
    assert.ok((await s.c.citaRepo.buscarPorRut('22222222-2')).some((x) => x.idBloque === bloque && x.estadoReserva === 'ACTIVA'));
  } finally { await s.cerrar(); }
});

test('cuenta del paciente: crear con verificación, ingresar, mis horas, datos, documentos, familiares y recuperar', async () => {
  const s = await levantar();
  try {
    const c = s.c;
    // El adulto responsable de la paciente C (menor) tiene su propia ficha.
    await c.pacientes.crear({ rut: '44444444-4', nombres: 'Responsable', apellidos: 'Prueba', fechaNacimiento: '1985-02-02', genero: 'FEMENINO', telefono: '+56944444444', direccion: 'Calle 4', idComuna: 1, consentimiento: true });
    const p = s.cliente();
    const clave = 'una clave suficientemente larga';
    // Conocer el RUT no basta para crear la cuenta.
    assert.match(await p.texto('/paciente/cuenta/acceso', { modo: 'crear', rut: '44.444.444-4', fechaNacimiento: '1985-02-03', celular4: '4444', clave, confirmarClave: clave, acepto: '1' }), /No pudimos verificar/);
    assert.match(await p.texto('/paciente/cuenta/acceso', { modo: 'crear', rut: '44.444.444-4', fechaNacimiento: '1985-02-02', celular4: '4444', clave: 'corta', confirmarClave: 'corta', acepto: '1' }), /entre 15 y 128/);
    const cr = await p.req('/paciente/cuenta/acceso', { modo: 'crear', rut: '44.444.444-4', fechaNacimiento: '1985-02-02', celular4: '4444', clave, confirmarClave: clave, acepto: '1' });
    assert.strictEqual(cr.headers.get('location'), '/paciente/mis-horas');
    assert.ok(!c.extras.extras.cuentasPaciente[0].hash.includes(clave), 'la contraseña no se guarda en texto');
    assert.match(await p.texto('/'), /Mi cuenta/);
    // Familiares: la menor C aparece porque su ficha registra a esta persona como responsable.
    const fam = await p.texto('/paciente/familiares');
    assert.match(fam, /Paciente de prueba C/);
    assert.doesNotMatch(fam, /Paciente de prueba A/);
    // Comprobante de una hora de la familiar sí; de otra persona no.
    const bc = (await c.agendamiento.bloquesDisponibles({ idPoliclinico: 1 }))[0];
    const citaC = await c.agendamiento.agendar({ rut: '33333333-3', idBloque: bc.id });
    assert.strictEqual((await p.req(`/paciente/comprobante.pdf?idCita=${citaC.id}`)).headers.get('content-type'), 'application/pdf');
    assert.strictEqual((await p.req('/paciente/comprobante.pdf?idCita=1')).status, 403);
    // La reserva puede hacerse para la familiar desde la cuenta, ya verificada.
    const t = tokenDe(await p.req('/agendar', { quien: '33333333-3', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1' }));
    const bloque = Number((await p.texto(`/agendar/calendario?t=${t}`)).match(/bloque=(\d+)/)[1]);
    assert.match(await p.texto(`/agendar/datos?t=${t}&bloque=${bloque}`), /Revisa los datos del paciente/);
    // Mis horas y Mis datos.
    assert.match(await p.texto('/paciente/mis-horas'), /Próximas horas/);
    assert.match(await p.texto('/paciente/mis-datos', { telefono: '+56944444444', direccion: 'Calle 44', idComuna: '1', genero: 'FEMENINO', nacionalidad: 'Chilena', tieneWhatsapp: '1' }), /Datos guardados/);
    assert.strictEqual((await c.catalogo.paciente('44444444-4')).direccion, 'Calle 44');
    assert.match(await p.texto('/paciente/mis-datos/correccion', { detalle: 'Mi segundo apellido está mal escrito' }), /Solicitud enviada/);
    assert.ok(c.extras.listar('notificaciones').some((n) => n.tipo === 'SOLICITUD_PACIENTE'));
    // Mis documentos: propio y de la familiar; no de un tercero.
    const pdf = { blob: new Blob([Buffer.from('%PDF-1.4 x')], { type: 'application/pdf' }), nombre: 'cesfam.pdf' };
    assert.match(await p.texto('/paciente/mis-documentos', { rut: '44444444-4', tipo: 'Credencial CESFAM', archivo: pdf }, true), /Documento adjuntado/);
    assert.match(await p.texto('/paciente/mis-documentos', { rut: '33333333-3', tipo: 'Certificado', archivo: pdf }, true), /Documento adjuntado/);
    assert.match(await p.texto('/paciente/mis-documentos', { rut: '11111111-1', tipo: 'Certificado', archivo: pdf }, true), /familiares vinculados/);
    const idDoc = c.documentos.listar().find((d) => d.rut === '44444444-4').id;
    // Reemplazar: el anterior queda archivado (no se borra) y el nuevo pendiente de revisión.
    assert.match(await p.texto('/paciente/mis-documentos', { rut: '44444444-4', tipo: 'Credencial CESFAM', reemplazar: String(idDoc), archivo: pdf }, true), /Documento reemplazado/);
    assert.strictEqual(c.documentos.listar().find((d) => d.id === idDoc).archivado, true);
    assert.match(await p.texto('/paciente/mis-documentos', { rut: '33333333-3', tipo: 'Otro', reemplazar: String(idDoc), archivo: pdf }, true), /no corresponde a ese paciente/);
    assert.strictEqual((await p.req(`/paciente/mis-documentos/archivo?id=${idDoc}`)).headers.get('content-type'), 'application/pdf');
    // Solicitar vinculación no concede acceso.
    assert.match(await p.texto('/paciente/familiares/solicitar', { rutFamiliar: '11.111.111-1', relacion: 'Hijo' }), /Solicitud enviada/);
    assert.doesNotMatch(await p.texto('/paciente/familiares'), /Paciente de prueba A/);
    // Cerrar sesión.
    await p.req('/paciente/salir', {});
    assert.strictEqual((await p.req('/paciente/mis-horas')).headers.get('location'), '/paciente/cuenta');
    // Ingreso: clave incorrecta no entra; recuperar cambia la clave.
    const q = s.cliente();
    assert.strictEqual((await q.req('/paciente/cuenta/acceso', { modo: 'ingresar', rut: '44444444-4', clave: 'otra clave cualquiera' })).status, 401);
    const nueva = 'nueva clave suficientemente larga';
    assert.strictEqual((await q.req('/paciente/cuenta/acceso', { modo: 'recuperar', rut: '44444444-4', fechaNacimiento: '1985-02-02', celular4: '4444', clave: nueva, confirmarClave: nueva })).status, 302);
    const z = s.cliente();
    assert.strictEqual((await z.req('/paciente/cuenta/acceso', { modo: 'ingresar', rut: '44444444-4', clave })).status, 401);
    assert.strictEqual((await z.req('/paciente/cuenta/acceso', { modo: 'ingresar', rut: '44444444-4', clave: nueva })).status, 302);
  } finally { await s.cerrar(); }
});

test('cuenta del paciente: sin sesión las secciones redirigen al ingreso', async () => {
  const s = await levantar();
  try {
    for (const r of ['/paciente/mis-horas', '/paciente/mis-datos', '/paciente/mis-documentos', '/paciente/familiares', '/paciente/comprobante.pdf?idCita=1'])
      assert.strictEqual((await fetch(s.base + r, { redirect: 'manual' })).headers.get('location'), '/paciente/cuenta', r);
  } finally { await s.cerrar(); }
});

test('agenda del personal en grilla sigue disponible', async () => {
  const s = await levantar();
  try {
    const r = await fetch(`${s.base}/login`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ correo: 'tens@ejemplo.cl', clave: 'demo1234' }) });
    const cookie = r.headers.get('set-cookie').split(';')[0];
    const ag = await (await fetch(`${s.base}/tens/agenda?sede=1&fecha=2026-11-23`, { headers: { Cookie: cookie } })).text();
    assert.match(ag, /calendar-grid/);
    assert.match(ag, /schedule-block/);
  } finally { await s.cerrar(); }
});

test('portal: sin sesión los documentos y el cambio de datos se guardan igual (para revisión) y no se registra consentimiento ajeno', async () => {
  const s = await levantar();
  try {
    const p = s.cliente();
    const antes = await s.c.catalogo.paciente('22222222-2');
    const t = tokenDe(await p.req('/agendar', { rut: '22222222-2', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1', comunicaciones: '1' }));
    const bloque = Number((await p.texto(`/agendar/calendario?t=${t}`)).match(/bloque=(\d+)/)[1]);
    const sin = await p.texto(`/agendar/datos?t=${t}&bloque=${bloque}`);
    assert.match(sin, /name="doc1"/, 'se pueden adjuntar documentos sin cuenta');
    assert.match(sin, /name="cambioDatos"/);
    const pdf = { blob: new Blob([Buffer.from('%PDF-1.4 x')], { type: 'application/pdf' }), nombre: 'cartola.pdf' };
    assert.strictEqual((await p.req('/agendar/datos', { t, tipo1: 'Cartola FONASA', doc1: pdf, cambioDatos: 'Mi nuevo celular es +56987654321' }, true)).status, 302);
    assert.match(await p.texto(`/agendar/revisar?t=${t}`), /CAMBIO DE DATOS SOLICITADO/);
    assert.match(await p.texto('/agendar/confirmar', { t }), /reservada correctamente/);
    const docs = s.c.documentos.listar().filter((d) => d.rut === '22222222-2');
    assert.strictEqual(docs.length, 1, 'el documento quedó guardado en la ficha');
    assert.match(JSON.stringify(docs[0]), /sin iniciar sesión/);
    assert.ok(s.c.extras.listar('solicitudesPaciente').some((x) => x.rut === '22222222-2' && /celular/.test(x.detalle)), 'el cambio de datos llega como solicitud');
    assert.strictEqual((await s.c.catalogo.paciente('22222222-2')).telefono, antes.telefono, 'sin sesión no se sobrescribe la ficha');
    assert.strictEqual(s.c.operacion.meta.pacientes['22222222-2']?.consentimiento, undefined, 'el consentimiento no se registra a nombre de otro');
  } finally { await s.cerrar(); }
});

test('rut: se acepta sin puntos ni guion y se normaliza', () => {
  const { normalizarRut, rutValido } = require('../src/util/rut');
  assert.strictEqual(normalizarRut('123456785'), '12345678-5');
  assert.strictEqual(normalizarRut('12.345.678-5'), '12345678-5');
  assert.strictEqual(normalizarRut('7654321k'), '7654321-K');
  assert.ok(rutValido('123456785'));
});

test('portal: con el tope de adjuntos en espera superado se pide continuar sin archivos', async () => {
  const s = await levantar();
  process.env.MAX_MB_ADJUNTOS_EN_ESPERA = '0.000001';
  try {
    const p = s.cliente();
    const t = tokenDe(await p.req('/agendar', { rut: '12.345.678-5', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1' }));
    const bloque = Number((await p.texto(`/agendar/calendario?t=${t}`)).match(/bloque=(\d+)/)[1]);
    await p.req(`/agendar/datos?t=${t}&bloque=${bloque}`);
    const pdf = { blob: new Blob([Buffer.from('%PDF-1.4 contenido')], { type: 'application/pdf' }), nombre: 'fonasa.pdf' };
    assert.match(await p.texto('/agendar/datos', { t, ...NUEVO, tipo1: 'Cartola FONASA', doc1: pdf }, true), /no podemos recibir más archivos/);
    assert.strictEqual((await p.req('/agendar/datos', { t, ...NUEVO }, true)).status, 302, 'sin archivos sí continúa');
  } finally { delete process.env.MAX_MB_ADJUNTOS_EN_ESPERA; await s.cerrar(); }
});

test('portal: el comprobante de una cita cancelada no falla: lleva a Consultar mi reserva', async () => {
  const s = await levantar();
  try {
    const p = s.cliente();
    const t = tokenDe(await p.req('/agendar', { rut: '12.345.678-5', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1' }));
    const bloque = Number((await p.texto(`/agendar/calendario?t=${t}`)).match(/bloque=(\d+)/)[1]);
    await p.req(`/agendar/datos?t=${t}&bloque=${bloque}`);
    await p.req('/agendar/datos', { t, ...NUEVO }, true);
    await p.req('/agendar/confirmar', { t });
    const [cita] = await s.c.citaRepo.buscarPorRut('12345678-5');
    await s.c.agendamiento.cancelar(cita.id, 'ASISTIDA');
    const r = await p.req(`/agendar/comprobante.pdf?t=${t}`);
    assert.strictEqual(r.status, 302);
    assert.strictEqual(r.headers.get('location'), '/paciente/consulta');
  } finally { await s.cerrar(); }
});

// RF36 / CP-36: la encuesta de agendamiento es otra encuesta, distinta de la posterior a la atención (RF30).
test('portal: la encuesta de agendamiento se ofrece tras reservar, es distinta de la de atención y se responde una vez', async () => {
  const s = await levantar();
  try {
    const p = s.cliente();
    const t = tokenDe(await p.req('/agendar', { rut: '13456789-9', lugar: '1', modo: 'esp', esp: 'Medicina General', consentimiento: '1' }));
    const bloque = Number((await p.texto(`/agendar/calendario?t=${t}`)).match(/bloque=(\d+)/)[1]);
    // Antes de confirmar la reserva no hay encuesta que responder.
    assert.strictEqual((await p.req(`/agendar/encuesta?t=${t}`)).headers.get('location'), '/agendar');
    await p.req(`/agendar/datos?t=${t}&bloque=${bloque}`);
    assert.strictEqual((await p.req('/agendar/datos', { t, ...NUEVO, nombres: 'Carla' }, true)).status, 302);
    const conf = await p.texto('/agendar/confirmar', { t });
    assert.match(conf, /¿Cómo fue reservar tu hora\?/, 'la reserva confirmada invita a responderla');
    assert.match(conf, /\/agendar\/encuesta/);
    // El formulario pregunta por el agendamiento, no por la atención, y no pide el RUT.
    const form = await p.texto(`/agendar/encuesta?t=${t}`);
    assert.match(form, /fácil fue reservar tu hora/);
    assert.match(form, /No es la encuesta de la atención/);
    assert.doesNotMatch(form, /name="rut"/, 'no pide el RUT: se responde con el token de la reserva');
    // Nota inválida: no se registra nada.
    assert.match(await p.texto('/agendar/encuesta', { t, nota: '9' }), /La nota debe ser de 1 a 5/);
    assert.strictEqual(s.c.extras.listar('encuestasAgendamiento').length, 0);
    // Respuesta válida, guardada aparte de la encuesta de atención.
    assert.match(await p.texto('/agendar/encuesta', { t, nota: '4', comentario: 'Fue sencillo' }), /quedó registrada/);
    const [e] = s.c.extras.listar('encuestasAgendamiento');
    assert.strictEqual(e.nota, 4);
    assert.strictEqual(e.comentario, 'Fue sencillo');
    assert.strictEqual(e.canal, 'WEB');
    assert.deepStrictEqual(s.c.encuestas.resumenAgendamiento(), { respuestas: 1, promedio: 4 });
    assert.deepStrictEqual(s.c.encuestas.resumen(), { respuestas: 0, promedio: null }, 'no contamina la encuesta de atención');
    // Una sola respuesta por reserva.
    assert.match(await p.texto('/agendar/encuesta', { t, nota: '1' }), /Ya respondiste la encuesta de esta reserva/);
    assert.strictEqual(s.c.extras.listar('encuestasAgendamiento').length, 1);
  } finally { await s.cerrar(); }
});

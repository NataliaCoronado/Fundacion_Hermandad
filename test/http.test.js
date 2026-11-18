'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { crearContenedor } = require('../src/contenedor');
const { crearServidor } = require('../src/server');

async function levantar() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { c, base, cerrar: () => new Promise((r) => srv.close(r)) };
}
async function ingresar(base, correo, clave = 'demo1234') {
  const r = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ correo, clave }) });
  return { r, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}
const post = (base, ruta, cookie, datos) => fetch(base + ruta, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie }, body: new URLSearchParams(datos) });

test('rutas del personal exigen sesión; la consulta de pacientes es pública', async () => {
  const s = await levantar();
  try {
    const r = await fetch(`${s.base}/tens/agenda`, { redirect: 'manual' });
    assert.strictEqual(r.status, 302);
    assert.match(r.headers.get('location'), /^\/login/);
    assert.strictEqual((await fetch(`${s.base}/paciente/consulta`)).status, 200);
    assert.strictEqual((await fetch(`${s.base}/`)).status, 200);
  } finally { await s.cerrar(); }
});

test('login: clave incorrecta no entra; correcta crea sesión con cookie HttpOnly', async () => {
  const s = await levantar();
  try {
    assert.strictEqual((await ingresar(s.base, 'tens@ejemplo.cl', 'mala')).r.status, 401);
    assert.strictEqual((await ingresar(s.base, 'nadie@ejemplo.cl')).r.status, 401);   // mismo resultado si el correo no existe
    const { r, cookie } = await ingresar(s.base, 'tens@ejemplo.cl');
    assert.strictEqual(r.status, 302);
    assert.match(r.headers.get('set-cookie'), /HttpOnly/);
    assert.strictEqual((await fetch(`${s.base}/tens/agenda`, { headers: { Cookie: cookie } })).status, 200);
  } finally { await s.cerrar(); }
});

test('roles: TENS/TONS no entra a Administración; Administración sí', async () => {
  const s = await levantar();
  try {
    const t = (await ingresar(s.base, 'tens@ejemplo.cl')).cookie;
    assert.strictEqual((await fetch(`${s.base}/admin/reportes`, { headers: { Cookie: t } })).status, 403);
    const a = (await ingresar(s.base, 'admin@ejemplo.cl')).cookie;
    assert.strictEqual((await fetch(`${s.base}/admin/reportes`, { headers: { Cookie: a } })).status, 200);
    assert.strictEqual((await fetch(`${s.base}/admin/panel`, { headers: { Cookie: a } })).status, 200);
    // Datos del panel de agenda: solo Administración y sin datos de pacientes.
    assert.strictEqual((await fetch(`${s.base}/admin/reportes/agenda.json`, { headers: { Cookie: t } })).status, 403);
    const ag = await (await fetch(`${s.base}/admin/reportes/agenda.json`, { headers: { Cookie: a } })).text();
    const j = JSON.parse(ag);
    assert.ok(Array.isArray(j.reservas) && Array.isArray(j.cupos) && j.desde && j.hasta);
    assert.ok(!/Paciente|rut|\d{7,8}-[\dkK]/i.test(ag), 'sin nombres ni RUT de pacientes');
    // Las áreas no se mezclan: Administración no entra a las pantallas de atención de TENS/TONS.
    assert.strictEqual((await fetch(`${s.base}/tens/agenda`, { headers: { Cookie: a } })).status, 403);
    assert.ok(!(await (await fetch(`${s.base}/admin/panel`, { headers: { Cookie: a } })).text()).includes('href="/tens/'), 'menú de Administración sin TENS/TONS');
    assert.ok(!(await (await fetch(`${s.base}/tens/panel`, { headers: { Cookie: t } })).text()).includes('href="/admin/'), 'menú de TENS/TONS sin Administración');
  } finally { await s.cerrar(); }
});

test('bloqueo de intentos de login repetidos', async () => {
  const s = await levantar();
  try {
    for (let i = 0; i < 5; i++) await ingresar(s.base, 'tens@ejemplo.cl', 'mala');
    assert.strictEqual((await ingresar(s.base, 'tens@ejemplo.cl', 'demo1234')).r.status, 429);
  } finally { await s.cerrar(); }
});

test('TENS/TONS de una sede no agenda en otra sede', async () => {
  const s = await levantar();
  try {
    const cookie = (await ingresar(s.base, 'tens@ejemplo.cl')).cookie;      // sede 1
    // bloque 17 pertenece al profesional 3 (sede 2)
    const r = await post(s.base, '/tens/agendar', cookie, { rut: '33333333-3', idBloque: '17' });
    assert.match(await r.text(), /otro policlínico/);
    assert.strictEqual((await s.c.citaRepo.buscarPorRut('33333333-3')).length, 0);
    const ok = await post(s.base, '/tens/agendar', cookie, { rut: '33333333-3', idBloque: '3' });
    assert.match(await ok.text(), /Cita registrada/);
  } finally { await s.cerrar(); }
});

test('consulta de reserva: exige verificar el acceso, responde igual si falla y limita intentos', async () => {
  const s = await levantar();
  try {
    const cuerpo = (rut, fechaNacimiento = '', celular4 = '') => fetch(`${s.base}/paciente/consulta`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ rut, fechaNacimiento, celular4 }) });
    const soloRut = await (await cuerpo('11.111.111-1')).text();
    assert.match(soloRut, /No pudimos verificar tus datos/);
    assert.doesNotMatch(soloRut, /VIGENTE ·/, 'conocer el RUT no basta para ver las horas');
    const fechaMala = await (await cuerpo('11.111.111-1', '1980-01-02', '1111')).text();
    assert.match(fechaMala, /No pudimos verificar tus datos/);
    const noExiste = await (await cuerpo('99999999-9', '1980-01-01', '1111')).text();
    assert.match(noExiste, /No pudimos verificar tus datos/, 'misma respuesta si el RUT no existe');
    const con = await (await cuerpo('11.111.111-1', '1980-01-01', '1111')).text();
    assert.match(con, /VIGENTE ·/);
    await cuerpo('1-9');
    assert.strictEqual((await cuerpo('1-9')).status, 429, 'el sexto intento del minuto se bloquea');
  } finally { await s.cerrar(); }
});

test('consulta de reserva: datos verificados sin horas vigentes', async () => {
  const s = await levantar();
  try {
    const r = await fetch(`${s.base}/paciente/consulta`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ rut: '33333333-3', fechaNacimiento: '2015-09-09', celular4: '3333' }) });
    assert.match(await r.text(), /No tienes reservas vigentes/);
  } finally { await s.cerrar(); }
});

test('consulta de reserva: el límite de intentos aplica aunque los datos sean inválidos', async () => {
  const s = await levantar();
  try {
    const cuerpo = (rut) => fetch(`${s.base}/paciente/consulta`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ rut }) });
    for (let i = 0; i < 5; i++) await cuerpo('1-9');
    assert.strictEqual((await cuerpo('1-9')).status, 429);
  } finally { await s.cerrar(); }
});

test('reportes se descargan como CSV solo con sesión de Administración', async () => {
  const s = await levantar();
  try {
    assert.strictEqual((await fetch(`${s.base}/admin/reportes/resumen.csv`, { redirect: 'manual' })).status, 302);
    const a = (await ingresar(s.base, 'admin@ejemplo.cl')).cookie;
    const r = await fetch(`${s.base}/admin/reportes/resumen.csv`, { headers: { Cookie: a } });
    assert.match(r.headers.get('content-type'), /text\/csv/);
    assert.match(r.headers.get('content-disposition'), /attachment/);
  } finally { await s.cerrar(); }
});

test('POST desde otro origen se rechaza (CSRF) y el HTML escapa los datos', async () => {
  const s = await levantar();
  try {
    const cookie = (await ingresar(s.base, 'tens@ejemplo.cl')).cookie;
    const r = await fetch(`${s.base}/tens/agendar`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie, Origin: 'http://malo.example' }, body: new URLSearchParams({ rut: '1', idBloque: '3' }) });
    assert.strictEqual(r.status, 403);
    const doc = await post(s.base, '/tens/documentos', cookie, { rut: '11111111-1', tipo: 'Otro', observacion: '<script>alert(1)</script>' });
    const html = await (await fetch(`${s.base}/tens/documentos`, { headers: { Cookie: cookie } })).text();
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.strictEqual(doc.status, 200);
  } finally { await s.cerrar(); }
});

test('cerrar sesión invalida la cookie', async () => {
  const s = await levantar();
  try {
    const cookie = (await ingresar(s.base, 'tens@ejemplo.cl')).cookie;
    await post(s.base, '/logout', cookie, {});
    assert.strictEqual((await fetch(`${s.base}/tens/agenda`, { headers: { Cookie: cookie }, redirect: 'manual' })).status, 302);
  } finally { await s.cerrar(); }
});

test('páginas públicas del portal responden 200 y la reserva web se puede apagar', async () => {
  const s = await levantar();
  try {
    for (const r of ['/', '/agendar', '/paciente/consulta', '/paciente/encuesta', '/ayuda', '/privacidad']) assert.strictEqual((await fetch(s.base + r)).status, 200, r);
    process.env.RESERVA_WEB = '0';
    assert.strictEqual((await fetch(`${s.base}/agendar`)).status, 503);
  } finally { delete process.env.RESERVA_WEB; await s.cerrar(); }
});

test('imágenes estáticas: se sirven las de public/img y se rechaza cualquier otra ruta', async () => {
  const s = await levantar();
  try {
    const ok = await fetch(`${s.base}/img/sello.png`);
    assert.strictEqual(ok.status, 200); assert.match(ok.headers.get('content-type'), /image\/png/);
    assert.strictEqual((await fetch(`${s.base}/img/san-isidro.jpg`)).status, 200);
    assert.strictEqual((await fetch(`${s.base}/img/no-existe.jpg`)).status, 404);
    assert.strictEqual((await fetch(`${s.base}/img/..%2Fsrc%2Fserver.js`)).status, 404);
  } finally { await s.cerrar(); }
});

test('dos sitios: el portal de pacientes no expone al personal y el del personal no sirve el portal', async () => {
  const c = crearContenedor(); await c.inicializar();
  const abrir = async (modo) => { const srv = crearServidor(c, modo); await new Promise((r) => srv.listen(0, r)); return { srv, base: `http://127.0.0.1:${srv.address().port}` }; };
  const pac = await abrir('paciente'); const per = await abrir('personal');
  try {
    assert.strictEqual((await fetch(`${pac.base}/`)).status, 200);
    assert.ok(!(await (await fetch(`${pac.base}/`)).text()).includes('/login'), 'sin enlace al personal');
    for (const r of ['/login', '/tens/agenda', '/admin/reportes']) assert.strictEqual((await fetch(pac.base + r, { redirect: 'manual' })).status, 404, r);
    const raiz = await fetch(`${per.base}/`, { redirect: 'manual' });
    assert.strictEqual(raiz.status, 302); assert.match(raiz.headers.get('location'), /\/login/);
    assert.strictEqual((await fetch(`${per.base}/login`)).status, 200);
    for (const r of ['/agendar', '/paciente/consulta', '/ayuda']) assert.strictEqual((await fetch(per.base + r)).status, 404, r);
    for (const [correo, agenda, panelAnterior, titulo] of [
      ['admin@ejemplo.cl', '/admin/agendas', '/admin/panel', 'Agendas y cupos'],
      ['tens@ejemplo.cl', '/tens/agenda', '/tens/panel', 'Agendas y reservas'],
      ['telemedicina.usuario@ejemplo.cl', '/tens/agenda', '/tens/panel', 'Agendas y reservas'],
    ]) {
      const { r, cookie } = await ingresar(per.base, correo);
      assert.strictEqual(r.status, 302, correo);
      assert.strictEqual(r.headers.get('location'), agenda, correo);

      const manual = { redirect: 'manual', headers: { Cookie: cookie } };
      for (const ruta of ['/', '/login', panelAnterior]) {
        const entrada = await fetch(per.base + ruta, manual);
        assert.strictEqual(entrada.status, 302, ruta);
        assert.strictEqual(entrada.headers.get('location'), agenda, ruta);
      }
      const fecha = '?fecha=2026-11-23';
      const marcador = await fetch(per.base + panelAnterior + fecha, manual);
      assert.strictEqual(marcador.headers.get('location'), agenda + fecha, correo);

      const respuesta = await fetch(per.base + agenda, manual);
      assert.strictEqual(respuesta.status, 200, correo);
      const html = await respuesta.text();
      assert.ok(html.includes('<h1>' + titulo + '</h1>'), correo);
      assert.ok(html.includes('class="side-marca" href="' + agenda + '"'), correo);
      assert.doesNotMatch(html, /href="\/(?:tens|admin)\/panel"|Atención del día|Próximas atenciones/, correo);
    }

    const volver = await post(per.base, '/login', '', {
      correo: 'tens@ejemplo.cl', clave: 'demo1234', volver: '/tens/pacientes',
    });
    assert.strictEqual(volver.headers.get('location'), '/tens/pacientes');
  } finally { await new Promise((r) => pac.srv.close(r)); await new Promise((r) => per.srv.close(r)); }
});

test('personal: adjuntar y descargar un documento, editar ficha, liberar cupos; el bot queda fuera', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
  process.env.DIR_DOCUMENTOS = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-'));
  const s = await levantar();
  try {
    const t = (await ingresar(s.base, 'tens@ejemplo.cl')).cookie; const a = (await ingresar(s.base, 'admin@ejemplo.cl')).cookie;
    // Adjunto: formulario multipart real.
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3000, 7)]);
    const fd = new FormData(); fd.set('rut', '11111111-1'); fd.set('tipo', 'Credencial CESFAM'); fd.set('observacion', 'inscripción'); fd.set('archivo', new Blob([pdf], { type: 'application/pdf' }), 'cesfam.pdf');
    const sub = await fetch(`${s.base}/tens/documentos`, { method: 'POST', headers: { Cookie: t }, body: fd });
    assert.match(await sub.text(), /Documento registrado/);
    const id = s.c.documentos.listar()[0].id;
    const baja = await fetch(`${s.base}/tens/documentos/archivo?id=${id}`, { headers: { Cookie: t } });
    assert.strictEqual(baja.headers.get('content-type'), 'application/pdf');
    assert.match(baja.headers.get('content-disposition'), /attachment; filename="cesfam.pdf"/);
    assert.ok(Buffer.from(await baja.arrayBuffer()).equals(pdf));
    // Sin sesión no se descarga; Administración tampoco entra a esa área.
    assert.strictEqual((await fetch(`${s.base}/tens/documentos/archivo?id=${id}`, { redirect: 'manual' })).status, 302);
    assert.strictEqual((await fetch(`${s.base}/tens/documentos/archivo?id=${id}`, { headers: { Cookie: a } })).status, 403);
    // Un archivo que no es PDF/JPG/PNG se rechaza; uno enorme recibe 413.
    const malo = new FormData(); malo.set('rut', '11111111-1'); malo.set('tipo', 'Otro'); malo.set('archivo', new Blob(['MZ ejecutable']), 'virus.pdf');
    assert.match(await (await fetch(`${s.base}/tens/documentos`, { method: 'POST', headers: { Cookie: t }, body: malo })).text(), /debe ser PDF, JPG o PNG/);
    const mediano = new FormData(); mediano.set('rut', '11111111-1'); mediano.set('tipo', 'Otro'); mediano.set('archivo', new Blob([Buffer.concat([Buffer.from('%PDF'), Buffer.alloc(7 * 1024 * 1024)])]), 'm.pdf');
    assert.match(await (await fetch(`${s.base}/tens/documentos`, { method: 'POST', headers: { Cookie: t }, body: mediano })).text(), /5 MB/);
    const grande = new FormData(); grande.set('rut', '11111111-1'); grande.set('tipo', 'Otro'); grande.set('archivo', new Blob([Buffer.alloc(17 * 1024 * 1024)]), 'g.pdf');
    assert.strictEqual((await fetch(`${s.base}/tens/documentos`, { method: 'POST', headers: { Cookie: t }, body: grande })).status, 413);
    // Editar ficha.
    const ed = await (await fetch(`${s.base}/tens/pacientes/editar?rut=33333333-3`, { headers: { Cookie: t } })).text();
    assert.match(ed, /Sin permiso/);
    assert.strictEqual((await fetch(`${s.base}/tens/pacientes/editar?rut=33333333-3`, {headers:{Cookie:t}})).status,403);
    await s.c.agendamiento.agendar({rut:'33333333-3',idBloque:3,idUsuario:'u2'});
    const guardar = await post(s.base, '/tens/pacientes/editar', t, { rut: '33333333-3', nombres: 'Nombre nuevo', apellidos: 'C', fechaNacimiento: '2015-09-09', genero: 'FEMENINO', telefono: '+56933333333', direccion: 'Otra 5', idComuna: '1', respNombre: 'Tía Prueba', respRelacion: 'Tía', respRut: '44444444-4', respTelefono: '+56944444444' });
    assert.match(await guardar.text(), /Ficha actualizada/);
    assert.strictEqual((await s.c.catalogo.paciente('33333333-3')).responsable.relacion, 'Tía');
    // Liberar y bloquear cupos (solo Administración).
    assert.strictEqual((await post(s.base, '/admin/agendas/publicar', t, { idProfesional: '1', desde: '2026-11-23', hasta: '2026-11-24', accion: 'bloquear' })).status, 403);
    assert.match(await (await post(s.base, '/admin/agendas/publicar', a, { idProfesional: '1', desde: '2026-11-23', hasta: '2026-11-24', accion: 'bloquear' })).text(), /5 cupo\(s\) bloqueado/);
    assert.match(await (await post(s.base, '/admin/agendas/publicar', a, { idProfesional: '1', desde: '2026-11-24', hasta: '2026-11-23', accion: 'publicar' })).text(), /Revisa las fechas/);
    assert.match(await (await fetch(`${s.base}/admin/reportes`, { headers: { Cookie: a } })).text(), /Caracterización de pacientes/);
    assert.match((await fetch(`${s.base}/admin/reportes/profesionales.csv`, { headers: { Cookie: a } })).headers.get('content-type'), /text\/csv/);
    // Bot fuera: ni menú ni rutas.
    assert.strictEqual((await fetch(`${s.base}/tens/bot`, { headers: { Cookie: t } })).status, 404);
    assert.ok(!(await (await fetch(`${s.base}/tens/panel`, { headers: { Cookie: t } })).text()).includes('/tens/bot'));
  } finally { await s.cerrar(); fs.rmSync(process.env.DIR_DOCUMENTOS, { recursive: true, force: true }); delete process.env.DIR_DOCUMENTOS; }
});

test('administración: cupos en serie, liberación masiva, filtros de reportes y pantallas con historial de demostración', async () => {
  const c = crearContenedor({ demo: true });
  await c.inicializar();
  const srv = crearServidor(c); await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const a = (await ingresar(base, 'admin@ejemplo.cl')).cookie;
    for (const r of ['/admin/panel', '/admin/reportes', '/admin/agendas', '/admin/policlinicos', '/admin/profesionales?sede=1&estado=1', '/admin/usuarios', '/admin/auditoria?q=cupos', '/admin/reportes?desde=2026-01-01&hasta=2026-12-31&sede=2&esp=Kinesiolog%C3%ADa']) {
      const res = await fetch(base + r, { headers: { Cookie: a } });
      assert.strictEqual(res.status, 200, r);
    }
    // Serie: lunes a viernes, 09:00–10:00 cada 20 min durante una semana sin agenda previa = 15 cupos bloqueados.
    const serie = { idProfesional: '1', desde: '2027-03-01', hasta: '2027-03-07', horaInicio: '09:00', horaFin: '10:00', duracion: '20', dia0: '1', dia1: '1', dia2: '1', dia3: '1', dia4: '1' };
    assert.match(await (await post(base, '/admin/agendas/serie', a, serie)).text(), /15 cupo\(s\) creado\(s\) \(bloqueados/);
    assert.match(await (await post(base, '/admin/agendas/serie', a, serie)).text(), /0 cupo\(s\) creado\(s\).*15 ya existían/);
    assert.match(await (await post(base, '/admin/agendas/serie', a, { ...serie, horaFin: '08:00' })).text(), /Revisa el horario/);
    assert.match(await (await post(base, '/admin/agendas/serie', a, { ...serie, dia0: '', dia1: '', dia2: '', dia3: '', dia4: '' })).text(), /al menos un día/);
    // Liberación masiva por policlínico: libera los 15 cupos recién creados.
    assert.match(await (await post(base, '/admin/agendas/masivo', a, { idPoliclinico: '1', especialidad: 'Medicina General', desde: '2027-03-01', hasta: '2027-03-07', accion: 'publicar' })).text(), /15 cupo\(s\) liberado\(s\)/);
    // Descarga filtrada: solo filas del rango y queda en la auditoría.
    const csv = await (await fetch(`${base}/admin/reportes/citas.csv?desde=2027-03-01&hasta=2027-03-07`, { headers: { Cookie: a } })).text();
    assert.strictEqual(csv.trim().split('\r\n').length, 1, 'sin citas en ese rango: solo encabezado');
    assert.ok(c.auditoria.listar().some((x) => x.accion === 'Reporte descargado'));
    // Los reportes siguen sin datos personales.
    assert.ok(!/Paciente demo|11111111/.test(await (await fetch(`${base}/admin/reportes`, { headers: { Cookie: a } })).text()));
  } finally { await new Promise((r) => srv.close(r)); }
});

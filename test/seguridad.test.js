'use strict';
// Robustez del servidor y bloqueo de la verificación de identidad por RUT.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { crearContenedor } = require('../src/contenedor');
const { crearServidor } = require('../src/server');
const { MAX_FALLOS } = require('../src/services/CuentaPacienteService');

async function levantar() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { c, srv, base: `http://127.0.0.1:${srv.address().port}`, cerrar: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(r); }) };
}
const PACIENTE = { rut: '44444444-4', nombres: 'Bloqueo', apellidos: 'Prueba', fechaNacimiento: '1985-02-02', genero: 'FEMENINO', telefono: '+56944444444', direccion: 'Calle 4', idComuna: 1, consentimiento: true };

test('seguridad: un POST con Origin "null" o ilegible se rechaza (403) y el servidor sigue atendiendo', async () => {
  const s = await levantar();
  try {
    for (const origin of ['null', 'no es una url', 'http://otro-sitio.cl']) {
      const r = await fetch(`${s.base}/login`, { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'correo=a' });
      assert.strictEqual(r.status, 403, origin);
    }
    assert.strictEqual((await fetch(`${s.base}/`)).status, 200);
  } finally { await s.cerrar(); }
});

test('seguridad: un cliente que envía su formulario muy lento no bloquea los POST de los demás', async () => {
  const s = await levantar();
  const lento = http.request(`${s.base}/paciente/consulta`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '100000' } });
  lento.on('error', () => {});
  lento.write('rut=1');
  try {
    await new Promise((r) => setTimeout(r, 50));
    const inicio = Date.now();
    const r = await fetch(`${s.base}/paciente/consulta`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'rut=1-9', signal: AbortSignal.timeout(3000) });
    assert.strictEqual(r.status, 200);
    assert.ok(Date.now() - inicio < 2000);
  } finally { lento.destroy(); await s.cerrar(); }
});

test('seguridad: tras varios fallos el RUT queda bloqueado aunque luego se den los datos correctos', async () => {
  const s = await levantar();
  try {
    await s.c.pacientes.crear(PACIENTE);
    const bien = { rut: PACIENTE.rut, fechaNacimiento: '1985-02-02', celular4: '4444' };
    assert.ok(await s.c.cuentas.verificarIdentidad(bien), 'con datos correctos verifica');
    for (let i = 0; i < MAX_FALLOS; i++) assert.strictEqual(await s.c.cuentas.verificarIdentidad({ ...bien, celular4: String(1000 + i) }), null);
    assert.strictEqual(await s.c.cuentas.verificarIdentidad(bien), null, 'bloqueado: los datos correctos ya no bastan');
    assert.ok(s.c.cuentas.bloqueado(PACIENTE.rut));
    // El bloqueo también alcanza a la consulta de reservas y a la recuperación de contraseña.
    const h = await (await fetch(`${s.base}/paciente/consulta`, { method: 'POST', body: new URLSearchParams(bien) })).text();
    assert.match(h, /No pudimos verificar/);
    // Al vencer el bloqueo vuelve a verificar y el contador se reinicia.
    s.c.cuentas.bloqueos()[PACIENTE.rut].hasta = Date.now() - 1;
    assert.ok(await s.c.cuentas.verificarIdentidad(bien));
    assert.strictEqual(s.c.cuentas.bloqueos()[PACIENTE.rut], undefined);
  } finally { await s.cerrar(); }
});

test('seguridad: los fallos con RUT sin ficha no se registran', async () => {
  const s = await levantar();
  try {
    for (let i = 0; i < 3; i++) await s.c.cuentas.verificarIdentidad({ rut: '30123456-2', fechaNacimiento: '2000-01-01', celular4: '0000' });
    assert.deepStrictEqual(Object.keys(s.c.cuentas.bloqueos()), []);
  } finally { await s.cerrar(); }
});

test('seguridad: X-Forwarded-For solo se usa con TRUST_PROXY=1', async () => {
  const s = await levantar();
  const consulta = (ip) => fetch(`${s.base}/paciente/consulta`, { method: 'POST', headers: { 'x-forwarded-for': ip }, body: new URLSearchParams({ rut: '1-9' }) });
  try {
    // Sin la variable, inventar la cabecera no evita el límite (5 por minuto por cliente).
    let ultimo;
    for (let i = 0; i < 6; i++) ultimo = await consulta(`10.0.0.${i}`);
    assert.strictEqual(ultimo.status, 429);
    // Con la variable, cada cliente real (según el proxy) tiene su propio límite.
    process.env.TRUST_PROXY = '1';
    for (let i = 0; i < 5; i++) assert.strictEqual((await consulta('1.1.1.1, 10.9.9.9')).status, 200);
    assert.strictEqual((await consulta('1.1.1.1, 10.9.9.9')).status, 429);
    assert.strictEqual((await consulta('10.9.9.8')).status, 200, 'otra IP no queda bloqueada');
  } finally { delete process.env.TRUST_PROXY; await s.cerrar(); }
});

test('seguridad: las sesiones vencidas y los intentos viejos se limpian', () => {
  const { Sesiones } = require('../src/auth/Sesiones');
  const se = new Sesiones();
  const vieja = se.crear({ id: 1 });
  const viva = se.crear({ id: 2 });
  se.mapa.get(vieja).ultimaActividad = Date.now() - 31 * 60 * 1000;
  se.limpiar();
  assert.deepStrictEqual([...se.mapa.keys()], [viva]);

  const { crearLimitador } = require('../src/util/limitador');
  const real = Date.now;
  let ahora = real();
  Date.now = () => ahora;
  try {
    const excedido = crearLimitador(1000);
    excedido('a', 1); excedido('a', 1);
    assert.strictEqual(excedido('a', 1), true);
    ahora += 2000;
    assert.strictEqual(excedido('b', 1), false, 'pasada la ventana no hay bloqueo');
    assert.strictEqual(excedido('a', 1), false, 'las claves viejas se borraron y vuelven a empezar');
  } finally { Date.now = real; }
});

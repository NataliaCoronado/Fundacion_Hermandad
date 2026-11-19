'use strict';
const { nuevoContexto, cerrarContexto, paso, noVerificado, afirmar, rutNuevo, path, fs, SALIDA } = require('./arnes');

const buscar = async (page, rut, { lugar = '1', esp = 'Medicina General', consent = true, avisos = false } = {}) => {
  await page.goto('/agendar');
  await page.fill('#rut', rut);
  await page.selectOption('#lugar', lugar);
  await page.selectOption('#esp', esp);
  if (consent) await page.check('[name=consentimiento]');
  if (avisos) await page.check('[name=comunicaciones]');
  await page.click('button[type=submit]:has-text("Ver días")');
  await page.waitForLoadState('networkidle');
};
const primerHorario = async (page) => {
  const enlace = page.locator('a[href*="/agendar/datos?"]').first();
  await enlace.waitFor({ timeout: 5000 });
  const href = await enlace.getAttribute('href');
  await enlace.click();
  await page.waitForLoadState('networkidle');
  return Number(new URL(href, 'http://x').searchParams.get('bloque'));
};

module.exports = async function portal({ browser, c }) {
  const F = 'Portal';
  // ── 1. Validación del RUT ───────────────────────────────────────────────
  let x = await nuevoContexto(browser, 'portal-01-validacion-rut');
  let page = await x.nueva();
  await paso(F, 'RUT con dígito verificador incorrecto muestra error', page, async () => {
    await buscar(page, '11111111-2');
    const t = await page.locator('body').innerText();
    afirmar(/Revisa el RUT/.test(t), 'no mostró el error de RUT');
    afirmar(page.url().endsWith('/agendar'), 'avanzó con un RUT inválido');
  });
  await paso(F, 'RUT vacío / texto no numérico no avanza', page, async () => {
    await page.goto('/agendar');
    await page.fill('#rut', 'abc');
    await page.selectOption('#lugar', '1'); await page.selectOption('#esp', 'Medicina General');
    await page.check('[name=consentimiento]');
    await page.click('button[type=submit]:has-text("Ver días")');
    afirmar(/Revisa el RUT/.test(await page.locator('body').innerText()) || page.url().endsWith('/agendar'), 'avanzó con RUT no numérico');
  });
  await paso(F, 'Sin consentimiento de datos no avanza', page, async () => {
    await buscar(page, '11111111-1', { consent: false });
    afirmar(!/calendario/.test(page.url()), 'avanzó sin consentimiento');
  });
  await paso(F, 'RUT con puntos y guion se acepta (formato 11.111.111-1)', page, async () => {
    await buscar(page, '11.111.111-1');
    afirmar(/calendario/.test(page.url()), `no avanzó: ${page.url()}`);
  });
  await cerrarContexto(x, 'portal-01-validacion-rut');

  // ── 2. Reserva completa de un paciente existente ─────────────────────────
  x = await nuevoContexto(browser, 'portal-02-reserva-paciente-existente');
  page = await x.nueva();
  const rut = '11111111-1';
  let bloque;
  await paso(F, 'Seleccionar policlínico y especialidad, ver disponibilidad', page, async () => {
    await buscar(page, rut, { avisos: true });
    afirmar(/calendario/.test(page.url()), 'no llegó al calendario');
    const horas = await page.locator('a[href*="/agendar/datos?"]').count();
    afirmar(horas > 0, 'sin horarios disponibles');
    return `${horas} horarios el primer día`;
  });
  await paso(F, 'Elegir otro día del calendario cambia los horarios', page, async () => {
    const dias = page.locator('.mes-g a');
    const n = await dias.count();
    afirmar(n > 1, 'solo hay un día con horas');
    const antes = await page.locator('.dia-t').innerText();
    await dias.nth(1).click(); await page.waitForLoadState('networkidle');
    afirmar((await page.locator('.dia-t').innerText()) !== antes, 'el día mostrado no cambió');
  });
  await paso(F, 'Elegir horario y profesional', page, async () => {
    bloque = await primerHorario(page);
    afirmar(/agendar\/datos/.test(page.url()), 'no pasó a Datos');
    afirmar(/Este paciente ya tiene un registro/.test(await page.locator('body').innerText()), 'no reconoció al paciente existente');
    return `bloque ${bloque}`;
  });
  await paso(F, 'Datos de contacto ocultos y editables; nombre visible', page, async () => {
    const t = await page.locator('body').innerText();
    afirmar(/Paciente A/.test(t), 'no muestra el nombre');
    afirmar(await page.locator('#nTelefono').isEditable(), 'el celular no es editable');
  });
  await paso(F, 'Celular inválido muestra mensaje de validación', page, async () => {
    await page.fill('#nTelefono', '12');
    await page.click('button:has-text("Continuar")'); await page.waitForLoadState('networkidle');
    afirmar(/Revisa el celular/.test(await page.locator('body').innerText()), 'no validó el celular');
    await page.fill('#nTelefono', '');
  });
  await paso(F, 'Continuar al resumen y confirmar la reserva', page, async () => {
    await page.click('button:has-text("Continuar")'); await page.waitForLoadState('networkidle');
    afirmar(/agendar\/revisar/.test(page.url()), `no llegó al resumen: ${page.url()}`);
    await page.click('button:has-text("Confirmar reserva")'); await page.waitForLoadState('networkidle');
    afirmar(/reservada correctamente/.test(await page.locator('body').innerText()), 'no mostró la confirmación');
  });
  await paso(F, 'La reserva queda registrada (una cita activa en el bloque)', page, async () => {
    const citas = (await c.citaRepo.buscarPorRut(rut)).filter((k) => k.idBloque === bloque && k.estadoReserva === 'ACTIVA');
    afirmar(citas.length === 1, `citas activas en el bloque: ${citas.length}`);
  });
  await paso(F, 'Comprobante PDF se genera y es válido', page, async () => {
    const enlace = await page.locator('a:has-text("Descargar comprobante")').getAttribute('href');
    const r = await x.context.request.get(enlace);
    afirmar(r.status() === 200, `estado ${r.status()}`);
    afirmar((await r.body()).subarray(0, 4).toString() === '%PDF', 'no es un PDF');
    afirmar(/pdf/.test(r.headers()['content-type']), 'tipo de contenido incorrecto');
  });
  await paso(F, 'Paciente sin sesión: no se envía comprobante a datos guardados y se explica', page, async () => {
    const com = c.extras.listar('comunicaciones').filter((m) => m.rut === rut);
    afirmar(com.length === 0, `se registraron ${com.length} mensajes (estado ${com.map((m) => m.estado)})`);
    afirmar(/Por seguridad, el comprobante no se envía/.test(await page.locator('body').innerText()), 'no explicó por qué no se envió');
  });
  await paso(F, 'Reconfirmar (recargar) no duplica la reserva', page, async () => {
    await page.reload(); await page.waitForLoadState('networkidle');
    const citas = (await c.citaRepo.buscarPorRut(rut)).filter((k) => k.idBloque === bloque && k.estadoReserva === 'ACTIVA');
    afirmar(citas.length === 1, `quedaron ${citas.length} citas`);
  });
  await cerrarContexto(x, 'portal-02-reserva-paciente-existente');

  // ── 3. Paciente nuevo con documento adjunto ─────────────────────────────
  x = await nuevoContexto(browser, 'portal-03-paciente-nuevo-con-documento');
  page = await x.nueva();
  const nuevo = rutNuevo(17654321);
  const pdf = path.join(SALIDA, 'fixture-orden.pdf');
  fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  let bloqueN;
  await paso(F, 'Paciente nuevo: buscar y elegir horario', page, async () => {
    await buscar(page, nuevo, { lugar: '2', esp: 'Kinesiología', avisos: true });
    afirmar(/calendario/.test(page.url()), 'no llegó al calendario');
    bloqueN = await primerHorario(page);
    afirmar(/Completa los datos del paciente/.test(await page.locator('body').innerText()), 'no pidió completar datos');
  });
  await paso(F, 'Campos obligatorios vacíos no permiten continuar', page, async () => {
    await page.click('button:has-text("Continuar")');
    afirmar(/agendar\/datos/.test(page.url()), 'avanzó sin datos obligatorios');
  });
  await paso(F, 'Completar datos, adjuntar documento y continuar', page, async () => {
    await page.fill('#fechaNacimiento', '1990-05-20');
    await page.fill('#nombres', 'Persona'); await page.fill('#apellidos', 'Prueba Uno');
    await page.fill('#telefono', '+56912345678'); await page.check('[name=tieneWhatsapp]');
    await page.fill('#direccion', 'Calle Uno 100');
    await page.selectOption('#idComuna', { index: 1 });
    await page.selectOption('#genero', 'FEMENINO');
    if (!(await page.locator('details.docs').evaluate((d) => d.open))) await page.locator('details.docs summary').click();
    await page.selectOption('#tipo1', 'Cartola FONASA');
    await page.setInputFiles('#doc1', pdf);
    await page.click('button:has-text("Continuar")'); await page.waitForLoadState('networkidle');
    afirmar(/agendar\/revisar/.test(page.url()), `no llegó al resumen: ${(await page.locator('body').innerText()).slice(0, 200)}`);
  });
  await paso(F, 'Confirmar: se crea la ficha y se guarda el documento', page, async () => {
    await page.click('button:has-text("Confirmar reserva")'); await page.waitForLoadState('networkidle');
    afirmar(/reservada correctamente/.test(await page.locator('body').innerText()), 'sin confirmación');
    const p = await c.catalogo.paciente(nuevo);
    afirmar(p && p.nombres === 'Persona', 'la ficha no se creó');
    const docs = c.documentos.listar().filter((d) => d.rut === nuevo);
    afirmar(docs.length === 1, `documentos guardados: ${docs.length}`);
    const cita = (await c.citaRepo.buscarPorRut(nuevo)).filter((k) => k.idBloque === bloqueN && k.estadoReserva === 'ACTIVA');
    afirmar(cita.length === 1, 'no quedó la cita');
    const com = c.extras.listar('comunicaciones').filter((m) => m.rut === nuevo);
    afirmar(com.length === 1 && com[0].estado === 'Simulado', `comunicación: ${JSON.stringify(com.map((m) => m.estado))}`);
    return 'comprobante en estado Simulado (sin envío real)';
  });
  await paso(F, 'Documento con tipo no permitido se rechaza', page, async () => {
    const n2 = rutNuevo(17654322);
    await buscar(page, n2, { lugar: '2', esp: 'Kinesiología' });
    await primerHorario(page);
    await page.fill('#fechaNacimiento', '1991-01-10'); await page.fill('#nombres', 'Otra'); await page.fill('#apellidos', 'Prueba Dos');
    await page.fill('#telefono', '+56911112222'); await page.fill('#direccion', 'Calle Dos 200');
    await page.selectOption('#idComuna', { index: 1 }); await page.selectOption('#genero', 'MASCULINO');
    const malo = path.join(SALIDA, 'fixture-malo.pdf'); fs.writeFileSync(malo, 'esto no es un pdf');
    if (!(await page.locator('details.docs').evaluate((d) => d.open))) await page.locator('details.docs summary').click();
    await page.selectOption('#tipo1', 'Cartola FONASA'); await page.setInputFiles('#doc1', malo);
    await page.click('button:has-text("Continuar")'); await page.waitForLoadState('networkidle');
    afirmar(/PDF, JPG o PNG/.test(await page.locator('body').innerText()), 'aceptó un archivo que no es PDF/JPG/PNG');
    fs.rmSync(malo);
  });
  fs.rmSync(pdf);
  await cerrarContexto(x, 'portal-03-paciente-nuevo-con-documento');

  // ── 4. Reservas simultáneas sobre el mismo cupo ─────────────────────────
  const xa = await nuevoContexto(browser, 'portal-04-reserva-simultanea-A');
  const xb = await nuevoContexto(browser, 'portal-04-reserva-simultanea-B');
  const pa = await xa.nueva(), pb = await xb.nueva();
  let bl;
  const llegarAlResumen = async (p, rutP) => {
    await buscar(p, rutP, { lugar: '3', esp: 'Medicina General' });
    const href = await p.locator('a[href*="/agendar/datos?"]').first().getAttribute('href');
    await p.goto(bl ? href.replace(/bloque=\d+/, `bloque=${bl}`) : href);
    bl ||= Number(new URL(href, 'http://x').searchParams.get('bloque'));
    await p.click('button:has-text("Continuar")'); await p.waitForLoadState('networkidle');
  };
  await paso(F, 'Dos pacientes llegan al resumen del mismo cupo', pa, async () => {
    await llegarAlResumen(pa, '11111111-1'); await llegarAlResumen(pb, '22222222-2');
    afirmar(/revisar/.test(pa.url()) && /revisar/.test(pb.url()), `A:${pa.url()} B:${pb.url()}`);
    return `bloque ${bl}`;
  });
  await paso(F, 'Confirmación simultánea: solo una reserva queda activa', pa, async () => {
    await Promise.all([pa.click('button:has-text("Confirmar reserva")'), pb.click('button:has-text("Confirmar reserva")')]);
    await Promise.all([pa.waitForLoadState('networkidle'), pb.waitForLoadState('networkidle')]);
    const activas = [...(await c.citaRepo.buscarPorRut('11111111-1')), ...(await c.citaRepo.buscarPorRut('22222222-2'))].filter((k) => k.idBloque === bl && k.estadoReserva === 'ACTIVA');
    afirmar(activas.length === 1, `cupo con ${activas.length} reservas activas`);
    const textos = [await pa.locator('body').innerText(), await pb.locator('body').innerText()];
    const exitos = textos.filter((t) => /reservada correctamente/.test(t)).length;
    afirmar(exitos === 1, `${exitos} pacientes vieron «reservada correctamente»`);
    afirmar(textos.some((t) => /ya no está disponible|ya fue reservad|otra persona|no está disponible/i.test(t)), 'el segundo paciente no recibió un mensaje claro: ' + textos.find((t) => !/reservada correctamente/.test(t)).slice(0, 160).replace(/\s+/g, ' '));
  });
  await cerrarContexto(xa, 'portal-04-reserva-simultanea-A'); await cerrarContexto(xb, 'portal-04-reserva-simultanea-B');

  // ── 5. Móvil ────────────────────────────────────────────────────────────
  x = await nuevoContexto(browser, 'portal-05-movil', { movil: true });
  page = await x.nueva();
  await paso(F, 'Móvil: búsqueda, calendario y datos sin desbordes', page, async () => {
    await buscar(page, '33333333-3', { lugar: '1', esp: 'Medicina General' });
    await primerHorario(page);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    afirmar(desborde <= 1, `desborde horizontal de ${desborde}px`);
    await page.screenshot({ path: path.join(SALIDA, 'capturas', 'portal-movil-datos.png'), fullPage: true });
  });
  await cerrarContexto(x, 'portal-05-movil');
  return [];
};

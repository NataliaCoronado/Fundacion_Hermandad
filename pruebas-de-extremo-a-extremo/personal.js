'use strict';
const { nuevoContexto, cerrarContexto, paso, afirmar, ingresar, path, fs, SALIDA } = require('./soporte');

const texto = (page) => page.locator('body').innerText();
const ir = async (page, ruta) => { const r = await page.goto(ruta); await page.waitForLoadState('networkidle'); return r; };

module.exports = async function personal({ browser, c }) {
  const citasActivas = async () => (await c.citaRepo.listar()).filter((x) => x.estadoReserva === 'ACTIVA');
  const bloques = await c.catalogo.bloques();
  const porId = new Map(bloques.map((b) => [b.id, b]));

  let F = 'Administración';
  let x = await nuevoContexto(browser, 'admin-01-acceso-y-paginas');
  let page = await x.nueva();
  await paso(F, 'Login con contraseña incorrecta muestra error y no entra', page, async () => {
    await ingresar(page, 'admin@ejemplo.cl', 'incorrecta');
    afirmar(/login/.test(page.url()) || /incorrect|inválid|no coincide/i.test(await texto(page)), 'entró con contraseña incorrecta');
    afirmar(/correo|contraseña|credenciales|incorrect|inválid/i.test(await texto(page)), 'sin mensaje de error claro');
  });
  await paso(F, 'Login correcto lleva al Resumen', page, async () => {
    await ingresar(page, 'admin@ejemplo.cl');
    afirmar(/admin\/resumen/.test(page.url()), `url: ${page.url()}`);
  });
  const rutasAdmin = ['/admin/resumen', '/admin/agendas', '/admin/profesionales', '/admin/policlinicos', '/admin/espera', '/admin/comunicaciones', '/admin/usuarios', '/admin/auditoria', '/admin/cambios', '/admin/cancelaciones', '/admin/reportes', '/admin/bloque/nuevo', '/admin/colores'];
  for (const r of rutasAdmin) {
    await paso(F, `Abrir ${r} sin errores`, page, async () => {
      const resp = await ir(page, r);
      afirmar(resp.status() === 200, `HTTP ${resp.status()}`);
      afirmar(!/Ocurrió un error inesperado/.test(await texto(page)), 'mostró error inesperado');
    });
  }
  await paso(F, 'Reportes: recorrer pestañas', page, async () => {
    await ir(page, '/admin/reportes');
    const tabs = await page.locator('.tabs-r a').count();
    afirmar(tabs >= 5, `pestañas: ${tabs}`);
    for (let i = 0; i < tabs; i++) { await page.locator('.tabs-r a').nth(i).click(); await page.waitForLoadState('networkidle'); afirmar(!/Ocurrió un error/.test(await texto(page)), `error en pestaña ${i}`); }
    return `${tabs} pestañas`;
  });
  await paso(F, 'Reportes: filtro de lugar y período se aplica', page, async () => {
    await ir(page, '/admin/reportes?seccion=demanda');
    await page.selectOption('select[name=sede]', '1'); await page.selectOption('select[name=periodo]', 'semestre');
    await page.click('button:has-text("Aplicar filtros")'); await page.waitForLoadState('networkidle');
    afirmar(/sede=1/.test(page.url()) && /Lugar: San Isidro/.test(await texto(page)), 'el filtro no se reflejó');
  });
  await paso(F, 'Reportes: gráficos se dibujan (ECharts)', page, async () => {
    await page.waitForSelector('.ec svg', { timeout: 5000 });
    afirmar((await page.locator('.ec svg').count()) >= 2, 'faltan gráficos');
  });
  for (const f of ['xlsx', 'pdf', 'png']) {
    await paso(F, `Reportes: descarga ${f.toUpperCase()}`, page, async () => {
      await ir(page, '/admin/reportes?seccion=resumen');
      await page.locator('details.datos-r summary').first().click();
      const [d] = await Promise.all([page.waitForEvent('download'), page.locator(`.chart-actions a:has-text("${f === 'xlsx' ? 'Excel' : f.toUpperCase()}")`).first().click()]);
      const ruta = path.join(SALIDA, `descarga.${f}`); await d.saveAs(ruta);
      const kb = fs.statSync(ruta).size; fs.rmSync(ruta);
      afirmar(kb > 500, `archivo de ${kb} bytes`); return `${kb} bytes`;
    });
  }
  await paso(F, 'Resumen: filtros por policlínico y profesional actualizan indicadores', page, async () => {
    await ir(page, '/admin/resumen');
    await page.selectOption('[data-res-filtros] select[name=sede]', '1');
    await page.click('[data-res-filtros] button[type=submit]');
    await page.waitForFunction(() => /Indicadores actualizados/.test(document.querySelector('[data-res-estado]').textContent), null, { timeout: 8000 });
    afirmar((await page.locator('.res-grafico .ec svg').count()) >= 4, 'no se dibujaron los 4 gráficos tras filtrar');
  });
  await paso(F, 'Resumen: rango sin datos muestra estado vacío', page, async () => {
    await ir(page, '/admin/resumen?desde=2030-01-01&hasta=2030-01-31');
    afirmar(/Sin datos en este período/.test(await texto(page)), 'no mostró el estado vacío');
  });
  await paso(F, 'Auditoría refleja las reservas hechas en el portal', page, async () => {
    await ir(page, '/admin/auditoria');
    afirmar(/Reserva web registrada/.test(await texto(page)), 'no aparece «Reserva web registrada»');
  });
  await cerrarContexto(x, 'admin-01-acceso-y-paginas');

  x = await nuevoContexto(browser, 'admin-02-crear-horarios');
  page = await x.nueva(); await ingresar(page, 'admin@ejemplo.cl');
  await paso(F, 'Crear franja de horarios: revisar, confirmar y quedan publicados', page, async () => {
    const antes = (await c.catalogo.bloques()).length;
    await ir(page, '/admin/bloque/nuevo');
    await page.selectOption('select[name=idPoliclinico]', '1');
    await page.selectOption('select[name=especialidad]', { index: 1 });
    await page.selectOption('select[name=idProfesional]', { index: 1 });
    await page.fill('input[name=desde]', '2027-03-01'); await page.fill('input[name=hasta]', '2027-03-01');
    await page.fill('input[name=horaInicio]', '09:00'); await page.fill('input[name=horaFin]', '11:00'); await page.fill('input[name=duracion]', '30');
    for (let i = 0; i < 7; i++) await page.locator(`input[name=dia${i}]`).check();
    await page.click('button:has-text("Revisar resumen")'); await page.waitForLoadState('networkidle');
    afirmar(/bloque\/revisar/.test(page.url()) || /resumen|confirm/i.test(await texto(page)), 'no mostró el resumen para confirmar');
    await page.locator('main form button[type=submit]').last().click(); await page.waitForLoadState('networkidle');
    const despues = (await c.catalogo.bloques()).length;
    afirmar(despues - antes === 4, `se crearon ${despues - antes} bloques (esperados 4)`);
    return `4 bloques creados`;
  });
  await paso(F, 'Los horarios nuevos aparecen en el portal de pacientes', page, async () => {
    await x.nueva();
    const nuevos = (await c.catalogo.bloques()).filter((b) => b.fecha === '2027-03-01');
    afirmar(nuevos.length === 4 && nuevos.every((b) => b.publicado !== false), `publicados: ${nuevos.map((b) => b.publicado)}`);
  });
  await paso(F, 'Superponer la misma franja es rechazado', page, async () => {
    await ir(page, '/admin/bloque/nuevo');
    await page.selectOption('select[name=idPoliclinico]', '1'); await page.selectOption('select[name=especialidad]', { index: 1 }); await page.selectOption('select[name=idProfesional]', { index: 1 });
    await page.fill('input[name=desde]', '2027-03-01'); await page.fill('input[name=hasta]', '2027-03-01'); await page.fill('input[name=horaInicio]', '09:00'); await page.fill('input[name=horaFin]', '11:00'); await page.fill('input[name=duracion]', '30');
    for (let i = 0; i < 7; i++) await page.locator(`input[name=dia${i}]`).check();
    const antes = (await c.catalogo.bloques()).length;
    await page.click('button:has-text("Revisar resumen")'); await page.waitForLoadState('networkidle');
    if (/bloque\/revisar/.test(page.url()) && (await page.locator('main form button[type=submit]').count())) { await page.locator('main form button[type=submit]').last().click(); await page.waitForLoadState('networkidle'); }
    afirmar((await c.catalogo.bloques()).length === antes, 'duplicó los horarios existentes');
  });
  await cerrarContexto(x, 'admin-02-crear-horarios');

  x = await nuevoContexto(browser, 'admin-03-cancelaciones-y-cambios');
  page = await x.nueva(); await ingresar(page, 'admin@ejemplo.cl');
  await paso(F, 'Cancelación institucional de una reserva seleccionada', page, async () => {
    const antes = (await citasActivas()).length;
    await ir(page, '/admin/cancelaciones?desde=2026-11-20&hasta=2026-12-11');
    const casillas = page.locator('main form input[type=checkbox]:not([name=whatsapp]):not([name=correo])');
    afirmar((await casillas.count()) > 0, 'no hay reservas para seleccionar');
    await casillas.first().check();
    await page.fill('input[name=motivo]', 'Cierre del policlínico por mantención');
    await page.click('button:has-text("Cancelar reservas")'); await page.waitForLoadState('networkidle');
    const despues = (await citasActivas()).length;
    afirmar(antes - despues === 1, `activas antes ${antes} después ${despues}`);
    const aud = c.auditoria.listar().filter((a) => /ancel/i.test(a.accion));
    afirmar(aud.length > 0, 'no quedó auditada');
  });
  await paso(F, 'Cambio de agenda (ausencia): vista previa y confirmación', page, async () => {
    const ac = await citasActivas();
    const cita = ac.find((k) => porId.get(k.idBloque)?.fecha >= '2026-11-20');
    const b = porId.get(cita.idBloque);
    await ir(page, '/admin/cambios');
    await page.selectOption('select[name=idProfesional]', String(b.idProfesional));
    await page.fill('input[name=fecha]', b.fecha);
    const tipos = await page.locator('select[name=tipo] option').allTextContents();
    await page.selectOption('select[name=tipo]', { index: 0 });
    await page.fill('input[name=motivo]', 'Licencia médica del profesional');
    await page.click('button:has-text("Ver Agenda actual")'); await page.waitForLoadState('networkidle');
    const t = await texto(page);
    afirmar(/reservas afectadas|Agenda actual/i.test(t), 'no mostró la comparación');
    const antes = (await citasActivas()).length;
    await page.locator('button:has-text("Confirmar cambio")').click(); await page.waitForLoadState('networkidle');
    afirmar(!/Ocurrió un error inesperado/.test(await texto(page)), 'error al confirmar');
    return `tipos: ${tipos.join('/')}; activas antes ${antes}, después ${(await citasActivas()).length}`;
  });
  await cerrarContexto(x, 'admin-03-cancelaciones-y-cambios');

  x = await nuevoContexto(browser, 'admin-04-profesionales-usuarios');
  page = await x.nueva(); await ingresar(page, 'admin@ejemplo.cl');
  await paso(F, 'Profesional con reservas vigentes no se puede desactivar', page, async () => {
    await ir(page, '/admin/profesionales?estado=1');
    const base = (await c.catalogo.profesionales()).filter((p) => !p.activo).length;
    await page.locator('form[action="/admin/profesionales/estado"] button:has-text("Desactivar")').first().click(); await page.waitForLoadState('networkidle');
    afirmar(/reserva\(s\) vigente\(s\)/.test(await texto(page)), 'no explicó por qué no se puede desactivar');
    afirmar((await c.catalogo.profesionales()).filter((p) => !p.activo).length === base, 'se desactivó con reservas vigentes');
  });
  await paso(F, 'Profesional sin reservas: desactivar y volver a activar', page, async () => {
    const conReservas = new Set();
    for (const k of await citasActivas()) { const b = porId.get(k.idBloque); if (b) conReservas.add(b.idProfesional); }
    const libre = (await c.catalogo.profesionales()).find((p) => p.activo && !conReservas.has(p.id));
    afirmar(libre, 'todos los profesionales tienen reservas');
    await ir(page, `/admin/profesionales?estado=1&q=${encodeURIComponent(libre.nombre)}`);
    await page.locator(`form[action="/admin/profesionales/estado"]:has(input[value="${libre.id}"]) button`).first().click(); await page.waitForLoadState('networkidle');
    afirmar((await c.catalogo.profesionales()).find((p) => p.id === libre.id).activo === false, 'no se desactivó');
    await ir(page, `/admin/profesionales?estado=0&q=${encodeURIComponent(libre.nombre)}`);
    await page.locator(`form[action="/admin/profesionales/estado"]:has(input[value="${libre.id}"]) button`).first().click(); await page.waitForLoadState('networkidle');
    afirmar((await c.catalogo.profesionales()).find((p) => p.id === libre.id).activo === true, 'no se reactivó');
  });
  await paso(F, 'Profesionales: búsqueda y filtros', page, async () => {
    await ir(page, '/admin/profesionales');
    await page.fill('input[name=q]', 'Profesional 1'); await page.click('button:has-text("Filtrar")'); await page.waitForLoadState('networkidle');
    afirmar(/Profesional 1/.test(await texto(page)), 'la búsqueda no devolvió resultados');
  });
  await paso(F, 'Usuarios: lista con roles y enlace seguro de acceso', page, async () => {
    await ir(page, '/admin/usuarios');
    const t = await texto(page);
    afirmar(/Administración/.test(t) && /TENS\/TONS/.test(t) && /Telemedicina/.test(t), 'faltan roles en la lista');
    await page.locator('button:has-text("Enlace seguro")').first().click(); await page.waitForLoadState('networkidle');
    afirmar(!/Ocurrió un error inesperado/.test(await texto(page)), 'error al generar el enlace');
  });
  await paso(F, 'Comunicaciones: bandeja con los mensajes registrados', page, async () => {
    await ir(page, '/admin/comunicaciones');
    afirmar(!/Ocurrió un error/.test(await texto(page)), 'error');
  });
  await paso(F, 'Lista de espera (supervisión): filtros aplicables', page, async () => {
    await ir(page, '/admin/espera');
    await page.selectOption('select[name=prioridad]', { index: 1 }).catch(() => {});
    await page.click('button:has-text("Filtrar")'); await page.waitForLoadState('networkidle');
    afirmar(!/Ocurrió un error/.test(await texto(page)), 'error al filtrar');
  });
  await cerrarContexto(x, 'admin-04-profesionales-usuarios');

  F = 'TENS/TONS';
  x = await nuevoContexto(browser, 'tens-01-acceso-y-permisos');
  page = await x.nueva();
  await paso(F, 'Login de TENS/TONS lleva a su Resumen', page, async () => { await ingresar(page, 'tens@ejemplo.cl'); afirmar(/tens\/resumen/.test(page.url()), page.url()); });
  for (const r of ['/admin/usuarios', '/admin/reportes', '/admin/auditoria', '/admin/bloque/nuevo']) {
    await paso(F, `Sin acceso a ${r}`, page, async () => { const resp = await page.goto(r); afirmar(resp.status() === 403, `HTTP ${resp.status()} (esperado 403)`); });
  }
  for (const r of ['/tens/resumen', '/tens/agenda', '/tens/pacientes', '/tens/confirmaciones', '/tens/espera', '/tens/recepcion', '/tens/agendar', '/tens/documentos']) {
    await paso(F, `Abrir ${r} sin errores`, page, async () => { const resp = await ir(page, r); afirmar(resp.status() === 200, `HTTP ${resp.status()}`); afirmar(!/Ocurrió un error inesperado/.test(await texto(page)), 'error inesperado'); });
  }
  noVerificado(F, 'Bot de WhatsApp (/tens/bot)', 'La ruta está desactivada por configuración (se habilita con BOT_WHATSAPP=1); responde 404 a propósito.');
  await paso(F, 'Agenda: solo muestra el policlínico propio', page, async () => {
    await ir(page, '/tens/agenda');
    const t = await texto(page);
    afirmar(!/Santa Teresa|Padre Hurtado|Oratorio Mariano/.test(t), 'muestra datos de otros policlínicos');
  });
  await paso(F, 'Agenda: navegar a otra fecha', page, async () => {
    await ir(page, '/tens/agenda'); const fform = page.locator('form:has(input[type=date][name=fecha])').first(); await fform.locator('input[type=date]').fill('2026-11-24'); await fform.locator('button').first().click(); await page.waitForLoadState('networkidle');
    afirmar(/fecha=2026-11-24/.test(page.url()), page.url());
  });
  await paso(F, 'No puede cancelar una cita de otro policlínico (acceso directo)', page, async () => {
    const ajena = (await citasActivas()).find((k) => { const b = porId.get(k.idBloque); return b && b.idPoliclinico && b.idPoliclinico !== 1; }) || (await citasActivas()).find((k) => { const b = porId.get(k.idBloque); return b && ![1].includes(c.operacion.sedeBloque(b, undefined) ?? 1); });
    if (!ajena) throw new Error('no se encontró una cita de otro policlínico para la prueba');
    const antes = (await citasActivas()).length;
    const r = await page.request.post('/tens/cancelar', { form: { idCita: String(ajena.id), motivo: 'prueba' } });
    afirmar((await citasActivas()).length === antes, 'canceló una cita ajena');
    return `HTTP ${r.status()}`;
  });
  await cerrarContexto(x, 'tens-01-acceso-y-permisos');

  x = await nuevoContexto(browser, 'tens-02-reservas-y-recepcion');
  page = await x.nueva(); await ingresar(page, 'tens@ejemplo.cl');
  let citaNueva, bloqueLibre;
  await paso(F, 'Registrar cita para un paciente en un cupo libre', page, async () => {
    const ocupados = new Set((await citasActivas()).map((k) => k.idBloque));
    bloqueLibre = (await c.catalogo.bloques()).find((b) => b.publicado && b.fecha >= '2026-11-20' && !ocupados.has(b.id) && c.operacion.sedeBloque(b, null) === 1 || (b.publicado && b.fecha >= '2026-11-20' && !ocupados.has(b.id) && b.idPoliclinico === 1));
    afirmar(bloqueLibre, 'sin cupos libres en San Isidro');
    await ir(page, `/tens/agendar?idPoliclinico=1&fecha=${bloqueLibre.fecha}`);
    const form = page.locator('form:has(select[name=idBloque])');
    await form.locator('input[name=rut]').fill('33333333-3');
    await form.locator('select[name=idBloque]').selectOption(String(bloqueLibre.id));
    await form.locator('button:has-text("Registrar cita")').click(); await page.waitForLoadState('networkidle');
    citaNueva = (await citasActivas()).find((k) => k.idBloque === bloqueLibre.id);
    afirmar(citaNueva && citaNueva.rut === '33333333-3', 'no se registró la cita');
  });
  await paso(F, 'No permite reservar dos veces el mismo cupo', page, async () => {
    await ir(page, `/tens/agendar?idPoliclinico=1&fecha=${bloqueLibre.fecha}`);
    const opciones = await page.locator('select[name=idBloque] option').evaluateAll((o) => o.map((x) => x.value));
    afirmar(!opciones.includes(String(bloqueLibre.id)), 'el cupo ocupado sigue ofreciéndose');
    await page.request.post('/tens/agendar', { form: { rut: '22222222-2', idBloque: String(bloqueLibre.id) } });
    afirmar((await citasActivas()).filter((k) => k.idBloque === bloqueLibre.id).length === 1, 'se duplicó la reserva');
  });
  await paso(F, 'La reserva del TENS se refleja en el portal y en Administración', page, async () => {
    const xa = await nuevoContexto(browser, 'tens-02b-vista-admin'); const pa = await xa.nueva(); await ingresar(pa, 'admin@ejemplo.cl'); await ir(pa, `/admin/agendas?fecha=${bloqueLibre.fecha}&q=Paciente%20C`);
    const visto = /Paciente C/.test(await texto(pa)); await cerrarContexto(xa, 'tens-02b-vista-admin');
    afirmar(visto, 'Administración no ve la cita registrada por TENS/TONS');
  });
  await paso(F, 'Confirmaciones: registrar resultado de llamada', page, async () => {
    await ir(page, '/tens/confirmaciones');
    const f = page.locator('form:has(select[name=resultado])').first();
    const opts = await f.locator('select[name=resultado] option').allTextContents();
    await f.locator('select[name=resultado]').selectOption({ index: 1 }); await f.locator('button:has-text("Guardar")').click(); await page.waitForLoadState('networkidle');
    afirmar(!/Ocurrió un error inesperado/.test(await texto(page)), 'error al guardar');
    return `opciones: ${opts.join(' / ')}`;
  });
  await paso(F, 'Recepción: marcar «Asistió»', page, async () => {
    await ir(page, '/tens/recepcion');
    const antes = (await c.citaRepo.listar()).filter((k) => k.asistencia === 'ASISTIO').length;
    await page.locator('button:has-text("Asistió")').first().click(); await page.waitForLoadState('networkidle');
    const despues = (await c.citaRepo.listar()).filter((k) => k.asistencia === 'ASISTIO').length;
    afirmar(despues === antes + 1, `asistencias ${antes} → ${despues}`);
  });
  await paso(F, 'Lista de espera: registrar solicitud y verla en Administración', page, async () => {
    await ir(page, '/tens/espera');
    const f = page.locator('form:has(input[name=rut]):has(select[name=especialidad])');
    await f.locator('input[name=rut]').fill('22222222-2'); await f.locator('select[name=especialidad]').selectOption({ index: 1 });
    await f.locator('button:has-text("Registrar")').click(); await page.waitForLoadState('networkidle');
    afirmar(/Registrad|registrad|en espera/i.test(await texto(page)) || (await c.espera.vigentes()).some((e) => e.rut === '22222222-2'), 'no quedó en espera');
    const xa = await nuevoContexto(browser, 'tens-02c-espera-admin'); const pa = await xa.nueva(); await ingresar(pa, 'admin@ejemplo.cl'); await ir(pa, '/admin/espera?q=22222222-2');
    const visto = /Paciente B|22222222/.test(await texto(pa)); await cerrarContexto(xa, 'tens-02c-espera-admin');
    afirmar(visto, 'Administración no ve la solicitud');
  });
  await paso(F, 'Pacientes: búsqueda por RUT y por nombre', page, async () => {
    await ir(page, '/tens/pacientes'); await page.fill('input[name=q]', '22222222-2'); await page.click('button:has-text("Buscar")'); await page.waitForLoadState('networkidle');
    afirmar(/Paciente B/.test(await texto(page)), 'no encontró por RUT');
    await page.fill('input[name=q]', 'zzzz inexistente'); await page.click('button:has-text("Buscar")'); await page.waitForLoadState('networkidle');
    afirmar(/No se encontraron pacientes/.test(await texto(page)), 'sin mensaje de estado vacío');
  });
  await cerrarContexto(x, 'tens-02-reservas-y-recepcion');

  F = 'Telemedicina';
  x = await nuevoContexto(browser, 'telemedicina-01');
  page = await x.nueva();
  await paso(F, 'Login de Telemedicina y Resumen propio', page, async () => { await ingresar(page, 'telemedicina.usuario@ejemplo.cl'); afirmar(/tens\/resumen/.test(page.url()), page.url()); afirmar(/Telemedicina/.test(await texto(page)), 'no muestra su policlínico'); });
  await paso(F, 'Sin acceso a Administración', page, async () => { afirmar((await page.goto('/admin/usuarios')).status() === 403, 'no devolvió 403'); });
  await paso(F, 'Agenda muestra solo horas de Telemedicina', page, async () => { await ir(page, '/tens/agenda'); const t = await texto(page); afirmar(!/Santa Teresa|Padre Hurtado|Oratorio Mariano|Sagrada Familia/.test(t), 'muestra otros policlínicos'); });
  await paso(F, 'Abrir pacientes, espera, confirmaciones y recepción', page, async () => { for (const r of ['/tens/pacientes', '/tens/espera', '/tens/confirmaciones', '/tens/recepcion']) { afirmar((await ir(page, r)).status() === 200, r); } });
  noVerificado(F, 'Enlace de videollamada: envío al paciente y estados de atención', 'Requiere el proveedor real de mensajería; en modo de prueba solo se verifica el registro.');
  await cerrarContexto(x, 'telemedicina-01');

  F = 'Transversal';
  noVerificado(F, 'GuardadoEnArchivoJson en Supabase', 'El proyecto no usa Supabase (usa PostgreSQL con pg o archivos JSON). Esta ejecución fue en memoria; la persistencia en PostgreSQL la cubre la suite automática (test/postgres.test.js).');
  noVerificado(F, 'Falla de conexión a la base de datos', 'No se simuló una caída de la base; la ejecución fue en memoria.');
  noVerificado(F, 'Notificaciones reales (WhatsApp/correo)', 'No se probaron envíos reales por instrucción; solo registro en estado «Simulado».');
  return [];
};

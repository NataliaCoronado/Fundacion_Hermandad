'use strict';
const { pagina } = require('./layout');
const { raw, tabla, opciones, forma, esc, foto } = require('./componentesComunes');
const { ico } = require('./iconos');
const graficos = require('./graficos');
const { infoSede, formatoTelefono } = require('../models/informacionDeSedes');

const ROLES = { ADMINISTRACION: 'Administración', TENS_TONS: 'TENS/TONS', TELEMEDICINA: 'Telemedicina' };
const pct = (v) => (v === null || v === undefined ? '—' : `${v} %`);
const parametros = (obj) => { const p = new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')); const t = p.toString(); return t ? `?${t}` : ''; };

const encabezado = (titulo, sub, acciones = '') => `<div class="hola"><div><h2>${esc(titulo)}</h2><p>${sub}</p></div>${acciones ? `<div class="rapidas">${acciones}</div>` : ''}</div>`;

function variacion(actual, previo, { tipo = 'rel', menorEsMejor = false, base = 'periodo anterior' } = {}) {
  if (actual === null || previo === null || previo === undefined || (tipo === 'rel' && !previo)) return '';
  const d = tipo === 'rel' ? Math.round(((actual - previo) / previo) * 100) : actual - previo;
  if (d === 0) return `<small class="dl neutro">Sin cambio vs ${esc(base)}</small>`;
  const sube = d > 0; const bueno = menorEsMejor ? !sube : sube;
  return `<small class="dl ${bueno ? 'bueno' : 'malo'}"><span aria-hidden="true">${sube ? '▲' : '▼'}</span> ${sube ? 'Sube' : 'Baja'} ${Math.abs(d)}${tipo === 'rel' ? ' %' : ' pts'} vs ${esc(base)}</small>`;
}
const kpi = ({ href, clase = '', icono, valor, texto, dl = '' }) => `<${href ? `a href="${href}"` : 'div'} class="kpi ${clase}"><span class="ico-c">${ico(icono)}</span><span><b>${valor}</b><span>${texto}</span>${dl}</span></${href ? 'a' : 'div'}>`;
const panelCaja = (titulo, cuerpo, enlace = '', extra = '') => `<section class="panel ${extra}"><div class="panel-t"><h2>${titulo}</h2>${enlace}</div>${cuerpo}</section>`;

const panel = ({ usuario, a30, a12, op, espera, cambios, auditoria, ctx }) => {
  const r = a30.resumen; const periodoAnterior = a30.anterior;
  const nombre = String(usuario.nombre || '').split(' ')[0];
  const dias = op.dias.filter((d) => d.reservados + d.libres + d.sinPublicar > 0);

  const alertas = [];
  if (op.sinConfirmar) alertas.push(['pend', 'telefono', `${op.sinConfirmar} citas sin confirmar en las próximas 48 horas`, 'TENS/TONS debe llamar a los pacientes para confirmar o liberar el cupo.', '']);
  if (op.sinCupos.length) alertas.push(['mal', 'reloj', `${op.sinCupos.length} profesionales sin cupos libres en 14 días`, op.sinCupos.slice(0, 3).map((x) => `${x.nombre} (${x.especialidad}, ${x.policlinico})`).join(' · ') + (op.sinCupos.length > 3 ? '…' : ''), `<a href="/admin/agendas?prof=${op.sinCupos[0].id}">Crear cupos →</a>`]);
  if (op.bajaOcupacion.length) alertas.push(['pend', 'edificio', `Baja ocupación próxima en ${op.bajaOcupacion.length} ${op.bajaOcupacion.length === 1 ? 'policlínico' : 'policlínicos'}`, op.bajaOcupacion.map((x) => `${x.policlinico}: ${x.ocupacion} %`).join(' · '), '<a href="/admin/policlinicos">Ver →</a>']);
  if (op.sinPublicar) alertas.push(['az', 'mas', `${op.sinPublicar} cupos creados sin publicar (próximos 14 días)`, 'Existen pero los pacientes todavía no los ven.', '<a href="/admin/agendas">Liberar →</a>']);
  if (espera.vigentes) alertas.push([espera.conCupo ? 'pend' : 'az', 'lista', `${espera.vigentes} personas en lista de espera`, espera.conCupo ? `${espera.conCupo} ya tienen un cupo compatible disponible: TENS/TONS puede asignarlo.` : 'Aún no hay cupos compatibles.', '']);
  const lista = alertas.length ? `<ul class="alertas">${alertas.map(([t, i, titulo, det, acc]) => `<li class="${t}"><span class="ico-c">${ico(i)}</span><span class="tx"><b>${esc(titulo)}</b><small>${esc(det)}</small></span>${acc}</li>`).join('')}</ul>` : '<p class="vacio">Todo en orden: no hay alertas.</p>';

  const capacidad = graficos.columnasApiladas({
    titulo: 'Cupos de los próximos 14 días por estado', etiquetas: dias.map((d) => d.fecha),
    segmentos: [{ nombre: 'Reservados', color: graficos.COLOR.azul, valores: dias.map((d) => d.reservados) }, { nombre: 'Disponibles', color: graficos.COLOR.aqua, valores: dias.map((d) => d.libres) }, { nombre: 'Sin publicar', color: graficos.COLOR.gris, valores: dias.map((d) => d.sinPublicar) }],
  });
  const tendencia = graficos.lineas({
    titulo: 'Citas activas e inasistencias por semana', etiquetas: a12.semanal.map((s) => s.semana),
    series: [{ nombre: 'Citas activas', color: graficos.COLOR.azul, valores: a12.semanal.map((s) => s.activas) }, { nombre: 'No asistieron', color: graficos.COLOR.naranja, valores: a12.semanal.map((s) => s.noAsistio) }],
  });
  const sedes = graficos.barras([...a30.porPoliclinico].sort((x, y) => y.citas - x.citas).map((x) => ({ nombre: x.policlinico, n: x.citas, extra: `ocupación ${pct(x.ocupacion)}` })), { vacio: 'Sin citas en el periodo.', titulo: 'Citas por policlínico' });
  const fechaCambio = (f) => String(f || '').slice(5).split('-').reverse().join('/');
  return pagina({
    titulo: 'Inicio', usuario, lienzo: true,
    contenido: `${encabezado(`Hola, ${nombre}`, `Resumen de la red: ${ctx.listaSedes.length} policlínicos y ${ctx.listaProfs.filter((x) => x.activo).length} profesionales activos. Indicadores de los últimos 30 días.`, `<a class="btn" href="/admin/agendas">${ico('mas')}Crear cupos</a><a class="btn sec" href="/admin/reportes">${ico('grafico')}Ver reportes</a>`)}
<div class="kpis">
${kpi({ href: '/admin/reportes', clase: 'dest', icono: 'calendario', valor: graficos.num(r.activas), texto: 'Citas activas (30 días)', dl: variacion(r.activas, periodoAnterior && periodoAnterior.activas, { base: '30 días previos' }) })}
${kpi({ href: '/admin/agendas', icono: 'reloj', valor: pct(r.ocupacion), texto: 'Ocupación de cupos publicados', dl: variacion(r.ocupacion, periodoAnterior && periodoAnterior.ocupacion, { tipo: 'pts', base: '30 días previos' }) })}
${kpi({ href: '/admin/reportes', clase: 'am', icono: 'cambio', valor: pct(r.tasaInasistencia), texto: 'Inasistencia (pérdida de horas)', dl: variacion(r.tasaInasistencia, periodoAnterior && periodoAnterior.tasaInasistencia, { tipo: 'pts', menorEsMejor: true, base: '30 días previos' }) })}
${kpi({ href: '/admin/agendas', clase: 'az', icono: 'check', valor: graficos.num(op.libres), texto: 'Cupos disponibles (próx. 14 días)', dl: `<small class="dl neutro">${graficos.num(op.reservados)} ya reservados</small>` })}
</div>
<div class="paneles">
<div class="col-p">
${panelCaja('Evolución semanal', `<p class="sub-p">Últimas 12 semanas completas: citas activas y pacientes que no asistieron. Pasa el cursor para ver el detalle.</p>${tendencia}`, '<a href="/admin/reportes">Reportes →</a>')}
${panelCaja('Capacidad de los próximos 14 días', `<p class="sub-p">Cuántos cupos están reservados, disponibles o todavía sin publicar. Sirve para decidir cuándo liberar más horas.</p>${capacidad}`, '<a href="/admin/agendas">Agendas y cupos →</a>')}
${panelCaja('Últimos cambios de agenda', cambios.length ? `<ul class="proximas">${cambios.map((c) => `<li><span class="hora"><small>${c.tipo === 'REEMPLAZO' ? 'Reempl.' : 'Ausencia'}</small><b>${esc(fechaCambio(c.fecha))}</b></span><span class="q"><b>${esc(ctx.profs.get(Number(c.idProfesional))?.nombre ?? '')}</b><small>${esc(c.motivo)}</small></span><span class="badge pend">${esc(c.citasAfectadas)} cita(s)</span></li>`).join('')}</ul>` : '<p class="vacio">Sin cambios registrados.</p>', '<a href="/admin/cambios">Registrar →</a>')}
</div>
<div class="col-p">
${panelCaja('Requiere atención', lista)}
${panelCaja('Citas por policlínico (30 días)', sedes, '<a href="/admin/policlinicos">Ver red →</a>')}
${panelCaja('Actividad reciente', auditoria.length ? `<ul class="actividad">${auditoria.map((x) => `<li><b>${esc(x.accion)}</b><small>${esc(x.usuario)} · ${esc(x.fecha)}</small></li>`).join('')}</ul>` : '<p class="vacio">Sin actividad registrada.</p>', '<a href="/admin/auditoria">Auditoría →</a>')}
</div></div>`,
  });
};

const policlinicos = ({ lista, hoy30, prox, profesionales, usuario }) => pagina({
  titulo: 'Policlínicos', usuario, lienzo: true,
  contenido: `${encabezado('Red de policlínicos', 'Ficha de cada sede con su actividad de los últimos 30 días y la disponibilidad de las próximas dos semanas.')}
<div class="sedes-g">${lista.map((s) => {
    const i = infoSede(s.id) || {}; const a = hoy30.find((x) => x.id === s.id) || {}; const b = prox.find((x) => x.id === s.id) || {};
    const profs = profesionales.filter((x) => x.idPoliclinico === s.id && x.activo).length;
    return `<article class="sede-c">${foto(s, 'foto lat')}<div class="sede-cab"><h3>${esc(s.nombre)}</h3><span class="chip">${s.telemedicina ? 'Telemedicina' : esc(s.comuna)}</span></div>
<p class="dir">${ico('ubicacion')}<span>${esc(i.direccion || 'Atención remota (videollamada)')}</span></p>
${i.whatsapp ? `<p class="dir">${ico('telefono')}<span>${esc(formatoTelefono(i.whatsapp))} · ${esc(i.correo || '')}</span></p>` : ''}
<div class="mini-k"><div><b>${profs}</b><span>Profesionales</span></div><div><b>${pct(a.ocupacion)}</b><span>Ocupación 30 d</span></div><div><b>${pct(a.tasaInasistencia)}</b><span>Inasistencia</span></div><div><b>${graficos.num(Math.max(0, (b.cupos || 0) - (b.activas || 0)))}</b><span>Cupos libres 14 d</span></div></div>
<div class="esps">${(i.especialidades || []).map((e) => `<span>${esc(e)}</span>`).join('')}</div>
<p class="enl"><a href="/admin/agendas${parametros({ sede: s.id })}">Ver agendas</a> · <a href="/admin/profesionales${parametros({ sede: s.id })}">Profesionales</a> · <a href="/admin/reportes${parametros({ sede: s.id })}">Reportes</a></p></article>`;
  }).join('')}</div>`,
});

const profesionales = ({ filas, ctx, filtro, especialidades, mensaje, usuario }) => pagina({
  titulo: 'Profesionales', usuario, mensaje, lienzo: true,
  contenido: `${encabezado('Profesionales de la salud', 'Estado, carga y disponibilidad de cada profesional. Al desactivar a alguien dejan de ofrecerse sus cupos sin cita.')}
<div class="cont"><form class="inl filtro" method="get" action="/admin/profesionales">
<label>Buscar <input type="search" name="q" value="${esc(filtro.q)}" placeholder="Nombre o especialidad"></label>
<label>Policlínico <select name="sede"><option value="">Todos</option>${opciones(ctx.listaSedes, (s) => s.id, (s) => s.nombre, filtro.sede)}</select></label>
<label>Especialidad <select name="esp"><option value="">Todas</option>${opciones(especialidades, (e) => e, (e) => e, filtro.esp)}</select></label>
<label>Estado <select name="estado"><option value="">Todos</option><option value="1"${filtro.estado === '1' ? ' selected' : ''}>Activos</option><option value="0"${filtro.estado === '0' ? ' selected' : ''}>Inactivos</option></select></label>
<button class="btn" type="submit">Filtrar</button><a class="btn sec" href="/admin/profesionales">Limpiar</a></form>
<p class="cuenta">${filas.length} ${filas.length === 1 ? 'profesional' : 'profesionales'}</p>
${tabla(['Profesional', 'Especialidad', 'Policlínico', 'Estado', 'Cupos libres (14 d)', 'Ocupación (30 d)', 'Inasistencia (30 d)', ''], filas.map((x) => [
    raw(`<b>${esc(x.profesional)}</b>`), x.especialidad, x.policlinico, x.activo ? 'Activo' : 'Inactivo', raw(`<span class="${x.libres === 0 && x.activo ? 'alerta-t' : ''}">${graficos.num(x.libres)}</span>`), raw(graficos.medidor(x.ocupacion)), x.tasaInasistencia === null ? '—' : `${x.tasaInasistencia} %`,
    raw(`<span class="acc-f"><a class="btn sec chico" href="/admin/agendas?prof=${x.id}">Agenda</a>${forma('/admin/profesionales/estado', { idProfesional: x.id, activo: x.activo ? '0' : '1' }, x.activo ? 'Desactivar' : 'Activar').replace('<form ', `<form ${x.activo ? 'onsubmit="return confirm(\'¿Desactivar a este profesional? Sus cupos sin cita dejarán de ofrecerse.\')" ' : ''}`)}</span>`)]), 'Ningún profesional coincide con el filtro.')}</div>`,
});

const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const agendas = ({ prof, sedeSel, sedes, profesionales: profs, semana, anterior, siguiente, hoyLunes, bloques, reservados, dias, mensaje, ctx, usuario }) => {
  const nombreProf = (p) => `${p.nombre} – ${p.especialidad}`;
  const cuenta = (f) => bloques.filter(f).length;
  const res = cuenta((b) => reservados.has(b.id)); const dis = cuenta((b) => b.publicado && !reservados.has(b.id)); const blo = cuenta((b) => !b.publicado && !reservados.has(b.id));
  const horas = [...new Set(bloques.map((b) => b.hora))].sort();
  const celda = (fecha, hora) => {
    const bloque = bloques.find((x) => x.fecha === fecha && x.hora === hora);
    if (!bloque) return '<div class="cl vac"></div>';
    if (reservados.has(bloque.id)) return '<div class="cl res"><b>Reservado</b></div>';
    const publicar = !bloque.publicado;
    return `<form method="post" action="/admin/agendas/publicar" class="inl cl ${publicar ? 'blo' : 'dis'}"><input type="hidden" name="idProfesional" value="${esc(prof.id)}"><input type="hidden" name="idBloque" value="${bloque.id}"><input type="hidden" name="desde" value="${bloque.fecha}"><input type="hidden" name="hasta" value="${bloque.fecha}"><input type="hidden" name="accion" value="${publicar ? 'publicar' : 'bloquear'}"><input type="hidden" name="semana" value="${esc(semana)}">
<button type="submit" title="${publicar ? 'Liberar este cupo' : 'Bloquear este cupo'}"><b>${publicar ? 'Bloqueado' : 'Disponible'}</b><small>${publicar ? 'Liberar' : 'Bloquear'}</small></button></form>`;
  };
  const cols = dias.map((d) => `<div class="cab-d${d.fecha === ctx.hoy ? ' hoy' : ''}"><small>${DIAS_C[d.i]}</small><b>${esc(d.fecha.slice(8))}</b></div>`).join('');
  const filasG = horas.map((h) => `<div class="hr">${esc(h)}</div>${dias.map((d) => celda(d.fecha, h)).join('')}`).join('');
  const hid = `<input type="hidden" name="semana" value="${esc(semana)}">`;
  const diasChk = [0, 1, 2, 3, 4, 5].map((i) => `<label class="check"><input type="checkbox" name="dia${i}" value="1"${i < 5 ? ' checked' : ''}> ${DIAS_C[i]}</label>`).join('');
  return pagina({
    titulo: 'Agendas y cupos', usuario, mensaje, lienzo: true,
    contenido: `${encabezado('Agendas y cupos', 'Un cupo <b>disponible</b> se ofrece a los pacientes; uno <b>bloqueado</b> existe pero no se ofrece. Así se liberan las horas de a poco. Los cupos con una cita no cambian.')}
<div class="cont">
<form class="inl filtro" method="get" action="/admin/agendas"><input type="hidden" name="semana" value="${esc(semana)}">
<label>Policlínico <select name="sede" onchange="this.form.prof.value='';this.form.submit()">${opciones(sedes, (s) => s.id, (s) => s.nombre, sedeSel)}</select></label>
<label>Profesional <select name="prof">${opciones(profs, (p) => p.id, nombreProf, prof?.id)}</select></label><button class="btn" type="submit">Ver agenda</button></form>
${prof ? `<div class="sem-nav"><a class="btn sec chico" href="/admin/agendas${parametros({ sede: sedeSel, prof: prof.id, semana: anterior })}">← Semana anterior</a><b>Semana del ${esc(graficos.fechaLarga(semana))}</b><a class="btn sec chico" href="/admin/agendas${parametros({ sede: sedeSel, prof: prof.id, semana: siguiente })}">Semana siguiente →</a>${semana !== hoyLunes ? `<a class="btn sec chico" href="/admin/agendas${parametros({ sede: sedeSel, prof: prof.id })}">Esta semana</a>` : ''}</div>
<div class="resumen-sem"><span><i class="c-res"></i><b>${res}</b> reservados</span><span><i class="c-dis"></i><b>${dis}</b> disponibles</span><span><i class="c-blo"></i><b>${blo}</b> bloqueados</span><span class="suave">${esc(prof.nombre)} · ${esc(prof.especialidad)}</span></div>
${horas.length ? `<div class="rejilla" style="--cols:${dias.length}"><div class="cab-d esq"></div>${cols}${filasG}</div><p class="nota">Pulsa un cupo disponible para bloquearlo, o uno bloqueado para liberarlo.</p>` : '<p class="vacio">Este profesional no tiene cupos creados esta semana. Usa «Crear cupos en serie» para programarlos.</p>'}
<h2>Herramientas de programación</h2>
<details class="herr" open><summary>Liberar o bloquear por fechas · ${esc(prof.nombre)}</summary>
<form method="post" action="/admin/agendas/publicar"><input type="hidden" name="idProfesional" value="${esc(prof.id)}">${hid}
<label>Desde <input type="date" name="desde" required value="${esc(semana)}"></label><label>Hasta <input type="date" name="hasta" required value="${esc(dias[dias.length - 1].fecha)}"></label>
<label>Acción <select name="accion"><option value="publicar">Liberar (ofrecer a pacientes)</option><option value="bloquear">Bloquear (dejar de ofrecer)</option></select></label>
<button type="submit">Aplicar al rango</button></form></details>
<details class="herr"><summary>Crear cupos en serie</summary>
<form method="post" action="/admin/agendas/serie"><input type="hidden" name="idProfesional" value="${esc(prof.id)}">${hid}
<label>Desde <input type="date" name="desde" required></label><label>Hasta <input type="date" name="hasta" required></label>
<label>Hora de inicio <input type="time" name="horaInicio" value="09:00" required></label><label>Hora de término <input type="time" name="horaFin" value="13:00" required></label>
<label>Duración de cada cupo (min) <input type="number" name="duracion" value="30" min="10" max="120" step="5" required></label>
<fieldset class="dias-f"><legend>Días de la semana</legend>${diasChk}</fieldset>
<label class="check"><input type="checkbox" name="publicado" value="1"> Dejarlos disponibles de inmediato (si no, quedan bloqueados para liberarlos de a poco)</label>
<button type="submit">Crear cupos</button></form></details>
<details class="herr"><summary>Liberar o bloquear en varios profesionales a la vez</summary>
<form method="post" action="/admin/agendas/masivo" onsubmit="return confirm('Se aplicará a todos los profesionales que coincidan. ¿Continuar?')"><input type="hidden" name="idProfesional" value="${esc(prof.id)}">${hid}
<label>Policlínico <select name="idPoliclinico"><option value="">Toda la red</option>${opciones(sedes, (s) => s.id, (s) => s.nombre)}</select></label>
<label>Especialidad <select name="especialidad"><option value="">Todas</option>${opciones(ctx.especialidades, (e) => e, (e) => e)}</select></label>
<label>Desde <input type="date" name="desde" required></label><label>Hasta <input type="date" name="hasta" required></label>
<label>Acción <select name="accion"><option value="publicar">Liberar (ofrecer a pacientes)</option><option value="bloquear">Bloquear (dejar de ofrecer)</option></select></label>
<button type="submit">Aplicar</button></form></details>
<details class="herr"><summary>Crear un cupo suelto</summary>
<form method="post" action="/admin/agendas"><input type="hidden" name="idProfesional" value="${esc(prof.id)}">${hid}
<label>Fecha <input type="date" name="fecha" required></label><label>Hora <input type="time" name="hora" required></label>
<label class="check"><input type="checkbox" name="publicado" value="1" checked> Dejarlo disponible de inmediato</label><button type="submit">Crear cupo</button></form></details>` : '<p class="vacio">No hay profesionales activos en este policlínico.</p>'}
</div>`,
  });
};

const cambios = ({ profesionales: profs, lista, ctx, mensaje, usuario }) => pagina({
  titulo: 'Cambios de agenda', usuario, mensaje,
  contenido: `<p>Ausencia: se cierran los cupos libres del día y las citas ya reservadas quedan para llamar. Reemplazo: las citas del día pasan al profesional indicado (misma especialidad y sede).</p>
<form method="post" action="/admin/cambios">
<label>Tipo <select name="tipo"><option value="AUSENCIA">Ausencia</option><option value="REEMPLAZO">Reemplazo</option></select></label>
<label>Profesional <select name="idProfesional">${opciones(profs, (p) => p.id, (p) => `${p.nombre} – ${p.especialidad} (${ctx.sedes.get(p.idPoliclinico)?.nombre})`)}</select></label>
<label>Reemplazante (solo reemplazo) <select name="idReemplazo"><option value="">—</option>${opciones(profs, (p) => p.id, (p) => `${p.nombre} – ${p.especialidad} (${ctx.sedes.get(p.idPoliclinico)?.nombre})`)}</select></label>
<label>Fecha <input type="date" name="fecha" required></label>
<label>Motivo <input name="motivo" maxlength="200" required></label>
<button type="submit">Registrar cambio</button></form>
<h2>Cambios registrados</h2>
${tabla(['Registrado', 'Tipo', 'Fecha', 'Profesional', 'Reemplazo', 'Motivo', 'Citas afectadas', 'Cupos cerrados'], lista.map((c) => [c.fechaRegistro, c.tipo === 'REEMPLAZO' ? 'Reemplazo' : 'Ausencia', c.fecha, ctx.profs.get(c.idProfesional)?.nombre, c.idReemplazo ? ctx.profs.get(c.idReemplazo)?.nombre : '—', c.motivo, c.citasAfectadas, c.bloquesCerrados]), 'Sin cambios registrados.')}`,
});

const reportes = ({ a, filtro, sedes, especialidades, rapidos, qsDescarga, usuario }) => {
  const r = a.resumen; const periodoAnterior = a.anterior; const caracterizacion = a.caracterizacion;
  const alcance = [filtro.idPoliclinico && sedes.find((s) => String(s.id) === String(filtro.idPoliclinico))?.nombre, filtro.especialidad].filter(Boolean).join(' · ') || 'Toda la red';
  const sinAtender = r.activas - r.asistio - r.noAsistio;
  const conDemanda = a.porProfesional.filter((x) => x.citas > 0);
  const tendencia = graficos.lineas({
    titulo: 'Citas activas e inasistencias por semana', etiquetas: a.semanal.map((s) => s.semana),
    series: [{ nombre: 'Citas activas', color: graficos.COLOR.azul, valores: a.semanal.map((s) => s.activas) }, { nombre: 'No asistieron', color: graficos.COLOR.naranja, valores: a.semanal.map((s) => s.noAsistio) }],
  });
  const inasist = graficos.lineas({
    titulo: 'Tasa de inasistencia por semana', etiquetas: a.semanal.map((s) => s.semana), sufijo: ' %',
    series: [{ nombre: 'Inasistencia', color: graficos.COLOR.naranja, valores: a.semanal.map((s) => s.tasaInasistencia ?? 0) }],
  });
  const caja = (t, c, extra = '') => panelCaja(t, c, '', extra);
  const total = (l) => l.reduce((s, x) => s + x.n, 0) || 1;
  const rel = (l) => l.map((x) => ({ ...x, extra: `${Math.round((x.n / total(l)) * 100)} % del total` }));
  return pagina({
    titulo: 'Reportes e indicadores', usuario, lienzo: true,
    contenido: `${encabezado('Reportes e indicadores', `${esc(graficos.fechaLarga(filtro.desde))} al ${esc(graficos.fechaLarga(filtro.hasta))} · ${esc(alcance)}. Solo totales: sin nombres ni RUT.`)}
<form class="filtro-r" method="get" action="/admin/reportes">
<div class="rapidos">${rapidos.map((x) => `<a class="${x.act ? 'act' : ''}" href="/admin/reportes${x.qs}">${esc(x.t)}</a>`).join('')}</div>
<label>Desde <input type="date" name="desde" value="${esc(filtro.desde)}"></label><label>Hasta <input type="date" name="hasta" value="${esc(filtro.hasta)}"></label>
<label>Policlínico <select name="sede"><option value="">Toda la red</option>${opciones(sedes, (s) => s.id, (s) => s.nombre, filtro.idPoliclinico)}</select></label>
<label>Especialidad <select name="esp"><option value="">Todas</option>${opciones(especialidades, (e) => e, (e) => e, filtro.especialidad)}</select></label>
<button class="btn" type="submit">Aplicar</button></form>
<div class="kpis">
${kpi({ clase: 'dest', icono: 'calendario', valor: graficos.num(r.activas), texto: 'Citas activas', dl: variacion(r.activas, periodoAnterior && periodoAnterior.activas, { base: 'periodo anterior' }) })}
${kpi({ icono: 'usuarios', valor: graficos.num(caracterizacion.atendidos), texto: 'Pacientes atendidos', dl: `<small class="dl neutro">${graficos.num(caracterizacion.conCita)} pacientes con citas</small>` })}
${kpi({ clase: 'am', icono: 'cambio', valor: pct(r.tasaInasistencia), texto: 'Inasistencia (pérdida)', dl: variacion(r.tasaInasistencia, periodoAnterior && periodoAnterior.tasaInasistencia, { tipo: 'pts', menorEsMejor: true, base: 'periodo anterior' }) })}
${kpi({ clase: 'gr', icono: 'reloj', valor: pct(r.ocupacion), texto: 'Ocupación de cupos publicados', dl: variacion(r.ocupacion, periodoAnterior && periodoAnterior.ocupacion, { tipo: 'pts', base: 'periodo anterior' }) })}
</div>
<div class="paneles dos-g">
${caja('Evolución semanal', `<p class="sub-p">Semanas completas del periodo: citas activas frente a pacientes que no asistieron.</p>${tendencia}`)}
${caja('Estado de las citas', `<p class="sub-p">${graficos.num(r.totalCitas)} citas registradas en el periodo.</p>${graficos.segmentada([
    { nombre: 'Asistieron', n: r.asistio, color: graficos.COLOR.aqua }, { nombre: 'No asistieron', n: r.noAsistio, color: graficos.COLOR.naranja },
    { nombre: 'Por atender', n: Math.max(0, sinAtender), color: graficos.COLOR.azul }, { nombre: 'Canceladas', n: r.canceladas, color: graficos.COLOR.gris }], 'Estado de las citas')}
<ul class="datos-l"><li><span>Confirmadas</span><b>${graficos.num(r.confirmadas)}</b></li><li><span>Sin confirmar</span><b>${graficos.num(r.pendientes)}</b></li><li><span>Cancelación</span><b>${pct(r.tasaCancelacion)}</b></li><li><span>Satisfacción (encuesta, 1 a 5)</span><b>${r.encuestas ? `${r.promedioEncuesta} · ${graficos.num(r.encuestas)} resp.` : 'Sin respuestas'}</b></li></ul>`)}
</div>
<div class="paneles dos-g">
${caja('Inasistencia semanal', `<p class="sub-p">Porcentaje de citas con atención registrada en que el paciente no llegó.</p>${inasist}`)}
${caja('Demanda por especialidad', `<p class="sub-p">Citas activas y ocupación de los cupos publicados.</p>${graficos.barras(a.porEspecialidad.map((e) => ({ nombre: e.nombre, n: e.citas, extra: `ocupación ${pct(e.ocupacion)} · inasistencia ${pct(e.tasaInasistencia)}` })), { vacio: 'Sin citas en el periodo.', titulo: 'Demanda por especialidad' })}`)}
</div>
<div class="hola" style="margin-top:8px"><div><h2>Caracterización de pacientes</h2><p>${graficos.num(caracterizacion.conCita)} pacientes con citas en el periodo, de ${graficos.num(caracterizacion.registrados)} fichas registradas.</p></div></div>
<div class="tres">
${caja('Por día de la semana', graficos.barras(a.porDia.map((d) => ({ nombre: d.nombre, n: d.n })), { color: graficos.COLOR.teal, titulo: 'Citas por día de la semana' }))}
${caja('Edad de los pacientes', `<p class="sub-p">${graficos.num(caracterizacion.mayores)} adultos mayores (60+) · ${graficos.num(caracterizacion.ninos)} niños y adolescentes.</p>${graficos.barras(rel(caracterizacion.edades), { color: graficos.COLOR.azul, titulo: 'Pacientes por tramo de edad' })}`)}
${caja('Sexo y nacionalidad', `<h3 class="mini-t">Sexo</h3>${graficos.barras(rel(caracterizacion.generos), { color: graficos.COLOR.azul, titulo: 'Pacientes por sexo' })}<h3 class="mini-t">Nacionalidad</h3>${graficos.barras(rel(caracterizacion.nacionalidades), { color: graficos.COLOR.azul, titulo: 'Pacientes por nacionalidad' })}`)}
</div>
<div class="cont" style="margin-top:20px"><h2>Por policlínico</h2>${tabla(['Policlínico', 'Citas', 'Asistieron', 'No asistieron', 'Canceladas', 'Inasistencia', 'Ocupación'], a.porPoliclinico.map((x) => [raw(`<b>${esc(x.policlinico)}</b>`), x.citas, x.asistio, x.noAsistio, x.canceladas, x.tasaInasistencia === null ? '—' : `${x.tasaInasistencia} %`, raw(graficos.medidor(x.ocupacion))]))}
<h2>Demanda por profesional</h2><p>${conDemanda.length} de ${a.porProfesional.length} profesionales tienen citas en el periodo (se muestran los 15 con más demanda; la descarga incluye a todos).</p>
${tabla(['Profesional', 'Especialidad', 'Policlínico', 'Citas', 'Asistieron', 'No asistieron', 'Canceladas', 'Cupos publicados', 'Ocupación'], conDemanda.slice(0, 15).map((x) => [x.profesional, x.especialidad, x.policlinico, x.citas, x.asistio, x.noAsistio, x.canceladas, x.cupos, raw(graficos.medidor(x.ocupacion))]), 'Aún no hay citas en el periodo.')}
<h2>Descargas</h2><p>Los archivos respetan los filtros elegidos. Excel los abre directamente; para PDF usa Imprimir → Guardar como PDF en esta página.</p>
<p class="descargas"><a class="btn sec" href="/admin/reportes/resumen.csv${qsDescarga}">Resumen y caracterización</a><a class="btn sec" href="/admin/reportes/profesionales.csv${qsDescarga}">Por profesional</a><a class="btn sec" href="/admin/reportes/citas.csv${qsDescarga}">Detalle de citas</a></p></div>`,
  });
};

const usuarios = ({ lista, ctx, usuario }) => pagina({
  titulo: 'Usuarios y roles', usuario, lienzo: true,
  contenido: `${encabezado('Usuarios y roles', 'Quién puede entrar al sistema y a qué parte. Administración gestiona la red; TENS/TONS y Telemedicina atienden pacientes en su sede.')}
<div class="cont"><div class="roles-r">${[['ADMINISTRACION', 'Administración', 'Red de policlínicos, agendas, reportes, usuarios y auditoría.'], ['TENS_TONS', 'TENS/TONS', 'Agenda, pacientes, confirmaciones y recepción de su policlínico.'], ['TELEMEDICINA', 'Telemedicina', 'Atención y agenda de la modalidad remota.']].map(([k, t, d]) => `<div><b>${t}</b><span class="chip">${lista.filter((u) => u.rol === k && u.activo).length} activos</span><small>${d}</small></div>`).join('')}</div>
${tabla(['Nombre', 'Correo', 'Rol', 'Policlínico', 'Estado'], lista.map((u) => [u.nombre, u.correo, ROLES[u.rol] || u.rol, u.idPoliclinico ? (ctx.sedes.get(Number(u.idPoliclinico))?.nombre ?? u.idPoliclinico) : 'Toda la red', u.activo ? 'Activo' : 'Inactivo']))}</div>`,
});

const auditoria = ({ lista, q, total, usuario }) => pagina({
  titulo: 'Auditoría', usuario, lienzo: true,
  contenido: `${encabezado('Auditoría', 'Registro de quién hizo qué y cuándo en el sistema. No contiene datos clínicos.')}
<div class="cont"><form class="inl filtro" method="get" action="/admin/auditoria"><label>Buscar <input type="search" name="q" value="${esc(q)}" placeholder="Usuario, acción o detalle"></label><button class="btn" type="submit">Buscar</button>${q ? '<a class="btn sec" href="/admin/auditoria">Limpiar</a>' : ''}</form>
<p class="cuenta">${lista.length === total ? `${total} registros` : `${lista.length} de ${total} registros`}${lista.length >= 200 ? ' (se muestran los 200 más recientes)' : ''}</p>
${tabla(['Fecha', 'Usuario', 'Acción', 'Detalle'], lista.map((x) => [x.fecha, x.usuario, x.accion, x.detalle || '—']), 'Sin registros.')}</div>`,
});

module.exports = { panel, policlinicos, profesionales, agendas, cambios, reportes, usuarios, auditoria };

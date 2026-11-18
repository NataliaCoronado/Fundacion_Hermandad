'use strict';
// Portal del paciente: flujo de reserva en 4 pasos (Buscar → Fecha y hora → Datos → Confirmar) y comprobante.
const { pagina, WHATSAPP, iniciales } = require('./layout');
const { ico } = require('./iconos');
const { esc } = require('./util');
const { fechaLarga, fila } = require('./paciente');
const { infoSede, formatoTelefono } = require('../models/sedesInfo');

const PASOS = ['Buscar', 'Fecha y hora', 'Datos', 'Confirmar'];
const barra = (n) => `<ol class="barra" aria-label="Pasos de la reserva">${PASOS.map((p, i) => `<li class="${i + 1 < n ? 'hecho' : i + 1 === n ? 'actual' : ''}"${i + 1 === n ? ' aria-current="step"' : ''}><span class="cuenta" aria-hidden="true">${i + 1}</span><span class="et">${p}${i + 1 < n ? '<span class="sr"> (listo)</span>' : ''}</span></li>`).join('')}</ol>`;
const q = (o) => new URLSearchParams(o).toString();
const AST = '<span class="req" aria-hidden="true">*</span>';
const ESTILOS = `<style>
.req{color:var(--err);margin-left:2px}.nota{font-size:.82rem;color:var(--muted)}
.form2{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.form2 .full{grid-column:1/-1}
@media(max-width:640px){.form2{grid-template-columns:1fr}}
.bloqueado input{background:#f1f5f6;color:var(--muted)}
.ficha-oculta{margin:18px 0 6px}.ficha-oculta>div{margin-bottom:12px}
.bloq-t{display:block;font-weight:600;font-size:.86rem;margin:0 0 6px;color:var(--navy)}
.bloq-v{display:flex;align-items:center;gap:10px;min-height:46px;padding:10px 14px;border:1.5px dashed var(--borde-2);border-radius:8px;background:#f1f5f6;color:var(--muted);font-variant-numeric:tabular-nums;letter-spacing:.02em}
.bloq-v svg{width:16px;height:16px;flex:none;color:var(--suave)}.bloq-v i{font-style:normal;color:var(--suave)}.bloqueado label:after{content:' (bloqueado)';font-weight:400;color:var(--suave)}
.busqueda-r{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:12px 16px;margin:0 0 22px}
.busqueda-r b{color:var(--navy)}.busqueda-r a{margin-left:auto}
.mes{background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:16px 18px;box-shadow:var(--sombra);max-width:620px;margin:0 0 26px}
.mes-cab{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.mes-cab b{font-size:1.05rem;text-transform:capitalize}.mes-cab svg{width:18px;height:18px}
.mes-cab a,.mes-cab span{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;border:1.5px solid var(--borde-2);text-decoration:none;color:var(--navy);font-weight:800}
.mes-cab span{opacity:.35}
.mes-g{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center}
.mes-g small{font-size:.72rem;color:var(--suave);font-weight:700}
.mes-g a,.mes-g span{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:52px;border-radius:10px;font-weight:700;text-decoration:none}
.mes-g span{color:#b6c3c8}.mes-g span.vacio{visibility:hidden}
.mes-g a{color:var(--navy);background:var(--claro);border:1.5px solid #cbe6eb}.mes-g a i{font-style:normal;font-size:.68rem;font-weight:600;color:var(--teal-t)}
.mes-g a.sel{background:var(--teal);color:#fff;border-color:var(--teal)}.mes-g a.sel i{color:#e6f6f7}
.inicio-dos{grid-template-columns:1fr 300px}@media(max-width:900px){.inicio-dos,.dos{grid-template-columns:1fr}}
.docs-reg li{margin:4px 0}
details.docs{background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:14px 18px;margin:18px 0}
details.docs summary{font-size:1rem}
.doc-fila{display:grid;grid-template-columns:220px 1fr;gap:12px;align-items:end}
@media(max-width:640px){.doc-fila{grid-template-columns:1fr}}
@media print{header.sup,footer.pie,.no-imprimir,.acc{display:none!important}}
</style>`;
const marco = (n, titulo, sub, cuerpo, mensaje, usuario, volver) => pagina({
  titulo, usuario, mensaje, portal: true, activo: 'agendar', encabezado: false, volver,
  portada: { titulo: esc(titulo), lead: esc(sub), extra: barra(n) },
  contenido: `${ESTILOS}${cuerpo}`,
});
const opciones = (lista, valor) => lista.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(valor ?? '') ? ' selected' : ''}${o.data || ''}>${esc(o.nombre)}</option>`).join('');
const mascaraNombre = (n) => String(n || '').split(/\s+/).filter(Boolean).map((w) => w[0] + '***').join(' ');
// Ficha de un RUT ya registrado, sin sesión: se muestra bloqueada y oculta en parte, para que la persona la reconozca.
const ocultaFin = (s, ver = 4) => { const x = String(s || ''); return x.length > ver ? '*'.repeat(x.length - ver) + x.slice(-ver) : x; };
const ocultaCorreo = (c) => (c ? String(c).replace(/^(.)[^@]*(@.*)$/, '$1***$2') : '');
const ocultaFecha = (f) => (f ? `**-**-${String(f).slice(0, 4)}` : '');
const bloq = (titulo, valor, full = false) => `<div${full ? ' class="full"' : ''}><span class="bloq-t">${titulo}</span><div class="bloq-v">${ico('candado')}<span>${valor ? esc(valor) : '<i>No registrado</i>'}</span></div></div>`;
const fichaOculta = (ficha, rut, comunas) => {
  const comuna = (comunas || []).find((c) => String(c.id) === String(ficha.idComuna));
  return `<div class="form2 ficha-oculta" aria-label="Datos guardados del paciente">${bloq('RUT', rut)}${bloq('Fecha de nacimiento', ocultaFecha(ficha.fechaNacimiento))}
${bloq('Nombre completo', mascaraNombre(ficha.nombre), true)}${bloq('Celular', ocultaFin(ficha.telefono))}${bloq('Correo electrónico', ocultaCorreo(ficha.correo))}
${bloq('Dirección', mascaraNombre(ficha.direccion), true)}${bloq('Comuna', comuna ? mascaraNombre(comuna.nombre) : '')}</div>`;
};

// ---------- Paso 1: buscar ----------
const inicio = ({ oferta, d = {}, mensaje, usuario, cuenta }) => {
  const { sedes, profs, espsPorLugar } = oferta;
  const lugares = [{ id: 'red', nombre: 'Toda la red (todos los lugares)' }, ...sedes.map((s) => ({ id: s.id, nombre: s.telemedicina ? 'Telemedicina (atención a distancia)' : `Policlínico ${s.nombre}` }))];
  const todasEsp = [...new Set(Object.values(espsPorLugar).flat())].sort((a, b) => a.localeCompare(b, 'es'));
  const espOpts = todasEsp.map((e) => ({ id: e, nombre: e, data: ` data-lugares="${Object.entries(espsPorLugar).filter(([, l]) => l.includes(e)).map(([k]) => k).join(',')}"` }));
  const profOpts = profs.map((p) => ({ id: p.id, nombre: `${p.nombre} · ${p.esps.join(', ')}`, data: ` data-lugares="${p.lugares.join(',')}"` }));
  const quien = cuenta
    ? `<label for="quien">¿Para quién es la hora? ${AST}</label><select id="quien" name="quien">${opciones([{ id: cuenta.rut, nombre: `Para mí (${cuenta.nombre})` }, ...cuenta.familiares.map((f) => ({ id: f.rut, nombre: `${f.nombre} (familiar)` })), { id: 'otra', nombre: 'Otra persona' }], d.quien || cuenta.rut)}</select>
<div id="otra-rut"${(d.quien || cuenta.rut) === 'otra' ? '' : ' hidden'}><label for="rut">RUT de quien recibirá la atención ${AST}</label><input id="rut" name="rut" value="${esc(d.rut || '')}" placeholder="12345678-5" maxlength="10" autocomplete="off" autocomplete="off"></div>`
    : `<label for="rut" style="margin-top:0">RUT de quien recibirá la atención ${AST}</label><input id="rut" name="rut" value="${esc(d.rut || '')}" placeholder="12345678-5" maxlength="10" autocomplete="off" required autocomplete="off">
<p class="nota">¿Reservas para un familiar? Escribe el RUT de la persona que se va a atender, no el tuyo.</p>`;
  const modo = d.modo === 'prof' ? 'prof' : 'esp';
  const form = `<form method="post" action="/agendar" class="tarjeta" id="buscar" style="max-width:720px">
${quien}
<label for="lugar">Lugar de atención ${AST}</label><select id="lugar" name="lugar" required>${opciones(lugares, d.lugar || 'red')}</select>
<fieldset style="border:0;padding:0;margin:14px 0 0"><legend style="font-weight:600">Buscar por ${AST}</legend>
<label class="check"><input type="radio" name="modo" value="esp"${modo === 'esp' ? ' checked' : ''}> Especialidad</label>
<label class="check"><input type="radio" name="modo" value="prof"${modo === 'prof' ? ' checked' : ''}> Profesional</label></fieldset>
<div id="campo-esp"${modo === 'esp' ? '' : ' hidden'}><label for="esp">Especialidad ${AST}</label><select id="esp" name="esp"><option value="">Elige una especialidad</option>${opciones(espOpts, d.esp)}</select></div>
<div id="campo-prof"${modo === 'prof' ? '' : ' hidden'}><label for="prof">Profesional ${AST}</label><select id="prof" name="prof"><option value="">Elige un profesional</option>${opciones(profOpts, d.prof)}</select></div>
<label class="check" style="margin-top:18px"><input type="checkbox" name="consentimiento" value="1" required${d.consentimiento ? ' checked' : ''}> <span>Acepto el tratamiento de los datos personales para gestionar la atención, según la <a href="/privacidad">Política de privacidad</a>. ${AST}</span></label>
<label class="check"><input type="checkbox" name="comunicaciones" value="1"${d.comunicaciones ? ' checked' : ''}> <span>Acepto recibir el comprobante, recordatorios y avisos de la hora por WhatsApp o correo (opcional).</span></label>
<button class="btn blq" type="submit">Ver días y horas disponibles</button></form>
<script>(function(){var f=document.getElementById('buscar');if(!f)return;var l=f.querySelector('#lugar');
function filtrar(sel){[].forEach.call(f.querySelectorAll(sel+' option[data-lugares]'),function(o){var ok=l.value==='red'||o.dataset.lugares.split(',').indexOf(l.value)>=0;o.hidden=!ok;o.disabled=!ok;if(!ok&&o.selected)f.querySelector(sel).value='';});}
function modo(){var m=f.querySelector('[name=modo]:checked').value;f.querySelector('#campo-esp').hidden=m!=='esp';f.querySelector('#campo-prof').hidden=m!=='prof';}
function quien(){var s=f.querySelector('#quien'),o=f.querySelector('#otra-rut');if(s&&o){o.hidden=s.value!=='otra';}}
l.addEventListener('change',function(){filtrar('#esp');filtrar('#prof');});[].forEach.call(f.querySelectorAll('[name=modo]'),function(r){r.addEventListener('change',modo);});
var s=f.querySelector('#quien');if(s)s.addEventListener('change',quien);filtrar('#esp');filtrar('#prof');})();</script>`;
  const ayuda = `<p class="nota ayuda-l">¿Necesitas ayuda? Escríbenos al WhatsApp <a href="https://wa.me/${WHATSAPP.replace(/\D/g, '')}">${WHATSAPP}</a>.</p>`;
  return pagina({
    titulo: 'Reservar hora', usuario, mensaje, portal: true, activo: 'agendar', encabezado: false, volver: false,
    portada: { titulo: 'Reserva tu hora', lead: 'No necesitas cuenta: basta con el RUT de quien se va a atender.', extra: barra(1) },
    contenido: `${ESTILOS}${form}${ayuda}`,
  });
};

// ---------- Paso 2: calendario del mes y horas del día ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const calendario = ({ t, resumen, mes, antes, despues, dias, dia, grupos, usuario }) => {
  const [a, m] = mes.split('-').map(Number);
  const primero = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const vacios = (primero + 6) % 7;
  const nDias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const flecha = (mm, txt, et) => (mm ? `<a href="/agendar/calendario?${q({ t, mes: mm })}" aria-label="${et}">${txt}</a>` : `<span aria-hidden="true">${txt}</span>`);
  const celdas = [...Array(vacios)].map(() => '<span class="vacio"></span>').join('') + [...Array(nDias)].map((_, i) => {
    const f = `${mes}-${String(i + 1).padStart(2, '0')}`; const n = dias.get(f);
    return n ? `<a class="${f === dia ? 'sel' : ''}" href="/agendar/calendario?${q({ t, mes, dia: f })}" aria-label="${esc(fechaLarga(f))}: ${n} ${n === 1 ? 'hora disponible' : 'horas disponibles'}"${f === dia ? ' aria-current="date"' : ''}>${i + 1}<i>${n} h</i></a>` : `<span aria-label="${esc(fechaLarga(f))}: sin horas">${i + 1}</span>`;
  }).join('');
  const boton = (b) => `<a href="/agendar/datos?${q({ t, bloque: b.id })}" aria-label="Elegir las ${esc(b.hora)}">${esc(b.hora)}</a>`;
  const franjas = (bl) => [['MAÑANA', bl.filter((b) => b.hora < '13:00')], ['TARDE', bl.filter((b) => b.hora >= '13:00')]].filter(([, l]) => l.length).map(([n, l]) => `<p class="franja">${n}</p><div class="horas">${l.map(boton).join('')}</div>`).join('');
  const tarjetas = grupos.map((g) => `<article class="prof"><div class="prof-cab"><span class="av" aria-hidden="true">${esc(iniciales(g.prof.nombre))}</span><div><b>${esc(g.prof.nombre)}</b><small>${esc(g.esp)}</small></div><span class="chip">${g.sede.telemedicina ? 'Videoconsulta' : 'Presencial'}</span></div>
<p class="lugar">${ico('ubicacion')}<span>${g.sede.telemedicina ? 'Telemedicina · atención a distancia' : `Policlínico <b>${esc(g.sede.nombre)}</b>${infoSede(g.sede.id)?.direccion ? ` · ${esc(infoSede(g.sede.id).direccion)}` : ''}`}</span></p>${franjas(g.bloques)}</article>`).join('');
  const cuerpo = `<div class="busqueda-r"><span>Buscando: <b>${esc(resumen)}</b></span><a class="btn sec chico" href="/agendar?${q({ t })}">Cambiar búsqueda</a></div>
${dias.size || antes || despues ? `<div class="mes"><div class="mes-cab">${flecha(antes, ico('chevIzq'), 'Mes anterior')}<b>${MESES[m - 1]} ${a}</b>${flecha(despues, ico('chevDer'), 'Mes siguiente')}</div><div class="mes-g">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<small>${x}</small>`).join('')}${celdas}</div><p class="nota" style="margin:10px 0 0">Los días marcados tienen horas disponibles.</p></div>` : ''}
${dia ? `<h2 class="dia-t">${esc(fechaLarga(dia).replace(/ de \d{4}$/, '').replace(/^./, (c) => c.toUpperCase()))}</h2><div class="profs">${tarjetas}</div>` : `<div class="aviso">${dias.size ? 'Elige un día marcado en el calendario para ver los profesionales y horarios.' : 'No hay horas disponibles para esta búsqueda. Prueba con otro lugar, especialidad o profesional, o pide quedar en lista de espera en tu policlínico.'}</div>`}
<div class="aviso" style="margin-top:16px">¿No encuentras una hora que te sirva? Escríbenos al WhatsApp ${WHATSAPP} y te ayudaremos a buscar una alternativa.</div>`;
  return marco(2, 'Elige el día y la hora', 'Selecciona un día disponible y luego la hora con el profesional que prefieras.', cuerpo, null, usuario, { href: `/agendar?${q({ t })}`, texto: 'Volver a la búsqueda' });
};

// ---------- Paso 3: datos del paciente y documentos ----------
const campo = (nombre, titulo, valor, { tipo = 'text', req = false, extra = '', full = false } = {}) => `<div${full ? ' class="full"' : ''}><label for="${nombre}">${titulo}${req ? ` ${AST}` : ''}</label><input id="${nombre}" name="${nombre}" type="${tipo}" value="${esc(valor ?? '')}"${req ? ' required' : ''} ${extra}></div>`;
const GENEROS = [['FEMENINO', 'Femenino'], ['MASCULINO', 'Masculino'], ['OTRO', 'Otro'], ['NO_INFORMA', 'Prefiere no informar']];
const camposEditables = (v, comunas) => `
${campo('telefono', 'Celular', v.telefono, { tipo: 'tel', req: true, extra: 'placeholder="+56912345678" autocomplete="tel"' })}
${campo('correo', 'Correo electrónico (opcional)', v.correo, { tipo: 'email', extra: 'autocomplete="email"' })}
<div class="full"><label class="check"><input type="checkbox" name="tieneWhatsapp" value="1"${v.tieneWhatsapp ? ' checked' : ''}> El celular tiene WhatsApp</label></div>
${campo('direccion', 'Dirección', v.direccion, { req: true, full: true, extra: 'autocomplete="street-address"' })}
<div><label for="idComuna">Comuna ${AST}</label><select id="idComuna" name="idComuna" required><option value="">Elige la comuna</option>${opciones(comunas, v.idComuna)}</select></div>
<div><label for="genero">Género ${AST}</label><select id="genero" name="genero" required><option value="">Elige una opción</option>${opciones(GENEROS.map(([id, nombre]) => ({ id, nombre })), v.genero)}</select></div>
${campo('nacionalidad', 'Nacionalidad', v.nacionalidad || 'Chilena', { req: true })}`;
const camposResponsable = (v, menor) => `<fieldset class="full" style="border:1px solid var(--borde);border-radius:12px;padding:6px 16px 14px;margin-top:16px"><legend style="font-weight:700;padding:0 6px">Adulto responsable${menor ? ` ${AST}` : ' (opcional)'}</legend>
<p class="nota">${menor ? 'Obligatorio para menores de 18 años.' : 'Complétalo si otra persona acompaña o gestiona las horas del paciente.'}</p><div class="form2">
${campo('respNombre', 'Nombre completo', v.respNombre ?? v.responsable?.nombre, { req: menor })}${campo('respRelacion', 'Relación con el paciente', v.respRelacion ?? v.responsable?.relacion, { req: menor, extra: 'placeholder="Madre, padre, hijo/a…"' })}
${campo('respRut', 'RUT', v.respRut ?? v.responsable?.rut, { req: menor })}${campo('respTelefono', 'Teléfono', v.respTelefono ?? v.responsable?.telefono, { tipo: 'tel', req: menor })}</div></fieldset>`;
const seccionDocs = ({ tipos, registrados = null, pendientes = [] }) => `<details class="docs"${pendientes.length ? ' open' : ''}><summary>Adjuntar orden, derivación o certificado (opcional)</summary>
<p class="nota">Solo si tu atención lo requiere. PDF, JPG o PNG de hasta 5 MB. Los ve únicamente el personal autorizado.</p>
${registrados ? `<p class="sec-t">Ya registrados</p>${registrados.length ? `<ul class="docs-reg">${registrados.map((x) => `<li>${esc(x.tipo)} · ${esc(x.fecha.slice(0, 10))} · ${x.verificado ? 'revisado' : 'pendiente de revisión'}</li>`).join('')}</ul>` : '<p class="nota">No hay documentos registrados.</p>'}` : ''}
${pendientes.length ? `<div class="aviso"><b>Requisitos pendientes de revisión:</b> ${pendientes.map(esc).join(', ')}. Puedes adjuntarlos ahora o presentarlos en el policlínico.</div>` : ''}
${[1, 2, 3].map((i) => `<div class="doc-fila"><div><label for="tipo${i}">Tipo de documento</label><select id="tipo${i}" name="tipo${i}"><option value="">Elige el tipo</option>${opciones(tipos.map((x) => ({ id: x, nombre: x })), '')}</select></div><div><label for="doc${i}">Archivo</label><input id="doc${i}" name="doc${i}" type="file" accept="application/pdf,image/jpeg,image/png"></div></div>`).join('')}</details>`;

const datos = ({ t, modo, ficha, v = {}, comunas, tipos, registrados, pendientes, rut, cita, mensaje, usuario }) => {
  const resumenCita = `<div class="busqueda-r"><span>Hora elegida: <b>${esc(cita)}</b></span><a class="btn sec chico" href="/agendar/calendario?${q({ t })}">Cambiar hora</a></div>`;
  let cuerpo;
  if (modo === 'existente-sin-sesion') {
    cuerpo = `${resumenCita}<div class="tarjeta" style="max-width:720px"><h2>El RUT ${esc(rut)} ya tiene un registro</h2>
<p>Usaremos los datos guardados en la ficha del paciente. Por privacidad aparecen ocultos y bloqueados; si tienes cuenta, <a href="/paciente/cuenta">inicia sesión</a> para verlos completos y editarlos.</p>
${fichaOculta(ficha, rut, comunas)}
<form method="post" action="/agendar/datos" enctype="multipart/form-data"><input type="hidden" name="t" value="${esc(t)}">
<label for="cambioDatos">¿Cambió el teléfono, el correo o la dirección? (opcional)</label>
<textarea id="cambioDatos" name="cambioDatos" rows="2" maxlength="300" placeholder="Ej.: mi nuevo celular es +569…">${esc(v.cambioDatos || '')}</textarea>
<p class="nota">Lo recibe el personal del policlínico y actualiza la ficha.</p>
${seccionDocs({ tipos, pendientes })}
<button class="btn blq" type="submit">Continuar</button></form></div>`;
  } else {
    const nuevo = modo === 'nuevo';
    const fuente = nuevo ? v : { ...ficha, ...v };
    const menor = (fuente.fechaNacimiento && require('../services/PacienteService').edad(fuente.fechaNacimiento) < 18) || false;
    const identidad = nuevo
      ? `${campo('rutVista', 'RUT', rut, { req: true, extra: 'readonly' })}${campo('fechaNacimiento', 'Fecha de nacimiento', v.fechaNacimiento, { tipo: 'date', req: true })}
${campo('nombres', 'Nombres', v.nombres, { req: true, extra: 'autocomplete="given-name"' })}${campo('apellidos', 'Apellidos', v.apellidos, { req: true, extra: 'autocomplete="family-name"' })}`
      : `<div class="bloqueado full form2" style="padding:0">${campo('rutVista', 'RUT', ficha.rut, { req: true, extra: 'readonly' })}${campo('fnVista', 'Fecha de nacimiento', ficha.fechaNacimiento, { tipo: 'date', req: true, extra: 'readonly' })}
${campo('nombreVista', 'Nombre completo', ficha.nombre, { req: true, full: true, extra: 'readonly' })}</div><p class="nota full">Para corregir RUT, nombre o fecha de nacimiento, pídelo a TENS/TONS de tu policlínico.</p>`;
    cuerpo = `${resumenCita}<form method="post" action="/agendar/datos" enctype="multipart/form-data" class="tarjeta" style="max-width:820px"><input type="hidden" name="t" value="${esc(t)}">
<h2>${nuevo ? 'Completa los datos del paciente' : 'Revisa los datos del paciente'}</h2><p class="nota">Los campos con ${AST} son obligatorios.</p>
<div class="form2">${identidad}${camposEditables(fuente, comunas)}${camposResponsable(fuente, menor)}</div>
${seccionDocs({ tipos, registrados: nuevo ? null : registrados, pendientes })}
<button class="btn blq" type="submit">Continuar al resumen</button></form>`;
  }
  return marco(3, 'Datos del paciente', 'Revisa o completa los datos y, si quieres, adjunta documentos.', cuerpo, mensaje, usuario, { href: `/agendar/calendario?${q({ t })}`, texto: 'Volver al día y la hora' });
};

// ---------- Paso 4: resumen y confirmación ----------
const revisar = ({ t, r, mensaje, usuario }) => marco(4, 'Revisa y confirma tu reserva', 'Confirma que todo esté correcto antes de reservar.',
  `<div class="tarjeta col" style="max-width:640px"><p class="sec-t">PACIENTE</p>${fila('Nombre', r.nombre)}${fila('RUT', r.rut)}${r.nuevo ? fila('Registro', 'Se creará el registro del paciente') : ''}${r.actualiza ? fila('Datos', 'Se actualizarán los datos editados') : ''}
<p class="sec-t">ATENCIÓN</p>${fila('Lugar', r.lugar)}${fila('Modalidad', r.tele ? 'Atención a distancia' : 'Presencial')}${fila('Especialidad', r.esp)}${fila('Profesional', r.prof)}${fila('Fecha', fechaLarga(r.fecha))}${fila('Hora', r.hora)}
<p class="sec-t">DOCUMENTOS</p>${r.docs.length ? r.docs.map((d) => fila(d.tipo, d.nombre)).join('') : '<p class="nota">Sin documentos nuevos.</p>'}${r.cambio ? `<p class="sec-t">CAMBIO DE DATOS SOLICITADO</p><p>${esc(r.cambio)}</p><p class="nota">El policlínico lo revisará y actualizará la ficha.</p>` : ''}
<p class="sec-t">COMPROBANTE</p><p class="nota">Al confirmar podrás descargar el comprobante en PDF${r.canal ? ` y quedará registrado su envío por ${esc(r.canal)}` : ''}.</p>
<form method="post" action="/agendar/confirmar"><input type="hidden" name="t" value="${esc(t)}"><button class="btn blq" type="submit">Confirmar reserva</button></form>
<p style="text-align:center;margin-top:12px"><a href="/agendar/calendario?${q({ t })}">Cambiar hora</a></p></div>`, mensaje, usuario, { href: `/agendar/datos?${q({ t })}`, texto: 'Volver a los datos' });

// ---------- Comprobante ----------
const confirmada = ({ t, r, envio, cuenta, usuario }) => {
  const info = infoSede(r.idSede) || {}; const wa = formatoTelefono(info.whatsapp || '+56927468124');
  return pagina({
    titulo: 'Tu hora fue reservada correctamente', usuario, portal: true, activo: 'agendar', encabezado: false,
    portada: { titulo: 'Tu hora fue reservada correctamente', lead: 'Descarga o imprime tu comprobante. No tiene código: la reserva se identifica por el RUT.' },
    contenido: `${ESTILOS}
<div class="dos"><div class="tarjeta"><p class="sec-t">PACIENTE</p>${fila('Nombre', r.nombre)}${fila('RUT', r.rut)}
<p class="sec-t">ATENCIÓN</p>${fila('Especialidad', r.esp)}${fila('Profesional', r.prof)}${fila('Lugar', r.tele ? 'Telemedicina' : `${r.lugar}${info.direccion ? ` · ${info.direccion}` : ''}`)}${fila('Fecha y hora', `${fechaLarga(r.fecha)} · ${r.hora}`)}
<p class="no-imprimir" style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn" href="/agendar/comprobante.pdf?${q({ t })}">Descargar comprobante (PDF)</a><button type="button" class="btn sec" onclick="window.print()">Imprimir</button></p>
${envio ? `<p class="nota">${envio}</p>` : ''}</div>
<div><div class="tarjeta"><h3>${r.tele ? 'Cómo conectarte' : 'Qué llevar'}</h3><p>${r.tele ? 'El equipo de Telemedicina te hará llegar el enlace de la videollamada antes de tu hora. Necesitas cámara, micrófono y buena conexión.' : 'Tu cédula de identidad y, si tienes, la orden o derivación. Llega 10 minutos antes.'}</p></div>
<div class="tarjeta" style="margin-top:12px"><h3>¿Cancelar o cambiar?</h3><p>Escribe al WhatsApp ${esc(wa)} o comunícate con tu policlínico indicando el RUT; el personal registrará el cambio. Una reserva no se cancela por falta de respuesta.</p></div>
${cuenta ? '' : '<div class="tarjeta no-imprimir" style="margin-top:12px"><h3>Tus datos quedaron guardados</h3><p>La reserva, los datos y los documentos quedaron registrados en la ficha del paciente, aunque no tengas cuenta. Si creas una cuenta (opcional), además puedes ver tus horas, tus datos, tus documentos y los de tus familiares vinculados.</p><a class="btn sec" href="/paciente/cuenta/crear">Crear mi cuenta</a></div>'}</div></div>
<p class="no-imprimir" style="margin-top:24px"><a class="btn sec" href="/">Reservar otra hora</a></p>`,
  });
};

const apagado = ({ usuario }) => pagina({ titulo: 'Reserva no disponible', usuario, portal: true, activo: 'agendar', contenido: `<div class="aviso err">La reserva por internet no está disponible por ahora. Escríbenos por WhatsApp al ${WHATSAPP}.</div>` });

module.exports = { inicio, calendario, datos, revisar, confirmada, apagado, mascaraNombre, ESTILOS };

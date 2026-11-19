'use strict';
const { pagina, WHATSAPP, CORREO } = require('./layout');
const { esc, foto } = require('./util');
const { infoSede, formatoTelefono, enlaceWhatsapp } = require('../models/sedesInfo');

const fechaLarga = (f) => {
  const [a, m, d] = f.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const fila = (t, v) => `<div class="fila"><span>${esc(t)}</span><b>${esc(v)}</b></div>`;

const formulario = (resultado, usuario) => {
  let cuerpo = '';
  if (resultado && resultado.bloqueado) {
    cuerpo = `<div class="tarjeta"><h2>Consulta bloqueada por un momento</h2><p>Por seguridad, bloqueamos la consulta después de varios intentos. Podrás intentar de nuevo en un minuto.</p><p>Tu reserva no se ve afectada. Si necesitas tu reserva ahora, escríbenos por WhatsApp al ${WHATSAPP}.</p></div>`;
  } else if (resultado && resultado.noVerificado) {
    cuerpo = `<div class="tarjeta" style="margin-top:16px" role="status"><h2>No pudimos verificar tus datos</h2><p>Revisa el RUT, la fecha de nacimiento y los últimos 4 dígitos del celular registrado en tu policlínico. Si cambiaste de número o no tienes celular registrado, escríbenos por WhatsApp al ${WHATSAPP} o acércate a tu policlínico.</p></div>`;
  } else if (resultado && resultado.citas) {
    cuerpo = resultado.citas.length
      ? resultado.citas.map((c) => `<div class="tarjeta" style="margin-top:16px"><span class="etiqueta ${c.confirmada ? '' : 'pend'}">${c.confirmada ? 'VIGENTE · ASISTENCIA CONFIRMADA' : 'VIGENTE · POR CONFIRMAR'}</span>
${fila('Policlínico', c.policlinico)}${c.whatsapp ? fila('WhatsApp', formatoTelefono(c.whatsapp)) : ''}${fila('Especialidad', c.especialidad)}${fila('Profesional', c.profesional)}${fila('Fecha', fechaLarga(c.fecha))}${fila('Hora', c.hora)}</div>`).join('')
        + `<div class="aviso">¿Necesitas cancelar tu hora? Escribe al WhatsApp de tu policlínico o comunícate con él indicando tu RUT; el personal registrará la cancelación.</div>`
      : `<div class="tarjeta" style="margin-top:16px"><h2>No tienes reservas vigentes</h2><p>Tus datos fueron verificados, pero no hay horas vigentes a tu nombre. Puedes <a href="/agendar">agendar una hora</a>.</p></div>`;
  }
  return pagina({
    titulo: 'Consulta tu reserva', usuario, portal: true, activo: 'consulta',
    contenido: `<p class="lead">Para proteger tu información, verifica tus datos antes de ver tus reservas.</p>
<form method="post" action="/paciente/consulta" class="tarjeta col"><label for="rut">RUT del paciente <span aria-hidden="true">*</span></label><input id="rut" name="rut" placeholder="12345678-5" maxlength="12" autocomplete="off" autocomplete="off" required>
<label for="fechaNacimiento">Fecha de nacimiento <span aria-hidden="true">*</span></label><input id="fechaNacimiento" name="fechaNacimiento" type="date" required>
<label for="celular4">Últimos 4 dígitos del celular registrado <span aria-hidden="true">*</span></label><input id="celular4" name="celular4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required>
<button class="btn blq" type="submit">Consultar</button></form>
<p class="col col-c" style="color:var(--muted)">Aquí solo puedes consultar la cita. Confirmación y cancelación: por WhatsApp.</p>
${cuerpo}`,
  });
};

const encuesta = ({ mensaje, usuario }) => pagina({
  titulo: 'Encuesta de atención', usuario, mensaje, portal: true,
  contenido: `<p class="lead">Solo disponible después de una atención registrada.</p>
<form method="post" action="/paciente/encuesta" class="tarjeta col">
<label for="r">RUT</label><input id="r" name="rut" required>
<label for="n">Nota de 1 (mala) a 5 (muy buena)</label><select id="n" name="nota"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select>
<label for="c">Comentario (opcional, máx. 300 letras)</label><textarea id="c" name="comentario" maxlength="300" rows="4"></textarea>
<button class="btn blq" type="submit">Enviar</button></form>`,
});

const ayuda = (usuario, sedes) => pagina({
  titulo: 'Ayuda y contacto', usuario, portal: true, activo: 'ayuda',
  contenido: `<p class="lead">Escríbenos por WhatsApp o correo. Si prefieres, contacta directamente a tu policlínico.</p>
<dl class="contacto"><div><dt>WhatsApp</dt><dd><a href="https://wa.me/${WHATSAPP.replace(/\D/g, '')}">${WHATSAPP}</a></dd></div><div><dt>Correo</dt><dd><a href="mailto:${CORREO}">${CORREO}</a></dd></div></dl>
<h2 style="margin-top:28px">Nuestros policlínicos</h2>
<div class="grilla">${sedes.map((s) => { const i = infoSede(s.id); return `<div class="opcion">${foto(s, s.telemedicina ? 'foto ilus' : 'foto')}<h3>${esc(s.nombre)}</h3>
<p>${esc(i?.direccion || 'Atención a distancia')}</p>
<p>WhatsApp: <a href="${esc(enlaceWhatsapp(i?.whatsapp))}">${esc(formatoTelefono(i?.whatsapp))}</a></p>
${(i?.extras || []).map((x) => `<p>${esc(x.etiqueta)}: <a href="${esc(enlaceWhatsapp(x.numero))}">${esc(formatoTelefono(x.numero))}</a></p>`).join('')}
<p><a href="mailto:${esc(i?.correo)}">${esc(i?.correo)}</a></p>
<p>${esc((i?.especialidades || []).join(' · '))}</p></div>`; }).join('')}</div>
<h2 style="margin-top:28px">Preguntas frecuentes</h2>
<details><summary>¿Cómo agendo una hora?</summary><p>Entra a <a href="/agendar">Agendar hora</a>, escribe tu RUT y elige policlínico, especialidad, día y hora.</p></details>
<details><summary>¿Dónde reviso mi reserva?</summary><p>En <a href="/paciente/consulta">Consultar mi reserva</a>, solo con tu RUT.</p></details>
<details><summary>¿Cómo cancelo una hora?</summary><p>Escribe al WhatsApp ${WHATSAPP} o comunícate con tu policlínico indicando tu RUT; el personal registrará la cancelación. Si no respondes a un contacto, tu reserva no se cancela.</p></details>
<details><summary>¿Qué documentos necesito?</summary><p>Tu cédula de identidad y, si tienes, la orden o derivación. Llega 10 minutos antes.</p></details>
<details><summary>¿Cómo funciona Telemedicina?</summary><p>El equipo de Telemedicina te hará llegar el enlace de la videollamada antes de tu hora. Necesitas cámara, micrófono y buena conexión.</p></details>`,
});

const privacidad = (usuario) => pagina({
  titulo: 'Política de privacidad y uso de datos', usuario, portal: true,
  contenido: `<p class="lead">Así cuidamos la información que nos entregas al reservar tu hora.</p>
<div class="tarjeta"><h3>Qué datos pedimos</h3><p>RUT, nombre, fecha de nacimiento, género, teléfono, correo, dirección y comuna. No pedimos datos clínicos.</p>
<h3>Para qué los usamos</h3><p>Solo para gestionar tu atención: reservar, confirmarte, avisarte cambios y contactarte por WhatsApp.</p>
<h3>Quién puede verlos</h3><p>Únicamente el personal autorizado de la Fundación. No se comparten con terceros ajenos a la atención.</p>
<h3>Cuánto tiempo los guardamos</h3><p>El tiempo necesario para tu atención y las obligaciones legales de la institución.</p>
<h3>Tus derechos</h3><p>Puedes pedir acceso, corrección o eliminación de tus datos escribiéndonos por WhatsApp o a ${CORREO}.</p></div>`,
});
module.exports = { formulario, encuesta, ayuda, privacidad, fechaLarga, fila };

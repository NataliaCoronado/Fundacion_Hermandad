'use strict';
const { pagina, WHATSAPP } = require('./layout');
const { ico } = require('./iconos');
const { esc } = require('./componentesComunes');
const { SEDES } = require('../models/informacionDeSedes');

const FOTOS = { 1: 'san-isidro', 2: 'sagrada-familia', 3: 'maria-ayuda', 4: 'santa-teresa', 5: 'padre-hurtado', 6: 'oratorio-mariano', 7: 'telemedicina' };

module.exports = ({ usuario }) => pagina({
  titulo: 'Portal de pacientes', usuario, portal: true, activo: 'inicio', encabezado: false,
  contenido: `<section class="hero">
<div><p class="sobre">PORTAL DE PACIENTES</p>
<h1>Agenda tu hora de salud, simple y sin complicaciones</h1>
<p class="lead">Reserva en pocos pasos y sin crear cuenta: solo necesitas tu RUT. Al confirmar verás tu comprobante en pantalla para guardarlo o imprimirlo.</p>
<div class="acciones"><a class="btn grande" href="/agendar">Agendar una hora ${ico('flecha')}</a><a class="btn sec grande" href="/paciente/consulta">Consultar mi reserva</a></div></div>
<div class="hero-img"><img src="/img/san-isidro.jpg" alt="Fachada del policlínico San Isidro, Casa Central" width="520" height="360">
<div class="flot"><span class="ico-c">${ico('chat')}</span><span><b>¿Necesitas ayuda?</b>Escríbenos al WhatsApp ${WHATSAPP}</span></div></div></section>
<section class="datos"><div><b>+200 años</b><span>al servicio de Chile</span></div><div><b>6</b><span>policlínicos en Santiago</span></div><div><b>Telemedicina</b><span>atención a distancia</span></div><div><b>Sin cuenta</b><span>solo con tu RUT</span></div></section>
<div class="titulo-sec"><div><h2>¿Cómo funciona?</h2><p>Tres pasos y tu hora queda reservada.</p></div></div>
<section class="pasos3"><div><span class="n">1</span><b>Reservas aquí</b><p>Eliges policlínico, especialidad, día y hora.</p></div>
<div><span class="n">2</span><b>Guardas tu comprobante</b><p>Lo guardas o imprimes al confirmar. Tu policlínico puede contactarte para confirmar tu asistencia.</p></div>
<div><span class="n">3</span><b>Te atiendes</b><p>Llega 10 minutos antes con tu cédula, o conéctate si es Telemedicina.</p></div></section>
<div class="titulo-sec"><div><h2>Nuestros policlínicos</h2><p>Seis sedes presenciales y atención a distancia.</p></div><a class="btn sec" href="/ayuda">Direcciones y contacto</a></div>
<section class="sedes-mini">${SEDES.map((s) => `<a href="/ayuda"><img${s.telemedicina ? ' class="ilus"' : ''} src="/img/${FOTOS[s.id]}.jpg" alt="" loading="lazy"><span>${esc(s.nombre)}</span></a>`).join('')}</section>`,
});

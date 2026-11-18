'use strict';
const { pagina } = require('./layout');
const { esc } = require('./util');

const login = ({ mensaje, volver }) => pagina({
  titulo: 'Ingreso del personal', mensaje, ingreso: true,
  contenido: `<h2>Bienvenida, bienvenido</h2><p class="sub">Ingresa con tu correo institucional.</p>
<form method="post" action="/login" style="display:block">
<input type="hidden" name="volver" value="${esc(volver || '')}">
<label for="correo">Correo</label><input id="correo" type="email" name="correo" required autocomplete="username" placeholder="nombre@hermandad.cl">
<label for="clave">Contraseña</label><input id="clave" type="password" name="clave" required autocomplete="current-password">
<button type="submit" class="btn blq grande" style="margin-top:22px">Ingresar</button></form>
<p class="ayuda">Usuarios de prueba: admin@ejemplo.cl, tens@ejemplo.cl y telemedicina.usuario@ejemplo.cl. La clave de demostración está en el README.</p>`,
});
const prohibido = (usuario) => pagina({ titulo: 'Sin permiso', usuario, contenido: '<p>Tu rol no tiene acceso a esta pantalla.</p>' });
module.exports = { login, prohibido };

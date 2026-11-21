'use strict';
const { pagina } = require('./layout');
const { esc } = require('./componentesComunes');

const login = ({ mensaje, volver }) => pagina({
  titulo: 'Ingreso del personal', mensaje, ingreso: true,
  contenido: `<h2>Ingreso del personal</h2><p class="sub">Usa tu correo institucional y tu contraseña.</p>
<form method="post" action="/login" style="display:block">
<input type="hidden" name="volver" value="${esc(volver || '')}">
<label for="correo">Correo</label><input id="correo" type="email" name="correo" required autocomplete="username" placeholder="nombre@hermandad.cl">
<label for="clave">Contraseña</label><input id="clave" type="password" name="clave" required autocomplete="current-password">
<button type="submit" class="btn blq grande" style="margin-top:22px">Ingresar</button></form>`,
});
const prohibido = (usuario) => pagina({ titulo: 'Sin permiso', usuario, contenido: '<p>Tu perfil no tiene acceso a esta sección. Si crees que es un error, comunícate con la administración.</p>' });
module.exports = { login, prohibido };

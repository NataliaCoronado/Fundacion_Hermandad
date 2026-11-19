'use strict';
const AREAS_POR_ROL = {
  ADMINISTRACION: ['admin'],
  TENS_TONS: ['tens'],
  TELEMEDICINA: ['tens'],
};
const permitido = (rol, area) => (AREAS_POR_ROL[rol] || []).includes(area);
const rutaAgenda = (rol) => permitido(rol, 'admin') ? '/admin/agendas' : '/tens/agenda';
// Página que se abre al iniciar sesión: el Resumen (dashboard) de cada rol.
const rutaInicio = (rol) => permitido(rol, 'admin') ? '/admin/resumen' : '/tens/resumen';
module.exports = { permitido, rutaAgenda, rutaInicio, AREAS_POR_ROL };

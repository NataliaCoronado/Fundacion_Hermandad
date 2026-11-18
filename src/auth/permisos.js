'use strict';
// CU-11: qué áreas puede usar cada rol. Cada rol tiene su propio menú: Administración gestiona la red;
// TENS/TONS y Telemedicina atienden pacientes. Las áreas no se mezclan.
const AREAS_POR_ROL = {
  ADMINISTRACION: ['admin'],
  TENS_TONS: ['tens'],
  TELEMEDICINA: ['tens'],
};
const permitido = (rol, area) => (AREAS_POR_ROL[rol] || []).includes(area);
const rutaAgenda = (rol) => permitido(rol, 'admin') ? '/admin/agendas' : '/tens/agenda';
module.exports = { permitido, rutaAgenda, AREAS_POR_ROL };

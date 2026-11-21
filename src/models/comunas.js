'use strict';
const REGION = 'Metropolitana';
const COMUNAS_RM = [
  'Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'Curacaví', 'El Bosque', 'El Monte',
  'Estación Central', 'Huechuraba', 'Independencia', 'Isla de Maipo', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana',
  'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla',
  'Ñuñoa', 'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia', 'Pudahuel',
  'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San José de Maipo',
  'San Miguel', 'San Pedro', 'San Ramón', 'Santiago Centro', 'Talagante', 'Tiltil', 'Vitacura',
];

const completar = (existentes) => {
  const tiene = new Set(existentes.map((c) => c.nombre));
  let id = existentes.reduce((m, c) => Math.max(m, c.id), 0);
  return [...existentes, ...COMUNAS_RM.filter((n) => !tiene.has(n)).map((nombre) => ({ id: ++id, nombre }))];
};
module.exports = { COMUNAS_RM, REGION, completar };

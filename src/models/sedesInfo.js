'use strict';

const DESCRIPCION = {
  'Medicina General': 'Control y consulta de salud', 'Pediatría': 'Atención de niños y niñas', 'Matrona': 'Salud de la mujer',
  'Odontología': 'Cuidado dental', 'Ecografías': 'Exámenes de imagen', 'Kinesiología': 'Rehabilitación del movimiento',
  'Fonoaudiología': 'Voz, lenguaje y audición', 'Nutrición': 'Alimentación saludable', 'Podología': 'Cuidado de los pies',
  'Psicología': 'Apoyo emocional', 'Psicología adultos': 'Apoyo emocional para adultos',
};
const ESPECIALIDADES = ['Medicina General', 'Psicología', 'Kinesiología', 'Nutrición', 'Ecografías', 'Fonoaudiología', 'Matrona', 'Odontología', 'Pediatría', 'Podología', 'Psicología adultos'];

const SEDES = [
  { id: 1, nombre: 'San Isidro (Casa Central)', comuna: 'Santiago Centro', telemedicina: false, direccion: 'San Isidro #218, Santiago Centro', correo: 'casacentral@hermandad.cl', whatsapp: '+56927468124',
    extras: [{ etiqueta: 'Horas Dental (WhatsApp)', numero: '+56927710389', especialidad: 'Odontología' }, { etiqueta: 'Horas ecografías gíneco/obstétricas (WhatsApp)', numero: '+56927018402', especialidad: 'Ecografías' }],
    especialidades: ['Ecografías', 'Fonoaudiología', 'Kinesiología', 'Matrona', 'Medicina General', 'Nutrición', 'Odontología', 'Pediatría', 'Podología', 'Psicología'] },
  { id: 2, nombre: 'Sagrada Familia', comuna: 'San Ramón', telemedicina: false, direccion: 'Almirante Latorre #9921, Población La Bandera, San Ramón', correo: 'sagradafamilia@hermandad.cl', whatsapp: '+56937364119', extras: [],
    especialidades: ['Fonoaudiología', 'Kinesiología', 'Medicina General', 'Nutrición', 'Podología', 'Psicología'] },
  { id: 3, nombre: 'María Ayuda', comuna: 'Puente Alto', telemedicina: false, direccion: 'Profesor Alcaíno #1393, Puente Alto', correo: 'mariaayuda@hermandad.cl', whatsapp: '+56949650703', extras: [],
    especialidades: ['Fonoaudiología', 'Kinesiología', 'Medicina General', 'Nutrición', 'Matrona', 'Podología', 'Psicología'] },
  { id: 4, nombre: 'Santa Teresa', comuna: 'Estación Central', telemedicina: false, direccion: 'Gregorio Olmos #4210 esq. Manuel Chacón, Estación Central', correo: 'santateresa@hermandad.cl', whatsapp: '+56948022206',
    extras: [{ etiqueta: 'Teléfono Dental (WhatsApp)', numero: '+56927693379', especialidad: 'Odontología' }],
    especialidades: ['Fonoaudiología', 'Kinesiología', 'Medicina General', 'Nutrición', 'Matrona', 'Odontología', 'Podología', 'Psicología'] },
  { id: 5, nombre: 'Padre Hurtado', comuna: 'Conchalí', telemedicina: false, direccion: 'Pasaje 7, esquina Pasaje 10, El Cortijo, Conchalí', correo: 'padrehurtado@hermandad.cl', whatsapp: '+56927303706', extras: [],
    especialidades: ['Fonoaudiología', 'Kinesiología', 'Medicina General', 'Matrona', 'Nutrición', 'Podología', 'Psicología'] },
  { id: 6, nombre: 'Oratorio Mariano', comuna: 'Maipú', telemedicina: false, direccion: 'Av. Libertador Bernardo O’Higgins #909, Maipú', correo: 'oratoriomariano@hermandad.cl', whatsapp: '+56927255750', extras: [],
    especialidades: ['Fonoaudiología', 'Kinesiología', 'Medicina General', 'Nutrición', 'Podología', 'Psicología'] },
  { id: 7, nombre: 'Telemedicina', comuna: 'Modalidad remota', telemedicina: true, direccion: null, correo: 'telemedicina@hermandad.cl', whatsapp: '+56948619713', extras: [],
    especialidades: ['Medicina General', 'Psicología adultos', 'Fonoaudiología'] },
];

function profesionalesDeMuestra() {
  const fijos = [[1, 'Medicina General'], [1, 'Psicología'], [2, 'Kinesiología'], [3, 'Medicina General'], [7, 'Medicina General'], [7, 'Psicología adultos']];
  const lista = fijos.map(([idPoliclinico, especialidad], i) => ({ id: i + 1, nombre: `Profesional de prueba ${i + 1}`, especialidad, idPoliclinico, activo: true }));
  for (const s of SEDES) {
    for (const esp of s.especialidades) {
      if (lista.some((p) => p.idPoliclinico === s.id && p.especialidad === esp)) continue;
      const id = lista.length + 1;
      lista.push({ id, nombre: `Profesional de prueba ${id}`, especialidad: esp, idPoliclinico: s.id, activo: true });
    }
  }
  return lista;
}

const infoSede = (id) => SEDES.find((s) => s.id === Number(id)) || null;
const formatoTelefono = (n) => String(n).replace(/^\+56(\d)(\d{4})(\d{4})$/, '+56 $1 $2 $3');
const enlaceWhatsapp = (n) => `https://wa.me/${String(n).replace(/\D/g, '')}`;
module.exports = { SEDES, ESPECIALIDADES, DESCRIPCION, profesionalesDeMuestra, infoSede, formatoTelefono, enlaceWhatsapp };

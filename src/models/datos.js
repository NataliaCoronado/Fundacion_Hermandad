'use strict';

const { SEDES, profesionalesDeMuestra } = require('./sedesInfo');

function crearDatos() {
  const policlinicos = SEDES.map(({ id, nombre, comuna, telemedicina }) => ({ id, nombre, comuna, telemedicina }));
  const comunas = require('./comunas').completar([...new Set(policlinicos.filter((p) => !p.telemedicina).map((p) => p.comuna))].map((nombre, i) => ({ id: i + 1, nombre })));
  const profesionales = profesionalesDeMuestra();
  const pacientes = [
    { rut: '11111111-1', nombre: 'Paciente A', nombres: 'Paciente', apellidos: 'A', telefono: '+56911111111', tieneWhatsapp: true, correo: '', fechaNacimiento: '1980-01-01', genero: 'FEMENINO', nacionalidad: 'Chilena', direccion: 'Dirección 1', idComuna: 1, responsable: null },
    { rut: '22222222-2', nombre: 'Paciente B', nombres: 'Paciente', apellidos: 'B', telefono: '+56922222222', tieneWhatsapp: true, correo: '', fechaNacimiento: '1950-05-05', genero: 'MASCULINO', nacionalidad: 'Chilena', direccion: 'Dirección 2', idComuna: 2, responsable: null },
    { rut: '33333333-3', nombre: 'Paciente C', nombres: 'Paciente', apellidos: 'C', telefono: '+56933333333', tieneWhatsapp: false, correo: '', fechaNacimiento: '2015-09-09', genero: 'FEMENINO', nacionalidad: 'Venezolana', direccion: 'Dirección 3', idComuna: 3,
      responsable: { nombre: 'Responsable', relacion: 'Madre', rut: '44444444-4', telefono: '+56944444444' } },
  ];
  const bloques = [];
  let sigBloque = 1;
  for (const p of profesionales) {
    for (const fecha of ['2026-11-23', '2026-11-24']) {
      for (const hora of ['09:00', '09:30', '10:00', '10:30']) {
        bloques.push({ id: sigBloque++, idProfesional: p.id, fecha, hora, publicado: true });
      }
    }
  }
  const citas = [
    { id: 1, rut: '11111111-1', idBloque: 1, estadoReserva: 'ACTIVA', estadoConfirmacion: 'PENDIENTE', asistencia: null, origenCancelacion: null, idProfesionalReemplazo: null },
    { id: 2, rut: '22222222-2', idBloque: 2, estadoReserva: 'ACTIVA', estadoConfirmacion: 'CONFIRMADA', asistencia: null, origenCancelacion: null, idProfesionalReemplazo: null },
  ];
  const espera = [
    { id: 1, rut: '33333333-3', idPoliclinico: 2, especialidad: 'Kinesiología', registradaEn: '2026-11-16', estado: 'EN_ESPERA' },
  ];
  const usuarios = [
    { id: 'u1', nombre: 'Administración', correo: 'admin@ejemplo.cl', rol: 'ADMINISTRACION', idPoliclinico: null, activo: true },
    { id: 'u2', nombre: 'TENS/TONS San Isidro', correo: 'tens@ejemplo.cl', rol: 'TENS_TONS', idPoliclinico: 1, activo: true },
    { id: 'u3', nombre: 'Telemedicina', correo: 'telemedicina.usuario@ejemplo.cl', rol: 'TELEMEDICINA', idPoliclinico: 7, activo: true },
  ];
  return {
    policlinicos, comunas, profesionales, pacientes, bloques, citas, espera, usuarios,
    contactos: [],
    credenciales: {},
    extras: { documentos: [], cambios: [], encuestas: [], mensajes: [], bandeja: [], notificaciones: [], auditoria: [], historial: [] },
    secuencias: { cita: 3, espera: 2, contacto: 1, bloque: sigBloque },
  };
}
module.exports = { crearDatos };

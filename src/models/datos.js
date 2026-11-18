'use strict';
// Datos de MUESTRA (ficticios) para el modo en memoria. Con DATABASE_URL se usa PostgreSQL y esto no se toca.
// Los repositorios (src/repositories) son la única capa que accede a estos datos.

const { SEDES, profesionalesDeMuestra } = require('./sedesInfo');

function crearDatos() {
  const policlinicos = SEDES.map(({ id, nombre, comuna, telemedicina }) => ({ id, nombre, comuna, telemedicina }));
  const comunas = [...new Set(policlinicos.filter((p) => !p.telemedicina).map((p) => p.comuna))].map((nombre, i) => ({ id: i + 1, nombre }));
  const profesionales = profesionalesDeMuestra();
  const pacientes = [
    { rut: '11111111-1', nombre: 'Paciente de prueba A', nombres: 'Paciente de prueba', apellidos: 'A', telefono: '+56911111111', tieneWhatsapp: true, correo: '', fechaNacimiento: '1980-01-01', genero: 'FEMENINO', nacionalidad: 'Chilena', direccion: 'Dirección de prueba 1', idComuna: 1, responsable: null },
    { rut: '22222222-2', nombre: 'Paciente de prueba B', nombres: 'Paciente de prueba', apellidos: 'B', telefono: '+56922222222', tieneWhatsapp: true, correo: '', fechaNacimiento: '1950-05-05', genero: 'MASCULINO', nacionalidad: 'Chilena', direccion: 'Dirección de prueba 2', idComuna: 2, responsable: null },
    { rut: '33333333-3', nombre: 'Paciente de prueba C', nombres: 'Paciente de prueba', apellidos: 'C', telefono: '+56933333333', tieneWhatsapp: false, correo: '', fechaNacimiento: '2015-09-09', genero: 'FEMENINO', nacionalidad: 'Venezolana', direccion: 'Dirección de prueba 3', idComuna: 3,
      responsable: { nombre: 'Responsable de prueba', relacion: 'Madre', rut: '44444444-4', telefono: '+56944444444' } },
  ];
  // Bloques horarios: los crea Administración; solo los publicados se pueden reservar.
  const bloques = [];
  let sigBloque = 1;
  for (const p of profesionales) {
    for (const fecha of ['2026-11-23', '2026-11-24']) {
      for (const hora of ['09:00', '09:30', '10:00', '10:30']) {
        bloques.push({ id: sigBloque++, idProfesional: p.id, fecha, hora, publicado: true });
      }
    }
  }
  // estadoReserva: ACTIVA | CANCELADA   (independiente de)   estadoConfirmacion: PENDIENTE | CONFIRMADA | SIN_RESPUESTA
  // asistencia: null | ASISTIO | NO_ASISTIO   (el silencio NO cancela ni confirma)
  const citas = [
    { id: 1, rut: '11111111-1', idBloque: 1, estadoReserva: 'ACTIVA', estadoConfirmacion: 'PENDIENTE', asistencia: null, origenCancelacion: null, idProfesionalReemplazo: null },
    { id: 2, rut: '22222222-2', idBloque: 2, estadoReserva: 'ACTIVA', estadoConfirmacion: 'CONFIRMADA', asistencia: null, origenCancelacion: null, idProfesionalReemplazo: null },
  ];
  const espera = [
    { id: 1, rut: '33333333-3', idPoliclinico: 2, especialidad: 'Kinesiología', registradaEn: '2026-11-16', estado: 'EN_ESPERA' },
  ];
  const usuarios = [
    { id: 'u1', nombre: 'Usuario de prueba Administración', correo: 'admin@ejemplo.cl', rol: 'ADMINISTRACION', idPoliclinico: null, activo: true },
    { id: 'u2', nombre: 'Usuario de prueba TENS/TONS San Isidro', correo: 'tens@ejemplo.cl', rol: 'TENS_TONS', idPoliclinico: 1, activo: true },
    { id: 'u3', nombre: 'Usuario de prueba Telemedicina', correo: 'telemedicina.usuario@ejemplo.cl', rol: 'TELEMEDICINA', idPoliclinico: 7, activo: true },
  ];
  return {
    policlinicos, comunas, profesionales, pacientes, bloques, citas, espera, usuarios,
    contactos: [],
    credenciales: {},                      // idUsuario -> hash scrypt
    extras: { documentos: [], cambios: [], encuestas: [], mensajes: [], bandeja: [], notificaciones: [], auditoria: [] },
    secuencias: { cita: 3, espera: 2, contacto: 1, bloque: sigBloque },
  };
}
module.exports = { crearDatos };

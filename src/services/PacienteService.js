'use strict';
const { normalizarRut, rutValido } = require('../util/rut');
const { hoy } = require('../util/tiempo');

const TELEFONO = /^\+?[0-9]{8,15}$/;
const GENEROS = ['FEMENINO', 'MASCULINO', 'OTRO', 'NO_INFORMA'];
// Edad en años cumplidos a la fecha indicada (ambas "AAAA-MM-DD").
const edad = (nacimiento, fecha = hoy()) => {
  const [a, m, d] = String(nacimiento).split('-').map(Number); const [a2, m2, d2] = fecha.split('-').map(Number);
  return a2 - a - (m2 < m || (m2 === m && d2 < d) ? 1 : 0);
};

// CU-01: ficha administrativa (sin ficha clínica). Exige consentimiento y RUT válido.
// Incluye al adulto responsable: obligatorio si el paciente es menor de 18 años, opcional en los demás casos.
class PacienteService {
  constructor(catalogo) { this.catalogo = catalogo; }

  validar(d) {
    const nombres = (d.nombres || '').trim(); const apellidos = (d.apellidos || '').trim();
    const direccion = (d.direccion || '').trim(); const telefono = (d.telefono || '').replace(/[\s-]/g, '');
    if (!nombres || !apellidos || !direccion || !d.fechaNacimiento || !d.idComuna) throw new Error('DATOS_INCOMPLETOS');
    if (!GENEROS.includes(d.genero)) throw new Error('DATOS_INCOMPLETOS');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fechaNacimiento) || d.fechaNacimiento > hoy() || d.fechaNacimiento < '1900-01-01') throw new Error('FECHA_INVALIDA');
    if (!TELEFONO.test(telefono)) throw new Error('TELEFONO_INVALIDO');
    if (d.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)) throw new Error('CORREO_INVALIDO');
    return {
      nombres, apellidos, direccion, telefono, correo: (d.correo || '').trim(), fechaNacimiento: d.fechaNacimiento,
      genero: d.genero, nacionalidad: (d.nacionalidad || 'Chilena').trim(), idComuna: d.idComuna,
      tieneWhatsapp: !!d.tieneWhatsapp, responsable: this.responsable(d),
    };
  }

  responsable(d) {
    const nombre = (d.respNombre || '').trim().replace(/\s+/g, ' '); const relacion = (d.respRelacion || '').trim().slice(0, 30);
    const rut = d.respRut ? normalizarRut(d.respRut) : ''; const telefono = (d.respTelefono || '').replace(/[\s-]/g, '');
    if (!nombre && !relacion && !rut && !telefono) {
      if (edad(d.fechaNacimiento) < 18) throw new Error('RESPONSABLE_REQUERIDO');
      return null;
    }
    if (!nombre || !relacion || !rut || !telefono) throw new Error('RESPONSABLE_INCOMPLETO');
    if (!rutValido(rut)) throw new Error('RESPONSABLE_RUT_INVALIDO');
    if (!TELEFONO.test(telefono)) throw new Error('TELEFONO_INVALIDO');
    return { nombre, relacion, rut, telefono };
  }

  async crear(d) {
    const rut = normalizarRut(d.rut);
    if (!rutValido(rut)) throw new Error('RUT_INVALIDO');
    const ficha = this.validar(d);
    if (!d.consentimiento) throw new Error('CONSENTIMIENTO_REQUERIDO');
    if (await this.catalogo.paciente(rut)) throw new Error('PACIENTE_EXISTE');
    await this.catalogo.crearPaciente({ rut, ...ficha, idUsuario: d.idUsuario });
    return rut;
  }

  // Corrige los datos de una ficha existente. El RUT no cambia.
  async actualizar(rutOriginal, d) {
    const rut = normalizarRut(rutOriginal);
    if (!(await this.catalogo.paciente(rut))) throw new Error('PACIENTE_NO_ENCONTRADO');
    await this.catalogo.actualizarPaciente(rut, this.validar(d));
    return rut;
  }
}
module.exports = { PacienteService, edad };

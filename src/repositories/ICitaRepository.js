'use strict';
// Patrón Repository (Actividad Clases y Patrón): los servicios dependen de esta interfaz y no del
// acceso a datos. Hay dos implementaciones: CitaRepositoryMemoria y CitaRepositoryPg.
// Todos los métodos pueden devolver una Promise (los servicios usan await).
class ICitaRepository {
  listar() { throw new Error('No implementado'); }
  buscarPorId(id) { throw new Error('No implementado'); }
  buscarPorRut(rut) { throw new Error('No implementado'); }
  buscarActivaPorBloque(idBloque) { throw new Error('No implementado'); }
  crear(cita) { throw new Error('No implementado'); }
  actualizar(cita) { throw new Error('No implementado'); }
}
module.exports = { ICitaRepository };

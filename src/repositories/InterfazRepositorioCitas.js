'use strict';
class InterfazRepositorioCitas {
  listar() { throw new Error('No implementado'); }
  buscarPorId(id) { throw new Error('No implementado'); }
  buscarPorRut(rut) { throw new Error('No implementado'); }
  buscarActivaPorBloque(idBloque) { throw new Error('No implementado'); }
  crear(cita) { throw new Error('No implementado'); }
  actualizar(cita) { throw new Error('No implementado'); }
}
module.exports = { InterfazRepositorioCitas };

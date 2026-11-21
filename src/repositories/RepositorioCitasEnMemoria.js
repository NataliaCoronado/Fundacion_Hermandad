'use strict';
const { InterfazRepositorioCitas } = require('./InterfazRepositorioCitas');

class RepositorioCitasEnMemoria extends InterfazRepositorioCitas {
  constructor(datos) { super(); this.datos = datos; }
  listar() { return this.datos.citas.map((c) => ({ ...c })); }
  buscarPorId(id) { const cita = this.datos.citas.find((x) => x.id === Number(id)); return cita ? { ...cita } : null; }
  buscarPorRut(rut) { return this.datos.citas.filter((c) => c.rut === rut).map((c) => ({ ...c })); }
  buscarActivaPorBloque(idBloque) {
    const cita = this.datos.citas.find((x) => x.idBloque === Number(idBloque) && x.estadoReserva === 'ACTIVA');
    return cita ? { ...cita } : null;
  }
  crear(cita) {
    if (this.buscarActivaPorBloque(cita.idBloque)) throw new Error('BLOQUE_OCUPADO');
    const nueva = { id: this.datos.secuencias.cita++, idProfesionalReemplazo: null, ...cita };
    delete nueva.idUsuario;
    this.datos.citas.push(nueva);
    return { ...nueva };
  }
  actualizar(cita) {
    const i = this.datos.citas.findIndex((x) => x.id === cita.id);
    if (i < 0) throw new Error('CITA_NO_ENCONTRADA');
    this.datos.citas[i] = { ...cita };
    return { ...cita };
  }
}
module.exports = { RepositorioCitasEnMemoria };

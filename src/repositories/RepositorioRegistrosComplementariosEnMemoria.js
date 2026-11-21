'use strict';
class RepositorioRegistrosComplementariosEnMemoria {
  constructor(extras) { this.extras = extras; }
  listar(tipo) { return this.extras[tipo]; }
  agregar(tipo, obj) {
    const lista = this.extras[tipo];
    const n = { id: lista.length ? lista[lista.length - 1].id + 1 : 1, ...obj };
    lista.push(n);
    return n;
  }
  actualizar(tipo, id, cambios) {
    const registro = this.extras[tipo].find((x) => x.id === Number(id));
    if (!registro) throw new Error('REGISTRO_NO_ENCONTRADO');
    Object.assign(registro, cambios);
    return registro;
  }
  esperarEscrituras() { return Promise.resolve(); }
  buscar(tipo, id) { return this.extras[tipo].find((x) => x.id === Number(id)) || null; }
}
module.exports = { RepositorioRegistrosComplementariosEnMemoria };

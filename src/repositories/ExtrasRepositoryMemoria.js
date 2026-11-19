'use strict';
class ExtrasRepositoryMemoria {
  constructor(extras) { this.extras = extras; }
  listar(tipo) { return this.extras[tipo]; }
  agregar(tipo, obj) {
    const lista = this.extras[tipo];
    const n = { id: lista.length ? lista[lista.length - 1].id + 1 : 1, ...obj };
    lista.push(n);
    return n;
  }
  actualizar(tipo, id, cambios) {
    const o = this.extras[tipo].find((x) => x.id === Number(id));
    if (!o) throw new Error('REGISTRO_NO_ENCONTRADO');
    Object.assign(o, cambios);
    return o;
  }
  esperarEscrituras() { return Promise.resolve(); }
  buscar(tipo, id) { return this.extras[tipo].find((x) => x.id === Number(id)) || null; }
}
module.exports = { ExtrasRepositoryMemoria };

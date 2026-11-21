"use strict";
async function cargarContexto(catalogo) {
  const [sedes, profs, bloques, pacientes] = await Promise.all([
    catalogo.policlinicos(),
    catalogo.profesionales(),
    catalogo.bloques(),
    catalogo.pacientes(),
  ]);
  return {
    listaSedes: sedes,
    listaProfs: profs,
    sedes: new Map(sedes.map((x) => [x.id, x])),
    profs: new Map(profs.map((x) => [x.id, x])),
    bloques: new Map(bloques.map((x) => [x.id, x])),
    pacientes: new Map(pacientes.map((x) => [x.rut, x])),
  };
}
function detalleCita(cita, ctx) {
  const bloque = ctx.bloques.get(cita.idBloque);
  const prof = bloque && ctx.profs.get(bloque.idProfesional);
  return {
    b: bloque,
    prof,
    pol: prof && ctx.sedes.get(bloque.idPoliclinico || prof.idPoliclinico),
    pac: ctx.pacientes.get(cita.rut),
    reemplazo: cita.idProfesionalReemplazo
      ? ctx.profs.get(cita.idProfesionalReemplazo)
      : null,
  };
}
module.exports = { cargarContexto, detalleCita };

"use strict";
// Carga de una vez los catálogos que las pantallas necesitan para mostrar nombres (evita consultar fila por fila).
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
// Datos legibles de una cita: bloque, profesional, sede y paciente.
function detalleCita(c, ctx) {
  const b = ctx.bloques.get(c.idBloque);
  const prof = b && ctx.profs.get(b.idProfesional);
  return {
    b,
    prof,
    pol: prof && ctx.sedes.get(b.idPoliclinico || prof.idPoliclinico),
    pac: ctx.pacientes.get(c.rut),
    reemplazo: c.idProfesionalReemplazo
      ? ctx.profs.get(c.idProfesionalReemplazo)
      : null,
  };
}
module.exports = { cargarContexto, detalleCita };

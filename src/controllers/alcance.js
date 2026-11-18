"use strict";
async function validar(c, u, ruta, q, d) {
  if (!u.idPoliclinico) throw new Error("FUERA_DE_SEDE");
  const op = c.operacion,
    idCita = d.idCita || q.get("idCita");
  if (idCita) await op.exigirCita(u, idCita);
  const idSolicitud = d.idSolicitud || q.get("idSolicitud");
  if (idSolicitud) {
    const e = (await c.catalogo.espera()).find(
      (e) => e.id === Number(idSolicitud),
    );
    if (!e || e.idPoliclinico !== Number(u.idPoliclinico))
      throw new Error("FUERA_DE_SEDE");
  }
  if (ruta.startsWith("/tens/documentos") && (d.id || q.get("id"))) {
    const doc = c.extras.buscar("documentos", d.id || q.get("id"));
    if (
      !doc ||
      (doc.idPoliclinico && doc.idPoliclinico !== Number(u.idPoliclinico))
    )
      throw new Error("FUERA_DE_SEDE");
    await op.exigirPaciente(u, doc.rut);
  }
  const rut = d.rut || q.get("rut");
  if (
    rut &&
    !(ruta === "/tens/pacientes" && d.nombres) &&
    ruta !== "/tens/agendar"
  )
    await op.exigirPaciente(u, rut);
  if (ruta === "/tens/avisos/leer") {
    const n = c.extras.buscar("notificaciones", d.id);
    if (!n || n.idPoliclinico !== Number(u.idPoliclinico))
      throw new Error("FUERA_DE_SEDE");
  }
}
module.exports = { validar };

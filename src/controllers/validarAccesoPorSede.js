"use strict";
const PARAMETROS_REVISADOS = new Set(["id", "idCita", "idSolicitud", "idBloque", "idPoliclinico", "idProfesional", "rut", "idComuna"]);
const PARECE_IDENTIFICADOR = /^(id[A-Z0-9_]\w*|rut\w*)$/;

async function validarAccesoPorSede(aplicacion, usuario, rutaPedida, parametrosUrl, datosEnviados) {
  if (!usuario.idPoliclinico) throw new Error("FUERA_DE_SEDE");
  const sedeDelUsuario = Number(usuario.idPoliclinico);
  const servicioOperacion = aplicacion.operacion;

  // Denegar por defecto: un parámetro que identifica un registro y que este
  // control no revisa no puede llegar al manejador.
  const nombres = [...Object.keys(datosEnviados), ...parametrosUrl.keys()];
  if (nombres.some((n) => PARECE_IDENTIFICADOR.test(n) && !PARAMETROS_REVISADOS.has(n)))
    throw new Error("FUERA_DE_SEDE");

  const idPoliclinico = datosEnviados.idPoliclinico || parametrosUrl.get("idPoliclinico");
  if (idPoliclinico && Number(idPoliclinico) !== sedeDelUsuario) throw new Error("FUERA_DE_SEDE");

  const idBloque = datosEnviados.idBloque || parametrosUrl.get("idBloque");
  // /tens/agendar responde con su propio mensaje claro cuando el bloque es de otra sede.
  if (idBloque && rutaPedida !== "/tens/agendar") {
    const bloque = await aplicacion.catalogo.bloque(idBloque);
    const profesional = bloque && (await aplicacion.catalogo.profesional(bloque.idProfesional));
    if (!bloque || servicioOperacion.sedeBloque(bloque, profesional) !== sedeDelUsuario)
      throw new Error("FUERA_DE_SEDE");
  }

  const idProfesional = datosEnviados.idProfesional || parametrosUrl.get("idProfesional");
  if (idProfesional) {
    const profesional = await aplicacion.catalogo.profesional(idProfesional);
    if (!profesional || !servicioOperacion.lugares(profesional).includes(sedeDelUsuario))
      throw new Error("FUERA_DE_SEDE");
  }

  const idCita = datosEnviados.idCita || parametrosUrl.get("idCita");
  if (idCita) await servicioOperacion.exigirCita(usuario, idCita);

  const idSolicitud = datosEnviados.idSolicitud || parametrosUrl.get("idSolicitud");
  if (idSolicitud) {
    const listaDeEspera = await aplicacion.catalogo.espera();
    const solicitud = listaDeEspera.find((item) => item.id === Number(idSolicitud));
    if (!solicitud || solicitud.idPoliclinico !== sedeDelUsuario) throw new Error("FUERA_DE_SEDE");
  }

  if (rutaPedida.startsWith("/tens/documentos") && (datosEnviados.id || parametrosUrl.get("id"))) {
    const documento = aplicacion.extras.buscar("documentos", datosEnviados.id || parametrosUrl.get("id"));
    if (!documento || (documento.idPoliclinico && documento.idPoliclinico !== sedeDelUsuario))
      throw new Error("FUERA_DE_SEDE");
    await servicioOperacion.exigirPaciente(usuario, documento.rut);
  }

  const rut = datosEnviados.rut || parametrosUrl.get("rut");
  const esAltaDePaciente = rutaPedida === "/tens/pacientes" && datosEnviados.nombres;
  if (rut && !esAltaDePaciente && rutaPedida !== "/tens/agendar")
    await servicioOperacion.exigirPaciente(usuario, rut);

  if (rutaPedida === "/tens/avisos/leer") {
    const aviso = aplicacion.extras.buscar("notificaciones", datosEnviados.id);
    if (!aviso || aviso.idPoliclinico !== sedeDelUsuario) throw new Error("FUERA_DE_SEDE");
  }
}
module.exports = { validarAccesoPorSede };

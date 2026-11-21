"use strict";
// Crea (o reutiliza) una cuenta de Administración y devuelve la ruta de un enlace
// de un solo uso (vale 30 minutos) para que su dueño elija la contraseña.
// Sirve para la primera puesta en marcha en producción, donde no hay clave demo.
const ACTOR = { nombre: "Instalación inicial", id: null };

async function crearEnlaceAdministrador(aplicacion, { correo, nombre }) {
  const correoNormalizado = String(correo || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(correoNormalizado)) throw new Error("Indica un correo válido.");
  const existente = (await aplicacion.catalogo.usuarios()).find((u) => u.correo.toLowerCase() === correoNormalizado);
  if (existente && existente.rol !== "ADMINISTRACION")
    throw new Error("Ese correo ya pertenece a una cuenta que no es de Administración.");
  const usuario =
    existente ||
    (await aplicacion.operacion.usuario(
      { nombre: String(nombre || "").trim() || "Administración", correo: correoNormalizado, rol: "ADMINISTRACION", activo: "1" },
      ACTOR,
    ));
  const ruta = await aplicacion.operacion.enlaceClave(usuario.id, ACTOR);
  aplicacion.guardar?.();
  return ruta;
}

module.exports = { crearEnlaceAdministrador };

"use strict";
const vistas = require("../views/autenticacion");
const { permitido, rutaInicio } = require("../auth/permisos");
const { error } = require("./mensajesDeError");

function crearControladorAuth({ auth, sesiones }) {
  return {
    formulario: ({ consulta, usuario }) =>
      usuario
        ? { redirigir: rutaInicio(usuario.rol) }
        : { html: vistas.login({ volver: consulta.get("volver") || "" }) },
    entrar: async ({ cuerpo, ip }) => {
      try {
        const { token, usuario } = await auth.iniciarSesion(
          cuerpo.correo,
          cuerpo.clave,
          ip,
        );
        const prefijo = permitido(usuario.rol, "admin") ? "/admin/" : "/tens/";
        const volver = String(cuerpo.volver || "");
        const destino = volver.startsWith(prefijo) && !/[\\\r\n]/.test(volver)
          ? volver
          : rutaInicio(usuario.rol);
        return { redirigir: destino, cookie: token };
      } catch (e) {
        // Solo las credenciales y el límite de intentos se informan al usuario;
        // una falla de la base u otro error inesperado sube como 500.
        if (!["CREDENCIALES_INVALIDAS", "DEMASIADOS_INTENTOS"].includes(e.message)) throw e;
        const estado = e.message === "DEMASIADOS_INTENTOS" ? 429 : 401;
        return {
          estado,
          html: vistas.login({ mensaje: error(e), volver: cuerpo.volver }),
        };
      }
    },
    salir: ({ token }) => {
      if (token) sesiones.cerrar(token);
      return { redirigir: "/", cookie: "" };
    },
  };
}
module.exports = { crearControladorAuth };

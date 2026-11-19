"use strict";
const vistas = require("../views/auth");
const { permitido, rutaInicio } = require("../auth/permisos");
const { error } = require("./mensajes");

function crearAuthController({ auth, sesiones }) {
  return {
    formulario: ({ consulta, usuario }) =>
      usuario
        ? { redirigir: rutaInicio(usuario.rol) }
        : { html: vistas.login({ volver: consulta.get("volver") || "" }) },
    entrar: async ({ cuerpo }) => {
      try {
        const { token, usuario } = await auth.iniciarSesion(
          cuerpo.correo,
          cuerpo.clave,
        );
        const prefijo = permitido(usuario.rol, "admin") ? "/admin/" : "/tens/";
        const volver = String(cuerpo.volver || "");
        const destino = volver.startsWith(prefijo) && !/[\\\r\n]/.test(volver)
          ? volver
          : rutaInicio(usuario.rol);
        return { redirigir: destino, cookie: token };
      } catch (e) {
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
module.exports = { crearAuthController };

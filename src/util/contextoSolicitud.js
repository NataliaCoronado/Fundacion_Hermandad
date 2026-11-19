"use strict";
const { AsyncLocalStorage } = require("node:async_hooks");

// Datos de la solicitud en curso (quién la hace y a qué ruta), disponibles en cualquier capa sin pasarlos por parámetro.
const almacen = new AsyncLocalStorage();
const correr = (contexto, fn) => almacen.run(contexto, fn);
const actual = () => almacen.getStore() || null;
// Quién origina un cambio: el personal con sesión, el paciente desde el portal o el sistema (procesos automáticos).
const origen = () => {
  const s = actual();
  if (!s) return "SISTEMA";
  if (s.origen) return s.origen;
  return s.usuario ? "PERSONAL" : "PACIENTE";
};
module.exports = { correr, actual, origen };

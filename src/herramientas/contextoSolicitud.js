"use strict";
const { AsyncLocalStorage } = require("node:async_hooks");

const almacen = new AsyncLocalStorage();
const correr = (contexto, fn) => almacen.run(contexto, fn);
const actual = () => almacen.getStore() || null;
const origen = () => {
  const s = actual();
  if (!s) return "SISTEMA";
  if (s.origen) return s.origen;
  return s.usuario ? "PERSONAL" : "PACIENTE";
};
module.exports = { correr, actual, origen };

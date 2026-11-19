"use strict";
const { AsyncLocalStorage } = require("node:async_hooks");
const almacen = new AsyncLocalStorage();
module.exports = {
  conPeticion: (datos, fn) => almacen.run(datos, fn),
  peticion: () => almacen.getStore() || {},
};

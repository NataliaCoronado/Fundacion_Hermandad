"use strict";
// Datos de la petición en curso que el diseño del portal necesita (por ejemplo, si hay un paciente con sesión),
// sin tener que pasarlos por cada vista.
const { AsyncLocalStorage } = require("node:async_hooks");
const almacen = new AsyncLocalStorage();
module.exports = {
  conPeticion: (datos, fn) => almacen.run(datos, fn),
  peticion: () => almacen.getStore() || {},
};

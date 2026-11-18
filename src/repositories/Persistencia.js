"use strict";
const fs = require("node:fs"),
  path = require("node:path");
class Persistencia {
  constructor(archivo) {
    this.archivo = archivo;
  }
  leer() {
    return fs.existsSync(this.archivo)
      ? JSON.parse(fs.readFileSync(this.archivo, "utf8"))
      : null;
  }
  guardar(datos) {
    fs.mkdirSync(path.dirname(this.archivo), { recursive: true, mode: 0o700 });
    const tmp = this.archivo + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(datos), { mode: 0o600 });
    fs.renameSync(tmp, this.archivo);
  }
}
module.exports = { Persistencia };

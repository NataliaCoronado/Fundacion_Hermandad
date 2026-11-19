"use strict";
const crypto = require("node:crypto");
const DURACION_MS = 8 * 60 * 60 * 1000;
const INACTIVIDAD_MS = 30 * 60 * 1000;

class Sesiones {
  constructor() {
    this.mapa = new Map();
  }
  crear(usuario) {
    const token = crypto.randomBytes(24).toString("hex");
    this.mapa.set(token, {
      usuario,
      expira: Date.now() + DURACION_MS,
      ultimaActividad: Date.now(),
    });
    return token;
  }
  obtener(token) {
    const s = this.mapa.get(token);
    if (!s) return null;
    if (this.vencida(s)) {
      this.mapa.delete(token);
      return null;
    }
    s.ultimaActividad = Date.now();
    return s.usuario;
  }
  guardarAviso(token, destino, mensaje) {
    const sesion = this.mapa.get(token);
    if (sesion) sesion.aviso = { destino, mensaje };
  }
  tomarAviso(token, destino) {
    const sesion = this.mapa.get(token);
    const aviso = sesion?.aviso;
    if (!aviso || aviso.destino !== destino) return undefined;
    delete sesion.aviso;
    return aviso.mensaje;
  }
  vencida(s, n = Date.now()) {
    return s.expira < n || n - s.ultimaActividad > INACTIVIDAD_MS;
  }
  limpiar() {
    const n = Date.now();
    for (const [token, s] of this.mapa) if (this.vencida(s, n)) this.mapa.delete(token);
  }
  revocarUsuario(id) {
    for (const [token, s] of this.mapa)
      if (s.usuario.id === id) this.mapa.delete(token);
  }
  cerrar(token) {
    this.mapa.delete(token);
  }
}
const leerCookie = (cabecera, nombre) => {
  for (const par of String(cabecera || "").split(";")) {
    const [k, ...v] = par.trim().split("=");
    if (k === nombre) return v.join("=");
  }
  return null;
};
module.exports = { Sesiones, leerCookie, DURACION_MS };

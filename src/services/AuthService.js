"use strict";
const { hashClave, verificarClave } = require("../auth/clave");

const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

class AuthService {
  constructor({ catalogo, sesiones, auditoria }) {
    Object.assign(this, { catalogo, sesiones, auditoria });
    this.intentos = new Map();
  }

  excedido(correo) {
    const ahora = Date.now();
    const l = (this.intentos.get(correo) || []).filter(
      (t) => ahora - t < VENTANA_MS,
    );
    if (l.length) this.intentos.set(correo, l);
    else this.intentos.delete(correo);
    return l.length >= MAX_INTENTOS;
  }

  async iniciarSesion(correo, clave) {
    const c = String(correo || "")
      .trim()
      .toLowerCase();
    if (this.excedido(c)) throw new Error("DEMASIADOS_INTENTOS");
    const u = await this.catalogo.usuarioPorCorreo(c);
    const guardado = u ? await this.catalogo.credencial(u.id) : null;
    const ok = verificarClave(clave, guardado) && u && u.activo;
    if (!ok) {
      this.intentos.set(c, [...(this.intentos.get(c) || []), Date.now()]);
      throw new Error("CREDENCIALES_INVALIDAS");
    }
    this.intentos.delete(c);
    if (u.rol !== "ADMINISTRACION" && !u.idPoliclinico)
      throw new Error("CREDENCIALES_INVALIDAS");
    const estado = this.auditoria.extras.extras.operacion;
    if (estado)
      (estado.usuarios[u.id] ||= {}).ultimoAcceso = new Date().toISOString();
    await this.auditoria.registrar(u, "Inicio de sesión");
    return { token: this.sesiones.crear(u), usuario: u };
  }

  async sembrarClaveDemo(clave) {
    for (const u of await this.catalogo.usuarios()) {
      if(!["admin@ejemplo.cl","tens@ejemplo.cl","telemedicina.usuario@ejemplo.cl"].includes(u.correo.toLowerCase())) continue;
      if (!(await this.catalogo.credencial(u.id)))
        await this.catalogo.guardarCredencial(u.id, hashClave(clave));
    }
  }
}
module.exports = { AuthService };

"use strict";
const { hashClave, verificarClave } = require("../auth/clave");

const VENTANA_MS = 15 * 60 * 1000;
// Una IP puede fallar 5 veces con una misma cuenta y 20 en total; una cuenta
// tolera 25 fallos sumando todas las IPs (frena ataques repartidos sin dejar
// que un solo atacante bloquee la cuenta a las demás personas).
const MAX_POR_IP_Y_CUENTA = 5;
const MAX_POR_IP = 20;
const MAX_POR_CUENTA = 25;

class AuthServicio {
  constructor({ catalogo, sesiones, auditoria }) {
    Object.assign(this, { catalogo, sesiones, auditoria });
    this.intentos = new Map();
  }

  recientes(clave) {
    const ahora = Date.now();
    const lista = (this.intentos.get(clave) || []).filter((t) => ahora - t < VENTANA_MS);
    if (lista.length) this.intentos.set(clave, lista);
    else this.intentos.delete(clave);
    return lista;
  }

  claves(correo, ip) {
    return { par: `par:${ip}|${correo}`, ip: `ip:${ip}`, cuenta: `cuenta:${correo}` };
  }

  excedido(correo, ip) {
    const k = this.claves(correo, ip);
    return (
      this.recientes(k.par).length >= MAX_POR_IP_Y_CUENTA ||
      this.recientes(k.ip).length >= MAX_POR_IP ||
      this.recientes(k.cuenta).length >= MAX_POR_CUENTA
    );
  }

  registrarFallo(correo, ip) {
    const ahora = Date.now();
    for (const clave of Object.values(this.claves(correo, ip)))
      this.intentos.set(clave, [...this.recientes(clave), ahora]);
  }

  async iniciarSesion(correo, clave, ip = "sin-ip") {
    const correoNormalizado = String(correo || "")
      .trim()
      .toLowerCase();
    if (this.excedido(correoNormalizado, ip)) throw new Error("DEMASIADOS_INTENTOS");
    const usuario = await this.catalogo.usuarioPorCorreo(correoNormalizado);
    const guardado = usuario ? await this.catalogo.credencial(usuario.id) : null;
    const ok = verificarClave(clave, guardado) && usuario && usuario.activo;
    if (!ok) {
      this.registrarFallo(correoNormalizado, ip);
      throw new Error("CREDENCIALES_INVALIDAS");
    }
    this.intentos.delete(this.claves(correoNormalizado, ip).par);
    if (usuario.rol !== "ADMINISTRACION" && !usuario.idPoliclinico)
      throw new Error("CREDENCIALES_INVALIDAS");
    const estado = this.auditoria.extras.extras.operacion;
    if (estado)
      (estado.usuarios[usuario.id] ||= {}).ultimoAcceso = new Date().toISOString();
    await this.auditoria.registrar(usuario, "Inicio de sesión");
    return { token: this.sesiones.crear(usuario), usuario: usuario };
  }

  async sembrarClaveDemo(clave) {
    for (const u of await this.catalogo.usuarios()) {
      if(!["admin@ejemplo.cl","tens@ejemplo.cl","telemedicina.usuario@ejemplo.cl"].includes(u.correo.toLowerCase())) continue;
      if (!(await this.catalogo.credencial(u.id)))
        await this.catalogo.guardarCredencial(u.id, hashClave(clave));
    }
  }
}
module.exports = { AuthServicio };

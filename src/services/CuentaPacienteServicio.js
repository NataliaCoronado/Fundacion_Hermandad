"use strict";
const { normalizarRut, rutValido } = require("../herramientas/rut");
const { hashClave, verificarClave } = require("../auth/clave");
const { textoLocal } = require("../herramientas/tiempo");

const CLAVE_MIN = 15;
const CLAVE_MAX = 128;
const MAX_FALLOS = 10;
const VENTANA_FALLOS_MS = 24 * 60 * 60 * 1000;
const BLOQUEO_MS = 24 * 60 * 60 * 1000;

class CuentaPacienteServicio {
  constructor({ catalogo, extras, citaRepo }) {
    Object.assign(this, { catalogo, extras, citaRepo });
    extras.extras.cuentasPaciente ||= [];
    extras.extras.solicitudesPaciente ||= [];
  }
  cuentas() {
    return this.extras.extras.cuentasPaciente;
  }
  cuenta(rut) {
    return this.cuentas().find((c) => c.rut === normalizarRut(rut)) || null;
  }

  bloqueos() {
    return (this.extras.extras.bloqueosVerificacion ||= {});
  }
  bloqueado(rut) {
    const b = this.bloqueos()[normalizarRut(rut)];
    return !!b && b.hasta > Date.now();
  }
  registrarFallo(rut) {
    const ahora = Date.now();
    const b = this.bloqueos();
    const e = b[rut] && ahora - b[rut].desde < VENTANA_FALLOS_MS ? b[rut] : { fallos: 0, desde: ahora, hasta: 0 };
    e.fallos += 1;
    if (e.fallos >= MAX_FALLOS) e.hasta = ahora + BLOQUEO_MS;
    b[rut] = e;
  }
  limpiarBloqueos() {
    const ahora = Date.now();
    for (const [k, e] of Object.entries(this.bloqueos()))
      if (e.hasta < ahora && ahora - e.desde > VENTANA_FALLOS_MS) delete this.bloqueos()[k];
  }

  async verificarIdentidad({ rut, fechaNacimiento, celular4 }) {
    const rutNormalizado = normalizarRut(rut);
    if (!rutValido(rutNormalizado)) return null;
    this.limpiarBloqueos();
    if (this.bloqueado(rutNormalizado)) return null;
    const paciente = await this.catalogo.paciente(rutNormalizado);
    const digitos = String(paciente?.telefono || "").replace(/\D/g, "");
    const ok =
      !!paciente &&
      paciente.activo !== false &&
      digitos.length >= 4 &&
      !!fechaNacimiento &&
      paciente.fechaNacimiento === fechaNacimiento &&
      digitos.slice(-4) === String(celular4 || "").replace(/\D/g, "");
    if (ok) delete this.bloqueos()[rutNormalizado];
    else if (paciente) this.registrarFallo(rutNormalizado);
    return ok ? paciente : null;
  }

  validarClave(clave, confirmar) {
    const c = String(clave || "");
    if (c.length < CLAVE_MIN || c.length > CLAVE_MAX)
      throw new Error(`La contraseña debe tener entre ${CLAVE_MIN} y ${CLAVE_MAX} caracteres.`);
    if (confirmar !== undefined && c !== String(confirmar || ""))
      throw new Error("Las contraseñas no coinciden.");
    return c;
  }

  async crear(d) {
    const clave = this.validarClave(d.clave, d.confirmarClave);
    if (d.acepto !== "1") throw new Error("Debes aceptar la política de privacidad.");
    const paciente = await this.verificarIdentidad(d);
    if (!paciente)
      throw new Error(
        "No pudimos verificar tus datos. Para crear una cuenta necesitas tener una ficha en un policlínico (se crea al reservar tu primera hora) con tu fecha de nacimiento y celular.",
      );
    if (this.cuenta(paciente.rut)) throw new Error("Ya existe una cuenta para este RUT. Inicia sesión o recupera tu contraseña.");
    this.cuentas().push({ rut: paciente.rut, hash: hashClave(clave), creada: textoLocal(), actualizada: textoLocal() });
    return paciente;
  }

  async ingresar({ rut, clave }) {
    const cuenta = this.cuenta(rut);
    const ok = verificarClave(clave, cuenta?.hash);
    if (!cuenta || !ok) return null;
    const paciente = await this.catalogo.paciente(cuenta.rut);
    if (!paciente || paciente.activo === false) return null;
    cuenta.ultimoIngreso = textoLocal();
    return paciente;
  }

  async restablecer(d) {
    const clave = this.validarClave(d.clave, d.confirmarClave);
    const paciente = await this.verificarIdentidad(d);
    const cuenta = paciente && this.cuenta(paciente.rut);
    if (!cuenta) throw new Error("No pudimos verificar tus datos o no existe una cuenta para este RUT.");
    cuenta.hash = hashClave(clave);
    cuenta.actualizada = textoLocal();
    return paciente;
  }

  async familiares(rut) {
    const rutNormalizado = normalizarRut(rut);
    return (await this.catalogo.pacientes()).filter(
      (p) => p.rut !== rutNormalizado && p.activo !== false && p.responsable && normalizarRut(p.responsable.rut || "") === rutNormalizado,
    );
  }
  async puedeVer(rutCuenta, rutObjetivo) {
    const rutObjetivoNormalizado = normalizarRut(rutObjetivo);
    if (normalizarRut(rutCuenta) === rutObjetivoNormalizado) return true;
    return (await this.familiares(rutCuenta)).some((p) => p.rut === rutObjetivoNormalizado);
  }
  async exigir(rutCuenta, rutObjetivo) {
    if (!(await this.puedeVer(rutCuenta, rutObjetivo))) throw new Error("FUERA_DE_SEDE");
  }

  solicitar({ rut, tipo, detalle, idPoliclinico }) {
    const solicitud = this.extras.agregar("solicitudesPaciente", {
      rut: normalizarRut(rut),
      tipo,
      detalle: String(detalle || "").trim().slice(0, 300),
      fecha: textoLocal(),
      estado: "Pendiente",
    });
    this.extras.agregar("notificaciones", {
      tipo: "SOLICITUD_PACIENTE",
      fecha: textoLocal(),
      idPoliclinico: idPoliclinico || null,
      leida: false,
      texto: `Solicitud del portal (${tipo}) del RUT ${solicitud.rut}: ${solicitud.detalle}`,
    });
    return solicitud;
  }
}
module.exports = { CuentaPacienteServicio, CLAVE_MIN, MAX_FALLOS };

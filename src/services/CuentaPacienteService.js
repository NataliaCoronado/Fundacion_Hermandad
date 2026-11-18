"use strict";
const { normalizarRut, rutValido } = require("../util/rut");
const { hashClave, verificarClave } = require("../auth/clave");
const { textoLocal } = require("../util/tiempo");

const CLAVE_MIN = 15;
const CLAVE_MAX = 128;
const MAX_FALLOS = 10;
const VENTANA_FALLOS_MS = 24 * 60 * 60 * 1000;
const BLOQUEO_MS = 24 * 60 * 60 * 1000;

// Cuenta opcional del paciente (portal). Se identifica con RUT y contraseña.
// Para crearla o recuperarla se verifica la identidad con datos de la ficha: fecha de nacimiento
// y los últimos 4 dígitos del celular registrado. Conocer un RUT nunca basta.
// El acceso a familiares solo existe si la ficha del familiar registra a esta persona como adulto responsable.
class CuentaPacienteService {
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

  // Bloqueo por RUT (se guarda con los datos, sobrevive a reinicios y no depende de la IP):
  // tras MAX_FALLOS verificaciones fallidas en 24 h, ese RUT no se puede verificar por 24 h.
  bloqueos() {
    return (this.extras.extras.bloqueosVerificacion ||= {});
  }
  bloqueado(rut) {
    const b = this.bloqueos()[normalizarRut(rut)];
    return !!b && b.hasta > Date.now();
  }
  registrarFallo(rut) {
    const n = Date.now();
    const b = this.bloqueos();
    const e = b[rut] && n - b[rut].desde < VENTANA_FALLOS_MS ? b[rut] : { fallos: 0, desde: n, hasta: 0 };
    e.fallos += 1;
    if (e.fallos >= MAX_FALLOS) e.hasta = n + BLOQUEO_MS;
    b[rut] = e;
  }
  limpiarBloqueos() {
    const n = Date.now();
    for (const [k, e] of Object.entries(this.bloqueos()))
      if (e.hasta < n && n - e.desde > VENTANA_FALLOS_MS) delete this.bloqueos()[k];
  }

  // Devuelve la ficha si los datos coinciden; si no, null (sin revelar qué dato falló ni si hay bloqueo).
  async verificarIdentidad({ rut, fechaNacimiento, celular4 }) {
    const r = normalizarRut(rut);
    if (!rutValido(r)) return null;
    this.limpiarBloqueos();
    if (this.bloqueado(r)) return null;
    const p = await this.catalogo.paciente(r);
    const digitos = String(p?.telefono || "").replace(/\D/g, "");
    const ok =
      !!p &&
      p.activo !== false &&
      digitos.length >= 4 &&
      !!fechaNacimiento &&
      p.fechaNacimiento === fechaNacimiento &&
      digitos.slice(-4) === String(celular4 || "").replace(/\D/g, "");
    // Solo se cuentan fallos de RUT con ficha: así RUT inventados no llenan el registro.
    if (ok) delete this.bloqueos()[r];
    else if (p) this.registrarFallo(r);
    return ok ? p : null;
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
    const p = await this.verificarIdentidad(d);
    if (!p)
      throw new Error(
        "No pudimos verificar tus datos. Para crear una cuenta necesitas tener una ficha en un policlínico (se crea al reservar tu primera hora) con tu fecha de nacimiento y celular.",
      );
    if (this.cuenta(p.rut)) throw new Error("Ya existe una cuenta para este RUT. Inicia sesión o recupera tu contraseña.");
    this.cuentas().push({ rut: p.rut, hash: hashClave(clave), creada: textoLocal(), actualizada: textoLocal() });
    return p;
  }

  async ingresar({ rut, clave }) {
    const c = this.cuenta(rut);
    const ok = verificarClave(clave, c?.hash);
    if (!c || !ok) return null;
    const p = await this.catalogo.paciente(c.rut);
    if (!p || p.activo === false) return null;
    c.ultimoIngreso = textoLocal();
    return p;
  }

  async restablecer(d) {
    const clave = this.validarClave(d.clave, d.confirmarClave);
    const p = await this.verificarIdentidad(d);
    const c = p && this.cuenta(p.rut);
    if (!c) throw new Error("No pudimos verificar tus datos o no existe una cuenta para este RUT.");
    c.hash = hashClave(clave);
    c.actualizada = textoLocal();
    return p;
  }

  // Fichas que registran a esta persona como adulto responsable: son los familiares vinculados.
  async familiares(rut) {
    const r = normalizarRut(rut);
    return (await this.catalogo.pacientes()).filter(
      (p) => p.rut !== r && p.activo !== false && p.responsable && normalizarRut(p.responsable.rut || "") === r,
    );
  }
  async puedeVer(rutCuenta, rutObjetivo) {
    const r = normalizarRut(rutObjetivo);
    if (normalizarRut(rutCuenta) === r) return true;
    return (await this.familiares(rutCuenta)).some((p) => p.rut === r);
  }
  async exigir(rutCuenta, rutObjetivo) {
    if (!(await this.puedeVer(rutCuenta, rutObjetivo))) throw new Error("FUERA_DE_SEDE");
  }

  // Solicitudes que resuelve el personal (corrección de identidad, vinculación de un familiar).
  solicitar({ rut, tipo, detalle, idPoliclinico }) {
    const s = this.extras.agregar("solicitudesPaciente", {
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
      texto: `Solicitud del portal (${tipo}) del RUT ${s.rut}: ${s.detalle}`,
    });
    return s;
  }
}
module.exports = { CuentaPacienteService, CLAVE_MIN, MAX_FALLOS };

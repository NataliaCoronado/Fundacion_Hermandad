"use strict";
class RepositorioCatalogoEnMemoria {
  constructor(datos) {
    this.datos = datos;
  }
  actualizarBloque(id, d) {
    const bloque = this.datos.bloques.find((x) => x.id === Number(id));
    if (!bloque) throw new Error("BLOQUE_NO_DISPONIBLE");
    Object.assign(bloque, d);
    return bloque;
  }
  guardarEquipo(d) {
    let profesional = this.datos.profesionales.find((x) => x.id === d.id);
    if (!profesional) {
      profesional = {
        id: Math.max(0, ...this.datos.profesionales.map((x) => x.id)) + 1,
        activo: true,
      };
      this.datos.profesionales.push(profesional);
    }
    Object.assign(profesional, {
      nombre: d.nombre,
      especialidad: d.especialidad,
      idPoliclinico: d.idPoliclinico,
    });
    return profesional;
  }
  guardarLugar(d) {
    let sede = this.datos.policlinicos.find((x) => x.id === Number(d.id));
    if (!sede) {
      sede = { id: Math.max(0, ...this.datos.policlinicos.map((x) => x.id)) + 1 };
      this.datos.policlinicos.push(sede);
    }
    Object.assign(sede, d, { id: sede.id });
    return sede;
  }
  guardarEspecialidad(d) {
    return d;
  }
  guardarUsuario(d) {
    if (
      this.datos.usuarios.some(
        (x) =>
          x.correo.toLowerCase() === d.correo.toLowerCase() && x.id !== d.id,
      )
    )
      throw new Error("El correo ya tiene acceso.");
    let usuario = this.datos.usuarios.find((x) => x.id === d.id);
    if (!usuario) {
      usuario = { id: require("node:crypto").randomUUID() };
      this.datos.usuarios.push(usuario);
    }
    Object.assign(usuario, {
      nombre: d.nombre,
      correo: d.correo,
      rol: d.rol,
      idPoliclinico: d.idPoliclinico,
      activo: d.activo,
    });
    return usuario;
  }
  policlinicos() {
    return this.datos.policlinicos;
  }
  policlinico(id) {
    return this.datos.policlinicos.find((p) => p.id === Number(id)) || null;
  }
  comunas() {
    return require('../models/comunas').completar(this.datos.comunas).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  especialidades() {
    return [
      ...new Set(this.datos.profesionales.map((p) => p.especialidad)),
    ].sort();
  }
  profesionales() {
    return this.datos.profesionales;
  }
  profesional(id) {
    return this.datos.profesionales.find((p) => p.id === Number(id)) || null;
  }
  setProfesionalActivo(id, activo) {
    const profesional = this.datos.profesionales.find((p) => p.id === Number(id));
    if (!profesional) throw new Error("PROFESIONAL_NO_ENCONTRADO");
    profesional.activo = !!activo;
  }
  eliminarProfesional(id) {
    const i = this.datos.profesionales.findIndex((p) => p.id === Number(id));
    if (i < 0) throw new Error("PROFESIONAL_NO_ENCONTRADO");
    this.datos.profesionales.splice(i, 1);
    this.datos.bloques = this.datos.bloques.filter(
      (b) => b.idProfesional !== Number(id),
    );
  }
  pacientes() {
    return this.datos.pacientes;
  }
  paciente(rut) {
    return this.datos.pacientes.find((p) => p.rut === rut) || null;
  }
  crearPaciente(p) {
    if (this.datos.pacientes.some((x) => x.rut === p.rut))
      throw new Error("PACIENTE_EXISTE");
    this.datos.pacientes.push({ rut: p.rut, ...this.fichaDe(p) });
  }
  fichaDe(p) {
    return {
      nombre: `${p.nombres} ${p.apellidos}`,
      nombres: p.nombres,
      apellidos: p.apellidos,
      telefono: p.telefono,
      tieneWhatsapp: !!p.tieneWhatsapp,
      correo: p.correo || "",
      fechaNacimiento: p.fechaNacimiento,
      genero: p.genero,
      nacionalidad: p.nacionalidad,
      direccion: p.direccion,
      idComuna: Number(p.idComuna),
      responsable: p.responsable || null,
    };
  }
  actualizarPaciente(rut, p) {
    const actual = this.datos.pacientes.find((x) => x.rut === rut);
    if (!actual) throw new Error("PACIENTE_NO_ENCONTRADO");
    Object.assign(actual, this.fichaDe(p));
  }
  bloques() {
    return this.datos.bloques;
  }
  bloque(id) {
    return this.datos.bloques.find((b) => b.id === Number(id)) || null;
  }
  crearBloque(b) {
    if (
      this.datos.bloques.some(
        (x) =>
          x.idProfesional === b.idProfesional &&
          x.fecha === b.fecha &&
          x.hora === b.hora,
      )
    )
      throw new Error("BLOQUE_DUPLICADO");
    const min = require("../services/OperacionServicio").minutos;
    if (
      this.datos.bloques.some(
        (x) =>
          x.idProfesional === b.idProfesional &&
          x.fecha === b.fecha &&
          min(x.hora) < min(b.hora) + (b.duracion || 30) &&
          min(x.hora) + (x.duracion || 30) > min(b.hora),
      )
    )
      throw new Error("El profesional tiene un cruce horario.");
    const bloqueNuevo = {
      id: this.datos.secuencias.bloque++,
      idProfesional: b.idProfesional,
      fecha: b.fecha,
      hora: b.hora,
      idPoliclinico: b.idPoliclinico,
      especialidad: b.especialidad,
      duracion: b.duracion || 30,
      publicado: !!b.publicado,
    };
    this.datos.bloques.push(bloqueNuevo);
    return bloqueNuevo;
  }
  cambiarPublicacion({ idProfesional, desde, hasta, idBloque, publicar }) {
    let n = 0;
    for (const b of this.datos.bloques) {
      if (
        b.idProfesional !== Number(idProfesional) ||
        b.fecha < desde ||
        b.fecha > hasta
      )
        continue;
      if (idBloque && b.id !== Number(idBloque)) continue;
      if (b.publicado === !!publicar) continue;
      if (
        this.datos.citas.some(
          (c) => c.idBloque === b.id && c.estadoReserva === "ACTIVA",
        )
      )
        continue;
      b.publicado = !!publicar;
      n++;
    }
    return n;
  }
  bloquearLibres({ idProfesional, fecha }) {
    let n = 0;
    for (const b of this.datos.bloques) {
      if (
        b.idProfesional !== Number(idProfesional) ||
        b.fecha !== fecha ||
        !b.publicado
      )
        continue;
      if (
        this.datos.citas.some(
          (c) => c.idBloque === b.id && c.estadoReserva === "ACTIVA",
        )
      )
        continue;
      b.publicado = false;
      n++;
    }
    return n;
  }
  espera() {
    return this.datos.espera;
  }
  agregarEspera(e) {
    const esperaNueva = {
      id: this.datos.secuencias.espera++,
      rut: e.rut,
      idPoliclinico: e.idPoliclinico,
      especialidad: e.especialidad,
      registradaEn: e.registradaEn,
      registradaPor: e.idUsuario ?? null,
      estado: "EN_ESPERA",
    };
    this.datos.espera.push(esperaNueva);
    return esperaNueva;
  }
  actualizarEspera(id, estado) {
    const e = this.datos.espera.find((x) => x.id === Number(id));
    if (!e) throw new Error("ESPERA_NO_ENCONTRADA");
    e.estado = estado;
  }
  contactos() {
    return [...this.datos.contactos].reverse();
  }
  agregarContacto(c) {
    const contactoNuevo = { id: this.datos.secuencias.contacto++, ...c };
    this.datos.contactos.push(contactoNuevo);
    return contactoNuevo;
  }
  usuarios() {
    return this.datos.usuarios;
  }
  usuarioPorCorreo(correo) {
    return (
      this.datos.usuarios.find(
        (u) => u.correo.toLowerCase() === String(correo).toLowerCase(),
      ) || null
    );
  }
  credencial(idUsuario) {
    return this.datos.credenciales[idUsuario] || null;
  }
  guardarCredencial(idUsuario, hash) {
    this.datos.credenciales[idUsuario] = hash;
  }
}
module.exports = { RepositorioCatalogoEnMemoria };

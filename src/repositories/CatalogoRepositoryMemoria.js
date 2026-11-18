"use strict";
// Policlínicos, profesionales, pacientes, bloques, espera, contactos, usuarios y credenciales (modo memoria).
class CatalogoRepositoryMemoria {
  constructor(datos) {
    this.datos = datos;
  }
  actualizarBloque(id, d) {
    const b = this.datos.bloques.find((x) => x.id === Number(id));
    if (!b) throw new Error("BLOQUE_NO_DISPONIBLE");
    Object.assign(b, d);
    return b;
  }
  guardarEquipo(d) {
    let p = this.datos.profesionales.find((x) => x.id === d.id);
    if (!p) {
      p = {
        id: Math.max(0, ...this.datos.profesionales.map((x) => x.id)) + 1,
        activo: true,
      };
      this.datos.profesionales.push(p);
    }
    Object.assign(p, {
      nombre: d.nombre,
      especialidad: d.especialidad,
      idPoliclinico: d.idPoliclinico,
    });
    return p;
  }
  guardarLugar(d) {
    let p = this.datos.policlinicos.find((x) => x.id === Number(d.id));
    if (!p) {
      p = { id: Math.max(0, ...this.datos.policlinicos.map((x) => x.id)) + 1 };
      this.datos.policlinicos.push(p);
    }
    Object.assign(p, d, { id: p.id });
    return p;
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
    let u = this.datos.usuarios.find((x) => x.id === d.id);
    if (!u) {
      u = { id: require("node:crypto").randomUUID() };
      this.datos.usuarios.push(u);
    }
    Object.assign(u, {
      nombre: d.nombre,
      correo: d.correo,
      rol: d.rol,
      idPoliclinico: d.idPoliclinico,
      activo: d.activo,
    });
    return u;
  }
  policlinicos() {
    return this.datos.policlinicos;
  }
  policlinico(id) {
    return this.datos.policlinicos.find((p) => p.id === Number(id)) || null;
  }
  comunas() {
    return this.datos.comunas;
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
    const p = this.datos.profesionales.find((p) => p.id === Number(id));
    if (!p) throw new Error("PROFESIONAL_NO_ENCONTRADO");
    p.activo = !!activo;
  }
  // Solo para integrantes sin historial: el servicio verifica antes que no tengan reservas.
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
    const min = require("../services/OperacionService").minutos;
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
    const n = {
      id: this.datos.secuencias.bloque++,
      idProfesional: b.idProfesional,
      fecha: b.fecha,
      hora: b.hora,
      idPoliclinico: b.idPoliclinico,
      especialidad: b.especialidad,
      duracion: b.duracion || 30,
      publicado: !!b.publicado,
    };
    this.datos.bloques.push(n);
    return n;
  }
  // Publica (libera) o deja de ofrecer (bloquea) cupos de un profesional en un rango de fechas, o un solo cupo.
  // Los cupos con una cita activa no se tocan. Devuelve cuántos cambiaron.
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
  // Ausencia de un profesional: los cupos libres de ese día dejan de ofrecerse. Devuelve cuántos se cerraron.
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
    const n = {
      id: this.datos.secuencias.espera++,
      rut: e.rut,
      idPoliclinico: e.idPoliclinico,
      especialidad: e.especialidad,
      registradaEn: e.registradaEn,
      estado: "EN_ESPERA",
    };
    this.datos.espera.push(n);
    return n;
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
    const n = { id: this.datos.secuencias.contacto++, ...c };
    this.datos.contactos.push(n);
    return n;
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
module.exports = { CatalogoRepositoryMemoria };

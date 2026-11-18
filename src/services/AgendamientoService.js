"use strict";
const { textoLocal } = require("../util/tiempo");

// CU-03 (agendar), CU-05 (cancelar) y CU-07 (asistencia).
class AgendamientoService {
  constructor(citaRepo, catalogo, extras) {
    this.citaRepo = citaRepo;
    this.catalogo = catalogo;
    this.extras = extras;
  }

  // Bloques publicados y sin cita activa. Filtros opcionales: policlínico, fecha y especialidad.
  async bloquesDisponibles({ idPoliclinico, fecha, especialidad } = {}) {
    const sedes=new Map((await this.catalogo.policlinicos()).map(s=>[s.id,s]));
    const profs = new Map(
      (await this.catalogo.profesionales()).map((p) => [p.id, p]),
    );
    const ocupados = new Set(
      (await this.citaRepo.listar())
        .filter((c) => c.estadoReserva === "ACTIVA")
        .map((c) => c.idBloque),
    );
    return (await this.catalogo.bloques()).filter((b) => {
      if (!b.publicado || ocupados.has(b.id)) return false;
      const prof = profs.get(b.idProfesional);
      if (!prof || !prof.activo) return false;
      if(sedes.get(b.idPoliclinico||prof.idPoliclinico)?.activo===false || this.catalogo.especialidadActiva?.(b.especialidad||prof.especialidad)===false) return false;
      if (
        idPoliclinico &&
        (b.idPoliclinico || prof.idPoliclinico) !== Number(idPoliclinico)
      )
        return false;
      if (
        especialidad &&
        (b.especialidad || prof.especialidad) !== especialidad
      )
        return false;
      if (fecha && b.fecha !== fecha) return false;
      return true;
    });
  }

  // TENS/TONS registra una cita en nombre del paciente (el paciente se identifica por RUT).
  async agendar({ rut, idBloque, idUsuario, canal = "PRESENCIAL" }) {
    if (
      !(await this.catalogo.paciente(rut)) ||
      (await this.catalogo.paciente(rut)).activo === false
    )
      throw new Error("PACIENTE_NO_ENCONTRADO");
    const bloque = await this.catalogo.bloque(idBloque);
    if (!bloque || !bloque.publicado) throw new Error("BLOQUE_NO_DISPONIBLE");
    const prof = await this.catalogo.profesional(bloque.idProfesional);
    if (!prof || !prof.activo) throw new Error("BLOQUE_NO_DISPONIBLE");
    const sede=await this.catalogo.policlinico(bloque.idPoliclinico||prof.idPoliclinico);
    if(sede?.activo===false||this.catalogo.especialidadActiva?.(bloque.especialidad||prof.especialidad)===false) throw new Error("BLOQUE_NO_DISPONIBLE");
    if (await this.citaRepo.buscarActivaPorBloque(idBloque))
      throw new Error("BLOQUE_OCUPADO");
    return this.citaRepo.crear({
      rut,
      idBloque: Number(idBloque),
      idUsuario,
      canal,
      estadoReserva: "ACTIVA",
      estadoConfirmacion: "PENDIENTE",
      asistencia: null,
      origenCancelacion: null,
    });
  }

  // La cancelación solo la origina el paciente por WhatsApp, TENS/TONS (asistida) o la institución. El silencio nunca cancela.
  async cancelar(idCita, origen) {
    if (!["WHATSAPP", "ASISTIDA", "INSTITUCIONAL"].includes(origen))
      throw new Error("ORIGEN_INVALIDO");
    const cita = await this.citaRepo.buscarPorId(idCita);
    if (!cita) throw new Error("CITA_NO_ENCONTRADA");
    if (cita.asistencia==="ASISTIO") throw new Error("La atención ya fue realizada.");
    if (cita.estadoReserva !== "ACTIVA") throw new Error("CITA_NO_ACTIVA");
    const actualizada = await this.citaRepo.actualizar({
      ...cita,
      estadoReserva: "CANCELADA",
      origenCancelacion: origen,
    });
    await this.avisarCupoLiberado(cita);
    return actualizada;
  }

  // CU-05: al liberarse un cupo se avisa a TENS/TONS de la sede para ofrecerlo a la lista de espera.
  async avisarCupoLiberado(cita) {
    const b = await this.catalogo.bloque(cita.idBloque);
    const prof = b && (await this.catalogo.profesional(b.idProfesional));
    if (!prof) return;
    const sede = await this.catalogo.policlinico(
      b.idPoliclinico || prof.idPoliclinico,
    );
    await this.extras.agregar("notificaciones", {
      tipo: "CUPO_LIBERADO",
      fecha: textoLocal(),
      idPoliclinico: b.idPoliclinico || prof.idPoliclinico,
      leida: false,
      texto: `Cupo liberado: ${b.fecha} ${b.hora}, ${prof.especialidad}, ${sede ? sede.nombre : ""}. Revisa la lista de espera.`,
    });
  }

  async registrarAsistencia(idCita, asistio) {
    const cita = await this.citaRepo.buscarPorId(idCita);
    if (!cita || cita.estadoReserva !== "ACTIVA")
      throw new Error("CITA_NO_ACTIVA");
    return this.citaRepo.actualizar({
      ...cita,
      asistencia: asistio ? "ASISTIO" : "NO_ASISTIO",
    });
  }
}
module.exports = { AgendamientoService };

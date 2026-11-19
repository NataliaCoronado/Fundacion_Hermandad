"use strict";
const { normalizarRut } = require("../util/rut");
const { hoy } = require("../util/tiempo");

class EsperaService {
  constructor(catalogo, agendamiento) {
    this.catalogo = catalogo;
    this.agendamiento = agendamiento;
  }

  async registrar({ rut, idPoliclinico, especialidad, idUsuario }) {
    rut = normalizarRut(rut);
    if (!(await this.catalogo.paciente(rut)))
      throw new Error("PACIENTE_NO_ENCONTRADO");
    if (!(await this.catalogo.policlinico(idPoliclinico)))
      throw new Error("POLICLINICO_INVALIDO");
    const oferta =
      this.catalogo.datos?.extras?.operacion?.sedes?.[Number(idPoliclinico)]
        ?.especialidades ||
      require("../models/sedesInfo").infoSede(idPoliclinico)?.especialidades ||
      [];
    if (!especialidad || !oferta.includes(especialidad))
      throw new Error("ESPECIALIDAD_INVALIDA");
    const ya = (await this.catalogo.espera()).some(
      (e) =>
        e.rut === rut &&
        e.idPoliclinico === Number(idPoliclinico) &&
        e.especialidad === especialidad &&
        ["EN_ESPERA", "CUPO_OFRECIDO"].includes(e.estado),
    );
    if (ya) throw new Error("YA_EN_ESPERA");
    return this.catalogo.agregarEspera({
      rut,
      idPoliclinico: Number(idPoliclinico),
      especialidad,
      registradaEn: hoy(),
      idUsuario,
    });
  }

  async vigentes() {
    const lista = (await this.catalogo.espera()).filter((e) =>
      ["EN_ESPERA", "CUPO_OFRECIDO"].includes(e.estado),
    );
    const salida = [];
    for (const e of lista) {
      const cupos = (
        await this.agendamiento.bloquesDisponibles({
          idPoliclinico: e.idPoliclinico,
          especialidad: e.especialidad,
        })
      ).filter(
        (b) =>
          b.fecha >= hoy() &&
          (!/mañana/i.test(e.preferencia || "") || b.hora < "12:00") &&
          (!/tarde/i.test(e.preferencia || "") || b.hora >= "12:00"),
      );
      salida.push({ ...e, cupos });
    }
    return salida;
  }

  async asignar({ idSolicitud, idBloque, idUsuario }) {
    const e = (await this.catalogo.espera()).find(
      (x) => x.id === Number(idSolicitud),
    );
    if (!e || !["EN_ESPERA", "CUPO_OFRECIDO"].includes(e.estado))
      throw new Error("ESPERA_NO_ENCONTRADA");
    const compatibles = await this.agendamiento.bloquesDisponibles({
      idPoliclinico: e.idPoliclinico,
      especialidad: e.especialidad,
    });
    if (
      !compatibles.some(
        (b) =>
          b.id === Number(idBloque) &&
          b.fecha >= hoy() &&
          (!/mañana/i.test(e.preferencia || "") || b.hora < "12:00") &&
          (!/tarde/i.test(e.preferencia || "") || b.hora >= "12:00"),
      )
    )
      throw new Error("BLOQUE_NO_DISPONIBLE");
    const cita = await this.agendamiento.agendar({
      rut: e.rut,
      idBloque,
      idUsuario,
    });
    await this.catalogo.actualizarEspera(e.id, "ASIGNADA");
    return cita;
  }

  async retirar(idSolicitud) {
    await this.catalogo.actualizarEspera(idSolicitud, "RETIRADA");
  }
}
module.exports = { EsperaService };

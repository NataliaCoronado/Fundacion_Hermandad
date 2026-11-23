"use strict";
const { normalizarRut } = require("../herramientas/rut");
const { hoy } = require("../herramientas/tiempo");

const ESTADOS_VIGENTES = ["EN_ESPERA", "CUPO_OFRECIDO"];
const ESPECIALIDADES_CON_LISTA_POR_DEFECTO = ["Psicología", "Kinesiología"];
const ORDEN_PRIORIDAD = { Alta: 0, Media: 1, Normal: 2 };

function especialidadTieneLista(meta, especialidad) {
  const definida = meta?.especialidades?.[especialidad]?.listaEspera;
  return typeof definida === "boolean"
    ? definida
    : ESPECIALIDADES_CON_LISTA_POR_DEFECTO.includes(especialidad);
}

class EsperaServicio {
  constructor(catalogo, agendamiento, extras) {
    this.catalogo = catalogo;
    this.agendamiento = agendamiento;
    this.extras = extras;
  }

  get meta() {
    return this.extras?.extras?.operacion;
  }

  tieneLista(especialidad) {
    return especialidadTieneLista(this.meta, especialidad);
  }

  // Prioridad y preferencia horaria se guardan aparte, en los datos de operación.
  datosDeSolicitud(e) {
    return this.meta?.espera?.[e.id] || {};
  }

  calzaConPreferencia(e, bloque) {
    const preferencia = e.preferencia || this.datosDeSolicitud(e).preferencia || "";
    if (/mañana/i.test(preferencia) && bloque.hora >= "12:00") return false;
    if (/tarde/i.test(preferencia) && bloque.hora < "12:00") return false;
    return true;
  }

  async datosDelBloque(bloque) {
    const profesional = await this.catalogo.profesional(bloque.idProfesional);
    return {
      especialidad: bloque.especialidad || profesional?.especialidad,
      idPoliclinico: Number(bloque.idPoliclinico || profesional?.idPoliclinico),
    };
  }

  async cambiarPublicacion(bloque, publicar) {
    await this.catalogo.cambiarPublicacion({
      idProfesional: bloque.idProfesional,
      desde: bloque.fecha,
      hasta: bloque.fecha,
      idBloque: bloque.id,
      publicar,
    });
  }

  async retenerSiCorresponde(cita, origen) {
    if (!["ASISTIDA", "WHATSAPP"].includes(origen)) return false;
    const bloque = await this.catalogo.bloque(cita.idBloque);
    if (!bloque || !bloque.publicado || bloque.fecha < hoy()) return false;
    const { especialidad, idPoliclinico } = await this.datosDelBloque(bloque);
    if (!this.tieneLista(especialidad)) return false;
    const hayAlguienEsperando = (await this.catalogo.espera()).some(
      (e) =>
        ESTADOS_VIGENTES.includes(e.estado) &&
        e.idPoliclinico === idPoliclinico &&
        e.especialidad === especialidad,
    );
    if (!hayAlguienEsperando) return false;
    await this.cambiarPublicacion(bloque, false);
    (this.meta.bloques[bloque.id] ||= {}).retenidoEspera = true;
    return true;
  }

  async retenidos(idPoliclinico) {
    const ocupados = new Set(
      (await this.agendamiento.citaRepo.listar())
        .filter((c) => c.estadoReserva === "ACTIVA")
        .map((c) => c.idBloque),
    );
    const salida = [];
    for (const b of await this.catalogo.bloques()) {
      if (!b.retenidoEspera || b.publicado || ocupados.has(b.id) || b.fecha < hoy()) continue;
      const datos = await this.datosDelBloque(b);
      if (idPoliclinico && datos.idPoliclinico !== Number(idPoliclinico)) continue;
      salida.push({ ...b, ...datos });
    }
    return salida.sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  }

  async soltar({ idBloque }) {
    const bloque = await this.catalogo.bloque(idBloque);
    if (!bloque || !bloque.retenidoEspera) throw new Error("BLOQUE_NO_DISPONIBLE");
    await this.cambiarPublicacion(bloque, true);
    delete this.meta.bloques[bloque.id].retenidoEspera;
    return bloque;
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
      require("../models/informacionDeSedes").infoSede(idPoliclinico)?.especialidades ||
      [];
    if (!especialidad || !oferta.includes(especialidad))
      throw new Error("ESPECIALIDAD_INVALIDA");
    if (!this.tieneLista(especialidad)) throw new Error("ESPECIALIDAD_SIN_LISTA");
    const ya = (await this.catalogo.espera()).some(
      (e) =>
        e.rut === rut &&
        e.idPoliclinico === Number(idPoliclinico) &&
        e.especialidad === especialidad &&
        ESTADOS_VIGENTES.includes(e.estado),
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
      ESTADOS_VIGENTES.includes(e.estado),
    );
    const retenidos = await this.retenidos();
    const salida = [];
    for (const e of lista) {
      const cupos = [
        ...(await this.agendamiento.bloquesDisponibles({
          idPoliclinico: e.idPoliclinico,
          especialidad: e.especialidad,
        })),
        ...retenidos
          .filter((b) => b.idPoliclinico === e.idPoliclinico && b.especialidad === e.especialidad)
          .map((b) => ({ ...b, retenido: true })),
      ].filter((b) => b.fecha >= hoy() && this.calzaConPreferencia(e, b));
      salida.push({ ...e, cupos });
    }
    return salida;
  }

  async asignar({ idSolicitud, idBloque, idUsuario }) {
    const e = (await this.catalogo.espera()).find(
      (x) => x.id === Number(idSolicitud),
    );
    if (!e || !ESTADOS_VIGENTES.includes(e.estado))
      throw new Error("ESPERA_NO_ENCONTRADA");
    const compatibles = [
      ...(await this.agendamiento.bloquesDisponibles({
        idPoliclinico: e.idPoliclinico,
        especialidad: e.especialidad,
      })),
      ...(await this.retenidos(e.idPoliclinico)).filter((b) => b.especialidad === e.especialidad),
    ];
    if (
      !compatibles.some(
        (b) => b.id === Number(idBloque) && b.fecha >= hoy() && this.calzaConPreferencia(e, b),
      )
    )
      throw new Error("BLOQUE_NO_DISPONIBLE");
    const retenido = (await this.catalogo.bloque(idBloque))?.retenidoEspera;
    if (retenido) await this.soltar({ idBloque });
    let cita;
    try {
      cita = await this.agendamiento.agendar({
        rut: e.rut,
        idBloque,
        idUsuario,
      });
    } catch (error) {
      if (retenido) {
        const bloque = await this.catalogo.bloque(idBloque);
        await this.cambiarPublicacion(bloque, false);
        (this.meta.bloques[bloque.id] ||= {}).retenidoEspera = true;
      }
      throw error;
    }
    await this.catalogo.actualizarEspera(e.id, "ASIGNADA");
    return cita;
  }

  // Asignación automática (validada con las mandantes el 22/11/2026): la hora que
  // quedó retenida se entrega al primer paciente de la lista que calce con ella.
  // Orden: prioridad (Alta, Media, Normal), luego quien lleva más tiempo esperando.
  // La TENS/TONS puede cambiarlo después a mano (reprogramar, cancelar o asignar).
  // Si nadie calza (por ejemplo, por su preferencia de horario), la hora sigue
  // retenida y se decide a mano, como antes.
  async candidatosPara(bloque) {
    const { especialidad, idPoliclinico } = await this.datosDelBloque(bloque);
    return (await this.catalogo.espera())
      .filter(
        (e) =>
          e.estado === "EN_ESPERA" &&
          e.idPoliclinico === idPoliclinico &&
          e.especialidad === especialidad &&
          this.calzaConPreferencia(e, bloque),
      )
      .sort(
        (a, b) =>
          (ORDEN_PRIORIDAD[this.datosDeSolicitud(a).prioridad] ?? 2) -
            (ORDEN_PRIORIDAD[this.datosDeSolicitud(b).prioridad] ?? 2) ||
          String(a.registradaEn).localeCompare(String(b.registradaEn)) ||
          a.id - b.id,
      );
  }

  async asignarAutomaticamente(idBloque, idUsuarioRespaldo = null) {
    const bloque = await this.catalogo.bloque(idBloque);
    if (!bloque?.retenidoEspera) return null;
    for (const solicitud of await this.candidatosPara(bloque)) {
      try {
        const cita = await this.asignar({
          idSolicitud: solicitud.id,
          idBloque: bloque.id,
          idUsuario: solicitud.registradaPor || idUsuarioRespaldo,
        });
        ((this.meta.espera ||= {})[solicitud.id] ||= {}).estadoOperativo = "Reservado";
        return { cita, solicitud, bloque };
      } catch {
        // Ese paciente no pudo recibir la hora (por ejemplo, ficha inactiva): se prueba con el siguiente.
      }
    }
    return null;
  }

  async retirar(idSolicitud) {
    await this.catalogo.actualizarEspera(idSolicitud, "RETIRADA");
  }
}
module.exports = { EsperaServicio, especialidadTieneLista };

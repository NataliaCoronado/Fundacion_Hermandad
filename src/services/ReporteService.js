"use strict";
const { edad } = require("./PacienteService");
const { hoy, sumarDias } = require("../util/tiempo");

const BOM = "﻿";
const celda = (v) => {
  let t = String(v ?? "");
  if (/^[=+\-@]/.test(t)) t = `'${t}`;
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csv = (filas) =>
  BOM + filas.map((f) => f.map(celda).join(";")).join("\r\n") + "\r\n";

const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const diaSemana = (fecha) => {
  const [a, m, d] = fecha.split("-").map(Number);
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
};
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

class ReporteService {
  constructor({ citaRepo, catalogo, extras, encuestas }) {
    Object.assign(this, { citaRepo, catalogo, extras, encuestas });
  }

  async base(filtro = {}) {
    const [sedesL, profsL, bloquesL, citasL] = await Promise.all([
      this.catalogo.policlinicos(),
      this.catalogo.profesionales(),
      this.catalogo.bloques(),
      this.citaRepo.listar(),
    ]);
    const sedes = new Map(sedesL.map((x) => [x.id, x]));
    const profs = new Map(profsL.map((x) => [x.id, x]));
    const enAlcance = (b) => {
      const p = profs.get(b.idProfesional);
      if (!p) return false;
      if (filtro.desde && b.fecha < filtro.desde) return false;
      if (filtro.hasta && b.fecha > filtro.hasta) return false;
      if (filtro.idProfesional && p.id !== Number(filtro.idProfesional))
        return false;
      if (
        filtro.idPoliclinico &&
        (b.idPoliclinico || p.idPoliclinico) !== Number(filtro.idPoliclinico)
      )
        return false;
      if (
        filtro.especialidad &&
        (b.especialidad || p.especialidad) !== filtro.especialidad
      )
        return false;
      return true;
    };
    const bloques = bloquesL.filter(enAlcance);
    const porId = new Map(bloques.map((b) => [b.id, b]));
    const citas = citasL.filter((c) => porId.has(c.idBloque));
    return {
      sedes,
      profs,
      sedesL,
      profsL,
      bloques,
      porId,
      citas,
      citasTodas: citasL,
    };
  }

  static resumenDe(citas, bloques, enc) {
    const activas = citas.filter((c) => c.estadoReserva === "ACTIVA");
    const asistio = activas.filter((c) => c.asistencia === "ASISTIO").length;
    const noAsistio = activas.filter(
      (c) => c.asistencia === "NO_ASISTIO",
    ).length;
    const publicados = bloques.filter((b) => b.publicado);
    const ocupados = new Set(activas.map((c) => c.idBloque));
    return {
      totalCitas: citas.length,
      activas: activas.length,
      canceladas: citas.length - activas.length,
      confirmadas: activas.filter((c) => c.estadoConfirmacion === "CONFIRMADA")
        .length,
      pendientes: activas.filter((c) => c.estadoConfirmacion !== "CONFIRMADA")
        .length,
      asistio,
      noAsistio,
      tasaInasistencia: pct(noAsistio, asistio + noAsistio),
      tasaCancelacion: pct(citas.length - activas.length, citas.length),
      cupos: publicados.length,
      ocupados: publicados.filter((b) => ocupados.has(b.id)).length,
      ocupacion: pct(
        publicados.filter((b) => ocupados.has(b.id)).length,
        publicados.length,
      ),
      encuestas: enc ? enc.respuestas : 0,
      promedioEncuesta: enc ? enc.promedio : null,
    };
  }

  async resumen(filtro = {}) {
    const b = await this.base(filtro);
    return ReporteService.resumenDe(
      b.citas,
      b.bloques,
      this.encuestas.resumen(),
    );
  }

  async detalle(filtro = {}) {
    const b = await this.base(filtro);
    return b.citas.map((c) => {
      const bl = b.porId.get(c.idBloque);
      const p = bl && b.profs.get(bl.idProfesional);
      return {
        fecha: bl ? bl.fecha : "",
        hora: bl ? bl.hora : "",
        policlinico:
          p && b.sedes.get(p.idPoliclinico)
            ? b.sedes.get(p.idPoliclinico).nombre
            : "",
        especialidad: p ? p.especialidad : "",
        ...c,
      };
    });
  }

  async porPoliclinico(filtro = {}) {
    const b = await this.base(filtro);
    return b.sedesL.map((pol) => {
      const idsProf = new Set(
        b.profsL.filter((p) => p.idPoliclinico === pol.id).map((p) => p.id),
      );
      const bl = b.bloques.filter(
        (x) =>
          (x.idPoliclinico || b.profs.get(x.idProfesional)?.idPoliclinico) ===
          pol.id,
      );
      const ids = new Set(bl.map((x) => x.id));
      const f = b.citas.filter((c) => ids.has(c.idBloque));
      const r = ReporteService.resumenDe(f, bl);
      return {
        id: pol.id,
        policlinico: pol.nombre,
        citas: f.length,
        canceladas: r.canceladas,
        noAsistio: r.noAsistio,
        asistio: r.asistio,
        activas: r.activas,
        cupos: r.cupos,
        ocupacion: r.ocupacion,
        tasaInasistencia: r.tasaInasistencia,
      };
    });
  }

  async caracterizacion(filtro = {}) {
    const b = await this.base(filtro);
    const pacientes = await this.catalogo.pacientes();
    const conCita = new Set(b.citas.map((c) => c.rut));
    const atendidos = new Set(
      b.citas.filter((c) => c.asistencia === "ASISTIO").map((c) => c.rut),
    );
    const base = pacientes.filter((p) => atendidos.has(p.rut));
    const contar = (clave) => {
      const m = new Map();
      for (const p of base) {
        const k = clave(p) || "Sin dato";
        m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m]
        .map(([nombre, n]) => ({ nombre, n }))
        .sort((a, c) => c.n - a.n);
    };
    const TRAMOS = [
      ["0 a 11 años", 0, 11],
      ["12 a 17 años", 12, 17],
      ["18 a 39 años", 18, 39],
      ["40 a 59 años", 40, 59],
      ["60 años o más", 60, 200],
    ];
    const edades = base
      .filter((p) => p.fechaNacimiento)
      .map((p) => edad(p.fechaNacimiento));
    const GENERO = {
      FEMENINO: "Femenino",
      MASCULINO: "Masculino",
      OTRO: "Otro",
      NO_INFORMA: "No informa",
    };
    return {
      registrados: pacientes.length,
      conCita: conCita.size,
      atendidos: atendidos.size,
      adultos: edades.filter((e) => e >= 18).length,
      ninos: edades.filter((e) => e < 18).length,
      mayores: edades.filter((e) => e >= 60).length,
      edadSinDato: base.length - edades.length,
      edades: TRAMOS.map(([nombre, min, max]) => ({
        nombre,
        n: edades.filter((e) => e >= min && e <= max).length,
      })),
      generos: contar((p) => GENERO[p.genero] || p.genero),
      nacionalidades: contar((p) => p.nacionalidad),
    };
  }

  async porProfesional(filtro = {}) {
    const b = await this.base(filtro);
    const deBloque = new Map(b.bloques.map((x) => [x.id, x.idProfesional]));
    return b.profsL
      .filter(
        (p) =>
          (!filtro.idProfesional || p.id === Number(filtro.idProfesional)) &&
          (!filtro.idPoliclinico ||
            (p.lugares || [p.idPoliclinico]).includes(
              Number(filtro.idPoliclinico),
            )) &&
          (!filtro.especialidad || (p.especialidades||[p.especialidad]).includes(filtro.especialidad)),
      )
      .map((p) => {
        const f = b.citas.filter((c) => deBloque.get(c.idBloque) === p.id);
        const activas = f.filter((c) => c.estadoReserva === "ACTIVA");
        const cupos = b.bloques.filter(
          (x) => x.idProfesional === p.id && x.publicado,
        ).length;
        const asistio = activas.filter(
          (c) => c.asistencia === "ASISTIO",
        ).length;
        const noAsistio = activas.filter(
          (c) => c.asistencia === "NO_ASISTIO",
        ).length;
        return {
          id: p.id,
          profesional: p.nombre,
          especialidad: p.especialidad,
          policlinico: b.sedes.get(p.idPoliclinico)?.nombre || "",
          activo: p.activo,
          citas: f.length,
          activas: activas.length,
          canceladas: f.length - activas.length,
          asistio,
          noAsistio,
          cupos,
          ocupacion: cupos ? Math.round((activas.length / cupos) * 100) : null,
        };
      })
      .sort(
        (a, c) =>
          c.citas - a.citas ||
          a.profesional.localeCompare(c.profesional, "es", { numeric: true }),
      );
  }

  async analitica(filtro = {}) {
    const b = await this.base(filtro);
    const enc = this.encuestas.resumen();
    const resumen = ReporteService.resumenDe(b.citas, b.bloques, enc);
    let anterior = null;
    if (filtro.desde && filtro.hasta) {
      const dias =
        Math.round(
          (Date.parse(filtro.hasta) - Date.parse(filtro.desde)) / 86400000,
        ) + 1;
      const ant = await this.base({
        ...filtro,
        desde: sumarDias(filtro.desde, -dias),
        hasta: sumarDias(filtro.desde, -1),
      });
      anterior = ReporteService.resumenDe(ant.citas, ant.bloques);
    }
    const ciudadanos = (c) => b.porId.get(c.idBloque);
    const semanas = new Map();
    for (const c of b.citas) {
      const bl = ciudadanos(c);
      const lunes = sumarDias(bl.fecha, -diaSemana(bl.fecha));
      const w = semanas.get(lunes) || {
        semana: lunes,
        activas: 0,
        asistio: 0,
        noAsistio: 0,
        canceladas: 0,
      };
      if (c.estadoReserva === "ACTIVA") {
        w.activas++;
        if (c.asistencia === "ASISTIO") w.asistio++;
        if (c.asistencia === "NO_ASISTIO") w.noAsistio++;
      } else w.canceladas++;
      semanas.set(lunes, w);
    }
    const semanal = [...semanas.values()]
      .sort((x, y) => x.semana.localeCompare(y.semana))
      .map((w) => ({
        ...w,
        tasaInasistencia: pct(w.noAsistio, w.asistio + w.noAsistio),
      }));
    const porDia = DIAS.map((nombre, i) => ({
      nombre,
      n: b.citas.filter(
        (c) =>
          c.estadoReserva === "ACTIVA" && diaSemana(ciudadanos(c).fecha) === i,
      ).length,
    })).filter((d, i) => i < 5 || d.n > 0);
    const esps = new Map();
    for (const bl of b.bloques) {
      const p = b.profs.get(bl.idProfesional);
      const esp=bl.especialidad||p.especialidad;
      const e = esps.get(esp) || {
        nombre: esp,
        cupos: 0,
        citas: [],
      };
      if (bl.publicado) e.cupos++;
      esps.set(esp, e);
    }
    for (const c of b.citas) {
      const p = b.profs.get(ciudadanos(c).idProfesional);
      if (c.estadoReserva === "ACTIVA") esps.get(ciudadanos(c).especialidad||p.especialidad).citas.push(c);
    }
    const porEspecialidad = [...esps.values()]
      .map((e) => ({
        nombre: e.nombre,
        citas: e.citas.length,
        cupos: e.cupos,
        ocupacion: pct(e.citas.length, e.cupos),
        noAsistio: e.citas.filter((c) => c.asistencia === "NO_ASISTIO").length,
        tasaInasistencia: pct(
          e.citas.filter((c) => c.asistencia === "NO_ASISTIO").length,
          e.citas.filter((c) => c.asistencia).length,
        ),
      }))
      .sort((x, y) => y.citas - x.citas);
    return {
      resumen,
      anterior,
      semanal,
      porDia,
      porEspecialidad,
      porPoliclinico: await this.porPoliclinico(filtro),
      caracterizacion: await this.caracterizacion(filtro),
      porProfesional: await this.porProfesional(filtro),
      encuestasPorTipo: this.encuestasPorTipo(b.citas),
    };
  }

  encuestasPorTipo(citas) {
    const ids = new Set(citas.map((c) => c.id));
    const resumir = (lista) => {
      const l = (lista || []).filter((e) => ids.has(e.idCita));
      const suma = l.reduce((s, e) => s + e.nota, 0);
      return {
        respuestas: l.length,
        promedio: l.length ? Math.round((suma / l.length) * 10) / 10 : null,
        notas: [5, 4, 3, 2, 1].map((nota) => ({ nota, n: l.filter((e) => e.nota === nota).length })),
      };
    };
    return { agendamiento: resumir(this.extras.listar("encuestasAgendamiento")), atencion: resumir(this.extras.listar("encuestas")) };
  }

  async operacion() {
    const hoyTxt = hoy();
    const hasta = sumarDias(hoyTxt, 13);
    const b = await this.base({ desde: hoyTxt, hasta });
    const activas = b.citas.filter((c) => c.estadoReserva === "ACTIVA");
    const reservados = new Set(activas.map((c) => c.idBloque));
    const dias = [];
    for (let i = 0; i < 14; i++) {
      const f = sumarDias(hoyTxt, i);
      const delDia = b.bloques.filter((x) => x.fecha === f);
      dias.push({
        fecha: f,
        reservados: delDia.filter((x) => reservados.has(x.id)).length,
        libres: delDia.filter((x) => x.publicado && !reservados.has(x.id))
          .length,
        sinPublicar: delDia.filter((x) => !x.publicado && !reservados.has(x.id))
          .length,
      });
    }
    const sinConfirmar = activas.filter(
      (c) =>
        c.estadoConfirmacion !== "CONFIRMADA" &&
        b.porId.get(c.idBloque).fecha <= sumarDias(hoyTxt, 2),
    ).length;
    const sinRespuesta = activas.filter(
      (c) => c.estadoConfirmacion === "SIN_RESPUESTA",
    ).length;
    const libresPorProf = new Map();
    for (const x of b.bloques)
      if (x.publicado && !reservados.has(x.id))
        libresPorProf.set(
          x.idProfesional,
          (libresPorProf.get(x.idProfesional) || 0) + 1,
        );
    const sinCupos = b.profsL
      .filter((p) => p.activo && !libresPorProf.has(p.id))
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        especialidad: p.especialidad,
        policlinico: b.sedes.get(p.idPoliclinico)?.nombre || "",
      }));
    const bajaOcupacion = (
      await this.porPoliclinico({ desde: hoyTxt, hasta })
    ).filter((x) => x.cupos >= 8 && x.ocupacion !== null && x.ocupacion < 40);
    const cuposTotal = dias.reduce((s, d) => s + d.reservados + d.libres, 0);
    return {
      dias,
      sinConfirmar,
      sinRespuesta,
      sinCupos,
      bajaOcupacion,
      reservados: dias.reduce((s, d) => s + d.reservados, 0),
      libres: dias.reduce((s, d) => s + d.libres, 0),
      sinPublicar: dias.reduce((s, d) => s + d.sinPublicar, 0),
      cuposTotal,
    };
  }

  async csvProfesionales(filtro = {}) {
    return csv([
      [
        "Profesional",
        "Especialidad",
        "Policlínico",
        "Citas",
        "Activas",
        "Canceladas",
        "Asistieron",
        "No asistieron",
        "Cupos publicados",
        "Ocupación (%)",
      ],
      ...(await this.porProfesional(filtro)).map((x) => [
        x.profesional,
        x.especialidad,
        x.policlinico,
        x.citas,
        x.activas,
        x.canceladas,
        x.asistio,
        x.noAsistio,
        x.cupos,
        x.ocupacion ?? "",
      ]),
    ]);
  }

  async csvDetalle(filtro = {}) {
    const filas = await this.detalle(filtro);
    return csv([
      [
        "Fecha",
        "Hora",
        "Policlínico",
        "Especialidad",
        "Reserva",
        "Confirmación",
        "Asistencia",
        "Origen cancelación",
      ],
      ...filas.map((f) => [
        f.fecha,
        f.hora,
        f.policlinico,
        f.especialidad,
        f.estadoReserva,
        f.estadoConfirmacion,
        f.asistencia || "",
        f.origenCancelacion || "",
      ]),
    ]);
  }
  async csvResumen(filtro = {}) {
    const r = await this.resumen(filtro);
    const pp = await this.porPoliclinico(filtro);
    const k = await this.caracterizacion(filtro);
    return csv([
      ["Indicador", "Valor"],
      ["Citas registradas", r.totalCitas],
      ["Citas activas", r.activas],
      ["Canceladas", r.canceladas],
      ["Confirmadas", r.confirmadas],
      ["Sin confirmar", r.pendientes],
      ["Asistieron", r.asistio],
      ["No asistieron", r.noAsistio],
      ["Tasa de inasistencia (%)", r.tasaInasistencia ?? ""],
      ["Ocupación de cupos publicados (%)", r.ocupacion ?? ""],
      ["Encuestas respondidas", r.encuestas],
      ["Promedio encuesta (1 a 5)", r.promedioEncuesta ?? ""],
      [],
      ["Policlínico", "Citas", "Canceladas", "No asistieron"],
      ...pp.map((x) => [x.policlinico, x.citas, x.canceladas, x.noAsistio]),
      [],
      ["Caracterización de pacientes con citas", "Cantidad"],
      ["Pacientes registrados", k.registrados],
      ["Pacientes con citas", k.conCita],
      ["Pacientes atendidos", k.atendidos],
      ["Adultos (18 o más)", k.adultos],
      ["Niños y adolescentes (menores de 18)", k.ninos],
      ["Adultos mayores (60 o más)", k.mayores],
      ...k.edades.map((x) => [`Edad: ${x.nombre}`, x.n]),
      ...k.generos.map((x) => [`Sexo: ${x.nombre}`, x.n]),
      ...k.nacionalidades.map((x) => [`Nacionalidad: ${x.nombre}`, x.n]),
    ]);
  }
}
module.exports = { ReporteService, DIAS };

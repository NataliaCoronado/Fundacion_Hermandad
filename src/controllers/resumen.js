"use strict";
const { fechaValida } = require("../services/OperacionService");
const { sumarDias } = require("../util/tiempo");
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

const DIA = 86_400_000;
const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const fechaEn = (inicio, dias) => new Date(inicio + dias * DIA).toISOString().slice(0, 10);

function indicadoresResumen({ consulta, fecha, bloques, citas, sedes, sedeDe, idPoliclinico, profesionales = [] }) {
  let desde = consulta.get("desde");
  let hasta = consulta.get("hasta");
  if (!fechaValida(desde) || !fechaValida(hasta)) {
    desde = sumarDias(fecha, -29);
    hasta = fecha;
  }
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  const sede = idPoliclinico ?? sedes.find((s) => String(s.id) === consulta.get("sede"))?.id;
  const disponibles = profesionales.filter((p) => sede == null || p.sedes?.includes(sede));
  const profesional = disponibles.find((p) => String(p.id) === consulta.get("prof"))?.id;
  const dias = (Date.parse(hasta) - Date.parse(desde)) / DIA + 1;
  const paso = dias <= 12 ? 1 : Math.ceil(dias / 84) * 7;

  // Agrupa en periodos la ventana [inicioTxt, inicioTxt + dias) con los mismos filtros.
  const ventana = (inicioTxt, conCalor = false) => {
    const inicio = Date.parse(inicioTxt);
    const fin = fechaEn(inicio, dias - 1);
    const index = (f) => Math.floor((Date.parse(f) - inicio) / (DIA * paso));
    const periodos = Array.from({ length: Math.ceil(dias / paso) }, (_, i) => ({
      desde: fechaEn(inicio, i * paso),
      hasta: fechaEn(inicio, Math.min(dias, (i + 1) * paso) - 1),
      publicados: 0, ocupados: 0, vigentes: 0, canceladas: 0, confirmadas: 0, sinConfirmar: 0, asistio: 0, noAsistio: 0,
    }));
    const incluir = (b) => b.fecha >= inicioTxt && b.fecha <= fin && (sede == null || sedeDe(b) === sede) && (profesional == null || b.idProfesional === profesional);
    const ocupados = new Set();
    const calor = new Map();
    for (const { x, b } of citas) {
      if (!incluir(b)) continue;
      if (conCalor && x.estadoReserva === "ACTIVA") {
        const k = `${(new Date(b.fecha).getUTCDay() + 6) % 7}|${b.hora.slice(0, 2)}`;
        calor.set(k, (calor.get(k) || 0) + 1);
      }
      const periodo = periodos[index(b.fecha)];
      if (x.estadoReserva !== "ACTIVA") {
        periodo.canceladas++;
        continue;
      }
      ocupados.add(b.id);
      periodo.vigentes++;
      if (x.estadoConfirmacion === "CONFIRMADA") periodo.confirmadas++;
      else periodo.sinConfirmar++;
      if (x.asistencia === "ASISTIO") periodo.asistio++;
      if (x.asistencia === "NO_ASISTIO") periodo.noAsistio++;
    }
    for (const b of bloques.values()) {
      if (!b.publicado || !incluir(b)) continue;
      const periodo = periodos[index(b.fecha)];
      periodo.publicados++;
      if (ocupados.has(b.id)) periodo.ocupados++;
    }
    const total = (clave) => periodos.reduce((suma, p) => suma + p[clave], 0);
    const asistencias = total("asistio") + total("noAsistio");
    return {
      periodos: periodos.map((p) => ({ ...p, ocupacion: pct(p.ocupados, p.publicados), inasistencia: pct(p.noAsistio, p.asistio + p.noAsistio), confirmacion: pct(p.confirmadas, p.vigentes) })),
      ocupacion: { total: pct(total("ocupados"), total("publicados")), ocupados: total("ocupados"), publicados: total("publicados") },
      reservas: total("vigentes") + total("canceladas"),
      inasistencia: { total: pct(total("noAsistio"), asistencias), ausencias: total("noAsistio"), asistencias },
      confirmadas: total("confirmadas"),
      vigentes: total("vigentes"),
      canceladas: total("canceladas"),
      confirmacion: pct(total("confirmadas"), total("vigentes")),
      cancelacion: pct(total("canceladas"), total("vigentes") + total("canceladas")),
      calor,
    };
  };

  const { calor: celdas, ...actual } = ventana(desde, true);
  // Período anterior de igual duración, para comparar sin inventar datos.
  const { calor: _, ...anterior } = ventana(sumarDias(desde, -dias));
  const horas = [...new Set([...celdas.keys()].map((k) => k.split("|")[1]))].sort();
  const diasUsados = DIAS_SEMANA.filter((_, i) => i < 5 || horas.some((h) => celdas.has(`${i}|${h}`)));
  const calor = {
    x: horas.map((h) => `${h}:00`),
    y: diasUsados,
    datos: diasUsados.flatMap((_, j) => horas.map((h, i) => [i, j, celdas.get(`${j}|${h}`) || 0])),
  };
  return { desde, hasta, sede, sedes, profesional, profesionales: disponibles, ...actual, anterior, dias, calor };
}

module.exports = { indicadoresResumen, pct };

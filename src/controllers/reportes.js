"use strict";
const V = require("../views/operacion"),
  { esc, tabla } = require("../views/util");
const { hoy, sumarDias, lunesDe } = require("../util/tiempo");
const { fechaValida } = require("../services/OperacionService");
const Exportar = require("../services/ExportacionService");
function crearReportesController(c) {
  // Panel "Actividad de agenda": reservas reales del período, sin datos de pacientes.
  const ESTADO = (x) =>
    x.estadoReserva !== "ACTIVA" ? "CAN" : x.asistencia === "ASISTIO" ? "ATE" : x.asistencia === "NO_ASISTIO" ? "NOA" : x.estadoConfirmacion === "CONFIRMADA" ? "CON" : "PEN";
  async function agenda(filtro) {
    const b = await c.reportes.base(filtro);
    const sedeDe = (bl) => bl.idPoliclinico || b.profs.get(bl.idProfesional)?.idPoliclinico;
    const espDe = (bl) => bl.especialidad || b.profs.get(bl.idProfesional)?.especialidad || "Sin especialidad";
    const reservas = b.citas.map((x) => {
      const bl = b.porId.get(x.idBloque);
      return [bl.fecha, bl.hora, sedeDe(bl), espDe(bl), x.idProfesionalReemplazo || bl.idProfesional, ESTADO(x)];
    });
    const ocupados = new Set(b.citas.filter((x) => x.estadoReserva === "ACTIVA").map((x) => x.idBloque));
    const cupos = new Map();
    for (const bl of b.bloques.filter((x) => x.publicado)) {
      const k = `${sedeDe(bl)}|${espDe(bl)}`, v = cupos.get(k) || [sedeDe(bl), espDe(bl), 0, 0];
      v[2]++; if (ocupados.has(bl.id)) v[3]++; cupos.set(k, v);
    }
    // Período anterior de igual largo, solo como conteo por fecha para comparar.
    const dias = Math.round((Date.parse(filtro.hasta) - Date.parse(filtro.desde)) / 864e5) + 1;
    const prevHasta = sumarDias(filtro.desde, -1), prevDesde = sumarDias(filtro.desde, -dias);
    const p = await c.reportes.base({ ...filtro, desde: prevDesde, hasta: prevHasta });
    const previo = {};
    for (const x of p.citas) { const f = p.porId.get(x.idBloque).fecha; previo[f] = (previo[f] || 0) + 1; }
    return {
      desde: filtro.desde, hasta: filtro.hasta, prevDesde, prevHasta, sede: filtro.idPoliclinico ? +filtro.idPoliclinico : null,
      sedes: Object.fromEntries(b.sedesL.map((x) => [x.id, x.nombre])),
      profs: Object.fromEntries(b.profsL.map((x) => [x.id, x.nombre])),
      reservas, cupos: [...cupos.values()], previo, generado: new Date().toISOString(),
    };
  }
  async function datos(q, soloFiltro = false) {
    const h = hoy(),
      periodo = q.get("periodo") || "mes";
    let desde = q.get("desde"),
      hasta = q.get("hasta");
    if (!fechaValida(desde) || !fechaValida(hasta)) {
      hasta = h;
      desde =
        periodo === "dia"
          ? h
          : periodo === "semana"
            ? lunesDe(h)
            : periodo === "semestre"
              ? h.slice(0, 4) +
                (Number(h.slice(5, 7)) <= 6 ? "-01-01" : "-07-01")
              : periodo === "anio"
                ? h.slice(0, 4) + "-01-01"
                : h.slice(0, 7) + "-01";
    }
    if (desde > hasta) [desde, hasta] = [hasta, desde];
    const filtro = {
        desde,
        hasta,
        idPoliclinico: q.get("sede") || undefined,
        especialidad: q.get("esp") || undefined,
        idProfesional: q.get("prof") || undefined,
      };
    if (soloFiltro) return { filtro, periodo };
    const a = await c.reportes.analitica(filtro),
      ctx = await require("./contexto").cargarContexto(c.catalogo),
      espera = (await c.espera.vigentes()).filter(
        (e) =>
          (!filtro.idPoliclinico ||
            e.idPoliclinico === +filtro.idPoliclinico) &&
          (!filtro.especialidad || e.especialidad === filtro.especialidad) &&
          (!filtro.idProfesional ||
            e.cupos.some((b) => b.idProfesional === +filtro.idProfesional)),
      );
    const g = [
      {
        id: "sexo",
        titulo: "Sexo registrado · pacientes únicos atendidos",
        seccion: 1,
        siluetas: true,
        filas: a.caracterizacion.generos,
      },
      {
        id: "edad",
        titulo: "Edad · pacientes únicos atendidos",
        seccion: 1,
        filas: a.caracterizacion.edades,
      },
      {
        id: "nacionalidad",
        titulo: "Nacionalidad · pacientes únicos atendidos",
        seccion: 1,
        filas: a.caracterizacion.nacionalidades,
      },
      {
        id: "adultos",
        titulo: "Adultos, niños y datos sin registrar",
        seccion: 1,
        filas: [
          { nombre: "Adultos", n: a.caracterizacion.adultos },
          { nombre: "Niños y adolescentes", n: a.caracterizacion.ninos },
          {
            nombre: "Edad sin registrar",
            n: a.caracterizacion.edadSinDato || 0,
          },
        ],
      },
      {
        id: "demanda",
        titulo: "Demanda por profesional · reservas",
        seccion: 2,
        filas: a.porProfesional.map((x) => ({
          nombre: x.profesional,
          n: x.citas,
        })),
      },
      {
        id: "ocupacion",
        titulo: "Ocupación por profesional (%)",
        seccion: 2,
        filas: a.porProfesional.map((x) => ({
          nombre: x.profesional,
          n: x.ocupacion || 0,
        })),
      },
      {
        id: "espera",
        titulo: "Lista de espera vigente por especialidad",
        seccion: 2,
        filas: [...new Set(espera.map((e) => e.especialidad))].map(
          (nombre) => ({
            nombre,
            n: espera.filter((e) => e.especialidad === nombre).length,
          }),
        ),
      },
      {
        id: "especialidad",
        titulo: "Demanda por especialidad · reservas",
        seccion: 2,
        filas: a.porEspecialidad.map((x) => ({ nombre: x.nombre, n: x.citas })),
      },
      {
        id: "atencion",
        titulo: "Estadísticas de atención",
        seccion: 3,
        filas: [
          { nombre: "Atenciones realizadas", n: a.resumen.asistio },
          { nombre: "Ausencias registradas", n: a.resumen.noAsistio },
          {
            nombre: "Sin registro / atención pendiente",
            n: a.resumen.activas - a.resumen.asistio - a.resumen.noAsistio,
          },
          { nombre: "Canceladas", n: a.resumen.canceladas },
        ],
      },
      {
        id: "evolucion",
        titulo: "Evolución semanal · consultas",
        seccion: 3,
        filas: a.semanal.map((x) => ({ nombre: x.semana, n: x.activas })),
      },
      {
        id: "lugares",
        titulo: "Atenciones por policlínico y Telemedicina",
        seccion: 3,
        filas: a.porPoliclinico.map((x) => ({
          nombre: x.policlinico,
          n: x.asistio,
        })),
      },
      {
        id: "perdida",
        titulo: "Pérdida por lugar (%) · ausencias / asistencia registrada",
        seccion: 3,
        filas: a.porPoliclinico.map((x) => ({
          nombre: x.policlinico,
          n: x.tasaInasistencia || 0,
        })),
      },
    ];
    const contexto = `${desde} a ${hasta} · Lugar: ${ctx.sedes.get(+filtro.idPoliclinico)?.nombre || "Toda la red"} · Especialidad: ${filtro.especialidad || "Todas"} · Profesional: ${ctx.profs.get(+filtro.idProfesional)?.nombre || "Todos"}`;
    return { filtro, periodo, a, ctx, g, contexto };
  }
  const svg = (g) => {
    const rows = g.filas,
      max = Math.max(1, ...rows.map((x) => x.n)),
      h = Math.max(190, rows.length * 30 + 30);
    if (g.siluetas) {
      const total = rows.reduce((s, x) => s + x.n, 0);
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 270" role="img" aria-label="${esc(g.titulo)}">${rows
        .map((x, i) => {
          const w = 560 / Math.max(1, rows.length),
            cx = w * i + w / 2;
          return `<g class="chart-bar" tabindex="0" data-category="${esc(x.nombre)}: ${x.n} pacientes" transform="translate(${cx - 35},20)"><title>${esc(x.nombre)}: ${x.n} pacientes únicos atendidos</title><circle cx="35" cy="24" r="20" fill="${i === 0 ? "#4f9ea6" : i === 1 ? "#7996c5" : "#bdcbd3"}"/><path d="M14 54 Q35 45 56 54 L65 124 L49 124 L47 195 L34 195 L33 132 L29 195 L16 195 L20 124 L5 124 Z" fill="${i === 0 ? "#4f9ea6" : i === 1 ? "#7996c5" : "#bdcbd3"}"/><text x="35" y="220" text-anchor="middle" font-size="12" fill="#234959">${esc(x.nombre)}</text><text x="35" y="243" text-anchor="middle" font-size="15" font-weight="600" fill="#234959">${x.n} · ${total ? Math.round((x.n / total) * 100) : 0}%</text></g>`;
        })
        .join(
          "",
        )}${!rows.length ? '<text x="280" y="130" text-anchor="middle" font-size="13" fill="#728994">Sin pacientes atendidos en este período</text>' : ""}</svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${h}" role="img" aria-label="${esc(g.titulo)}">${rows.map((x, i) => `<g class="chart-bar" tabindex="0" data-category="${esc(x.nombre)}: ${x.n}"><title>${esc(x.nombre)}: ${x.n}</title><text x="5" y="${i * 30 + 24}" font-size="11" fill="#5b7480">${esc(x.nombre.slice(0, 31))}</text><rect x="235" y="${i * 30 + 11}" width="${(x.n / max) * 330}" height="17" rx="3" fill="${["#368e99", "#6b8fb9", "#9a9abb", "#7ba891"][i % 4]}"/><text x="${240 + (x.n / max) * 330}" y="${i * 30 + 24}" font-size="11" fill="#285162">${x.n}</text></g>`).join("")}${!rows.length ? '<text x="320" y="95" text-anchor="middle" font-size="13" fill="#728994">Sin datos para el período</text>' : ""}</svg>`;
  };
  return {
    agendaJson: async ({ consulta: q }) => {
      const { filtro } = await datos(q, true);
      return { binario: Buffer.from(JSON.stringify(await agenda(filtro))), mime: "application/json; charset=utf-8", nombreArchivo: "agenda.json", enLinea: true };
    },
    ver: async ({ usuario: u, consulta: q }) => {
      const d = await datos(q),
        { filtro: f, a, ctx, g, contexto, periodo } = d;
      const qs = new URLSearchParams({
        desde: f.desde,
        hasta: f.hasta,
        sede: f.idPoliclinico || "",
        esp: f.especialidad || "",
        prof: f.idProfesional || "",
      });
      const enlace = (id, formato) =>
        "/admin/reportes/exportar?" +
        new URLSearchParams({
          ...Object.fromEntries(qs),
          grafico: id,
          formato,
        });
      const chart = (x) =>
        `<section class="work-panel" data-chart="${x.id}" data-context="${esc(contexto)}"><div class="chart-heading"><h3>${esc(x.titulo)}</h3></div>${svg(x)}<div class="chart-detail" aria-live="polite">Selecciona una categoría para consultar su valor.</div><details><summary>Ver datos del gráfico</summary>${tabla(
          ["Categoría", "Valor"],
          x.filas.map((r) => [r.nombre, r.n]),
        )}</details><div class="chart-actions">${V.btn("PDF", enlace(x.id, "pdf"), true)}${V.btn("Excel", enlace(x.id, "xlsx"), true)}${V.btn("PNG", enlace(x.id,"png"), true)}</div></section>`;
      return {
        html: V.page(
          u,
          "Reportes",
          V.cab(
            "Reportes institucionales",
            "Indicadores agregados de la red y de sus lugares de atención.",
            V.btn("Reporte completo PDF", enlace("todos", "pdf"), true) +
              V.btn("Reporte completo Excel", enlace("todos", "xlsx")),
          ) +
            `<form class="filters">${V.select("sede", "Lugar", [{ id: "", nombre: "Toda la red" }, ...ctx.listaSedes], f.idPoliclinico || "")}${V.select("esp", "Especialidad", [{ id: "", nombre: "Todas" }, ...V.opcionesTexto(await c.catalogo.especialidades())], f.especialidad || "")}${V.select("prof", "Profesional", [{ id: "", nombre: "Todos" }, ...ctx.listaProfs], f.idProfesional || "")}${V.select(
              "periodo",
              "Período",
              [
                { id: "dia", nombre: "Día" },
                { id: "semana", nombre: "Semana" },
                { id: "mes", nombre: "Mes" },
                { id: "semestre", nombre: "Semestre" },
                { id: "anio", nombre: "Año" },
                { id: "rango", nombre: "Rango personalizado" },
              ],
              periodo,
              (x) => x.id,
              (x) => x.nombre,
            )}${V.input("desde", "Desde", f.desde, "date")}${V.input("hasta", "Hasta", f.hasta, "date")}<button type="submit">Aplicar filtros</button></form><p class="report-note">${esc(contexto)}<br>Pérdida = ausencias registradas ÷ (atenciones realizadas + ausencias registradas) × 100. Los registros incompletos se muestran separados.</p><div class="metric-strip"><div><b>${a.caracterizacion.atendidos}</b>Pacientes únicos atendidos</div><div><b>${a.resumen.asistio}</b>Consultas realizadas</div><div><b>${a.resumen.ocupacion ?? "—"}%</b>Ocupación de cupos publicados</div><div><b>${a.resumen.tasaInasistencia ?? "—"}%</b>Pérdida de horas</div></div>${require("../views/panelAgenda").panel(await agenda(f), qs.toString())}<details class="inst"><summary>Indicadores institucionales: caracterización, demanda y atención</summary>${[
              [1, "Caracterización de pacientes"],
              [2, "Demanda por profesional"],
              [3, "Estadísticas de atención"],
            ]
              .map(
                ([n, t]) =>
                  `<h2 class="report-section">${t}</h2><div class="chart-grid">${g
                    .filter((x) => x.seccion === n)
                    .map(chart)
                    .join("")}</div>`,
              )
              .join(
                "",
              )}</details><p class="report-note">La lista de espera muestra el estado vigente al momento de la consulta. ${V.btn("Supervisar lista de espera", "/admin/espera", true)}</p>`,
        ),
      };
    },
    exportar: async ({ usuario: u, consulta: q }) => {
      const d = await datos(q),
        g =
          q.get("grafico") === "todos"
            ? d.g
            : d.g.filter((x) => x.id === q.get("grafico"));
      if (!g.length)
        return {
          estado: 400,
          html: V.errorPage(
            u,
            new Error("Gráfico no encontrado."),
            "/admin/reportes",
          ),
        };
      const formato = q.get("formato");
      if(formato==="png"&&g.length!==1) return {estado:400,html:"Selecciona un gráfico individual para PNG."};
      if (!["pdf", "xlsx", "png"].includes(formato))
        return { estado: 400, html: "Formato inválido" };
      c.operacion.aud(
        u,
        "Reporte descargado",
        "Reportes",
        q.get("grafico"),
        null,
        { periodo: d.filtro, formato },
      );
      return {
        binario:
          formato === "pdf"
            ? Exportar.pdf(g, d.contexto)
            : formato === "png" ? Exportar.png(svg(g[0]),g[0].titulo,d.contexto) : Exportar.excel(g, d.contexto),
        mime:
          formato === "pdf"
            ? "application/pdf"
            : formato === "png" ? "image/png" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        nombreArchivo: `reporte-${q.get("grafico")}.${formato}`,
      };
    },
  };
}
module.exports = { crearReportesController };

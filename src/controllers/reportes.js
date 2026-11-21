"use strict";
const vistas = require("../views/operacion"),
  { esc, tabla } = require("../views/componentesComunes");
const { hoy, sumarDias, lunesDe } = require("../herramientas/tiempo");
const { fechaValida } = require("../services/OperacionServicio");
const Exportar = require("../services/ExportacionServicio");
const graficos = require("../views/graficos");
function crearControladorReportes(aplicacion) {
  const ESTADO = (x) =>
    x.estadoReserva !== "ACTIVA" ? "CAN" : x.asistencia === "ASISTIO" ? "ATE" : x.asistencia === "NO_ASISTIO" ? "NOA" : x.estadoConfirmacion === "CONFIRMADA" ? "CON" : "PEN";
  async function agenda(filtro) {
    const datosBase = await aplicacion.reportes.base(filtro);
    const sedeDe = (bl) => bl.idPoliclinico || datosBase.profs.get(bl.idProfesional)?.idPoliclinico;
    const espDe = (bl) => bl.especialidad || datosBase.profs.get(bl.idProfesional)?.especialidad || "Sin especialidad";
    const reservas = datosBase.citas.map((x) => {
      const bloque = datosBase.porId.get(x.idBloque);
      return [bloque.fecha, bloque.hora, sedeDe(bloque), espDe(bloque), x.idProfesionalReemplazo || bloque.idProfesional, ESTADO(x)];
    });
    const ocupados = new Set(datosBase.citas.filter((x) => x.estadoReserva === "ACTIVA").map((x) => x.idBloque));
    const cupos = new Map();
    for (const bl of datosBase.bloques.filter((x) => x.publicado)) {
      const claveSedeEspecialidad = `${sedeDe(bl)}|${espDe(bl)}`, v = cupos.get(claveSedeEspecialidad) || [sedeDe(bl), espDe(bl), 0, 0];
      v[2]++; if (ocupados.has(bl.id)) v[3]++; cupos.set(claveSedeEspecialidad, v);
    }
    const dias = Math.round((Date.parse(filtro.hasta) - Date.parse(filtro.desde)) / 864e5) + 1;
    const prevHasta = sumarDias(filtro.desde, -1), prevDesde = sumarDias(filtro.desde, -dias);
    const p = await aplicacion.reportes.base({ ...filtro, desde: prevDesde, hasta: prevHasta });
    const previo = {};
    for (const x of p.citas) { const f = p.porId.get(x.idBloque).fecha; previo[f] = (previo[f] || 0) + 1; }
    return {
      desde: filtro.desde, hasta: filtro.hasta, prevDesde, prevHasta, sede: filtro.idPoliclinico ? +filtro.idPoliclinico : null,
      sedes: Object.fromEntries(datosBase.sedesL.map((x) => [x.id, x.nombre])),
      profs: Object.fromEntries(datosBase.profsL.map((x) => [x.id, x.nombre])),
      reservas, cupos: [...cupos.values()], previo, generado: new Date().toISOString(),
    };
  }
  async function datos(consulta, soloFiltro = false) {
    const hoyTexto = hoy(),
      periodo = consulta.get("periodo") || "mes";
    let desde = consulta.get("desde"),
      hasta = consulta.get("hasta");
    if (!fechaValida(desde) || !fechaValida(hasta)) {
      hasta = hoyTexto;
      desde =
        periodo === "dia"
          ? hoyTexto
          : periodo === "semana"
            ? lunesDe(hoyTexto)
            : periodo === "semestre"
              ? hoyTexto.slice(0, 4) +
                (Number(hoyTexto.slice(5, 7)) <= 6 ? "-01-01" : "-07-01")
              : periodo === "anio"
                ? hoyTexto.slice(0, 4) + "-01-01"
                : hoyTexto.slice(0, 7) + "-01";
    }
    if (desde > hasta) [desde, hasta] = [hasta, desde];
    const filtro = {
        desde,
        hasta,
        idPoliclinico: consulta.get("sede") || undefined,
        especialidad: consulta.get("esp") || undefined,
        idProfesional: consulta.get("prof") || undefined,
      };
    if (soloFiltro) return { filtro, periodo };
    const analitica = await aplicacion.reportes.analitica(filtro),
      ctx = await require("./cargarListasBase").cargarContexto(aplicacion.catalogo),
      espera = (await aplicacion.espera.vigentes()).filter(
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
        filas: analitica.caracterizacion.generos,
      },
      {
        id: "edad",
        titulo: "Edad · pacientes únicos atendidos",
        seccion: 1,
        filas: analitica.caracterizacion.edades,
      },
      {
        id: "nacionalidad",
        titulo: "Nacionalidad · pacientes únicos atendidos",
        seccion: 1,
        filas: analitica.caracterizacion.nacionalidades,
      },
      {
        id: "adultos",
        titulo: "Adultos, niños y datos sin registrar",
        seccion: 1,
        filas: [
          { nombre: "Adultos", n: analitica.caracterizacion.adultos },
          { nombre: "Niños y adolescentes", n: analitica.caracterizacion.ninos },
          {
            nombre: "Edad sin registrar",
            n: analitica.caracterizacion.edadSinDato || 0,
          },
        ],
      },
      {
        id: "demanda",
        titulo: "Demanda por profesional · reservas",
        seccion: 2,
        filas: analitica.porProfesional.map((x) => ({
          nombre: x.profesional,
          n: x.citas,
        })),
      },
      {
        id: "ocupacion",
        titulo: "Ocupación por profesional (%)",
        seccion: 2,
        filas: analitica.porProfesional.map((x) => ({
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
        filas: analitica.porEspecialidad.map((x) => ({ nombre: x.nombre, n: x.citas })),
      },
      {
        id: "atencion",
        titulo: "Estadísticas de atención",
        seccion: 3,
        filas: [
          { nombre: "Atenciones realizadas", n: analitica.resumen.asistio },
          { nombre: "Ausencias registradas", n: analitica.resumen.noAsistio },
          {
            nombre: "Sin registro / atención pendiente",
            n: analitica.resumen.activas - analitica.resumen.asistio - analitica.resumen.noAsistio,
          },
          { nombre: "Canceladas", n: analitica.resumen.canceladas },
        ],
      },
      {
        id: "evolucion",
        titulo: "Evolución semanal · citas activas",
        seccion: 3,
        filas: analitica.semanal.map((x) => ({ nombre: x.semana, n: x.activas })),
      },
      {
        id: "lugares",
        titulo: "Atenciones por policlínico y Telemedicina",
        seccion: 3,
        filas: analitica.porPoliclinico.map((x) => ({
          nombre: x.policlinico,
          n: x.asistio,
        })),
      },
      {
        id: "perdida",
        titulo: "Pérdida por lugar (%) · ausencias / asistencia registrada",
        seccion: 3,
        filas: analitica.porPoliclinico.map((x) => ({
          nombre: x.policlinico,
          n: x.tasaInasistencia || 0,
        })),
      },
      ...[
        ["encuesta-agendamiento", "Encuesta de agendamiento · cómo fue reservar", analitica.encuestasPorTipo.agendamiento, ["muy fácil", "muy difícil"]],
        ["encuesta-atencion", "Encuesta de atención · después de la consulta", analitica.encuestasPorTipo.atencion, ["muy buena", "mala"]],
      ].map(([id, nombre, e, [alta, baja]]) => ({
        id,
        titulo: `${nombre} · ${e.respuestas ? `${e.respuestas} respuesta(s), promedio ${String(e.promedio).replace(".", ",")} de 5` : "sin respuestas en el período"}`,
        seccion: 4,
        filas: e.notas.map((x) => ({ nombre: `Nota ${x.nota}${x.nota === 5 ? ` (${alta})` : x.nota === 1 ? ` (${baja})` : ""}`, n: x.n })),
      })),
    ];
    const META = {
      sexo: { titulo: "Pacientes atendidos según sexo", desc: "Cada figura es un grupo. El número es la cantidad de pacientes distintos atendidos y el porcentaje, su parte del total." },
      edad: { titulo: "Pacientes atendidos por tramo de edad", desc: "Cada barra es un tramo de edad. Mientras más larga, más pacientes distintos de esa edad se atendieron." },
      nacionalidad: { titulo: "Pacientes atendidos por nacionalidad", desc: "Cada barra es una nacionalidad. Mientras más larga, más pacientes distintos atendidos." },
      adultos: { titulo: "Adultos y niños", desc: "Compara adultos con niños y adolescentes. «Edad sin registrar» son fichas de pacientes a las que les falta la fecha de nacimiento." },
      demanda: { titulo: "Profesionales con más reservas", desc: "Cada barra es un profesional y su largo, las reservas que tuvo en el período. Aquí se ven los 10 con más reservas; «Ver datos» y las descargas incluyen a todos los profesionales.", ordenar: true, topPantalla: 10 },
      ocupacion: { titulo: "Ocupación de los profesionales (%)", desc: "De los cupos publicados, qué porcentaje se reservó. 100 % es agenda llena; un valor bajo significa horas sin usar. Aquí se ven los 10 con mayor ocupación; «Ver datos» y las descargas incluyen a todos los profesionales.", ordenar: true, topPantalla: 10, sufijo: " %", max: 100 },
      espera: { titulo: "Pacientes en lista de espera", desc: "Cantidad de pacientes esperando una hora hoy, por especialidad. No depende del período elegido arriba.", ordenar: true },
      especialidad: { titulo: "Reservas por especialidad", desc: "Cada barra es una especialidad y su largo, las reservas del período. Muestra dónde está la mayor demanda.", top: 8, ordenar: true },
      atencion: { titulo: "Qué pasó con las reservas", desc: "Reparte las reservas del período: atendidas, ausencias (el paciente no llegó), sin registro todavía y canceladas.", colores: ["#2e7a4f", "#c0843a", "#9fb3bb", "#c9d5d9"] },
      evolucion: { titulo: "Reservas por semana", desc: "Cada columna es una semana y su altura, las citas activas de esa semana. Sirve para ver si la demanda sube o baja.", tipo: "columnas" },
      lugares: { titulo: "Consultas realizadas por lugar", desc: "Cada barra es un policlínico (o Telemedicina) y su largo, las consultas efectivamente realizadas.", ordenar: true },
      perdida: { titulo: "Horas perdidas por ausencias (%)", desc: "De las horas agendadas con resultado, qué porcentaje se perdió porque el paciente no llegó. Mientras más bajo, mejor.", sufijo: " %", ordenar: true },
      "encuesta-agendamiento": { titulo: "Encuesta de agendamiento: ¿qué tan fácil fue reservar?", desc: `Cada barra cuenta cuántas personas dieron esa nota (5 = muy fácil, 1 = muy difícil). ${analitica.encuestasPorTipo.agendamiento.respuestas ? `Hubo ${analitica.encuestasPorTipo.agendamiento.respuestas} respuesta(s), con promedio ${String(analitica.encuestasPorTipo.agendamiento.promedio).replace(".", ",")} de 5.` : "Aún no hay respuestas en el período."}` },
      "encuesta-atencion": { titulo: "Encuesta de atención: ¿cómo fue la consulta?", desc: `Cada barra cuenta cuántas personas dieron esa nota (5 = muy buena, 1 = mala). ${analitica.encuestasPorTipo.atencion.respuestas ? `Hubo ${analitica.encuestasPorTipo.atencion.respuestas} respuesta(s), con promedio ${String(analitica.encuestasPorTipo.atencion.promedio).replace(".", ",")} de 5.` : "Aún no hay respuestas en el período."}` },
    };
    g.forEach((x) => {
      const m = META[x.id] || {};
      const { ordenar, ...resto } = m;
      Object.assign(x, resto);
      if (ordenar) x.filas = [...x.filas].sort((p, q) => q.n - p.n);
    });
    const contexto = `${desde} a ${hasta} · Lugar: ${ctx.sedes.get(+filtro.idPoliclinico)?.nombre || "Toda la red"} · Especialidad: ${filtro.especialidad || "Todas"} · Profesional: ${ctx.profs.get(+filtro.idProfesional)?.nombre || "Todos"}`;
    return { filtro, periodo, a: analitica, ctx, g, contexto };
  }
  const filasGrafico = (g) => (g.top ? g.filas.slice(0, g.top) : g.filas);
  const corta = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + "…" : String(t));
  const fSemana = (t) => {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(t));
    return coincidencia ? `${Number(coincidencia[3])} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][Number(coincidencia[2]) - 1]}` : String(t);
  };
  const PALETA = ["#0b3b4c", "#16808b", "#b8742a", "#9aabb3", "#c9d5d9"];
  const echart = (g) => {
    const filas = g.topPantalla ? filasGrafico(g).slice(0, g.topPantalla) : filasGrafico(g);
    const t = { titulo: g.titulo, tabla: false };
    if (g.siluetas || ["adultos", "atencion"].includes(g.id)) {
      const colores = g.id === "atencion" ? ["#16808b", "#b8742a", "#9aabb3", "#c9d5d9"] : PALETA;
      return graficos.segmentada(filas.map((x, i) => ({ nombre: x.nombre, n: x.n, color: colores[i % colores.length] })), g.titulo, { tabla: false, unidad: g.id === "atencion" ? "reservas" : "pacientes" });
    }
    if (g.tipo === "columnas")
      return graficos.lineas({ ...t, etiquetas: filas.map((x) => x.nombre), series: [{ nombre: "Citas activas", color: "#16808b", valores: filas.map((x) => x.n) }], etiquetaX: (e) => `Semana del ${fSemana(e)}`, ejeFecha: fSemana, alto: 280 });
    return graficos.barras(filas, { ...t, sufijo: g.sufijo || "", max: g.max, color: g.id === "perdida" ? graficos.COLOR.ambar : graficos.COLOR.teal, vacio: "Sin datos para el período." });
  };
  const svg = (g) => {
    const rows = filasGrafico(g),
      suf = g.sufijo || "",
      max = g.max || Math.max(1, ...rows.map((x) => x.n));
    if (g.siluetas) {
      const total = rows.reduce((s, x) => s + x.n, 0);
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 270" role="img" aria-label="${esc(g.titulo)}">${rows
        .map((x, i) => {
          const w = 560 / Math.max(1, rows.length),
            cx = w * i + w / 2;
          return `<g class="chart-bar" tabindex="0" data-category="${esc(x.nombre)}: ${x.n} pacientes" transform="translate(${cx - 35},20)"><title>${esc(x.nombre)}: ${x.n} pacientes únicos atendidos</title><circle cx="35" cy="24" r="20" fill="${i === 0 ? "#4f9ea6" : i === 1 ? "#7996c5" : "#bdcbd3"}"/><path d="M14 54 Q35 45 56 54 L65 124 L49 124 L47 195 L34 195 L33 132 L29 195 L16 195 L20 124 L5 124 Z" fill="${i === 0 ? "#4f9ea6" : i === 1 ? "#7996c5" : "#bdcbd3"}"/><text x="35" y="220" text-anchor="middle" font-size="12" fill="#234959">${esc(x.nombre)}</text><text x="35" y="243" text-anchor="middle" font-size="15" font-weight="600" fill="#234959">${x.n} · ${total ? Math.round((x.n / total) * 100) : 0}%</text></g>`;
        })
        .join("")}${!rows.length ? '<text x="280" y="130" text-anchor="middle" font-size="13" fill="#728994">Sin pacientes atendidos en este período</text>' : ""}</svg>`;
    }
    if (!rows.length)
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120" role="img" aria-label="${esc(g.titulo)}"><text x="320" y="64" text-anchor="middle" font-size="13" fill="#728994">Sin datos para el período</text></svg>`;
    if (g.tipo === "columnas") {
      const W = 640, H = 260, L = 40, T = 22, B = 44, paso = (W - L - 10) / rows.length, ancho = Math.min(46, paso * 0.62);
      const y = (v) => T + (H - T - B) * (1 - v / max);
      const guias = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - 10}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="#e3ecef"/><text x="${L - 6}" y="${y(max * f) + 4}" text-anchor="end" font-size="10" fill="#728994">${Math.round(max * f)}</text>`).join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(g.titulo)}">${guias}${rows
        .map((x, i) => {
          const cx = L + paso * i + paso / 2, top = y(x.n);
          return `<g class="chart-bar" tabindex="0" data-category="Semana del ${esc(fSemana(x.nombre))}: ${x.n}"><title>Semana del ${esc(fSemana(x.nombre))}: ${x.n}</title><rect x="${(cx - ancho / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${ancho.toFixed(1)}" height="${Math.max(0, y(0) - top).toFixed(1)}" rx="3" fill="#368e99"/><text x="${cx.toFixed(1)}" y="${(top - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#234959">${x.n}</text>${rows.length <= 8 || i % 2 === 0 ? `<text x="${cx.toFixed(1)}" y="${H - 22}" text-anchor="middle" font-size="10" fill="#5b7480">${esc(fSemana(x.nombre))}</text>` : ""}</g>`;
        })
        .join("")}</svg>`;
    }
    const fila = 34, h = rows.length * fila + 16, X0 = 210, ancho = 330;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${h}" role="img" aria-label="${esc(g.titulo)}">${rows
      .map((x, i) => {
        const w = Math.max(x.n > 0 ? 3 : 0, (x.n / max) * ancho), yy = i * fila + 8;
        return `<g class="chart-bar" tabindex="0" data-category="${esc(x.nombre)}: ${x.n}${esc(suf)}"><title>${esc(x.nombre)}: ${x.n}${esc(suf)}</title><text x="${X0 - 12}" y="${yy + 17}" text-anchor="end" font-size="12" fill="#234959">${esc(corta(x.nombre, 30))}</text><rect x="${X0}" y="${yy + 3}" width="${ancho}" height="20" rx="4" fill="#eef3f5"/><rect x="${X0}" y="${yy + 3}" width="${w.toFixed(1)}" height="20" rx="4" fill="${g.colores?.[i] || "#368e99"}"/><text x="${(X0 + w + 8).toFixed(1)}" y="${yy + 18}" font-size="12" font-weight="600" fill="#234959">${x.n}${esc(suf)}</text></g>`;
      })
      .join("")}</svg>`;
  };
  return {
    agendaJson: async ({ consulta: q }) => {
      const { filtro } = await datos(q, true);
      return { binario: Buffer.from(JSON.stringify(await agenda(filtro))), mime: "application/json; charset=utf-8", nombreArchivo: "agenda.json", enLinea: true };
    },
    ver: async ({ usuario: u, consulta: q }) => {
      const d = await datos(q),
        { filtro: f, a, ctx, g, contexto, periodo } = d;
      const SECCIONES = [
        ["resumen", "Resumen", "Lo esencial del período: cómo terminaron las reservas y cómo evoluciona la demanda.", ["atencion", "evolucion"]],
        ["pacientes", "Pacientes", "Quiénes se atienden: sexo, edad y nacionalidad. Cada paciente se cuenta una sola vez.", ["sexo", "edad", "nacionalidad", "adultos"]],
        ["demanda", "Demanda y ocupación", "Qué profesionales y especialidades concentran las reservas y cuánto se usan los cupos.", ["demanda", "ocupacion", "especialidad", "espera"]],
        ["lugares", "Por lugar", "Cómo le va a cada policlínico y a Telemedicina.", ["lugares", "perdida"]],
        ["encuestas", "Encuestas", "Qué opinan los pacientes de reservar su hora y de la atención recibida.", ["encuesta-agendamiento", "encuesta-atencion"]],
        ["agenda", "Agenda detallada", "Actividad de las agendas día a día, con el detalle de cada reserva.", null],
      ];
      const seccion = SECCIONES.some((x) => x[0] === q.get("seccion")) ? q.get("seccion") : "resumen";
      const actual = SECCIONES.find((x) => x[0] === seccion);
      const parametros = new URLSearchParams({
        desde: f.desde,
        hasta: f.hasta,
        sede: f.idPoliclinico || "",
        esp: f.especialidad || "",
        prof: f.idProfesional || "",
      });
      const enlace = (id, formato) =>
        "/admin/reportes/exportar?" +
        new URLSearchParams({
          ...Object.fromEntries(parametros),
          grafico: id,
          formato,
        });
      const chart = (x) =>
        `<section class="work-panel graf-r" data-chart="${x.id}" data-context="${esc(contexto)}"><div class="chart-heading"><h3>${esc(x.titulo)}</h3></div><p class="como-leer"><b>Cómo leerlo:</b> ${esc(x.desc || "")}</p>${echart(x)}<div class="chart-actions" role="group" aria-label="Descargar este gráfico">${vistas.btn("PDF", enlace(x.id, "pdf"), true)}${vistas.btn("Excel", enlace(x.id, "xlsx"), true)}${vistas.btn("PNG", enlace(x.id, "png"), true)}</div><details class="datos-r"><summary>Ver datos</summary>${tabla(
          ["Categoría", "Valor"],
          x.filas.map((r) => [r.nombre, `${r.n}${x.sufijo || ""}`]),
        )}</details></section>`;
      const formulario = `<form class="filters"><input type="hidden" name="seccion" value="${seccion}">${vistas.select("sede", "Lugar", [{ id: "", nombre: "Toda la red" }, ...ctx.listaSedes], f.idPoliclinico || "")}${vistas.select("esp", "Especialidad", [{ id: "", nombre: "Todas" }, ...vistas.opcionesTexto(await aplicacion.catalogo.especialidades())], f.especialidad || "")}${vistas.select("prof", "Profesional", [{ id: "", nombre: "Todos" }, ...ctx.listaProfs], f.idProfesional || "")}${vistas.select(
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
            )}${vistas.input("desde", "Desde", f.desde, "date")}${vistas.input("hasta", "Hasta", f.hasta, "date")}<button type="submit">Aplicar filtros</button></form>`;
      const tabs = `<nav class="tabs-r" aria-label="Secciones del reporte">${SECCIONES.map(
        ([k, t]) =>
          `<a href="/admin/reportes?${esc(new URLSearchParams({ ...Object.fromEntries(parametros), periodo, seccion: k }).toString())}"${k === seccion ? ' class="act" aria-current="page"' : ""}>${t}</a>`,
      ).join("")}</nav>`;
      const resumenKpis = `<div class="metric-strip"><div><b>${a.caracterizacion.atendidos}</b>Pacientes únicos atendidos</div><div><b>${a.resumen.asistio}</b>Consultas realizadas</div><div><b>${a.resumen.ocupacion ?? "—"}%</b>Ocupación de cupos publicados</div><div><b>${a.resumen.tasaInasistencia ?? "—"}%</b>Pérdida de horas</div></div>`;
      const cuerpo =
        seccion === "agenda"
          ? require("../views/panelAgenda").panel(await agenda(f), parametros.toString())
          : `${seccion === "resumen" ? resumenKpis : ""}<div class="chart-grid">${actual[3].map((id) => chart(g.find((x) => x.id === id))).join("")}</div>${seccion === "demanda" ? `<p class="report-note">${vistas.btn("Supervisar lista de espera", "/admin/espera", true)}</p>` : ""}`;
      return {
        html: vistas.page(
          u,
          "Reportes institucionales",
          `<style>.datos-r>.tabla-w{max-height:300px;overflow:auto}.tabs-r{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--borde);margin:0 0 6px}.tabs-r a{padding:11px 16px;font-weight:600;font-size:.9rem;color:var(--muted);text-decoration:none;border-bottom:3px solid transparent;margin-bottom:-1px}.tabs-r a:hover{color:var(--navy)}.tabs-r a.act{color:var(--teal-t);border-bottom-color:var(--teal)}.tab-desc{color:var(--muted);margin:10px 0 18px;font-size:.92rem}.como-leer{background:#f4f9fa;border-left:3px solid var(--teal);border-radius:4px;padding:9px 12px;margin:0 0 14px;font-size:.84rem;color:#35525e;line-height:1.5}.graf-r svg{width:100%;height:auto;display:block}.graf-r .chart-heading h3{font-size:1.02rem;margin:0 0 10px}.datos-r{margin-top:10px;border-top:1px solid var(--borde);padding-top:8px}.datos-r summary{font-size:.84rem;color:var(--muted);cursor:pointer}.datos-r .chart-actions{justify-content:flex-start;margin-top:12px}.chart-grid{align-items:start}</style>` +
          vistas.cab(
            "Indicadores agregados de la red y de sus lugares de atención.",
            vistas.btn("Reporte completo PDF", enlace("todos", "pdf"), true) +
              vistas.btn("Todos los gráficos PNG (ZIP)", enlace("todos", "png"), true) +
              vistas.btn("Reporte completo Excel", enlace("todos", "xlsx")),
          ) +
            `${formulario}` +
            `<p class="report-note">${esc(contexto)}<br>Pérdida = ausencias registradas ÷ (atenciones realizadas + ausencias registradas) × 100. Los registros incompletos se muestran separados.</p>${tabs}<p class="tab-desc">${esc(actual[2])}</p>${cuerpo}`,
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
          html: vistas.errorPage(
            u,
            new Error("Gráfico no encontrado."),
            "/admin/reportes",
          ),
        };
      const formato = q.get("formato");
      if (!["pdf", "xlsx", "png"].includes(formato))
        return { estado: 400, html: "Formato inválido" };
      aplicacion.operacion.aud(
        u,
        "Reporte descargado",
        "Reportes",
        q.get("grafico"),
        null,
        { periodo: d.filtro, formato },
      );
      const zipPng = formato === "png" && g.length > 1;
      return {
        binario:
          formato === "pdf"
            ? Exportar.pdf(g, d.contexto)
            : formato === "png"
              ? zipPng
                ? Exportar.zip(Object.fromEntries(g.map((x) => [`${x.id}.png`, Exportar.png(svg(x), x.titulo, d.contexto)])))
                : Exportar.png(svg(g[0]), g[0].titulo, d.contexto)
              : Exportar.excel(g, d.contexto),
        mime:
          formato === "pdf"
            ? "application/pdf"
            : formato === "png"
              ? zipPng ? "application/zip" : "image/png"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        nombreArchivo: `reporte-${q.get("grafico")}.${zipPng ? "zip" : formato}`,
      };
    },
  };
}
module.exports = { crearControladorReportes };

"use strict";
const { pagina } = require("./layout");
const { esc, tabla, raw, opciones } = require("./util");
const { hoy, sumarDias, lunesDe } = require("../util/tiempo");
const { edad } = require("../services/PacienteService");
const { fechaValida } = require("../services/OperacionService");
const { infoSede } = require("../models/sedesInfo");
const E = esc;
const hidden = (d) =>
  Object.entries(d)
    .map(([k, v]) => `<input type="hidden" name="${E(k)}" value="${E(v)}">`)
    .join("");
const input = (nombre, titulo, valor = "", tipo = "text", extra = "") =>
  `<label>${titulo}<input name="${nombre}" type="${tipo}" value="${E(valor)}" ${extra}></label>`;
const select = (
  nombre,
  titulo,
  lista,
  valor = "",
  v = (x) => x.id,
  t = (x) => x.nombre,
  extra = "",
) =>
  `<label>${titulo}<select name="${nombre}" ${extra}>${opciones(lista, v, t, valor)}</select></label>`;
const opcionesTexto = (a) => a.map((x) => ({ id: x, nombre: x }));
const btn = (t, href, sec = false) =>
  `<a class="btn ${sec ? "sec" : ""}" href="${E(href)}">${t}</a>`;
const post = (url, d, t, sec = false) =>
  `<form class="micro" method="post" action="${url}">${hidden(d)}<button type="submit" class="${sec ? "sec" : ""}">${t}</button></form>`;
const cab = (t, sub, acciones = "") =>
  `<div class="work-heading"><div><p class="eyebrow">HERMANDAD DE DOLORES / GESTIÓN</p><h2>${t}</h2><p>${sub}</p></div><div class="actions">${acciones}</div></div>`;
const panel = (t, c) =>
  `<section class="work-panel"><div class="panel-heading"><h3>${t}</h3></div>${c}</section>`;
const badge = (t) =>
  `<span class="status ${/Disponible|Confirmada|Atendida|Activo|Validado|Vigente|Conectado|Entregado|Enviado|Enlace enviado/.test(t) ? "green" : /Bloqueado|Cancelada|Error|No asistió|Vencido|No se conectó/.test(t) ? "red" : "amber"}">${E(t)}</span>`;
const page = (u, t, c, m) =>
  pagina({
    usuario: u,
    titulo: t,
    contenido: `<div class="workspace">${c}</div>`,
    mensaje: m,
    lienzo: true,
  });
const errorPage = (u, e, volver) =>
  page(
    u,
    "Revisa la operación",
    `<p class="aviso err">${E(e.message)}</p>${btn("Volver", volver, true)}`,
  );
const color = (op, sede, esp, toda) =>
  toda
    ? op.meta.sedes[sede]?.color ||
      [
        "#238a94",
        "#678ac2",
        "#a16b9b",
        "#bf864c",
        "#5c9b7e",
        "#aa7893",
        "#667cc9",
      ][(sede - 1) % 7]
    : op.meta.especialidades[esp]?.color ||
      ["#238a94", "#7e7cc0", "#bc8a47", "#4e9e83"][
        Math.abs([...esp].reduce((s, c) => s + c.charCodeAt(0), 0)) % 4
      ];
const estado = (c, tele, op) => {
  if (c.estadoReserva === "CANCELADA") return "Cancelada";
  if (c.asistencia === "ASISTIO") return "Atendida";
  if (c.asistencia === "NO_ASISTIO") return tele ? "No se conectó" : "No asistió";
  if (c.flujo && !(tele && ["Enlace enviado", "Enlace pendiente"].includes(c.flujo)))
    return c.flujo;
  if (c.estadoConfirmacion === "CONFIRMADA") return "Confirmada";
  return tele ? op.estadoEnvioEnlace(c).estado : "Pendiente";
};
const normalizarBusqueda = (texto) =>
  String(texto || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const thumb = (p) =>
  p.foto
    ? `<img class="professional-photo" src="${E(p.foto)}" alt="${E(p.nombre)}">`
    : `<span class="professional-photo placeholder" aria-label="Fotografía no registrada"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="7" r="3.5"/><path d="M4 21v-3a8 8 0 0 1 16 0v3M8 14v5m8-5v5m-10 0h4m4 0h4"/></svg></span>`;
function calendario({ u, ctx, citas, op, q, admin, mensaje }) {
  const vistaPedida = q.get("vista");
  const fechaPedida = q.get("fecha");
  const tele = u.rol === "TELEMEDICINA";
  const estados = admin
    ? ["Sin publicar", "Disponible", "Reservado", "Bloqueado"]
    : tele
      ? ["Disponible", "Enlace pendiente", "Enlace guardado", "Pendiente de envío", "Enlace enviado", "Error de envío", "Confirmada", "Conectado", "Atendida", "No se conectó", "Sin publicar", "Bloqueado"]
      : ["Disponible", "Pendiente", "Confirmada", "Llegó", "En sala", "Atendida", "No asistió", "Sin publicar", "Bloqueado"];
  const sede = admin ? q.get("sede") || "" : String(u.idPoliclinico),
    esp = q.get("esp") || "",
    prof = q.get("prof") || "",
    vista = ["semana", "lista"].includes(vistaPedida) ? vistaPedida : "dia",
    fecha = fechaValida(fechaPedida) ? fechaPedida : hoy(),
    inicio = vista === "semana" ? lunesDe(fecha) : fecha,
    fin = vista === "semana" ? sumarDias(inicio, 6) : fecha;
  const fechas = Array.from({ length: vista === "semana" ? 7 : 1 }, (_, i) =>
    sumarDias(inicio, i),
  );
  const url = admin ? "/admin/agendas" : "/tens/agenda",
    seleccion = new Set(prof.split(",")),
    estadoF = estados.includes(q.get("estado")) ? q.get("estado") : "",
    busqueda = (q.get("q") || "").trim().slice(0, 120);
  const nombreBuscado = normalizarBusqueda(busqueda);
  const rutBuscado = !admin && /^\d[\d.\s-]*k?$/i.test(busqueda)
    ? busqueda.replace(/[.\s-]/g, "").toLowerCase()
    : "";
  const enSede = (p) => !sede || fechas.some((f) => op.lugares(p, f).includes(+sede));
  const profs = ctx.listaProfs.filter(
    (p) =>
      p.activo &&
      enSede(p) &&
      (!esp || (p.especialidades || [p.especialidad]).includes(esp)) &&
      (!prof || seleccion.has(String(p.id))),
  );
  const visibles = [...ctx.bloques.values()].filter(
    (b) =>
      b.fecha >= inicio &&
      b.fecha <= fin &&
      (!sede || op.sedeBloque(b, ctx.profs.get(b.idProfesional)) === +sede) &&
      (!esp ||
        (b.especialidad || ctx.profs.get(b.idProfesional)?.especialidad) ===
          esp) &&
      profs.some((p) => p.id === b.idProfesional),
  );
  const activas = new Map(
    citas
      .filter((c) => c.estadoReserva === "ACTIVA")
      .map((c) => [c.idBloque, c]),
  );
  const estadosReservas = new Map();
  for (const b of visibles) {
    const c = activas.get(b.id);
    if (!c) continue;
    const lugar = ctx.sedes.get(op.sedeBloque(b, ctx.profs.get(b.idProfesional)));
    estadosReservas.set(b.id, estado(c, !!lugar?.telemedicina, op));
  }
  const est = (b) =>
    activas.has(b.id)
      ? admin
        ? "Reservado"
        : estadosReservas.get(b.id)
      : b.publicado
        ? "Disponible"
        : b.estado === "Bloqueado"
          ? "Bloqueado"
          : "Sin publicar";
  const bloques = visibles.filter((b) => {
    if (estadoF && est(b) !== estadoF) return false;
    if (!busqueda) return true;
    const c = activas.get(b.id);
    if (!c) return false;
    const nombre = normalizarBusqueda(ctx.pacientes.get(c.rut)?.nombre);
    const rut = String(c.rut).replace(/[-.]/g, "").toLowerCase();
    return nombre.includes(nombreBuscado) || (!!rutBuscado && rut.includes(rutBuscado));
  });
  const filtrosActuales = { ...(admin ? { sede } : {}), esp, prof, estado: estadoF, q: busqueda, vista };
  const nav = (c = {}) => {
    const parametros = Object.entries({ ...filtrosActuales, fecha, ...c }).filter(([, valor]) => valor);
    return url + "?" + new URLSearchParams(parametros);
  };
  const volverAgenda = nav();
  const detalleAgenda = (b) => {
    const c = activas.get(b.id);
    const parametros = new URLSearchParams(c ? { idCita: c.id } : { idBloque: b.id });
    if (!admin && c) parametros.set("volverAgenda", volverAgenda);
    return (admin ? "/admin/cupo" : "/tens/reserva") + "?" + parametros;
  };
  const cuadricula = () => {
    const esSemana = vista === "semana";
    const minuto = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
    const duracion = (b) => Number(b.duracion) || 30;
    const desdeMin = bloques.reduce((min, b) => Math.min(min, minuto(b.hora)), 8 * 60);
    const hastaMin = bloques.reduce((max, b) => Math.max(max, minuto(b.hora) + duracion(b)), 18 * 60);
    const primeraHora = Math.floor(desdeMin / 60);
    const horas = Array.from(
      { length: Math.ceil(hastaMin / 60) - primeraHora },
      (_, i) => primeraHora + i,
    );
    const carrilPorBloque = new Map();
    const columnas = esSemana
      ? fechas.map((fecha) => {
          const delDia = bloques.filter((b) => b.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora));
          const finPorCarril = [];
          for (const b of delDia) {
            const inicio = minuto(b.hora);
            const libre = finPorCarril.findIndex((fin) => fin <= inicio);
            const carril = libre === -1 ? finPorCarril.length : libre;
            finPorCarril[carril] = inicio + duracion(b);
            carrilPorBloque.set(b.id, carril);
          }
          return {
            fecha,
            nombre: new Date(fecha + "T12:00:00").toLocaleDateString("es-CL", {
              weekday: "short",
              day: "numeric",
              month: "short",
            }),
            bloques: delDia,
            carriles: Math.max(1, finPorCarril.length),
          };
        })
      : profs;
    const block = (b, columna) => {
      const p = ctx.profs.get(b.idProfesional),
        c = activas.get(b.id),
        s = op.sedeBloque(b, p),
        es = b.especialidad || p.especialidad;
      const nombre = c ? ctx.pacientes.get(c.rut)?.nombre || c.rut : es;
      const estadoBloque = admin && c ? `Reservado · ${estadosReservas.get(b.id)}` : est(b);
      const ubicacion = ctx.sedes.get(s)?.nombre;
      const carril = carrilPorBloque.get(b.id) ?? 0;
      const carriles = columna.carriles || 1;
      const posicion = `--event:${color(op, s, es, !sede)};--slot-offset:${(minuto(b.hora) % 60) * 2}px;--slot-height:${duracion(b) * 2 - 3}px;--lane-start:${carril * 100 / carriles}%;--lane-end:${(carriles - carril - 1) * 100 / carriles}%`;
      const encabezado = esSemana
        ? `<div class="schedule-week-title"><b>${E(b.hora)}</b><strong>${E(nombre)}</strong></div><small>${E(estadoBloque)}</small>`
        : `<div><b>${E(b.hora)}</b><span>${E(estadoBloque)}</span></div><strong>${E(nombre)}</strong>`;
      const titulo = esSemana
        ? ` title="${E([b.hora, nombre, p.nombre, ubicacion, estadoBloque].filter(Boolean).join(" · "))}"`
        : "";
      return `<a class="schedule-block" style="${posicion}" href="${E(detalleAgenda(b))}" data-drawer${titulo}>${encabezado}<small>${E(c && !admin ? c.rut : p.nombre)}</small><small>${E(esSemana ? ubicacion : es)}</small></a>`;
    };
    const columnasGrid = esSemana
      ? `--week-tracks:${columnas.map(({ carriles }) => `minmax(${185 * carriles}px,${carriles}fr)`).join(" ")}`
      : `--columns:${Math.max(1, columnas.length)}`;
    const encabezados = columnas
      .map((p) => {
        const detalles = esSemana ? "" : `<small>${E(p.especialidad)}</small><small>${E(
          op.lugares(p, fecha).map((id) => ctx.sedes.get(id)?.nombre).join(" · "),
        )}</small>`;
        return `<div class="professional-head">${esSemana ? "" : thumb(p)}<div><b>${E(p.nombre)}</b>${detalles}</div></div>`;
      })
      .join("");
    const filas = horas
      .map((h) => {
        const celdas = columnas
          .map((p) => {
            const cupos = esSemana ? p.bloques : bloques.filter((b) => b.idProfesional === p.id);
            return `<div class="calendar-cell">${cupos
              .filter((b) => Math.floor(minuto(b.hora) / 60) === h)
              .map((b) => block(b, p))
              .join("")}</div>`;
          })
          .join("");
        return `<div class="calendar-hour">${String(h).padStart(2, "0")}:00</div>${celdas}`;
      })
      .join("");
    return `<div class="calendar-scroll"><div class="calendar-grid${esSemana ? " calendar-grid-week" : ""}" style="${columnasGrid}"><div class="calendar-corner">HORA</div>${encabezados}${filas}</div></div>`;
  };
  const leyenda = [
    ...new Set(
      visibles.map((b) =>
        !sede
          ? String(op.sedeBloque(b, ctx.profs.get(b.idProfesional)))
          : b.especialidad || ctx.profs.get(b.idProfesional)?.especialidad,
      ),
    ),
  ];
  const listaDelDia = () =>
    `<ul class="agenda-lista" aria-label="Cupos y reservas por hora">${[...bloques]
      .sort((a, b) => a.hora.localeCompare(b.hora) || a.idProfesional - b.idProfesional)
      .map((b) => {
        const c = activas.get(b.id);
        const profesional = ctx.profs.get(b.idProfesional);
        const lugar = ctx.sedes.get(op.sedeBloque(b, profesional));
        const especialidad = b.especialidad || profesional.especialidad;
        const nombre = c ? ctx.pacientes.get(c.rut)?.nombre || "Reserva" : especialidad;
        const estadoCupo = est(b);
        const descripcion = [
          c ? especialidad : "",
          profesional.nombre,
          admin && !sede ? lugar?.nombre : "",
        ].filter(Boolean).map(E).join(" · ");
        const llegadaPendiente = c && !c.asistencia && !["Llegó", "En sala", "Conectado"].includes(estadoCupo);
        const accion = !admin && llegadaPendiente
          ? post("/tens/flujo", { idCita: c.id, estado: tele ? "Conectado" : "Llegó", volverAgenda },
              tele ? "Marcar conexión" : "Registrar llegada", true)
          : "";
        return `<li class="agenda-fila">
          <time datetime="${E(b.hora)}">${E(b.hora)}</time>
          <div class="agenda-info"><strong>${E(nombre)}</strong><p>${descripcion}</p></div>
          <div class="actions">${badge(estadoCupo)}${accion}<a class="btn sec" href="${E(detalleAgenda(b))}" data-drawer>${c ? "Ver reserva" : "Ver cupo"}</a></div>
        </li>`;
      }).join("")}</ul>`;
  const cambioVista = [["dia", "Día"], ["semana", "Semana"], ["lista", "Lista del día"]]
    .map(([modo, nombre]) =>
      `<a class="btn${vista === modo ? "" : " sec"}" href="${E(nav({ vista: modo }))}"${vista === modo ? ' aria-current="page"' : ""}>${nombre}</a>`,
    ).join("");
  const filtrosActivos = [admin ? sede : "", esp, prof, estadoF, busqueda].filter(Boolean).length;
  const filtros = `<form class="filters" method="get" action="${url}">${hidden({ vista, fecha })}${admin ? select("sede", "Lugar de atención", [{ id: "", nombre: "Toda la red" }, ...ctx.listaSedes], sede) : `<div class="locked-site">⌖ ${E(ctx.sedes.get(+sede)?.nombre)}</div>`}${select("esp", "Especialidad", [{ id: "", nombre: "Todas las especialidades" }, ...opcionesTexto([...new Set(ctx.listaProfs.filter(p => p.activo && enSede(p)).flatMap(p => p.especialidades || [p.especialidad]))])], esp)}<details class="multi-filter"><summary>Profesionales · ${prof ? seleccion.size : "Todos"}</summary><div>${ctx.listaProfs
    .filter((p) => p.activo && enSede(p))
    .map(
      (p) =>
        `<label class="check"><input type="checkbox" data-prof="${p.id}"${!prof || seleccion.has(String(p.id)) ? " checked" : ""}>${E(p.nombre)}</label>`,
    )
    .join(
      "",
    )}</div></details>${hidden({ prof })}${select("estado", "Estado", [{ id: "", nombre: "Todos los estados" }, ...opcionesTexto(estados)], estadoF)}${input("q", admin ? "Buscar paciente" : "Buscar por nombre o RUT", busqueda, "search")}<button type="submit">Aplicar</button></form>`;
  return page(
    u,
    admin ? "Agendas y cupos" : "Agendas y reservas",
    cab(
      admin ? "Agendas y cupos" : "Agendas y reservas",
      admin
        ? "Disponibilidad y reservas de toda la red de atención."
        : "Agenda operativa del lugar asignado.",
      admin
        ? btn("+ Crear bloque horario", "/admin/bloque/nuevo") +
            btn("Cambios de agenda", "/admin/cambios", true) +
            btn("Cupos por rango", "/admin/cupos/rango", true) +
            btn("Cancelaciones", "/admin/cancelaciones", true)
        : btn("+ Nueva reserva", "/tens/agendar"),
    ) +
      `<details class="agenda-filtros" data-filtros-agenda open>
        <summary>Filtros${filtrosActivos ? " (" + filtrosActivos + ")" : ""}</summary>
        ${filtros}
      </details>` +
      `<section class="work-panel"><div class="calendar-toolbar"><div class="actions">${btn("Hoy", nav({ fecha: hoy() }), true)}${btn("‹", nav({ fecha: sumarDias(inicio, vista === "semana" ? -7 : -1) }), true)}${btn("›", nav({ fecha: sumarDias(inicio, vista === "semana" ? 7 : 1) }), true)}<b>${E(new Date(inicio + "T12:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }))}${vista === "semana" ? " — " + E(fin) : ""}</b></div><div class="actions"><nav class="actions" aria-label="Vista de la agenda">${cambioVista}</nav><form method="get">${hidden(filtrosActuales)}<input type="date" name="fecha" aria-label="Fecha de agenda" value="${E(fecha)}" onchange="this.form.submit()"></form></div></div>${vista === "lista" ? listaDelDia() : cuadricula()}${!bloques.length ? '<p class="empty-inline">No hay cupos que coincidan con la fecha y los filtros.</p>' : ""}<div class="calendar-legend">${(vista === "lista" ? [] : leyenda).map((l) => `<span><i style="background:${color(op, !sede ? +l : +sede, !sede ? "" : l, !sede)}"></i>${E(!sede ? ctx.sedes.get(+l)?.nombre : l)}</span>`).join("")}${admin ? btn("Configurar colores", "/admin/colores", true) : ""}<span class="muted">${bloques.length} cupos · ${bloques.filter((b) => activas.has(b.id)).length} reservas</span></div></section>` +
      (!admin
        ? panel(
            "Próximos cupos libres",
            `<div class="available-slots">${
              [...ctx.bloques.values()]
                .filter(
                  (b) =>
                    b.fecha >= hoy() &&
                    op.sedeBloque(b, ctx.profs.get(b.idProfesional)) ===
                      +sede &&
                    b.publicado &&
                    !activas.has(b.id),
                )
                .slice(0, 8)
                .map((b) =>
                  btn(
                    `${E(b.fecha)} · ${E(b.hora)}`,
                    "/tens/agendar?" +
                      new URLSearchParams({ fecha: b.fecha, idBloque: b.id }),
                    true,
                  ),
                )
                .join("") || "<p>Sin cupos libres.</p>"
            }</div>`,
          )
        : ""),
    mensaje,
  );
}
function bloqueNuevo({ u, ctx, plan, d = {} }) {
  const ps = ctx.listaProfs.filter(
    (p) => p.activo && !["TENS", "TONS"].includes(p.tipo),
  );
  const form = `<form class="form-grid" method="post" action="/admin/bloque/revisar">${select("idPoliclinico", "Lugar de atención", ctx.listaSedes, d.idPoliclinico)}${select("especialidad", "Especialidad", opcionesTexto([...new Set(ps.map((p) => p.especialidad))]), d.especialidad)}${select(
    "idProfesional",
    "Profesional",
    ps,
    d.idProfesional,
    (p) => p.id,
    (p) => `${p.nombre} · ${p.especialidad}`,
  )}${select(
    "repeticion",
    "Repetición",
    opcionesTexto(["unica", "semanal"]),
    d.repeticion || "semanal",
    (x) => x.id,
    (x) => (x.id === "unica" ? "Fecha única" : "Semanal"),
  )}${input("desde", "Fecha inicial", d.desde || hoy(), "date", "required")}${input("hasta", "Fecha final", d.hasta || sumarDias(hoy(), 7), "date", "required")}${input("horaInicio", "Hora inicial", d.horaInicio || "09:00", "time", "required")}${input("horaFin", "Hora final", d.horaFin || "13:00", "time", "required")}${input("duracion", "Duración de atención (min)", d.duracion || 30, "number", 'min="10" max="120" required')}<fieldset class="full"><legend>Días de atención</legend><div class="actions">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((x, i) => `<label class="check"><input type="checkbox" name="dia${i}" value="1" ${d[`dia${i}`] === "1" || (!d.desde && i < 5) ? "checked" : ""}>${x}</label>`).join("")}</div></fieldset><button type="submit">Revisar resumen y conflictos</button></form>`;
  return page(
    u,
    "Crear bloque horario",
    cab(
      "Crear bloque horario",
      "Programa una franja completa. Se validan cruces en todos los lugares.",
      btn("Volver a la agenda", "/admin/agendas", true),
    ) +
      panel("Datos del bloque", form) +
      (plan
        ? panel(
            "Resumen previo",
            `<div class="metric-strip"><div><b>${plan.fechas.length}</b>Días / bloques</div><div><b>${plan.cupos.length}</b>Cupos</div><div><b>${plan.conflictos.length}</b>Conflictos</div></div><p>${E(plan.p.nombre)} · ${E(ctx.sedes.get(plan.sede)?.nombre)}</p>${
              plan.conflictos.length
                ? tabla(
                    ["Fecha", "Hora", "Lugar ocupado"],
                    plan.conflictos.map((x) => [
                      x.fecha,
                      x.hora,
                      x.existentes
                        .map(
                          (b) =>
                            ctx.sedes.get(
                              b.idPoliclinico || plan.p.idPoliclinico,
                            )?.nombre,
                        )
                        .join(", "),
                    ]),
                  )
                : `<form class="actions" method="post" action="/admin/bloque/guardar">${hidden(d)}<button type="submit" name="publicado" value="0" class="sec">Guardar sin publicar</button><button type="submit" name="publicado" value="1">Publicar ahora</button></form>`
            }`,
          )
        : ""),
  );
}
function equipo({ u, ctx, op, q, d, revision }) {
  const filtro = (q.get("q") || "").toLowerCase(),
    sede = q.get("sede") || "",
    tipo = q.get("tipo") || "",
    esp = q.get("esp") || "",
    estadoF = q.get("estado") || "",
    vista = q.get("vista") || "tarjetas";
  const ps = ctx.listaProfs.filter(
    (p) =>
      (!filtro ||
        `${p.nombre} ${p.especialidad}`.toLowerCase().includes(filtro)) &&
      (!sede || op.lugares(p).includes(+sede)) &&
      (!tipo || (p.tipo || "Profesional") === tipo) &&
      (!esp || (p.especialidades || [p.especialidad]).includes(esp)) &&
      (!estadoF || String(p.activo ? 1 : 0) === estadoF),
  );
  const editar = q.get("editar"),
    p = d || (editar ? ctx.profs.get(+editar) : null),
    nuevo = q.get("nuevo");
  let c =
    cab(
      "Equipo de salud",
      "Personas, especialidades y lugares asignados.",
      btn("+ Agregar integrante", "/admin/profesionales?nuevo=1"),
    ) +
    `<form class="filters">${input("q", "Buscar", q.get("q") || "", "search")}${select("sede", "Lugar", [{ id: "", nombre: "Todos" }, ...ctx.listaSedes], sede)}${select("esp", "Especialidad", [{ id: "", nombre: "Todas" }, ...opcionesTexto([...new Set(ctx.listaProfs.map((p) => p.especialidad))])], esp)}${select("tipo", "Tipo", [{ id: "", nombre: "Todos" }, ...opcionesTexto(["Médico", "Profesional", "TENS", "TONS"])], tipo)}${select(
      "estado",
      "Estado",
      [
        { id: "", nombre: "Todos" },
        { id: "1", nombre: "Activo" },
        { id: "0", nombre: "Inactivo" },
      ],
      estadoF,
    )}${select("vista", "Vista", opcionesTexto(["tarjetas", "tabla"]), vista)}<button type="submit">Filtrar</button></form>`;
  const acciones = (p) =>
    btn("Abrir ficha", `/admin/profesionales?editar=${p.id}`, true) +
    btn("Agenda", `/admin/agendas?prof=${p.id}`, true) +
    post(
      "/admin/profesionales/estado",
      { idProfesional: p.id, activo: p.activo ? "0" : "1" },
      p.activo ? "Desactivar" : "Activar",
      true,
    ) +
    (p.activo
      ? ""
      : `<form class="micro" method="post" action="/admin/equipo/eliminar" onsubmit="return confirm('Se eliminará el integrante y sus cupos libres. Solo es posible si no tiene reservas ni historial. ¿Continuar?')">${hidden({ idProfesional: p.id })}<button type="submit" class="sec">Eliminar</button></form>`);
  c +=
    vista === "tabla"
      ? tabla(
          [
            "Integrante",
            "Tipo / profesión",
            "Especialidades",
            "Lugares asignados",
            "Estado",
            "Acciones",
          ],
          ps.map((p) => [
            p.nombre,
            p.tipo || "Profesional",
            (p.especialidades || [p.especialidad]).join(", "),
            op
              .lugares(p)
              .map((id) => ctx.sedes.get(id)?.nombre)
              .join(", "),
            p.activo ? "Activo" : "Inactivo",
            raw(acciones(p)),
          ]),
        )
      : `<div class="team-grid">${ps
          .map(
            (p) =>
              `<article class="team-card"><div class="actions">${thumb(p)}${badge(p.activo ? "Activo" : "Inactivo")}</div><h3>${E(p.nombre)}</h3><p>${E(p.profesion || p.tipo || "Profesional de salud")}</p><strong>${E((p.especialidades || [p.especialidad]).join(" · "))}</strong><p class="muted">⌖ ${E(
                op
                  .lugares(p)
                  .map((id) => ctx.sedes.get(id)?.nombre)
                  .join(" · "),
              )}</p><div class="actions">${acciones(p)}</div></article>`,
          )
          .join("")}</div>`;
  if (p || nuevo) {
    const v = p || {};
    c += panel(
      p ? "Ficha del integrante" : "Nuevo integrante",
      `<form class="form-grid" method="post" action="/admin/equipo/revisar" enctype="multipart/form-data">${hidden({ id: v.id || "" })}${input("nombre", "Nombre completo", v.nombre || "", "text", "required")}${input("rut", "RUT (obligatorio para alta en PostgreSQL)", v.rut || "")}${input("correo", "Correo institucional", v.correo || "", "email")}${select("tipo", "Tipo de integrante", opcionesTexto(["Médico", "Profesional", "TENS", "TONS"]), v.tipo || "Profesional")}${input("profesion", "Profesión", v.profesion || "")}${input("especialidades", "Especialidades (separadas por coma)", Array.isArray(v.especialidades) ? v.especialidades.join(", ") : v.especialidades || v.especialidad || "")}${hidden({ foto: v.foto || "" })}<label>Fotografía del integrante<input type="file" name="fotografia" accept="image/jpeg,image/png"></label><fieldset class="full"><legend>Lugares de trabajo</legend>${ctx.listaSedes
        .map(
          (s) =>
            `<label class="check"><input type="checkbox" data-list="lugares" value="${s.id}" ${
              (Array.isArray(v.lugares)
                ? v.lugares
                : String(v.lugares || v.idPoliclinico || "")
                    .split(",")
                    .map(Number)
              ).includes(s.id)
                ? "checked"
                : ""
            }>${s.id} · ${E(s.nombre)}</label>`,
        )
        .join(
          "",
        )}${hidden({ lugares: Array.isArray(v.lugares) ? v.lugares.join(",") : v.lugares || v.idPoliclinico || "" })}</fieldset>${input("vigenteDesde", "Asignación vigente desde", v.vigenteDesde || hoy(), "date", "required")}<button type="submit">Revisar impacto</button></form>`,
    );
  }
  if (revision)
    c += panel(
      "Reservas futuras afectadas",
      `<p><b>${revision.afectados.length}</b> reservas afectadas. Las reservas existentes conservan su lugar original.</p>${tabla(
        ["Reserva", "Paciente (RUT)", "Cupo"],
        revision.afectados.map((c) => [c.id, c.rut, c.idBloque]),
      )}${revision.afectados.length ? '<p class="aviso err">Reprograma estas reservas antes de retirar sus lugares asignados.</p>' : `<form method="post" action="/admin/equipo/guardar">${hidden(revision.datos)}<button type="submit">Confirmar asignación</button></form>`}`,
    );
  return page(u, "Equipo de salud", c);
}
function lugares({ u, ctx, op, q, d }) {
  const tab = q.get("tab") || "lugares";
  let c =
    cab(
      "Policlínicos y especialidades",
      "Configuración de los seis policlínicos y Telemedicina.",
    ) +
    `<div class="tabs">${btn("Lugares de atención", "/admin/policlinicos?tab=lugares", tab !== "lugares")}${btn("Especialidades", "/admin/policlinicos?tab=especialidades", tab !== "especialidades")}</div>`;
  if (tab === "lugares") {
    c += `<div class="locations-grid">${ctx.listaSedes
      .map((s) => {
        const m = op.meta.sedes[s.id] || {},
          i = infoSede(s.id) || {},
          ps = ctx.listaProfs.filter((p) => op.lugares(p).includes(s.id));
        return `<article class="work-panel location"><div class="panel-heading"><h3><i class="color-dot" style="background:${m.color || "#238a94"}"></i>${E(s.nombre)}</h3>${badge(s.activo === false ? "Inactivo" : "Activo")}</div><p>${E(m.direccion || i.direccion || "Atención remota")}</p><p class="muted">${ps.length} integrantes asignados</p><p>${E((m.especialidades || i.especialidades || []).join(" · "))}</p><div class="actions">${btn("Ver agenda", "/admin/agendas?sede=" + s.id, true)}${btn("Equipo", "/admin/profesionales?sede=" + s.id, true)}${btn("Editar", "/admin/policlinicos?editar=" + s.id, true)}</div></article>`;
      })
      .join("")}</div>`;
    const v = d || ctx.sedes.get(+q.get("editar")) || {};
    c += panel(
      v.id ? "Editar lugar de atención" : "Crear lugar de atención",
      `<form class="form-grid" method="post" action="/admin/lugar">${hidden({ id: v.id || "" })}${input("nombre", "Nombre", v.nombre || "", "text", "required")}${input("direccion", "Dirección", v.direccion || infoSede(v.id)?.direccion || "")}${input("correo", "Correo", v.correo || infoSede(v.id)?.correo || "", "email", "required")}${input("whatsapp", "WhatsApp", v.whatsapp || infoSede(v.id)?.whatsapp || "", "text", "required")}${select("idComuna", "Comuna", ctx.comunas || [], v.idComuna)}${input("especialidades", "Especialidades (separadas por coma)", (v.especialidades || infoSede(v.id)?.especialidades || []).join(", "))}${input("color", "Color", v.color || "#238a94", "color")}${select(
        "activo",
        "Estado",
        [
          { id: 1, nombre: "Activo" },
          { id: 0, nombre: "Inactivo" },
        ],
        v.activo === false ? 0 : 1,
      )}${select(
        "telemedicina",
        "Modalidad",
        [
          { id: 0, nombre: "Presencial" },
          { id: 1, nombre: "Telemedicina" },
        ],
        v.telemedicina ? 1 : 0,
      )}<button type="submit">Guardar lugar</button></form>`,
    );
  } else {
    const es = [
      ...new Set([
        ...ctx.listaProfs.map((p) => p.especialidad),
        ...Object.keys(op.meta.especialidades),
      ]),
    ];
    c += tabla(
      ["Especialidad", "Lugares", "Equipo", "Estado", "Color"],
      es.map((e) => {
        const m = op.meta.especialidades[e] || {};
        return [
          e,
          ctx.listaSedes
            .filter((s) =>
              (
                op.meta.sedes[s.id]?.especialidades ||
                infoSede(s.id)?.especialidades ||
                []
              ).includes(e),
            )
            .map((s) => s.nombre)
            .join(", "),
          ctx.listaProfs
            .filter((p) => (p.especialidades || [p.especialidad]).includes(e))
            .map((p) => p.nombre)
            .join(", "),
          m.activo === false ? "Inactiva" : "Activa",
          raw(
            `<form class="micro" method="post" action="/admin/especialidad">${hidden({ nombre: e, activo: m.activo === false ? "0" : "1" })}<input aria-label="Color de ${E(e)}" type="color" name="color" value="${m.color || "#238a94"}"><button type="submit">Guardar</button></form>`,
          ),
        ];
      }),
    );
    c += panel(
      "Crear o actualizar especialidad",
      `<form class="form-grid" method="post" action="/admin/especialidad">${input("nombre", "Nombre", "", "text", "required")}${input("color", "Color", "#238a94", "color")}${select(
        "activo",
        "Estado",
        [
          { id: 1, nombre: "Activa" },
          { id: 0, nombre: "Inactiva" },
        ],
        1,
      )}<button type="submit">Guardar especialidad</button></form>`,
    );
  }
  return page(u, "Policlínicos y especialidades", c);
}
function pacientes({ u, lista, ctx, citas = [], q }) {
  const buscar = (q.get("q") || "").toLowerCase(),
    filas = lista.filter((p) =>
      `${p.nombre} ${p.rut} ${p.telefono}`.toLowerCase().includes(buscar),
    );
  return page(
    u,
    "Pacientes",
    cab(
      "Pacientes",
      "Datos administrativos de las personas asociadas a este lugar de atención.",
      btn("+ Registrar paciente", "/tens/pacientes?nuevo=1"),
    ) +
      `<form class="filters">${input("q", "Buscar por nombre, RUT completo o teléfono", q.get("q") || "", "search")}<button type="submit">Buscar</button></form>` +
      tabla(
        [
          "Nombre completo",
          "RUT",
          "Edad",
          "Teléfono",
          "Próxima gestión",
          "Estado",
          "Acciones",
        ],
        filas.map((p) => [
          p.nombre,
          p.rut,
          p.fechaNacimiento ? edad(p.fechaNacimiento) : "Sin registrar",
          p.telefono,
          (() => { const b = citas.filter(c => c.rut === p.rut && c.estadoReserva === "ACTIVA").map(c => ctx.bloques.get(c.idBloque)).filter(b => b && b.fecha >= hoy()).sort((a,b) => (a.fecha+a.hora).localeCompare(b.fecha+b.hora))[0]; return b ? b.fecha+" · "+b.hora : "Sin reserva próxima"; })(),
          raw(
            badge(
              p.activo === false
                ? "Inactivo"
                : edad(p.fechaNacimiento) < 18
                  ? "Menor de edad"
                  : !p.telefono
                    ? "Datos pendientes"
                    : "Activo",
            ),
          ),
          raw(
            btn(
              "Abrir ficha",
              "/tens/ficha?rut=" + encodeURIComponent(p.rut),
              true,
            ) +
              btn(
                "Reservas",
                "/tens/ficha?tab=reservas&rut=" + encodeURIComponent(p.rut),
                true,
              ) +
              btn(
                "Editar",
                "/tens/pacientes/editar?rut=" + encodeURIComponent(p.rut),
                true,
              ),
          ),
        ]),
      ),
  );
}
function ficha({ u, p, ctx, citas, documentos, mensajes, op, q }) {
  const tab = q.get("tab") || "resumen",
    rut = p.rut,
    link = (t) => "/tens/ficha?" + new URLSearchParams({ rut, tab: t });
  let c =
    cab(
      E(p.nombre),
      `RUT ${E(p.rut)} · ${edad(p.fechaNacimiento)} años · ${E(ctx.sedes.get(p.lugarHabitual || u.idPoliclinico)?.nombre)}`,
      btn(
        "Editar datos",
        "/tens/pacientes/editar?rut=" + encodeURIComponent(rut),
        true,
      ) + btn("Nueva reserva", "/tens/agendar?rut=" + encodeURIComponent(rut)),
    ) +
    `<h3>Ficha del paciente</h3><div class="tabs">${[
      ["resumen", "Resumen"],
      ["reservas", "Reservas"],
      ["documentos", "Documentos"],
      ["responsable", "Responsable o tutor"],
      ["comunicaciones", "Comunicaciones"],
    ]
      .map(([k, t]) => btn(t, link(k), tab !== k))
      .join("")}</div>`;
  if (tab === "resumen")
    c += panel(
      "Datos personales",
      `<dl class="details-grid">${[
        ["Estado", p.activo === false ? "Inactivo" : "Activo"],
        ["Nombre", p.nombre],
        ["RUT", p.rut],
        ["Nacimiento", p.fechaNacimiento],
        ["Teléfono", p.telefono],
        ["Correo", p.correo || "Sin registrar"],
        ["Dirección", p.direccion],
        ["Contacto preferido", p.contactoPreferido || "Teléfono"],
      ]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${E(v)}</dd></div>`)
        .join(
          "",
        )}</dl><div class="metric-strip"><div><b>${citas.length}</b>Reservas</div><div><b>${citas.filter((c) => c.asistencia === "ASISTIO").length}</b>Asistencias</div><div><b>${citas.filter((c) => c.asistencia === "NO_ASISTIO").length}</b>Ausencias</div></div><form method="post" action="/tens/paciente/preferencias" class="form-grid">${hidden({ rut })}${select("contactoPreferido", "Contacto preferido", opcionesTexto(["Teléfono", "WhatsApp", "Correo"]), p.contactoPreferido || "Teléfono")}<label class="check"><input type="checkbox" name="consentimientoComunicaciones" value="1" ${p.consentimientoComunicaciones ? "checked" : ""}>Consentimiento para comunicaciones administrativas</label><button type="submit">Guardar preferencias</button></form><div class="actions">${post("/tens/paciente/desactivar", { rut }, p.activo === false ? "Activar" : "Desactivar", true)}</div>`,
    );
  if (tab === "reservas")
    c += panel(
      "Historial administrativo de reservas",
      tabla(
        ["Fecha", "Hora", "Profesional", "Estado", "Acceso"],
        citas.map((c) => {
          const b = ctx.bloques.get(c.idBloque);
          return [
            b?.fecha,
            b?.hora,
            ctx.profs.get(b?.idProfesional)?.nombre,
            estado(c, u.rol === "TELEMEDICINA", op),
            raw(btn("Ver reserva", "/tens/reserva?idCita=" + c.id, true)),
          ];
        }),
      ),
    );
  if (tab === "responsable")
    c += panel(
      "Responsable o tutor",
      p.responsable
        ? `<dl class="details-grid">${Object.entries(p.responsable)
            .map(([k, v]) => `<div><dt>${E(k)}</dt><dd>${E(v)}</dd></div>`)
            .join("")}</dl>`
        : "<p>No hay responsable registrado.</p>",
    );
  if (tab === "documentos")
    c += panel(
      "Documentos administrativos",
      `<p>${documentos.length} documentos · ${documentos.filter((d) => !d.verificado && !d.archivado).length} pendientes de revisión</p>${btn("Adjuntar documento", "/tens/documentos?rut=" + encodeURIComponent(rut))}${tabla(
        ["Fecha", "Tipo", "Vigencia", "Estado", "Archivo", "Acciones"],
        documentos.map((d) => [
          d.fecha,
          d.tipo,
          d.vigencia || "Sin fecha",
          d.archivado
            ? "Archivado"
            : d.vigencia && d.vigencia < hoy()
              ? "Vencido"
              : d.verificado
                ? "Validado"
                : "Pendiente de revisión",
          d.adjunto
            ? raw(
                `<a href="/tens/documentos/archivo?id=${d.id}&ver=1" target="_blank">Ver / Descargar</a>`,
              )
            : "Sin archivo",
          raw(
            post("/tens/documentos/archivar", { id: d.id }, "Archivar", true) +
              btn(
                "Reemplazar",
                "/tens/documentos?reemplazar=" +
                  d.id +
                  "&rut=" +
                  encodeURIComponent(rut),
                true,
              ),
          ),
        ]),
      )}`,
    );
  if (tab === "comunicaciones")
    c += panel(
      "Comunicaciones",
      tabla(
        ["Fecha", "Canal", "Estado", "Responsable"],
        mensajes.map((m) => [m.fecha, m.canal, m.estado, m.responsable]),
      ),
    );
  return page(u, "Ficha del paciente", c);
}
function reserva({ u, ctx, c, b, op, admin, volverAgenda }) {
  const p = ctx.profs.get(b.idProfesional),
    s = ctx.sedes.get(op.sedeBloque(b, p)),
    tele = !!s?.telemedicina;
  let enlaceTelemedicina = "";
  if (tele && c && !admin) {
    const envio = op.estadoEnvioEnlace(c);
    const datos = { idCita: c.id, ...(volverAgenda ? { volverAgenda } : {}) };
    const solicitar = c.enlace && c.estadoReserva === "ACTIVA" && envio.estado !== "Pendiente de envío"
      ? post("/tens/comunicacion", {
          ...datos, canal: "Correo", tipo: "Enlace de atención", origen: "reserva",
        }, "Solicitar envío por correo", true)
      : "";
    enlaceTelemedicina = panel(
      "Enlace de Telemedicina",
      `<p>${badge(envio.estado)}</p>` +
        (envio.detalle ? `<p class="muted">${E(envio.detalle)}</p>` : "") +
        `<form class="form-grid" method="post" action="/tens/enlace">${hidden(datos)}${input(
          "enlace", "Enlace de atención", c.enlace || "", "url", "required",
        )}<button type="submit">Guardar enlace</button></form>` +
        (c.enlace
          ? `<div class="actions"><a href="${E(c.enlace)}" target="_blank" rel="noopener">Abrir atención</a>${solicitar}</div>`
          : ""),
    );
  }
  return page(
    u,
    admin ? "Detalle del cupo" : "Detalle de reserva",
    cab(
      admin ? "Detalle del cupo" : "Detalle de reserva",
      `${E(b.fecha)} · ${E(b.hora)} · ${E(s?.nombre)}`,
      !admin && volverAgenda ? btn("Volver a la agenda", volverAgenda, true) : "",
    ) +
      panel(
        c ? "Reserva" : "Cupo disponible",
        `<dl class="details-grid">${[
          ["Fecha", b.fecha],
          ["Hora", b.hora],
          ["Profesional", p.nombre],
          ["Especialidad", b.especialidad || p.especialidad],
          ["Lugar", s?.nombre],
          [
            "Estado",
            c
              ? admin
                ? `Reservado · ${estado(c, tele, op)}`
                : estado(c, tele, op)
              : b.publicado
                ? "Disponible"
                : b.estado || "Sin publicar",
          ],
          ...(c
            ? [
                ["Paciente", ctx.pacientes.get(c.rut)?.nombre],
                ["RUT", c.rut],
              ]
            : []),
        ]
          .map(([k, v]) => `<div><dt>${k}</dt><dd>${E(v)}</dd></div>`)
          .join(
            "",
          )}</dl>${!c && !admin ? btn("Reservar este cupo", "/tens/agendar?idBloque=" + b.id) : ""}${admin && c ? `<div class="actions">${btn('Abrir reserva','/admin/cupo?idCita='+c.id,true)}${btn('Cambio institucional','/admin/cambios',true)}</div><details><summary>Reprogramar reserva</summary><form class="form-grid" method="post" action="/admin/reagendar">${hidden({idCita:c.id})}${select('idBloque','Hora alternativa',ctx.disponibles||[],'',x=>x.id,x=>x.fecha+' '+x.hora+' · '+ctx.profs.get(x.idProfesional)?.nombre)}${input('motivo','Motivo','','text','required')}<button type="submit">Registrar reprogramación</button></form></details>`:''}${admin && !c ? `<form class="actions" method="post" action="/admin/cupo/estado">${hidden({ idBloque: b.id })}<button name="estado" value="Disponible">Publicar / disponibilizar</button><button class="sec" name="estado" value="Bloqueado">Bloquear</button><button class="sec" name="estado" value="Sin publicar">Guardar sin publicar</button></form>` : ""}${
          c && !admin
            ? `<div class="actions">${[
                "Confirmada",
                tele ? "Conectado" : "Llegó",
                tele ? "Atendida" : "En sala",
                "Atendida",
                tele ? "No se conectó" : "No asistió",
              ]
                .filter((x, i, a) => a.indexOf(x) === i)
                .map((t) =>
                  post("/tens/flujo", {
                    idCita: c.id, estado: t, ...(volverAgenda ? { volverAgenda } : {}),
                  }, t, true),
                )
                .join(
                  "",
                )}${btn("Ficha del paciente", "/tens/ficha?rut=" + encodeURIComponent(c.rut), true)}</div><details><summary>Reagendar</summary><form class="form-grid" method="post" action="/tens/reagendar">${hidden({ idCita: c.id })}${select(
                "idBloque",
                "Hora alternativa",
                ctx.disponibles || [],
                "",
                (x) => x.id,
                (x) =>
                  `${x.fecha} ${x.hora} · ${ctx.profs.get(x.idProfesional)?.nombre}`,
              )}${input("motivo", "Motivo", "", "text", "required")}<button type="submit">Confirmar reprogramación</button></form></details><details><summary>Registrar cancelación solicitada por el paciente</summary><form class="form-grid" method="post" action="/tens/cancelar">${hidden({ idCita: c.id })}${input("motivo", "Motivo de solicitud", "", "text", "required")}${select("canal", "Canal", opcionesTexto(["WhatsApp", "Llamada", "Presencial"]))}${select("destino", "Horario liberado", opcionesTexto(["Disponible", "Bloqueado"]))}<button type="submit">Registrar cancelación</button></form></details>`
            : ""
        }`,
      ) + enlaceTelemedicina,
  );
}
function espera({ u, ctx, lista, q, admin = false }) {
  const filtro = (q.get("q") || "").toLowerCase(),
    esp = q.get("esp") || "",
    prioridad = q.get("prioridad") || "",
    est = q.get("estado") || "",
    prof = q.get("prof") || "";
  const filas = lista
    .filter(
      (e) =>
        (!filtro ||
          `${ctx.pacientes.get(e.rut)?.nombre} ${e.rut}`
            .toLowerCase()
            .includes(filtro)) &&
        (!esp || e.especialidad === esp) &&
        (!prioridad || e.prioridad === prioridad) &&
        (!est || (e.estadoOperativo || "Pendiente") === est) &&
        (!prof || e.cupos.some((b) => String(b.idProfesional) === prof)),
    )
    .sort((a, b) => a.registradaEn.localeCompare(b.registradaEn));
  return page(
    u,
    admin ? "Supervisión de lista de espera" : "Lista de espera",
    cab(
      admin ? "Supervisión de lista de espera" : "Lista de espera",
      "El paciente permanece en la lista aunque no responda.",
    ) +
      `<form class="filters">${input("q", "Paciente / RUT", q.get("q") || "", "search")}${select("esp", "Especialidad", [{ id: "", nombre: "Todas" }, ...opcionesTexto([...new Set(lista.map((e) => e.especialidad))])], esp)}${select("prof", "Profesional", [{ id: "", nombre: "Todos" }, ...ctx.listaProfs], prof)}${select("prioridad", "Prioridad", [{ id: "", nombre: "Todas" }, ...opcionesTexto(["Alta", "Media", "Normal"])], prioridad)}${select("estado", "Estado", [{ id: "", nombre: "Todos" }, ...opcionesTexto(["Pendiente", "Contactado", "Hora ofrecida", "Reservado", "No responde"])], est)}<button type="submit">Filtrar · mayor espera</button></form>` +
      tabla(
        [
          "Paciente",
          "RUT",
          "Edad",
          "Especialidad",
          "Preferencia",
          "Días de espera",
          "Prioridad",
          "Estado",
          "Cupos / acciones",
        ],
        filas.map((e) => [
          ctx.pacientes.get(e.rut)?.nombre,
          e.rut,
          edad(ctx.pacientes.get(e.rut)?.fechaNacimiento),
          e.especialidad,
          e.preferencia || "Cualquier horario",
          Math.max(
            0,
            Math.floor(
              (Date.parse(hoy()) - Date.parse(e.registradaEn)) / 864e5,
            ),
          ),
          e.prioridad || "Normal",
          e.estadoOperativo || "Pendiente",
          raw(
            admin
              ? `${e.cupos.length} cupos compatibles`
              : `<form method="post" action="/tens/espera/gestion">${hidden({ idSolicitud: e.id })}<select name="estado" aria-label="Resultado del contacto">${opcionesTexto(
                  ["Contactado", "Hora ofrecida", "No responde"],
                )
                  .map((x) => `<option>${x.nombre}</option>`)
                  .join(
                    "",
                  )}</select><select name="canal" aria-label="Canal"><option>WhatsApp</option><option>Llamada</option></select><button type="submit">Registrar contacto</button></form>${e.cupos.length ? `<form method="post" action="/tens/espera/asignar">${hidden({ idSolicitud: e.id })}<select name="idBloque" aria-label="Cupo compatible">${e.cupos.map((b) => `<option value="${b.id}">${E(b.fecha)} ${E(b.hora)} · ${E(ctx.profs.get(b.idProfesional)?.nombre)}</option>`).join("")}</select><button type="submit">Reservar</button></form>` : btn("Buscar hora", "/tens/agenda?esp=" + encodeURIComponent(e.especialidad), true)}`,
          ),
        ]),
      ) +
      (admin
        ? ""
        : panel(
            "Agregar a la lista de espera",
            `<form class="form-grid" method="post" action="/tens/espera">${input("rut", "RUT del paciente", "", "text", "required")}${hidden({ idPoliclinico: u.idPoliclinico })}${select("especialidad", "Especialidad", opcionesTexto(ctx.especialidades || []))}${select("prioridad", "Prioridad", opcionesTexto(["Normal", "Media", "Alta"]))}${input("preferencia", "Preferencia de horario")}<button type="submit">Registrar</button></form>`,
          )),
  );
}
module.exports = {
  E,
  hidden,
  input,
  select,
  opcionesTexto,
  btn,
  post,
  cab,
  panel,
  badge,
  page,
  errorPage,
  estado,
  calendario,
  bloqueNuevo,
  equipo,
  lugares,
  pacientes,
  ficha,
  reserva,
  espera,
};

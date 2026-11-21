"use strict";
const { pagina } = require("./layout");
const { esc, tabla, raw, opciones } = require("./componentesComunes");
const { hoy, sumarDias, lunesDe } = require("../herramientas/tiempo");
const { edad } = require("../services/PacienteServicio");
const { fechaValida, minutos } = require("../services/OperacionServicio");
const { ico } = require("./iconos");
const { infoSede } = require("../models/informacionDeSedes");
const { especialidadTieneLista } = require("../services/EsperaServicio");
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
const cab = (sub, acciones = "", titulo = "") =>
  `<div class="work-heading"><div>${titulo ? `<h2>${titulo}</h2>` : ""}<p>${sub}</p></div>${acciones ? `<div class="actions">${acciones}</div>` : ""}</div>`;
const panel = (t, c) =>
  `<section class="work-panel"><div class="panel-heading"><h3>${t}</h3></div>${c}</section>`;
const badge = (t) =>
  `<span class="status ${/Disponible|Confirmada|Atendida|Activo|Validado|Vigente|Conectado|Entregado|Enviado|Enlace enviado/.test(t) ? "green" : /Bloqueado|Cancelada|Error|Rechazado|No asistió|Vencido|No se conectó/.test(t) ? "red" : "amber"}">${E(t)}</span>`;
const chipsEsp = (lista, max = 3) => {
  const chip = (e) => `<li class="esp-chip">${E(e)}</li>`;
  if (!lista.length) return `<p class="muted">Sin especialidades registradas</p>`;
  const resto = lista.slice(max);
  return `<ul class="esp-chips" aria-label="Especialidades">${lista.slice(0, max).map(chip).join("")}</ul>${resto.length ? `<details class="esp-mas"><summary>+${resto.length} más</summary><ul class="esp-chips">${resto.map(chip).join("")}</ul></details>` : ""}`;
};
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
    `<p class="aviso err" role="alert">${E(e.message)}</p>${btn("Volver", volver, true)}`,
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
const duracion = (b) => Number(b.duracion) || 30;
const rangoHorario = (b) => {
  const fin = (minutos(b.hora) + duracion(b)) % (24 * 60);
  const pad = (n) => String(n).padStart(2, "0");
  return `${b.hora}–${pad(Math.floor(fin / 60))}:${pad(fin % 60)}`;
};
const ESTADOS_AGENDA = {
  "Disponible": ["disponible", "Disponible"],
  "Reservada": ["reservada", "Reservada"],
  "Pendiente": ["pendiente", "Pendiente de confirmación"],
  "Confirmada": ["confirmada", "Confirmada"],
  "Atendida": ["atendida", "Atendida"],
  "Cancelada": ["cancelada", "Cancelada"],
  "Bloqueado": ["bloqueado", "Bloqueada"],
  "Sin publicar": ["sin-publicar", "Sin publicar"],
  "No asistió": ["inasistencia", "No asistió"],
  "No se conectó": ["inasistencia", "No se conectó"],
  "Llegó": ["en-atencion", "Llegó"],
  "En sala": ["en-atencion", "En sala"],
  "Conectado": ["en-atencion", "Conectado"],
};
const estadoCupo = (b, op) => {
  if (b.bloqueado) return "Bloqueado";
  if (b.publicado) return "Disponible";
  const estado = op.meta?.bloques?.[b.id]?.estado ?? b.estado;
  return estado === "Bloqueado" ? "Bloqueado" : "Sin publicar";
};
const estadoAgenda = (b, c, flujo, op) => {
  if (!c) return estadoCupo(b, op);
  if (ESTADOS_AGENDA[flujo] && flujo !== "Pendiente") return flujo;
  if (c.estadoConfirmacion === "CONFIRMADA") return "Confirmada";
  return c.estadoConfirmacion === "PENDIENTE" ? "Pendiente" : "Reservada";
};
const etiquetaAgenda = (e) => ESTADOS_AGENDA[e]?.[1] || e;
const estadoVisible = (e) =>
  `<span class="agenda-status" data-estado="${ESTADOS_AGENDA[e]?.[0] || "sin-publicar"}">${E(etiquetaAgenda(e))}</span>`;
const fechaAgenda = (fecha, opciones) => new Date(fecha + "T12:00:00").toLocaleDateString("es-CL", opciones);
const minutosAhora = () => {
  const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Santiago", hour12: false, hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  return (h % 24) * 60 + m;
};
const ordenCronologico = (a, b) => a.b.hora.localeCompare(b.b.hora) || a.p.nombre.localeCompare(b.p.nombre, "es-CL");

function calendario({ u: usuario, ctx, citas, op: servicioOperacion, q: consulta, admin, mensaje }) {
  const fechaPedida = consulta.get("fecha");
  const tele = usuario.rol === "TELEMEDICINA";
  const estadosTele = ["Enlace pendiente", "Enlace guardado", "Pendiente de envío", "Enlace enviado", "Error de envío"];
  const estados = [
    ...Object.keys(ESTADOS_AGENDA).filter((e) =>
      admin || (tele ? !["Llegó", "En sala", "No asistió"].includes(e) : !["Conectado", "No se conectó"].includes(e)),
    ),
    "Reservado",
    ...(admin || tele ? estadosTele : []),
  ];
  const sede = admin ? String(ctx.listaSedes.find((s) => String(s.id) === consulta.get("sede"))?.id ?? "") : String(usuario.idPoliclinico);
  const vista = ["semana", "lista"].includes(consulta.get("vista")) ? consulta.get("vista") : "dia";
  const fecha = fechaValida(fechaPedida) ? fechaPedida : hoy();
  const inicio = vista === "semana" ? lunesDe(fecha) : fecha;
  const fin = vista === "semana" ? sumarDias(inicio, 6) : fecha;
  const fechas = Array.from({ length: vista === "semana" ? 7 : 1 }, (_, i) => sumarDias(inicio, i));
  const url = admin ? "/admin/agendas" : "/tens/agenda";
  const estadoF = estados.includes(consulta.get("estado")) ? consulta.get("estado") : "";
  const busqueda = (consulta.get("q") || "").trim().slice(0, 120);
  const nombreBuscado = normalizarBusqueda(busqueda);
  const rutBuscado = !admin && /^\d[\d.\s-]*k?$/i.test(busqueda)
    ? busqueda.replace(/[.\s-]/g, "").toLowerCase()
    : "";
  const enSede = (p) => !sede || fechas.some((f) => servicioOperacion.lugares(p, f).includes(+sede));
  const profesionales = ctx.listaProfs.filter((p) => p.activo && enSede(p));
  const especialidadesSede = new Set(profesionales.flatMap((p) => p.especialidades || [p.especialidad]));
  const especialidadPedida = consulta.get("esp") || "";
  const profesionalPedido = consulta.get("prof") || "";
  const sedeCambiada = admin && consulta.has("sedeOrigen") && consulta.get("sedeOrigen") !== sede;
  const esp = sedeCambiada && !especialidadesSede.has(especialidadPedida) ? "" : especialidadPedida;
  const especialidades = opcionesTexto([...especialidadesSede]);
  if (esp && !especialidadesSede.has(esp)) especialidades.push({ id: esp, nombre: `${esp} (sin disponibilidad)` });
  const seleccionPedida = new Set(profesionalPedido.split(","));
  const prof = sedeCambiada && profesionalPedido !== "ninguno"
    ? profesionales.filter((p) => seleccionPedida.has(String(p.id))).map((p) => p.id).join(",")
    : profesionalPedido;
  const seleccion = new Set(prof.split(","));
  const profs = profesionales.filter((p) =>
    (!esp || (p.especialidades || [p.especialidad]).includes(esp)) &&
    (!prof || seleccion.has(String(p.id))),
  );
  const idsProfs = new Set(profs.map((p) => p.id));
  const visibles = [...ctx.bloques.values()].filter((b) =>
    b.fecha >= inicio && b.fecha <= fin && idsProfs.has(b.idProfesional) &&
    (!sede || servicioOperacion.sedeBloque(b, ctx.profs.get(b.idProfesional)) === +sede) &&
    (!esp || (b.especialidad || ctx.profs.get(b.idProfesional)?.especialidad) === esp),
  );
  const activas = new Map();
  const canceladas = new Map();
  for (const c of citas) {
    if (c.estadoReserva === "ACTIVA") activas.set(c.idBloque, c);
    if (c.estadoReserva === "CANCELADA") {
      if (!canceladas.has(c.idBloque)) canceladas.set(c.idBloque, []);
      canceladas.get(c.idBloque).push(c);
    }
  }
  const entrada = (b, c, p, s) => {
    const flujo = c ? estado(c, !!s?.telemedicina, servicioOperacion) : "";
    const reemplazo = c?.idProfesionalReemplazo ? ctx.profs.get(c.idProfesionalReemplazo) : null;
    const envio = s?.telemedicina && c?.estadoReserva === "ACTIVA" && !c.asistencia
      ? estadosTele.includes(flujo) ? flujo : servicioOperacion.estadoEnvioEnlace(c).estado
      : "";
    return {
      b, c, p, s, flujo, envio, reemplazo,
      esp: b.especialidad || p.especialidad,
      nombre: c ? ctx.pacientes.get(c.rut)?.nombre || (admin ? "Reserva" : c.rut) : b.especialidad || p.especialidad,
      status: estadoAgenda(b, c, flujo, servicioOperacion),
    };
  };
  const todas = visibles.flatMap((b) => {
    const profesional = ctx.profs.get(b.idProfesional);
    const s = ctx.sedes.get(servicioOperacion.sedeBloque(b, profesional));
    const activa = activas.get(b.id);
    return [entrada(b, activa, profesional, s), ...(canceladas.get(b.id) || []).map((c) => entrada(b, c, profesional, s))];
  });
  const entradas = todas.filter(({ status, flujo, envio, c }) => {
    if (estadoF === "Reservado" && c?.estadoReserva !== "ACTIVA") return false;
    if (estadoF === "Pendiente" && status !== "Pendiente") return false;
    if (estadoF && !["Reservado", "Pendiente"].includes(estadoF) && ![status, flujo, envio].includes(estadoF)) return false;
    if (!busqueda) return true;
    if (!c) return false;
    const nombre = normalizarBusqueda(ctx.pacientes.get(c.rut)?.nombre);
    const rut = String(c.rut).replace(/[-.]/g, "").toLowerCase();
    return nombre.includes(nombreBuscado) || (!!rutBuscado && rut.includes(rutBuscado));
  }).sort(ordenCronologico);
  const filtrosActuales = { ...(admin ? { sede } : {}), esp, prof, estado: estadoF, q: busqueda, vista };
  const nav = (c = {}) => {
    const parametros = Object.entries({ ...filtrosActuales, fecha, ...c }).filter(([, valor]) => valor);
    return url + "?" + new URLSearchParams(parametros);
  };
  const volverAgenda = nav();
  const limpiar = url + "?" + new URLSearchParams({ vista, fecha });
  const detalleAgenda = ({ b, c }) => {
    const parametros = new URLSearchParams(c ? { idCita: c.id } : { idBloque: b.id });
    if (!admin) parametros.set("volverAgenda", volverAgenda);
    return (admin ? "/admin/cupo" : "/tens/reserva") + "?" + parametros;
  };
  const detalleEstado = ({ c, status, flujo, envio }) => [...new Set([
    flujo && flujo !== status && flujo !== "Pendiente" ? flujo : "",
    envio,
    c?.estadoConfirmacion === "SIN_RESPUESTA" && status === "Reservada" ? "Sin respuesta" : "",
  ].filter(Boolean))].join(" · ");
  const tarjeta = (e, semana, posicion = "") => {
    const { b, p, s, nombre, status } = e;
    const estadoTexto = etiquetaAgenda(status);
    const compacto = posicion && duracion(b) < 20;
    const etiquetaCorta = compacto && status === "Pendiente" ? "Por confirmar" : estadoTexto;
    const complemento = detalleEstado(e);
    const detalle = [p.nombre, e.esp, s?.nombre, complemento].filter(Boolean);
    const descripcion = [rangoHorario(b), nombre, estadoTexto, ...new Set(detalle)].join(" · ");
    const categoria = s && (!sede ? s.nombre : e.esp);
    const categoriaVisible = categoria && !compacto ? `<small class="schedule-location">
      <i class="color-dot" style="--lugar:${E(color(servicioOperacion, s.id, e.esp, !sede))}"></i>${E([categoria, complemento].filter(Boolean).join(" · "))}
    </small>` : "";
    return `<a class="schedule-block" style="${posicion}" href="${E(detalleAgenda(e))}" data-drawer
      ${compacto ? 'data-corto="true" ' : ""}data-estado="${ESTADOS_AGENDA[status][0]}" aria-label="${E(descripcion)}" title="${E(descripcion)}">
      <span class="schedule-time"><time datetime="${E(b.hora)}">${E(b.hora)}</time><span>${E(etiquetaCorta)}</span></span>
      <strong>${E(nombre)}</strong>${semana && !compacto ? `<small>${E(p.nombre)}</small>` : ""}${categoriaVisible}
    </a>`;
  };
  const enCarriles = (lista) => {
    const finPorCarril = [];
    const distribucion = lista.map((e) => {
      const libre = finPorCarril.findIndex((fin) => fin <= minutos(e.b.hora));
      const carril = libre === -1 ? finPorCarril.length : libre;
      finPorCarril[carril] = minutos(e.b.hora) + duracion(e.b);
      return { ...e, carril };
    });
    return { distribucion, carriles: Math.max(1, finPorCarril.length) };
  };
  const cuadricula = () => {
    const esSemana = vista === "semana";
    const porColumna = new Map();
    for (const e of entradas) {
      const clave = esSemana ? e.b.fecha : e.p.id;
      if (!porColumna.has(clave)) porColumna.set(clave, []);
      porColumna.get(clave).push(e);
    }
    const columnas = esSemana
      ? fechas.map((f) => ({
          nombre: fechaAgenda(f, { weekday: "short", day: "numeric", month: "short" }),
          fecha: f,
          ...enCarriles(porColumna.get(f) || []),
        }))
      : profs.filter((p) => porColumna.has(p.id)).map((p) => ({
          ...p, ...enCarriles(porColumna.get(p.id)),
        }));
    const irADia = (col) => `<a href="${E(nav({ vista: "dia", fecha: col.fecha }))}"${col.fecha === fecha ? ' aria-current="date"' : ""}>${E(col.nombre)}</a>`;
    const semanaCompleta = esSemana && columnas.some(({ carriles }) => carriles > 4);
    if (semanaCompleta) {
      return `<div class="calendar-scroll calendar-scroll-week" id="agenda-horario" data-agenda-scroll tabindex="0" role="region" aria-label="Agenda semanal por día"><div class="calendar-week-lists">${columnas.map((col) =>
        `<section><h3>${irADia(col)}</h3><ul>${col.distribucion.map((e) => `<li>${tarjeta(e, true)}</li>`).join("") || '<li class="calendar-day-empty">Sin cupos</li>'}</ul></section>`,
      ).join("")}</div></div>`;
    }
    const desdeMin = entradas.reduce((min, { b }) => Math.min(min, minutos(b.hora)), 24 * 60);
    const hastaMin = entradas.reduce((max, { b }) => Math.max(max, minutos(b.hora) + duracion(b)), 0);
    const primeraHora = Math.floor(desdeMin / 60);
    const horas = Array.from({ length: Math.ceil(hastaMin / 60) - primeraHora }, (_, i) => primeraHora + i);
    const menorDuracion = entradas.reduce((min, { b }) => Math.min(min, duracion(b)), 30);
    const escala = Math.max(2.6, Math.min(5.1, 64 / menorDuracion));
    const anchoCarril = esSemana ? 212 : 228;
    const tracks = columnas.map(({ carriles }) => `minmax(${anchoCarril * carriles}px,${carriles}fr)`).join(" ");
    const anchoMinimo = 62 + anchoCarril * columnas.reduce((total, col) => total + col.carriles, 0);
    const encabezados = columnas.map((col) => {
      if (esSemana) return `<div class="professional-head">${irADia(col)}</div>`;
      const sedes = servicioOperacion.lugares(col, fecha).filter((id) => !sede || +id === +sede).map((id) => ctx.sedes.get(+id)?.nombre);
      return `<div class="professional-head">
        ${col.foto ? `<img class="professional-photo" src="${E(col.foto)}" alt="" loading="lazy">` : ""}
        <div><b>${E(col.nombre)}</b><small>${E(esp || col.especialidad)}</small><small>${E(sedes.filter(Boolean).join(" · "))}</small></div>
      </div>`;
    }).join("");
    const horasConCupos = new Set(entradas.flatMap(({ b }) => {
      const ini = minutos(b.hora), fin = ini + duracion(b) - 1;
      return Array.from({ length: Math.floor(fin / 60) - Math.floor(ini / 60) + 1 }, (_, i) => Math.floor(ini / 60) + i);
    }));
    const ahora = !esSemana && fecha === hoy() ? minutosAhora() : null;
    const filasAlto = horas.map((h) => horasConCupos.has(h) ? "var(--calendar-hour)" : "30px");
    const filas = horas.map((h, i) => {
      const vacia = !horasConCupos.has(h);
      const esAhora = ahora !== null && Math.floor(ahora / 60) === h;
      const linea = esAhora ? `<i class="calendar-now" style="top:${(((ahora % 60) / 60) * (vacia ? 30 : 60 * escala)).toFixed(1)}px" aria-hidden="true"></i>` : "";
      const celdas = columnas.map(({ distribucion, carriles }) =>
        `<div class="calendar-cell">${linea}${distribucion.filter(({ b }) => Math.floor(minutos(b.hora) / 60) === h).map((e) => {
          const posicion = `--slot-offset:${(minutos(e.b.hora) % 60) * escala}px;--slot-height:${duracion(e.b) * escala - 3}px;--lane-start:${e.carril * 100 / carriles}%;--lane-end:${(carriles - e.carril - 1) * 100 / carriles}%`;
          return tarjeta(e, esSemana, posicion);
        }).join("")}</div>`,
      ).join("");
      const hh = String(h).padStart(2, "0");
      const etiquetaAhora = esAhora ? `<small class="calendar-now-hora">${hh}:${String(ahora % 60).padStart(2, "0")}</small>` : "";
      return `<time class="calendar-hour${vacia ? " calendar-hour-vacia" : ""}" datetime="${hh}:00">${hh}:00${etiquetaAhora}</time>${celdas}`;
    }).join("");
    return `<div class="calendar-scroll" id="agenda-horario" data-agenda-scroll tabindex="0" role="region" aria-label="${esSemana ? "Agenda semanal por horario" : "Agenda diaria por profesional y horario"}"><div class="calendar-grid${esSemana ? " calendar-grid-week" : ""}" style="--agenda-tracks:${tracks};--agenda-min-width:${anchoMinimo}px;--calendar-hour:${60 * escala}px;grid-template-rows:auto ${filasAlto.join(" ")}"><div class="calendar-corner">Hora</div>${encabezados}${filas}</div></div>`;
  };
  const matrizSemana = () => {
    const porProf = new Map();
    for (const e of entradas) {
      if (e.status === "Cancelada") continue;
      if (!porProf.has(e.p.id)) porProf.set(e.p.id, { p: e.p, dias: new Map() });
      const dias = porProf.get(e.p.id).dias;
      if (!dias.has(e.b.fecha)) dias.set(e.b.fecha, new Map());
      const cupos = dias.get(e.b.fecha);
      const previo = cupos.get(e.b.id);
      cupos.set(e.b.id, previo === "res" ? "res" : e.c?.estadoReserva === "ACTIVA" ? "res" : e.status === "Disponible" ? "dis" : "blo");
    }
    const filas = [...porProf.values()].sort((x, y) => x.p.nombre.localeCompare(y.p.nombre, "es-CL")).map(({ p, dias }) => {
      const total = { res: 0, dis: 0, blo: 0 };
      const celdas = fechas.map((f) => {
        const cupos = dias.get(f);
        if (!cupos) return '<td class="mx-vacio" aria-label="Sin cupos">–</td>';
        const conteo = { res: 0, dis: 0, blo: 0 };
        for (const v of cupos.values()) conteo[v]++;
        for (const k of Object.keys(conteo)) total[k] += conteo[k];
        const t = conteo.res + conteo.dis + conteo.blo;
        const texto = `${conteo.res} de ${t} reservados · ${conteo.dis} disponibles · ${conteo.blo} sin ofrecer`;
        return `<td><a class="mx-celda" href="${E(nav({ vista: "dia", fecha: f, prof: p.id }))}" title="${E(texto)}" aria-label="${E(fechaAgenda(f, { weekday: "long", day: "numeric", month: "long" }) + ": " + texto)}">
          <span class="mx-n"><b>${conteo.res}</b> de ${t} reservados</span>
          <span class="mx-barra" aria-hidden="true"><i class="r" style="flex:${conteo.res}"></i><i class="d" style="flex:${conteo.dis}"></i><i class="b" style="flex:${conteo.blo}"></i></span></a></td>`;
      }).join("");
      const suma = total.res + total.dis + total.blo;
      return `<tr data-profesional="${E(p.id)}"><th scope="row"><b>${E(p.nombre)}</b><small>${E(p.especialidad)}</small><small class="mx-total">${total.res} de ${suma} reservados</small></th>${celdas}</tr>`;
    }).join("");
    const cab = fechas.map((f) => `<th scope="col"${f === hoy() ? ' class="hoy"' : ""}><a href="${E(nav({ vista: "dia", fecha: f }))}">${E(fechaAgenda(f, { weekday: "short", day: "numeric" }))}</a></th>`).join("");
    return `<div class="calendar-scroll" id="agenda-horario" tabindex="0" role="region" aria-label="Capacidad semanal por profesional"><table class="matriz-semana"><thead><tr><th scope="col">Profesional</th>${cab}</tr></thead><tbody>${filas}</tbody></table></div>
    <p class="mx-nota">Cada barra muestra reservados, disponibles y sin ofrecer. Pulsa un día para ver sus horas.</p>`;
  };
  const listaDelDia = () =>
    `<ul class="agenda-lista" aria-label="Cupos y reservas por hora">${entradas.map((e) => {
      const { b, c, p, s, nombre, status } = e;
      const descripcion = [c ? e.esp : "", p.nombre, admin && !sede ? s?.nombre : "", detalleEstado(e)].filter(Boolean).map(E).join(" · ");
      const llegadaPendiente = c?.estadoReserva === "ACTIVA" && !c.asistencia && !["Llegó", "En sala", "Conectado"].includes(status);
      const accion = !admin && llegadaPendiente
        ? post("/tens/flujo", { idCita: c.id, estado: tele ? "Conectado" : "Llegó", volverAgenda },
            tele ? "Marcar conexión" : "Registrar llegada", true)
        : "";
      return `<li class="agenda-fila">
        <time datetime="${E(b.hora)}">${E(b.hora)}</time>
        <div class="agenda-info"><strong>${E(nombre)}</strong><p>${descripcion}</p></div>
        <div class="actions">${estadoVisible(status)}${accion}<a class="btn sec" href="${E(detalleAgenda(e))}" data-drawer>${c ? "Ver reserva" : "Ver cupo"}</a></div>
      </li>`;
    }).join("")}</ul>`;
  const cambioVista = [["dia", "Día"], ["semana", "Semana"], ["lista", "Lista del día"]].map(([modo, nombre]) =>
    `<a class="agenda-view" href="${E(nav({ vista: modo }))}"${vista === modo ? ' aria-current="page"' : ""}>${nombre}</a>`,
  ).join("");
  const filtrosActivos = [admin ? sede : "", esp, prof, estadoF, busqueda].filter(Boolean).length;
  const seleccionados = prof ? profesionales.filter((p) => seleccion.has(String(p.id))).length : profesionales.length;
  const profesionalesFiltro = `<div class="agenda-prof-filter">
    <span id="filtro-profesionales">Profesionales</span>
    <details class="multi-filter"><summary aria-labelledby="filtro-profesionales filtro-profesionales-valor">
      <span id="filtro-profesionales-valor" data-prof-count>${seleccionados === profesionales.length ? "Todos" : seleccionados + " seleccionados"}</span>
    </summary><div>
      <div class="actions"><button type="button" class="sec" data-elegir-prof="todos">Todos</button><button type="button" class="sec" data-elegir-prof="ninguno">Ninguno</button></div>
      ${profesionales.map((p) =>
        `<label class="check"><input type="checkbox" data-prof="${p.id}"${!prof || seleccion.has(String(p.id)) ? " checked" : ""}>${E(p.nombre)}</label>`,
      ).join("") || "<p>Sin profesionales para este policlínico.</p>"}
    </div></details>
  </div>`;
  const estadoOpciones = estados.map((id) => ({ id, nombre: id === "Reservado" ? "Todas las reservas activas" : etiquetaAgenda(id) }));
  const filtros = `<form class="agenda-filter-form" method="get" action="${url}">
    ${hidden({ vista, fecha, ...(admin ? { sedeOrigen: sede } : {}) })}
    ${admin ? select("sede", "Policlínico", [{ id: "", nombre: "Toda la red" }, ...ctx.listaSedes], sede) : ""}
    ${select("esp", "Especialidad", [{ id: "", nombre: "Todas" }, ...especialidades], esp)}
    ${profesionalesFiltro}${hidden({ prof })}
    ${select("estado", "Estado", [{ id: "", nombre: "Todos" }, ...estadoOpciones], estadoF)}
    ${input("q", admin ? "Buscar paciente" : "Nombre o RUT", busqueda, "search")}
    <div class="agenda-filter-actions"><button type="submit">Aplicar</button>${btn("Limpiar filtros", limpiar, true)}</div>
  </form>`;
  const acciones = admin
    ? btn(ico("mas") + "Crear bloque horario", "/admin/bloque/nuevo")
    : btn(ico("mas") + "Nueva reserva", "/tens/agendar");
  const accionesAdmin = admin
    ? `<nav class="agenda-acciones" aria-label="Acciones de agenda">${[
        ["/admin/cupos/rango", "Cupos por rango"],
        ["/admin/cambios", "Cambios de agenda"],
        ["/admin/cancelaciones", "Cancelaciones"],
      ].map(([href, texto]) => `<a class="btn sec" href="${href}">${texto}</a>`).join("")}</nav>`
    : "";
  const desplazamiento = vista === "semana" ? 7 : 1;
  const salto = (dias, icono, titulo) =>
    `<a class="btn sec agenda-nav-icon" href="${E(nav({ fecha: sumarDias(fecha, dias) }))}" aria-label="${titulo}" title="${titulo}">${ico(icono)}</a>`;
  const textoFecha = vista === "semana"
    ? `${fechaAgenda(inicio, { day: "numeric", month: "short" })} – ${fechaAgenda(fin, { day: "numeric", month: "long", year: "numeric" })}`
    : fechaAgenda(inicio, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const totalCupos = new Set(entradas.filter(({ status }) => status !== "Cancelada").map(({ b }) => b.id)).size;
  const totalReservas = entradas.filter(({ c }) => c?.estadoReserva === "ACTIVA").length;
  const totalCanceladas = entradas.filter(({ status }) => status === "Cancelada").length;
  const contadores = [
    estadoF !== "Cancelada" && `${totalCupos} ${totalCupos === 1 ? "cupo" : "cupos"}`,
    estadoF !== "Cancelada" && `${totalReservas} ${totalReservas === 1 ? "reserva activa" : "reservas activas"}`,
    (totalCanceladas > 0 || estadoF === "Cancelada") && `${totalCanceladas} ${totalCanceladas === 1 ? "reserva cancelada" : "reservas canceladas"}`,
  ].filter(Boolean).join(" · ");
  const cupoUnico = (f) => [...new Map(todas.filter((e) => e.status !== "Cancelada" && f(e)).map((e) => [e.b.id, e])).values()].length;
  const resumenAdmin = admin ? `<nav class="agenda-resumen" aria-label="Cupos por estado">${[
    ["Disponibles", "Disponible", "disponible", cupoUnico((e) => e.status === "Disponible")],
    ["Reservados", "Reservado", "reservada", todas.filter((e) => e.c?.estadoReserva === "ACTIVA").length],
    ["Bloqueados", "Bloqueado", "bloqueado", cupoUnico((e) => e.status === "Bloqueado")],
    ["Sin publicar", "Sin publicar", "sin-publicar", cupoUnico((e) => e.status === "Sin publicar")],
  ].map(([rotulo, valor, clave, n]) => {
    const activo = estadoF === valor;
    return `<a href="${E(nav({ estado: activo ? "" : valor }))}" data-estado="${clave}"${activo ? ' aria-current="true"' : ""}><b>${n}</b> ${rotulo}</a>`;
  }).join("")}</nav>` : "";
  const leyenda = ["Disponible", "Reservada", "Pendiente", "Confirmada", "Atendida", "Cancelada", "Bloqueado", "Sin publicar"].map((e) => `<li>${estadoVisible(e)}</li>`).join("");
  const ubicacion = ctx.sedes.get(+sede)?.nombre || (admin ? "Toda la red de atención" : "Policlínico asignado");
  const etiquetasFiltro = [
    esp,
    prof && (seleccionados === 1 ? profesionales.find((p) => seleccion.has(String(p.id)))?.nombre : `${seleccionados} profesionales`),
    estadoOpciones.find((e) => e.id === estadoF)?.nombre,
    busqueda && `Paciente: ${busqueda}`,
  ].filter(Boolean);
  const aplicados = filtrosActivos ? `<div class="agenda-aplicados" aria-label="Filtros activos">
    ${etiquetasFiltro.length ? `<ul>${etiquetasFiltro.map((etiqueta) => `<li>${E(etiqueta)}</li>`).join("")}</ul>` : ""}
    <a href="${E(limpiar)}">Limpiar filtros</a></div>` : "";
  const vacio = `<div class="agenda-empty"><strong>${filtrosActivos ? "Ningún cupo coincide con los filtros" : vista === "semana" ? "Esta semana no tiene cupos" : "Este día no tiene cupos"}</strong>
    <p>${filtrosActivos ? "Prueba con otros filtros o cambia la fecha." : "Elige otra fecha para consultar cupos y reservas."}</p>
    ${filtrosActivos ? btn("Ver todos los cupos", limpiar, true) : fecha !== hoy() ? btn("Ir a hoy", nav({ fecha: hoy() }), true) : ""}</div>`;
  const controlesDesplazamiento = `<div class="agenda-desplazamiento" data-agenda-scroll-controls hidden>
    <button type="button" class="btn sec agenda-nav-icon" data-agenda-scroll-dir="-1" aria-controls="agenda-horario" aria-label="Desplazar calendario a la izquierda" title="Desplazar a la izquierda">${ico("chevIzq")}</button>
    <button type="button" class="btn sec agenda-nav-icon" data-agenda-scroll-dir="1" aria-controls="agenda-horario" aria-label="Desplazar calendario a la derecha" title="Desplazar a la derecha">${ico("chevDer")}</button></div>`;
  return page(usuario, admin ? "Agendas y cupos" : "Agendas y reservas",
    `<div class="agenda-page" data-agenda-context="${E(volverAgenda)}">
    <div class="agenda-heading"><p>${ico("ubicacion")}${E(ubicacion)}</p><div class="actions">${acciones}${accionesAdmin}</div></div>
    <section class="work-panel agenda-panel" aria-label="Calendario y filtros">
      <div class="agenda-barra" data-agenda-toolbar>
      <div class="calendar-toolbar"><div class="agenda-date-control">
        <h2>${E(textoFecha)}</h2>
        <div class="agenda-paging">${salto(-desplazamiento, "chevIzq", vista === "semana" ? "Semana anterior" : "Día anterior")}${btn("Hoy", nav({ fecha: hoy() }), true)}${salto(desplazamiento, "chevDer", vista === "semana" ? "Semana siguiente" : "Día siguiente")}</div>
      </div>
        <nav class="agenda-views" aria-label="Vista de la agenda">${cambioVista}</nav>
      </div>
      <div class="agenda-tools">
        <div class="agenda-tools-left">
          <details class="agenda-filtros" name="herramientas-agenda" data-filtros-agenda><summary class="btn sec">${ico("filtro")}Filtros${filtrosActivos ? ` <span class="agenda-filter-count">${filtrosActivos}</span>` : ""}</summary>${filtros}</details>
          <details class="agenda-fecha" name="herramientas-agenda"><summary class="btn sec">${ico("calendario")}Ir a fecha</summary><form class="agenda-date-form" method="get" action="${url}">${hidden(filtrosActuales)}<input type="date" name="fecha" aria-label="Fecha de agenda" value="${E(fecha)}" required><button type="submit" class="btn">Ir</button></form></details>
        </div>
        <div class="agenda-tools-right">
          ${admin ? resumenAdmin : `<p class="agenda-count">${E(contadores)}</p>
          <details class="agenda-estados" name="herramientas-agenda"><summary class="btn sec">Estados</summary><ul class="calendar-legend" aria-label="Estados de la agenda">${leyenda}</ul></details>`}
          ${entradas.length && vista !== "lista" && !(admin && vista === "semana") ? controlesDesplazamiento : ""}
        </div>
      </div>
      </div>
      ${aplicados}
      ${entradas.length ? vista === "lista" ? listaDelDia() : admin && vista === "semana" ? matrizSemana() : cuadricula() : vacio}
    </section>
    ${!admin ? panel("Próximos cupos libres", `<div class="available-slots">${[...ctx.bloques.values()]
      .filter((b) => b.fecha >= hoy() && servicioOperacion.sedeBloque(b, ctx.profs.get(b.idProfesional)) === +sede && b.publicado && !activas.has(b.id))
      .slice(0, 8).map((b) => btn(`${E(b.fecha)} · ${E(b.hora)}`,
        "/tens/agendar?" + new URLSearchParams({ fecha: b.fecha, idBloque: b.id }), true)).join("") || "<p>Sin cupos libres.</p>"}</div>`) : ""}
    <dialog class="drawer" data-agenda-drawer aria-labelledby="agenda-drawer-title">
      <header class="drawer-header"><h2 id="agenda-drawer-title">Detalle de agenda</h2><button class="btn sec drawer-close" type="button" data-cerrar-detalle>Cerrar</button></header>
      <p class="drawer-saving" data-detalle-guardado role="status"></p>
      <div class="drawer-content" data-detalle-contenido></div>
    </dialog></div>`,
    mensaje,
  );
}
function bloqueNuevo({ u, ctx, plan, d: datos = {} }) {
  const profesionalesFiltrados = ctx.listaProfs.filter(
    (p) => p.activo && !["TENS", "TONS"].includes(p.tipo),
  );
  const form = `<form class="form-grid" method="post" action="/admin/bloque/revisar">${select("idPoliclinico", "Lugar de atención", ctx.listaSedes, datos.idPoliclinico)}${select("especialidad", "Especialidad", opcionesTexto([...new Set(profesionalesFiltrados.map((p) => p.especialidad))]), datos.especialidad)}${select(
    "idProfesional",
    "Profesional",
    profesionalesFiltrados,
    datos.idProfesional,
    (p) => p.id,
    (p) => `${p.nombre} · ${p.especialidad}`,
  )}${select(
    "repeticion",
    "Repetición",
    opcionesTexto(["unica", "semanal"]),
    datos.repeticion || "semanal",
    (x) => x.id,
    (x) => (x.id === "unica" ? "Fecha única" : "Semanal"),
  )}${input("desde", "Fecha inicial", datos.desde || hoy(), "date", "required")}${input("hasta", "Fecha final", datos.hasta || sumarDias(hoy(), 7), "date", "required")}${input("horaInicio", "Hora inicial", datos.horaInicio || "09:00", "time", "required")}${input("horaFin", "Hora final", datos.horaFin || "13:00", "time", "required")}${input("duracion", "Duración de atención (min)", datos.duracion || 30, "number", 'min="10" max="120" required')}<fieldset class="full"><legend>Días de atención</legend><div class="actions">${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((x, i) => `<label class="check"><input type="checkbox" name="dia${i}" value="1" ${datos[`dia${i}`] === "1" || (!datos.desde && i < 5) ? "checked" : ""}>${x}</label>`).join("")}</div></fieldset><button type="submit">Revisar resumen y conflictos</button></form>`;
  return page(
    u,
    "Crear bloque horario",
    cab(
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
                : `<form class="actions" method="post" action="/admin/bloque/guardar">${hidden(datos)}<button type="submit" name="publicado" value="0" class="sec">Guardar sin publicar</button><button type="submit" name="publicado" value="1">Publicar ahora</button></form>`
            }`,
          )
        : ""),
  );
}
function equipo({ u, ctx, op: servicioOperacion, q: consulta, d, revision }) {
  const filtro = (consulta.get("q") || "").toLowerCase(),
    sede = consulta.get("sede") || "",
    tipo = consulta.get("tipo") || "",
    esp = consulta.get("esp") || "",
    estadoF = consulta.get("estado") || "",
    vista = consulta.get("vista") || "tarjetas";
  const profesionalesFiltrados = ctx.listaProfs.filter(
    (p) =>
      (!filtro ||
        `${p.nombre} ${p.especialidad}`.toLowerCase().includes(filtro)) &&
      (!sede || servicioOperacion.lugares(p).includes(+sede)) &&
      (!tipo || (p.tipo || "Profesional") === tipo) &&
      (!esp || (p.especialidades || [p.especialidad]).includes(esp)) &&
      (!estadoF || String(p.activo ? 1 : 0) === estadoF),
  );
  const editar = consulta.get("editar"),
    profesional = d || (editar ? ctx.profs.get(+editar) : null),
    nuevo = consulta.get("nuevo");
  let cabecera =
    cab(
      "Personas, especialidades y lugares asignados.",
      btn("+ Agregar integrante", "/admin/profesionales?nuevo=1"),
    ) +
    `<form class="filters">${input("q", "Buscar", consulta.get("q") || "", "search")}${select("sede", "Lugar", [{ id: "", nombre: "Seleccionar lugar…" }, ...ctx.listaSedes], sede)}${select("esp", "Especialidad", [{ id: "", nombre: "Seleccionar especialidad…" }, ...opcionesTexto([...new Set(ctx.listaProfs.map((p) => p.especialidad))])], esp)}${select("tipo", "Tipo", [{ id: "", nombre: "Seleccionar tipo…" }, ...opcionesTexto(["Médico", "Profesional", "TENS", "TONS"])], tipo)}${select(
      "estado",
      "Estado",
      [
        { id: "", nombre: "Seleccionar estado…" },
        { id: "1", nombre: "Activo" },
        { id: "0", nombre: "Inactivo" },
      ],
      estadoF,
    )}${select("vista", "Vista", opcionesTexto(["tarjetas", "tabla"]), vista)}<button type="submit">Filtrar</button></form>`;
  const acciones = (p) =>
    btn("Editar", `/admin/profesionales?editar=${p.id}`, true) +
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
  cabecera +=
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
          profesionalesFiltrados.map((p) => [
            p.nombre,
            p.tipo || "Profesional",
            (p.especialidades || [p.especialidad]).join(", "),
            servicioOperacion
              .lugares(p)
              .map((id) => ctx.sedes.get(id)?.nombre)
              .join(", "),
            p.activo ? "Activo" : "Inactivo",
            raw(acciones(p)),
          ]),
        )
      : `<div class="team-grid">${profesionalesFiltrados
          .map(
            (p) =>
              `<article class="team-card"><div class="actions">${thumb(p)}${badge(p.activo ? "Activo" : "Inactivo")}</div><h3>${E(p.nombre)}</h3><p>${E(p.profesion || p.tipo || "Profesional de salud")}</p><strong>${E((p.especialidades || [p.especialidad]).join(" · "))}</strong><p class="muted">⌖ ${E(
                servicioOperacion
                  .lugares(p)
                  .map((id) => ctx.sedes.get(id)?.nombre)
                  .join(" · "),
              )}</p><div class="actions">${acciones(p)}</div></article>`,
          )
          .join("")}</div>`;
  if (profesional || nuevo) {
    const v = profesional || {};
    cabecera += panel(
      profesional ? "Ficha del integrante" : "Nuevo integrante",
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
    cabecera += panel(
      "Reservas futuras afectadas",
      `<p><b>${revision.afectados.length}</b> reservas afectadas. Las reservas existentes conservan su lugar original.</p>${tabla(
        ["Reserva", "Paciente (RUT)", "Cupo"],
        revision.afectados.map((c) => [c.id, c.rut, c.idBloque]),
      )}${revision.afectados.length ? '<p class="aviso err">Reprograma estas reservas antes de retirar sus lugares asignados.</p>' : `<form method="post" action="/admin/equipo/guardar">${hidden(revision.datos)}<button type="submit">Confirmar asignación</button></form>`}`,
    );
  return page(u, "Equipo de salud", cabecera);
}
function lugares({ u, ctx, op: servicioOperacion, q, d }) {
  const tab = q.get("tab") || "lugares";
  let cabecera =
    cab(
      "Configuración de los seis policlínicos y Telemedicina.",
    ) +
    `<div class="tabs">${btn("Lugares de atención", "/admin/policlinicos?tab=lugares", tab !== "lugares")}${btn("Especialidades", "/admin/policlinicos?tab=especialidades", tab !== "especialidades")}</div>`;
  if (tab === "lugares") {
    cabecera += `<div class="locations-grid">${ctx.listaSedes
      .map((s) => {
        const metaSede = servicioOperacion.meta.sedes[s.id] || {},
          i = infoSede(s.id) || {},
          ps = ctx.listaProfs.filter((p) => servicioOperacion.lugares(p).includes(s.id));
        return `<article class="work-panel location" id="lugar-${E(s.id)}" tabindex="-1"><div class="panel-heading"><h3><i class="color-dot" style="background:${metaSede.color || "#238a94"}"></i>${E(s.nombre)}</h3>${badge(s.activo === false ? "Inactivo" : "Activo")}</div><p>${E(metaSede.direccion || i.direccion || "Atención remota")}</p><p class="muted">${ps.length} integrantes asignados</p>${chipsEsp(metaSede.especialidades || i.especialidades || [])}<div class="actions">${btn("Ver agenda", "/admin/agendas?sede=" + s.id, true)}${btn("Equipo", "/admin/profesionales?sede=" + s.id, true)}${btn("Editar", "/admin/policlinicos?editar=" + s.id, true)}</div></article>`;
      })
      .join("")}</div>`;
    const v = d || ctx.sedes.get(+q.get("editar")) || {};
    cabecera += panel(
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
        ...Object.keys(servicioOperacion.meta.especialidades),
      ]),
    ];
    cabecera += tabla(
      ["Especialidad", "Lugares", "Equipo", "Estado", "Lista de espera", "Color"],
      es.map((e) => {
        const metaEspecialidad = servicioOperacion.meta.especialidades[e] || {};
        return [
          e,
          ctx.listaSedes
            .filter((s) =>
              (
                servicioOperacion.meta.sedes[s.id]?.especialidades ||
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
          metaEspecialidad.activo === false ? "Inactiva" : "Activa",
          especialidadTieneLista(servicioOperacion.meta, e) ? "Sí" : "No",
          raw(
            `<form class="micro" method="post" action="/admin/especialidad">${hidden({ nombre: e, activo: metaEspecialidad.activo === false ? "0" : "1" })}<input aria-label="Color de ${E(e)}" type="color" name="color" value="${metaEspecialidad.color || "#238a94"}"><label class="check-mini"><input type="checkbox" name="listaEspera" value="1"${especialidadTieneLista(servicioOperacion.meta, e) ? " checked" : ""}> Tiene lista de espera</label><button type="submit">Guardar</button></form>`,
          ),
        ];
      }),
    );
    cabecera += panel(
      "Crear o actualizar especialidad",
      `<form class="form-grid" method="post" action="/admin/especialidad">${input("nombre", "Nombre", "", "text", "required")}${input("color", "Color", "#238a94", "color")}${select(
        "activo",
        "Estado",
        [
          { id: 1, nombre: "Activa" },
          { id: 0, nombre: "Inactiva" },
        ],
        1,
      )}${select(
        "listaEspera",
        "Tiene lista de espera",
        [
          { id: 0, nombre: "No" },
          { id: 1, nombre: "Sí" },
        ],
        0,
      )}<button type="submit">Guardar especialidad</button></form>`,
    );
  }
  return page(u, "Policlínicos y especialidades", cabecera);
}
function pacientes({ u, lista, ctx, citas = [], q: consulta }) {
  const buscar = (consulta.get("q") || "").toLowerCase();
  const proxima = (p) => citas.filter((c) => c.rut === p.rut && c.estadoReserva === "ACTIVA").map((c) => ctx.bloques.get(c.idBloque)).filter((b) => b && b.fecha >= hoy()).sort((x, y) => (x.fecha + x.hora).localeCompare(y.fecha + y.hora))[0];
  const FILTROS = [["proxima", "Con reserva próxima", (p) => !!proxima(p)], ["menor", "Menores de edad", (p) => p.fechaNacimiento && edad(p.fechaNacimiento) < 18], ["sin-telefono", "Sin teléfono", (p) => !p.telefono]];
  const rapido = FILTROS.find(([k]) => k === consulta.get("f"));
  const filas = lista.filter((p) =>
    `${p.nombre} ${p.rut} ${p.telefono}`.toLowerCase().includes(buscar) && (!rapido || rapido[2](p)),
  );
  const chips = `<nav class="chips-filtro" aria-label="Filtros rápidos">${FILTROS.map(([k, rotulo]) => {
    const activo = rapido?.[0] === k;
    const params = new URLSearchParams({ ...(consulta.get("q") ? { q: consulta.get("q") } : {}), ...(activo ? {} : { f: k }) });
    return `<a href="/tens/pacientes${params.toString() ? "?" + params : ""}"${activo ? ' aria-current="true"' : ""}>${rotulo}</a>`;
  }).join("")}</nav>`;
  return page(
    u,
    "Pacientes",
    cab(
      "Datos administrativos de las personas asociadas a este lugar de atención.",
      btn("+ Registrar paciente", "/tens/pacientes?nuevo=1"),
    ) +
      `<form class="filters filters-busqueda">${input("q", "Buscar por nombre, RUT completo o teléfono", consulta.get("q") || "", "search")}<button type="submit">Buscar</button>${rapido ? hidden({ f: rapido[0] }) : ""}</form>` +
      chips +
      `<p class="cuenta">${filas.length} ${filas.length === 1 ? "paciente" : "pacientes"}</p>` +
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
          raw(`<a class="paciente-link" href="/tens/ficha?rut=${encodeURIComponent(p.rut)}">${E(p.nombre)}</a>`),
          raw(E(p.rut), "dato-sec"),
          raw(E(p.fechaNacimiento ? edad(p.fechaNacimiento) : "Sin registrar"), "dato-sec"),
          raw(E(p.telefono || "—"), "dato-sec"),
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
            `<span class="acciones-icono"><a class="btn-icono" href="/tens/ficha?tab=reservas&amp;rut=${encodeURIComponent(p.rut)}" aria-label="Ver reservas de ${E(p.nombre)}" title="Ver reservas">${ico("calendario")}<span>Reservas</span></a><a class="btn-icono" href="/tens/pacientes/editar?rut=${encodeURIComponent(p.rut)}" aria-label="Editar a ${E(p.nombre)}" title="Editar">${ico("editar")}<span>Editar</span></a></span>`,
          ),
        ]),
        consulta.get("q") ? "No se encontraron pacientes con esa búsqueda. Revisa el nombre, el RUT completo o el teléfono." : "Aún no hay pacientes registrados en este lugar de atención.",
      ),
  );
}
function ficha({ u: usuario, p, ctx, citas, documentos, mensajes, op, q }) {
  const tab = q.get("tab") || "resumen",
    rut = p.rut,
    link = (t) => "/tens/ficha?" + new URLSearchParams({ rut, tab: t });
  let cabecera =
    cab(
      `RUT ${E(p.rut)} · ${edad(p.fechaNacimiento)} años · ${E(ctx.sedes.get(p.lugarHabitual || usuario.idPoliclinico)?.nombre)}`,
      btn(
        "Editar datos",
        "/tens/pacientes/editar?rut=" + encodeURIComponent(rut),
        true,
      ) + btn("Nueva reserva", "/tens/agendar?rut=" + encodeURIComponent(rut)),
      E(p.nombre),
    ) +
    `<div class="tabs">${[
      ["resumen", "Resumen"],
      ["reservas", "Reservas"],
      ["documentos", "Documentos"],
      ["responsable", "Responsable o tutor"],
      ["comunicaciones", "Comunicaciones"],
    ]
      .map(([k, t]) => btn(t, link(k), tab !== k))
      .join("")}</div>`;
  if (tab === "resumen")
    cabecera += panel(
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
    cabecera += panel(
      "Historial administrativo de reservas",
      tabla(
        ["Fecha", "Hora", "Profesional", "Estado", "Acceso"],
        citas.map((c) => {
          const bloque = ctx.bloques.get(c.idBloque);
          return [
            bloque?.fecha,
            bloque?.hora,
            ctx.profs.get(bloque?.idProfesional)?.nombre,
            estado(c, usuario.rol === "TELEMEDICINA", op),
            raw(btn("Ver reserva", "/tens/reserva?idCita=" + c.id, true)),
          ];
        }),
      ),
    );
  if (tab === "responsable")
    cabecera += panel(
      "Responsable o tutor",
      p.responsable
        ? `<dl class="details-grid">${Object.entries(p.responsable)
            .map(([k, v]) => `<div><dt>${E(k)}</dt><dd>${E(v)}</dd></div>`)
            .join("")}</dl>`
        : "<p>No hay responsable registrado.</p>",
    );
  if (tab === "documentos")
    cabecera += panel(
      "Documentos administrativos",
      `<p>${documentos.length} documentos · ${documentos.filter((d) => (d.estadoRevision || (d.verificado ? "VALIDADO" : "PENDIENTE")) === "PENDIENTE" && !d.archivado).length} pendientes de revisión</p>${btn("Adjuntar documento", "/tens/documentos?rut=" + encodeURIComponent(rut))}${tabla(
        ["Fecha", "Tipo", "Vigencia", "Estado", "Archivo", "Acciones"],
        documentos.map((d) => [
          d.fecha,
          d.tipo,
          d.vigencia || "Sin fecha",
          d.archivado
            ? "Archivado"
            : d.vigencia && d.vigencia < hoy()
              ? "Vencido"
              : (d.estadoRevision || (d.verificado ? "VALIDADO" : "PENDIENTE")) === "VALIDADO"
                ? "Validado"
                : d.estadoRevision === "OBSERVADO"
                  ? "Observado"
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
    cabecera += panel(
      "Comunicaciones",
      tabla(
        ["Fecha", "Canal", "Estado", "Responsable"],
        mensajes.map((m) => [m.fecha, m.canal, m.estado, m.responsable]),
      ),
    );
  return page(usuario, "Ficha del paciente", cabecera);
}
function reserva({ u, ctx, c, b, op: servicioOperacion, admin, volverAgenda, mensaje }) {
  const profesional = ctx.profs.get(b.idProfesional);
  const sede = ctx.sedes.get(servicioOperacion.sedeBloque(b, profesional));
  const tele = !!sede?.telemedicina;
  const status = estadoAgenda(b, c, c ? estado(c, tele, servicioOperacion) : "");
  const cancelada = c?.estadoReserva === "CANCELADA";
  const titulo = c ? "Detalle de reserva" : "Detalle del cupo";
  const volver = volverAgenda || (admin ? "/admin/agendas" : "/tens/agenda") + "?" + new URLSearchParams({ fecha: b.fecha });
  const contexto = volverAgenda ? { volverAgenda } : {};
  const datosCita = c ? { idCita: c.id, ...contexto } : {};
  const datosCupo = { idBloque: b.id, ...contexto };
  const alternativas = () => select("idBloque", "Hora alternativa", ctx.disponibles || [], "",
    (x) => x.id,
    (x) => `${x.fecha} ${x.hora} · ${ctx.profs.get(x.idProfesional)?.nombre || ""}`,
  );
  const idBloque = new URLSearchParams({ idBloque: b.id, ...(volverAgenda ? { volverAgenda } : {}) });
  const revisarCupo = (admin ? "/admin/cupo" : "/tens/reserva") + "?" + idBloque;
  let acciones = "";
  let enlaceTelemedicina = "";
  if (cancelada) {
    acciones = `<p class="muted">La cancelación queda en el historial. El estado del horario se gestiona desde el cupo.</p><a class="btn sec" href="${E(revisarCupo)}" data-drawer>Revisar estado del cupo</a>`;
  } else if (admin && c) {
    acciones = `<div class="actions">${btn("Cambio institucional", "/admin/cambios", true)}</div>
      <details><summary>Reprogramar reserva</summary><form class="form-grid" method="post" action="/admin/reagendar">
        ${hidden(datosCita)}${alternativas()}${input("motivo", "Motivo", "", "text", "required")}<button type="submit">Registrar reprogramación</button>
      </form></details>`;
  } else if (admin) {
    acciones = `<form class="actions" method="post" action="/admin/cupo/estado">${hidden(datosCupo)}
      <button name="estado" value="Disponible">Publicar / disponibilizar</button>
      <button class="sec" name="estado" value="Bloqueado">Bloquear</button>
      <button class="sec" name="estado" value="Sin publicar">Guardar sin publicar</button>
    </form>`;
  } else if (c) {
    const estadosFlujo = tele ? ["Confirmada", "Conectado", "Atendida", "No se conectó"]
      : ["Confirmada", "Llegó", "En sala", "Atendida", "No asistió"];
    acciones = `<div class="actions">${estadosFlujo.map((etiqueta) =>
        post("/tens/flujo", { ...datosCita, estado: etiqueta }, etiqueta, true),
      ).join("")}${btn("Ficha del paciente", "/tens/ficha?rut=" + encodeURIComponent(c.rut), true)}</div>
      <details><summary>Reagendar</summary><form class="form-grid" method="post" action="/tens/reagendar">
        ${hidden(datosCita)}${alternativas()}${input("motivo", "Motivo", "", "text", "required")}<button type="submit">Confirmar reprogramación</button>
      </form></details>
      <details><summary>Registrar cancelación solicitada por el paciente</summary><form class="form-grid" method="post" action="/tens/cancelar">
        ${hidden(datosCita)}${input("motivo", "Motivo de solicitud", "", "text", "required")}${select("canal", "Canal", opcionesTexto(["WhatsApp", "Llamada", "Presencial"]))}${select("destino", "Horario liberado", opcionesTexto(["Disponible", "Bloqueado"]))}<button type="submit">Registrar cancelación</button>
      </form></details>`;
  } else if (status === "Disponible") {
    acciones = btn("Reservar este cupo", "/tens/agendar?idBloque=" + b.id);
  }

  if (tele && c && !admin && !cancelada) {
    const envio = servicioOperacion.estadoEnvioEnlace(c);
    const solicitar = c.enlace && envio.estado !== "Pendiente de envío"
      ? post("/tens/comunicacion", {
          ...datosCita, canal: "Correo", tipo: "Enlace de atención", origen: "reserva",
        }, "Solicitar envío por correo", true)
      : "";
    enlaceTelemedicina = panel("Enlace de Telemedicina",
      `<p>${badge(envio.estado)}</p>` +
      (envio.detalle ? `<p class="muted">${E(envio.detalle)}</p>` : "") +
      `<form class="form-grid" method="post" action="/tens/enlace">${hidden(datosCita)}${input(
        "enlace", "Enlace de atención", c.enlace || "", "url", "required",
      )}<button type="submit">Guardar enlace</button></form>` +
      (c.enlace ? `<div class="actions"><a href="${E(c.enlace)}" target="_blank" rel="noopener">Abrir atención</a>${solicitar}</div>` : ""),
    );
  }
  const datos = [
    ["Fecha", fechaAgenda(b.fecha, { day: "numeric", month: "long", year: "numeric" })],
    ["Hora", b.hora],
    ["Profesional", profesional.nombre],
    ["Especialidad", b.especialidad || profesional.especialidad],
    ["Policlínico", sede?.nombre],
    ...(c ? [["Paciente", ctx.pacientes.get(c.rut)?.nombre || "—"], ["RUT", c.rut]] : []),
    ...(c?.estadoConfirmacion === "SIN_RESPUESTA" && status === "Reservada" ? [["Confirmación", "Sin respuesta"]] : []),
  ];
  return page(u, titulo, `
    <div class="agenda-detalle" data-agenda-detalle="${titulo}">
      <div class="agenda-detail-heading"><p>${E(b.hora)} · ${E(sede?.nombre)}</p>
        ${btn("Volver a la agenda", volver, true)}</div>
      ${panel("Datos de " + (c ? "la reserva" : "la disponibilidad"), `
        <div class="agenda-detail-status">${estadoVisible(status)}</div>
        <dl class="details-grid">${datos.map(([k, v]) => `<div><dt>${k}</dt><dd>${E(v)}</dd></div>`).join("")}</dl>
        ${acciones ? `<div class="agenda-detail-actions">${acciones}</div>` : ""}
      `)}
      ${enlaceTelemedicina}
    </div>
  `, mensaje);
}
function espera({ u, ctx, lista, q: consulta, admin = false, avisos = [], retenidos = [], mensaje }) {
  const filtro = (consulta.get("q") || "").toLowerCase(),
    esp = consulta.get("esp") || "",
    prioridad = consulta.get("prioridad") || "",
    est = consulta.get("estado") || "",
    prof = consulta.get("prof") || "",
    pendiente = consulta.get("pendiente") || "",
    hace30 = sumarDias(hoy(), -30);
  const diasEspera = (e) => Math.max(0, Math.floor((Date.parse(hoy()) - Date.parse(e.registradaEn)) / 864e5));
  const diasEsperaHtml = (e) => { const d = diasEspera(e); return `<b class="espera-dias"${d >= 30 ? ' data-largo="1"' : ""}>${d} ${d === 1 ? "día" : "días"}</b>`; };
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
        (!prof || e.cupos.some((b) => String(b.idProfesional) === prof)) &&
        (pendiente !== "con-cupo" || (e.estado === "EN_ESPERA" && e.cupos.length)) &&
        (pendiente !== "antigua" || (e.registradaEn && e.registradaEn <= hace30)),
    )
    .sort((a, b) => a.registradaEn.localeCompare(b.registradaEn));
  const idsRetenidos = new Set(retenidos.map((b) => b.id));
  avisos = avisos.filter((a) => !idsRetenidos.has(a.idBloque));
  const cuando = (b) => `${new Date(`${b.fecha}T12:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })} · ${b.hora}`;
  const candidatos = (b) => lista.filter((e) => e.cupos.some((c) => c.id === b.id)).sort((x, y) => String(x.registradaEn).localeCompare(String(y.registradaEn)));
  const cuposRetenidos = retenidos.length
    ? `<section class="espera-cupos" aria-label="Cupos disponibles para la lista de espera"><h2>Cupos disponibles para la lista de espera</h2><p>${admin ? "Estas horas quedaron libres y siguen fuera de la agenda pública hasta que TENS/TONS las asigne o las suelte." : "Estas horas quedaron libres y no están en la agenda pública. Asígnalas a quien espera o suéltalas tú."}</p><ul>${retenidos
        .map((b) => {
          const cand = candidatos(b);
          const datos = `<div class="espera-cupo-hora"><b>${E(cuando(b))}</b><span>${E(b.especialidad)} · ${E(ctx.profs.get(b.idProfesional)?.nombre || "")}${admin ? ` · ${E(ctx.sedes.get(b.idPoliclinico)?.nombre || "")}` : ""}</span></div>`;
          if (admin) return `<li class="espera-cupo">${datos}<span>${cand.length ? `${cand.length} en espera` : "Nadie en espera coincide"}</span></li>`;
          const asignar = cand.length
            ? `<form method="post" action="/tens/espera/asignar">${hidden({ idBloque: b.id })}<select name="idSolicitud" aria-label="Paciente que recibirá la hora">${cand.map((e) => `<option value="${e.id}">${E(ctx.pacientes.get(e.rut)?.nombre || e.rut)} · ${diasEspera(e)} ${diasEspera(e) === 1 ? "día" : "días"} esperando</option>`).join("")}</select><button type="submit" class="espera-asignar">Asignar cupo</button></form>`
            : `<span class="espera-cupo-nadie">Ningún paciente en espera coincide con este horario.</span>`;
          return `<li class="espera-cupo">${datos}${asignar}<form method="post" action="/tens/espera/soltar">${hidden({ idBloque: b.id })}<button type="submit" class="sec">Soltar a la agenda pública</button></form></li>`;
        })
        .join("")}</ul></section>`
    : "";
  const liberadas = avisos.length ? `<section class="espera-liberadas" aria-label="Horas liberadas"><b>${avisos.length === 1 ? "Se liberó 1 hora" : `Se liberaron ${avisos.length} horas`}</b><ul>${avisos.map((a) => `<li>${E(String(a.texto || "").replace(/^Cupo liberado:\s*/, "").replace(/\s*Revisa la lista de espera\.$/, ""))}</li>`).join("")}</ul><p>Asigna la hora a quien lleva más tiempo esperando esa especialidad.</p></section>` : "";
  return page(
    u,
    admin ? "Supervisión de lista de espera" : "Lista de espera",
    cab(
      admin
        ? "El paciente permanece en la lista aunque no responda. Las horas canceladas de las especialidades con lista de espera quedan retenidas hasta que TENS/TONS las asigne o las suelte."
        : "El paciente permanece en la lista aunque no responda. Cuando se cancela una hora de una especialidad con lista de espera, queda retenida aquí hasta que tú la asignes o la sueltes.",
    ) +
      cuposRetenidos +
      liberadas +
      (admin ? "" : `<details class="espera-nueva"><summary class="btn">Agregar a la lista de espera</summary><form class="form-grid" method="post" action="/tens/espera">${input("rut", "RUT del paciente", "", "text", "required")}${hidden({ idPoliclinico: u.idPoliclinico })}${select("especialidad", "Especialidad", opcionesTexto(ctx.especialidades || []))}${select("prioridad", "Prioridad", opcionesTexto(["Normal", "Media", "Alta"]))}${input("preferencia", "Preferencia de horario")}<button type="submit">Registrar</button></form></details>`) +
      `<form class="filters">${input("q", "Paciente / RUT", consulta.get("q") || "", "search")}${select("esp", "Especialidad", [{ id: "", nombre: "Seleccionar especialidad…" }, ...opcionesTexto([...new Set(lista.map((e) => e.especialidad))])], esp)}${select("prof", "Profesional", [{ id: "", nombre: "Seleccionar profesional…" }, ...ctx.listaProfs], prof)}${select("prioridad", "Prioridad", [{ id: "", nombre: "Seleccionar prioridad…" }, ...opcionesTexto(["Alta", "Media", "Normal"])], prioridad)}${select("estado", "Estado", [{ id: "", nombre: "Seleccionar estado…" }, ...opcionesTexto(["Pendiente", "Contactado", "Hora ofrecida", "Reservado", "No responde"])], est)}${select("pendiente", "Seguimiento", [{ id: "", nombre: "Seleccionar seguimiento…" }, { id: "con-cupo", nombre: "Con cupo disponible" }, { id: "antigua", nombre: "Más de 30 días" }], pendiente)}<button type="submit">Filtrar · mayor espera</button></form>` +
      tabla(
        [
          "Paciente",
          "Edad",
          "Especialidad",
          "Preferencia",
          "Días de espera",
          "Prioridad",
          "Estado",
          ...(admin ? ["Cupos compatibles"] : ["Contacto", "Asignar cupo"]),
        ],
        filas.map((e) => [
          raw(`<b class="paciente-nombre">${E(ctx.pacientes.get(e.rut)?.nombre)}</b><small class="sec">${E(e.rut)}</small>${avisos.some((a) => a.especialidad === e.especialidad) ? '<span class="espera-liberada">Hora liberada</span>' : ""}`),
          edad(ctx.pacientes.get(e.rut)?.fechaNacimiento),
          e.especialidad,
          e.preferencia || "Cualquier horario",
          raw(diasEsperaHtml(e)),
          e.prioridad || "Normal",
          e.estadoOperativo || "Pendiente",
          ...(admin
            ? [`${e.cupos.length} cupos compatibles`]
            : [
                raw(`<details class="espera-contacto"><summary>Registrar contacto</summary><form class="espera-form" method="post" action="/tens/espera/gestion">${hidden({ idSolicitud: e.id })}<select name="estado" aria-label="Resultado del contacto">${opcionesTexto(["Contactado", "Hora ofrecida", "No responde"]).map((x) => `<option>${x.nombre}</option>`).join("")}</select><select name="canal" aria-label="Canal"><option>WhatsApp</option><option>Llamada</option></select><button type="submit">Guardar contacto</button></form></details><details class="espera-retirar"><summary>Retirar de la lista</summary><form class="espera-form" method="post" action="/tens/espera/retirar">${hidden({ idSolicitud: e.id })}<input name="motivo" required maxlength="200" placeholder="Motivo del retiro" aria-label="Motivo del retiro"><button type="submit" class="sec">Retirar</button></form></details>`),
                raw(e.cupos.length ? `<form class="espera-form" method="post" action="/tens/espera/asignar">${hidden({ idSolicitud: e.id })}<select name="idBloque" aria-label="Cupo compatible">${e.cupos.map((b) => `<option value="${b.id}">${E(b.fecha)} ${E(b.hora)} · ${E(ctx.profs.get(b.idProfesional)?.nombre)}${b.retenido ? " · retenida" : ""}</option>`).join("")}</select><button type="submit" class="espera-asignar">Asignar cupo</button></form>` : btn("Buscar hora", "/tens/agenda?esp=" + encodeURIComponent(e.especialidad), true)),
              ]),
        ]),
      ),
    mensaje,
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

"use strict";
const { pagina } = require("./layout");
const { esc, opciones } = require("./componentesComunes");
const { ico } = require("./iconos");
const graficos = require("./graficos");
const estilos = require("./resumen.css");
const script = require("./resumen.script");

const kpi = ({ href, clase = "", icono, valor, texto, nota = "" }) =>
  `<a class="res-kpi ${clase}" href="${esc(href)}"${href.includes("#detalle-alerta") ? " data-res-alerta-url" : ""}><span class="res-kpi-etiqueta">${ico(icono)}${esc(texto)}</span><strong>${esc(valor)}</strong>${nota ? `<small>${esc(nota)}</small>` : ""}</a>`;

const alerta = ({ id, nivel, titulo, detalle, n, href }, seleccion) =>
  `<li><a class="res-alerta" data-prioridad="${nivel}" href="${esc(href)}"${id ? " data-res-alerta-url" : ""}${id && seleccion === id ? ' aria-current="true"' : ""}><span class="res-alerta-cantidad" aria-label="${n} casos">${n}</span><span><b>${esc(titulo)}</b><small>${esc(detalle)}</small></span><span class="res-alerta-nivel">${nivel === "crit" ? "Crítica" : "Aviso"}</span></a></li>`;

function listaCitas(filas, { vacio, incluirFecha = false }) {
  if (!filas.length) return `<p class="res-vacio">${esc(vacio)}</p>`;
  return `<ul class="res-citas">${filas.map((f) =>
    `<li><time datetime="${esc(f.fecha)}T${esc(f.hora)}">${incluirFecha ? `<small>${esc(graficos.fechaCorta(f.fecha))}</small>` : ""}${esc(f.hora)}</time><span class="res-cita-datos"><a href="${esc(f.href)}">${esc(f.paciente)}</a><small>${esc(f.detalle)}</small></span>${f.badge}</li>`,
  ).join("")}</ul>`;
}

function avisos(lista, detalle, regresar) {
  const pendientes = lista.filter((a) => a.n);
  const alDia = lista.filter((a) => !a.n);
  return `<section class="res-panel" aria-labelledby="res-alertas-titulo">
<div class="res-titulo"><h3 id="res-alertas-titulo">Alertas críticas y pendientes</h3>${pendientes.length ? `<span class="res-contador">${pendientes.length} ${pendientes.length === 1 ? "alerta activa" : "alertas activas"}</span>` : ""}</div>
${pendientes.length ? `<ul class="res-alertas">${pendientes.map((a) => alerta(a, detalle?.id)).join("")}</ul>` : `<p class="res-vacio res-al-dia">${ico("check")}No hay alertas pendientes.</p>`}
${alDia.length ? `<details class="res-detalles"><summary>Controles al día (${alDia.length})</summary><ul class="res-controles">${alDia.map((a) => `<li>${esc(a.titulo)}</li>`).join("")}</ul></details>` : ""}
</section>
${detalle ? `<section class="res-panel res-alerta-seleccionada" id="detalle-alerta" tabindex="-1" aria-labelledby="res-detalle-titulo">
<div class="res-titulo"><h3 id="res-detalle-titulo">${esc(detalle.titulo)}</h3><a data-res-alerta-url href="${esc(regresar)}">Cerrar detalle</a></div>
${listaCitas(detalle.filas, { vacio: "No quedan citas pendientes para esta alerta.", incluirFecha: true })}
<div class="res-detalle-acciones"><a class="btn sec" href="${esc(detalle.origen)}">${esc(detalle.accion)}</a></div>
</section>` : ""}`;
}

const porcentaje = (v) => v == null ? "—" : `${v}%`;
const etiquetaPeriodo = (p) => p.desde === p.hasta
  ? graficos.fechaLarga(p.desde)
  : `${graficos.fechaCorta(p.desde)} – ${graficos.fechaLarga(p.hasta)}`;

function comparacion(actual, previo, { unidad = "pts", menorEsMejor = false } = {}) {
  if (actual == null || previo == null) return `<span class="res-delta neutro">Sin datos del período anterior</span>`;
  const dif = unidad === "pts" ? actual - previo : (previo ? Math.round(((actual - previo) / previo) * 100) : null);
  if (dif === null) return `<span class="res-delta neutro">Sin reservas en el período anterior</span>`;
  const texto = unidad === "pts" ? `${Math.abs(dif)} pts` : `${Math.abs(dif)} %`;
  const antes = unidad === "pts" ? `${previo}%` : graficos.num(previo);
  if (!dif) return `<span class="res-delta neutro">${unidad === "pts" ? "Igual que" : "Prácticamente igual que"} el período anterior (${antes})</span>`;
  const mejora = menorEsMejor ? dif < 0 : dif > 0;
  return `<span class="res-delta ${unidad === "%" && !menorEsMejor ? "neutro" : mejora ? "bueno" : "malo"}"><span aria-hidden="true">${dif > 0 ? "▲" : "▼"}</span>${dif > 0 ? "+" : "−"}${texto} vs. período anterior (${antes})</span>`;
}

function indicadores(datos, base, alertaActiva) {
  const { desde, hasta, sede, sedes, profesional, profesionales, periodos, ocupacion, inasistencia, reservas, confirmadas, vigentes, anterior } = datos;
  const sedeOptions = [{ id: "", nombre: "Todos los policlínicos" }, ...sedes];
  const colores = { principal: "#0b3b4c", teal: "#16808b", canceladas: "#b8742a", pendientes: "#657a86", previo: "#9aabb3" };
  const serie = (nombre, campo, color = colores.principal, trazo) => ({ nombre, color, trazo, valores: periodos.map((p) => p[campo]) });
  const previa = (nombre, campo) => ({ nombre, color: colores.previo, previo: true, valores: anterior.periodos.map((p) => p[campo]) });
  const grafico = ({ titulo, valor, descripcion, series, porcentaje: unidad, sinDatos, comparar }) =>
    `<section class="res-grafico"><h4>${esc(titulo)}</h4><div class="res-valor"><strong>${esc(valor)}</strong>${comparar}</div><p class="res-grafico-contexto">${esc(descripcion)}</p>
${sinDatos ? '<p class="res-vacio res-vacio-grafico">Sin datos en este período.</p>' : graficos.lineas({
    etiquetas: periodos,
    series,
    titulo,
    etiquetaX: etiquetaPeriodo,
    ejeFecha: (p) => graficos.fechaCorta(p.desde),
    interactivo: true,
    ...(unidad ? { maximo: 100, sufijo: "%" } : {}),
  })}</section>`;
  const metrica = ({ titulo, valor, descripcion, comparar }) =>
    `<div class="res-metrica"><h4>${esc(titulo)}</h4><div class="res-valor"><strong>${esc(valor)}</strong>${comparar}</div><p class="res-grafico-contexto">${esc(descripcion)}</p></div>`;
  const lista = [
    {
      titulo: "Ocupación de cupos",
      valor: porcentaje(ocupacion.total),
      descripcion: `${graficos.num(ocupacion.ocupados)} de ${graficos.num(ocupacion.publicados)} cupos publicados ocupados`,
      series: [serie("Ocupación", "ocupacion", colores.teal), previa("Período anterior", "ocupacion")],
      porcentaje: true,
      sinDatos: ocupacion.total == null,
      comparar: comparacion(ocupacion.total, anterior.ocupacion.total),
    },
    {
      titulo: "Evolución de reservas",
      valor: graficos.num(reservas),
      descripcion: "Reservas por fecha de atención",
      series: [serie("Vigentes", "vigentes"), serie("Canceladas", "canceladas", colores.canceladas, "4 3"), previa("Vigentes, período anterior", "vigentes")],
      sinDatos: !reservas,
      comparar: comparacion(reservas, anterior.reservas, { unidad: "%" }),
    },
    {
      titulo: "Inasistencias",
      valor: porcentaje(inasistencia.total),
      descripcion: `${graficos.num(inasistencia.ausencias)} inasistencias de ${graficos.num(inasistencia.asistencias)} resultados registrados`,
      series: [serie("Inasistencia", "inasistencia", colores.canceladas), previa("Período anterior", "inasistencia")],
      porcentaje: true,
      sinDatos: inasistencia.total == null,
      comparar: comparacion(inasistencia.total, anterior.inasistencia.total, { menorEsMejor: true }),
    },
    {
      titulo: "Confirmación de citas",
      valor: porcentaje(datos.confirmacion),
      descripcion: `${graficos.num(confirmadas)} de ${graficos.num(vigentes)} citas vigentes confirmadas`,
      series: [serie("Confirmación", "confirmacion", colores.principal), previa("Período anterior", "confirmacion")],
      porcentaje: true,
      sinDatos: !vigentes,
      comparar: comparacion(datos.confirmacion, anterior.confirmacion),
    },
  ];
  const ruta = `${base}/resumen`;
  const limpiar = alertaActiva ? `${ruta}?${new URLSearchParams({ alerta: alertaActiva })}` : ruta;
  const profOptions = [{ id: "", nombre: "Todos los profesionales" }, ...profesionales];
  return `<div data-res-indicadores-contenido>
<form class="res-filtros" method="get" action="${ruta}#res-indicadores" data-res-filtros>
${alertaActiva ? `<input type="hidden" name="alerta" value="${esc(alertaActiva)}">` : ""}
${base === "/admin" ? `<label>Policlínico<select name="sede">${opciones(sedeOptions, (s) => s.id, (s) => s.nombre, sede || "")}</select></label>` : ""}
<label>Profesional<select name="prof">${opciones(profOptions, (p) => p.id, (p) => p.nombre, profesional || "")}</select></label>
<label>Desde<input type="date" name="desde" value="${esc(desde)}" required></label>
<label>Hasta<input type="date" name="hasta" value="${esc(hasta)}" required></label>
<div class="actions"><button type="submit" class="btn">Aplicar filtros</button><a class="btn sec" data-res-limpiar href="${esc(limpiar)}#res-indicadores">Limpiar</a></div>
</form>
<div class="res-graficos">${lista.slice(0, 2).map(grafico).join("")}</div>
<div class="res-metricas">${lista.slice(2).map(metrica).join("")}</div></div></div>`;
}

function resumen({ usuario, admin, sede, kpis, alertas, detalleAlerta, citasHoy, porSede, capacidad, indicadores: datos, hora, consulta }) {
  const base = admin ? "/admin" : "/tens";
  const agenda = admin ? "/admin/agendas" : "/tens/agenda";
  const otros = citasHoy.length - 4;
  const params = new URLSearchParams(consulta);
  params.delete("alerta");
  const regresar = `${base}/resumen${params.size ? "?" + params : ""}#res-alertas-titulo`;
  const contenido = `<style>${estilos}</style><div class="workspace res-workspace">
<header class="res-cab"><div><h2>${admin ? "Actividad de la red" : esc(sede?.nombre || "Actividad del policlínico")}</h2><p>Actualizado a las ${esc(hora)}</p></div>
<div class="actions">${admin ? `<a class="btn" href="/admin/bloque/nuevo">${ico("mas")}Crear bloque horario</a><a class="btn sec" href="${agenda}">${ico("calendario")}Ver agendas</a>` : `<a class="btn" href="${agenda}?vista=lista">${ico("calendario")}Agenda de hoy</a><a class="btn sec" href="/tens/espera">${ico("lista")}Lista de espera</a>`}</div></header>
<div class="res-kpis" aria-label="Indicadores operativos">${kpis.map(kpi).join("")}</div>
<div class="res-operacion"><div class="res-alertas-col">${avisos(alertas, detalleAlerta, regresar)}</div>
<section class="res-panel" aria-labelledby="res-citas-titulo"><div class="res-titulo"><h3 id="res-citas-titulo">Citas de hoy</h3><a href="${agenda}?vista=lista">Ver agenda</a></div>
${listaCitas(citasHoy.slice(0, 4), { vacio: "No hay citas agendadas para hoy." })}
${otros > 0 ? `<details class="res-detalles"><summary>Ver ${otros} ${otros === 1 ? "cita más" : "citas más"}</summary>${listaCitas(citasHoy.slice(4), {})}</details>` : ""}
</section></div>
${admin ? `<section class="res-panel res-analitica" id="res-indicadores" aria-labelledby="res-indicadores-titulo">
<div class="res-titulo"><h3 id="res-indicadores-titulo">Indicadores del período</h3><p class="res-estado" role="status" data-res-estado></p></div>
${indicadores(datos, base, detalleAlerta?.id)}
</section>` : ""}
</div>${script}`;
  return pagina({ titulo: "Resumen", usuario, lienzo: true, contenido });
}

module.exports = { resumen, indicadores };

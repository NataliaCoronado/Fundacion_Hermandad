'use strict';
const { esc, tabla } = require('./componentesComunes');

const COLOR = {
  navy: '#0b3b4c', azul: '#1f5f7a', teal: '#16808b', aqua: '#2c9a8f', naranja: '#b8742a', ambar: '#b8742a',
  pizarra: '#657a86', previo: '#9aabb3', gris: '#c9d5d9',
};
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f) => { const [, m, d] = String(f).split('-').map(Number); return `${d} ${MES[m - 1]}`; };
const fechaLarga = (f) => { const [a, m, d] = String(f).split('-').map(Number); return `${d} ${MES[m - 1]} ${a}`; };
const num = (n) => Number(n).toLocaleString('es-CL');

const vistaTabla = (columnas, filas) => `<details class="vista-tabla"><summary>Ver datos en tabla</summary>${tabla(columnas, filas)}</details>`;
const sinJs = '<noscript><p class="nota">Activa JavaScript para ver el gráfico; los mismos datos están en la tabla de abajo.</p></noscript>';
const lienzo = (spec, alto, titulo) => `<div class="ec" data-ec="${esc(JSON.stringify(spec))}" style="height:${alto}px" role="img" aria-label="${esc(titulo)}"></div>${sinJs}`;
const leyenda = (items) => `<ul class="leyenda-g">${items.map((i) => `<li><i style="background:${i.color}"></i>${esc(i.nombre)}</li>`).join('')}</ul>`;
const fmt = (v, sufijo = '') => (v == null ? 'Sin datos' : `${num(v)}${sufijo}`);

function lineas({
  etiquetas, series, titulo, sufijo = '', etiquetaX = (e) => `Semana del ${fechaCorta(e)}`,
  ejeFecha = fechaCorta, interactivo = false, maximo, formato, tabla: conTabla = true, alto,
}) {
  const hayDatos = series.some((s) => s.valores.some((v) => v != null));
  if (!etiquetas.length || !hayDatos) return '<p class="vacio">Sin datos en este período.</p>';
  const spec = {
    tipo: 'lineas', ejes: etiquetas.map(ejeFecha), titulos: etiquetas.map(etiquetaX), sufijo, max: maximo, entero: !sufijo,
    series: series.map((s) => ({ nombre: s.nombre, color: s.color, valores: s.valores, trazo: !!s.trazo, previo: !!s.previo })),
  };
  const f = formato || ((v) => fmt(v, sufijo));
  return `<figure class="graf">${lienzo(spec, alto || (interactivo ? 250 : 300), titulo)}
${conTabla ? vistaTabla(['Periodo', ...series.map((s) => s.nombre)], etiquetas.map((e, i) => [etiquetaX(e), ...series.map((s) => f(s.valores[i]))])) : ''}</figure>`;
}

function columnasApiladas({ etiquetas, segmentos, titulo }) {
  if (!etiquetas.length) return '<p class="vacio">Sin datos.</p>';
  const spec = { tipo: 'apiladas', ejes: etiquetas.map(fechaCorta), titulos: etiquetas.map(fechaLarga), series: segmentos.map((g) => ({ nombre: g.nombre, color: g.color, valores: g.valores })) };
  return `<figure class="graf">${lienzo(spec, 290, titulo)}
${vistaTabla(['Día', ...segmentos.map((g) => g.nombre)], etiquetas.map((e, i) => [fechaLarga(e), ...segmentos.map((g) => num(g.valores[i]))]))}</figure>`;
}

function barras(filas, { color = COLOR.azul, formato = num, max, sufijo = '', vacio = 'Sin datos.', titulo = 'Gráfico de barras', tabla: conTabla = true } = {}) {
  if (!filas.length) return `<p class="vacio">${esc(vacio)}</p>`;
  const spec = { tipo: 'barras', color, sufijo, max, filas: filas.map((f) => ({ nombre: f.nombre, n: f.n || 0, extra: f.extra || '' })) };
  return `<figure class="graf">${lienzo(spec, 52 + filas.length * 34, titulo)}
${conTabla ? vistaTabla(['Categoría', 'Valor', 'Detalle'], filas.map((f) => [f.nombre, `${formato(f.n || 0)}${sufijo}`, f.extra || '—'])) : ''}</figure>`;
}

function segmentada(partes, titulo, { tabla: conTabla = true, unidad = 'citas' } = {}) {
  const total = partes.reduce((s, p) => s + p.n, 0);
  if (!total) return '<p class="vacio">Sin citas en este periodo.</p>';
  const spec = { tipo: 'anillo', total, unidad, partes: partes.filter((p) => p.n).map((p) => ({ nombre: p.nombre, n: p.n, color: p.color })) };
  return `<figure class="graf">${lienzo(spec, 270, titulo)}
${conTabla ? vistaTabla(['Estado', 'Citas', 'Porcentaje'], partes.map((p) => [p.nombre, num(p.n), `${Math.round((p.n / total) * 100)} %`])) : ''}</figure>`;
}

function mapaCalor({ x, y, datos, titulo, unidad = 'citas' }) {
  const max = Math.max(0, ...datos.map((d) => d[2]));
  if (!max) return '<p class="vacio">Sin datos en este período.</p>';
  const spec = { tipo: 'calor', x, y, datos, max, unidad };
  const celda = new Map(datos.map(([i, j, v]) => [`${i}|${j}`, v]));
  return `<figure class="graf">${lienzo(spec, 96 + y.length * 38, titulo)}
${vistaTabla(['Día', ...x], y.map((d, j) => [d, ...x.map((_, i) => celda.get(`${i}|${j}`) || 0)]))}</figure>`;
}

const medidor = (v, { alerta = false } = {}) => (v === null || v === undefined ? '<span class="suave">—</span>' : `<span class="med"><span class="tr"><i style="width:${Math.min(100, v)}%;background:${alerta ? COLOR.naranja : COLOR.teal}"></i></span><b>${v} %</b></span>`);

module.exports = { lineas, columnasApiladas, barras, segmentada, mapaCalor, medidor, leyenda, fechaCorta, fechaLarga, num, COLOR };

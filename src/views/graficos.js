'use strict';
const { esc, tabla } = require('./util');

const COLOR = { azul: '#2a78d6', naranja: '#eb6834', aqua: '#1baf7a', gris: '#c9d5d9', teal: '#16808b' };
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (f) => { const [, m, d] = String(f).split('-').map(Number); return `${d} ${MES[m - 1]}`; };
const fechaLarga = (f) => { const [a, m, d] = String(f).split('-').map(Number); return `${d} ${MES[m - 1]} ${a}`; };
const num = (n) => Number(n).toLocaleString('es-CL');

function escala(max) {
  const m = Math.max(1, max); const bruto = m / 4; const p = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * p).find((v) => v >= bruto);
  const tope = Math.ceil(m / paso) * paso;
  const marcas = []; for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(Math.round(v * 100) / 100);
  return { tope, marcas };
}
const leyenda = (items) => `<ul class="leyenda-g">${items.map((i) => `<li><i style="background:${i.color}"></i>${esc(i.nombre)}</li>`).join('')}</ul>`;
const vistaTabla = (columnas, filas) => `<details class="vista-tabla"><summary>Ver datos en tabla</summary>${tabla(columnas, filas)}</details>`;
const tip = (html) => `data-tip="${esc(html)}"`;

function lineas({ etiquetas, series, titulo, formato = num, sufijo = '', etiquetaX = (e) => `Semana del ${fechaCorta(e)}` }) {
  if (!etiquetas.length) return '<p class="vacio">Sin datos en este periodo.</p>';
  const W = 760; const H = 260; const L = 44; const R = 14; const T = 14; const B = 30;
  const { tope, marcas } = escala(Math.max(...series.flatMap((s) => s.valores)));
  const x = (i) => L + (etiquetas.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (etiquetas.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / tope);
  const grid = marcas.map((v) => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="eje" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${formato(v)}${sufijo}</text>`).join('');
  const salto = Math.ceil(etiquetas.length / 8);
  const ejeX = etiquetas.map((e, i) => (i % salto === 0 ? `<text class="eje" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(fechaCorta(e))}</text>` : '')).join('');
  const trazos = series.map((s) => {
    const d = s.valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${s.valores.map((v, i) => `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`).join('')}`;
  }).join('');
  const ancho = (W - L - R) / Math.max(1, etiquetas.length - 1);
  const cols = etiquetas.map((e, i) => `<g class="col"><line class="guia" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}"/><rect class="hit" x="${(x(i) - ancho / 2).toFixed(1)}" y="${T}" width="${ancho.toFixed(1)}" height="${H - T - B}" ${tip(`<b>${esc(etiquetaX(e))}</b>${series.map((s) => `<span class="tt"><i style="background:${s.color}"></i>${esc(s.nombre)}: <b>${formato(s.valores[i])}${sufijo}</b></span>`).join('')}`)}/></g>`).join('');
  return `<figure class="graf"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}" preserveAspectRatio="xMidYMid meet">${grid}${ejeX}${trazos}${cols}</svg>
${series.length > 1 ? leyenda(series) : ''}${vistaTabla(['Periodo', ...series.map((s) => s.nombre)], etiquetas.map((e, i) => [etiquetaX(e), ...series.map((s) => `${formato(s.valores[i])}${sufijo}`)]))}</figure>`;
}

function columnasApiladas({ etiquetas, segmentos, titulo }) {
  if (!etiquetas.length) return '<p class="vacio">Sin datos.</p>';
  const W = 760; const H = 250; const L = 44; const R = 10; const T = 12; const B = 34;
  const totales = etiquetas.map((_, i) => segmentos.reduce((s, g) => s + g.valores[i], 0));
  const { tope, marcas } = escala(Math.max(...totales));
  const paso = (W - L - R) / etiquetas.length; const ancho = Math.min(34, paso * 0.62);
  const y = (v) => T + (H - T - B) * (1 - v / tope);
  const grid = marcas.map((v) => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="eje" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`).join('');
  const barras = etiquetas.map((e, i) => {
    const cx = L + paso * i + paso / 2; let acumulado = 0; let ultimo = -1;
    segmentos.forEach((g, k) => { if (g.valores[i] > 0) ultimo = k; });
    const partes = segmentos.map((g, k) => {
      const v = g.valores[i]; if (!v) return '';
      const y1 = y(acumulado + v); const y0 = y(acumulado); acumulado += v;
      const x0 = cx - ancho / 2; const x1 = cx + ancho / 2; const r = k === ultimo ? Math.min(4, (y0 - y1) / 2) : 0;
      return `<path d="M${x0} ${y0} V${y1 + r} ${r ? `Q${x0} ${y1} ${x0 + r} ${y1} H${x1 - r} Q${x1} ${y1} ${x1} ${y1 + r}` : `H${x1}`} V${y0} Z" fill="${g.color}" stroke="#fff" stroke-width="2"/>`;
    }).join('');
    const detalle = `<b>${esc(fechaLarga(e))}</b>${segmentos.map((g) => `<span class="tt"><i style="background:${g.color}"></i>${esc(g.nombre)}: <b>${num(g.valores[i])}</b></span>`).join('')}`;
    return `<g class="col"><rect class="fondo-col" x="${cx - paso / 2}" y="${T}" width="${paso}" height="${H - T - B}"/>${partes}<text class="eje" x="${cx}" y="${H - 16}" text-anchor="middle">${esc(fechaCorta(e).split(' ')[0])}</text><text class="eje flojo" x="${cx}" y="${H - 4}" text-anchor="middle">${esc(fechaCorta(e).split(' ')[1])}</text><rect class="hit" x="${cx - paso / 2}" y="${T}" width="${paso}" height="${H - T - B}" ${tip(detalle)}/></g>`;
  }).join('');
  return `<figure class="graf"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}">${grid}${barras}</svg>${leyenda(segmentos)}
${vistaTabla(['Día', ...segmentos.map((g) => g.nombre)], etiquetas.map((e, i) => [fechaLarga(e), ...segmentos.map((g) => num(g.valores[i]))]))}</figure>`;
}

function barras(filas, { color = COLOR.azul, formato = num, max, sufijo = '', vacio = 'Sin datos.' } = {}) {
  if (!filas.length) return `<p class="vacio">${esc(vacio)}</p>`;
  const m = max || Math.max(1, ...filas.map((f) => f.n || 0));
  return `<div class="bh">${filas.map((f) => `<div class="b" ${tip(`<b>${esc(f.nombre)}</b><span class="tt">${formato(f.n || 0)}${sufijo}${f.extra ? ` · ${esc(f.extra)}` : ''}</span>`)}><span class="n" title="${esc(f.nombre)}">${esc(f.nombre)}</span><span class="tr"><i style="width:${Math.max(f.n ? 1 : 0, Math.round(((f.n || 0) / m) * 100))}%;background:${color}"></i></span><b>${formato(f.n || 0)}${sufijo}</b></div>`).join('')}</div>`;
}

function segmentada(partes, titulo) {
  const total = partes.reduce((s, p) => s + p.n, 0);
  if (!total) return '<p class="vacio">Sin citas en este periodo.</p>';
  return `<figure class="graf"><div class="seg" role="img" aria-label="${esc(titulo)}">${partes.filter((p) => p.n).map((p) => `<i style="flex:${p.n};background:${p.color}" ${tip(`<b>${esc(p.nombre)}</b><span class="tt">${num(p.n)} · ${Math.round((p.n / total) * 100)} %</span>`)}></i>`).join('')}</div>
<ul class="leyenda-g l-datos">${partes.map((p) => `<li><i style="background:${p.color}"></i>${esc(p.nombre)}<b>${num(p.n)}</b><small>${Math.round((p.n / total) * 100)} %</small></li>`).join('')}</ul></figure>`;
}

const medidor = (v, { alerta = false, invertir = false } = {}) => (v === null || v === undefined ? '<span class="suave">—</span>' : `<span class="med"><span class="tr"><i style="width:${Math.min(100, v)}%;background:${alerta ? COLOR.naranja : COLOR.teal}"></i></span><b>${v} %</b></span>`);

module.exports = { lineas, columnasApiladas, barras, segmentada, medidor, leyenda, fechaCorta, fechaLarga, num, COLOR };

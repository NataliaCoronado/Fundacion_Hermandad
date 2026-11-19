'use strict';
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const raw = (html) => ({ __raw: html });
const ESTADOS = { ACTIVA: 'ok', CONFIRMADA: 'ok', ASISTIO: 'ok', Activo: 'ok', 'Sí': 'ok', PENDIENTE: 'pend', 'Por confirmar': 'pend', SIN_RESPUESTA: 'pend', CANCELADA: 'mal', NO_ASISTIO: 'mal', Inactivo: 'mal' };
const celda = (v) => {
  if (v && v.__raw !== undefined) return v.__raw;
  return ESTADOS[v] ? `<span class="badge ${ESTADOS[v]}">${esc(v)}</span>` : esc(v);
};

function tabla(columnas, filas, vacio = 'Sin registros.') {
  if (!filas.length) return `<p class="vacio">${esc(vacio)}</p>`;
  const th = columnas.map((c) => `<th>${esc(c)}</th>`).join('');
  const tr = filas.map((f) => `<tr>${f.map((v) => `<td>${celda(v)}</td>`).join('')}</tr>`).join('');
  return `<div class="tabla-w"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

function opciones(items, valor, texto, seleccionado) {
  return items.map((i) => `<option value="${esc(valor(i))}"${String(valor(i)) === String(seleccionado) ? ' selected' : ''}>${esc(texto(i))}</option>`).join('');
}

const forma = (accion, campos, texto) => `<form method="post" action="${esc(accion)}" style="display:inline">${Object.entries(campos).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}<button type="submit">${esc(texto)}</button></form>`;

const FOTOS = { 1: 'san-isidro', 2: 'sagrada-familia', 3: 'maria-ayuda', 4: 'santa-teresa', 5: 'padre-hurtado', 6: 'oratorio-mariano', 7: 'telemedicina' };
const foto = (sede, clase = 'foto') => (sede && FOTOS[sede.id] ? `<img class="${clase}" src="/img/${FOTOS[sede.id]}.jpg" alt="${esc(sede.telemedicina ? 'Telemedicina: atención a distancia' : 'Fachada del policlínico ' + sede.nombre)}" loading="lazy">` : '');
module.exports = { foto, esc, raw, tabla, opciones, forma };

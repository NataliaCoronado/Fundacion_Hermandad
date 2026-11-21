'use strict';
const pad = (n) => String(n).padStart(2, '0');
const textoLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const hoy = (d = new Date()) => textoLocal(d).slice(0, 10);
function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`;
}
function sumarMinutos(texto, minutos) {
  const [f, h] = texto.split(' ');
  const [a, m, d] = f.split('-').map(Number);
  const [hh, mm] = h.split(':').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d, hh, mm + minutos));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
}
const diaSemana = (fecha) => { const [a, m, d] = fecha.split('-').map(Number); return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7; };
const lunesDe = (fecha) => sumarDias(fecha, -diaSemana(fecha));
module.exports = { textoLocal, hoy, sumarDias, sumarMinutos, diaSemana, lunesDe };

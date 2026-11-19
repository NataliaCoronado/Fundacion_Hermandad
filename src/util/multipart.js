'use strict';
function parsearMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  const out = {};
  if (!m) return out;
  const sep = Buffer.from(`--${m[1] || m[2]}`);
  let pos = buf.indexOf(sep);
  while (pos !== -1) {
    const ini = pos + sep.length;
    if (buf.slice(ini, ini + 2).toString() === '--') break;
    const sig = buf.indexOf(sep, ini);
    if (sig === -1) break;
    const parte = buf.slice(ini + 2, sig - 2);
    const corte = parte.indexOf('\r\n\r\n');
    if (corte !== -1) {
      const cab = parte.slice(0, corte).toString('utf8'); const datos = parte.slice(corte + 4);
      const nombre = /[; ]name="([^"]*)"/.exec(cab); const archivo = /filename="([^"]*)"/.exec(cab);
      if (nombre && archivo) { if (archivo[1] && datos.length) out[nombre[1]] = { nombre: archivo[1], datos }; }
      else if (nombre) out[nombre[1]] = datos.toString('utf8');
    }
    pos = sig;
  }
  return out;
}
module.exports = { parsearMultipart };

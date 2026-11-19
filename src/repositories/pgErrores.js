'use strict';
function traducir(e, mapa) {
  const texto = `${e.code || ''} ${e.message || ''}`;
  for (const [patron, codigo] of mapa) if (patron.test(texto)) return new Error(codigo);
  return e;
}
module.exports = { traducir };

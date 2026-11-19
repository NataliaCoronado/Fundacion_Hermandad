'use strict';
const crypto = require('node:crypto');

function hashClave(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(clave), sal, 32).toString('hex');
  return `scrypt$${sal}$${h}`;
}
function verificarClave(clave, guardado) {
  const [alg, sal, h] = String(guardado || '').split('$');
  const calculado = crypto.scryptSync(String(clave), sal || 'sal-falsa', 32);
  if (alg !== 'scrypt' || !h) return false;
  const esperado = Buffer.from(h, 'hex');
  return esperado.length === calculado.length && crypto.timingSafeEqual(esperado, calculado);
}
module.exports = { hashClave, verificarClave };

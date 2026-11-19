"use strict";
function crearLimitador(ventanaMs = 60_000) {
  const intentos = new Map();
  let ultimaLimpieza = Date.now();
  return function excedido(clave, limite) {
    const n = Date.now();
    if (n - ultimaLimpieza > ventanaMs) {
      for (const [k, l] of intentos) if (!l.length || n - l[l.length - 1] >= ventanaMs) intentos.delete(k);
      ultimaLimpieza = n;
    }
    const l = (intentos.get(clave) || []).filter((x) => n - x < ventanaMs);
    l.push(n);
    intentos.set(clave, l);
    return l.length > limite;
  };
}
module.exports = { crearLimitador };

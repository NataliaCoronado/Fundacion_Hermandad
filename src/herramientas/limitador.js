"use strict";
function crearLimitador(ventanaMs = 60_000) {
  const intentos = new Map();
  let ultimaLimpieza = Date.now();
  return function excedido(clave, limite) {
    const ahora = Date.now();
    if (ahora - ultimaLimpieza > ventanaMs) {
      for (const [k, l] of intentos) if (!l.length || ahora - l[l.length - 1] >= ventanaMs) intentos.delete(k);
      ultimaLimpieza = ahora;
    }
    const intentosRecientes = (intentos.get(clave) || []).filter((x) => ahora - x < ventanaMs);
    intentosRecientes.push(ahora);
    intentos.set(clave, intentosRecientes);
    return intentosRecientes.length > limite;
  };
}
module.exports = { crearLimitador };

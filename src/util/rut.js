'use strict';
// El RUT se guarda siempre sin puntos y con guion: 11111111-1.
// Acepta "11.111.111-1", "111111111" o "11111111-1": deja solo dígitos y K y pone el guion antes del dígito verificador.
const normalizarRut = (s) => {
  const limpio = String(s || '').toUpperCase().replace(/[^0-9K]/g, '');
  return limpio.length > 1 ? `${limpio.slice(0, -1)}-${limpio.slice(-1)}` : limpio;
};

// Dígito verificador, módulo 11 (igual que fn_rut_valido de la base de datos)
function rutValido(rut) {
  const r = normalizarRut(rut);
  if (!/^\d{7,8}-[\dK]$/.test(r)) return false;
  const [num, dv] = r.split('-');
  let suma = 0;
  [...num].reverse().forEach((d, i) => { suma += Number(d) * (2 + (i % 6)); });
  const esperado = (11 - (suma % 11)) % 11;
  return dv === (esperado === 10 ? 'K' : String(esperado));
}
module.exports = { normalizarRut, rutValido };

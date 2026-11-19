'use strict';
const crypto = require('node:crypto');
// Huella de un enlace de atención: permite saber qué enlace exacto se solicitó enviar y detectar que fue
// reemplazado, sin guardar el enlace dos veces.
const huellaEnlace = (enlace) => crypto.createHash('sha256').update(String(enlace || '')).digest('hex');
module.exports = { huellaEnlace };

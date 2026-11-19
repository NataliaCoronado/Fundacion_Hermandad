'use strict';
const crypto = require('node:crypto');
const huellaEnlace = (enlace) => crypto.createHash('sha256').update(String(enlace || '')).digest('hex');
module.exports = { huellaEnlace };

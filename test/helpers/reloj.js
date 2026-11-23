"use strict";
// Las horas de muestra son del 23 y 24 de noviembre de 2026. Para que las pruebas no dependan
// del día en que se corren, se fija el reloj en una fecha anterior (la espera de muestra es del 16).
// Se usa con `require("./helpers/reloj")` al inicio del archivo de prueba.
const test = require("node:test");
test.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 16, 9, 0) });

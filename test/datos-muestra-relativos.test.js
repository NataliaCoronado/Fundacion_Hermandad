"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearDatos } = require("../src/models/datosIniciales");
const { diaSemana, hoy } = require("../src/herramientas/tiempo");

const conReloj = (fecha, fn) => {
  test.mock.timers.enable({ apis: ["Date"], now: fecha });
  try { return fn(); } finally { test.mock.timers.reset(); }
};

// Cada caso: [día en que se corre, primer día de horas esperado]
const CASOS = [
  [new Date(2026, 10, 16, 9, 0), "2026-11-23"], // lunes → el lunes siguiente
  [new Date(2026, 10, 22, 21, 0), "2026-11-23"], // domingo → mañana lunes
  [new Date(2026, 10, 25, 10, 0), "2026-11-30"], // miércoles → lunes de la semana siguiente
  [new Date(2027, 2, 10, 8, 0), "2027-03-15"],
];

for (const [ahora, primero] of CASOS) {
  test(`Datos de muestra desde ${ahora.toDateString()}: horas el lunes y martes siguientes, siempre a futuro`, () => {
    conReloj(ahora, () => {
      const d = crearDatos();
      const fechas = [...new Set(d.bloques.map((b) => b.fecha))].sort();
      assert.equal(fechas.length, 2);
      assert.equal(fechas[0], primero);
      assert.equal(diaSemana(fechas[0]), 0, "el primer día es lunes");
      assert.equal(diaSemana(fechas[1]), 1, "el segundo día es martes");
      assert.ok(fechas[0] > hoy(), "las horas quedan después de hoy");
      assert.equal(d.espera[0].registradaEn, hoy(), "la espera de muestra se registró hoy");
    });
  });
}

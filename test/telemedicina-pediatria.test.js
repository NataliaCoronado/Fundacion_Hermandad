"use strict";
require("./helpers/reloj");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/armarAplicacion");
const { SEDES, profesionalesDeMuestra } = require("../src/models/informacionDeSedes");

const telemedicina = SEDES.find((s) => s.telemedicina);

test("Telemedicina ofrece Pediatría, además de Medicina General, Psicología adultos y Fonoaudiología", () => {
  for (const esp of ["Medicina General", "Psicología adultos", "Fonoaudiología", "Pediatría"])
    assert.ok(telemedicina.especialidades.includes(esp), `falta ${esp}`);
});

test("Hay un profesional de muestra de Pediatría en Telemedicina", () => {
  assert.ok(profesionalesDeMuestra().some((p) => p.idPoliclinico === telemedicina.id && p.especialidad === "Pediatría"));
});

test("Se pueden reservar horas de Pediatría por Telemedicina", async () => {
  const c = await crearContenedor();
  await c.inicializar();
  const libres = await c.agendamiento.bloquesDisponibles({ idPoliclinico: telemedicina.id, especialidad: "Pediatría" });
  assert.ok(libres.length > 0, "hay horas de Pediatría en Telemedicina");
});

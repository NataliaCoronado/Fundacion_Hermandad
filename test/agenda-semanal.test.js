"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calendario } = require("../src/views/operacion");

test("Agenda semanal separa citas simultáneas y que cruzan de hora", () => {
  const sede = { id: 1, nombre: "Sede de prueba" };
  const listaProfs = Array.from({ length: 4 }, (_, i) => ({
    id: i + 1,
    nombre: "Profesional " + (i + 1),
    activo: true,
    especialidad: "Medicina General",
  }));
  const bloques = [
    { id: 101, idProfesional: 1, fecha: "2026-11-23", hora: "09:00", duracion: 90 },
    { id: 102, idProfesional: 2, fecha: "2026-11-23", hora: "09:00", duracion: 30 },
    { id: 103, idProfesional: 3, fecha: "2026-11-23", hora: "10:00", duracion: 30 },
    { id: 104, idProfesional: 1, fecha: "2026-11-23", hora: "10:30", duracion: 10 },
    { id: 105, idProfesional: 4, fecha: "2026-11-25", hora: "09:00", duracion: 30 },
  ];
  const ctx = {
    listaProfs,
    listaSedes: [sede],
    sedes: new Map([[sede.id, sede]]),
    profs: new Map(listaProfs.map((p) => [p.id, p])),
    pacientes: new Map(),
    bloques: new Map(bloques.map((b) => [b.id, { ...b, publicado: true }])),
  };
  const op = {
    lugares: (p, fecha) => p.id === 4 && fecha < "2026-11-25" ? [2] : [1],
    sedeBloque: () => 1,
    meta: { sedes: {}, especialidades: {} },
  };
  const html = calendario({
    u: { rol: "ADMINISTRACION", nombre: "Administración" },
    q: new URLSearchParams({ sede: "1", fecha: "2026-11-23", vista: "semana" }),
    admin: true,
    citas: [],
    op,
    ctx,
  });

  const tarjetas = new Map(
    [...html.matchAll(/<a class="schedule-block" style="([^"]+)" href="\/admin\/cupo\?idBloque=(\d+)"/g)]
      .map(([, style, id]) => [Number(id), style]),
  );
  assert.deepEqual([...tarjetas.keys()], [101, 102, 105, 103, 104]);
  assert.match(tarjetas.get(101), /--lane-start:0%;--lane-end:50%/);
  assert.match(tarjetas.get(102), /--lane-start:50%;--lane-end:0%/);
  assert.match(tarjetas.get(103), /--lane-start:50%;--lane-end:0%/);
  assert.match(tarjetas.get(104), /--lane-start:0%;--lane-end:50%/);
  assert.match(tarjetas.get(105), /--lane-start:0%;--lane-end:0%/);
});

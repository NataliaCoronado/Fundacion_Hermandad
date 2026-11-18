"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearContenedor } = require("../src/contenedor");
const { crearOperacionController } = require("../src/controllers/operacion");

test("Agenda conserva el contexto al guardar y confirma una vez en la vista de origen", async () => {
  const c = crearContenedor();
  const controller = crearOperacionController(c);
  const usuario = { id: "u2", nombre: "TENS", rol: "TENS_TONS", idPoliclinico: 1 };
  const token = c.sesiones.crear(usuario);
  const filtros = new URLSearchParams({
    fecha: "2026-11-23",
    vista: "lista",
    esp: "Medicina General",
    prof: "1",
    estado: "Llegó",
    q: "Paciente",
  });
  const volver = "/tens/agenda?" + filtros;
  const respuesta = await controller.flujo({
    usuario,
    token,
    cuerpo: { idCita: "1", estado: "Llegó", volverAgenda: volver + "&sede=7&extra=ignorado" },
  });
  assert.equal(respuesta.redirigir, volver);
  assert.equal((await c.citaRepo.buscarPorId(1)).flujo, "Llegó");

  const confirmacion = /El estado de la reserva se guardó\./;
  const agenda = (consulta) => controller.tensAgenda({ usuario, token, consulta });
  assert.equal(confirmacion.test((await agenda(new URLSearchParams("vista=dia"))).html), false);
  assert.equal(confirmacion.test((await agenda(filtros)).html), true);
  assert.equal(confirmacion.test((await agenda(filtros)).html), false);

  const error = await controller.flujo({
    usuario,
    token,
    cuerpo: { idCita: "1", estado: "Inválido", volverAgenda: volver },
  });
  assert.equal(error.estado, 400);
  assert.ok(error.html.includes('href="' + volver.replaceAll("&", "&amp;") + '"'));

  const destinoExterno = await controller.flujo({
    usuario,
    token,
    cuerpo: { idCita: "1", estado: "En sala", volverAgenda: "//example.test/agenda" },
  });
  assert.equal(destinoExterno.redirigir, "/tens/agenda");
});

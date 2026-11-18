"use strict";
// Funciones traídas de la versión anterior: cancelaciones en lote, cupos por rango y eliminación de integrantes.
const test = require("node:test"),
  assert = require("node:assert/strict");
const { crearContenedor } = require("../src/contenedor");
const { crearServidor } = require("../src/server");
const { hoy, sumarDias } = require("../src/util/tiempo");

async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const r = await fetch(base + "/login", {
    method: "POST",
    redirect: "manual",
    body: new URLSearchParams({ correo: "admin@ejemplo.cl", clave: "demo1234" }),
  });
  const a = r.headers.get("set-cookie").split(";")[0];
  return {
    c,
    req: (ruta, d) =>
      fetch(base + ruta, {
        method: d ? "POST" : "GET",
        headers: { Cookie: a },
        body: d ? new URLSearchParams(d) : undefined,
        redirect: "manual",
      }),
    cerrar: () => new Promise((r) => srv.close(r)),
  };
}

test("cancelaciones: cancela en lote, bloquea el horario y permite reprogramar", async () => {
  const s = await sitio();
  try {
    const pagina = await (await s.req("/admin/cancelaciones")).text();
    assert.match(pagina, /Cancelaciones institucionales/);
    assert.match(pagina, /data-list="idCitas" value="1"/);

    const sinMotivo = await s.req("/admin/cancelaciones", { idCitas: "1", motivo: "No responde", destino: "Bloqueado" });
    assert.equal(sinMotivo.status, 400);
    assert.equal((await s.c.citaRepo.buscarPorId(1)).estadoReserva, "ACTIVA");

    const r = await s.req("/admin/cancelaciones", { idCitas: "1", motivo: "Corte de luz", destino: "Bloqueado" });
    assert.equal(r.status, 200);
    assert.match(await r.text(), /1 reserva\(s\) cancelada\(s\)/);
    const cita = await s.c.citaRepo.buscarPorId(1);
    assert.equal(cita.estadoReserva, "CANCELADA");
    assert.equal(cita.origenCancelacion, "INSTITUCIONAL");
    assert.equal((await s.c.catalogo.bloque(1)).publicado, false);

    const lista = await (await s.req("/admin/cancelaciones")).text();
    assert.match(lista, /Pendientes de reprogramar \(1\)/);

    const opciones = await (await s.req("/admin/cancelaciones/reprogramar?idCita=1")).text();
    const idBloque = opciones.match(/name="idBloque" value="(\d+)"/)?.[1];
    assert.ok(idBloque, "debe ofrecer al menos una hora disponible");
    const g = await s.req("/admin/cancelaciones/reprogramar", { idCita: "1", idBloque });
    assert.equal(g.status, 200);
    assert.match(await g.text(), /Pendientes de reprogramar \(0\)/);
    const nueva = (await s.c.citaRepo.buscarPorRut("11111111-1")).find((x) => x.estadoReserva === "ACTIVA" && x.idBloque === +idBloque);
    assert.ok(nueva, "la nueva reserva queda activa");

    const otraVez = await s.req("/admin/cancelaciones/reprogramar", { idCita: "1", idBloque });
    assert.equal(otraVez.status, 400);
  } finally {
    await s.cerrar();
  }
});

test("cupos por rango: cambia solo los cupos libres del filtro", async () => {
  const s = await sitio();
  try {
    const desde = hoy(),
      hasta = sumarDias(hoy(), 30);
    const r = await s.req("/admin/cupos/rango", { desde, hasta, prof: "1", estado: "Bloqueado" });
    assert.equal(r.status, 200);
    assert.match(await r.text(), /cupo\(s\) quedaron en estado/);
    const bloques = (await s.c.catalogo.bloques()).filter((b) => b.idProfesional === 1 && b.fecha >= desde && b.fecha <= hasta);
    assert.equal((await s.c.catalogo.bloque(1)).publicado, true, "el cupo con reserva activa no cambia");
    for (const b of bloques.filter((b) => b.id !== 1 && b.id !== 2)) assert.equal(b.publicado, false);
    assert.ok((await s.c.catalogo.bloques()).some((b) => b.idProfesional !== 1 && b.publicado), "otros profesionales no cambian");

    const malo = await s.req("/admin/cupos/rango", { desde: hasta, hasta: desde, estado: "Bloqueado" });
    assert.equal(malo.status, 400);
  } finally {
    await s.cerrar();
  }
});

test("equipo: solo se elimina un integrante sin reservas ni historial", async () => {
  const s = await sitio();
  try {
    const conHistorial = await s.req("/admin/equipo/eliminar", { idProfesional: "1" });
    assert.equal(conHistorial.status, 400);
    assert.ok(await s.c.catalogo.profesional(1));

    await s.req("/admin/profesionales/estado", { idProfesional: "4", activo: "0" });
    assert.match(await (await s.req("/admin/profesionales")).text(), /action="\/admin\/equipo\/eliminar"/);
    const r = await s.req("/admin/equipo/eliminar", { idProfesional: "4" });
    assert.equal(r.status, 302);
    assert.equal(await s.c.catalogo.profesional(4), null);
    assert.ok(!(await s.c.catalogo.bloques()).some((b) => b.idProfesional === 4));
  } finally {
    await s.cerrar();
  }
});

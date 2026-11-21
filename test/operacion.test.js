"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { crearContenedor } = require("../src/armarAplicacion");
const { crearServidor } = require("../src/server");
const admin = { id: "u1", nombre: "Administración", rol: "ADMINISTRACION" },
  tens = { id: "u2", nombre: "TENS", rol: "TENS_TONS", idPoliclinico: 1 },
  tele = { id: "u3", nombre: "Remoto", rol: "TELEMEDICINA", idPoliclinico: 7 };
const serie = (d = {}) => ({
  idProfesional: "1",
  idPoliclinico: "1",
  especialidad: "Medicina General",
  desde: "2028-01-03",
  hasta: "2028-01-03",
  repeticion: "unica",
  horaInicio: "09:00",
  horaFin: "10:00",
  duracion: "20",
  publicado: "0",
  ...d,
});
async function sitio() {
  const c = crearContenedor();
  await c.inicializar();
  const srv = crearServidor(c);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const login = async (correo) => {
    const r = await fetch(base + "/login", {
      method: "POST",
      redirect: "manual",
      body: new URLSearchParams({ correo, clave: "demo1234" }),
    });
    return r.headers.get("set-cookie").split(";")[0];
  };
  const a = await login("admin@ejemplo.cl"),
    t = await login("tens@ejemplo.cl"),
    tm = await login("telemedicina.usuario@ejemplo.cl");
  return {
    c,
    base,
    a,
    t,
    tm,
    req: (ruta, cookie, d) =>
      fetch(base + ruta, {
        method: d ? "POST" : "GET",
        headers: { Cookie: cookie },
        body: d ? new URLSearchParams(d) : undefined,
        redirect: "manual",
      }),
    cerrar: () => new Promise((r) => srv.close(r)),
  };
}
test("bloques: resumen, duración real, publicación y conflicto parcial sin escritura", async () => {
  const c = crearContenedor(),
    p = await c.operacion.plan(serie());
  assert.equal(p.cupos.length, 3);
  assert.equal(p.conflictos.length, 0);
  await c.operacion.crearSerie(serie(), admin);
  const bs = (await c.catalogo.bloques()).filter(
    (b) => b.fecha === "2028-01-03" && b.idProfesional === 1,
  );
  assert.deepEqual(
    bs.map((b) => b.hora),
    ["09:00", "09:20", "09:40"],
  );
  assert.ok(
    bs.every(
      (b) => b.duracion === 20 && !b.publicado && b.estado === "Sin publicar",
    ),
  );
  const n = (await c.catalogo.bloques()).length;
  await assert.rejects(
    () =>
      c.operacion.crearSerie(
        serie({ horaInicio: "09:10", horaFin: "09:50" }),
        admin,
      ),
    /cruces/,
  );
  assert.equal((await c.catalogo.bloques()).length, n);
  assert.ok(c.auditoria.listar()[0].despues.cupos === 3);
});
test("cruce de un profesional se detecta entre lugares distintos y vigencias se respetan", async () => {
  const c = crearContenedor();
  c.operacion.meta.equipo[1] = {
    lugares: [1, 3],
    vigenteDesde: "2027-01-01",
    lugaresAnteriores: [1],
  };
  await c.operacion.crearSerie(serie(), admin);
  const p = await c.operacion.plan(serie({ idPoliclinico: "3" }));
  assert.equal(p.conflictos.length, 3);
  await assert.rejects(
    () => c.operacion.plan(serie({ idPoliclinico: "7" })),
    /asignado/,
  );
  assert.deepEqual(
    c.operacion.lugares(await c.catalogo.profesional(1), "2026-12-30"),
    [1],
  );
});
test("equipo: reserva futura impide retirar un lugar; desactivación conserva historial", async () => {
  const c = crearContenedor();
  const r = await c.operacion.equipo(
    {
      id: "1",
      nombre: "Profesional 1",
      tipo: "Médico",
      lugares: "3",
      especialidades: "Medicina General",
      vigenteDesde: "2026-11-01",
    },
    admin,
    true,
  );
  assert.equal(r.guardado, undefined);
  assert.equal(r.afectados.length, 2);
  assert.equal((await c.catalogo.profesional(1)).idPoliclinico, 1);
});
test("pacientes: acceso por relación administrativa; un RUT existente no concede acceso global", async () => {
  const c = crearContenedor();
  assert.equal(await c.operacion.acceso(tens, "11111111-1"), true);
  assert.equal(await c.operacion.acceso(tele, "11111111-1"), false);
  assert.equal(await c.operacion.acceso(tens, "33333333-3"), false);
  c.operacion.asociarPaciente(tele, "33333333-3");
  assert.equal(await c.operacion.acceso(tele, "33333333-3"), true);
  assert.equal(await c.operacion.acceso(tens, "33333333-3"), false);
});
test("comunicaciones: no se inventan envíos ni se envía sin consentimiento", async () => {
  const c = crearContenedor(),
    x = await c.citaRepo.buscarPorId(1);
  const m = await c.operacion.comunicar(tens, x, "WhatsApp");
  assert.equal(m.estado, "Error");
  (c.operacion.meta.pacientes[x.rut] ||= {}).consentimientoComunicaciones =
    true;
  assert.equal(
    (await c.operacion.comunicar(tens, x, "WhatsApp")).estado,
    "Pendiente",
  );
  assert.equal((await c.citaRepo.buscarPorId(1)).estadoReserva, "ACTIVA");
});
test("enlace de contraseña: un solo uso, caducidad y revocación de sesiones", async () => {
  const c = crearContenedor();
  await c.inicializar();
  const login = await c.auth.iniciarSesion("tens@ejemplo.cl", "demo1234");
  const enlace = await c.operacion.enlaceClave("u2", admin),
    token = new URL(enlace, "http://local").searchParams.get("token");
  assert.ok(!JSON.stringify(c.operacion.meta.restablecer).includes(token));
  await c.operacion.restablecer(token, "clave-nueva-12345");
  assert.equal(c.sesiones.obtener(login.token), null);
  await assert.rejects(
    () => c.operacion.restablecer(token, "otra-clave-12345"),
    /expiró/,
  );
  assert.ok(
    (await c.auth.iniciarSesion("tens@ejemplo.cl", "clave-nueva-12345")).token,
  );
});
test("expiración por inactividad y permisos de cuentas sin lugar", async () => {
  const c = crearContenedor(),
    token = c.sesiones.crear(tens);
  c.sesiones.mapa.get(token).ultimaActividad = Date.now() - 31 * 60e3;
  assert.equal(c.sesiones.obtener(token), null);
  await assert.rejects(
    () =>
      c.operacion.usuario(
        {
          nombre: "Sin sede",
          correo: "sin@ejemplo.cl",
          rol: "TENS_TONS",
          lugares: "",
          activo: "1",
        },
        admin,
      ),
    /Asigna/,
  );
});
test("persistencia: conserva pacientes, metadatos y auditoría entre contenedores", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hermandad-")),
    archivo = path.join(dir, "estado.json"),
    { GuardadoEnArchivoJson } = require("../src/repositories/GuardadoEnArchivoJson");
  try {
    let c = crearContenedor({ persistencia: new GuardadoEnArchivoJson(archivo) });
    c.operacion.asociarPaciente(tens, "33333333-3");
    await c.operacion.crearSerie(serie(), admin);
    c.guardar();
    c = crearContenedor({ persistencia: new GuardadoEnArchivoJson(archivo) });
    assert.equal(await c.operacion.acceso(tens, "33333333-3"), true);
    assert.ok(
      (await c.catalogo.bloques()).some((b) => b.fecha === "2028-01-03"),
    );
    assert.equal(c.auditoria.listar()[0].modulo, "Agendas");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("HTTP: navegación por rol y bloque institucional restringido", async () => {
  const s = await sitio();
  try {
    const html = await (await s.req("/admin/agendas", s.a)).text();
    for (const t of [
      "Agendas y cupos",
      "Equipo de salud",
      "Policlínicos y especialidades",
      "Reportes",
    ])
      assert.ok(html.includes(t));
    assert.equal(
      (await s.req("/admin/bloque/guardar", s.t, serie())).status,
      403,
    );
    for (const ruta of [
      "/tens/ficha?rut=11111111-1",
      "/tens/pacientes/editar?rut=11111111-1",
    ])
      assert.equal((await s.req(ruta, s.tm)).status, 403);
    assert.equal((await s.req("/tens/ficha?rut=33333333-3", s.t)).status, 403);
    assert.equal(
      (
        await s.req("/tens/espera/gestion", s.t, {
          idSolicitud: "1",
          estado: "No responde",
          canal: "Llamada",
        })
      ).status,
      403,
    );
  } finally {
    await s.cerrar();
  }
});
test("HTTP: flujo, reserva, reagendamiento y cancelación conservan auditoría", async () => {
  const s = await sitio();
  try {
    const flujo = await s.req("/tens/flujo", s.t, { idCita: "1", estado: "Llegó" });
    assert.equal(flujo.status, 302);
    assert.equal(flujo.headers.get("location"), "/tens/agenda");
    assert.equal((await s.c.citaRepo.buscarPorId(1)).flujo, "Llegó");
    assert.equal(
      (
        await s.req("/tens/reagendar", s.t, {
          idCita: "1",
          idBloque: "3",
          motivo: "Solicitud del paciente",
        })
      ).status,
      302,
    );
    assert.equal(
      (await s.c.citaRepo.buscarPorId(1)).estadoReserva,
      "CANCELADA",
    );
    const x = (await s.c.citaRepo.listar()).find(
      (x) => x.idBloque === 3 && x.estadoReserva === "ACTIVA",
    );
    assert.ok(x);
    assert.equal(
      (
        await s.req("/tens/cancelar", s.t, {
          idCita: x.id,
          motivo: "No responde",
          canal: "Llamada",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.req("/tens/cancelar", s.t, {
          idCita: x.id,
          motivo: "Paciente solicita otra fecha",
          canal: "WhatsApp",
          destino: "Bloqueado",
        })
      ).status,
      302,
    );
    assert.equal((await s.c.catalogo.bloque(3)).estado, "Bloqueado");
    assert.equal((await s.c.catalogo.bloque(3)).publicado, false);
    assert.ok(
      s.c.auditoria
        .listar()
        .some((x) => x.accion === "Reserva reprogramada" && x.antes.id === 1),
    );
  } finally {
    await s.cerrar();
  }
});
test("HTTP: Lista del día filtra por RUT, mantiene filtros y registra llegada desde la Agenda", async () => {
  const s = await sitio();
  try {
    const filtros = new URLSearchParams({
      fecha: "2026-11-23",
      vista: "lista",
      estado: "Pendiente",
      q: "11.111.111-1",
    });
    const ruta = "/tens/agenda?" + filtros;
    const html = await (await s.req(ruta, s.t)).text();
    assert.match(html, /aria-current="page">Lista del día/);
    assert.match(html, /<ul class="agenda-lista"/);
    assert.equal((html.match(/<li class="agenda-fila">/g) || []).length, 1);
    assert.match(html, /Paciente A/);
    assert.doesNotMatch(html, /Paciente B|<option value="No se conectó"/);
    assert.match(html, /<option value="Llegó"/);
    assert.match(html, /Registrar llegada/);
    assert.match(html, /name="volverAgenda" value="\/tens\/agenda\?/);
    assert.match(html, /estado=Pendiente&amp;q=11.111.111-1&amp;vista=semana/);
    assert.match(html, /name="estado" value="Pendiente"/);

    const respuesta = await s.req("/tens/flujo", s.t, {
      idCita: "1", estado: "Llegó", volverAgenda: ruta,
    });
    assert.equal(respuesta.status, 302);
    assert.equal(respuesta.headers.get("location"), ruta);
    assert.match(await (await s.req(ruta, s.t)).text(), /Estado de la reserva actualizado/);

    filtros.set("estado", "Llegó");
    const actualizado = await (await s.req("/tens/agenda?" + filtros, s.t)).text();
    assert.match(actualizado, /Paciente A/);
    assert.match(actualizado, />Llegó<\/span>/);
    assert.doesNotMatch(actualizado, /Registrar llegada/);
  } finally {
    await s.cerrar();
  }
});
test("HTTP: Telemedicina no ve sede presencial; enlace HTTPS y flujo remoto", async () => {
  const s = await sitio();
  try {
    const bloques = await s.c.agendamiento.bloquesDisponibles({
        idPoliclinico: 7,
      }),
      x = await s.c.agendamiento.agendar({
        rut: "11111111-1",
        idBloque: bloques[0].id,
        idUsuario: "u3",
      });
    assert.equal(
      (
        await s.req("/tens/enlace", s.t, {
          idCita: x.id,
          enlace: "https://example.org/sala",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await s.req("/tens/enlace", s.tm, {
          idCita: x.id,
          enlace: "javascript:alert(1)",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await s.req("/tens/enlace", s.tm, {
          idCita: x.id,
          enlace: "https://example.org/sala",
        })
      ).status,
      302,
    );
    const volverAgenda = "/tens/agenda?fecha=" + bloques[0].fecha + "&vista=lista";
    const rutaDetalle = "/tens/reserva?" + new URLSearchParams({ idCita: x.id, volverAgenda });
    const detalle = async () => (await s.req(rutaDetalle, s.tm)).text();
    const pedirEnvio = () => s.req("/tens/comunicacion", s.tm, {
      idCita: x.id,
      canal: "Correo",
      tipo: "Enlace de atención",
      origen: "reserva",
      volverAgenda,
    });

    assert.match(await detalle(), /Enlace guardado/);
    assert.match(await detalle(), /Solicitar envío por correo/);
    assert.equal((await pedirEnvio()).headers.get("location"), rutaDetalle);
    assert.match(await detalle(), /Error de envío/);

    const paciente = await s.c.catalogo.paciente(x.rut);
    await s.c.catalogo.actualizarPaciente(x.rut, { ...paciente, correo: "paciente@example.test" });
    s.c.operacion.registrarConsentimiento(x.rut, { canal: "correo", comunicaciones: true });
    assert.equal((await pedirEnvio()).headers.get("location"), rutaDetalle);
    const pendiente = await detalle();
    assert.match(pendiente, /Pendiente de envío/);
    assert.doesNotMatch(pendiente, /Enlace enviado|Solicitar envío por correo/);

    assert.equal((await pedirEnvio()).headers.get("location"), rutaDetalle);
    const comunicaciones = s.c.extras.listar("comunicaciones");
    assert.equal(comunicaciones.filter((m) => m.estado === "Pendiente").length, 1);
    const solicitud = comunicaciones.at(-1);
    s.c.extras.actualizar("comunicaciones", solicitud.id, { estado: "Entregado" });
    assert.match(await detalle(), /Enlace enviado/);
    const cambiarEnlace = await s.req("/tens/enlace", s.tm, {
      idCita: x.id,
      enlace: "https://example.org/otra-sala",
      volverAgenda,
    });
    assert.equal(cambiarEnlace.headers.get("location"), rutaDetalle);
    const reemplazado = await detalle();
    assert.match(reemplazado, /Enlace guardado/);
    assert.doesNotMatch(reemplazado, /Enlace enviado/);
    const vistaLista = await (await s.req(volverAgenda, s.tm)).text();
    assert.match(vistaLista, /Marcar conexión/);
    assert.match(vistaLista, /<option value="No se conectó"/);
    assert.doesNotMatch(vistaLista, /<option value="Llegó"|Registrar llegada/);

    const flujo = await s.req("/tens/flujo", s.tm, { idCita: x.id, estado: "Conectado" });
    assert.equal(flujo.status, 302);
    assert.equal(flujo.headers.get("location"), "/tens/agenda");
    assert.equal((await s.c.citaRepo.buscarPorId(x.id)).flujo, "Conectado");
    assert.equal((await s.req("/tens/reserva?idCita=1", s.tm)).status, 403);
    const h = await (
      await s.req("/tens/agenda?sede=1&fecha=2026-11-23", s.tm)
    ).text();
    assert.ok(h.includes("Gestión de Telemedicina"));
    assert.ok(!h.includes("Paciente B"));
  } finally {
    await s.cerrar();
  }
});
test("HTTP: exportaciones genuinas, sin RUT, con filtros y datos del gráfico", async () => {
  const s = await sitio();
  try {
    await s.c.agendamiento.registrarAsistencia(1, true);
    for (const formato of ["pdf", "xlsx"]) {
      const r = await s.req(
        "/admin/reportes/exportar?grafico=sexo&formato=" +
          formato +
          "&desde=2026-11-01&hasta=2026-11-30",
        s.a,
      );
      assert.equal(r.status, 200);
      const b = Buffer.from(await r.arrayBuffer());
      assert.equal(
        b.subarray(0, formato === "pdf" ? 4 : 2).toString(),
        formato === "pdf" ? "%PDF" : "PK",
      );
      assert.ok(!b.includes(Buffer.from("11111111-1")));
      assert.ok(b.includes(Buffer.from("2026-11-01")));
    }
    assert.equal(
      (await s.req("/admin/reportes/exportar?grafico=sexo&formato=pdf", s.t))
        .status,
      403,
    );
  } finally {
    await s.cerrar();
  }
});

test('HTTP: cambio institucional exige revisión vigente y mueve fecha/hora sin perder reserva',async()=>{const s=await sitio();try{const d={idProfesional:'1',fecha:'2026-11-23',tipo:'HORARIO',nuevaFecha:'2028-02-01',nuevaHoraInicio:'11:00',motivo:'Ajuste institucional',destino:'Bloqueado'};const r=await s.req('/admin/cambio/revisar',s.a,d);assert.equal(r.status,200);const html=await r.text(),huella=/name="huella" value="([a-f0-9]+)"/.exec(html)?.[1];assert.ok(huella);assert.equal((await s.req('/admin/cambio/guardar',s.a,{...d,huella:'invalida'})).status,400);assert.equal((await s.c.catalogo.bloque(1)).fecha,'2026-11-23');assert.equal((await s.req('/admin/cambio/guardar',s.a,{...d,huella})).status,302);assert.equal((await s.c.catalogo.bloque(1)).fecha,'2028-02-01');assert.equal((await s.c.catalogo.bloque(1)).hora,'11:00');assert.equal((await s.c.citaRepo.buscarPorId(1)).estadoReserva,'ACTIVA');assert.ok(s.c.auditoria.listar().some(x=>x.accion==='Cambio de agenda aplicado'&&x.antes.length===4));}finally{await s.cerrar();}});
test('HTTP: PNG descargable en servidor es válido y los permisos se mantienen',async()=>{const s=await sitio();try{const r=await s.req('/admin/reportes/exportar?grafico=sexo&formato=png',s.a);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');const b=Buffer.from(await r.arrayBuffer());assert.ok(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.equal(b.readUInt32BE(16),1400);assert.equal((await s.req('/admin/reportes/exportar?grafico=sexo&formato=png',s.t)).status,403);}finally{await s.cerrar();}});
test('documentos: reemplazar y archivar conserva el original y restringe sede',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'documentos-hermandad-')),anterior=process.env.DIR_DOCUMENTOS;process.env.DIR_DOCUMENTOS=dir;try{const c=crearContenedor(),archivo={nombre:'orden.pdf',datos:Buffer.from('%PDF-1.4\nprueba')};const d=await c.documentos.registrar({rut:'11111111-1',tipo:'Orden médica / derivación',usuario:tens,archivo,vigencia:'2028-01-01'});const n=await c.documentos.registrar({rut:d.rut,tipo:d.tipo,usuario:tens,archivo,reemplazar:d.id});assert.equal(c.extras.buscar('documentos',d.id).archivado,true);assert.equal(n.reemplaza,d.id);assert.ok(fs.existsSync(c.documentos.archivo(d.id).ruta));await assert.rejects(()=>c.documentos.registrar({rut:d.rut,tipo:d.tipo,usuario:tele,archivo,reemplazar:n.id}),/FUERA_DE_SEDE/);}finally{fs.rmSync(dir,{recursive:true,force:true});if(anterior)process.env.DIR_DOCUMENTOS=anterior;else delete process.env.DIR_DOCUMENTOS;}});

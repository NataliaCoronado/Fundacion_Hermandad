"use strict";
const crypto = require("node:crypto");
const { hoy, sumarDias, diaSemana, textoLocal } = require("../util/tiempo");
const { normalizarRut } = require("../util/rut");
const { hashClave } = require("../auth/clave");
const { infoSede } = require("../models/sedesInfo");
const { huellaEnlace } = require("../util/huella");
const fechaValida = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v || "") &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const minutos = (h) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(h || ""))
    throw new Error("Revisa el horario.");
  return +h.slice(0, 2) * 60 + +h.slice(3);
};
const hora = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const ids = (s) =>
  String(s || "")
    .split(",")
    .map(Number)
    .filter(Number.isInteger)
    .filter((n) => n > 0);
class OperacionService {
  constructor(c) {
    Object.assign(this, c);
    const e = c.extras.extras;
    e.operacion ||= {
      equipo: {},
      sedes: {},
      especialidades: {},
      bloques: {},
      pacientes: {},
      usuarios: {},
      citas: {},
      espera: {},
      restablecer: {},
    };
    e.comunicaciones ||= [];
    this.meta = e.operacion;
    this.catalogo.oferta=id=>this.meta.sedes[id]?.especialidades||infoSede(id)?.especialidades||[];
    this.catalogo.especialidadActiva=esp=>this.meta.especialidades[esp]?.activo!==false;
    for (const [metodo, tipo] of [
      ["profesionales", "equipo"],
      ["policlinicos", "sedes"],
      ["bloques", "bloques"],
      ["pacientes", "pacientes"],
      ["usuarios", "usuarios"],
      ["espera", "espera"],
    ]) {
      const original = this.catalogo[metodo].bind(this.catalogo);
      this.catalogo[metodo] = async () =>
        (await original()).map((x) => ({
          ...x,
          ...this.meta[tipo][x.id ?? x.rut],
        }));
    }
    for (const [singular, plural] of [
      ["profesional", "profesionales"],
      ["policlinico", "policlinicos"],
      ["bloque", "bloques"],
      ["paciente", "pacientes"],
    ])
      this.catalogo[singular] = async (id) =>
        (await this.catalogo[plural]()).find(
          (x) => String(x.id ?? x.rut) === String(id),
        ) || null;
    const especialidades = this.catalogo.especialidades.bind(this.catalogo);
    this.catalogo.especialidades = async () =>
      [
        ...new Set([
          ...(await especialidades()),
          ...Object.keys(this.meta.especialidades),
        ]),
      ].sort();
    this.catalogo.usuarioPorCorreo = async (correo) =>
      (await this.catalogo.usuarios()).find(
        (u) => u.correo.toLowerCase() === String(correo).toLowerCase(),
      ) || null;
    const listar = this.citaRepo.listar.bind(this.citaRepo);
    this.citaRepo.listar = async () =>
      (await listar()).map((x) => ({ ...x, ...this.meta.citas[x.id] }));
    this.citaRepo.buscarPorId = async (id) =>
      (await this.citaRepo.listar()).find((x) => x.id === Number(id)) || null;
    this.citaRepo.buscarPorRut = async (rut) =>
      (await this.citaRepo.listar()).filter((x) => x.rut === rut);
  }
  sedeBloque(b, p) {
    return Number(b?.idPoliclinico || p?.idPoliclinico);
  }
  lugares(p, fecha = hoy()) {
    const m = this.meta.equipo[p.id] || {};
    return m.vigenteDesde && fecha < m.vigenteDesde
      ? m.lugaresAnteriores || [p.idPoliclinico]
      : m.lugares || [p.idPoliclinico];
  }
  async acceso(u, rut) {
    if (!u?.idPoliclinico) return false;
    const p = await this.catalogo.paciente(normalizarRut(rut));
    if (!p) return false;
    if (this.meta.pacientes[p.rut]?.sedes?.includes(Number(u.idPoliclinico)))
      return true;
    const ps = new Map(
        (await this.catalogo.profesionales()).map((p) => [p.id, p]),
      ),
      bs = new Map((await this.catalogo.bloques()).map((b) => [b.id, b]));
    if (
      (await this.citaRepo.buscarPorRut(p.rut)).some((c) => {
        const b = bs.get(c.idBloque);
        return (
          this.sedeBloque(b, ps.get(b?.idProfesional)) ===
          Number(u.idPoliclinico)
        );
      })
    )
      return true;
    return (await this.catalogo.espera()).some(
      (e) => e.rut === p.rut && e.idPoliclinico === Number(u.idPoliclinico),
    );
  }
  async exigirPaciente(u, rut) {
    if (!(await this.acceso(u, rut))) throw new Error("FUERA_DE_SEDE");
  }
  asociarPaciente(u, rut) {
    const m = (this.meta.pacientes[rut] ||= {});
    m.sedes = [...new Set([...(m.sedes || []), Number(u.idPoliclinico)])];
    m.lugarHabitual ||= Number(u.idPoliclinico);
  }
  // Deja constancia del consentimiento de tratamiento de datos (y, si se aceptó, del de comunicaciones).
  registrarConsentimiento(rut, { canal, comunicaciones = false, usuario = null }) {
    const m = (this.meta.pacientes[rut] ||= {});
    m.consentimiento = { fecha: textoLocal(), canal, version: "Política de privacidad vigente" };
    if (comunicaciones) {
      m.consentimientoComunicaciones = true;
      m.fechaConsentimientoComunicaciones = textoLocal();
    }
    this.aud(usuario || { nombre: "Paciente (portal)" }, "Consentimiento registrado", "Pacientes", rut, null, {
      canal,
      tratamientoDatos: true,
      comunicaciones: !!comunicaciones,
    });
    return m.consentimiento;
  }
  async exigirCita(u, id) {
    const c = await this.citaRepo.buscarPorId(id);
    if (!c) throw new Error("CITA_NO_ENCONTRADA");
    const b = await this.catalogo.bloque(c.idBloque),
      p = b && (await this.catalogo.profesional(b.idProfesional));
    if (
      u.rol !== "ADMINISTRACION" &&
      this.sedeBloque(b, p) !== Number(u.idPoliclinico)
    )
      throw new Error("FUERA_DE_SEDE");
    return c;
  }
  aud(u, accion, modulo, registro, antes, despues, sede) {
    return this.auditoria.registrar(u, accion, String(registro), {
      modulo,
      registro: String(registro),
      antes: structuredClone(antes ?? null),
      despues: structuredClone(despues ?? null),
      idPoliclinico: sede || u?.idPoliclinico || null,
    });
  }
  async plan(d) {
    const p = await this.catalogo.profesional(d.idProfesional);
    if (!p?.activo || ["TENS", "TONS"].includes(p.tipo))
      throw new Error("Profesional no disponible para agenda.");
    const sede = Number(d.idPoliclinico || p.idPoliclinico),
      lugar = await this.catalogo.policlinico(sede);
    if (!lugar || lugar.activo === false)
      throw new Error("Lugar no disponible.");
    const esp = d.especialidad || p.especialidad;
    if (!(p.especialidades || [p.especialidad]).includes(esp))
      throw new Error("Especialidad no asignada al profesional.");
    if (this.meta.especialidades[esp]?.activo === false)
      throw new Error("Especialidad inactiva.");
    const desde = d.desde || d.fecha,
      hasta = d.repeticion === "unica" ? desde : d.hasta || desde;
    if (
      !fechaValida(desde) ||
      !fechaValida(hasta) ||
      desde > hasta ||
      (Date.parse(hasta) - Date.parse(desde)) / 86400000 > 122
    )
      throw new Error("Revisa las fechas (máximo 123 días).");
    const ini = minutos(d.horaInicio),
      fin = minutos(d.horaFin),
      dur = Number(d.duracion);
    if (
      !Number.isInteger(dur) ||
      dur < 10 ||
      dur > 120 ||
      ini >= fin ||
      (fin - ini) % dur !== 0
    )
      throw new Error("Revisa el horario y la duración de atención.");
    const dias = Array.from({ length: 7 }, (_, i) => i).filter(
      (i) => d[`dia${i}`] === "1",
    );
    if (d.repeticion !== "unica" && !dias.length)
      throw new Error("Selecciona al menos un día.");
    const todosBloques=await this.catalogo.bloques();
    const reemplazadas=(await this.citaRepo.listar()).filter(x=>x.estadoReserva==="ACTIVA"&&x.idProfesionalReemplazo===p.id).map(x=>todosBloques.find(b=>b.id===x.idBloque)).filter(Boolean);
    const existentes = [...reemplazadas,...todosBloques.filter(
        (b) => b.idProfesional === p.id,
      )],
      cupos = [],
      conflictos = [],
      fechas = [];
    for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
      if (d.repeticion !== "unica" && !dias.includes(diaSemana(f))) continue;
      if (!this.lugares(p, f).includes(sede))
        throw new Error(
          "El lugar no está asignado al profesional en esa fecha.",
        );
      const oferta =
        this.meta.sedes[sede]?.especialidades ||
        infoSede(sede)?.especialidades ||
        [];
      if (!oferta.includes(esp))
        throw new Error("Especialidad no disponible en este lugar.");
      fechas.push(f);
      for (let m = ini; m + dur <= fin; m += dur) {
        const x = {
          idProfesional: p.id,
          idPoliclinico: sede,
          especialidad: esp,
          fecha: f,
          hora: hora(m),
          duracion: dur,
          publicado: d.publicado === "1",
        };
        const cr = existentes.filter(
          (b) =>
            b.fecha === f &&
            m < minutos(b.hora) + (b.duracion || 30) &&
            m + dur > minutos(b.hora),
        );
        if (cr.length) conflictos.push({ ...x, existentes: cr });
        cupos.push(x);
        if (cupos.length > 1000)
          throw new Error("Máximo 1000 cupos por operación.");
      }
    }
    if (!cupos.length)
      throw new Error("El rango no contiene días seleccionados.");
    return { p, sede, fechas, cupos, conflictos, datos: d };
  }
  async crearSerie(d, u) {
    const plan = await this.plan(d);
    if (plan.conflictos.length)
      throw new Error(
        "Existen cruces del profesional. Corrige los conflictos antes de guardar.",
      );
    const creados = [];
    const crear = async (repo=this.catalogo) => {
      for (const b of plan.cupos) {
        const n = await repo.crearBloque({ ...b, idUsuario: u.id });
        creados.push([n.id, b]);
      }
    };
    if (this.catalogo.db) await this.catalogo.conBloquesAtomicos(crear);
    else await crear();
    for (const [id, b] of creados)
      this.meta.bloques[id] = {
        idPoliclinico: b.idPoliclinico,
        especialidad: b.especialidad,
        duracion: b.duracion,
        estado: b.publicado ? "Disponible" : "Sin publicar",
      };
    this.aud(
      u,
      "Bloque horario creado",
      "Agendas",
      plan.p.id,
      null,
      {
        dias: plan.fechas,
        cupos: plan.cupos.length,
        publicado: d.publicado === "1",
      },
      plan.sede,
    );
    return plan;
  }
  async afectados(id, fecha) {
    const bs = new Set(
      (await this.catalogo.bloques())
        .filter((b) => b.idProfesional === Number(id) && b.fecha === fecha)
        .map((b) => b.id),
    );
    return (await this.citaRepo.listar()).filter(
      (c) => c.estadoReserva === "ACTIVA" && bs.has(c.idBloque),
    );
  }
  async equipo(d, u, confirmar = false) {
    const previo = d.id ? await this.catalogo.profesional(d.id) : null,
      lugares = ids(d.lugares),
      especialidades = String(d.especialidades || d.especialidad || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    if (
      !String(d.nombre || "").trim() ||
      !lugares.length ||
      !especialidades.length
    )
      throw new Error("Completa nombre, especialidades y lugares asignados.");
    if (!["Médico", "Profesional", "TENS", "TONS"].includes(d.tipo))
      throw new Error("Tipo de integrante inválido.");
    for (const id of lugares)
      if (!(await this.catalogo.policlinico(id)))
        throw new Error("Lugar inválido.");
    for (const id of lugares) {
      const oferta =
        this.meta.sedes[id]?.especialidades ||
        infoSede(id)?.especialidades ||
        [];
      for (const esp of especialidades)
        if (!oferta.includes(esp))
          throw new Error(
            "La especialidad no está disponible en todos los lugares seleccionados.",
          );
    }
    if (!fechaValida(d.vigenteDesde))
      throw new Error("Indica una fecha válida para la asignación.");
    const bloques = (await this.catalogo.bloques()).filter(
      (b) => b.idProfesional === previo?.id && b.fecha >= d.vigenteDesde,
    );
    const afectados = (await this.citaRepo.listar()).filter(
      (c) =>
        c.estadoReserva === "ACTIVA" &&
        bloques.some(
          (b) =>
            b.id === c.idBloque &&
            !lugares.includes(this.sedeBloque(b, previo)),
        ),
    );
    if (afectados.length || !confirmar)
      return { previo, afectados, bloques, datos: d };
    const p = await this.catalogo.guardarEquipo({
      ...d,
      id: d.id ? Number(d.id) : null,
      idPoliclinico: previo?.idPoliclinico || lugares[0],
      especialidad: especialidades[0],
      lugares,
      especialidades,
    });
    this.meta.equipo[p.id] = {
      ...(this.meta.equipo[p.id] || {}),
      nombre: d.nombre.trim(),
      tipo: d.tipo,
      profesion: d.profesion || d.tipo,
      lugares,
      especialidades,
      especialidad: especialidades[0],
      vigenteDesde: d.vigenteDesde,
      lugaresAnteriores: previo
        ? this.lugares(previo, sumarDias(d.vigenteDesde, -1))
        : lugares,
      foto: /^\/img\/[a-z0-9_-]+\.(png|jpg)$/.test(d.foto || "") ? d.foto : "",
    };
    this.aud(
      u,
      previo ? "Integrante actualizado" : "Integrante creado",
      "Equipo",
      p.id,
      previo,
      this.meta.equipo[p.id],
    );
    return { guardado: true };
  }
  ultimaSolicitudEnlace(idCita, huella, canal) {
    return this.extras.listar("comunicaciones").findLast(
      (m) =>
        m.idCita === idCita &&
        m.tipo === "Enlace de atención" &&
        m.huellaEnlace === huella &&
        (!canal || m.canal === canal),
    );
  }
  estadoEnvioEnlace(c) {
    if (!c.enlace) return { estado: "Enlace pendiente", detalle: "" };
    const solicitud = this.ultimaSolicitudEnlace(c.id, huellaEnlace(c.enlace));
    const estados = {
      Pendiente: "Pendiente de envío",
      Enviado: "Enlace enviado",
      Simulado: "Enlace simulado",
      Entregado: "Enlace enviado",
      Error: "Error de envío",
    };
    return {
      estado: estados[solicitud?.estado] || "Enlace guardado",
      detalle: ["Pendiente", "Error"].includes(solicitud?.estado) ? solicitud.detalle : "",
    };
  }
  async comunicar(u, c, canal, tipo = "Recordatorio") {
    const p = await this.catalogo.paciente(c.rut),
      b = await this.catalogo.bloque(c.idBloque),
      prof = await this.catalogo.profesional(b.idProfesional);
    const idPoliclinico = this.sedeBloque(b, prof);
    const esEnlace = tipo === "Enlace de atención";
    if (
      esEnlace &&
      (c.estadoReserva !== "ACTIVA" ||
        !c.enlace?.startsWith("https://") ||
        !(await this.catalogo.policlinico(idPoliclinico))?.telemedicina)
    ) {
      throw new Error("Guarda primero el enlace HTTPS de una reserva activa de Telemedicina.");
    }
    const habilitado =
      this.meta.pacientes[p.rut]?.consentimientoComunicaciones === true &&
      (canal === "WhatsApp" ? p.tieneWhatsapp && p.telefono : p.correo);
    const huella = esEnlace ? huellaEnlace(c.enlace) : "";
    if (huella && habilitado) {
      const previa = this.ultimaSolicitudEnlace(c.id, huella, canal);
      if (previa?.estado === "Pendiente") return previa;
    }
    const m = this.extras.agregar("comunicaciones", {
      idCita: c.id,
      rut: p.rut,
      destinatario: p.nombre,
      canal,
      tipo,
      fecha: textoLocal(),
      responsable: u.nombre,
      idPoliclinico,
      ...(huella ? { huellaEnlace: huella } : {}),
      estado: habilitado ? "Pendiente" : "Error",
      detalle: habilitado
        ? "Pendiente de proveedor de envío."
        : "Faltan consentimiento o datos del canal.",
    });
    this.aud(
      u,
      "Comunicación registrada",
      "Comunicaciones",
      m.id,
      null,
      m,
      m.idPoliclinico,
    );
    return m;
  }
  async usuario(d, u) {
    const actual = (await this.catalogo.usuarios()).find((x) => x.id === d.id),
      lugares = ids(d.lugares),
      rol = d.rol;
    if (
      !["ADMINISTRACION", "TENS_TONS", "TELEMEDICINA"].includes(rol) ||
      !d.nombre?.trim() ||
      !/^\S+@\S+\.\S+$/.test(d.correo || "")
    )
      throw new Error("Revisa nombre, correo y rol.");
    if (rol !== "ADMINISTRACION" && !lugares.length)
      throw new Error("Asigna al menos un lugar de trabajo.");
    for (const id of lugares) {
      const s = await this.catalogo.policlinico(id);
      if (
        !s ||
        s.activo === false ||
        ((rol === "TELEMEDICINA") !== !!s.telemedicina &&
          rol !== "ADMINISTRACION")
      )
        throw new Error("El rol no corresponde al lugar asignado.");
    }
    if (d.id === u.id && d.activo !== "1")
      throw new Error("No puedes desactivar tu propia cuenta.");
    const principal=Number(d.sedePrincipal)||lugares[0];
    if(rol!=="ADMINISTRACION"&&!lugares.includes(principal)) throw new Error("El lugar principal debe estar asignado a la cuenta.");
    const n = await this.catalogo.guardarUsuario({
      ...d,
      rol,
      idPoliclinico: rol === "ADMINISTRACION" ? null : principal,
      activo: d.activo === "1",
    });
    this.meta.usuarios[n.id] = {
      ...this.meta.usuarios[n.id],
      lugares,
      idIntegrante: d.idIntegrante || null,
      puedeTerminarAtencion:d.puedeTerminarAtencion!=="0",
    };
    this.sesiones.revocarUsuario(n.id);
    this.aud(
      u,
      actual ? "Permisos actualizados" : "Acceso creado",
      "Usuarios",
      n.id,
      actual,
      { ...n, lugares },
    );
    return n;
  }
  async enlaceClave(id, u) {
    if (!(await this.catalogo.usuarios()).some((x) => x.id === id))
      throw new Error("Usuario no encontrado.");
    const token = crypto.randomBytes(32).toString("hex"),
      hash = crypto.createHash("sha256").update(token).digest("hex");
    this.meta.restablecer[hash] = { id, expira: Date.now() + 30 * 60e3 };
    this.aud(u, "Enlace de contraseña creado", "Usuarios", id, null, {
      venceEnMinutos: 30,
    });
    return `/restablecer?token=${token}`;
  }
  async restablecer(token, clave) {
    const hash = crypto
        .createHash("sha256")
        .update(String(token))
        .digest("hex"),
      r = this.meta.restablecer[hash];
    if (!r || r.expira < Date.now())
      throw new Error("El enlace expiró o ya se utilizó.");
    if (String(clave || "").length < 10)
      throw new Error("La contraseña debe tener al menos 10 caracteres.");
    await this.catalogo.guardarCredencial(r.id, hashClave(clave));
    delete this.meta.restablecer[hash];
    this.sesiones.revocarUsuario(r.id);
    this.aud(null, "Contraseña restablecida", "Usuarios", r.id, null, null);
  }
}
module.exports = { OperacionService, fechaValida, minutos, hora, ids };

"use strict";
const { pagina, iniciales: inic } = require("./layout");
const { ico } = require("./iconos");
const { raw, tabla, opciones, forma, esc } = require("./util");
const { detalleCita } = require("../controllers/contexto");
const { sumarDias } = require("../util/tiempo");

const iniciales = inic;
const estadoCelda = (c) =>
  c.asistencia === "ASISTIO"
    ? ["az", "Asistió"]
    : c.asistencia === "NO_ASISTIO"
      ? ["mal", "No asistió"]
      : c.estadoConfirmacion === "CONFIRMADA"
        ? ["ok", "Confirmada"]
        : c.estadoConfirmacion === "SIN_RESPUESTA"
          ? ["pend", "Sin respuesta"]
          : ["pend", "Por confirmar"];

const MES = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];
const panel = ({
  usuario,
  ctx,
  activas,
  pendientes,
  libres,
  espera,
  avisos,
  porSede,
  sede,
}) => {
  const nombre = String(usuario.nombre || "").split(" ")[0];
  const kpi = (href, clase, icono, n, txt) =>
    `<a class="kpi ${clase}" href="${href}"><span class="ico-c">${ico(icono)}</span><span><b>${n}</b><span>${txt}</span></span></a>`;
  const conf = activas.filter(
    (c) => c.estadoConfirmacion === "CONFIRMADA",
  ).length;
  const prox = activas
    .slice(0, 6)
    .map((c) => {
      const d = detalleCita(c, ctx);
      const [, m, dd] = (d.b?.fecha || "--").split("-");
      const [k, txt] = estadoCelda(c);
      return `<li><span class="hora"><small>${dd} ${MES[Number(m) - 1] || ""}</small><b>${esc(d.b?.hora || "")}</b></span><span class="q"><b>${esc(d.pac?.nombre ?? c.rut)}</b><small>${esc(d.prof?.especialidad ?? "")} · ${esc(d.prof?.nombre ?? "")}${sede ? "" : ` · ${esc(d.pol?.nombre ?? "")}`}</small></span><span class="badge ${k === "ok" ? "ok" : "pend"}">${txt}</span></li>`;
    })
    .join("");
  const max = Math.max(1, ...porSede.map((x) => x.n));
  const tarea = (href, icono, t, sub, n) =>
    `<li><a href="${href}"><span class="ico-c">${ico(icono)}</span><span><b>${t}</b><small>${sub}</small></span><span class="n">${n}</span></a></li>`;
  return pagina({
    titulo: "Inicio",
    usuario,
    lienzo: true,
    contenido: `<div class="hola"><div><h2>Hola, ${esc(nombre)}</h2><p>${sede ? `Policlínico ${esc(sede.nombre)}` : "Todos los policlínicos"} · resumen de las citas desde hoy.</p></div>
<div class="rapidas"><a class="btn" href="/tens/agendar">${ico("mas")}Agendar cita</a><a class="btn sec" href="/tens/agenda">${ico("calendario")}Ver agenda</a></div></div>
<div class="kpis">${kpi("/tens/agenda", "dest", "calendario", activas.length, "Citas próximas")}${kpi("/tens/agenda", "", "check", conf, "Confirmadas")}${kpi("/tens/confirmaciones", "am", "telefono", pendientes.length, "Por confirmar")}${kpi("/tens/agendar", "gr", "reloj", libres, "Cupos libres")}</div>
<div class="paneles"><section class="panel"><div class="panel-t"><h2>Próximas citas</h2><a href="/tens/agenda">Ver agenda →</a></div>${prox ? `<ul class="proximas">${prox}</ul>` : '<p class="vacio">No hay citas próximas.</p>'}</section>
<div style="display:grid;gap:20px"><section class="panel"><div class="panel-t"><h2>Pendientes</h2></div><ul class="tareas">
${tarea("/tens/confirmaciones", "telefono", "Confirmaciones", "Citas sin confirmar o sin respuesta", pendientes.length)}
${tarea("/tens/espera", "lista", "Lista de espera", "Pacientes esperando un cupo", espera)}
${tarea("/tens/avisos", "campana", "Avisos", "Sin leer", avisos)}</ul></section>
${porSede.length ? `<section class="panel"><div class="panel-t"><h2>Citas próximas por policlínico</h2></div><div class="barras">${porSede.map((x) => `<div class="b"><span title="${esc(x.nombre)}">${esc(x.nombre)}</span><span class="tr"><i style="width:${Math.round((x.n / max) * 100)}%"></i></span><b>${x.n}</b></div>`).join("")}</div></section>` : ""}</div></div>`,
  });
};

const agenda = ({ citas, ctx, usuario, sede, fecha, sedes }) => {
  const bloques = [...ctx.bloques.values()].filter(
    (b) =>
      b.fecha === fecha &&
      ctx.profs.get(b.idProfesional)?.idPoliclinico === sede,
  );
  const profs = [...new Set(bloques.map((b) => b.idProfesional))]
    .map((id) => ctx.profs.get(id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const horas = [...new Set(bloques.map((b) => b.hora))].sort();
  const activa = new Map(
    citas
      .filter((c) => c.estadoReserva === "ACTIVA")
      .map((c) => [c.idBloque, c]),
  );
  const delDia = bloques
    .filter((b) => activa.has(b.id))
    .map((b) => activa.get(b.id));
  const conf = delDia.filter(
    (c) => c.estadoConfirmacion === "CONFIRMADA",
  ).length;
  const libres = bloques.filter((b) => b.publicado && !activa.has(b.id)).length;
  const celda = (b) => {
    if (!b) return '<div class="vac"></div>';
    const c = activa.get(b.id);
    if (c) {
      const [k, txt] = estadoCelda(c);
      const pac = ctx.pacientes.get(c.rut);
      return `<div><div class="cel ${k}"><b>${esc(pac?.nombre ?? c.rut)}</b><small>${esc(c.rut)} · ${txt}</small></div></div>`;
    }
    if (!b.publicado)
      return '<div><div class="cel nd"><b>No disponible</b></div></div>';
    return `<div><a class="cel libre" href="/tens/agendar?${new URLSearchParams({ idPoliclinico: sede, fecha })}"><b>Libre</b><small>Agendar cita</small></a></div>`;
  };
  const filas = horas
    .map(
      (h) =>
        `<div class="hr">${esc(h)}</div>${profs.map((p) => celda(bloques.find((b) => b.idProfesional === p.id && b.hora === h))).join("")}`,
    )
    .join("");
  const cab = profs
    .map(
      (p) =>
        `<div class="cab"><span class="av" aria-hidden="true">${esc(iniciales(p.nombre))}</span><b>${esc(p.nombre)}</b><small>${esc(p.especialidad)}</small></div>`,
    )
    .join("");
  const grilla = profs.length
    ? `<div class="agg" tabindex="0" aria-label="Agenda del día"><div class="agg-g" style="grid-template-columns:64px repeat(${profs.length},minmax(160px,1fr))"><div class="cab esq"></div>${cab}${filas}</div></div>
<p class="leyenda"><span><i style="background:#2e9e5b"></i>Confirmada</span><span><i style="background:#e0a800"></i>Por confirmar / sin respuesta</span><span><i style="background:#3a7bd5"></i>Asistió</span><span><i style="background:#c44"></i>No asistió</span><span><i style="background:#9fb7be"></i>Libre</span></p>`
    : "<p>No hay cupos publicados para este policlínico en esa fecha.</p>";
  const sel =
    sedes.length > 1
      ? `<label>Policlínico <select name="sede">${opciones(
          sedes,
          (p) => p.id,
          (p) => p.nombre,
          sede,
        )}</select></label>`
      : `<input type="hidden" name="sede" value="${esc(sede)}"><span><b>${esc(sedes[0]?.nombre ?? "")}</b></span>`;
  const dia = (f) => `/tens/agenda?${new URLSearchParams({ sede, fecha: f })}`;
  const nav = `<form class="inl filtro" method="get" action="/tens/agenda">${sel}<label>Fecha <input type="date" name="fecha" value="${esc(fecha)}"></label><button class="btn" type="submit">Ver</button><span class="sep"></span><a class="btn sec" href="${esc(dia(sumarDias(fecha, -1)))}">‹ Anterior</a><a class="btn sec" href="${esc(dia(sumarDias(fecha, 1)))}">Siguiente ›</a></form>`;
  return pagina({
    titulo: "Agenda del día",
    usuario,
    contenido: `${nav}<div class="kpis"><div class="kpi dest"><span class="ico-c">${ico("calendario")}</span><span><b>${delDia.length}</b><span>Citas del día</span></span></div><div class="kpi"><span class="ico-c">${ico("check")}</span><span><b>${conf}</b><span>Confirmadas</span></span></div><div class="kpi am"><span class="ico-c">${ico("telefono")}</span><span><b>${delDia.length - conf}</b><span>Por confirmar</span></span></div><div class="kpi gr"><span class="ico-c">${ico("reloj")}</span><span><b>${libres}</b><span>Cupos libres</span></span></div></div>
${grilla}
<h2>Listado de citas</h2>${tabla(
      [
        "Fecha",
        "Hora",
        "Policlínico",
        "Profesional",
        "Paciente (RUT)",
        "Reserva",
        "Confirmación",
        "Asistencia",
      ],
      citas.map((c) => {
        const d = detalleCita(c, ctx);
        return [
          d.b?.fecha,
          d.b?.hora,
          d.pol?.nombre,
          (d.prof?.nombre ?? "") +
            (d.reemplazo ? ` → reemplaza: ${d.reemplazo.nombre}` : ""),
          `${d.pac?.nombre ?? ""} (${c.rut})`,
          c.estadoReserva +
            (c.origenCancelacion ? ` (${c.origenCancelacion})` : ""),
          c.estadoConfirmacion,
          c.asistencia ?? "—",
        ];
      }),
      "No hay citas.",
    )}`,
  });
};

const GENEROS = [
  ["FEMENINO", "Femenino"],
  ["MASCULINO", "Masculino"],
  ["OTRO", "Otro"],
  ["NO_INFORMA", "No informa"],
];
const camposFicha = (v, comunas, nuevo) => {
  const val = (k, def = "") => esc(v[k] ?? def);
  return `${nuevo ? `<label>RUT <input name="rut" placeholder="11111111-1" required value="${val("rut")}"></label>` : `<input type="hidden" name="rut" value="${val("rut")}">`}
<label>Nombres <input name="nombres" required value="${val("nombres")}"></label>
<label>Apellidos <input name="apellidos" required value="${val("apellidos")}"></label>
<label>Fecha de nacimiento <input type="date" name="fechaNacimiento" required value="${val("fechaNacimiento")}"></label>
<label>Género <select name="genero">${opciones(
    GENEROS,
    (g) => g[0],
    (g) => g[1],
    v.genero,
  )}</select></label>
<label>Nacionalidad <input name="nacionalidad" value="${val("nacionalidad", "Chilena")}"></label>
<label>Teléfono celular <input name="telefono" placeholder="+56912345678" required value="${val("telefono")}"></label>
<label><input type="checkbox" name="tieneWhatsapp" value="1"${v.tieneWhatsapp === false || v.tieneWhatsapp === "" ? "" : " checked"}> Tiene WhatsApp</label>
<label>Correo (opcional) <input type="email" name="correo" value="${val("correo")}"></label>
<label>Dirección <input name="direccion" required value="${val("direccion")}"></label>
<label>Comuna <select name="idComuna">${opciones(
    comunas,
    (c) => c.id,
    (c) => c.nombre,
    v.idComuna,
  )}</select></label>
<p class="sec-t sub-form">Adulto responsable <small>Obligatorio si el paciente es menor de 18 años. En otros casos, solo si corresponde.</small></p>
<label>Nombre completo <input name="respNombre" value="${val("respNombre")}"></label>
<label>Relación con el paciente <input name="respRelacion" placeholder="Madre, hijo, tutor…" maxlength="30" value="${val("respRelacion")}"></label>
<label>RUT del responsable <input name="respRut" placeholder="11111111-1" value="${val("respRut")}"></label>
<label>Teléfono del responsable <input name="respTelefono" placeholder="+56912345678" value="${val("respTelefono")}"></label>
${nuevo ? '<label><input type="checkbox" name="consentimiento" value="1"> El paciente (o su responsable) acepta el tratamiento de sus datos administrativos</label>' : ""}`;
};
const aFormulario = (p) => ({
  ...p,
  respNombre: p.responsable?.nombre,
  respRelacion: p.responsable?.relacion,
  respRut: p.responsable?.rut,
  respTelefono: p.responsable?.telefono,
});

const pacientes = ({ lista, comunas, mensaje, usuario, valores }) =>
  pagina({
    titulo: "Pacientes",
    usuario,
    mensaje,
    contenido: `<h2>Nueva ficha</h2>
<form method="post" action="/tens/pacientes">${camposFicha(valores ? { ...valores, tieneWhatsapp: valores.tieneWhatsapp === "1" } : {}, comunas, true)}
<button type="submit">Crear ficha</button></form>
<h2>Pacientes registrados</h2>
${tabla(
  ["RUT", "Nombre", "Teléfono", "WhatsApp", "Adulto responsable", ""],
  lista.map((p) => [
    p.rut,
    p.nombre,
    p.telefono,
    p.tieneWhatsapp ? "Sí" : "No",
    p.responsable ? `${p.responsable.nombre} (${p.responsable.relacion})` : "—",
    raw(
      `<a class="btn sec chico" href="/tens/pacientes/editar?${new URLSearchParams({ rut: p.rut })}">Editar</a>`,
    ),
  ]),
)}`,
  });

const editarPaciente = ({ p, comunas, mensaje, usuario, valores }) =>
  pagina({
    titulo: "Ficha del paciente",
    usuario,
    mensaje,
    contenido: `<a class="volver" href="/tens/pacientes">← Volver a Pacientes</a><h2>${esc(p.nombre)} · ${esc(p.rut)}</h2><p>El RUT no se puede cambiar. Para dejar al paciente sin adulto responsable, borra sus cuatro datos.</p>
<form method="post" action="/tens/pacientes/editar">${camposFicha(valores ? { ...valores, tieneWhatsapp: valores.tieneWhatsapp === "1" } : aFormulario(p), comunas, false)}
<button type="submit">Guardar cambios</button></form>`,
  });

const agendar = ({
  policlinicos,
  disponibles,
  ctx,
  filtro,
  mensaje,
  usuario,
  precarga,
}) =>
  pagina({
    titulo:
      usuario.rol === "TELEMEDICINA"
        ? "Reserva de Telemedicina"
        : "Reserva presencial",
    usuario,
    mensaje,
    contenido: `<form method="get" action="/tens/agendar"><label>Policlínico <select name="idPoliclinico"><option value="">Todos</option>${opciones(
      policlinicos,
      (p) => p.id,
      (p) => p.nombre,
      filtro.idPoliclinico,
    )}</select></label>
<label>Fecha <input type="date" name="fecha" value="${esc(filtro.fecha || "")}"></label><button type="submit">Buscar cupos</button></form>
<form method="get" action="/tens/agendar"><label>Buscar ficha por RUT <input name="rut" value="${esc(filtro.rut || "")}" required></label><button type="submit">Recordar datos del paciente</button></form>
${precarga ? `<p class="aviso">${esc(precarga.nombre)} · ${esc(precarga.rut)} · ${esc(precarga.telefono)}${precarga.responsable ? ` · Responsable: ${esc(precarga.responsable.nombre)}` : ""}</p>` : ""}
<form method="post" action="/tens/agendar">
<label>RUT de quien recibirá la atención <input name="rut" value="${esc(precarga?.rut || "")}" placeholder="11111111-1" required></label><p>Si la atención es para otra persona, ingresa el RUT de esa persona. Los datos de su ficha se recuerdan para futuras reservas.</p>
<label>Cupo <select name="idBloque" required>${opciones(
      disponibles,
      (b) => b.id,
      (b) => {
        const p = ctx.profs.get(b.idProfesional);
        return `${b.fecha} ${b.hora} – ${p.nombre} (${p.especialidad}) – ${ctx.sedes.get(b.idPoliclinico || p.idPoliclinico)?.nombre}`;
      },
      filtro.idBloque,
    )}</select></label>
<button type="submit">Registrar cita</button></form>
<p>Cupos disponibles: ${disponibles.length}. Si el paciente no tiene ficha, créala primero en <a href="/tens/pacientes">Pacientes</a>.</p>`,
  });

const confirmaciones = ({ pendientes, ctx, contactos, mensaje, usuario }) =>
  pagina({
    titulo: "Confirmaciones pendientes",
    usuario,
    mensaje,
    contenido: `<p>Las citas sin respuesta siguen reservadas. Llama al paciente y registra aquí el resultado.</p>
${tabla(
  ["Fecha", "Hora", "Paciente", "Teléfono", "Estado", "Registrar llamada"],
  pendientes.map((c) => {
    const d = detalleCita(c, ctx);
    return [
      d.b?.fecha,
      d.b?.hora,
      d.pac?.nombre,
      d.pac?.telefono || "Sin teléfono: contactar de forma presencial",
      c.estadoConfirmacion === "SIN_RESPUESTA"
        ? "Sin respuesta"
        : "Por confirmar",
      raw(
        `<form method="post" action="/tens/confirmaciones"><input type="hidden" name="idCita" value="${esc(c.id)}"><select name="resultado"><option>Confirmó</option><option>Canceló</option><option>No contestó</option></select> <button type="submit">Guardar</button></form>`,
      ),
    ];
  }),
  "No hay confirmaciones pendientes.",
)}
<h2>Bitácora de contactos</h2>
${tabla(
  ["Fecha", "Cita", "Canal", "Resultado", "Responsable"],
  contactos.map((c) => [
    c.fecha,
    c.idCita,
    c.canal,
    c.resultado,
    c.responsable,
  ]),
  "Sin contactos registrados.",
)}`,
  });

const espera = ({
  vigentes,
  policlinicos,
  especialidades,
  ctx,
  mensaje,
  usuario,
}) =>
  pagina({
    titulo: "Lista de espera",
    usuario,
    mensaje,
    contenido: `<p>La gestiona TENS/TONS. No hay asignación automática: tú decides a quién ofrecer cada cupo.</p>
<form method="post" action="/tens/espera">
<label>RUT <input name="rut" required></label>
<label>Policlínico <select name="idPoliclinico">${opciones(
      policlinicos,
      (p) => p.id,
      (p) => p.nombre,
    )}</select></label>
<label>Especialidad <select name="especialidad">${opciones(
      especialidades,
      (e) => e,
      (e) => e,
    )}</select></label>
<button type="submit">Registrar</button></form>
${tabla(
  [
    "Orden",
    "RUT",
    "Policlínico",
    "Especialidad",
    "Registrada",
    "Cupos que calzan",
    "Acciones",
  ],
  vigentes.map((e, i) => [
    i + 1,
    e.rut,
    ctx.sedes.get(e.idPoliclinico)?.nombre,
    e.especialidad,
    e.registradaEn,
    e.cupos.length
      ? raw(
          `<form method="post" action="/tens/espera/asignar"><input type="hidden" name="idSolicitud" value="${esc(e.id)}"><select name="idBloque">${opciones(
            e.cupos,
            (b) => b.id,
            (b) =>
              `${b.fecha} ${b.hora} – ${ctx.profs.get(b.idProfesional)?.nombre}`,
          )}</select> <button type="submit">Asignar este cupo</button></form>`,
        )
      : "Ninguno por ahora",
    raw(forma("/tens/espera/retirar", { idSolicitud: e.id }, "Retirar")),
  ]),
  "Lista vacía.",
)}`,
  });

const recepcion = ({ citas, ctx, mensaje, usuario }) =>
  pagina({
    titulo: "Recepción: asistencia",
    usuario,
    mensaje,
    contenido: tabla(
      ["Fecha", "Hora", "Paciente", "Asistencia", "Registrar"],
      citas.map((c) => {
        const d = detalleCita(c, ctx);
        return [
          d.b?.fecha,
          d.b?.hora,
          d.pac?.nombre,
          c.asistencia ?? "—",
          raw(
            `<form method="post" action="/tens/recepcion"><input type="hidden" name="idCita" value="${esc(c.id)}"><button name="asistio" value="1">Asistió</button> <button name="asistio" value="0">No asistió</button></form> ${forma("/tens/recepcion/cancelar", { idCita: c.id }, "Cancelar (asistida)")}`,
          ),
        ];
      }),
      "No hay citas activas.",
    ),
  });

const documentos = ({ lista, tipos, mensaje, usuario, valores = {} }) =>
  pagina({
    titulo: "Documentos administrativos",
    usuario,
    mensaje,
    contenido: `<p>Documentos que presenta el paciente: afiliación a FONASA, inscripción en su CESFAM, orden de derivación u otros. Puedes adjuntar el archivo (PDF, JPG o PNG, hasta ${Math.round(require("../services/DocumentoService").MAX_BYTES/1024/1024)} MB). No se guardan datos clínicos.</p>
<form method="post" action="/tens/documentos" enctype="multipart/form-data">
<input type="hidden" name="reemplazar" value="${esc(valores.reemplazar || "")}"><label>RUT del paciente <input name="rut" value="${esc(valores.rut || "")}" required></label>
<label>Tipo <select name="tipo">${opciones(
      tipos,
      (t) => t,
      (t) => t,
    )}</select></label>
<label>Especialidad relacionada <input name="especialidad"></label><label>Vigencia <input type="date" name="vigencia"></label><label>Observación <input name="observacion" maxlength="200"></label>
<label>Archivo (opcional) <input type="file" name="archivo" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></label>
<button type="submit">Registrar documento</button></form>
${tabla(
  [
    "Fecha",
    "RUT",
    "Tipo",
    "Observación",
    "Archivo",
    "Registró",
    "Verificación",
  ],
  lista.map((d) => [
    d.fecha,
    d.rut,
    d.tipo,
    d.observacion,
    d.adjunto
      ? raw(
          `<a href="/tens/documentos/archivo?id=${esc(d.id)}">Descargar</a> <small style="color:var(--muted)">${esc(d.adjunto.formato)} · ${esc(d.adjunto.kb)} KB</small>`,
        )
      : "—",
    d.registradoPor,
    d.verificado
      ? `Verificado por ${d.verificadoPor}`
      : raw(
          forma(
            "/tens/documentos/verificar",
            { id: d.id },
            "Marcar verificado",
          ),
        ),
  ]),
  "Sin documentos registrados.",
)}`,
  });

const bot = ({ ahora, mensajes, bandeja, citas, ctx, mensaje, usuario }) =>
  pagina({
    titulo: "Bot de WhatsApp (modo simulado, sin IA)",
    usuario,
    mensaje,
    contenido: `<p>Reglas fijas: recordatorio 1 semana antes y la víspera a las 10:00; reintento la víspera a las 14:00; luego llama TENS/TONS. El paciente solo puede usar los botones. No se envía nada real.</p>
<form method="post" action="/tens/bot/ejecutar"><label>Fecha y hora a simular <input name="ahora" value="${esc(ahora)}" placeholder="2026-11-22 10:00"></label><button type="submit">Ejecutar bot</button></form>
<h2>Simular respuesta del paciente</h2>
<form method="post" action="/tens/bot/responder">
<label>Cita <select name="idCita">${opciones(
      citas,
      (c) => c.id,
      (c) => {
        const d = detalleCita(c, ctx);
        return `#${c.id} ${d.pac?.nombre ?? c.rut} – ${d.b?.fecha} ${d.b?.hora}`;
      },
    )}</select></label>
<label>Botón <select name="boton"><option>Confirmar</option><option>Cancelar mi hora</option><option>Hola (texto libre)</option></select></label>
<button type="submit">Enviar como paciente</button></form>
<h2>Mensajes programados</h2>
${tabla(
  ["Cita", "Tipo", "Programado", "Estado", "Respuesta"],
  mensajes.map((m) => [
    m.idCita,
    m.tipo,
    m.programadoPara,
    m.estado,
    m.respuesta ?? "—",
  ]),
  "Aún no hay mensajes programados. Ejecuta el bot.",
)}
<h2>Bandeja simulada</h2>
${tabla(
  ["Fecha", "Canal", "Dirección", "Destino", "Texto", "Botones"],
  [...bandeja]
    .reverse()
    .map((m) => [
      m.fecha,
      m.canal || "WhatsApp",
      m.direccion,
      m.telefono || m.correo || "—",
      m.texto,
      (m.botones || []).join(" | "),
    ]),
  "Bandeja vacía.",
)}`,
  });

const avisos = ({ lista, mensaje, usuario }) =>
  pagina({
    titulo: "Avisos",
    usuario,
    mensaje,
    contenido: tabla(
      ["Fecha", "Tipo", "Aviso", ""],
      lista.map((n) => [
        n.fecha,
        n.tipo,
        n.texto,
        n.leida
          ? "Leído"
          : raw(forma("/tens/avisos/leer", { id: n.id }, "Marcar leído")),
      ]),
      "Sin avisos.",
    ),
  });

module.exports = {
  panel,
  agenda,
  pacientes,
  editarPaciente,
  agendar,
  confirmaciones,
  espera,
  recepcion,
  documentos,
  bot,
  avisos,
};

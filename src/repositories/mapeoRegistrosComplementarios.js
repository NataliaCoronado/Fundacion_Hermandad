"use strict";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v) => (UUID.test(String(v || "")) ? String(v) : null);
const TZ = "America/Santiago";

const TIPO_CODIGO = {
  "Cartola FONASA": "FONASA",
  "Credencial CESFAM": "CESFAM",
  "Orden médica / derivación": "ORDEN_MEDICA",
};
const CODIGO_TIPO = { FONASA: "Cartola FONASA", CESFAM: "Credencial CESFAM", ORDEN_MEDICA: "Orden médica / derivación" };

const SQL_FECHA = (n) => `($${n}::text)::timestamp AT TIME ZONE '${TZ}'`;
const SQL_TEXTO = (col) => `to_char(${col} AT TIME ZONE '${TZ}', 'YYYY-MM-DD HH24:MI')`;

const AUDITORIA = {
  tabla: "auditoria",
  clave: "id_auditoria",
  selectSql: `SELECT id_auditoria::int AS id, id_usuario::text AS id_usuario, id_policlinico::int AS id_policlinico, operacion, entidad, id_entidad,
    ${SQL_TEXTO("realizado_en")} AS fecha, resultado, detalle FROM auditoria ORDER BY id_auditoria`,
  columnas: ["id_auditoria", "id_usuario", "id_policlinico", "operacion", "entidad", "id_entidad", "realizado_en", "resultado", "detalle"],
  valores(a) {
    return [
      a.id,
      uuid(a.idUsuario),
      Number(a.idPoliclinico) || null,
      String(a.accion || "").slice(0, 80),
      String(a.modulo || "Sistema").slice(0, 40),
      String(a.registro ?? a.detalle ?? "-").slice(0, 120) || "-",
      a.fecha,
      a.resultado || "EXITOSO",
      JSON.stringify({ usuario: a.usuario, accion: a.accion, detalle: a.detalle, antes: a.antes ?? null, despues: a.despues ?? null, fecha: a.fecha }),
    ];
  },
  expresiones: { 6: SQL_FECHA(7), 8: "$9::jsonb" },
  desdeFila(f) {
    const detalle = f.detalle || {};
    const r = {
      id: f.id,
      fecha: detalle.fecha || f.fecha,
      usuario: detalle.usuario ?? "(sin dato)",
      accion: detalle.accion || f.operacion,
      detalle: detalle.detalle ?? "",
      idUsuario: f.id_usuario || null,
      modulo: f.entidad,
      registro: f.id_entidad,
      idPoliclinico: f.id_policlinico || null,
      resultado: f.resultado,
    };
    if (detalle.antes != null) r.antes = detalle.antes;
    if (detalle.despues != null) r.despues = detalle.despues;
    return r;
  },
};

const DOCUMENTO = {
  tabla: "documento",
  clave: "id_documento",
  selectSql: `SELECT d.id_documento::int AS id, p.numero_documento AS rut, d.tipo, d.etiqueta_tipo, d.ruta_archivo, d.nombre_original, d.formato, d.tamano_kb,
    d.origen, d.id_policlinico::int AS id_policlinico, d.especialidad, d.vigente_hasta::text AS vigente_hasta, d.reemplaza::int AS reemplaza, d.archivado,
    d.cargado_por::text AS cargado_por, ${SQL_TEXTO("d.cargado_en")} AS cargado_en, d.estado_revision, d.revisado_por::text AS revisado_por,
    ${SQL_TEXTO("d.revisado_en")} AS revisado_en, d.observacion
    FROM documento d JOIN paciente p ON p.id_paciente = d.id_paciente ORDER BY d.id_documento`,
  columnas: ["id_documento", "id_paciente", "tipo", "etiqueta_tipo", "ruta_archivo", "nombre_original", "formato", "tamano_kb", "origen", "id_policlinico",
    "especialidad", "vigente_hasta", "reemplaza", "archivado", "cargado_por", "cargado_en", "estado_revision", "revisado_por", "revisado_en", "observacion"],
  valores(d) {
    const adjunto = d.adjunto;
    const estado = d.estadoRevision || (d.verificado ? "VALIDADO" : "PENDIENTE");
    return [
      d.id,
      d.rut,
      TIPO_CODIGO[d.tipo] || "OTRO",
      String(d.tipo || "").slice(0, 40),
      adjunto ? adjunto.guardado : null,
      adjunto ? String(adjunto.original || "").slice(0, 120) : null,
      adjunto ? adjunto.formato : null,
      adjunto ? Math.min(10240, Math.max(1, Number(adjunto.kb) || 1)) : null,
      /portal/i.test(d.registradoPor || "") ? "PORTAL" : "PERSONAL",
      Number(d.idPoliclinico) || null,
      d.especialidad || null,
      d.vigencia || null,
      d.reemplaza || null,
      Boolean(d.archivado),
      uuid(d.registradoPorId),
      d.fecha,
      estado,
      estado === "PENDIENTE" ? null : uuid(d.verificadoPorId),
      estado === "PENDIENTE" ? null : d.revisadoEn || d.fecha,
      d.observacion ? String(d.observacion).slice(0, 300) : null,
    ];
  },
  expresiones: {
    1: "(SELECT id_paciente FROM paciente WHERE tipo_documento = 'RUT' AND numero_documento = $2::text)",
    15: SQL_FECHA(16),
    18: `CASE WHEN $19::text IS NULL THEN NULL ELSE ($19::text)::timestamp AT TIME ZONE '${TZ}' END`,
  },
  desdeFila(f) {
    return {
      id: f.id,
      rut: f.rut,
      tipo: f.etiqueta_tipo || CODIGO_TIPO[f.tipo] || "Otro",
      especialidad: f.especialidad || "",
      vigencia: f.vigente_hasta || "",
      reemplaza: f.reemplaza || null,
      idPoliclinico: f.id_policlinico || null,
      observacion: f.observacion || "",
      registradoPor: f.origen === "PORTAL" ? "Paciente (portal)" : "Personal",
      registradoPorId: f.cargado_por || null,
      fecha: f.cargado_en,
      verificado: f.estado_revision === "VALIDADO",
      estadoRevision: f.estado_revision,
      verificadoPor: null,
      verificadoPorId: f.revisado_por || null,
      revisadoEn: f.revisado_en || null,
      adjunto: f.ruta_archivo
        ? { guardado: f.ruta_archivo, original: f.nombre_original || f.ruta_archivo, formato: f.formato, mime: { PDF: "application/pdf", JPG: "image/jpeg", PNG: "image/png" }[f.formato], kb: f.tamano_kb }
        : null,
      archivado: Boolean(f.archivado),
    };
  },
};

const HISTORIAL = {
  tabla: "cita_historial",
  clave: "id_historial",
  selectSql: `SELECT id_historial::int AS id, id_cita::int AS id_cita, operacion, estado_anterior, estado_nuevo, origen, id_usuario::text AS id_usuario,
    ${SQL_TEXTO("registrado_en")} AS fecha, detalle FROM cita_historial ORDER BY id_historial`,
  columnas: ["id_historial", "id_cita", "operacion", "estado_anterior", "estado_nuevo", "origen", "id_usuario", "registrado_en", "detalle"],
  valores(h) {
    return [h.id, h.idCita, String(h.operacion).slice(0, 30), h.estadoAnterior || null, h.estadoNuevo || null, h.origen || "PERSONAL", uuid(h.idUsuario), h.fecha, h.detalle ? String(h.detalle).slice(0, 300) : null];
  },
  expresiones: { 7: SQL_FECHA(8) },
  desdeFila(f) {
    return { id: f.id, idCita: f.id_cita, operacion: f.operacion, estadoAnterior: f.estado_anterior, estadoNuevo: f.estado_nuevo, origen: f.origen, idUsuario: f.id_usuario || null, fecha: f.fecha, detalle: f.detalle || "" };
  },
};

const MAPEOS = { auditoria: AUDITORIA, documentos: DOCUMENTO, historial: HISTORIAL };

function upsert(mapeo, objeto) {
  const vals = mapeo.valores(objeto);
  const marcas = vals.map((_, i) => mapeo.expresiones[i] || `$${i + 1}`);
  const sets = mapeo.columnas.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(", ");
  return {
    sql: `INSERT INTO ${mapeo.tabla} (${mapeo.columnas.join(", ")}) OVERRIDING SYSTEM VALUE VALUES (${marcas.join(", ")})
      ON CONFLICT (${mapeo.clave}) DO UPDATE SET ${sets}`,
    params: vals,
  };
}

module.exports = { MAPEOS, upsert, uuid, TIPO_CODIGO, CODIGO_TIPO };

"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { normalizarRut } = require("../herramientas/rut");
const { textoLocal } = require("../herramientas/tiempo");

const TIPOS = [
  "Cartola FONASA",
  "Credencial CESFAM",
  "Orden médica / derivación",
  "Comprobante de domicilio",
  "Certificado",
  "Consentimiento",
  "Otro",
];
const MAX_BYTES =
  Math.min(20, Math.max(1, Number(process.env.MAX_DOCUMENTO_MB) || 5)) *
  1024 *
  1024;
const FORMATOS = [
  {
    formato: "PDF",
    ext: ".pdf",
    mime: "application/pdf",
    firma: Buffer.from("%PDF"),
  },
  {
    formato: "JPG",
    ext: ".jpg",
    mime: "image/jpeg",
    firma: Buffer.from([0xff, 0xd8, 0xff]),
  },
  {
    formato: "PNG",
    ext: ".png",
    mime: "image/png",
    firma: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  },
];
const carpeta = () =>
  process.env.DIR_DOCUMENTOS ||
  path.join(__dirname, "..", "..", "datos", "documentos");

class DocumentoServicio {
  constructor({ catalogo, extras }) {
    Object.assign(this, { catalogo, extras });
  }
  tipos() {
    return TIPOS;
  }

  static nombreLegible({ rut, tipo }, ext) {
    const limpio = (t) =>
      String(t || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    const partes = [limpio(rut) || "sin-rut", limpio(tipo) || "Documento", textoLocal().slice(0, 10)];
    return `${partes.join("_")}_${crypto.randomUUID().slice(0, 6)}${ext}`;
  }

  guardarArchivo(archivo, datos = {}) {
    if (archivo.datos.length > MAX_BYTES) throw new Error("ARCHIVO_MUY_GRANDE");
    const f = FORMATOS.find((x) =>
      archivo.datos.subarray(0, x.firma.length).equals(x.firma),
    );
    if (!f) throw new Error("ARCHIVO_INVALIDO");
    fs.mkdirSync(carpeta(), { recursive: true });
    const guardado = DocumentoServicio.nombreLegible(datos, f.ext);
    fs.writeFileSync(path.join(carpeta(), guardado), archivo.datos, {
      mode: 0o600,
    });
    const original =
      path
        .basename(String(archivo.nombre))
        .replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, "_")
        .slice(0, 80) || `documento${f.ext}`;
    return {
      guardado,
      original,
      formato: f.formato,
      mime: f.mime,
      kb: Math.max(1, Math.round(archivo.datos.length / 1024)),
    };
  }

  async registrar({
    rut,
    tipo,
    observacion,
    usuario,
    archivo,
    especialidad,
    vigencia,
    reemplazar,
  }) {
    rut = normalizarRut(rut);
    if (!(await this.catalogo.paciente(rut)))
      throw new Error("PACIENTE_NO_ENCONTRADO");
    if (!TIPOS.includes(tipo)) throw new Error("TIPO_INVALIDO");
    if (vigencia && !require("./OperacionServicio").fechaValida(vigencia))
      throw new Error("Fecha de vigencia inválida.");
    const anterior = reemplazar
      ? this.extras.buscar("documentos", reemplazar)
      : null;
    if (
      reemplazar &&
      (!anterior ||
        anterior.rut !== rut ||
        anterior.idPoliclinico !== Number(usuario.idPoliclinico))
    )
      throw new Error("FUERA_DE_SEDE");
    const adjunto =
      archivo && archivo.datos ? this.guardarArchivo(archivo, { rut, tipo }) : null;
    if (anterior)
      this.extras.actualizar("documentos", anterior.id, {
        archivado: true,
        reemplazadoPor: usuario.nombre,
      });
    return this.extras.agregar("documentos", {
      rut,
      tipo,
      especialidad,
      vigencia,
      reemplaza: anterior?.id || null,
      idPoliclinico: Number(usuario.idPoliclinico),
      observacion: String(observacion || "")
        .trim()
        .slice(0, 200),
      registradoPor: usuario.nombre,
      fecha: textoLocal(),
      verificado: false,
      estadoRevision: "PENDIENTE",
      verificadoPor: null,
      verificadoPorId: null,
      revisadoEn: null,
      registradoPorId: usuario.id || null,
      adjunto,
    });
  }
  revisar(id, usuario, estado, observacion) {
    const d = this.extras.buscar("documentos", id);
    if (!d) throw new Error("DOCUMENTO_NO_ENCONTRADO");
    return this.extras.actualizar("documentos", id, {
      verificado: estado === "VALIDADO",
      estadoRevision: estado,
      verificadoPor: usuario.nombre,
      verificadoPorId: usuario.id || null,
      revisadoEn: textoLocal(),
      ...(observacion !== undefined ? { observacion } : {}),
    });
  }
  async verificar(id, usuario) {
    return this.revisar(id, usuario, "VALIDADO");
  }
  async observar(id, usuario, motivo) {
    const motivoLimpio = String(motivo || "").trim();
    if (!motivoLimpio) throw new Error("MOTIVO_REQUERIDO");
    return this.revisar(id, usuario, "OBSERVADO", motivoLimpio.slice(0, 300));
  }
  static estado(d) {
    return d.estadoRevision || (d.verificado ? "VALIDADO" : "PENDIENTE");
  }
  archivo(id) {
    const documento = this.extras.buscar("documentos", id);
    if (!documento) throw new Error("DOCUMENTO_NO_ENCONTRADO");
    if (!documento.adjunto) throw new Error("SIN_ARCHIVO");
    const ruta = path.join(carpeta(), documento.adjunto.guardado);
    if (!fs.existsSync(ruta)) throw new Error("SIN_ARCHIVO");
    return { ruta, mime: documento.adjunto.mime, nombre: documento.adjunto.original };
  }
  listar() {
    return [...this.extras.listar("documentos")].reverse();
  }
}
module.exports = { DocumentoServicio, MAX_BYTES };

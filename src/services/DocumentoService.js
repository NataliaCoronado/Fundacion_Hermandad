"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { normalizarRut } = require("../util/rut");
const { textoLocal } = require("../util/tiempo");

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

class DocumentoService {
  constructor({ catalogo, extras }) {
    Object.assign(this, { catalogo, extras });
  }
  tipos() {
    return TIPOS;
  }

  // Nombre legible en disco: RUT_Tipo_AAAA-MM-DD_xxxxxx.ext (la cola aleatoria evita choques el mismo día).
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
    const guardado = DocumentoService.nombreLegible(datos, f.ext);
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
    if (vigencia && !require("./OperacionService").fechaValida(vigencia))
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
      verificadoPor: null,
      adjunto,
    });
  }
  async verificar(id, usuario) {
    const d = this.extras.buscar("documentos", id);
    if (!d) throw new Error("DOCUMENTO_NO_ENCONTRADO");
    return this.extras.actualizar("documentos", id, {
      verificado: true,
      verificadoPor: usuario.nombre,
    });
  }
  archivo(id) {
    const d = this.extras.buscar("documentos", id);
    if (!d) throw new Error("DOCUMENTO_NO_ENCONTRADO");
    if (!d.adjunto) throw new Error("SIN_ARCHIVO");
    const ruta = path.join(carpeta(), d.adjunto.guardado);
    if (!fs.existsSync(ruta)) throw new Error("SIN_ARCHIVO");
    return { ruta, mime: d.adjunto.mime, nombre: d.adjunto.original };
  }
  listar() {
    return [...this.extras.listar("documentos")].reverse();
  }
}
module.exports = { DocumentoService, MAX_BYTES };

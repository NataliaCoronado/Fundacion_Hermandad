"use strict";
const { fechaLarga } = require("../views/paciente");
const { infoSede, formatoTelefono } = require("../models/informacionDeSedes");

const texto = (s) =>
  String(s ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\xFF]/g, "")
    .replace(/[\\()]/g, "\\$&");
const latin1 = (s) => Buffer.from(s, "latin1");

const lineas = (s, n) => String(s || "").match(new RegExp(`.{1,${n}}(\\s|$)|.{1,${n}}`, "g"))?.map((x) => x.trim()) || [""];

function comprobantePdf({ paciente, bloque, profesional, sede, emitido }) {
  const info = infoSede(sede.id) || {};
  let st = "";
  const t = (x, y, s, size = 11, negrita = false) => {
    st += `BT /${negrita ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${texto(s)}) Tj ET\n`;
  };
  const color = (r, g, b) => (st += `${r} ${g} ${b} rg\n`);
  color(0.06, 0.23, 0.29);
  st += "0 772 595 70 re f\n";
  color(1, 1, 1);
  t(40, 812, "INSTITUTO DE CARIDAD HERMANDAD DE DOLORES", 12, true);
  t(40, 792, "Comprobante de reserva de hora", 10);
  color(0.06, 0.23, 0.29);
  t(40, 735, "Tu hora fue reservada", 20, true);
  t(40, 714, `Emitido el ${emitido}. Este comprobante no tiene código: tu reserva se identifica por tu RUT.`, 9);

  let y = 680;
  const seccion = (titulo) => {
    color(0.09, 0.5, 0.55);
    t(40, y, titulo.toUpperCase(), 9, true);
    st += `0.87 0.91 0.92 RG 40 ${y - 6} m 555 ${y - 6} l S\n`;
    color(0.06, 0.23, 0.29);
    y -= 26;
  };
  const fila = (k, v) => {
    color(0.35, 0.43, 0.46);
    t(40, y, k, 10);
    color(0.06, 0.23, 0.29);
    const ls = lineas(v, 62);
    ls.forEach((l, i) => t(190, y - i * 14, l, 11, i === 0));
    y -= 14 * ls.length + 8;
  };
  seccion("Paciente");
  fila("Nombre", paciente.nombre);
  fila("RUT", paciente.rut);
  y -= 8;
  seccion("Atención");
  fila("Fecha", fechaLarga(bloque.fecha).replace(/^./, (c) => c.toUpperCase()));
  fila("Hora", bloque.hora);
  fila("Especialidad", bloque.especialidad || profesional.especialidad);
  fila("Profesional", profesional.nombre);
  fila("Lugar", sede.telemedicina ? "Telemedicina (atención a distancia)" : `Policlínico ${sede.nombre}`);
  if (!sede.telemedicina && info.direccion) fila("Dirección", info.direccion);
  fila("Modalidad", sede.telemedicina ? "Videoconsulta: el equipo de Telemedicina te hará llegar el enlace antes de tu hora." : "Presencial");
  y -= 8;
  seccion("Indicaciones");
  for (const l of [
    sede.telemedicina
      ? "Conéctate desde un lugar tranquilo, con cámara, micrófono y buena conexión."
      : "Llega 10 minutos antes con tu cédula de identidad.",
    "Si tienes orden médica o derivación, llévala o adjúntala en tu cuenta del portal.",
    `Para cancelar o cambiar tu hora escribe al WhatsApp ${formatoTelefono(info.whatsapp || "+56927468124")} o comunícate con tu policlínico indicando tu RUT.`,
    "Una reserva no se cancela por falta de respuesta a un mensaje.",
  ])
    for (const x of lineas(`- ${l}`, 95)) {
      t(40, y, x, 10);
      y -= 15;
    }
  color(0.35, 0.43, 0.46);
  t(40, 40, "Documento generado por el portal de pacientes de la Hermandad de Dolores. Datos administrativos, sin información clínica.", 8);

  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(st, "latin1")} >>\nstream\n${st}endstream`,
    `<< /Title (${texto("Comprobante de reserva")}) /Producer (Portal de pacientes Hermandad de Dolores) >>`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return latin1(out);
}
module.exports = { comprobantePdf };

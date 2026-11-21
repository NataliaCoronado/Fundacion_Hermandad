"use strict";

const fechaLarga = (fecha) => {
  const [a, m, d] = String(fecha || "").split("-").map(Number);
  if (!a) return String(fecha || "");
  const texto = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Líneas de detalle de una hora, con *negrita* al estilo de WhatsApp.
function lineasDeCita({ bloque, profesional, sede }) {
  return [
    `*Día:* ${fechaLarga(bloque?.fecha)}`,
    `*Hora:* ${bloque?.hora || ""}`,
    `*Lugar:* ${sede?.nombre || "el policlínico"}`,
    `*Atención:* ${[profesional?.especialidad, profesional?.nombre].filter(Boolean).join(" con ")}`,
  ].join("\n");
}

module.exports = { lineasDeCita, fechaLarga };

"use strict";

const { esc, forma } = require("./componentesComunes");
const { ico } = require("./iconos");
const { CSS_MENSAJES_PACIENTE } = require("./mensajesDelPaciente.css");

const INSTITUCION = "Hermandad de Dolores";
const CANALES = [
  { nombre: "WhatsApp", clave: "whatsapp", lista: "Conversaciones", vacio: "Todavía no tienes mensajes de WhatsApp." },
  { nombre: "Correo", clave: "correo", lista: "Bandeja de entrada", vacio: "Todavía no tienes correos." },
];
const DIA = new Intl.DateTimeFormat("es-CL", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

const rutaLocal = (valor, defecto = "/") =>
  typeof valor === "string" && /^\/(?![\\/])/.test(valor) ? valor : defecto;
const sello = (clase = "mp-sello") =>
  `<img class="${clase}" src="/img/sello.png" alt="" width="40" height="40">`;
const sobre = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>';
const iconoCanal = (canal) => canal === "whatsapp" ? ico("chat") : sobre;

function fechaDia(fecha) {
  const dia = new Date(`${fecha}T00:00:00Z`);
  return Number.isNaN(dia.getTime()) ? fecha : DIA.format(dia);
}

function fechaPartes(fecha) {
  const texto = String(fecha || "");
  const [, dia = "", hora = ""] = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(texto) || [];
  return { dia, hora, texto };
}

function fechaHtml(fecha, modo = "completa") {
  const { dia, hora, texto } = fechaPartes(fecha);
  if (!texto) return "";
  const legible = modo === "hora" && hora ? hora
    : modo === "corta" && dia ? `${dia.slice(8)}/${dia.slice(5, 7)}`
    : dia ? [fechaDia(dia), hora].filter(Boolean).join(" · ") : texto;
  return `<time${dia ? ` datetime="${esc(hora ? dia + "T" + hora : dia)}"` : ""}>${esc(legible)}</time>`;
}

function urlBandeja(ruta, canal, mensaje) {
  const params = new URLSearchParams({ canal });
  if (mensaje != null) params.set("mensaje", mensaje);
  return `${rutaLocal(ruta, "/paciente/mensajes")}?${params}`;
}

function aviso(estado) {
  const texto = typeof estado === "string" ? estado : estado?.texto;
  if (!texto) return "";
  const error = estado?.tipo === "error";
  return `<p class="mp-aviso${error ? " mp-aviso-error" : ""}" role="${error ? "alert" : "status"}">${ico(error ? "campana" : "check")}${esc(texto)}</p>`;
}

function pagina({ titulo, volver, textoVolver, contenido }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f6f8f7"><meta name="robots" content="noindex"><link rel="icon" type="image/png" href="/img/sello.png">
<title>${esc(titulo)} · ${INSTITUCION}</title><style>${CSS_MENSAJES_PACIENTE}</style>
</head><body>
<a class="mp-saltar" href="#contenido">Saltar al contenido</a>
<header class="mp-marca"><div class="mp-marca-interior"><div class="mp-identidad">${sello()}<span>${INSTITUCION}</span></div>
<a href="${esc(rutaLocal(volver, "/paciente/mis-horas"))}" class="mp-regresar">${ico("chevIzq")}${esc(textoVolver)}</a></div></header>
<main class="mp-main" id="contenido" tabindex="-1">${contenido}</main>
</body></html>`;
}

function accionesMensaje(mensaje) {
  const acciones = (mensaje.acciones || []).map(({ texto, post }) =>
    forma("/paciente/mensajes/responder", post, texto));
  const comprobante = rutaLocal(mensaje.enlaceComprobante, "");
  const encuesta = rutaLocal(mensaje.enlaceEncuesta, "");
  if (!acciones.length && !comprobante && !encuesta && !mensaje.encuestaRespondida) return "";
  return `<div class="mp-acciones" aria-label="Acciones del mensaje">
    ${comprobante ? `<a href="${esc(comprobante)}">${ico("documento")}Ver comprobante</a>` : ""}
    ${acciones.join("")}
    ${mensaje.encuestaRespondida ? `<span class="mp-respondida">${ico("check")}Encuesta respondida</span>`
      : encuesta ? `<a class="mp-accion-destacada" href="${esc(encuesta)}">Responder encuesta${ico("flecha")}</a>` : ""}
  </div>`;
}

function entrada({ elemento, activa, ruta, canal, chat }) {
  const titulo = chat ? INSTITUCION : elemento.titulo || "Sin asunto";
  const resumen = elemento.resumen || elemento.mensajes?.at(-1)?.texto || "";
  return `<li><a class="mp-mensaje-item" href="${esc(urlBandeja(ruta, canal.clave, elemento.id))}"${activa ? ' aria-current="page"' : ""}>
    ${chat ? sello("mp-avatar") : `<span class="mp-icono-item">${sobre}</span>`}
    <span class="mp-item-contenido"><span class="mp-item-titulo"><strong>${esc(titulo)}</strong>${fechaHtml(elemento.fecha, "corta")}</span>
    ${chat ? "" : `<span class="mp-item-remitente">${INSTITUCION}</span>`}
    ${resumen ? `<span class="mp-item-resumen">${esc(resumen)}</span>` : ""}</span>
  </a></li>`;
}

function lista({ elementos, seleccionado, ruta, canal, chat }) {
  const entradas = elementos.map((elemento) => entrada({
    elemento, activa: seleccionado?.id === elemento.id, ruta, canal, chat,
  }));
  return `<section class="mp-lista" aria-labelledby="mp-lista-titulo">
    <header><h2 id="mp-lista-titulo">${canal.lista}</h2></header>
    ${entradas.length ? `<ul>${entradas.join("")}</ul>` : `<p class="mp-lista-vacia">${canal.vacio}</p>`}
  </section>`;
}

function chatContenido(seleccionado) {
  let anterior = "";
  const mensajes = seleccionado.mensajes.map((mensaje) => {
    const { dia } = fechaPartes(mensaje.fecha);
    const fecha = dia && dia !== anterior
      ? `<li class="mp-separador-dia"><time datetime="${esc(dia)}">${esc(fechaDia(dia))}</time></li>` : "";
    anterior = dia;
    const propio = mensaje.direccion === "ENTRANTE";
    return `${fecha}<li class="mp-burbuja${propio ? " mp-burbuja-propia" : " mp-burbuja-recibida"}">
      <div class="mp-autor">${propio ? "Tú" : INSTITUCION}</div>
      ${mensaje.titulo && !propio ? `<h3>${esc(mensaje.titulo)}</h3>` : ""}
      ${mensaje.texto ? `<p class="mp-texto">${esc(mensaje.texto)}</p>` : ""}
      ${mensaje.resultado ? `<p class="mp-resultado">${esc(mensaje.resultado)}</p>` : ""}
      ${accionesMensaje(mensaje)}
      ${fechaHtml(mensaje.fecha, "hora")}
    </li>`;
  }).join("");
  return `<header class="mp-lector-cab mp-contacto">${sello("mp-avatar")}<h2 id="mp-lector-titulo">${INSTITUCION}</h2></header>
  <div class="mp-historial" tabindex="0" role="region" aria-label="Historial de WhatsApp"><ol>${mensajes}</ol></div>`;
}

function correoContenido(seleccionado) {
  const [mensaje] = seleccionado.mensajes;
  const destinatario = [seleccionado.nombre, seleccionado.destino].filter(Boolean).join(" · ");
  return `<div class="mp-correo-contenido" tabindex="0" role="region" aria-label="Contenido del correo">
    <header class="mp-lector-cab"><h2 id="mp-lector-titulo">${esc(mensaje.titulo || seleccionado.titulo || "Sin asunto")}</h2></header>
    <div class="mp-correo-sobre">
      ${sello("mp-avatar")}
      <dl><div><dt>De</dt><dd>${INSTITUCION}</dd></div>
      ${destinatario ? `<div><dt>Para</dt><dd>${esc(destinatario)}</dd></div>` : ""}
      ${mensaje.fecha ? `<div><dt>Fecha</dt><dd>${fechaHtml(mensaje.fecha)}</dd></div>` : ""}</dl>
    </div>
    <div class="mp-correo-cuerpo">
      ${mensaje.texto ? `<p class="mp-texto">${esc(mensaje.texto)}</p>` : ""}
      ${mensaje.resultado ? `<p class="mp-resultado">${esc(mensaje.resultado)}</p>` : ""}
      ${accionesMensaje(mensaje)}
    </div>
  </div>`;
}

function paginaMensajesPaciente({
  canal, elementos = [], seleccionado, seleccionExplicita,
  ruta = "/paciente/mensajes", estado, volver = "/paciente/mis-horas",
}) {
  const chat = canal !== "Correo" && canal !== "correo";
  const activo = chat ? CANALES[0] : CANALES[1];
  const tabs = CANALES.map((c) =>
    `<a href="${esc(urlBandeja(ruta, c.clave, c === activo && seleccionExplicita ? seleccionado?.id : null))}"${c === activo ? ' aria-current="page"' : ""}>
      ${iconoCanal(c.clave)}${c.nombre}</a>`).join("");
  const lector = seleccionado?.mensajes?.length ? `<section class="mp-lector" aria-labelledby="mp-lector-titulo">
    <a class="mp-volver-lista" href="${esc(urlBandeja(ruta, activo.clave))}">${ico("chevIzq")}${activo.lista}</a>
    ${chat ? chatContenido(seleccionado) : correoContenido(seleccionado)}
  </section>` : `<div class="mp-lector mp-sin-seleccion"><span>${iconoCanal(activo.clave)}</span>${elementos.length ? "<p>Selecciona un mensaje para abrirlo.</p>" : ""}</div>`;
  return pagina({
    titulo: "Mis mensajes", volver, textoVolver: "Volver al portal",
    contenido: `<div class="mp-encabezado">
      <div class="mp-titulo"><h1>Mis mensajes</h1><span class="mp-demo">Vista de demostración</span></div>
      <nav class="mp-canales" aria-label="Canal de mensajes">${tabs}</nav>
    </div>
    ${aviso(estado)}
    <div class="mp-panel mp-${activo.clave}"${seleccionExplicita && seleccionado ? " data-abierto" : ""}>
      ${lista({ elementos, seleccionado, ruta, canal: activo, chat })}
      ${lector}
    </div>`,
  });
}

function paginaEncuestaPaciente({
  accion = "/paciente/mensajes/encuesta", id, volver = "/paciente/mensajes", estado, respondida, nota, comentario,
}) {
  const notas = [1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="nota" value="${n}"${Number(nota) === n ? " checked" : ""} required><span>${n}</span></label>`).join("");
  return pagina({
    titulo: "Encuesta de atención", volver, textoVolver: "Volver a mis mensajes",
    contenido: `<div class="mp-encuesta">
      <div class="mp-titulo"><h1>Encuesta de atención</h1><span class="mp-demo">Vista de demostración</span></div>
      ${aviso(estado)}
      ${respondida ? `<div class="mp-encuesta-cuerpo mp-encuesta-lista">
        ${ico("check")}<h2>Encuesta respondida</h2><p>Gracias por compartir tu experiencia.</p>
        <a class="mp-accion-destacada" href="${esc(rutaLocal(volver, "/paciente/mensajes"))}">Volver a mis mensajes</a>
      </div>` : `<form method="post" action="${esc(rutaLocal(accion, "/paciente/mensajes/encuesta"))}" class="mp-encuesta-cuerpo">
        <input type="hidden" name="id" value="${esc(id)}">
        <fieldset><legend>¿Cómo fue tu atención?</legend><div class="mp-notas">${notas}</div>
        <div class="mp-escala"><span>Mala</span><span>Muy buena</span></div></fieldset>
        <label for="mp-comentario">Comentario <span>(opcional)</span></label>
        <textarea id="mp-comentario" name="comentario" rows="4" maxlength="300">${esc(comentario)}</textarea>
        <button type="submit" class="mp-accion-destacada">Enviar respuesta${ico("flecha")}</button>
      </form>`}
    </div>`,
  });
}

module.exports = { paginaMensajesPaciente, paginaEncuestaPaciente };

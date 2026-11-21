"use strict";
const { esc } = require("./componentesComunes");
const { hoy } = require("../herramientas/tiempo");

const INSTITUCION = "Hermandad de Dolores";
const ruta = "/demo/mensajes";

const icono = (trazos, tam = 20) =>
  `<svg viewBox="0 0 24 24" width="${tam}" height="${tam}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazos}</svg>`;
const I = {
  atras: icono('<path d="M15 5l-7 7 7 7"/>'),
  video: icono('<rect x="3" y="6" width="12" height="12" rx="2.5"/><path d="M15 10.5l6-3.5v10l-6-3.5"/>'),
  llamada: icono('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>'),
  menu: icono('<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>'),
  emoji: icono('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 007 0"/><path d="M9 9.5h.01M15 9.5h.01"/>', 22),
  clip: icono('<path d="M20 11l-8 8a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8"/>', 22),
  camara: icono('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 22),
  mic: icono('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', 24),
  enviar: icono('<path d="M4 12l16-8-6 17-3-7z"/>', 22),
  lupa: icono('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', 18),
};

const CSS = `
:root{--tinta:#183b4e;--fondo:#dfe6e9;--wa-cab:#075e54;--wa-fondo:#efeae2;--wa-propio:#d9fdd3;--wa-boton:#027eb5;--linea:#d8dee2}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--fondo);color:var(--tinta);font:16px/1.5 'Source Sans 3','Segoe UI',system-ui,sans-serif}
a{color:inherit}
.dm-barra{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:12px 20px;background:var(--tinta);color:#fff}
.dm-barra b{font-size:1.05rem}
.dm-barra span{font-size:.9rem;color:#c3dae0}
.dm-volver-barra{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border:1px solid #6f8b99;border-radius:8px;color:#fff;font-weight:600;text-decoration:none}
.dm-volver-barra:hover{background:rgba(255,255,255,.12)}
.dm-pagina{max-width:1100px;margin:0 auto;padding:20px 16px 48px}
.dm-pagina h1{margin:0 0 4px;font-size:1.6rem}
.dm-sub{margin:0 0 18px;color:#4b6573}
.dm-h2{margin:28px 0 4px;font-size:1.2rem}
.dm-canales{display:flex;gap:8px;margin:0 0 18px;flex-wrap:wrap}
.dm-canales a,.dm-volver{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;border:1.5px solid #9fb3bb;background:#fff;text-decoration:none;font-weight:600}
.dm-canales a[aria-current=page]{background:var(--tinta);border-color:var(--tinta);color:#fff}
.dm-aviso{margin:0 0 16px;padding:10px 14px;border-radius:8px;background:#e3f5ea;border:1px solid #b6dfc6}
.dm-aviso.dm-error{background:#fdecea;border-color:#f1b9b2}
.dm-vacio{padding:32px;border:2px dashed #9fb3bb;border-radius:12px;text-align:center;color:#4b6573;background:#f4f7f8}
.dm-pacientes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.dm-pacientes a{display:block;padding:14px 16px;border-radius:12px;background:#fff;border:1px solid var(--linea);text-decoration:none}
.dm-pacientes a:hover{border-color:var(--wa-boton)}
.dm-pacientes b{display:block}
.dm-pacientes span{font-size:.9rem;color:#4b6573}

.dm-escena{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;justify-items:center}
.dm-telefono{width:min(390px,100%);height:min(800px,calc(100vh - 150px));min-height:600px;padding:11px;border-radius:44px;background:#101820;box-shadow:0 18px 50px rgba(16,24,32,.35)}
.dm-pantalla{display:flex;flex-direction:column;height:100%;overflow:hidden;border-radius:34px;background:var(--wa-fondo)}
.dm-estado{display:flex;justify-content:space-between;align-items:center;padding:7px 20px 5px;background:var(--wa-cab);color:#fff;font-size:.78rem;font-weight:600}
.dm-estado span:last-child{display:flex;gap:6px;align-items:center}
.dm-wa-cab{display:flex;align-items:center;gap:8px;padding:6px 10px 9px 6px;background:var(--wa-cab);color:#fff}
.dm-wa-cab a{display:inline-grid;place-items:center;width:30px;height:36px;color:#fff;text-decoration:none}
.dm-avatar{width:38px;height:38px;border-radius:50%;background:#fff;padding:3px;flex:none}
.dm-wa-nombre{flex:1;min-width:0;line-height:1.2}
.dm-wa-nombre b{display:block;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-wa-nombre small{opacity:.85;font-size:.78rem}
.dm-wa-iconos{display:flex;gap:12px;align-items:center;padding-right:4px}
.dm-chat{flex:1;overflow-y:auto;padding:10px 10px 6px;display:flex;flex-direction:column;gap:4px;background-color:var(--wa-fondo);background-image:radial-gradient(rgba(11,20,26,.045) 1.2px,transparent 1.4px);background-size:16px 16px}
.dm-dia{align-self:center;margin:8px 0 6px;padding:3px 12px;border-radius:8px;background:#e1f2fb;font-size:.74rem;font-weight:600;letter-spacing:.02em;color:#54656f;text-transform:uppercase}
.dm-burbuja{position:relative;max-width:88%;padding:7px 10px 5px;border-radius:10px;background:#fff;box-shadow:0 1px 1px rgba(11,20,26,.13);align-self:flex-start}
.dm-burbuja::before{content:'';position:absolute;top:0;left:-6px;border:6px solid transparent;border-top-color:#fff;border-right-color:#fff}
.dm-burbuja.dm-propia{align-self:flex-end;background:var(--wa-propio)}
.dm-burbuja.dm-propia::before{left:auto;right:-6px;border-top-color:var(--wa-propio);border-right-color:transparent;border-left-color:var(--wa-propio)}
.dm-burbuja p{margin:0;overflow-wrap:anywhere;font-size:.93rem;line-height:1.4}
.dm-burbuja strong{font-weight:700}
.dm-pie-b{display:flex;justify-content:flex-end;align-items:center;gap:3px;margin-top:1px;font-size:.7rem;color:#667781}
.dm-checks{display:inline-flex;color:#53bdeb}
.dm-checks svg{width:16px;height:16px;margin-left:-8px}
.dm-checks svg:first-child{margin-left:0}
.dm-adjunto{display:flex;align-items:center;gap:8px;margin:0 0 6px;padding:8px 10px;border-radius:8px;background:#f0f2f5;font-size:.84rem;color:#54656f}
.dm-adjunto b{padding:2px 6px;border-radius:4px;background:#d93025;color:#fff;font-size:.68rem}
.dm-wa-botones{display:grid;gap:3px;align-self:flex-start;width:min(88%,320px);margin:1px 0 4px}
.dm-wa-botones form{display:contents}
.dm-wa-boton{display:block;width:100%;min-height:42px;padding:10px;border:0;border-radius:10px;background:#fff;color:var(--wa-boton);font-family:inherit;font-weight:600;font-size:.93rem;line-height:1.2;text-align:center;text-decoration:none;box-shadow:0 1px 1px rgba(11,20,26,.13);cursor:pointer}
.dm-wa-boton:hover{background:#f5f6f6}
.dm-vacio-wa{margin:auto 6px;padding:18px 16px;border-radius:12px;background:#fffbe6;border:1px solid #f0e2a6;color:#5f4b00;font-size:.9rem;line-height:1.45;text-align:center}
.dm-vacio-wa a{color:var(--wa-boton);font-weight:600}
.dm-vacio-wa p{margin:0}
.dm-vacio-wa .dm-nota{margin-top:10px;font-size:.8rem;color:#7a6500}
.dm-vacio-wa form{margin:14px 0 0}
.dm-activar{min-height:44px;padding:0 18px;border:0;border-radius:999px;background:#00a884;color:#fff;font-family:inherit;font-weight:700;font-size:.95rem;cursor:pointer}
.dm-wa-listo{align-self:flex-start;font-size:.78rem;color:#54656f;padding:0 6px}
.dm-wa-entrada{display:flex;align-items:center;gap:6px;padding:6px 8px 8px;background:var(--wa-fondo)}
.dm-wa-campo{flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:999px;background:#fff;color:#8696a0;height:44px}
.dm-wa-campo input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:.95rem;color:#111b21}
.dm-wa-campo input::placeholder{color:#8696a0}
.dm-wa-campo:focus-within{box-shadow:0 0 0 2px #00a88455}
.dm-wa-enviar{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:#00a884;color:#fff;display:grid;place-items:center;cursor:pointer}
.dm-wa-enviar .dm-i-enviar{display:none}
.dm-wa-entrada[data-vacio="0"] .dm-i-mic{display:none}
.dm-wa-entrada[data-vacio="0"] .dm-i-enviar{display:block}
.dm-nav{display:flex;justify-content:space-around;align-items:center;padding:8px 0 10px;background:#fff;color:#5f6368}
.dm-control{max-width:390px;text-align:center;font-size:.88rem;color:#4b6573}
.dm-control form{margin:0 0 8px}
.dm-control button{min-height:44px;padding:0 20px;border-radius:999px;border:1.5px solid var(--tinta);background:#fff;color:var(--tinta);font-family:inherit;font-weight:600;font-size:.95rem;cursor:pointer}
.dm-control button:hover{background:#eef4f6}

.dm-correo{display:grid;grid-template-columns:190px minmax(240px,320px) minmax(0,1fr);grid-template-rows:auto 1fr;min-height:600px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 12px 34px rgba(16,24,32,.2);border:1px solid #c5ced3}
.dm-correo-cab{grid-column:1/-1;display:flex;align-items:center;gap:14px;padding:10px 16px;background:#f3f6f8;border-bottom:1px solid var(--linea)}
.dm-correo-cab strong{font-size:1.05rem;min-width:158px}
.dm-correo-busca{flex:1;display:flex;align-items:center;gap:8px;max-width:520px;height:38px;padding:0 14px;border-radius:999px;background:#e5ecef;color:#667781;font-size:.9rem}
.dm-correo-yo{margin-left:auto;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--tinta);color:#fff;font-weight:700;font-size:.85rem}
.dm-correo-lateral{padding:14px 10px;background:#f8fafb;border-right:1px solid var(--linea)}
.dm-carpeta{display:flex;justify-content:space-between;padding:8px 12px;border-radius:999px;font-size:.92rem}
.dm-carpeta.dm-activa{background:#dbe8ee;font-weight:700}
.dm-correo-lista{border-right:1px solid var(--linea);overflow-y:auto;max-height:620px}
.dm-correo-lista ul{list-style:none;margin:0;padding:0}
.dm-correo-lista a{display:block;padding:12px 14px;border-bottom:1px solid #edf1f3;text-decoration:none}
.dm-correo-lista a[aria-current=page]{background:#e8f1f5}
.dm-correo-lista b{display:flex;justify-content:space-between;gap:8px;font-size:.92rem}
.dm-correo-lista b time{font-weight:400;font-size:.78rem;color:#667781;white-space:nowrap}
.dm-correo-lista .dm-asunto{display:block;font-size:.88rem;font-weight:600;color:#202124}
.dm-correo-lista .dm-vista{display:block;font-size:.82rem;color:#5f6368;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dm-lector{padding:22px 28px;overflow-y:auto;max-height:620px}
.dm-lector h2{margin:0 0 14px;font-size:1.35rem;font-weight:500;color:#202124}
.dm-remitente{display:flex;gap:12px;align-items:center;margin:0 0 18px;font-size:.88rem}
.dm-remitente b{display:block;font-size:.95rem}
.dm-remitente span{color:#5f6368}
.dm-cuerpo{max-width:560px;border:1px solid var(--linea);border-radius:10px;padding:20px 22px}
.dm-cuerpo .dm-marca{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--linea);font-weight:700;color:var(--tinta)}
.dm-cuerpo p{margin:0 0 14px;line-height:1.55}
.dm-cuerpo strong{font-weight:700}
.dm-correo-boton{display:inline-flex;align-items:center;min-height:42px;padding:0 20px;border-radius:6px;border:1.5px solid var(--tinta);background:#fff;color:var(--tinta);font-family:inherit;font-weight:600;font-size:.95rem;text-decoration:none}
.dm-pie{margin:14px 0 0;font-size:.8rem;color:#667781}
.dm-simulado{margin:14px auto 0;text-align:center;font-size:.85rem;color:#4b6573}

.dm-encuesta{max-width:520px;margin:0 auto;padding:24px;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(16,24,32,.12)}
.dm-notas{display:flex;gap:8px;margin:12px 0}
.dm-notas label{flex:1}
.dm-notas input{position:absolute;opacity:0}
.dm-notas span{display:grid;place-items:center;min-height:48px;border:1.5px solid #9fb3bb;border-radius:10px;font-weight:700;cursor:pointer}
.dm-notas input:checked+span{background:var(--tinta);color:#fff;border-color:var(--tinta)}
.dm-notas input:focus-visible+span{outline:3px solid #7fd0d6;outline-offset:2px}
.dm-encuesta textarea{width:100%;padding:10px;border:1.5px solid #9fb3bb;border-radius:10px;font:inherit}
.dm-encuesta button{margin-top:14px;min-height:48px;padding:0 24px;border:0;border-radius:10px;background:#00a884;color:#fff;font-family:inherit;font-weight:700;font-size:1rem;cursor:pointer}
@media(max-width:900px){.dm-correo{grid-template-columns:1fr}.dm-correo-lateral{display:none}.dm-correo-lista{max-height:240px;border-right:0;border-bottom:1px solid var(--linea)}}
@media(max-width:480px){.dm-telefono{padding:7px;border-radius:30px;height:calc(100vh - 170px)}.dm-pagina{padding:14px 8px 32px}}
`;

function pagina(titulo, cuerpo, volver = { href: "/", texto: "Volver" }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(titulo)} · ${INSTITUCION}</title><style>${CSS}</style></head><body>
<div class="dm-barra"><a class="dm-volver-barra" href="${esc(volver.href)}" data-volver>‹ ${esc(volver.texto)}</a><b>${INSTITUCION} · Mensajes de demostración</b><span>Datos ficticios: no se envía ningún mensaje real</span></div>
<main class="dm-pagina">${cuerpo}</main><script>(function(){var ok=false;try{ok=!!document.referrer&&new URL(document.referrer).origin===location.origin}catch(e){}document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("[data-volver]");if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.button)return;if(ok&&history.length>1){e.preventDefault();history.back()}});
var c=document.querySelector(".dm-chat");if(c)c.scrollTop=c.scrollHeight;
var f=document.querySelector(".dm-wa-entrada");if(f){var i=f.querySelector("input[name=texto]");var t=function(){f.setAttribute("data-vacio",i.value.trim()?"0":"1")};i.addEventListener("input",t);t()}})();</script></body></html>`;
}

const hora = (fecha) => String(fecha || "").slice(11, 16);
const dia = (fecha) => {
  const [a, m, d] = String(fecha || "").slice(0, 10).split("-").map(Number);
  return a ? new Date(Date.UTC(a, m - 1, d)).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
};
const formatear = (texto) => esc(texto).replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
const aviso = (estado) => estado?.texto ? `<p class="dm-aviso${estado.tipo === "error" ? " dm-error" : ""}" role="${estado.tipo === "error" ? "alert" : "status"}">${esc(estado.texto)}</p>` : "";
const oculto = (datos) => Object.entries(datos).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join("");

function indice({ pacientes, conHoras = [], estado }) {
  const lista = pacientes.length
    ? `<ul class="dm-pacientes">${pacientes.map((p) => `<li><a href="${ruta}?rut=${encodeURIComponent(p.rut)}"><b>${esc(p.nombre)}</b><span>${esc(p.rut)} · ${p.whatsapp} en WhatsApp · ${p.correo} en correo</span></a></li>`).join("")}</ul>`
    : `<p class="dm-vacio">Todavía no hay mensajes. Reserva una hora con consentimiento para comunicaciones y aparecerá aquí.</p>`;
  const otros = conHoras.length
    ? `<h2 class="dm-h2">Pacientes con horas reservadas</h2><p class="dm-sub">Aún no tienen mensajes. Entra a uno para activar su WhatsApp en la demostración.</p><ul class="dm-pacientes">${conHoras.map((p) => `<li><a href="${ruta}?rut=${encodeURIComponent(p.rut)}&amp;canal=whatsapp"><b>${esc(p.nombre)}</b><span>${esc(p.rut)} · próxima hora el ${esc(dia(p.fecha))} · ${p.whatsapp ? "con WhatsApp" : "sin WhatsApp"}</span></a></li>`).join("")}</ul>`
    : "";
  return pagina("Mensajes de demostración", `<h1>Mensajes de demostración</h1>
<p class="dm-sub">Así los vería cada paciente en su WhatsApp y en su correo. Elige a quién mirar.</p>${aviso(estado)}${lista}${otros}`);
}

function botonesWhatsApp(m, rut) {
  const acciones = m.acciones.map((texto) => `<form method="post" action="${ruta}/responder">${oculto({ rut, id: m.id, canal: "WhatsApp", decision: texto })}<button type="submit" class="dm-wa-boton">${esc(texto)}</button></form>`);
  if (m.enlaceEncuesta) acciones.push(m.encuestaRespondida ? `<span class="dm-wa-listo">Encuesta respondida</span>` : `<a class="dm-wa-boton" href="${esc(m.enlaceEncuesta)}">Responder encuesta</a>`);
  return acciones.length ? `<div class="dm-wa-botones">${acciones.join("")}</div>` : "";
}

function vacioWhatsapp(rut, motivo, activable) {
  const texto = {
    "sin-whatsapp": `Este paciente no tiene WhatsApp registrado: sus avisos llegan por correo. <a href="${ruta}?rut=${encodeURIComponent(rut)}&amp;canal=correo">Ver su correo</a>.<br><br>Para probar el WhatsApp, reserva con un paciente que tenga WhatsApp (marca «El celular tiene WhatsApp») y acepta recibir el comprobante y los avisos.`,
    "sin-consentimiento": "Este paciente no aceptó recibir avisos por WhatsApp o correo, así que no se le envían mensajes.",
    "sin-mensajes": "Todavía no hay mensajes. El comprobante llega al reservar una hora, y el bot envía después el recordatorio.",
  }[motivo];
  const activar = activable
    ? `<form method="post" action="${ruta}/activar-whatsapp">${oculto({ rut })}<button type="submit" class="dm-activar">Mostrar este paciente en WhatsApp</button></form><p class="dm-nota">Marca al paciente con WhatsApp, deja su consentimiento para la demostración y envía el comprobante de su próxima hora.</p>`
    : `<p class="dm-nota">Este paciente no tiene horas reservadas: reserva una hora para ver sus mensajes.</p>`;
  return `<div class="dm-vacio-wa"><p>${texto}</p>${activar}</div>`;
}

function whatsapp({ rut, mensajes, vacio, activable }) {
  let anterior = "";
  const burbujas = mensajes.map((m) => {
    const d = String(m.fecha || "").slice(0, 10);
    const separador = d && d !== anterior ? `<span class="dm-dia">${d === hoy() ? "Hoy" : esc(dia(d))}</span>` : "";
    anterior = d;
    const propia = m.direccion === "ENTRANTE";
    const adjunto = m.tipo === "Comprobante de reserva" ? `<div class="dm-adjunto"><b>PDF</b>comprobante-de-reserva.pdf</div>` : "";
    const palomita = icono('<path d="M4 12l5 5L20 6"/>', 16);
    const checks = propia ? `<span class="dm-checks" aria-label="Leído">${palomita}${palomita}</span>` : "";
    return `${separador}<div class="dm-burbuja${propia ? " dm-propia" : ""}">${adjunto}<p>${formatear(m.texto)}</p><div class="dm-pie-b"><time>${esc(hora(m.fecha))}</time>${checks}</div></div>${propia ? "" : botonesWhatsApp(m, rut)}`;
  }).join("");
  return `<div class="dm-escena" data-canal="whatsapp"><div class="dm-telefono"><div class="dm-pantalla">
<div class="dm-estado"><span>${esc(hora(mensajes.at(-1)?.fecha) || "09:41")}</span><span>${icono('<path d="M4 18h2V12H4zM9 18h2V8H9zM14 18h2V4h-2z"/>', 13)}${icono('<rect x="4" y="8" width="14" height="9" rx="2"/><path d="M21 11v3"/>', 15)}</span></div>
<div class="dm-wa-cab"><a href="${ruta}" aria-label="Volver">${I.atras}</a><img class="dm-avatar" src="/img/sello.png" alt="" width="38" height="38"><span class="dm-wa-nombre"><b>${INSTITUCION}</b><small>en línea</small></span>
<span class="dm-wa-iconos"><span role="img" aria-label="Videollamada">${I.video}</span><span role="img" aria-label="Llamada">${I.llamada}</span><span role="img" aria-label="Más opciones">${I.menu}</span></span></div>
<div class="dm-chat" role="log" aria-label="Chat de WhatsApp">${burbujas || vacioWhatsapp(rut, vacio || "sin-mensajes", activable)}</div>
<form class="dm-wa-entrada" data-vacio="1" method="post" action="${ruta}/enviar" autocomplete="off">${oculto({ rut })}<div class="dm-wa-campo"><span aria-hidden="true">${I.emoji}</span><input type="text" name="texto" maxlength="300" placeholder="Escribe un mensaje" aria-label="Escribe un mensaje"><span aria-hidden="true">${I.clip}</span><span aria-hidden="true">${I.camara}</span></div>
<button type="submit" class="dm-wa-enviar" aria-label="Enviar"><span class="dm-i-mic">${I.mic}</span><span class="dm-i-enviar">${I.enviar}</span></button></form>
<div class="dm-nav" aria-hidden="true">${icono('<path d="M15 5L7 12l8 7z"/>', 18)}${icono('<circle cx="12" cy="12" r="6"/>', 18)}${icono('<rect x="6" y="6" width="12" height="12" rx="1.5"/>', 18)}</div>
</div></div>
<div class="dm-control"><form method="post" action="${ruta}/avanzar">${oculto({ rut })}<button type="submit">Simular el siguiente aviso del bot</button></form>
Avanza el tiempo hasta el próximo recordatorio programado (por ejemplo, el del día antes). Escribe <em>Confirmar</em> o <em>Cancelar mi hora</em>, o usa los botones.</div></div>`;
}

function correo({ rut, mensajes, seleccionado, paciente }) {
  const lista = [...mensajes].reverse().map((m) => `<li><a href="${ruta}?rut=${encodeURIComponent(rut)}&canal=correo&mensaje=${esc(m.id)}"${m.id === seleccionado?.id ? ' aria-current="page"' : ""}><b>${INSTITUCION}<time>${esc(dia(m.fecha).replace(/ de \d{4}$/, ""))}</time></b><span class="dm-asunto">${esc(m.titulo)}</span><span class="dm-vista">${esc(String(m.texto).split("\n")[0])}</span></a></li>`).join("");
  const lector = seleccionado ? `<article class="dm-lector" aria-label="Correo abierto"><h2>${esc(seleccionado.titulo)} · ${INSTITUCION}</h2>
<div class="dm-remitente"><img class="dm-avatar" src="/img/sello.png" alt="" width="38" height="38"><div><b>${INSTITUCION} &lt;avisos@ejemplo.cl&gt;</b><span>para ${esc(paciente.nombre)} &lt;${esc(seleccionado.correo || "")}&gt; · ${esc(dia(seleccionado.fecha))}, ${esc(hora(seleccionado.fecha))}</span></div></div>
<div class="dm-cuerpo"><div class="dm-marca"><img class="dm-avatar" style="width:30px;height:30px" src="/img/sello.png" alt="" width="30" height="30">${INSTITUCION}</div>
<p>${formatear(seleccionado.texto)}</p>
${seleccionado.tipo === "Comprobante de reserva" ? `<div class="dm-adjunto"><b>PDF</b>comprobante-de-reserva.pdf</div>` : ""}
${seleccionado.enlaceEncuesta ? (seleccionado.encuestaRespondida ? `<p class="dm-wa-listo">Encuesta respondida</p>` : `<p><a class="dm-correo-boton" href="${esc(seleccionado.enlaceEncuesta)}">Responder encuesta</a></p>`) : ""}
<p class="dm-pie">Este es un mensaje automático de ${INSTITUCION}. Si tienes dudas, llama a tu policlínico.</p></div></article>` : `<div class="dm-lector"><p class="dm-vacio">Sin correos.</p></div>`;
  return `<div class="dm-correo" data-canal="correo"><header class="dm-correo-cab"><strong>Correo</strong><div class="dm-correo-busca">${I.lupa}Buscar en el correo</div><span class="dm-correo-yo" aria-hidden="true">${esc(String(paciente.nombre || "P").charAt(0))}</span></header>
<aside class="dm-correo-lateral"><div class="dm-carpeta dm-activa"><span>Recibidos</span><span>${mensajes.length}</span></div><div class="dm-carpeta"><span>Destacados</span></div><div class="dm-carpeta"><span>Enviados</span></div><div class="dm-carpeta"><span>Spam</span></div></aside>
<section class="dm-correo-lista" aria-label="Bandeja de entrada"><ul>${lista || `<li><p class="dm-vacio">Sin correos.</p></li>`}</ul></section>${lector}</div>
<p class="dm-simulado">Por correo llega solo el comprobante. No sale ningún correo real.</p>`;
}

function paciente({ paciente: ficha, canal, mensajes, seleccionado, vacio, activable, estado }) {
  const rut = ficha.rut;
  const tabs = [["whatsapp", "WhatsApp"], ["correo", "Correo"]].map(([clave, nombre]) =>
    `<a href="${ruta}?rut=${encodeURIComponent(rut)}&canal=${clave}"${clave === canal ? ' aria-current="page"' : ""}>${nombre}</a>`).join("");
  return pagina(`Mensajes de ${ficha.nombre}`, `<h1>Mensajes de ${esc(ficha.nombre)}</h1>
<p class="dm-sub">${esc(rut)} · <a href="${ruta}">Cambiar paciente</a></p>${aviso(estado)}
<nav class="dm-canales" aria-label="Aplicación">${tabs}</nav>
${canal === "correo" ? correo({ rut, mensajes, seleccionado, paciente: ficha }) : whatsapp({ rut, mensajes, vacio, activable })}`, { href: ruta, texto: "Volver a los pacientes" });
}

function encuesta({ rut, id, tipo, estado, respondida, nota, comentario }) {
  const titulo = tipo === "atencion" ? "¿Cómo fue tu atención?" : "¿Cómo fue reservar tu hora?";
  const volver = `${ruta}?rut=${encodeURIComponent(rut)}`;
  const notas = [1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="nota" value="${n}"${Number(nota) === n ? " checked" : ""} required><span>${n}</span></label>`).join("");
  return pagina("Encuesta", `<div class="dm-encuesta"><h1>${titulo}</h1>${aviso(estado)}
${respondida ? `<p class="dm-aviso">Encuesta respondida. Gracias por compartir tu experiencia.</p><a class="dm-volver" href="${esc(volver)}">Volver a los mensajes</a>`
  : `<form method="post" action="${ruta}/encuesta">${oculto({ rut, id })}
<fieldset style="border:0;padding:0;margin:0"><legend>Elige una nota de 1 (mala) a 5 (muy buena)</legend><div class="dm-notas">${notas}</div></fieldset>
<label for="dm-comentario">Comentario (opcional)</label><textarea id="dm-comentario" name="comentario" rows="4" maxlength="300">${esc(comentario)}</textarea>
<button type="submit">Enviar respuesta</button></form>`}</div>`, { href: volver, texto: "Volver a los mensajes" });
}

module.exports = { indice, paciente, encuesta };

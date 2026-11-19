"use strict";
const { esc } = require("./util");
const { permitido, rutaInicio } = require("../auth/permisos");
const css = require("./estilos");
const pulido = require("./pulido.css");

const botonMenu = (id) =>
  `<button type="button" class="menu-btn" data-menu aria-controls="${id}" aria-expanded="false" aria-label="Abrir menú"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>`;

const WHATSAPP = "+56 9 2746 8124";
const CORREO = "casacentral@hermandad.cl";
const DIRECCION = "Casa Central: San Isidro #218, Santiago Centro";

const { ico } = require("./iconos");
const MENU = [
  {
    area: "admin",
    titulo: "GESTIÓN INSTITUCIONAL",
    items: [
      ["/admin/resumen", "Resumen", "inicio"],
      ["/admin/agendas", "Agendas y cupos", "calendario"],
      ["/admin/profesionales", "Equipo de salud", "medico"],
      ["/admin/policlinicos", "Policlínicos y especialidades", "edificio"],
      ["/admin/reportes", "Reportes", "grafico"],
    ],
  },
  {
    area: "tens",
    titulo: "OPERACIÓN DIARIA",
    items: [
      ["/tens/resumen", "Resumen", "inicio"],
      ["/tens/agenda", "Agendas y reservas", "calendario"],
      ["/tens/espera", "Lista de espera", "lista"],
      ["/tens/pacientes", "Pacientes", "usuarios"],
      ["/tens/comunicaciones", "Comunicaciones", "chat"],
    ],
  },
];
const NAV_PORTAL = [
  ["agendar", "/", "Reservar hora", "calendario"],
  ["consulta", "/paciente/consulta", "Consultar mi reserva", "buscar"],
  ["ayuda", "/ayuda", "Ayuda y contacto", "chat"],
  ["cuenta", "/paciente/cuenta", "Iniciar sesión", "usuarios"],
];

const URL_PORTAL = () => process.env.URL_PORTAL || "http://localhost:3000";
const ROLES = {
  ADMINISTRACION: "Administración",
  TENS_TONS: "TENS/TONS",
  TELEMEDICINA: "Telemedicina",
};
const marca =
  '<a class="marca" href="/" aria-label="Instituto de Caridad Hermandad de Dolores, inicio"><img class="logo" src="/img/logo.png" alt="Instituto de Caridad Hermandad de Dolores · +200 Años al servicio de Chile" width="170" height="46"></a>';
const script = `<script>(function(){var h=document.documentElement;function s(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function g(k){try{return localStorage.getItem(k)}catch(e){return null}}
document.querySelectorAll('.side a:not(.side-marca)').forEach(function(a){if(a.getAttribute('href')===location.pathname)a.classList.add('act')});
document.addEventListener('input',function(e){var c=e.target;if(!c.matches||!c.matches('input[name=rut],input[name=respRut],input[name=rutFamiliar],input[data-rut]'))return;
var v=c.value.toUpperCase().replace(/[^0-9K]/g,'');var k=v.slice(-1)==='K';v=v.replace(/K/g,'')+(k?'K':'');v=v.slice(0,9);c.value=v.length>1?v.slice(0,-1)+'-'+v.slice(-1):v});
var mb=document.querySelector('[data-menu]');function menu(abrir){document.body.classList.toggle('menu-abierto',abrir);if(mb)mb.setAttribute('aria-expanded',abrir?'true':'false')}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.body.classList.contains('menu-abierto')){menu(false);if(mb)mb.focus()}});
document.addEventListener('click',function(e){if(e.target.closest('[data-menu]')){menu(!document.body.classList.contains('menu-abierto'));return}
if(e.target.closest('.velo')||(document.body.classList.contains('menu-abierto')&&e.target.closest('.nav a,.side a'))){menu(false)}});
var tp=null;function mover(e){var t=e.target.closest&&e.target.closest('[data-tip]');if(!t){if(tp)tp.classList.remove('ver');return}
if(!tp){tp=document.createElement('div');tp.id='tip';tp.setAttribute('role','tooltip');document.body.appendChild(tp)}
tp.innerHTML=t.getAttribute('data-tip');tp.classList.add('ver');var w=tp.offsetWidth,hh=tp.offsetHeight,x=e.clientX+14,y=e.clientY+14;
if(x+w>innerWidth-8)x=e.clientX-w-14;if(y+hh>innerHeight-8)y=e.clientY-hh-14;tp.style.left=x+'px';tp.style.top=y+'px'}
document.addEventListener('mousemove',mover);document.addEventListener('mouseleave',function(){if(tp)tp.classList.remove('ver')})})();</script>`;

const iniciales = (n) =>
  String(n || "")
    .split(/\s+/)
    .filter((x) => /^[A-ZÁÉÍÓÚÑ]/.test(x))
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase() || "·";
const hoyLargo = () => {
  const t = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function pagina({
  titulo,
  contenido,
  mensaje,
  usuario,
  portal = false,
  activo = "",
  encabezado = true,
  lienzo = false,
  ingreso = false,
  portada = null,
  volver = null,
}) {
  const msg = mensaje
    ? `<p class="aviso ${mensaje.tipo === "error" ? "err" : "okk"}" role="status">${esc(mensaje.texto)}</p>`
    : "";
  let cuerpo;
  let clase = "";
  if (portal) {
    const conCuenta = !!require("./contextoPortal").peticion().paciente;
    const nav = NAV_PORTAL.map(([k, href, t, i]) =>
      k === "cuenta" && conCuenta ? [k, "/paciente/mis-horas", "Mi cuenta", i] : [k, href, t, i],
    ).map(
      ([k, href, t, i]) =>
        `<a href="${href}"${k === activo ? ' class="act" aria-current="page"' : ""}>${ico(i)}<span>${t}</span></a>`,
    ).join("");
    clase = "portal";
    let banda = portada;
    let resto = contenido;
    if (!banda && encabezado) {
      const m = contenido.match(/^\s*<p class="lead">([\s\S]*?)<\/p>/);
      banda = { titulo: esc(titulo), lead: m ? m[1] : "" };
      if (m) resto = contenido.slice(m[0].length);
    }
    const v = volver === false ? null : volver || { href: "/", texto: "Volver al inicio" };
    const volverHtml = v ? `<a class="volver" href="${esc(v.href)}">${ico("chevIzq")}<span>${esc(v.texto)}</span></a>` : "";
    const bandaHtml = banda
      ? `<section class="portada"><img class="portada-sello" src="/img/sello.png" alt="" width="460" height="460"><div class="portada-txt">${volverHtml}${banda.pre || ""}<h1>${banda.titulo}</h1>${banda.lead ? `<p class="lead">${banda.lead}</p>` : ""}</div>${banda.extra || ""}</section>`
      : "";
    const [sedeDir, calle] = DIRECCION.split(": ");
    cuerpo = `<aside class="side" id="menu-portal" aria-label="Menú principal"><a class="side-marca" href="/"><img src="/img/sello.png" alt="" width="38" height="38"><span><b>Hermandad de Dolores</b><small>Portal de pacientes</small></span></a>
<nav aria-label="Principal"><h3>AGENDAMIENTO DE HORAS</h3>${nav}</nav><div class="pie-s"><a href="https://wa.me/${WHATSAPP.replace(/\D/g, "")}" target="_blank" rel="noopener">${ico("telefono")}<span>WhatsApp ${WHATSAPP}</span></a><a href="/privacidad">${ico("escudo")}<span>Política de privacidad</span></a></div></aside>
<div class="velo" aria-hidden="true"></div>
<div class="app"><header class="sup"><div class="cab">${marca}${botonMenu("menu-portal")}</div></header>
<main id="contenido">${bandaHtml}${msg}${resto}</main>
<footer class="pie"><div class="pie-in"><span class="pie-marca"><img src="/img/sello.png" alt="" width="48" height="48"><span>Instituto de Caridad<br>Hermandad de Dolores</span></span>
<dl class="pie-datos"><div><dt>${esc(sedeDir)}</dt><dd>${esc(calle)}</dd></div><div><dt>WhatsApp</dt><dd><a href="https://wa.me/${WHATSAPP.replace(/\D/g, "")}">${WHATSAPP}</a></dd></div><div><dt>Correo</dt><dd><a href="mailto:${CORREO}">${CORREO}</a></dd></div></dl>
<p class="pie-legal">Más de 200 años al servicio de Chile. <a href="/privacidad">Política de privacidad</a></p></div></footer></div>`;
  } else if (ingreso) {
    clase = "ingreso";
    cuerpo = `<section class="ing-izq"><div><span class="logo-b"><img class="logo" src="/img/logo.png" alt="Instituto de Caridad Hermandad de Dolores" width="170" height="46"></span></div>
<div><h1>Sistema de gestión de citas</h1><p>Agenda, confirmaciones y recepción de los seis policlínicos y Telemedicina, en un solo lugar.</p>
<ul><li>${ico("calendario")}Agenda diaria por profesional</li><li>${ico("check")}Confirmaciones y lista de espera</li><li>${ico("grafico")}Reportes para Administración</li></ul></div>
<small style="color:#9fc0c9">Uso exclusivo del personal autorizado.</small></section>
<main class="ing-der" id="contenido"><div class="ing-caja">${msg}${contenido}</div></main>`;
  } else if (usuario) {
    clase = "pers";
    const botActivo = process.env.BOT_WHATSAPP === "1";
    const grupos = MENU.filter((g) => permitido(usuario.rol, g.area))
      .map(
        (g) =>
          `<h3>${g.titulo}</h3>${g.items
            .filter(([href]) => botActivo || href !== "/tens/bot")
            .map(
              ([href, t, i]) =>
                `<a href="${href}">${ico(i)}<span>${esc(t)}</span></a>`,
            )
            .join("")}`,
      )
      .join("");
    cuerpo = `<aside class="side" id="menu-personal" aria-label="Menú del personal"><a class="side-marca" href="${rutaInicio(usuario.rol)}"><img src="/img/sello.png" alt="" width="38" height="38"><span><b>Hermandad de Dolores</b><small>${permitido(usuario.rol, "admin") ? "Administración" : usuario.rol === "TELEMEDICINA" ? "Gestión de Telemedicina" : "TENS/TONS"}</small></span></a>
<nav>${grupos}</nav><div class="pie-s">${usuario.rol === "ADMINISTRACION" ? `<a href="/admin/usuarios">${ico("llave")}<span>Configuración / perfil</span></a>` : ""}<div class="side-user"><b>${esc(usuario.nombre)}</b><span>${esc(usuario.rol === "ADMINISTRACION" ? "Red institucional" : usuario.rol === "TELEMEDICINA" ? "Telemedicina" : (require("../models/sedesInfo").infoSede(usuario.idPoliclinico)?.nombre||"Lugar asignado"))}</span><form method="post" action="/logout" class="micro"><button type="submit">Cerrar sesión</button></form></div><a href="${esc(URL_PORTAL())}" target="_blank" rel="noopener">${ico("externo")}<span>Portal de pacientes</span></a></div></aside>
<div class="velo" aria-hidden="true"></div>
<div class="app"><header class="top"><div class="top-izq">${botonMenu("menu-personal")}<h1>${esc(titulo)}</h1></div><div class="der"><span class="fecha-hoy">${ico("calendario")}${esc(hoyLargo())}</span>
<div class="yo"><span class="av" aria-hidden="true">${esc(iniciales(usuario.nombre))}</span><span><b>${esc(usuario.nombre)}</b><small>${esc(ROLES[usuario.rol] || usuario.rol)}</small></span><form method="post" action="/logout"><button type="submit" class="sec">Salir</button></form></div></div></header>
<main id="contenido">${msg}${lienzo ? contenido : `<div class="cont">${contenido}</div>`}</main></div>`;
  } else {
    cuerpo = `<header><div class="cab">${marca}<nav class="nav"><a class="cta" href="/">Ir al inicio</a></nav></div></header>
<main id="contenido"><div class="cont solo"><h1>${esc(titulo)}</h1>${msg}${contenido}</div></main>`;
  }
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} – Hermandad de Dolores</title>
<meta name="description" content="Sistema de gestión de citas del Instituto de Caridad Hermandad de Dolores"><link rel="icon" type="image/png" href="/img/sello.png">
<meta name="theme-color" content="#183b4e">${portal ? '<meta name="color-scheme" content="light">' : ""}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap">
<style>${css}${usuario ? require("./operacion.css") : ""}${pulido}${portal ? require("./portal.css") : ""}</style></head>
<body${clase ? ` class="${clase}"` : ""}><a class="saltar" href="#contenido">Saltar al contenido</a>${cuerpo}${script}${usuario ? require("./operacion.script") : ""}</body></html>`;
}
module.exports = { pagina, WHATSAPP, CORREO, DIRECCION, iniciales };

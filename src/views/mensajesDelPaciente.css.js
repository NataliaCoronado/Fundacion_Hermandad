"use strict";

const CSS_MENSAJES_PACIENTE = `
:root {
  color-scheme: light;
  --mp-fondo: #f6f8f7;
  --mp-tinta: #193333;
  --mp-suave: #506662;
  --mp-borde: #d9e4e0;
  --mp-verde: #1a644f;
  --mp-claro: #e8f4ed;
  --mp-blanco: #fff;
  --mp-foco: #be740d;
}
*, *::before, *::after { box-sizing: border-box; }
body {
  min-height: 100dvh;
  margin: 0;
  color: var(--mp-tinta);
  background: var(--mp-fondo);
  font: 400 1rem/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
a { color: inherit; }
svg { width: 1.125rem; height: 1.125rem; flex: none; }
button, textarea { font: inherit; }
button { cursor: pointer; }
h1, h2, h3, p { margin: 0; }
:focus-visible { outline: 3px solid var(--mp-foco); outline-offset: 3px; }
.mp-saltar {
  position: absolute;
  z-index: 2;
  top: .5rem;
  left: .5rem;
  padding: .5rem .75rem;
  transform: translateY(-150%);
  border-radius: .5rem;
  background: var(--mp-tinta);
  color: #fff;
}
.mp-saltar:focus { transform: none; }

.mp-marca { background: var(--mp-blanco); border-bottom: 1px solid var(--mp-borde); }
.mp-marca-interior, .mp-main { width: min(76rem, 100%); margin-inline: auto; padding-inline: 1.5rem; }
.mp-marca-interior {
  min-height: 4rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.mp-identidad, .mp-regresar {
  display: inline-flex;
  align-items: center;
  gap: .625rem;
  font-weight: 650;
}
.mp-regresar {
  min-height: 2.75rem;
  padding: .375rem .625rem;
  border-radius: .5rem;
  color: var(--mp-verde);
  font-size: .875rem;
  text-decoration: none;
}
.mp-regresar:hover { background: var(--mp-claro); }
.mp-sello, .mp-avatar {
  display: block;
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  padding: .25rem;
  border: 1px solid #cadad2;
  border-radius: 50%;
  background: #fff;
  object-fit: contain;
}
.mp-main { padding-block: 1.625rem 2rem; }
.mp-encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: .875rem;
  margin-bottom: 1rem;
}
.mp-titulo { display: flex; flex-wrap: wrap; align-items: center; gap: .625rem 1rem; }
.mp-titulo h1 { font-size: clamp(1.5rem, 2.6vw, 2rem); font-weight: 750; letter-spacing: -.035em; line-height: 1.2; }
.mp-demo {
  padding: .2rem .6rem;
  border: 1px solid var(--mp-borde);
  border-radius: 100vmax;
  color: var(--mp-suave);
  background: #f1f5f3;
  font-size: .75rem;
  font-weight: 600;
}
.mp-canales {
  display: flex;
  gap: .25rem;
  padding: .25rem;
  border: 1px solid var(--mp-borde);
  border-radius: .875rem;
  background: #fff;
}
.mp-canales a, .mp-volver-lista {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  min-height: 2.5rem;
  padding: .5rem .75rem;
  border-radius: .625rem;
  color: var(--mp-suave);
  font-size: .875rem;
  font-weight: 700;
  text-decoration: none;
}
.mp-canales a:hover, .mp-volver-lista:hover { color: var(--mp-verde); background: var(--mp-claro); }
.mp-canales a[aria-current] { color: var(--mp-verde); background: var(--mp-claro); box-shadow: inset 0 0 0 1px #a5caba; }
.mp-aviso {
  display: flex;
  align-items: center;
  gap: .625rem;
  margin-bottom: 1rem;
  padding: .7rem .85rem;
  border: 1px solid #b8d7c8;
  border-radius: .625rem;
  color: #195840;
  background: #e7f4ed;
  font-size: .875rem;
}
.mp-aviso-error { border-color: #ebc8c5; color: #872c28; background: #fff1f0; }

.mp-panel {
  --mp-acento: #1a644f;
  --mp-seleccion: #eaf5ef;
  display: grid;
  grid-template-columns: minmax(14rem, 28%) minmax(0, 1fr);
  height: clamp(30rem, calc(100dvh - 11rem), 51rem);
  overflow: hidden;
  border: 1px solid var(--mp-borde);
  border-radius: 1rem;
  background: var(--mp-blanco);
  box-shadow: 0 10px 30px #19333308;
}
.mp-correo { --mp-acento: #2b5d84; --mp-seleccion: #edf5fb; }
.mp-lista, .mp-lector { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.mp-lista { border-inline-end: 1px solid var(--mp-borde); }
.mp-lista header, .mp-lector-cab {
  display: flex;
  align-items: center;
  gap: .65rem;
  min-height: 4.125rem;
  padding: .875rem 1.125rem;
  border-bottom: 1px solid var(--mp-borde);
}
.mp-lista h2, .mp-lector h2 { font-size: 1.0625rem; font-weight: 700; letter-spacing: -.015em; overflow-wrap: anywhere; }
.mp-lista ul, .mp-historial ol { margin: 0; padding: 0; list-style: none; }
.mp-lista ul { min-height: 0; overflow: auto; }
.mp-mensaje-item {
  display: flex;
  align-items: center;
  gap: .65rem;
  padding: .8rem .875rem;
  border-bottom: 1px solid var(--mp-borde);
  border-inline-start: 3px solid transparent;
  text-decoration: none;
}
.mp-mensaje-item:hover { background: #f6f9f8; }
.mp-mensaje-item[aria-current] { border-inline-start-color: var(--mp-acento); background: var(--mp-seleccion); }
.mp-icono-item {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: .6rem;
  color: var(--mp-acento);
  background: #e5eff7;
}
.mp-item-contenido { flex: 1; min-width: 0; }
.mp-item-titulo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: .5rem;
  font-size: .9375rem;
}
.mp-item-titulo strong, .mp-item-remitente, .mp-item-resumen {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mp-item-titulo time { flex: none; color: var(--mp-suave); font-size: .75rem; }
.mp-item-remitente, .mp-item-resumen { margin-top: .125rem; color: var(--mp-suave); font-size: .8125rem; }
.mp-lista-vacia { padding: 1rem 1.125rem; color: var(--mp-suave); font-size: .9375rem; }
.mp-sin-seleccion { align-items: center; justify-content: center; gap: .75rem; padding: 1rem; color: var(--mp-suave); background: #f7faf8; text-align: center; }
.mp-sin-seleccion > span {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border: 1px solid var(--mp-borde);
  border-radius: .75rem;
  background: #fff;
}
.mp-sin-seleccion svg { width: 1.5rem; height: 1.5rem; }
.mp-volver-lista { display: none; }

.mp-historial {
  display: flex;
  flex-direction: column-reverse;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: radial-gradient(circle, #d7e7dd 1px, transparent 1px) 0 0 / 17px 17px #f0f7f3;
}
.mp-historial ol {
  display: flex;
  flex: none;
  flex-direction: column;
  min-height: 100%;
  gap: .75rem;
  padding: 1.25rem;
}
.mp-historial:focus-visible, .mp-correo-contenido:focus-visible, .mp-mensaje-item:focus-visible { outline-offset: -3px; }
.mp-separador-dia { align-self: center; padding: .2rem .65rem; border-radius: 100vmax; color: #385b4b; background: #e0eee6; font-size: .75rem; }
.mp-burbuja {
  width: fit-content;
  max-width: min(84%, 40rem);
  padding: .8rem .9rem .65rem;
  border: 1px solid #dbe8e1;
  border-radius: .2rem .875rem .875rem .875rem;
  background: #fff;
  box-shadow: 0 1px 1px #15392b0b;
}
.mp-burbuja-propia { align-self: end; border-color: #bedac9; border-radius: .875rem .2rem .875rem .875rem; background: #ddf0e5; }
.mp-autor { margin-bottom: .25rem; color: #23614c; font-size: .8125rem; font-weight: 700; }
.mp-burbuja h3 { margin-bottom: .25rem; font-size: .9375rem; }
.mp-burbuja time { display: block; margin-top: .35rem; color: var(--mp-suave); text-align: end; font-size: .75rem; }
.mp-texto { white-space: pre-wrap; overflow-wrap: anywhere; }
.mp-burbuja .mp-texto { font-size: .9375rem; }
.mp-resultado { margin-top: .5rem; color: var(--mp-verde); font-weight: 650; overflow-wrap: anywhere; }

.mp-correo-contenido { flex: 1; min-height: 0; overflow-y: auto; }
.mp-correo-contenido h2 { font-size: 1.25rem; }
.mp-correo-sobre {
  display: flex;
  gap: .875rem;
  padding: 1.25rem 1.375rem;
  overflow-wrap: anywhere;
}
.mp-correo-sobre dl { display: grid; gap: .3rem; min-width: 0; margin: 0; font-size: .875rem; }
.mp-correo-sobre dl div { display: flex; gap: .65rem; }
.mp-correo-sobre dt { flex: 0 0 2.7rem; color: var(--mp-suave); }
.mp-correo-sobre dd { margin: 0; min-width: 0; }
.mp-correo-cuerpo { margin: 0 1.375rem 1.375rem; padding-top: 1.125rem; border-top: 1px solid var(--mp-borde); }
.mp-correo-cuerpo .mp-texto { max-width: 67ch; }

.mp-acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .45rem;
  margin-top: .75rem;
}
.mp-acciones :is(a, button), .mp-accion-destacada {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .375rem;
  min-height: 2.625rem;
  max-width: 100%;
  padding: .375rem .675rem;
  border: 1px solid #9ab8ac;
  border-radius: .45rem;
  color: var(--mp-acento, var(--mp-verde));
  background: #fff;
  font: 650 .875rem/1.25 system-ui, sans-serif;
  text-decoration: none;
  white-space: normal;
}
.mp-acciones :is(a, button):hover { background: var(--mp-seleccion); }
.mp-acciones :is(a, button):first-child { margin-top: 0; }
.mp-accion-destacada, .mp-acciones .mp-accion-destacada {
  color: #fff;
  border-color: var(--mp-acento, var(--mp-verde));
  background: var(--mp-acento, var(--mp-verde));
}
.mp-accion-destacada:hover, .mp-acciones .mp-accion-destacada:hover { color: #fff; background: #164b3d; }
.mp-respondida { display: inline-flex; align-items: center; gap: .3rem; color: var(--mp-verde); font-size: .875rem; font-weight: 650; }

.mp-encuesta { max-width: 38rem; margin: .5rem auto; }
.mp-encuesta .mp-titulo { margin-bottom: 1rem; }
.mp-encuesta-cuerpo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: .65rem;
  padding: clamp(1rem, 4vw, 1.75rem);
  border: 1px solid var(--mp-borde);
  border-radius: .875rem;
  background: #fff;
}
.mp-encuesta-cuerpo fieldset { width: 100%; max-width: 22rem; margin: 0 0 .375rem; padding: 0; border: 0; }
.mp-encuesta-cuerpo legend { margin-bottom: .65rem; padding: 0; font-weight: 700; }
.mp-notas { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .375rem; }
.mp-notas label { position: relative; min-width: 0; cursor: pointer; }
.mp-notas input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.mp-notas span {
  display: grid;
  place-items: center;
  min-height: 2.75rem;
  border: 1px solid #9ab8ac;
  border-radius: .5rem;
  color: var(--mp-verde);
  font-weight: 700;
}
.mp-notas label:hover span { background: var(--mp-claro); }
.mp-notas input:checked + span { color: #fff; background: var(--mp-verde); }
.mp-notas input:focus-visible + span { outline: 3px solid var(--mp-foco); outline-offset: 2px; }
.mp-escala { display: flex; justify-content: space-between; margin-top: .25rem; color: var(--mp-suave); font-size: .75rem; }
.mp-encuesta-cuerpo > label { font-size: .9375rem; font-weight: 650; }
.mp-encuesta-cuerpo > label span { color: var(--mp-suave); font-weight: 400; }
.mp-encuesta-cuerpo textarea { width: 100%; padding: .625rem; border: 1px solid #9ab8ac; border-radius: .5rem; color: var(--mp-tinta); resize: vertical; }
.mp-encuesta-cuerpo .mp-accion-destacada { margin-top: .35rem; }
.mp-encuesta-lista > svg { width: 2rem; height: 2rem; color: var(--mp-verde); }

@media (max-width: 45rem) {
  .mp-marca-interior, .mp-main { padding-inline: .875rem; }
  .mp-marca-interior { min-height: 3.5rem; gap: .375rem; }
  .mp-identidad { gap: .375rem; font-size: .8125rem; }
  .mp-sello { width: 2rem; height: 2rem; }
  .mp-regresar { gap: .2rem; padding-inline: .375rem; font-size: .8125rem; }
  .mp-main { padding-block: 1rem 1.25rem; }
  .mp-encabezado { margin-bottom: .75rem; }
  .mp-titulo { gap: .5rem .625rem; }
  .mp-panel { display: block; min-height: 15rem; height: auto; }
  .mp-panel .mp-lector, .mp-panel[data-abierto] .mp-lista { display: none; }
  .mp-panel[data-abierto] .mp-lector { display: flex; }
  .mp-lista { border: 0; }
  .mp-volver-lista { display: inline-flex; align-self: flex-start; margin: .125rem .625rem; }
  .mp-lector-cab { min-height: 3.5rem; padding: .625rem .875rem; }
  .mp-historial { max-height: 72dvh; }
  .mp-historial ol { padding: .875rem; }
  .mp-burbuja { max-width: 94%; padding-inline: .75rem; }
  .mp-correo-contenido { max-height: 75dvh; }
  .mp-correo-sobre { padding: .875rem; }
  .mp-correo-cuerpo { margin: 0 .875rem 1rem; padding-top: .875rem; }
}
`;

module.exports = { CSS_MENSAJES_PACIENTE };

"use strict";
module.exports = `<script>(() => {
  const sidebar = document.querySelector('#menu-personal');
  const abrir = document.querySelector('[data-menu]');
  const cerrar = sidebar.querySelector('.side-close');
  const app = document.querySelector('.app');
  const velo = document.querySelector('.velo');
  const saltar = document.querySelector('.saltar');
  const pantallaChica = matchMedia('(max-width: 1024px)');
  const actividad = document.querySelector('.personal-actividad');
  const ruta = location.pathname;

  const seccion = [
    [/^\\/admin\\/(?:bloque\\/|cupo(?:s?\\/|$)|cambios$|cancelaciones(?:\\/|$)|colores$)/, '/admin/agendas'],
    [/^\\/admin\\/equipo\\//, '/admin/profesionales'],
    [/^\\/admin\\/(?:lugar|especialidad)$/, '/admin/policlinicos'],
    [/^\\/admin\\/(?:usuario|auditoria)(?:\\/|$)/, '/admin/usuarios'],
    [/^\\/tens\\/(?:reserva|agendar|confirmaciones|avisos)$/, '/tens/agenda'],
    [/^\\/tens\\/(?:ficha|pacientes\\/editar)$/, '/tens/pacientes'],
  ].find(([patron]) => patron.test(ruta))?.[1] || ruta;
  for (const enlace of sidebar.querySelectorAll('nav a, .pie-s a')) {
    const href = (enlace.getAttribute('href') || '').split('?')[0];
    if (href === seccion) enlace.classList.add('act');
    if (href === ruta) enlace.setAttribute('aria-current', 'page');
  }

  function menu(abierto, devolverFoco = false) {
    const movil = pantallaChica.matches;
    abierto = movil && abierto;
    document.body.classList.toggle('menu-abierto', abierto);
    abrir.setAttribute('aria-expanded', String(abierto));
    abrir.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    sidebar.inert = movil && !abierto;
    app.inert = abierto;
    saltar.inert = abierto;
    if (abierto) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      cerrar.focus();
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      if (devolverFoco && movil) abrir.focus();
    }
  }

  menu(false);
  pantallaChica.addEventListener('change', () => {
    const teniaFoco = sidebar.contains(document.activeElement);
    menu(false, teniaFoco);
  });
  abrir.addEventListener('click', () => menu(true));
  cerrar.addEventListener('click', () => menu(false, true));
  velo.addEventListener('click', () => menu(false, true));
  sidebar.addEventListener('keydown', (evento) => {
    if (sidebar.getAttribute('aria-modal') !== 'true') return;
    if (evento.key === 'Escape') {
      evento.preventDefault();
      menu(false, true);
    }
    if (evento.key !== 'Tab') return;
    const enlaces = [...sidebar.querySelectorAll('a[href], button')];
    const primero = enlaces[0], ultimo = enlaces.at(-1);
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  });

  let demora, limite;
  function limpiarActividad() {
    clearTimeout(demora);
    clearTimeout(limite);
    actividad.textContent = '';
  }
  function mostrarActividad(texto) {
    limpiarActividad();
    demora = setTimeout(() => { actividad.textContent = texto; }, 150);
    limite = setTimeout(limpiarActividad, 20000);
  }
  const mismoDestino = (target) => !target || target === '_self';
  window.addEventListener('click', (evento) => {
    if (evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
    const enlace = evento.target.closest('a[href]');
    if (!enlace || enlace.hasAttribute('download') || !mismoDestino(enlace.target)) return;
    const destino = new URL(enlace.href);
    if (destino.origin !== location.origin || !/^\\/(?:admin|tens)\\//.test(destino.pathname)) return;
    if (/\\.(?:json|csv|pdf)$|\\/(?:exportar|archivo)$/.test(destino.pathname)) return;
    if (destino.pathname === ruta && destino.search === location.search && destino.hash) return;
    mostrarActividad('Cargando vista…');
  });
  window.addEventListener('submit', (evento) => {
    const form = evento.target;
    const accion = evento.submitter;
    if (evento.defaultPrevented || !mismoDestino(accion?.formTarget || form.target)) return;
    if (document.body.classList.contains('menu-abierto')) menu(false);
    const metodo = accion?.getAttribute('formmethod') || form.method;
    if (metodo === 'dialog') return;
    mostrarActividad(metodo === 'post' ? 'Procesando solicitud…' : 'Cargando resultados…');
  });
  window.addEventListener('pageshow', limpiarActividad);
  window.addEventListener('pagehide', limpiarActividad);
})();</script>`;

"use strict";
module.exports = `<script>(() => {
  const filtrosAgenda = document.querySelector('[data-filtros-agenda]');
  const cuentaProfesionales = (form) => {
    const opciones = [...form.querySelectorAll('[data-prof]')];
    const elegidos = opciones.filter(x => x.checked);
    const campo = form.querySelector('[name=prof]');
    if (!campo || !opciones.length) return;
    const todos = elegidos.length === opciones.length;
    campo.value = todos ? '' : elegidos.map(x => x.dataset.prof).join(',') || 'ninguno';
    form.querySelector('[data-prof-count]').textContent = todos ? 'Todos' : elegidos.length + ' seleccionados';
  };

  document.addEventListener('submit', (evento) => {
    const form = evento.target;
    for (const nombre of new Set([...form.querySelectorAll('[data-list]')].map(x => x.dataset.list))) {
      const campo = form.querySelector('input[name="' + nombre + '"]');
      if (campo) campo.value = [...form.querySelectorAll('[data-list="' + nombre + '"]:checked')].map(x => x.value).join(',');
    }
    cuentaProfesionales(form);
  });
  document.addEventListener('change', (evento) => {
    const campo = evento.target;
    if (campo.name === 'periodo' && campo.value !== 'rango') {
      campo.form.querySelector('[name=desde]').value = '';
      campo.form.querySelector('[name=hasta]').value = '';
    }
    if (campo.matches('[data-prof]')) cuentaProfesionales(campo.form);
  });

  if (filtrosAgenda) {
    filtrosAgenda.addEventListener('click', (evento) => {
      const accion = evento.target.closest('[data-elegir-prof]');
      if (!accion) return;
      for (const opcion of accion.form.querySelectorAll('[data-prof]')) opcion.checked = accion.dataset.elegirProf === 'todos';
      cuentaProfesionales(accion.form);
    });
    const desplegables = [...document.querySelectorAll('.agenda-actions, .agenda-prof-filter details')];
    document.addEventListener('click', (evento) => {
      for (const menu of desplegables) {
        if (menu.open && !menu.contains(evento.target)) menu.open = false;
      }
    });
    document.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Escape') return;
      const menu = desplegables.find(x => x.open && x.contains(evento.target));
      if (menu) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
  }

  const controlesAgenda = document.querySelector('[data-agenda-scroll-controls]');
  const horarioAgenda = document.querySelector('[data-agenda-scroll]');
  if (controlesAgenda && horarioAgenda) {
    const anterior = controlesAgenda.querySelector('[data-agenda-scroll-dir="-1"]');
    const siguiente = controlesAgenda.querySelector('[data-agenda-scroll-dir="1"]');
    const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)');

    function actualizarDesplazamiento() {
      const recorrido = horarioAgenda.scrollWidth - horarioAgenda.clientWidth;
      if (recorrido <= 1 && controlesAgenda.contains(document.activeElement)) {
        horarioAgenda.focus({ preventScroll: true });
      }
      controlesAgenda.hidden = recorrido <= 1;
      anterior.disabled = horarioAgenda.scrollLeft <= 1;
      siguiente.disabled = recorrido - horarioAgenda.scrollLeft <= 1;
    }

    for (const boton of [anterior, siguiente]) {
      boton.addEventListener('click', () => {
        horarioAgenda.scrollBy({
          left: Number(boton.dataset.agendaScrollDir) * Math.round(horarioAgenda.clientWidth * .8),
          behavior: reducirMovimiento.matches ? 'auto' : 'smooth',
        });
      });
    }
    horarioAgenda.addEventListener('scroll', actualizarDesplazamiento, { passive: true });
    if (typeof ResizeObserver === 'function') {
      const observar = new ResizeObserver(actualizarDesplazamiento);
      observar.observe(horarioAgenda);
      if (horarioAgenda.firstElementChild) observar.observe(horarioAgenda.firstElementChild);
    } else {
      window.addEventListener('resize', actualizarDesplazamiento);
    }
    actualizarDesplazamiento();
  }

  const drawer = document.querySelector('[data-agenda-drawer]');
  if (drawer && typeof drawer.showModal === 'function') {
    const contenido = drawer.querySelector('[data-detalle-contenido]');
    const cerrar = drawer.querySelector('[data-cerrar-detalle]');
    const titulo = drawer.querySelector('#agenda-drawer-title');
    const guardando = drawer.querySelector('[data-detalle-guardado]');
    const contexto = drawer.closest('[data-agenda-context]').dataset.agendaContext;
    let carga;
    let origen;
    let demoraGuardado;

    function enlaceCompleto(url, clases = '') {
      const enlace = document.createElement('a');
      enlace.className = clases;
      enlace.href = url;
      enlace.textContent = 'Abrir página completa';
      return enlace;
    }

    async function abrirDetalle(url) {
      carga?.abort();
      const solicitud = new AbortController();
      carga = solicitud;
      const demora = setTimeout(() => solicitud.abort(), 12000);
      const estado = document.createElement('p');
      estado.className = 'drawer-status drawer-loading';
      estado.setAttribute('role', 'status');
      estado.textContent = 'Cargando detalle…';
      titulo.textContent = 'Detalle de agenda';
      contenido.replaceChildren(estado);
      contenido.scrollTop = 0;
      cerrar.focus();
      try {
        const respuesta = await fetch(url, { signal: solicitud.signal });
        if (!respuesta.ok) throw new Error();
        const pagina = new DOMParser().parseFromString(await respuesta.text(), 'text/html');
        const detalle = pagina.querySelector('[data-agenda-detalle]');
        if (!detalle) throw new Error();
        if (solicitud !== carga) return;
        titulo.textContent = detalle.dataset.agendaDetalle;
        contenido.replaceChildren(detalle, enlaceCompleto(url, 'agenda-page-link'));
      } catch {
        if (solicitud !== carga) return;
        estado.classList.remove('drawer-loading');
        estado.setAttribute('role', 'alert');
        estado.textContent = 'No se pudo cargar el detalle.';
        const reintentar = document.createElement('button');
        reintentar.type = 'button';
        reintentar.className = 'btn sec';
        reintentar.textContent = 'Reintentar';
        reintentar.addEventListener('click', () => abrirDetalle(url));
        const acciones = document.createElement('div');
        acciones.className = 'actions';
        acciones.append(reintentar, enlaceCompleto(url, 'btn sec'));
        contenido.replaceChildren(estado, acciones);
      } finally {
        clearTimeout(demora);
      }
    }

    cerrar.addEventListener('click', () => drawer.close());
    drawer.addEventListener('click', (evento) => {
      if (evento.target !== drawer) return;
      const { left, right, top, bottom } = drawer.getBoundingClientRect();
      if (evento.clientX < left || evento.clientX > right || evento.clientY < top || evento.clientY > bottom) drawer.close();
    });
    drawer.addEventListener('close', () => {
      carga?.abort();
      carga = null;
      clearTimeout(demoraGuardado);
      guardando.textContent = '';
      contenido.replaceChildren();
      origen?.focus();
    });
    drawer.addEventListener('submit', () => {
      clearTimeout(demoraGuardado);
      demoraGuardado = setTimeout(() => { guardando.textContent = 'Procesando solicitud…'; }, 150);
    });
    window.addEventListener('pageshow', () => {
      clearTimeout(demoraGuardado);
      guardando.textContent = '';
    });
    document.addEventListener('click', (evento) => {
      const enlace = evento.target.closest('a[data-drawer]');
      if (!enlace || evento.defaultPrevented || evento.button !== 0 || evento.metaKey ||
        evento.ctrlKey || evento.shiftKey || evento.altKey || (enlace.target && enlace.target !== '_self')) return;
      const url = new URL(enlace.href);
      if (url.origin !== location.origin) return;
      if (!url.searchParams.has('volverAgenda')) url.searchParams.set('volverAgenda', contexto);
      evento.preventDefault();
      if (!drawer.open) {
        origen = enlace;
        drawer.showModal();
      }
      abrirDetalle(url);
    });
  }

  document.addEventListener('click', (evento) => {
    const categoria = evento.target.closest('[data-category]');
    if (categoria) {
      const grafico = categoria.closest('[data-chart]');
      grafico.querySelectorAll('[data-category]').forEach(x => { x.style.opacity = x === categoria ? '1' : '.35'; });
      grafico.querySelector('.chart-detail').textContent = categoria.dataset.category;
    }
    const png = evento.target.closest('[data-png]');
    if (!png) return;
    const grafico = png.closest('[data-chart]');
    const svg = grafico.querySelector('svg').cloneNode(true);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const imagen = new Image();
    imagen.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 900;
      const pincel = canvas.getContext('2d');
      pincel.fillStyle = '#fff';
      pincel.fillRect(0, 0, 1400, 900);
      pincel.fillStyle = '#153e4e';
      pincel.font = 'bold 28px system-ui';
      pincel.fillText(grafico.querySelector('h3').textContent, 45, 48);
      pincel.font = '16px system-ui';
      pincel.fillText(grafico.dataset.context || '', 45, 80);
      pincel.drawImage(imagen, 40, 110, 1320, 690);
      const enlace = document.createElement('a');
      enlace.download = grafico.dataset.chart + '.png';
      enlace.href = canvas.toDataURL('image/png');
      enlace.click();
      URL.revokeObjectURL(url);
    };
    imagen.onerror = () => URL.revokeObjectURL(url);
    imagen.src = url;
  });
})();</script>`;

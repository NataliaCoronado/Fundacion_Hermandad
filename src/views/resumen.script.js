"use strict";

module.exports = `<script>
(() => {
  const raiz = document.querySelector(".res-workspace");
  if (!raiz) return;

  const seccion = raiz.querySelector("#res-indicadores");
  const estado = seccion.querySelector("[data-res-estado]");
  const selectorContenido = "[data-res-indicadores-contenido]";
  let controlador;

  async function cargarIndicadores(destino, control) {
    controlador?.abort();
    const actual = new AbortController();
    controlador = actual;
    const plazo = setTimeout(() => actual.abort(), 15000);
    const contenido = seccion.querySelector(selectorContenido);
    const boton = contenido.querySelector("button[type=submit]");
    const url = new URL(destino);
    url.hash = "";
    url.searchParams.set("fragmento", "indicadores");
    const anuncio = (texto, error = false) => {
      estado.textContent = texto;
      estado.toggleAttribute("data-error", error);
    };

    contenido.setAttribute("aria-busy", "true");
    boton.disabled = true;
    anuncio("Cargando indicadores…");
    try {
      const respuesta = await fetch(url, { signal: actual.signal });
      if (!respuesta.ok || respuesta.redirected) throw new Error("No se cargaron los indicadores.");
      const documento = new DOMParser().parseFromString(await respuesta.text(), "text/html");
      if (actual.signal.aborted) return;
      const nuevo = documento.querySelector(selectorContenido);
      if (!nuevo) throw new Error("La respuesta no contiene indicadores.");
      const moverFoco = contenido.contains(document.activeElement) || document.activeElement === document.body;
      contenido.replaceWith(nuevo);
      if (moverFoco) nuevo.querySelector(control)?.focus({ preventScroll: true });
      const pagina = new URL(location.href);
      pagina.search = destino.search;
      history.replaceState(history.state, "", pagina);
      for (const enlace of raiz.querySelectorAll("[data-res-alerta-url]")) {
        const href = new URL(enlace.href);
        for (const campo of ["sede", "desde", "hasta"]) {
          const valor = pagina.searchParams.get(campo);
          if (valor) href.searchParams.set(campo, valor);
          else href.searchParams.delete(campo);
        }
        enlace.href = href.href;
      }
      anuncio("Indicadores actualizados.");
    } catch (error) {
      if (controlador === actual) {
        anuncio("No se pudieron actualizar los indicadores. Revisa la conexión y vuelve a intentarlo.", true);
      }
    } finally {
      clearTimeout(plazo);
      if (controlador === actual) {
        contenido.removeAttribute("aria-busy");
        boton.disabled = false;
      }
    }
  }

  seccion.addEventListener("submit", (evento) => {
    const formulario = evento.target;
    if (!formulario.matches("[data-res-filtros]") || !window.fetch) return;
    evento.preventDefault();
    const destino = new URL(formulario.action);
    destino.search = new URLSearchParams(new FormData(formulario));
    cargarIndicadores(destino, "button[type=submit]");
  });

  const seleccionarPunto = (punto) => {
    const grafico = punto.closest("figure");
    grafico.querySelector("[aria-pressed=true]")?.setAttribute("aria-pressed", "false");
    punto.setAttribute("aria-pressed", "true");
    grafico.querySelector("[data-graf-lectura]").textContent = punto.dataset.grafDetalle;
  };

  seccion.addEventListener("click", (evento) => {
    const limpiar = evento.target.closest("[data-res-limpiar]");
    if (limpiar && window.fetch && evento.button === 0 && !evento.shiftKey && !evento.metaKey && !evento.ctrlKey && !evento.altKey) {
      evento.preventDefault();
      cargarIndicadores(new URL(limpiar.href), "[data-res-limpiar]");
      return;
    }
    const punto = evento.target.closest("[data-graf-detalle]");
    if (punto) seleccionarPunto(punto);
  });

  seccion.addEventListener("keydown", (evento) => {
    const punto = evento.target.closest("[data-graf-detalle]");
    if (punto && ["Enter", " "].includes(evento.key)) {
      evento.preventDefault();
      seleccionarPunto(punto);
    }
  });

  const tabla = raiz.querySelector("[data-res-tabla]");
  if (!tabla) return;
  const cuerpo = tabla.querySelector("tbody");
  const filas = Array.from(cuerpo.rows);
  const botones = Array.from(tabla.querySelectorAll("[data-res-orden]"));
  const centro = tabla.querySelector("[data-res-centro]");
  const actividad = tabla.querySelector("[data-res-actividad]");
  const contador = tabla.querySelector("[data-res-centros]");
  const vacio = tabla.querySelector("[data-res-sedes-vacio]");
  const colacion = new Intl.Collator("es-CL", { sensitivity: "base" });

  const filtrar = () => {
    const columna = botones.findIndex((b) => b.dataset.resOrden === actividad.value);
    let cantidad = 0;
    for (const fila of filas) {
      const visible = (!centro.value || fila.dataset.centro === centro.value)
        && (columna < 0 || Number(fila.cells[columna].dataset.valor) > 0);
      fila.hidden = !visible;
      cantidad += Number(visible);
    }
    vacio.hidden = cantidad > 0;
    contador.textContent = cantidad + (cantidad === 1 ? " policlínico" : " policlínicos");
  };

  for (const [indice, boton] of botones.entries()) {
    const cabecera = boton.closest("th");
    cabecera.querySelector("[data-res-columna]").hidden = true;
    boton.hidden = false;
    boton.addEventListener("click", () => {
      const direccion = cabecera.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      tabla.querySelector("[aria-sort]")?.removeAttribute("aria-sort");
      cabecera.setAttribute("aria-sort", direccion);
      const multiplicador = direccion === "ascending" ? 1 : -1;
      filas.sort((a, b) => {
        const x = a.cells[indice].dataset.valor;
        const y = b.cells[indice].dataset.valor;
        if (!x || !y) return Number(!x) - Number(!y);
        return multiplicador * (indice === 0 ? colacion.compare(x, y) : Number(x) - Number(y));
      });
      cuerpo.append(...filas);
    });
  }

  tabla.querySelector("[data-res-tabla-filtros]").hidden = false;
  centro.addEventListener("change", filtrar);
  actividad.addEventListener("change", filtrar);
  filtrar();
})();
</script>`;

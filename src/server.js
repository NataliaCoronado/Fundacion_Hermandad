"use strict";
const { cargarEnv, datosDemoActivos, cookieSegura } = require("./herramientas/entorno");
cargarEnv();
process.env.TZ ||= "America/Santiago";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { crearContenedor } = require("./armarAplicacion");
const { crearRutas } = require("./rutas");
const { leerCookie, DURACION_MS } = require("./auth/Sesiones");
const { permitido, rutaInicio } = require("./auth/permisos");
const { correr } = require("./herramientas/contextoSolicitud");
const { esValidacion } = require("./herramientas/erroresDeValidacion");
const { pagina } = require("./views/layout");
const { prohibido } = require("./views/autenticacion");
const { conPeticion } = require("./views/contextoPortal");

// Las vistas usan estilos y scripts en línea y las tipografías de Google Fonts.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const TIPOS = { ".jpg": "image/jpeg", ".png": "image/png", ".js": "text/javascript; charset=utf-8" };
function archivoEstatico(pathname) {
  if (pathname === "/vendor/echarts.min.js") {
    const ruta = path.join(__dirname, "..", "node_modules", "echarts", "dist", "echarts.min.js");
    return fs.existsSync(ruta) ? { ruta, tipo: TIPOS[".js"] } : null;
  }
  const coincidencia = /^\/img\/([a-z0-9_-]+\.(?:jpg|png))$/.exec(pathname);
  if (!coincidencia) return null;
  const ruta = coincidencia[1].startsWith("profesional-") ? path.join(__dirname,"../datos/fotos",coincidencia[1]) : path.join(__dirname, "..", "public", "img", coincidencia[1]);
  return fs.existsSync(ruta) ? { ruta, tipo: TIPOS[path.extname(ruta)] } : null;
}

const { parsearMultipart } = require("./herramientas/formulario-multipart");
const MAX_FORM = 1e6;
const MAX_ADJUNTO =
  3 * require("./services/DocumentoServicio").MAX_BYTES + 1024 * 1024;
const leerCuerpo = (req) =>
  new Promise((resolver) => {
    const tipo = req.headers["content-type"] || "";
    const multi = /^multipart\/form-data/i.test(tipo);
    const limite = multi ? MAX_ADJUNTO : MAX_FORM;
    const partes = [];
    let total = 0;
    let excedido = false;
    req.on("data", (c) => {
      total += c.length;
      if (total > limite) {
        excedido = true;
        partes.length = 0;
      } else if (!excedido) partes.push(c);
    });
    req.on("end", () => {
      if (excedido) return resolver({ __excedido: true });
      const buf = Buffer.concat(partes);
      resolver(
        multi
          ? parsearMultipart(buf, tipo)
          : Object.fromEntries(new URLSearchParams(buf.toString("utf8"))),
      );
    });
    req.on("error", () => resolver({ __excedido: true }));
  });

// Un archivo que desaparece o no se puede leer no debe tumbar el proceso.
function enviarArchivoSeguro(lectura, res) {
  lectura.on("error", (e) => {
    console.error("No se pudo leer el archivo:", e.code || e.message);
    res.destroy();
  });
  res.on("close", () => lectura.destroy());
  return lectura.pipe(res);
}

function ipCliente(req) {
  if (process.env.TRUST_PROXY === "1") {
    const lista = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (lista.length) return lista[lista.length - 1];
  }
  return req.socket.remoteAddress;
}

const hostDeOrigen = (origen) => {
  try {
    return new URL(origen).host;
  } catch {
    return null;
  }
};

const RUTAS_PERSONAL_PUBLICAS = new Set(["/login", "/logout", "/restablecer"]);
function crearServidor(aplicacion, modo = "todo") {
  const esPersonal = (r) =>
    r.area !== null || RUTAS_PERSONAL_PUBLICAS.has(r.ruta);
  const rutas = crearRutas(aplicacion).filter(
    (r) =>
      modo === "todo" ||
      (modo === "personal" ? esPersonal(r) && r.ruta !== "/" : !esPersonal(r)),
  );
  aplicacion.colaMutacion ||= Promise.resolve();
  if (!aplicacion.limpieza) {
    aplicacion.limpieza = setInterval(() => {
      aplicacion.sesiones?.limpiar?.();
      aplicacion.sesionesPaciente?.limpiar?.();
      aplicacion.auth?.limpiar?.();
    }, 10 * 60_000);
    aplicacion.limpieza.unref();
  }
  const segura = cookieSegura();
  const secure = segura ? "; Secure" : "";
  const seguridad = {
    "Content-Security-Policy": CSP,
    ...(segura ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
  return http.createServer((req, res) => {
    const tokenPaciente = leerCookie(req.headers.cookie, "psid");
    const paciente = tokenPaciente && aplicacion.sesionesPaciente ? aplicacion.sesionesPaciente.obtener(tokenPaciente) : null;
    return conPeticion({ paciente }, () =>
      atender(req, res, paciente, tokenPaciente).catch((e) => {
        console.error(e);
        if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Ocurrió un error inesperado.");
      }),
    );
  });
  async function webhookWhatsApp(req, res, url) {
    const w = aplicacion.webhook;
    const responder = (estado, texto) => {
      res.writeHead(estado, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(texto);
    };
    if (!w?.activo) return responder(404, "No encontrado.");
    if (req.method === "GET") {
      const respuesta = w.verificarSuscripcion(url.searchParams);
      return responder(respuesta.estado, respuesta.cuerpo);
    }
    if (req.method !== "POST") return responder(405, "Método no permitido.");
    const trozos = [];
    let total = 0;
    for await (const t of req) {
      total += t.length;
      if (total > 1024 * 1024) return responder(413, "Aviso demasiado grande.");
      trozos.push(t);
    }
    const cruda = Buffer.concat(trozos);
    if (!w.firmaValida(cruda, req.headers["x-hub-signature-256"])) return responder(401, "Firma inválida.");
    let cuerpo;
    try {
      cuerpo = JSON.parse(cruda.toString("utf8"));
    } catch {
      return responder(400, "JSON inválido.");
    }
    const anterior = aplicacion.colaMutacion;
    let liberar;
    aplicacion.colaMutacion = new Promise((r) => (liberar = r));
    await anterior;
    try {
      await w.procesar(cuerpo);
      aplicacion.guardar?.();
      return responder(200, "EVENT_RECEIVED");
    } catch (e) {
      console.error("Webhook de WhatsApp:", e);
      return responder(500, "Error al procesar el aviso.");
    } finally {
      liberar();
    }
  }
  async function atender(req, res, paciente, tokenPaciente) {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/webhook/whatsapp") return webhookWhatsApp(req, res, url);
    const cabeceras = {
      ...seguridad,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    };
    const enviar = (estado, html, extra = {}) => {
      res.writeHead(estado, {
        "Content-Type": "text/html; charset=utf-8",
        ...cabeceras,
        ...extra,
      });
      res.end(html);
    };
    const token = leerCookie(req.headers.cookie, "sid");
    const usuario = token ? aplicacion.sesiones.obtener(token) : null;
    const solicitud = { usuario, ruta: url.pathname, metodo: req.method, registrado: false };
    const rechazar = (accion, detalle) => {
      if (solicitud.registrado) return;
      solicitud.registrado = true;
      aplicacion.auditoria.rechazo(usuario, accion, detalle, { registro: url.pathname, idPoliclinico: usuario?.idPoliclinico || null });
      aplicacion.guardar?.();
    };
    solicitud.registrarRechazo = (e) => {
      if (esValidacion(e.message)) return;
      const nombre = {
        CREDENCIALES_INVALIDAS: "Inicio de sesión rechazado",
        DEMASIADOS_INTENTOS: "Límite de intentos superado",
        FUERA_DE_SEDE: "Acceso rechazado",
      }[e.message];
      rechazar(nombre || "Operación rechazada", `${String(e.message).slice(0, 200)} · ip ${ipCliente(req)}`);
    };
    const est = req.method === "GET" && archivoEstatico(url.pathname);
    if (est) {
      const fotoPrivada = url.pathname.startsWith('/img/profesional-');
      if(fotoPrivada) {
        const equipo=(await aplicacion.catalogo.profesionales()).filter(p=>p.foto===url.pathname);
        if(!usuario || (usuario.rol!=='ADMINISTRACION' && !equipo.some(p=>aplicacion.operacion.lugares(p).includes(Number(usuario.idPoliclinico))))) return enviar(403,prohibido(usuario));
      }
      res.writeHead(200, {
        "Content-Type": est.tipo,
        "Cache-Control": fotoPrivada ? "private, max-age=3600" : "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      return enviarArchivoSeguro(fs.createReadStream(est.ruta), res);
    }
    if (modo === "personal" && req.method === "GET" && url.pathname === "/") {
      const destino = usuario ? rutaInicio(usuario.rol) : "/login";
      res.writeHead(302, { Location: destino, ...cabeceras });
      return res.end();
    }
    const ruta = rutas.find(
      (x) => x.metodo === req.method && x.ruta === url.pathname,
    );
    if (!ruta)
      return enviar(
        404,
        pagina({
          titulo: "No encontrado",
          usuario,
          contenido: "<p>La página no existe.</p>",
        }),
      );
    if (req.method === "POST" && req.headers.origin && hostDeOrigen(req.headers.origin) !== req.headers.host) {
      rechazar("Solicitud rechazada", `${req.method} ${url.pathname} · origen no permitido`);
      return enviar(
        403,
        pagina({
          titulo: "Solicitud rechazada",
          usuario,
          contenido: "<p>Origen no permitido.</p>",
        }),
      );
    }
    if (ruta.area && !usuario) {
      res.writeHead(302, {
        Location: `/login?volver=${encodeURIComponent(url.pathname)}`,
        ...cabeceras,
      });
      return res.end();
    }
    if (ruta.area && !permitido(usuario.rol, ruta.area)) {
      rechazar("Acceso rechazado", `${req.method} ${url.pathname} · rol ${usuario.rol}`);
      return enviar(403, prohibido(usuario));
    }
    const cuerpo = req.method === "POST" ? await leerCuerpo(req) : {};
    let liberar;
    if (req.method === "POST" && !cuerpo.__excedido) {
      const anterior = aplicacion.colaMutacion;
      aplicacion.colaMutacion = new Promise((r) => {
        liberar = r;
      });
      await anterior;
    }
    try {
      if (cuerpo.__excedido)
        return enviar(
          413,
          pagina({
            titulo: "Archivo demasiado grande",
            usuario,
            contenido:
              "<p>Lo que enviaste supera el tamaño permitido (archivos: máximo 5 MB). Vuelve atrás e inténtalo con un archivo más liviano.</p>",
          }),
        );
      if (ruta.area === "tens")
        await require("./controllers/validarAccesoPorSede").validarAccesoPorSede(
          aplicacion,
          usuario,
          url.pathname,
          url.searchParams,
          cuerpo,
        );
      const respuesta = await correr(solicitud, () =>
        ruta.manejador({
          consulta: url.searchParams,
          cuerpo,
          ip: ipCliente(req),
          usuario,
          token,
          paciente,
          tokenPaciente,
        }),
      );
      if (respuesta.estado === 401) rechazar("Inicio de sesión rechazado", `${req.method} ${url.pathname} · ip ${ipCliente(req)}`);
      else if (respuesta.estado === 429) rechazar("Límite de intentos superado", `${req.method} ${url.pathname} · ip ${ipCliente(req)}`);
      else if (respuesta.estado === 403) rechazar("Acceso rechazado", `${req.method} ${url.pathname}`);
      else if (respuesta.estado === 400 && respuesta.rechazo) solicitud.registrarRechazo({ message: respuesta.rechazo });
      aplicacion.guardar?.();
      if (respuesta.binario) {
        res.writeHead(200, {
          ...cabeceras,
          "Content-Type": respuesta.mime,
          "Content-Disposition": `${respuesta.enLinea ? "inline" : "attachment"}; filename="${respuesta.nombreArchivo}"`,
        });
        return res.end(respuesta.binario);
      }
      if (respuesta.redirigir) {
        const extra = { Location: respuesta.redirigir };
        const galleta = (nombre, valor) =>
          `${nombre}=${valor}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${valor ? Math.floor(DURACION_MS / 1000) : 0}${secure}`;
        const galletas = [];
        if (respuesta.cookie !== undefined) galletas.push(galleta("sid", respuesta.cookie));
        if (respuesta.cookiePaciente !== undefined) galletas.push(galleta("psid", respuesta.cookiePaciente));
        if (galletas.length) extra["Set-Cookie"] = galletas;
        res.writeHead(302, { ...extra, ...cabeceras });
        return res.end();
      }
      if (respuesta.archivo) {
        const nombre = respuesta.archivo.nombre.replace(/[^\w.\- ]/g, "_");
        res.writeHead(200, {
          "Content-Type": respuesta.archivo.mime,
          "Content-Disposition": `${respuesta.archivo.inline ? "inline" : "attachment"}; filename="${nombre}"`,
          "Cache-Control": "private, no-store",
          ...cabeceras,
        });
        return enviarArchivoSeguro(fs.createReadStream(respuesta.archivo.ruta), res);
      }
      if (respuesta.csv !== undefined) {
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${respuesta.nombreArchivo}"`,
          ...cabeceras,
        });
        return res.end(respuesta.csv);
      }
      enviar(respuesta.estado || 200, respuesta.html);
    } catch (e) {
      if (
        [
          "FUERA_DE_SEDE",
          "DOCUMENTO_NO_ENCONTRADO",
          "PACIENTE_NO_ENCONTRADO",
          "CITA_NO_ENCONTRADA",
          "ESPERA_NO_ENCONTRADA",
        ].includes(e.message)
      ) {
        rechazar("Acceso rechazado", `${e.message} · ${req.method} ${url.pathname}`);
        return enviar(403, prohibido(usuario));
      }
      console.error(e);
      enviar(
        500,
        pagina({
          titulo: "Error",
          usuario,
          contenido: "<p>Ocurrió un error inesperado.</p>",
        }),
      );
    } finally {
      liberar?.();
    }
  }
}

async function arrancar() {
  const url = process.env.DATABASE_URL;
  const db = url ? require("./db/conexion-postgres").crearDb(url) : null;
  const persistencia =
    new (require("./repositories/GuardadoEnArchivoJson").GuardadoEnArchivoJson)(
      process.env.ARCHIVO_DATOS ||
        path.join(__dirname, "../datos", db ? "extras.json" : "estado.json"),
    );
  const aplicacion = crearContenedor({
    db,
    persistencia,
    demo: datosDemoActivos(),
  });
  await aplicacion.inicializar();
  aplicacion.guardar();
  require("./tareasProgramadas").iniciarAutomaticos(aplicacion);
  const argumentoPuerto = process.argv.findIndex((x) => x === "--port");
  const puertoCli =
    argumentoPuerto >= 0 && /^\d+$/.test(process.argv[argumentoPuerto + 1] || "")
      ? Number(process.argv[argumentoPuerto + 1])
      : null;
  const puerto = Number(process.env.PORT || puertoCli || 3000);
  const puertoPersonal = Number(
    process.env.PORT_PERSONAL ?? (puertoCli ? 0 : 3001),
  );
  if (!puertoPersonal) {
    crearServidor(aplicacion).listen(puerto, () =>
      console.log(
        `Hermandad citas (todo en uno) en http://localhost:${puerto} (almacenamiento: ${aplicacion.modo})`,
      ),
    );
    return;
  }
  crearServidor(aplicacion, "paciente").listen(puerto, () =>
    console.log(`Portal de pacientes:  http://localhost:${puerto}`),
  );
  crearServidor(aplicacion, "personal").listen(puertoPersonal, () =>
    console.log(
      `Sitio del personal:    http://localhost:${puertoPersonal}  (almacenamiento: ${aplicacion.modo})`,
    ),
  );
}

if (require.main === module)
  arrancar().catch((e) => {
    console.error(e);
    process.exit(1);
  });
module.exports = { crearServidor };

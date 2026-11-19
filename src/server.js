"use strict";
require("./util/entorno").cargarEnv();
process.env.TZ ||= "America/Santiago";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { crearContenedor } = require("./contenedor");
const { crearRutas } = require("./rutas");
const { leerCookie, DURACION_MS } = require("./auth/Sesiones");
const { permitido, rutaInicio } = require("./auth/permisos");
const { pagina } = require("./views/layout");
const { prohibido } = require("./views/auth");
const { conPeticion } = require("./views/contextoPortal");

const TIPOS = { ".jpg": "image/jpeg", ".png": "image/png" };
function archivoEstatico(pathname) {
  const m = /^\/img\/([a-z0-9_-]+\.(?:jpg|png))$/.exec(pathname);
  if (!m) return null;
  const ruta = m[1].startsWith("profesional-") ? path.join(__dirname,"../datos/fotos",m[1]) : path.join(__dirname, "..", "public", "img", m[1]);
  return fs.existsSync(ruta) ? { ruta, tipo: TIPOS[path.extname(ruta)] } : null;
}

const { parsearMultipart } = require("./util/multipart");
const MAX_FORM = 1e6;
const MAX_ADJUNTO =
  3 * require("./services/DocumentoService").MAX_BYTES + 1024 * 1024;
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
function crearServidor(c, modo = "todo") {
  const esPersonal = (r) =>
    r.area !== null || RUTAS_PERSONAL_PUBLICAS.has(r.ruta);
  const rutas = crearRutas(c).filter(
    (r) =>
      modo === "todo" ||
      (modo === "personal" ? esPersonal(r) && r.ruta !== "/" : !esPersonal(r)),
  );
  c.colaMutacion ||= Promise.resolve();
  if (!c.limpieza) {
    c.limpieza = setInterval(() => {
      c.sesiones?.limpiar?.();
      c.sesionesPaciente?.limpiar?.();
    }, 10 * 60_000);
    c.limpieza.unref();
  }
  const secure = process.env.COOKIE_SECURE === "1" ? "; Secure" : "";
  return http.createServer((req, res) => {
    const tokenPaciente = leerCookie(req.headers.cookie, "psid");
    const paciente = tokenPaciente && c.sesionesPaciente ? c.sesionesPaciente.obtener(tokenPaciente) : null;
    return conPeticion({ paciente }, () =>
      atender(req, res, paciente, tokenPaciente).catch((e) => {
        console.error(e);
        if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Ocurrió un error inesperado.");
      }),
    );
  });
  async function webhookWhatsApp(req, res, url) {
    const w = c.webhook;
    const responder = (estado, texto) => {
      res.writeHead(estado, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end(texto);
    };
    if (!w?.activo) return responder(404, "No encontrado.");
    if (req.method === "GET") {
      const r = w.verificarSuscripcion(url.searchParams);
      return responder(r.estado, r.cuerpo);
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
    const anterior = c.colaMutacion;
    let liberar;
    c.colaMutacion = new Promise((r) => (liberar = r));
    await anterior;
    try {
      await w.procesar(cuerpo);
      c.guardar?.();
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
    const usuario = token ? c.sesiones.obtener(token) : null;
    const est = req.method === "GET" && archivoEstatico(url.pathname);
    if (est) {
      if(url.pathname.startsWith('/img/profesional-')) {
        const equipo=(await c.catalogo.profesionales()).filter(p=>p.foto===url.pathname);
        if(!usuario || (usuario.rol!=='ADMINISTRACION' && !equipo.some(p=>c.operacion.lugares(p).includes(Number(usuario.idPoliclinico))))) return enviar(403,prohibido(usuario));
      }
      res.writeHead(200, {
        "Content-Type": est.tipo,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      return fs.createReadStream(est.ruta).pipe(res);
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
    if (req.method === "POST" && req.headers.origin && hostDeOrigen(req.headers.origin) !== req.headers.host)
      return enviar(
        403,
        pagina({
          titulo: "Solicitud rechazada",
          usuario,
          contenido: "<p>Origen no permitido.</p>",
        }),
      );
    if (ruta.area && !usuario) {
      res.writeHead(302, {
        Location: `/login?volver=${encodeURIComponent(url.pathname)}`,
        ...cabeceras,
      });
      return res.end();
    }
    if (ruta.area && !permitido(usuario.rol, ruta.area))
      return enviar(403, prohibido(usuario));
    const cuerpo = req.method === "POST" ? await leerCuerpo(req) : {};
    let liberar;
    if (req.method === "POST" && !cuerpo.__excedido) {
      const anterior = c.colaMutacion;
      c.colaMutacion = new Promise((r) => {
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
        await require("./controllers/alcance").validar(
          c,
          usuario,
          url.pathname,
          url.searchParams,
          cuerpo,
        );
      const r = await ruta.manejador({
        consulta: url.searchParams,
        cuerpo,
        ip: ipCliente(req),
        usuario,
        token,
        paciente,
        tokenPaciente,
      });
      c.guardar?.();
      if (r.binario) {
        res.writeHead(200, {
          ...cabeceras,
          "Content-Type": r.mime,
          "Content-Disposition": `${r.enLinea ? "inline" : "attachment"}; filename="${r.nombreArchivo}"`,
        });
        return res.end(r.binario);
      }
      if (r.redirigir) {
        const extra = { Location: r.redirigir };
        const galleta = (nombre, valor) =>
          `${nombre}=${valor}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${valor ? Math.floor(DURACION_MS / 1000) : 0}${secure}`;
        const galletas = [];
        if (r.cookie !== undefined) galletas.push(galleta("sid", r.cookie));
        if (r.cookiePaciente !== undefined) galletas.push(galleta("psid", r.cookiePaciente));
        if (galletas.length) extra["Set-Cookie"] = galletas;
        res.writeHead(302, { ...extra, ...cabeceras });
        return res.end();
      }
      if (r.archivo) {
        const nombre = r.archivo.nombre.replace(/[^\w.\- ]/g, "_");
        res.writeHead(200, {
          "Content-Type": r.archivo.mime,
          "Content-Disposition": `${r.archivo.inline ? "inline" : "attachment"}; filename="${nombre}"`,
          "Cache-Control": "private, no-store",
          ...cabeceras,
        });
        return fs.createReadStream(r.archivo.ruta).pipe(res);
      }
      if (r.csv !== undefined) {
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${r.nombreArchivo}"`,
          ...cabeceras,
        });
        return res.end(r.csv);
      }
      enviar(r.estado || 200, r.html);
    } catch (e) {
      if (
        [
          "FUERA_DE_SEDE",
          "DOCUMENTO_NO_ENCONTRADO",
          "PACIENTE_NO_ENCONTRADO",
          "CITA_NO_ENCONTRADA",
          "ESPERA_NO_ENCONTRADA",
        ].includes(e.message)
      )
        return enviar(403, prohibido(usuario));
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
  const db = url ? require("./db/pool").crearDb(url) : null;
  const persistencia =
    new (require("./repositories/Persistencia").Persistencia)(
      process.env.ARCHIVO_DATOS ||
        path.join(__dirname, "../datos", db ? "extras.json" : "estado.json"),
    );
  const c = crearContenedor({
    db,
    persistencia,
    demo: process.env.DATOS_DEMO !== "0",
  });
  await c.inicializar();
  c.guardar();
  require("./automaticos").iniciarAutomaticos(c);
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
    crearServidor(c).listen(puerto, () =>
      console.log(
        `Hermandad citas (todo en uno) en http://localhost:${puerto} (almacenamiento: ${c.modo})`,
      ),
    );
    return;
  }
  crearServidor(c, "paciente").listen(puerto, () =>
    console.log(`Portal de pacientes:  http://localhost:${puerto}`),
  );
  crearServidor(c, "personal").listen(puertoPersonal, () =>
    console.log(
      `Sitio del personal:    http://localhost:${puertoPersonal}  (almacenamiento: ${c.modo})`,
    ),
  );
}

if (require.main === module)
  arrancar().catch((e) => {
    console.error(e);
    process.exit(1);
  });
module.exports = { crearServidor };

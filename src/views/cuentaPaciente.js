"use strict";
// Cuenta opcional del paciente: ingreso, registro, recuperación y secciones Mis horas, Mis datos, Mis documentos y Familiares.
const { pagina, WHATSAPP } = require("./layout");
const { esc } = require("./util");
const { fechaLarga, fila } = require("./paciente");
const { ESTILOS } = require("./reserva");

const AST = '<span class="req" aria-hidden="true">*</span>';
const CSS = `<style>
.account-page{max-width:480px;margin:0 auto;padding:30px;background:#fff;border:1px solid var(--borde);border-radius:16px;box-shadow:var(--sombra)}
.account-page h1{font-size:27px}.account-page form{padding:0;border:0;background:none;margin:0 0 18px}.account-page .submit{width:100%;margin-top:22px}
.account-links{text-align:center}.forgot{display:block;text-align:right;margin-top:12px}
.password-field{display:flex;border:1.5px solid var(--borde-2);border-radius:var(--r-s);overflow:hidden}.password-field input{border:0;min-width:0}
.password-field button{background:#fff;color:var(--teal-t);border:0;border-left:1px solid var(--borde);padding:0 14px;font-weight:700}
.cuenta-nav{display:flex;gap:4px;flex-wrap:wrap;background:#e8eff1;padding:4px;border-radius:12px;margin:0 0 24px}
.cuenta-nav a,.cuenta-nav button{padding:9px 16px;text-decoration:none;color:var(--muted);font-weight:700;font-size:.9rem;border-radius:9px;border:0;background:none}
.cuenta-nav a.act{background:#fff;color:var(--teal-t);box-shadow:0 1px 3px rgba(11,59,76,.12)}.cuenta-nav form{margin-left:auto}
.hora{background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:18px 20px;margin:0 0 12px;box-shadow:var(--sombra)}
.hora h3{margin:0 0 4px}.hora .acciones{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.familiar{background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:20px;margin:0 0 16px;box-shadow:var(--sombra)}
</style>`;
const clave = (id, label, auto) =>
  `<label for="${id}">${label} ${AST}</label><div class="password-field"><input id="${id}" name="${id}" type="password" autocomplete="${auto}" required minlength="15" maxlength="128"><button type="button" data-password="${id}" aria-controls="${id}" aria-pressed="false">Mostrar</button></div>`;
const verificacion = (d = {}) =>
  `<label for="fechaNacimiento">Fecha de nacimiento ${AST}</label><input id="fechaNacimiento" name="fechaNacimiento" type="date" value="${esc(d.fechaNacimiento || "")}" required>
<label for="celular4">Últimos 4 dígitos del celular registrado ${AST}</label><input id="celular4" name="celular4" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required>`;
const scriptClave = `<script>document.querySelectorAll('[data-password]').forEach(function(b){b.addEventListener('click',function(){var i=document.getElementById(b.dataset.password),v=i.type==='password';i.type=v?'text':'password';b.textContent=v?'Ocultar':'Mostrar';b.setAttribute('aria-pressed',String(v))})});
var f=document.querySelector('.account-page form'),cc=f&&f.querySelector('[name=confirmarClave]');if(cc){cc.addEventListener('input',function(){cc.setCustomValidity('')});f.addEventListener('submit',function(e){cc.setCustomValidity(f.querySelector('[name=clave]').value===cc.value?'':'Las contraseñas no coinciden.');if(!f.reportValidity())e.preventDefault()})}</script>`;

function acceso({ modo = "ingresar", mensaje, d = {} } = {}) {
  const titulo = { ingresar: "Iniciar sesión", crear: "Crear mi cuenta", recuperar: "Recuperar contraseña" }[modo];
  const sub = {
    ingresar: "Ingresa con tu RUT y contraseña para ver tus horas, tus datos, tus documentos y tus familiares.",
    crear: "Para crearla verificamos tu identidad con los datos de tu registro en el policlínico.",
    recuperar: "Verifica tu identidad con los datos de tu registro y elige una nueva contraseña.",
  }[modo];
  const campos =
    modo === "ingresar"
      ? clave("clave", "Contraseña", "current-password") + '<a class="forgot" href="/paciente/cuenta/recuperar">¿Olvidaste tu contraseña?</a>'
      : verificacion(d) +
        clave("clave", modo === "crear" ? "Contraseña" : "Nueva contraseña", "new-password") +
        '<small class="nota">Usa al menos 15 caracteres.</small>' +
        clave("confirmarClave", "Confirmar contraseña", "new-password") +
        (modo === "crear" ? `<label class="check"><input name="acepto" type="checkbox" value="1" required> <span>Acepto la <a href="/privacidad">política de privacidad</a>. ${AST}</span></label>` : "");
  return pagina({
    titulo, portal: true, activo: "cuenta", encabezado: false, mensaje,
    volver: modo === "ingresar" ? null : { href: "/paciente/cuenta", texto: "Volver a iniciar sesión" },
    portada: { titulo, lead: sub },
    contenido: `${ESTILOS}${CSS}<section class="account-page">
<form method="post" action="/paciente/cuenta/acceso"><input type="hidden" name="modo" value="${modo}">
<label for="rut" style="margin-top:0">RUT ${AST}</label><input id="rut" name="rut" value="${esc(d.rut || "")}" autocomplete="username" placeholder="12345678-9" maxlength="14" required>
${campos}<button class="btn submit" type="submit">${modo === "ingresar" ? "Iniciar sesión" : modo === "crear" ? "Crear cuenta" : "Guardar nueva contraseña"}</button></form>
<div class="account-links">${modo === "ingresar" ? '¿No tienes cuenta? <a href="/paciente/cuenta/crear">Crear mi cuenta</a>' : '<a href="/paciente/cuenta">Volver a iniciar sesión</a>'}
<p style="margin-top:10px">Tener cuenta es opcional: <a href="/">reserva sin cuenta</a>.</p>${modo !== "ingresar" ? `<p class="nota">Si cambiaste de celular o no tienes uno registrado, escríbenos al WhatsApp ${WHATSAPP} o acércate a tu policlínico.</p>` : ""}</div></section>${scriptClave}`,
  });
}

const SECCIONES = [
  ["horas", "/paciente/mis-horas", "Mis horas"],
  ["datos", "/paciente/mis-datos", "Mis datos"],
  ["documentos", "/paciente/mis-documentos", "Mis documentos"],
  ["familiares", "/paciente/familiares", "Familiares"],
];
const panel = ({ cuenta, seccion, titulo, contenido, mensaje }) =>
  pagina({
    titulo, portal: true, activo: "cuenta", encabezado: false, mensaje,
    portada: { titulo: `Hola, ${esc(cuenta.nombre.split(" ")[0])}`, lead: `RUT ${esc(cuenta.rut)}` },
    contenido: `${ESTILOS}${CSS}
<nav class="cuenta-nav" aria-label="Mi cuenta">${SECCIONES.map(([k, h, t]) => `<a href="${h}" class="${k === seccion ? "act" : ""}"${k === seccion ? ' aria-current="page"' : ""}>${t}</a>`).join("")}<form method="post" action="/paciente/salir"><button type="submit">Cerrar sesión</button></form></nav>${contenido}`,
  });

const tarjetaHora = (h, conComprobante = true) => `<article class="hora"><h3>${esc(h.especialidad)} · ${esc(h.profesional)}</h3>
<p>${esc(fechaLarga(h.fecha).replace(/^./, (x) => x.toUpperCase()))} · ${esc(h.hora)} · ${esc(h.lugar)}</p><p class="nota">${esc(h.estado)}</p>
${conComprobante && h.activa ? `<div class="acciones"><a class="btn sec chico" href="/paciente/comprobante.pdf?idCita=${h.id}">Descargar comprobante (PDF)</a></div>` : ""}</article>`;

const misHoras = ({ cuenta, proximas, historial, mensaje }) =>
  panel({
    cuenta, seccion: "horas", titulo: "Mis horas", mensaje,
    contenido: `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><h2>Próximas horas</h2><a class="btn" href="/">Reservar una hora</a></div>
${proximas.length ? proximas.map((h) => tarjetaHora(h)).join("") : '<div class="vacio">No tienes horas próximas.</div>'}
<div class="aviso">Para cancelar o cambiar una hora, escribe al WhatsApp de tu policlínico o comunícate con él; el personal registrará el cambio. Una reserva no se cancela por falta de respuesta.</div>
<h2 style="margin-top:28px">Historial</h2>${historial.length ? historial.map((h) => tarjetaHora(h, false)).join("") : '<div class="vacio">Aún no hay atenciones anteriores.</div>'}`,
  });

const opciones = (lista, valor) => lista.map((o) => `<option value="${esc(o.id)}"${String(o.id) === String(valor ?? "") ? " selected" : ""}>${esc(o.nombre)}</option>`).join("");
const campo = (n, t, v, { tipo = "text", req = false, extra = "", full = false } = {}) =>
  `<div${full ? ' class="full"' : ""}><label for="${n}">${t}${req ? ` ${AST}` : ""}</label><input id="${n}" name="${n}" type="${tipo}" value="${esc(v ?? "")}"${req ? " required" : ""} ${extra}></div>`;
const GENEROS = [["FEMENINO", "Femenino"], ["MASCULINO", "Masculino"], ["OTRO", "Otro"], ["NO_INFORMA", "Prefiere no informar"]].map(([id, nombre]) => ({ id, nombre }));

const misDatos = ({ cuenta, ficha, v = {}, comunas, mensaje }) => {
  const x = { ...ficha, ...v };
  const menor = require("../services/PacienteService").edad(ficha.fechaNacimiento) < 18;
  return panel({
    cuenta, seccion: "datos", titulo: "Mis datos", mensaje,
    contenido: `<form method="post" action="/paciente/mis-datos" class="tarjeta" style="max-width:820px"><h2>Datos del paciente</h2><p class="nota">Los campos con ${AST} son obligatorios. Estos datos se usan en tus próximas reservas.</p>
<div class="form2"><div class="bloqueado full form2" style="padding:0">${campo("rutVista", "RUT", ficha.rut, { req: true, extra: "readonly" })}${campo("fnVista", "Fecha de nacimiento", ficha.fechaNacimiento, { tipo: "date", req: true, extra: "readonly" })}${campo("nombreVista", "Nombre completo", ficha.nombre, { req: true, full: true, extra: "readonly" })}</div>
${campo("telefono", "Celular", x.telefono, { tipo: "tel", req: true })}${campo("correo", "Correo electrónico (opcional)", x.correo, { tipo: "email" })}
<div class="full"><label class="check"><input type="checkbox" name="tieneWhatsapp" value="1"${x.tieneWhatsapp ? " checked" : ""}> El celular tiene WhatsApp</label></div>
${campo("direccion", "Dirección", x.direccion, { req: true, full: true })}
<div><label for="idComuna">Comuna ${AST}</label><select id="idComuna" name="idComuna" required>${opciones(comunas, x.idComuna)}</select></div>
<div><label for="genero">Género ${AST}</label><select id="genero" name="genero" required>${opciones(GENEROS, x.genero)}</select></div>
${campo("nacionalidad", "Nacionalidad", x.nacionalidad, { req: true })}
<fieldset class="full" style="border:1px solid var(--borde);border-radius:12px;padding:6px 16px 14px;margin-top:16px"><legend style="font-weight:700;padding:0 6px">Adulto responsable${menor ? ` ${AST}` : " (opcional)"}</legend><div class="form2">
${campo("respNombre", "Nombre completo", v.respNombre ?? ficha.responsable?.nombre, { req: menor })}${campo("respRelacion", "Relación", v.respRelacion ?? ficha.responsable?.relacion, { req: menor })}
${campo("respRut", "RUT", v.respRut ?? ficha.responsable?.rut, { req: menor })}${campo("respTelefono", "Teléfono", v.respTelefono ?? ficha.responsable?.telefono, { tipo: "tel", req: menor })}</div></fieldset></div>
<button class="btn blq" type="submit">Guardar cambios</button></form>
<form method="post" action="/paciente/mis-datos/correccion" class="tarjeta" style="max-width:820px;margin-top:18px"><h2>Corregir RUT, nombre o fecha de nacimiento</h2>
<p class="nota">Estos datos están bloqueados. Describe la corrección y TENS/TONS de tu policlínico la revisará.</p>
<label for="detalle">Corrección solicitada ${AST}</label><textarea id="detalle" name="detalle" maxlength="300" rows="3" required></textarea>
<button class="btn sec" type="submit">Enviar solicitud</button></form>`,
  });
};

const misDocumentos = ({ cuenta, personas, docs, tipos, pendientes, mensaje }) =>
  panel({
    cuenta, seccion: "documentos", titulo: "Mis documentos", mensaje,
    contenido: `<div class="tarjeta" style="max-width:820px"><h2>Documentos guardados</h2>
<p class="nota">Quedan en el registro del paciente, se reutilizan en próximas reservas y solo los ve el personal autorizado.</p>
${pendientes.length ? `<div class="aviso"><b>Requisitos pendientes de revisión:</b> ${pendientes.map(esc).join(", ")}.</div>` : ""}
${docs.length ? docs.map((d) => `<div class="fila"><span>${esc(d.persona)}</span><b>${esc(d.tipo)} · ${esc(d.fecha.slice(0, 10))} · ${d.verificado ? "revisado" : "pendiente de revisión"}${d.adjunto ? ` · <a href="/paciente/mis-documentos/archivo?id=${d.id}">Descargar</a>` : ""}</b></div>`).join("") : '<div class="vacio">Aún no hay documentos.</div>'}</div>
<form method="post" action="/paciente/mis-documentos" enctype="multipart/form-data" class="tarjeta" style="max-width:820px;margin-top:18px"><h2>Adjuntar un documento</h2>
<p class="nota">Certificados FONASA y CESFAM, órdenes de derivación y otros respaldos en PDF, JPG o PNG (máximo 5 MB).</p>
<div class="form2"><div><label for="rutDoc">Paciente ${AST}</label><select id="rutDoc" name="rut" required>${opciones(personas, cuenta.rut)}</select></div>
<div><label for="tipo">Tipo de documento ${AST}</label><select id="tipo" name="tipo" required><option value="">Elige el tipo</option>${opciones(tipos.map((t) => ({ id: t, nombre: t })), "")}</select></div>
<div class="full"><label for="reemplazar">¿Reemplaza a un documento anterior?</label><select id="reemplazar" name="reemplazar"><option value="">No, es un documento nuevo</option>${opciones(docs.map((d) => ({ id: d.id, nombre: `${d.persona} · ${d.tipo} · ${d.fecha.slice(0, 10)}` })), "")}</select></div>
<div class="full"><label for="archivo">Archivo ${AST}</label><input id="archivo" name="archivo" type="file" accept="application/pdf,image/jpeg,image/png" required></div></div>
<button class="btn" type="submit">Adjuntar documento</button></form>`,
  });

const familiares = ({ cuenta, lista, mensaje }) =>
  panel({
    cuenta, seccion: "familiares", titulo: "Familiares", mensaje,
    contenido: `<p class="lead">Aquí aparecen las personas cuyo registro te indica como adulto responsable. Conocer el RUT de otra persona no da acceso a su información.</p>
${lista.length ? lista.map((f) => `<section class="familiar"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h2 style="margin:0">${esc(f.nombre)}</h2><p class="nota">RUT ${esc(f.rut)} · ${esc(f.relacion || "Familiar")}</p></div><a class="btn sec" href="/?quien=${encodeURIComponent(f.rut)}">Reservar para ${esc(f.nombre.split(" ")[0])}</a></div>
<p class="sec-t">PRÓXIMAS HORAS</p>${f.proximas.length ? f.proximas.map((h) => tarjetaHora(h)).join("") : '<p class="nota">Sin horas próximas.</p>'}
<p class="sec-t">DOCUMENTOS</p>${f.docs.length ? f.docs.map((d) => fila(d.tipo, `${d.fecha.slice(0, 10)} · ${d.verificado ? "revisado" : "pendiente de revisión"}`)).join("") : '<p class="nota">Sin documentos.</p>'}</section>`).join("") : '<div class="vacio">No tienes familiares vinculados.</div>'}
<form method="post" action="/paciente/familiares/solicitar" class="tarjeta" style="max-width:820px;margin-top:18px"><h2>Solicitar vinculación de un familiar</h2>
<p class="nota">El personal del policlínico revisará la solicitud y la autorización correspondiente antes de vincularlo.</p>
<div class="form2">${campo("rutFamiliar", "RUT del familiar", "", { req: true })}${campo("relacion", "Relación", "", { req: true, extra: 'placeholder="Hijo/a, madre, padre…"' })}
<div class="full"><label for="detalleF">Comentario (opcional)</label><textarea id="detalleF" name="detalle" maxlength="200" rows="2"></textarea></div></div>
<button class="btn sec" type="submit">Enviar solicitud</button></form>`,
  });

// Compatibilidad: algunas rutas antiguas llamaban a cuentaPaciente({ crear, recuperar }).
const cuentaPaciente = ({ crear = false, recuperar = false } = {}) => acceso({ modo: recuperar ? "recuperar" : crear ? "crear" : "ingresar" });
module.exports = { acceso, misHoras, misDatos, misDocumentos, familiares, cuentaPaciente };

"use strict";
// Dashboard de inicio para Administración y TENS/TONS: lo más importante del día
// y las alertas críticas que requieren acción.
const { pagina } = require("./layout");
const { esc } = require("./util");
const { ico } = require("./iconos");

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (f) => {
  const [, m, d] = String(f || "").split("-");
  return d ? `${Number(d)} ${MES[Number(m) - 1]}` : "";
};
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

const kpi = ({ href, clase = "", icono, valor, texto, nota = "" }) =>
  `<a class="kpi ${clase}" href="${esc(href)}"><span class="ico-c">${ico(icono)}</span><span><b>${valor}</b><span>${esc(texto)}</span>${nota ? `<small>${esc(nota)}</small>` : ""}</span></a>`;

// Una alerta: nivel "crit" (rojo) o "aviso" (ámbar). Las que tienen n = 0 se muestran como "al día".
const alerta = ({ nivel, titulo, detalle, n, href }) =>
  n
    ? `<li class="al ${nivel}"><a href="${esc(href)}"><span class="al-n">${n}</span><span><b>${esc(titulo)}</b><small>${esc(detalle)}</small></span>${ico("chevDer")}</a></li>`
    : `<li class="al ok"><span class="al-n">${ico("check")}</span><span><b>${esc(titulo)}</b><small>Al día</small></span></li>`;

const listaCitas = (filas, vacio) =>
  filas.length
    ? `<ul class="proximas">${filas
        .map(
          (f) =>
            `<li><span class="hora"><small>${esc(fechaCorta(f.fecha))}</small><b>${esc(f.hora)}</b></span><span class="q"><a href="${esc(f.href)}"><b>${esc(f.paciente)}</b></a><small>${esc(f.detalle)}</small></span>${f.badge}</li>`,
        )
        .join("")}</ul>`
    : `<p class="vacio">${esc(vacio)}</p>`;

const ESTILOS = `<style>
.res-cab{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.res-cab h2{font-size:1.5rem;margin:0 0 4px}.res-cab p{margin:0;color:var(--muted)}
.kpi small{display:block;font-size:.72rem;color:var(--suave);margin-top:4px}.kpi.dest small{color:#d5f0f2}
.kpi.rojo .ico-c{background:var(--err-bg);color:var(--err)}
.res-g{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:20px;align-items:start}
.res-col{display:grid;gap:20px;min-width:0}
.alertas{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.al a,.al.ok{display:grid;grid-template-columns:44px 1fr 18px;gap:12px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid var(--borde);text-decoration:none;color:var(--navy)}
.al.ok{grid-template-columns:44px 1fr;opacity:.75;padding:6px 12px}.al.ok .al-n{height:28px}
.al a:hover{border-color:var(--borde-2);background:#fafcfc}
.al a>svg{width:16px;height:16px;color:var(--suave)}
.al-n{display:grid;place-items:center;width:44px;height:36px;border-radius:10px;font-weight:800;font-size:1.05rem}
.al-n svg{width:18px;height:18px}
.al.crit a{border-color:#f3c9c4;background:#fff8f7}.al.crit .al-n{background:var(--err-bg);color:var(--err)}
.al.aviso .al-n{background:var(--pend-bg);color:var(--pend)}
.al.ok .al-n{background:var(--ok-bg);color:var(--ok)}
.al b{display:block;font-size:.9rem}.al small{color:var(--muted);font-size:.78rem}
.proximas .q a{text-decoration:none;color:inherit}.proximas .q a:hover b{color:var(--teal-t)}
.sedes-t th{white-space:normal;line-height:1.25}.sedes-t td{white-space:nowrap}.sedes-t td:first-child{white-space:normal}.sedes-t td.num,.sedes-t th.num{text-align:right;font-variant-numeric:tabular-nums}
.ocup{display:flex;align-items:center;gap:8px;justify-content:flex-end}.ocup i{display:block;width:44px;height:6px;border-radius:3px;background:#e7eef0;overflow:hidden}
.ocup i b{display:block;height:100%;background:var(--teal)}
@media(max-width:1100px){.res-g{grid-template-columns:1fr}}
</style>`;

function resumen({ usuario, admin, sede, kpis, alertas, citasHoy, porSede, hora }) {
  const nombre = String(usuario.nombre || "").split(" ")[0];
  const criticas = alertas.filter((a) => a.n && a.nivel === "crit").length;
  const tablaSedes = porSede
    ? `<section class="panel"><div class="panel-t"><h2>Situación por policlínico</h2><a href="/admin/reportes">Ver reportes →</a></div>
<div class="tabla-w"><table class="sedes-t"><thead><tr><th>Lugar</th><th class="num">Citas hoy</th><th class="num">Por confirmar</th><th class="num">En espera</th><th class="num">Ocupación (7 días)</th></tr></thead><tbody>${porSede
        .map(
          (s) =>
            `<tr><td>${esc(s.nombre)}</td><td class="num">${s.hoy}</td><td class="num">${s.porConfirmar}</td><td class="num">${s.espera}</td><td class="num"><span class="ocup">${s.ocupacion == null ? "—" : `${s.ocupacion}%<i><b style="width:${s.ocupacion}%"></b></i>`}</span></td></tr>`,
        )
        .join("")}</tbody></table></div></section>`
    : "";
  const contenido = `${ESTILOS}<div class="workspace">
<div class="res-cab"><div><p class="eyebrow">HERMANDAD DE DOLORES / ${admin ? "RED INSTITUCIONAL" : esc(String(sede?.nombre || "").toUpperCase())}</p><h2>Hola, ${esc(nombre)}</h2>
<p>${criticas ? `Hay <b>${criticas} ${criticas === 1 ? "alerta crítica" : "alertas críticas"}</b> que requieren atención.` : "No hay alertas críticas pendientes."} Actualizado a las ${esc(hora)}.</p></div>
<div class="actions">${admin ? `<a class="btn" href="/admin/bloque/nuevo">${ico("mas")}Publicar cupos</a><a class="btn sec" href="/admin/agendas">${ico("calendario")}Ver agendas</a>` : `<a class="btn" href="/tens/agenda?vista=lista">${ico("calendario")}Agenda de hoy</a><a class="btn sec" href="/tens/espera">${ico("lista")}Lista de espera</a>`}</div></div>
<div class="kpis">${kpis.map(kpi).join("")}</div>
<div class="res-g"><div class="res-col">
<section class="panel"><div class="panel-t"><h2>Alertas críticas y pendientes</h2></div><ul class="alertas">${alertas.map(alerta).join("")}</ul></section>
${tablaSedes}</div>
<div class="res-col"><section class="panel"><div class="panel-t"><h2>${admin ? "Citas de hoy en la red" : "Citas de hoy"}</h2><a href="${admin ? "/admin/agendas?vista=lista" : "/tens/agenda?vista=lista"}">Ver agenda →</a></div>${listaCitas(citasHoy, "No hay citas agendadas para hoy.")}</section></div></div></div>`;
  return pagina({ titulo: "Resumen", usuario, lienzo: true, contenido });
}

module.exports = { resumen, pct };

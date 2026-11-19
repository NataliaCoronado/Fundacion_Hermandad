"use strict";

module.exports = `
.res-workspace{display:grid;gap:18px;color:var(--navy)}
.res-workspace [hidden]{display:none!important}
.res-cab,.res-titulo{display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap}
.res-cab h2{margin:0;font-size:1.5rem;line-height:1.2;font-weight:700}
.res-cab p{margin:4px 0 0;color:var(--muted);font-size:.875rem}
.res-cab .actions svg,.res-kpi svg,.res-al-dia svg{width:18px;height:18px;flex:none}
.res-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.res-kpi{min-width:0;padding:16px 18px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;background:#fff;border:1px solid var(--borde);border-radius:var(--r);box-shadow:0 1px 2px rgba(24,59,78,.04);color:var(--navy);text-decoration:none}
.res-kpi:hover{background:#f6fafb;color:var(--navy)}
.res-kpi:focus-visible{outline-offset:-3px}
.res-kpi:hover .res-kpi-etiqueta{text-decoration:underline;text-underline-offset:3px}
.res-kpi-etiqueta{display:flex;gap:8px;align-items:center;font-size:.875rem;font-weight:600}
.res-kpi strong{font-size:2.1rem;line-height:1.06;font-weight:700;font-variant-numeric:tabular-nums}
.res-kpi small{color:var(--muted);font-size:.8125rem;line-height:1.28}
.res-kpi-aviso svg{color:var(--pend)}
.res-kpi-crit svg{color:var(--err)}
.res-operacion{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:16px}
.res-alertas-col{display:grid;gap:12px;min-width:0}
.res-panel{min-width:0;background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:16px}
.res-titulo{margin-bottom:9px}
.res-titulo h3{margin:0;font-size:1.0625rem;font-weight:700;line-height:1.3}
.res-titulo a,.res-cita-datos a,.res-tabla a{font-size:.875rem;font-weight:650;color:var(--teal-t);text-decoration:none}
.res-titulo a:hover,.res-cita-datos a:hover,.res-tabla a:hover{text-decoration:underline;text-underline-offset:3px}
.res-contador{color:var(--muted);font-size:.8125rem}
.res-alertas,.res-controles,.res-citas{list-style:none;margin:0;padding:0}
.res-alertas li,.res-citas li{border-bottom:1px solid var(--borde)}
.res-alertas li:last-child,.res-citas li:last-child{border-bottom:0}
.res-alerta{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 0;text-decoration:none;color:var(--navy);line-height:1.25}
.res-alerta:hover,.res-alerta[aria-current]{background:#f6fafb;color:var(--navy)}
.res-alerta:hover b{text-decoration:underline;text-underline-offset:3px}
.res-alerta b{display:block;font-size:.875rem;font-weight:650}
.res-alerta small,.res-cita-datos small{display:block;margin-top:3px;color:var(--muted);font-size:.8125rem;line-height:1.3}
.res-alerta-cantidad{display:grid;place-items:center;font-weight:700;border-radius:6px;min-height:27px;padding:2px 3px;font-size:.875rem;line-height:1.1}
.res-alerta-nivel{font-weight:650;font-size:.8125rem}
.res-alerta[data-prioridad=crit] .res-alerta-cantidad{background:var(--err-bg);color:var(--err)}
.res-alerta[data-prioridad=crit] .res-alerta-nivel{color:var(--err)}
.res-alerta[data-prioridad=aviso] .res-alerta-cantidad{background:var(--pend-bg);color:var(--pend)}
.res-alerta[data-prioridad=aviso] .res-alerta-nivel{color:var(--pend)}
.res-alerta-seleccionada,.res-analitica,#res-alertas-titulo{scroll-margin-top:5rem}
.res-detalle-acciones{margin-top:12px}
.res-detalles{margin-top:9px;padding-top:8px;border-top:1px solid var(--borde)}
.res-detalles summary,.res-grafico .vista-tabla summary{color:var(--teal-t);font-size:.875rem;cursor:pointer;font-weight:600}
.res-controles{display:grid;gap:5px;padding:8px 0 0 17px;list-style:disc;font-size:.8125rem;color:var(--muted)}
.res-citas li{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:6px 10px;padding:8px 0}
.res-citas time{font-size:.875rem;font-weight:700;font-variant-numeric:tabular-nums}
.res-citas time small{display:block;font-size:.75rem;color:var(--muted);font-weight:400}
.res-citas .status{font-size:.75rem}
.res-cita-datos{min-width:0;overflow-wrap:anywhere}
.res-cita-datos a{color:var(--navy)}
.res-vacio{margin:0;padding:8px 0;color:var(--muted);font-size:.875rem}
.res-al-dia{display:flex;align-items:center;gap:8px}
.res-al-dia svg{color:var(--ok)}
.res-filtros,.res-tabla-filtros{display:flex;align-items:flex-end;flex-wrap:wrap;gap:8px 12px;margin:0}
.res-filtros{margin-bottom:14px}
.res-filtros label,.res-tabla-filtros label{display:grid;gap:4px;flex:0 1 auto;min-width:0;margin:0;font-size:.875rem}
.res-filtros select,.res-tabla-filtros select{max-width:100%;min-width:min(205px,100%)}
.res-filtros input,.res-filtros select,.res-tabla-filtros select{margin:0;width:100%}
.res-estado{margin:0;color:var(--muted);font-size:.875rem}
.res-estado[data-error]{color:var(--err)}
.res-graficos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid var(--borde)}
.res-grafico{min-width:0;padding:12px 14px 10px}
.res-grafico:nth-child(odd){padding-inline-start:0;border-inline-end:1px solid var(--borde)}
.res-grafico:nth-child(even){padding-inline-end:0}
.res-grafico:nth-child(n+3){padding-bottom:0;border-top:1px solid var(--borde)}
.res-valor{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px}
.res-delta{font-size:.8125rem;font-weight:650;display:inline-flex;gap:5px;align-items:center}
.res-delta.bueno{color:var(--ok)}.res-delta.malo{color:#966325}.res-delta.neutro{color:var(--muted);font-weight:500}
.res-grafico.res-calor,.res-grafico.res-calor:nth-child(n){grid-column:1/-1;padding-inline:0;border-inline-end:0;border-top:1px solid var(--borde)}
.res-metricas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
.res-metrica{min-width:0;padding:12px 14px;background:#f8fbfc;border:1px solid var(--borde);border-radius:var(--r)}
.res-metrica h4{margin:0 0 2px;font-size:.9375rem;font-weight:650;line-height:1.3}
.res-metrica strong{font-size:1.5rem;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}
.res-metrica .res-grafico-contexto{margin:4px 0 0}
.ec{width:100%;min-width:0}
.res-grafico h4{margin:0 0 2px;font-size:.9375rem;font-weight:650;line-height:1.3}
.res-grafico strong{font-size:1.55rem;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}
.res-grafico-contexto,.res-lectura{margin:2px 0 6px;color:var(--muted);font-size:.8125rem;line-height:1.25}
.res-lectura{min-height:1.25em}
.res-grafico .leyenda-g{margin:0 0 5px;gap:5px 14px;color:var(--muted);font-size:.8125rem}
.res-grafico .vista-tabla{margin:0;border:0;padding:0}
.res-grafico .graf .eje{font-size:12px}
.res-grafico .col[aria-pressed=true] .guia,.res-grafico .col:focus-visible .guia{opacity:.55;stroke:var(--teal-t)}
.res-grafico .col:focus-visible{outline:none}
.res-grafico .col:focus-visible .hit{stroke:var(--teal-t);stroke-width:1.5}
.res-grafico .hit{cursor:pointer}
.res-vacio-grafico{display:grid;place-items:center;min-height:92px;background:#f6f8f9;border-radius:6px;margin-top:10px;text-align:center}
.res-tabla-filtros [role=status]{margin:0 0 7px auto;color:var(--muted);font-size:.8125rem}
.res-tabla .tabla-w{border:0;border-radius:0;margin:10px 0 0}
.res-tabla table{width:100%;min-width:660px;border-collapse:collapse}
.res-tabla th,.res-tabla td{font-size:.875rem;padding:9px 10px;white-space:nowrap}
.res-tabla th{letter-spacing:normal;text-transform:none}
.res-tabla th[scope=row]{background:transparent;font-weight:650;text-align:left}
.res-tabla .res-num{text-align:right;font-variant-numeric:tabular-nums}
.res-tabla .tabla-w th button[data-res-orden]{display:inline-flex;align-items:center;gap:6px;min-height:32px;height:auto;padding:3px 0;border:0;background:transparent;box-shadow:none;color:inherit;font:inherit;font-weight:650;cursor:pointer}
.res-tabla th button[data-res-orden]:hover{color:var(--teal-t)}
.res-orden-icono{display:inline-grid;gap:2px;color:var(--muted)}
.res-orden-icono::before,.res-orden-icono::after{content:"";width:5px;height:5px;border-top:1.5px solid;border-left:1.5px solid;transform:rotate(45deg)}
.res-orden-icono::after{transform:rotate(225deg)}
.res-tabla [aria-sort=ascending] .res-orden-icono::after,.res-tabla [aria-sort=descending] .res-orden-icono::before{opacity:0}
.res-ocupacion{display:inline-flex;align-items:center;justify-content:end;gap:8px}
.res-ocupacion>span{height:5px;width:45px;background:var(--borde);overflow:hidden;border-radius:3px}
.res-ocupacion i{display:block;height:100%;background:var(--navy)}
@media(max-width:1000px){
  .res-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:820px){.res-operacion,.res-graficos{grid-template-columns:1fr}
  .res-grafico:nth-child(n){padding:12px 0;border-inline-end:0}
  .res-grafico:nth-child(n+2){border-top:1px solid var(--borde)}
}
@media(max-width:540px){
  .res-metricas{grid-template-columns:1fr}
  .res-workspace{gap:12px}
  .res-panel{padding:12px}
  .res-kpi{padding:11px}
  .res-kpi strong{font-size:1.55rem}
  .res-kpi-etiqueta{gap:5px}
  .res-kpi svg{width:15px;height:15px}
  .res-alerta{grid-template-columns:27px minmax(0,1fr);column-gap:8px;row-gap:1px}
  .res-alerta-nivel{grid-column:2}
  .res-filtros label:has(select),.res-tabla-filtros label{flex-basis:100%}
  .res-filtros label:has(input){flex:1 1 100px}
  .res-tabla-filtros [role=status]{margin:0}
  .res-citas li{grid-template-columns:40px minmax(0,1fr)}
  .res-citas li>.status{justify-self:start;grid-column:2}
  .res-grafico .graf .eje{font-size:16px}
}
`;

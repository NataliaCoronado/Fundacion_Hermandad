"use strict";
module.exports = `
.pers .agenda-page, .pers .agenda-detalle { min-width: 0; }
.agenda-heading, .agenda-detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.agenda-heading p, .agenda-detail-heading p { margin: 0; color: var(--muted); }
.agenda-heading p { display: flex; align-items: center; gap: 8px; min-width: 0; }
.agenda-heading p svg { width: 24px; height: 24px; flex: none; }
.agenda-actions, .agenda-prof-filter details { position: relative; }
.agenda-actions summary, .multi-filter summary { cursor: pointer; list-style: none; }
.agenda-actions summary::-webkit-details-marker, .multi-filter summary::-webkit-details-marker { display: none; }
.agenda-actions summary::after, .multi-filter summary::after {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: -3px 2px 0 5px;
  border: solid currentColor;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
  flex: none;
}
.agenda-actions > div, .multi-filter > div {
  position: absolute;
  top: calc(100% + 4px);
  z-index: 12;
  width: max-content;
  max-width: min(300px, 86vw);
  padding: 5px;
  border: 1px solid var(--borde-2);
  border-radius: var(--control-radio);
  background: #fff;
  box-shadow: 0 10px 30px rgb(24 59 78 / 14%);
}
.agenda-actions > div { right: 0; }
.agenda-actions > div a {
  display: block;
  padding: 8px 12px;
  border-radius: 5px;
  color: var(--navy);
  font-size: .875rem;
  text-decoration: none;
}
.agenda-actions > div a:is(:hover, :focus-visible) { background: #eef3f5; }
.agenda-filtros > summary { display: none; }
.pers .agenda-filter-form {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)) max-content;
  align-items: end;
  gap: 10px;
  margin: 0;
  padding: 0 0 13px;
  border: 0;
  border-bottom: 1px solid var(--borde);
  border-radius: 0;
  background: none;
}
.pers .agenda-filter-form:not(:has([name=sede])) { grid-template-columns: repeat(4, minmax(0, 1fr)) max-content; }
.pers .agenda-filter-form > label, .agenda-prof-filter {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: var(--navy);
  font-size: .875rem;
  font-weight: 600;
}
.pers .agenda-filter-form :is(input[type=search], select), .multi-filter summary {
  height: var(--control);
  min-width: 0;
  min-height: var(--control);
  width: 100%;
  margin: 0;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.multi-filter summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--borde-2);
  border-radius: var(--control-radio);
  background: #fff;
}
.multi-filter summary span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.multi-filter > div { left: 0; min-width: min(246px, 82vw); max-height: min(320px, 45vh); overflow: auto; padding: 9px; }
.multi-filter .check {
  display: flex;
  align-items: center;
  padding: 6px;
  gap: 8px;
  font-weight: 400;
  line-height: 1.25;
}
.multi-filter .check input { flex: none; margin: 0; }
.agenda-filter-actions, .agenda-date-control, .agenda-view-control { display: flex; align-items: center; gap: 6px; }
.agenda-paging { display: flex; align-items: center; gap: 6px; }
.agenda-paging .btn { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; height: var(--control); min-height: var(--control); margin: 0; padding: 0 14px; line-height: 1; white-space: nowrap; }
.agenda-paging .agenda-nav-icon { width: var(--control); padding: 0; }
.agenda-filter-actions { justify-self: end; }
.agenda-filter-actions .btn { white-space: nowrap; }
.agenda-page .calendar-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px 15px;
  flex-wrap: wrap;
  padding: 12px 0 10px;
}
.agenda-date-control { flex-wrap: wrap; }
.agenda-date-control strong { margin-left: 4px; color: var(--navy); font-size: 1rem; font-weight: 700; }
.agenda-date-control strong::first-letter { text-transform: uppercase; }
.pers .agenda-page .agenda-nav-icon { width: var(--control); padding: 0; flex: none; }
.agenda-page .agenda-date-form { display: flex; gap: 6px; margin: 0; padding: 0; border: 0; background: none; }
.agenda-page .agenda-date-form input { height: var(--control); width: auto; min-width: 0; margin: 0; }
.agenda-views {
  display: flex;
  align-items: stretch;
  min-height: var(--control);
  padding: 3px;
  background: #f0f4f5;
  border-radius: var(--control-radio);
}
.agenda-view {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 4px 9px;
  border-radius: 5px;
  color: var(--muted);
  text-decoration: none;
  font-size: .875rem;
  font-weight: 600;
  white-space: nowrap;
}
.agenda-view:hover { background: #e5edef; color: var(--navy); }
.agenda-view[aria-current="page"] { background: #dceced; color: #1d5962; }
.agenda-page .calendar-legend {
  display: flex;
  justify-content: flex-start;
  gap: 5px 13px;
  align-items: center;
  flex-wrap: wrap;
  margin: 0;
  padding: 0 0 11px;
  list-style: none;
}
.agenda-status, .schedule-block { --status-bg: #f1f4f5; --status-fg: #435662; --status-line: #81949c; }
[data-estado="disponible"] { --status-bg: #edf7f1; --status-fg: #205f42; --status-line: #438861; }
[data-estado="reservada"] { --status-bg: #f1eefa; --status-fg: #564382; --status-line: #8770b2; }
[data-estado="pendiente"] { --status-bg: #fff4dc; --status-fg: #704a10; --status-line: #bf8b37; }
[data-estado="confirmada"] { --status-bg: #eaf2fc; --status-fg: #244f77; --status-line: #5387bc; }
[data-estado="atendida"] { --status-bg: #e5f1ef; --status-fg: #175553; --status-line: #347b76; }
[data-estado="cancelada"] { --status-bg: #f9ebec; --status-fg: #873841; --status-line: #b96069; }
[data-estado="bloqueado"] { --status-bg: #e9edf2; --status-fg: #414f62; --status-line: #596d86; }
[data-estado="inasistencia"] { --status-bg: #faeee6; --status-fg: #8a431f; --status-line: #ad6136; }
[data-estado="en-atencion"] { --status-bg: #f5edf6; --status-fg: #67436e; --status-line: #9a6ba3; }
.agenda-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 7px;
  border-radius: 5px;
  color: var(--status-fg);
  background: var(--status-bg);
  font-size: .8125rem;
  font-weight: 600;
  line-height: 1.28;
}
.agenda-status::before {
  content: "";
  width: 7px;
  height: 7px;
  flex: none;
  border-radius: 50%;
  background: var(--status-line);
}
.calendar-scroll {
  position: relative;
  max-height: min(650px, 68vh);
  overflow: auto;
  border: 1px solid var(--borde);
  border-radius: var(--control-radio);
  scrollbar-color: #9eafb5 #f3f6f7;
  scroll-padding: 76px 8px 8px 65px;
}
.calendar-scroll:focus-visible { outline-offset: 2px; }
.calendar-grid {
  display: grid;
  grid-template-columns: 62px var(--agenda-tracks);
  grid-auto-rows: var(--calendar-hour);
  grid-template-rows: auto;
  width: max-content;
  min-width: 100%;
  isolation: isolate;
}
.calendar-corner, .professional-head {
  position: sticky;
  top: 0;
  z-index: 4;
  padding: 9px 12px;
  border-bottom: 1px solid var(--borde-2);
  border-right: 1px solid var(--borde);
  background: #f5f8f9;
}
.calendar-corner { left: 0; z-index: 5; align-content: center; text-align: center; font-size: .75rem; color: var(--muted); }
.professional-head { display: flex; gap: 8px; min-height: 72px; align-items: flex-start; }
.professional-head > div { min-width: 0; }
.professional-head b, .professional-head a {
  display: block;
  color: var(--navy);
  font-size: .9375rem;
  line-height: 1.2;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.professional-head small { display: block; font-size: .8125rem; color: var(--muted); line-height: 1.25; overflow-wrap: anywhere; }
.professional-head .professional-photo { width: 32px; height: 32px; }
.calendar-grid-week .professional-head { min-height: 0; }
.calendar-grid-week .professional-head a { text-transform: capitalize; }
.calendar-hour {
  position: sticky;
  left: 0;
  z-index: 3;
  padding: 5px 3px;
  border-right: 1px solid var(--borde-2);
  border-bottom: 1px solid var(--borde);
  background: #fafcfc;
  color: #4f6270;
  font-size: .8125rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.calendar-cell {
  position: relative;
  border-right: 1px solid var(--borde);
  border-bottom: 1px solid var(--borde);
  background: linear-gradient(to bottom, transparent calc(50% - 1px), #edf2f4 50%, transparent calc(50% + 1px));
}
.schedule-block {
  display: block;
  padding: 4px 7px;
  border-left: 3px solid var(--status-line);
  border-radius: 5px;
  background: var(--status-bg);
  color: var(--navy);
  text-decoration: none;
  overflow-wrap: anywhere;
  line-height: 1.14;
}
.calendar-grid .schedule-block {
  position: absolute;
  top: var(--slot-offset);
  left: calc(var(--lane-start) + 3px);
  right: calc(var(--lane-end) + 3px);
  height: var(--slot-height);
  z-index: 1;
  overflow: auto;
  scrollbar-width: thin;
}
.schedule-block:hover { color: var(--navy); box-shadow: inset 0 0 0 1px var(--status-line); }
.schedule-block:focus-visible { outline-offset: -2px; z-index: 2; }
.schedule-time {
  display: flex;
  align-items: baseline;
  gap: 6px;
  justify-content: space-between;
  color: var(--status-fg);
  font-weight: 700;
  font-size: .75rem;
}
.schedule-time time { flex: none; color: var(--navy); font-size: .8125rem; font-variant-numeric: tabular-nums; }
.schedule-time span { text-align: right; }
.schedule-block strong { display: block; margin: 2px 0 1px; font-size: .875rem; font-weight: 700; }
.schedule-block small { display: block; color: #405766; font-size: .75rem; }
.schedule-block .color-dot { background: var(--lugar); width: 6px; height: 6px; margin: 0 4px 1px 0; }
.calendar-week-lists {
  display: grid;
  grid-template-columns: repeat(7, minmax(211px, 1fr));
  width: max-content;
  min-width: 100%;
}
.calendar-week-lists > section { min-width: 0; border-right: 1px solid var(--borde); }
.calendar-week-lists > section:last-child { border-right: 0; }
.calendar-week-lists h3 {
  position: sticky;
  top: 0;
  z-index: 2;
  margin: 0;
  padding: 8px 10px;
  border-bottom: 1px solid var(--borde-2);
  background: #f5f8f9;
  font-size: .9375rem;
  text-transform: capitalize;
}
.calendar-week-lists h3 a { color: var(--navy); }
.calendar-week-lists ul { display: grid; gap: 5px; margin: 0; padding: 6px; list-style: none; }
.calendar-day-empty, .agenda-count { font-size: .8125rem; color: var(--muted); }
.calendar-day-empty { padding: 4px 3px; }
.agenda-empty { padding: 24px 12px; border-block: 1px solid var(--borde); color: var(--navy); text-align: center; }
.agenda-empty p { margin: 2px 0 0; color: var(--muted); }
.agenda-count { margin: 8px 0 0; }
.agenda-lista { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--borde); }
.agenda-fila {
  display: grid;
  grid-template-columns: 3.1rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 8px 3px;
  border-bottom: 1px solid var(--borde);
}
.agenda-fila time { color: var(--navy); font-weight: 700; font-variant-numeric: tabular-nums; }
.agenda-info { overflow-wrap: anywhere; }
.agenda-info strong { color: var(--navy); }
.agenda-info p { margin: 2px 0 0; color: var(--muted); font-size: .875rem; }
.agenda-fila .actions { justify-content: flex-end; }
.agenda-detail-status { margin-bottom: 12px; }
.agenda-detail-actions { margin-top: 12px; }
.agenda-detail-actions details { margin-top: 9px; padding: 9px 0 0; border-top: 1px solid var(--borde); }
.agenda-detail-actions details summary { color: var(--navy); cursor: pointer; font-weight: 600; }
.agenda-detalle .work-panel :is(.form-grid, .actions):not(:first-child) { margin-top: 10px !important; }
.agenda-detalle .details-grid { gap: 10px 14px; margin: 0; }
.agenda-detalle .details-grid dd { overflow-wrap: anywhere; }
.agenda-detalle form select { min-width: 0; width: 100%; }
html:has(dialog[data-agenda-drawer][open]) { overflow: hidden; }
.pers dialog.drawer[data-agenda-drawer] {
  position: fixed;
  inset: 0 0 0 auto;
  margin: 0;
  padding: 0;
  width: min(520px, 100vw) !important;
  max-width: 100vw;
  height: 100dvh;
  max-height: 100dvh !important;
  overflow: hidden;
  border: 0;
  border-radius: 0 !important;
  background: #fff;
  color: var(--navy);
  box-shadow: -10px 0 32px rgb(24 59 78 / 16%);
}
dialog.drawer::backdrop { background: rgb(20 41 54 / 38%); }
dialog.drawer[open] { display: flex; flex-direction: column; }
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: none;
  padding: 12px 16px;
  border-bottom: 1px solid var(--borde);
}
.drawer-header h2 { margin: 0; font-size: 1.1875rem; }
.drawer-header .drawer-close { width: auto; color: var(--navy); }
.drawer-saving { margin: 0; padding: 7px 16px; background: #e9f4f5; color: #1d5962; }
.drawer-saving:empty { display: none; }
.drawer-content { min-height: 0; padding: 14px 16px 24px; overflow: auto; }
.drawer-content .agenda-detail-heading .btn { display: none; }
.pers dialog .drawer-content .work-panel { padding: 0 0 14px; margin: 0 0 14px; border: 0; border-bottom: 1px solid var(--borde); border-radius: 0 !important; }
.drawer-content .details-grid, .drawer-content .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.drawer-content .agenda-detail-actions .form-grid button { grid-column: 1 / -1; }
.drawer-content .agenda-page-link { margin-top: 4px; font-size: .875rem; }
.drawer-content .drawer-status { margin: 0 0 12px; }
.drawer-content .drawer-status[role="alert"] { color: #873841; }
.drawer-content .drawer-loading { display: flex; align-items: center; gap: 8px; }
.drawer-content .drawer-loading::before {
  content: "";
  width: 14px;
  height: 14px;
  border: 2px solid var(--borde-2);
  border-top-color: var(--teal);
  border-radius: 50%;
  animation: personal-cargando .7s linear infinite;
}

.agenda-heading .actions { align-items: center; justify-content: flex-end; }
.agenda-acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.agenda-barra { display: grid; gap: 4px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--borde); }
.agenda-barra .calendar-toolbar { padding: 0; }
.agenda-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; }
.agenda-tools-left, .agenda-tools-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
.pers .agenda-tools details, .agenda-tools details { position: relative; margin: 0; padding: 0; border: 0; background: none; }
.agenda-tools details:not([open]) > :not(summary) { display: none; }
.agenda-tools details > summary { list-style: none; cursor: pointer; }
.agenda-tools details > summary::-webkit-details-marker { display: none; }
.pers .agenda-tools details[open] > :is(.agenda-filter-form, .agenda-date-form, .calendar-legend) {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 14;
  padding: 14px;
  border: 1px solid var(--borde-2);
  border-radius: var(--control-radio);
  background: #fff;
  box-shadow: 0 10px 30px rgb(24 59 78 / 14%);
}
.pers .agenda-tools details[open] > .agenda-filter-form { width: min(920px, calc(100vw - 48px)); }
.pers .agenda-tools details[open] > .agenda-date-form { width: max-content; }
.agenda-filter-count {
  display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; background: var(--navy); color: #fff; font-size: .75rem; font-weight: 700;
}
.agenda-count { margin: 0; font-size: .8125rem; color: var(--muted); }
.agenda-desplazamiento { display: flex; gap: 6px; }
.agenda-desplazamiento[hidden] { display: none; }
.agenda-aplicados { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; margin: 0 0 10px; font-size: .875rem; }
.agenda-aplicados ul { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.agenda-aplicados li { padding: 2px 9px; border-radius: 999px; background: #eef3f5; color: var(--navy); }
.agenda-resumen { display: flex; flex-wrap: wrap; gap: 6px; }
.agenda-resumen a {
  display: inline-flex; align-items: baseline; gap: 6px; padding: 5px 12px;
  border: 1px solid var(--status-line, #81949c); border-left-width: 4px; border-radius: 6px;
  background: var(--status-bg, #f1f4f5); color: var(--status-fg, #435662); font-size: .875rem; text-decoration: none; white-space: nowrap;
}
.agenda-resumen a b { font-size: 1.0625rem; font-variant-numeric: tabular-nums; color: var(--navy); }
.agenda-resumen a:hover { box-shadow: 0 1px 0 var(--status-line, #81949c); }
.agenda-resumen a:focus-visible { outline: 3px solid var(--navy); box-shadow: 0 0 0 2px var(--foco); outline-offset: 1px; }
.agenda-resumen a[aria-current="true"] { box-shadow: inset 0 0 0 2px var(--status-line, #81949c); font-weight: 700; }
.agenda-resumen a[data-estado="bloqueado"] { background: repeating-linear-gradient(135deg, #f0f4f5, #f0f4f5 6px, #e3e9ec 6px, #e3e9ec 12px); }
.agenda-resumen a[data-estado="sin-publicar"] { border-style: dashed; border-left-style: solid; background: #fff; }
.matriz-semana { width: 100%; min-width: 760px; border-collapse: collapse; table-layout: fixed; }
.matriz-semana thead th {
  position: sticky; top: 0; z-index: 3; padding: 9px 8px; border-bottom: 1px solid var(--borde-2);
  background: #f5f8f9; color: var(--navy); font-size: .875rem; text-align: left;
}
.matriz-semana :is(thead, tbody) th { text-transform: none; letter-spacing: 0; }
.matriz-semana thead th:first-child { width: 220px; }
.matriz-semana thead th a { color: var(--navy); text-transform: capitalize; text-decoration: none; }
.matriz-semana thead th.hoy { box-shadow: inset 0 -3px 0 var(--teal); }
.matriz-semana tbody th {
  position: sticky; left: 0; z-index: 2; padding: 9px 10px; border-bottom: 1px solid var(--borde); border-right: 1px solid var(--borde-2);
  background: #fafcfc; text-align: left; font-weight: 400; vertical-align: top;
}
.matriz-semana tbody th b { display: block; color: var(--navy); font-size: .9375rem; line-height: 1.2; }
.matriz-semana tbody th small { display: block; color: var(--muted); font-size: .8125rem; line-height: 1.3; }
.matriz-semana .mx-total { margin-top: 3px; color: #1d5962; font-weight: 600; }
.matriz-semana td { padding: 5px; border-bottom: 1px solid var(--borde); border-right: 1px solid var(--borde); vertical-align: middle; }
.matriz-semana .mx-vacio { color: #a7b5bb; text-align: center; background: #fafcfc; }
.mx-celda { display: grid; gap: 6px; padding: 7px 8px; border-radius: 6px; color: var(--navy); text-decoration: none; }
.mx-celda:hover { background: #eef3f5; }
.mx-celda:focus-visible { outline: 3px solid var(--navy); box-shadow: 0 0 0 2px var(--foco); outline-offset: -2px; }
.mx-n { font-size: .8125rem; line-height: 1.2; color: #405766; }
.mx-n b { font-size: 1rem; color: var(--navy); font-variant-numeric: tabular-nums; }
.mx-barra { display: flex; height: 9px; overflow: hidden; border-radius: 5px; background: #e6ecee; }
.mx-barra i { display: block; min-width: 0; }
.mx-barra .r { background: #8770b2; }
.mx-barra .d { background: #438861; }
.mx-barra .b { background: repeating-linear-gradient(135deg, #c3ced2, #c3ced2 3px, #e6ecee 3px, #e6ecee 6px); }
.mx-nota { margin: 8px 0 0; font-size: .8125rem; color: var(--muted); }

.calendar-hour-vacia { padding-block: 3px; color: #8a9ca3; font-size: .75rem; background: #f6f9fa; }
.calendar-hour small.calendar-now-hora { display: block; margin-top: 2px; color: #fff; background: #c2412d; border-radius: 4px; font-size: .6875rem; font-weight: 700; line-height: 1.5; }
.calendar-now { position: absolute; left: 0; right: 0; z-index: 2; height: 0; border-top: 2px solid #c2412d; pointer-events: none; }
.calendar-now::before { content: ""; position: absolute; left: -1px; top: -5px; width: 8px; height: 8px; border-radius: 50%; background: #c2412d; }
.schedule-block[data-estado="disponible"] { background: #fff; border-left-style: dashed; border-left-color: #8fbda3; color: #4a6657; box-shadow: inset 0 0 0 1px #d8e8de; }
.schedule-block[data-estado="disponible"] strong { font-weight: 600; color: #3f5a4b; }
.schedule-block[data-estado="disponible"] .schedule-time, .schedule-block[data-estado="disponible"] small { color: #5d7a6a; }
.schedule-block:not([data-estado="disponible"]):not([data-estado="bloqueado"]):not([data-estado="sin-publicar"]):not([data-estado="cancelada"]) { box-shadow: 0 1px 2px rgb(24 59 78 / 12%); }

@media (max-width: 1260px) {
  .pers .agenda-filter-form, .pers .agenda-filter-form:not(:has([name=sede])) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .agenda-filter-form:has([name=sede]) .multi-filter > div { left: auto; right: 0; }
}
@media (max-width: 760px) {
  .agenda-filtros > summary {
    display: list-item;
    padding: 7px 0;
    color: var(--navy);
    font-weight: 700;
    cursor: pointer;
  }
  .agenda-heading { gap: 8px; margin-bottom: 9px; }
  .agenda-heading .actions { justify-content: flex-start; }
  .pers .agenda-tools details[open] > .agenda-filter-form { width: calc(100vw - 40px); }
  .agenda-heading p { flex-basis: 100%; }
  .agenda-actions > div { left: 0; right: auto; }
  .pers .agenda-filter-form, .pers .agenda-filter-form:not(:has([name=sede])) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .agenda-filter-actions { grid-column: 1 / -1; }
  .agenda-filter-form:has([name=sede]) .multi-filter > div { left: 0; right: auto; }
  .agenda-filter-form:not(:has([name=sede])) .multi-filter > div { left: auto; right: 0; }
  .agenda-page .calendar-toolbar { align-items: flex-start; padding-top: 10px; }
  .agenda-view-control { flex-wrap: wrap; }
  .agenda-date-control strong { margin-left: 0; flex-basis: 100%; }
  .agenda-fila { grid-template-columns: 2.8rem minmax(0, 1fr); gap: 6px; padding-block: 8px; }
  .agenda-fila .actions { grid-column: 2; justify-content: flex-start; }
  .drawer-header, .drawer-content { padding-inline: 12px; }
}
@media (max-width: 370px) {
  .agenda-view-control > * { flex: 1 1 auto; }
  .agenda-view-control .agenda-view { flex: 1; }
  .drawer-content .form-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .drawer-content .drawer-loading::before { animation: none; } }
`;

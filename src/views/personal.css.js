"use strict";
module.exports = `
body.pers {
  --personal-gap: clamp(16px, 2.3vw, 30px);
  --personal-max: 1900px;
  --control: 38px;
  --control-radio: 7px;
  --personal-fondo: #f4f7f8;
  background: var(--personal-fondo);
  font-size: 1rem;
}

.pers .side {
  width: 228px;
  height: 100dvh;
  background: var(--navy);
  scrollbar-width: thin;
  scrollbar-color: #66818f transparent;
}
.pers .side-head { display: flex; align-items: center; }
.pers .side a.side-marca {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-height: 64px;
  margin: 0;
  padding: 9px 14px;
  border: 0;
  color: #fff;
}
.pers .side-marca img { width: 36px; height: 36px; flex: none; }
.pers .side-marca b { font-size: .9rem; font-weight: 700; }
.pers .side-marca small { color: #bbd2dc; font-size: .8125rem; }
.pers .side-close { display: none; }
.pers .side nav { display: block; padding: 10px 10px 14px; }
.pers .side h3 {
  margin: 12px 8px 8px;
  color: #bacdd6;
  font-size: .6875rem;
  letter-spacing: .075em;
}
.pers .side :is(nav, .pie-s) a, .pers .side .side-logout {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--control);
  padding: 7px 9px;
  border-radius: var(--control-radio);
  color: #e1edf1;
  font-size: .875rem;
  font-weight: 600;
  line-height: 1.25;
}
.pers .side a.act { background: var(--teal-t); color: #fff; box-shadow: none; }
.pers .side :is(a, button) svg { width: 18px; height: 18px; flex: none; }
.pers .side .pie-s { padding: 8px 10px 12px; }
.pers .side .side-user {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 8px 0 2px !important;
  padding: 12px 7px 8px;
  border: 0;
  border-top: 1px solid #3d5c6d;
  border-radius: 0;
  background: transparent;
}
.pers .side-user .side-avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 50%;
  background: #36596b;
  color: #fff;
  font-size: .8125rem;
  font-weight: 700;
}
.pers .side-user b, .pers .side-user small { display: block; line-height: 1.3; overflow-wrap: anywhere; }
.pers .side-user b { font-size: .875rem; }
.pers .side-user small { color: #b5cbd5; font-size: .8125rem; }
.pers .side .side-logout {
  justify-content: flex-start;
  width: 100%;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.pers .side .side-logout:hover { background: rgba(255, 255, 255, .08); color: #fff; box-shadow: none; }

.pers .top {
  height: auto;
  min-height: 64px;
  padding: 8px var(--personal-gap);
  background: #fff;
  border-color: var(--borde);
  backdrop-filter: none;
}
.pers .top h1 {
  margin: 0;
  color: var(--navy);
  font: 700 clamp(1.15rem, 1.5vw, 1.5rem)/1.14 var(--f);
  white-space: normal;
  overflow: visible;
}
.pers .fecha-hoy {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: .875rem;
  font-weight: 400;
}
.pers .menu-btn { width: var(--control); height: var(--control); border-radius: var(--control-radio); box-shadow: none; }
.pers .menu-btn svg { width: 20px; height: 20px; }
.pers .app > main { padding: 0; }
.pers .workspace {
  min-width: 0;
  max-width: var(--personal-max);
  padding: 20px var(--personal-gap) 32px;
}
.pers .app > main > .cont {
  margin: 20px var(--personal-gap) 32px;
  padding: clamp(14px, 2vw, 24px);
  border-radius: 8px;
  box-shadow: none;
}
.pers .work-heading { margin-bottom: 16px; gap: 10px; }
.pers .work-heading h2 { margin: 0 0 4px; font-size: 1.25rem; letter-spacing: -.015em; }
.pers .work-heading p { color: var(--muted); font-size: .9375rem; }
.pers .work-panel, .pers .team-card, .pers .filtro-r { box-shadow: none; }
.pers .work-panel { padding: 16px; margin-bottom: 16px; }
.pers .panel-heading { gap: 8px; margin-bottom: 12px; }
.pers .panel-heading h3 { font-size: 1rem; }
.pers .work-panel .tabla-w { border: 0; border-radius: 0; margin-bottom: 0; }
.pers .location[id], .pers #documentos-registrados { scroll-margin-top: 5rem; }
.pers .location:target { outline: 2px solid var(--teal-t); outline-offset: 2px; }

.pers :is(.workspace, .cont) :is(.btn, button[type=submit], button:not([type])) {
  min-height: var(--control);
  height: auto;
  padding: 7px 12px;
  border-radius: var(--control-radio);
  box-shadow: none;
  font-size: .875rem;
  line-height: 1.25;
}
.pers :is(.workspace, .cont) .sec:hover {
  background: var(--personal-fondo);
  color: var(--navy);
  border-color: #9cafb6;
}
.pers :is(.workspace, .cont) .btn svg { width: 16px; height: 16px; }
.pers :is(.workspace, .cont) :is(input, select, textarea) {
  border-radius: var(--control-radio);
  box-shadow: none;
  font-size: .875rem;
}
.pers :is(.workspace, .cont) :is(input:not([type=checkbox],[type=radio]), select) { min-height: var(--control); padding-block: 6px; }
.pers :is(.workspace, .cont) select:not([multiple]) { padding-right: 2rem; }
.pers :is(.workspace, .cont) :is(input, select, textarea):focus { box-shadow: var(--anillo); }
.pers :is(.workspace, .cont) label { font-size: .875rem; }
.pers .workspace th { padding: 9px 10px; background: #f4f7f8; font-size: .75rem; }
.pers .workspace td { padding: 9px 10px; font-size: .875rem; }
.pers .workspace .status { font-size: .8125rem; line-height: 1.2; }
.pers .details-grid dt, .pers .block { font-size: .8125rem; color: var(--muted); }
.pers .details-grid dd, .pers :is(.team-card, .location) p { font-size: .875rem; }

.pers .personal-aviso {
  width: 100%;
  max-width: var(--personal-max);
  margin: 0 auto;
  padding: 12px var(--personal-gap) 0;
}
.pers .aviso { border-radius: var(--control-radio); padding: 9px 12px; }
.pers .personal-aviso .aviso { display: flex; align-items: center; gap: 8px; margin: 0; }
.pers .personal-aviso svg { width: 18px; height: 18px; flex: none; }
.pers .personal-actividad {
  position: fixed;
  z-index: 120;
  right: 14px;
  bottom: 14px;
  font-size: .875rem;
}
.pers .personal-actividad:not(:empty) {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 12px;
  background: var(--navy);
  color: #fff;
  border-radius: var(--control-radio);
  box-shadow: 0 3px 12px #183b4e36;
}
.pers .personal-actividad:not(:empty)::before {
  content: '';
  width: 13px;
  height: 13px;
  border: 2px solid #789ba9;
  border-top-color: #fff;
  border-radius: 50%;
  animation: personal-cargando .7s linear infinite;
}
@keyframes personal-cargando { to { transform: rotate(1turn); } }

@media (max-width: 1024px) {
  .pers .side { width: min(304px, 90vw); }
  .pers .side-close {
    display: grid;
    place-items: center;
    flex: none;
    width: 42px;
    height: 42px;
    margin-right: 10px;
    border: 0;
    border-radius: var(--control-radio);
    background: transparent;
    color: #fff;
  }
  .pers .side-close:hover { background: rgba(255, 255, 255, .08); }
  .pers .side nav { padding-top: 4px; }
}
@media (max-width: 760px) {
  body.pers { --control: 42px; }
  .pers .top { min-height: 58px; }
  .pers .workspace { padding-top: 14px; padding-bottom: 24px; }
  .pers .app > main > .cont { margin-top: 14px; }
  .pers .work-panel { padding: 12px; }
  .pers :is(.workspace, .cont) :is(input, select, textarea) { font-size: 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  .pers .personal-actividad:not(:empty)::before { animation: none; }
}
@media print {
  .pers .top { position: static; }
  .pers .personal-actividad { display: none; }
}
`;

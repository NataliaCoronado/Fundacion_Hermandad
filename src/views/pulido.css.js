'use strict';
module.exports = `
:root{
  --ease:cubic-bezier(.2,.7,.2,1);
  --g-teal:linear-gradient(180deg,#1d9ba6 0%,#147f8a 100%);
  --g-teal-h:linear-gradient(180deg,#1ba3ae 0%,#0f727d 100%);
  --sombra:0 1px 2px rgba(11,59,76,.05),0 10px 28px -14px rgba(11,59,76,.18);
  --sombra-2:0 2px 4px rgba(11,59,76,.06),0 22px 44px -18px rgba(11,59,76,.28);
  --sombra-btn:inset 0 1px 0 rgba(255,255,255,.22),0 1px 2px rgba(11,59,76,.2),0 8px 18px -8px rgba(19,127,138,.7);
  --anillo:0 0 0 4px rgba(22,128,139,.18);
  --r:16px;--r-s:12px
}
body{font-family:'Public Sans','Segoe UI',system-ui,-apple-system,sans-serif;text-rendering:optimizeLegibility}
::selection{background:rgba(22,128,139,.2)}

.btn,form button[type=submit],form button:not([type]){
  position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:42px;padding:10px 18px;border-radius:var(--r-s);
  border:1px solid #11727c;background:var(--g-teal);color:#fff;
  font-family:inherit;font-weight:650;font-size:.9rem;line-height:1.2;letter-spacing:.005em;
  text-decoration:none;white-space:nowrap;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;
  box-shadow:var(--sombra-btn);text-shadow:0 1px 0 rgba(0,0,0,.08);
  transition:transform .18s var(--ease),box-shadow .18s var(--ease),background .18s,border-color .18s,color .18s
}
.btn:hover,form button[type=submit]:hover,form button:not([type]):hover{
  background:var(--g-teal-h);border-color:#0d6670;transform:translateY(-1px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 2px 4px rgba(11,59,76,.18),0 14px 26px -10px rgba(19,127,138,.75)
}
.btn:active,form button[type=submit]:active,form button:not([type]):active{transform:translateY(0) scale(.98);box-shadow:inset 0 2px 4px rgba(0,0,0,.14)}
.btn:focus-visible,form button:focus-visible{outline:3px solid #f2b705;outline-offset:2px}
.btn svg{width:18px;height:18px;flex:none;transition:transform .2s var(--ease)}
.btn:hover svg{transform:translateX(2px)}

.btn.sec,form button.sec,form button[type=submit].sec{
  background:#fff;color:var(--navy);border-color:var(--borde-2);text-shadow:none;
  box-shadow:0 1px 2px rgba(11,59,76,.06),inset 0 -1px 0 rgba(11,59,76,.04)
}
.btn.sec:hover,form button.sec:hover,form button[type=submit].sec:hover{
  background:#f3fafb;color:var(--teal-t);border-color:var(--teal);
  box-shadow:0 1px 2px rgba(11,59,76,.06),0 10px 20px -12px rgba(11,59,76,.35)
}
.btn.sec:active,form button.sec:active{box-shadow:inset 0 1px 3px rgba(11,59,76,.12)}
.btn.grande{min-height:52px;padding:14px 26px;font-size:1rem;border-radius:14px}
.btn.chico{min-height:34px;padding:6px 12px;font-size:.8rem;border-radius:10px}
.btn.blq{display:flex;width:100%}
.btn[disabled],.btn.off,form button[disabled]{opacity:.45;pointer-events:none;box-shadow:none}
html.contraste .btn:not(.sec),html.contraste form button[type=submit]:not(.sec){background:#004b52;border-color:#000}

td .btn,td form button,td form button[type=submit]{min-height:32px;padding:6px 12px;font-size:.8rem;border-radius:9px}

input,select,textarea{
  min-height:44px;border:1px solid var(--borde-2);border-radius:var(--r-s);background-color:#fff;
  box-shadow:inset 0 1px 2px rgba(11,59,76,.04);transition:border-color .15s,box-shadow .15s,background-color .15s
}
textarea{min-height:96px}
input:hover,select:hover,textarea:hover{border-color:#a9c2c9}
input:focus,select:focus,textarea:focus{border-color:var(--teal);box-shadow:var(--anillo)}
input[type=checkbox],input[type=radio]{min-height:0;box-shadow:none}
input[type=color]{padding:4px;cursor:pointer}
select:not([multiple]){
  -webkit-appearance:none;appearance:none;padding-right:40px;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235a6e76' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;background-size:18px
}
label{font-weight:600}

.tarjeta,.opcion,.prof,.panel,.kpi,.semana,.pasos3>div,.sede-c,.cont,.work-panel,.team-card,.filtro-r{
  border-color:rgba(11,59,76,.09);box-shadow:var(--sombra)
}
.tarjeta,.opcion,.prof,.panel,.cont,.sede-c{border-radius:18px}
.work-panel,.team-card,.filters,.metric-strip{border-radius:16px!important;border-color:rgba(11,59,76,.09)!important}
.filters{box-shadow:var(--sombra)!important}
.team-card{transition:box-shadow .2s,transform .2s}
.team-card:hover{box-shadow:var(--sombra-2);transform:translateY(-2px)}
.opcion:hover,.prof:hover{border-color:rgba(22,128,139,.3)}
.aviso{border-radius:14px}
.badge,.etiqueta,.chip,.status{border-radius:999px}
.status{display:inline-flex;align-items:center;gap:6px;padding:4px 10px}
.status:before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
.tabla-w,.work-panel .tabla-w{border-radius:14px}
th{background:#f7fafb}
tbody tr{transition:background .12s}
.vacio{border-radius:18px}

.horas a{border-radius:12px;border-width:1px;box-shadow:0 1px 2px rgba(11,59,76,.05)}
.horas a:hover{background:var(--g-teal);border-color:#11727c;box-shadow:0 8px 16px -8px rgba(19,127,138,.7);transform:translateY(-1px)}
.dsem{transition:background .15s}
.dsem.sel{background:var(--g-teal);box-shadow:0 8px 16px -8px rgba(19,127,138,.7)}
.pestanas a,.rapidos a{transition:color .15s,background .15s,box-shadow .15s}
.pasos3 .n{background:var(--g-teal);box-shadow:0 6px 14px -6px rgba(19,127,138,.8)}

.menu-btn{
  display:none;place-items:center;flex:none;width:44px;height:44px;padding:0;border-radius:12px;
  border:1px solid var(--borde);background:#fff;color:var(--navy);cursor:pointer;
  box-shadow:0 1px 2px rgba(11,59,76,.06);transition:background .15s,border-color .15s
}
.menu-btn:hover{background:var(--claro);border-color:var(--borde-2)}
.menu-btn svg{width:22px;height:22px}
.velo{display:none}

.sup .cab{position:relative}
.nav a{transition:background .15s,color .15s}
.nav a.cta{background:var(--g-teal);box-shadow:var(--sombra-btn);padding:10px 18px}
.nav a.cta:hover{background:var(--g-teal-h)}
.acc button{border-radius:8px;padding:4px 10px;transition:background .15s}

.pers{font-size:14px}
.side a{border-radius:12px;transition:background .15s,color .15s}
.side a.act{background:var(--g-teal);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 8px 18px -8px rgba(0,0,0,.45)}
.side-user{display:grid;gap:2px;margin:12px 0!important;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}
.side-user span{color:#9fc0c9}
.side-user form{margin-top:10px!important}
.side .micro button,.side .micro button[type=submit]{
  width:100%;min-height:36px;padding:7px 12px;border-radius:10px;font-size:.82rem;font-weight:600;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#e3f0f3;box-shadow:none;text-shadow:none
}
.side .micro button:hover{background:rgba(255,255,255,.14);transform:none;box-shadow:none}
.pers .top{height:auto;min-height:72px;flex-wrap:nowrap;padding:12px 28px;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.4) blur(10px)}
.top-izq{display:flex;align-items:center;gap:12px;min-width:0}
.pers .top h1{font-family:inherit;font-size:1.15rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top .der{flex:none}
.fecha-hoy{border-radius:12px;background:#f7fafb}
.yo form button,.yo form button[type=submit]{
  min-height:36px;padding:7px 14px;border-radius:10px;font-size:.82rem;font-weight:600;
  background:#fff;color:var(--muted);border:1px solid var(--borde);box-shadow:none;text-shadow:none
}
.yo form button:hover{background:var(--bg);color:var(--navy);border-color:var(--borde-2);transform:none;box-shadow:none}
.workspace .btn,.workspace button[type=submit],.workspace form button:not([type]){min-height:38px;padding:8px 14px;font-size:.84rem;border-radius:10px;font-weight:650}
.workspace .micro button{min-height:32px;padding:6px 12px}
.workspace td .btn,.workspace td form button{min-height:32px;padding:6px 11px;font-size:.78rem}
.workspace label{font-size:.78rem}
.workspace input,.workspace select,.workspace textarea{min-height:40px;font-size:.86rem;border-radius:10px;border-width:1px}
.workspace select:not([multiple]){padding-right:36px;background-position:right 10px center}
.workspace td{font-size:.84rem}
.workspace th{font-size:.7rem}
.work-heading h2{letter-spacing:-.02em}
.work-heading p{font-size:.9rem}
.multi-filter{min-height:40px;border-radius:10px}
.calendar-scroll{border-radius:14px}
.drawer{border-radius:20px}
.drawer-close{font-weight:700;color:var(--muted)}

.ing-caja input{min-height:48px}
.ing-caja .btn,.ing-caja button[type=submit]{min-height:50px;width:100%;font-size:.98rem}

.sedes-g{grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr))}
.grilla{grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))}
.profs{grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr))}
img{height:auto}

@media (max-width:1024px){
  .kpis{grid-template-columns:repeat(2,1fr)}
  .paneles,.tres,.dos-g{grid-template-columns:1fr}
  body.pers{flex-direction:row}
  .pers .menu-btn{display:inline-grid}
  .side{
    position:fixed;inset:0 auto 0 0;z-index:60;width:min(300px,86vw);height:100vh;height:100dvh;
    transform:translateX(-104%);transition:transform .3s var(--ease),box-shadow .3s;
    visibility:hidden
  }
  .side nav{display:block}
  body.menu-abierto .side{transform:none;visibility:visible;box-shadow:24px 0 60px rgba(4,26,34,.35)}
  .velo{display:block;position:fixed;inset:0;z-index:55;background:rgba(6,30,40,.45);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .25s}
  body.menu-abierto .velo{opacity:1;pointer-events:auto}
  body.pers.menu-abierto{overflow:hidden}
  .pers .top{padding:12px 20px}
  .yo>span:not(.av){display:none}
  .app main{padding:20px}
  .workspace{padding:20px}
}

@media (max-width:900px){
  .sup .cab{flex-wrap:nowrap;padding:10px 16px}
  .sup .cab .menu-btn{display:inline-grid;margin-left:auto}
  .sup .cab .nav{
    display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;align-items:stretch;gap:4px;
    background:#fff;padding:10px 16px 16px;border-bottom:1px solid var(--borde);box-shadow:0 18px 30px -18px rgba(11,59,76,.35)
  }
  body.menu-abierto .sup .cab .nav{display:flex}
  .sup .cab .nav a{padding:13px 16px;border-radius:12px;font-size:1rem}
  .sup .cab .nav a.cta{margin:6px 0 0;text-align:center}
  .logo{height:40px}
  main{padding:28px 16px 64px}
  .hero{margin-bottom:36px}
  .hero-img img{height:280px}
  .hero-img .flot{left:12px;right:12px;bottom:-20px;max-width:none}
  .datos{padding:24px;border-radius:18px}
}

@media (max-width:760px){
  input,select,textarea,.workspace input,.workspace select,.workspace textarea{font-size:16px}
  .acc{padding:6px 16px}
  .acc>div:last-child{display:none}
  .acc div{gap:6px}
  .pers .top{min-height:60px;padding:10px 14px;gap:10px}
  .pers .top h1{font-size:1.02rem}
  .fecha-hoy{display:none}
  .yo{gap:8px}
  .yo>span:not(.av){display:none}
  .yo .av{width:36px;height:36px}
  .app main,.pers .cont{padding:14px}
  .workspace{padding:14px}
  .work-heading{gap:12px;margin-bottom:16px}
  .work-heading h2{font-size:1.35rem}
  .filters .multi-filter{flex:1 1 100%}
  .multi-filter>div{width:min(280px,calc(100vw - 60px))}
  .work-heading .actions{width:100%}
  .work-heading .actions>.btn,.work-heading .actions>form{flex:1 1 auto}
  .work-heading .actions>form button{width:100%}
  .filters{padding:14px!important;gap:10px}
  .filters label{flex:1 1 calc(50% - 5px);min-width:0}
  .filters label:has(input[type=search]),.filters label:has(input[type=date]){flex-basis:100%}
  .filters button{flex:1 1 100%;height:auto}
  .filtro select,.filtro input,.filtro-r input,.filtro-r select{width:100%;min-width:0}
  .filtro label,.filtro-r label{flex:1 1 100%}
  .calendar-toolbar{gap:10px}
  .calendar-toolbar .actions{width:100%}
  .calendar-toolbar form{max-width:none;flex:1}
  .metric-strip{padding:12px 0}
  .metric-strip>div{padding:0 14px}
  .metric-strip>div:nth-child(2n){border-right:0}
  .tarjeta{padding:20px}
  .cont{padding:18px}
  .hola h2{font-size:1.25rem}
  .rapidas{width:100%}.rapidas .btn{flex:1 1 auto}
  .kpi{padding:14px 16px}
  .kpi b{font-size:1.4rem}
  .panel{padding:18px}
  .drawer-backdrop{align-items:flex-end!important}
  .drawer{width:100%!important;max-height:90vh!important;max-height:90dvh!important;border-radius:22px 22px 0 0!important}
  .drawer .workspace{padding:16px}
  .ing-izq{padding:24px 20px}
  .ing-izq ul,.ing-izq>small{display:none}
  .ing-izq h1{font-size:1.5rem;margin:18px 0 6px}
  .ing-izq p{font-size:.92rem;margin:0}
  .ing-der{padding:28px 20px 40px}
  .hero .acciones .btn{flex:1 1 100%}
  .titulo-sec .btn{width:100%}
}

@media (max-width:560px){
  .kpis{grid-template-columns:1fr 1fr;gap:10px}
  .kpi{flex-direction:column;align-items:flex-start;gap:8px}
  .datos{grid-template-columns:1fr 1fr;gap:16px;padding:20px}
  .datos b{font-size:1.35rem}
  .hero-img img{height:220px}
  .fila{flex-direction:column;gap:2px}.fila span{width:auto}
  .proximas li{grid-template-columns:60px 1fr;row-gap:6px}
  .proximas li>:last-child{grid-column:2}
  .barras .b,.bh .b{grid-template-columns:100px 1fr auto}
  .exito{align-items:flex-start}
  .semana{padding:14px}
  .sem-dias{gap:3px}
  .dsem{min-height:60px}
  .resumen-r .btn,.tarjeta>.btn{width:100%}
}

@media (pointer:coarse){
  .btn,form button[type=submit],form button:not([type]){min-height:44px}
  .btn.chico,td .btn,td form button{min-height:38px}
  .btn:hover,form button:hover,.horas a:hover,.team-card:hover{transform:none}
}
@media (prefers-reduced-motion:reduce){
  *,*:before,*:after{transition:none!important;animation:none!important}
}
@media print{.menu-btn,.velo{display:none!important}}

:root{
  --navy:#183b4e;--navy-2:#1f4a5f;--teal:#347d86;--teal-t:#2e7179;--teal-2:#2a6870;
  --bg:#f6f8f8;--sup:#fff;--borde:#e1e8ea;--borde-2:#ccd8db;--muted:#566870;--suave:#86979d;--claro:#e8f1f2;
  --ok:#2e7a4f;--ok-bg:#e8f3ec;
  --g-teal:var(--teal);--g-teal-h:var(--teal-2);
  --sombra:0 1px 2px rgba(24,59,78,.05);--sombra-2:0 4px 14px rgba(24,59,78,.08);--sombra-btn:none;
  --anillo:0 0 0 3px rgba(52,125,134,.22);--r:8px;--r-s:6px;
  --f:'Source Sans 3','Segoe UI',system-ui,-apple-system,sans-serif
}
body{font-family:var(--f)}
h1,h2,h3,h4,.top h1,.pers .top h1{font-family:var(--f);font-weight:600;letter-spacing:-.01em}
::selection{background:rgba(52,125,134,.2)}
.btn,form button[type=submit],form button:not([type]),.btn.grande,.btn.chico,
.workspace .btn,.workspace button[type=submit],.workspace form button:not([type]),.ing-caja .btn,.ing-caja button[type=submit]{
  border-radius:6px;text-shadow:none;font-weight:600}
.btn:hover,form button[type=submit]:hover,form button:not([type]):hover{transform:none}
.btn:hover svg{transform:none}
.tarjeta,.opcion,.prof,.panel,.cont,.sede-c,.vacio,.kpi,.semana{border-radius:8px}
.work-panel,.team-card,.filters,.metric-strip{border-radius:8px!important;border-color:var(--borde)!important}
.aviso,.tabla-w,.work-panel .tabla-w,.calendar-scroll,.side-user{border-radius:8px}
.drawer{border-radius:10px}
.tarjeta,.opcion,.prof,.panel,.kpi,.semana,.pasos3>div,.sede-c,.cont,.work-panel,.team-card,.filtro-r{border-color:var(--borde);box-shadow:var(--sombra)}
.opcion:hover,.prof:hover,.team-card:hover{transform:none;box-shadow:var(--sombra)}
input,select,textarea{border-radius:6px}
/* Filtros: cada campo ocupa solo su columna (el buscador ya no se monta sobre el selector vecino) */
.filters label{flex:1 1 120px;min-width:0}
.filters label input,.filters label select,.filters input[type=search],.filters input[type=date]{min-width:0!important;width:100%;box-sizing:border-box}
.filters>button,.filters>.btn{flex:0 0 auto;align-self:flex-end;white-space:nowrap}
/* Botones de una misma fila: misma altura, tipografía y alineación (enlaces y botones de formulario) */
.workspace :is(.btn,button,.micro button),.workspace td :is(.btn,button){min-height:36px;height:36px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;font-size:inherit;line-height:1}
.workspace .micro{display:inline-flex;margin:0}
.workspace .actions,.workspace .acciones{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.calendar-legend{display:flex;justify-content:flex-end;align-items:center;gap:14px;flex-wrap:wrap;padding-top:6px}
.calendar-legend .muted{font-size:13px;color:var(--muted)}
.ing-izq{background:var(--navy)}
.side{background:var(--navy)}
.av{background:var(--teal)}
.kpi.dest{background:var(--teal)}
.barras .tr i{background:var(--teal)}
.datos{background:var(--navy)}
.ing-izq:after{display:none}
.ing-izq .logo-b{border-radius:8px}
`;

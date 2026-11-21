'use strict';
module.exports = `
body.portal{overflow-x:clip;color-scheme:light;--suave:#5b6c73;--tinta:#183b4e;--tinta-2:#112d3c;--sombra-c:var(--sombra);--riel:#5f8d9a;--riel-ok:#7fd0d6;--sobre-tinta:#c3dae0}
body.portal main{padding-top:0}

body.portal{--f-titulo:'Source Sans 3','Segoe UI',system-ui,sans-serif;--f-texto:'Source Sans 3','Segoe UI',system-ui,sans-serif;
  font-family:var(--f-texto);font-weight:400;font-size:1rem;line-height:1.55}
html:has(body.portal){--fs:17px;overflow-x:clip}
body.portal h1,body.portal h2,body.portal h3,body.portal .dia-t,body.portal .mes-cab b,body.portal .prof-cab b,body.portal summary{
  font-family:var(--f-titulo);font-weight:600;letter-spacing:-.01em}
body.portal .btn,body.portal button,body.portal .nav a{font-family:var(--f-titulo);font-weight:600}
body.portal input,body.portal select,body.portal textarea,body.portal label,body.portal legend,body.portal .check{font-family:var(--f-texto)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

body.portal .cab{border-bottom:0;padding-top:14px;padding-bottom:14px;background:var(--sup);backdrop-filter:none}
body.portal .nav{gap:2px}
body.portal .nav a{border-radius:6px;font-weight:600;color:var(--navy);position:relative}
body.portal .nav a:hover{background:var(--bg)}
body.portal .nav a.act{background:transparent;color:var(--teal-t)}
body.portal .nav a.act::after{content:'';position:absolute;left:14px;right:14px;bottom:2px;height:2px;background:var(--teal);border-radius:2px}
body.portal .nav a.cta{background:var(--sup);color:var(--navy);border:1.5px solid var(--borde-2);box-shadow:none;margin-left:10px;padding:8px 16px}
body.portal .nav a.cta:hover{border-color:var(--teal);background:var(--claro)}
body.portal .nav a.cta.act::after{display:none}

.portada{position:relative;isolation:isolate;background:var(--tinta);color:var(--sobre-tinta);
  box-shadow:0 0 0 100vmax var(--tinta);clip-path:inset(0 -100vmax);padding:52px 0 44px;margin:0 0 44px}
.portada-sello{position:absolute;z-index:-1;right:-150px;top:50%;width:460px;height:460px;transform:translateY(-50%);
  filter:invert(1);mix-blend-mode:screen;opacity:.13;pointer-events:none;user-select:none}
.portada .volver{display:inline-flex;align-items:center;gap:6px;margin:0 0 20px;padding:7px 14px 7px 10px;min-height:40px;
  color:#fff;font-weight:600;font-size:.95rem;text-decoration:none;border:1px solid rgba(255,255,255,.4);border-radius:6px}
.portada .volver svg{width:18px;height:18px}
.portada .volver:hover{background:rgba(255,255,255,.1);border-color:#fff}
.portada h1{font-family:var(--f-titulo);font-weight:600;color:#fff;
  font-size:clamp(2rem,1.35rem + 2.2vw,3rem);line-height:1.08;letter-spacing:-.015em;max-width:20ch;margin:0 0 14px}
.portada .lead{color:var(--sobre-tinta);font-size:1.06rem;line-height:1.6;max-width:58ch;margin:0}
.portada .lead a{color:#fff;text-decoration-color:var(--riel-ok)}

.barra{display:grid;grid-template-columns:repeat(4,1fr);list-style:none;margin:40px 0 0;padding:0;max-width:760px;counter-reset:none}
.barra li{position:relative;display:flex;flex-direction:column;gap:10px;font-size:.86rem;font-weight:600;color:#9fbfc8}
body.portal .barra li::before{content:'';position:absolute;top:12px;left:38px;right:10px;height:4px;
  background:radial-gradient(circle,var(--riel) 1.6px,transparent 2.1px) 0 50%/10px 4px repeat-x}
body.portal .barra li:last-child::before{display:none}
.barra .cuenta{position:relative;z-index:1;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--riel);
  display:grid;place-items:center;font-size:.8rem;font-weight:700;background:var(--tinta)}
.barra .hecho{color:#d3e5ea}
body.portal .barra .hecho::before{background-image:radial-gradient(circle,var(--riel-ok) 1.8px,transparent 2.3px)}
.barra .hecho .cuenta{background:var(--riel-ok);border-color:var(--riel-ok);color:var(--tinta)}
.barra .actual{color:#fff}
.barra .actual .cuenta{background:#fff;border-color:#fff;color:var(--tinta);box-shadow:0 0 0 5px rgba(255,255,255,.14)}

body.portal .tarjeta,body.portal .opcion,body.portal .prof,body.portal .mes,body.portal .busqueda-r,
body.portal .hora,body.portal .familiar,body.portal details.docs,body.portal .account-page{
  border-radius:8px;box-shadow:var(--sombra-c);border:1px solid var(--borde);background:var(--sup)}
body.portal .account-page{margin:0 auto}
body.portal:has(.account-page) .portada-txt{text-align:center}
body.portal:has(.account-page) .portada h1,body.portal:has(.account-page) .portada .lead{margin-left:auto;margin-right:auto}
body.portal .opcion:hover,body.portal .prof:hover{transform:none;box-shadow:var(--sombra-c);border-color:var(--borde-2)}
body.portal .aviso{border-radius:8px}
body.portal .btn,body.portal form button[type=submit],body.portal form button:not([type]){
  background:var(--teal);border:1.5px solid var(--teal);box-shadow:none;text-shadow:none;border-radius:6px}
body.portal .btn:hover,body.portal form button[type=submit]:hover,body.portal form button:not([type]):hover{
  background:var(--teal-2);border-color:var(--teal-2);transform:none}
body.portal .btn.sec,body.portal form button.sec,body.portal form button[type=submit].sec{
  background:var(--sup);color:var(--navy);border-color:var(--borde-2)}
body.portal .btn.sec:hover,body.portal form button.sec:hover{background:var(--claro);border-color:var(--teal)}
body.portal .btn:hover svg{transform:none}
body.portal .cuenta-nav form button{background:none;border:0;color:var(--muted)}
body.portal .cuenta-nav form button:hover{background:var(--sup);color:var(--navy)}

.portada-acc{margin:28px 0 0}
body.portal .portada-acc .btn{background:#fff;color:var(--tinta);border-color:#fff}
body.portal .portada-acc .btn:hover{background:var(--claro);border-color:var(--claro)}
.sedes-t{font-size:1.35rem;margin:0 0 16px}
.sedes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr));gap:16px}
.sedes a{display:flex;flex-direction:column;height:100%;background:var(--sup);border:1px solid var(--borde);border-radius:8px;overflow:hidden;
  box-shadow:var(--sombra);text-decoration:none;color:var(--navy);transition:border-color .15s}
.sedes a:hover{border-color:var(--teal)}
.sedes img{display:block;width:100%;height:150px;object-fit:cover;background:var(--claro)}
.sedes img.ilus{object-fit:contain}
.sede-n{font-weight:600;font-size:1.05rem;padding:14px 16px 2px}
.sede-d{color:var(--muted);font-size:.9rem;padding:0 16px 16px}
.ayuda-l{margin-top:14px}

body.portal .opcion{overflow:hidden}
body.portal .opcion .foto{max-width:none;width:calc(100% + 40px);margin:-20px -20px 12px;height:160px;border-radius:0}

.lado{display:grid;gap:0;align-content:start}
.lado section{padding:4px 0 22px;margin-bottom:20px;border-bottom:1px solid var(--borde)}
.lado section:last-child{border-bottom:0}
.lado h2{font-family:var(--f-titulo);font-size:1.15rem;font-weight:600;margin:0 0 8px}
.lado p,.lado li{color:var(--muted);font-size:.92rem}
.lado ol{padding-left:18px;margin:0;line-height:1.7}
.lado .btn{margin-top:4px}

body.portal .mes-g a{background:var(--sup);border:1.5px solid #9fd0d6;border-radius:6px}
body.portal .mes-g a:hover{background:var(--claro);border-color:var(--teal)}
body.portal .mes-g a.sel{background:var(--tinta);border-color:var(--tinta);color:#fff}
body.portal .mes-g a.sel i{color:var(--riel-ok)}
body.portal .mes-cab a,body.portal .mes-cab span{border-radius:6px}
body.portal .horas a{border-radius:6px;box-shadow:none}
body.portal .horas a:hover{background:var(--teal);border-color:var(--teal);box-shadow:none;transform:none}
body.portal .franja{letter-spacing:.04em}

.contacto{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:0;margin:0 0 8px;
  border-top:1px solid var(--borde);border-bottom:1px solid var(--borde)}
.contacto div{padding:18px 20px 18px 0}
.contacto dt{color:var(--muted);font-size:.86rem;margin-bottom:2px}
.contacto dd{margin:0;font-family:var(--f-titulo);font-size:1.3rem;font-weight:600;color:var(--navy)}
.contacto dd a{color:inherit}

body.portal .pie{display:block;background:var(--tinta-2);border-top:0;color:#b9d2d9;padding:40px max(20px,calc((100% - var(--ancho))/2)) 44px;font-size:.88rem}
.pie-in{display:grid;grid-template-columns:auto 1fr;gap:28px 56px;align-items:start}
.pie-marca{display:flex;gap:12px;align-items:center;color:#fff;font-family:var(--f-titulo);font-weight:600;font-size:1.02rem;line-height:1.25}
.pie-marca img{width:48px;height:48px;filter:invert(1);mix-blend-mode:screen;opacity:.9}
.pie-datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:18px 32px;margin:0}
.pie-datos dt{color:#86a9b3;font-size:.8rem;margin-bottom:2px}
.pie-datos dd{margin:0;color:#e6f0f3}
.pie-datos a{color:#e6f0f3}
.pie-legal{grid-column:1/-1;border-top:1px solid rgba(255,255,255,.1);padding-top:18px;font-size:.8rem;color:#86a9b3}
.pie-legal a{color:#b9d2d9}

@media(max-width:860px){
  .portada{padding:36px 0 32px;margin-bottom:32px}
  .portada-sello{width:300px;height:300px;right:-110px;top:24px;transform:none;opacity:.09}
  .pie-in{grid-template-columns:1fr}
  body.portal .nav a.act::after{display:none}
  body.portal .nav a.act{background:var(--claro)}
  body.portal .nav a.cta{margin:6px 0 0}
}
@media(max-width:560px){
  .barra{margin-top:28px}
  body.portal .barra li::before{left:34px;right:6px}
  .barra li:not(.actual) .et{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .barra .actual .et{white-space:nowrap}
}
.portada-txt{text-align:center}
.portada h1,.portada .lead{margin-left:auto;margin-right:auto}
.portada .volver{margin-left:0}
.portada-txt .volver{display:flex;width:max-content;margin:0 auto 20px}
.barra{margin-left:auto;margin-right:auto}
.portada-acc{display:flex;justify-content:center}
body.portal main>:is(form.tarjeta,.tarjeta,.mes,.busqueda-r,.aviso,.dia-t,.ayuda-l,.profs,details,.hora,.familiar,.cuenta-nav,.vacio,h2,.paso-t,.exito,.dos,.col,.account-page){max-width:820px;margin-left:auto;margin-right:auto}
body.portal main>.mes{max-width:620px}
body.portal main>.col,body.portal main>.account-page{max-width:480px}
body.portal main>.dia-t,body.portal main>h2{text-align:center}
body.portal main>h2{max-width:none}
body.portal main>.ayuda-l{text-align:center}
body.portal .profs{display:flex;flex-wrap:wrap;justify-content:center;gap:18px}
body.portal .profs>.prof{flex:0 1 400px;min-width:min(340px,100%)}
.contacto{text-align:center}
.sedes-t{text-align:center}
.sedes{display:flex;flex-wrap:wrap;justify-content:center;gap:16px}
.sedes>li{flex:0 1 calc(25% - 12px);min-width:min(240px,100%)}
body.portal .grilla{display:flex;flex-wrap:wrap;justify-content:center;gap:18px}
body.portal .grilla>.opcion{flex:0 1 calc(25% - 14px);min-width:min(240px,100%)}

body.portal :is(.nav a,.barra li,.barra .cuenta,.barra .et,label,legend,.check,.req,.nota,.sede-d,.ayuda-l,.opcion p,
 .opcion .meta span,.contacto dt,.account-links,.account-links p,.account-links a,.pie-datos dt,.pie-datos dd,.pie-datos a,
 .pie-legal,.pie-legal a,.busqueda-r,.bloq-t,.bloq-v,.fila,.fila span,.aviso,.mes-g small,.mes-g a,.mes-g a i,.mes-g span,
 .mes-cab b,.franja,.horas a,.chip,.av,.prof-cab b,.prof-cab small,.lugar,.etiqueta,.badge,summary,details p,.cuenta-nav a,
 .cuenta-nav button,.hora p,.btn,button,input,select,textarea,.portada .volver,.sec-t,.doc-fila label,th,td,.vacio,.hora h3,.familiar p){
  font-size:max(1rem,16px)}
.barra .cuenta{color:inherit}
body.portal .mes-g span{color:var(--muted);font-weight:400}
body.portal .mes-g a i{color:var(--teal-t)}

@media print{
  .portada{background:none;box-shadow:none;clip-path:none;color:#000;padding:0;margin-bottom:16px}
  .portada h1{color:#000}.portada .lead{color:#333}
  .portada-sello,.barra{display:none}
}

/* Barra lateral del portal, igual a la del panel del personal */
body.portal{flex-direction:row}
body.portal .app{overflow-x:clip}
body.portal .side a{font-family:var(--f-titulo)}
body.portal .side .pie-s a{font-size:.84rem;color:#b9d2d9}
body.portal header.sup{display:none}
@media (max-width:1024px){
  body.portal{flex-direction:column}
  body.portal header.sup{display:block}
  body.portal .sup .cab{flex-wrap:nowrap}
  body.portal .menu-btn{display:inline-grid;margin-left:auto}
  body.portal.menu-abierto{overflow:hidden}
}

/* ===== Ajuste visual del portal: más compacto, azul institucional y turquesa solo en acciones ===== */
/* 1. Barra lateral: algo más angosta y con mejor ritmo de espacios */
body.portal .side{width:232px}
body.portal .side-marca{padding:18px 14px 16px;gap:10px}
body.portal .side-marca b{font-size:.84rem;white-space:nowrap}
body.portal .side .pie-s a span{font-size:.8rem;white-space:nowrap}
body.portal .side nav{padding:6px 10px 14px}
body.portal .side h3{margin:16px 8px 8px;font-size:.64rem;color:#8fb0b9}
body.portal .side nav a{padding:10px 12px;gap:11px;margin-bottom:4px;border-radius:8px}
body.portal .side a.act{background:rgba(255,255,255,.12);box-shadow:inset 3px 0 0 #fff;color:#fff;font-weight:600}
body.portal .side a:hover:not(.act){background:rgba(255,255,255,.06)}
body.portal .side .pie-s{padding:12px 10px 16px}
body.portal .side .pie-s a{padding:7px 12px;gap:10px}

/* 2. Encabezado: menos alto */
body.portal .portada{padding:22px 0 20px;margin:0 0 24px}
body.portal .portada h1{font-size:clamp(1.55rem,1.2rem + 1vw,2.05rem);margin:0 auto 4px}
body.portal .portada .lead{font-size:.98rem;line-height:1.45}
body.portal .portada-txt .volver{margin-bottom:12px;min-height:36px;padding:5px 12px 5px 8px}
body.portal .portada-acc{margin-top:16px}

/* 6. Marca de agua más discreta */
body.portal .portada-sello{width:300px;height:300px;right:-90px;opacity:.05}

/* 3. Indicador de pasos compacto: número y etiqueta en una sola línea */
body.portal .portada .barra{display:flex;align-items:center;max-width:640px;margin:16px auto 0;gap:0}
body.portal .portada .barra li{flex:1 1 0;flex-direction:row;align-items:center;gap:8px;font-size:.92rem;white-space:nowrap}
body.portal .portada .barra li:last-child{flex:0 0 auto}
body.portal .portada .barra li::before{display:none}
body.portal .portada .barra li:not(:last-child)::after{content:'';flex:1;min-width:16px;height:1.5px;margin:0 12px;background:rgba(195,218,224,.35);border-radius:2px}
body.portal .portada .barra li.hecho:not(:last-child)::after{background:var(--sobre-tinta)}
body.portal .portada .barra .cuenta{width:24px;height:24px;flex:none;font-size:.78rem;border-width:1.5px}
body.portal .portada .barra .hecho .cuenta{background:var(--sobre-tinta);border-color:var(--sobre-tinta);color:var(--tinta)}
body.portal .portada .barra .actual .cuenta{box-shadow:0 0 0 3px rgba(255,255,255,.16)}

/* 4. Formulario de búsqueda: más arriba y más ancho, en dos columnas */
body.portal main>form#buscar{max-width:960px;padding:24px 28px}
#buscar .buscar-g{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;align-items:start}
#buscar .buscar-full{grid-column:1/-1}
#buscar .buscar-c>label:first-child,#buscar .buscar-c>div>label:first-child,#buscar .buscar-c>[hidden]+div>label:first-child{margin-top:0}
#buscar .ayuda-campo{margin:6px 0 0;font-size:.85rem;line-height:1.4}
#buscar .buscar-full{margin-top:16px}
#buscar .conmut{grid-column:1/-1;display:block;border:0;padding:0;margin:20px 0 0;min-width:0}
#buscar .conmut legend{float:none;display:block;width:auto;font-weight:600;padding:0;margin:0 0 8px}
#buscar .conmut label{position:relative;margin:0 8px 0 0;width:auto;display:inline-flex;vertical-align:top;align-items:center;min-height:44px;padding:0 20px;border:1.5px solid var(--borde-2);border-radius:6px;background:var(--sup);color:var(--navy);font-weight:600;cursor:pointer}
#buscar .conmut label:hover{border-color:var(--teal);background:var(--claro)}
#buscar .conmut input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
#buscar .conmut label:has(input:checked){background:var(--tinta);border-color:var(--tinta);color:#fff}
#buscar .conmut label:has(input:focus-visible){outline:3px solid var(--riel-ok);outline-offset:2px}
#buscar .buscar-ok{margin-top:22px;padding-top:18px;border-top:1px solid var(--borde);display:grid;gap:10px;text-wrap:pretty}
#buscar .buscar-ok .check{margin:0;align-items:flex-start}
#buscar .buscar-ok .check.opc{color:var(--muted)}
#buscar>button{margin-top:20px}
.flujo-resumen .vacio-res{margin:0;color:var(--muted);font-size:.92rem;line-height:1.45}
body.portal main>form#buscar+.ayuda-l{margin-top:14px}

/* 5. Turquesa reservado para acciones; los controles de selección usan el azul institucional */
body.portal input[type=checkbox],body.portal input[type=radio]{accent-color:var(--tinta)}

@media(max-width:760px){
  #buscar .buscar-g{grid-template-columns:1fr}
  #buscar .buscar-c+.buscar-c{margin-top:16px}
  body.portal main>form#buscar{padding:20px}
}
@media(max-width:560px){
  body.portal .portada .barra li{gap:6px}
  body.portal .portada .barra li:not(:last-child)::after{margin:0 6px}
}

/* ===== Flujo de reserva: formulario a la izquierda, resumen «Tu reserva» a la derecha ===== */
.flujo{max-width:1080px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:28px;align-items:start}
.flujo-main{container-type:inline-size;min-width:0}
body.portal .flujo-main>:is(.tarjeta,.mes,.aviso,.ayuda-l,.col){max-width:none;margin-left:0;margin-right:0}
body.portal .flujo-main>form.tarjeta{padding:24px 28px}
body.portal .flujo-main>.ayuda-l{text-align:left}
.flujo-resumen{position:sticky;top:20px;padding:18px 20px;border:1px solid var(--borde);border-radius:8px;background:var(--sup);box-shadow:var(--sombra-c)}
.flujo-resumen h2{margin:0 0 12px;font-size:1.05rem;text-align:left}
.flujo-resumen dl{margin:0;display:grid;gap:12px}
.flujo-resumen dt{font-size:.8125rem;color:var(--muted);margin:0}
.flujo-resumen dd{margin:2px 0 0;color:var(--navy);font-weight:600;overflow-wrap:anywhere}
.flujo-resumen .pend{color:var(--muted);font-weight:400}
.flujo-resumen .cambiar{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
.flujo-resumen .ayuda{margin:14px 0 0;padding-top:12px;border-top:1px solid var(--borde);font-size:.875rem;color:var(--muted)}
body.portal .flujo .tarjeta details.docs{box-shadow:none;background:#f7fafb;border-radius:6px;margin:16px 0}
body.portal .flujo .tarjeta .ficha-res{background:#f7fafb}

/* Día y hora en el mismo paso */
.fecha-hora{display:grid;gap:22px;align-items:start}
body.portal .fecha-hora .mes{max-width:none;margin:0}
body.portal .dia-panel .dia-t{text-align:left;margin:0 0 12px;font-size:1.2rem}
body.portal .dia-panel .profs{justify-content:flex-start;gap:14px}
body.portal .dia-panel .profs>.prof{flex:1 1 100%;min-width:0}
@container (min-width:700px){.fecha-hora{grid-template-columns:minmax(300px,360px) minmax(0,1fr)}}

/* Calendario con filas de altura fija: la cantidad de horas ya no agranda el día */
body.portal .mes-g{grid-template-rows:auto;grid-auto-rows:56px}
body.portal .mes .mes-g a,body.portal .mes .mes-g span{min-height:0;height:100%}
body.portal .mes .mes-g small{align-self:end}
body.portal .mes .mes-g a i{font-size:.75rem;line-height:1}

/* Cabecera en una sola línea en pantallas amplias */
@media (min-width:1025px){
  body.portal .portada:has(.barra){display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:40px;max-width:1080px;margin-inline:auto;padding:18px 0}
  body.portal .portada:has(.barra) .portada-txt{text-align:left}
  body.portal .portada:has(.barra) h1,body.portal .portada:has(.barra) .lead{margin-left:0;margin-right:0}
  body.portal .portada:has(.barra) .portada-txt .volver{margin:0 0 10px;width:max-content}
  body.portal .portada:has(.barra) .barra{margin:0;max-width:520px;min-width:440px}
}
@media (max-width:1024px){
  .flujo{grid-template-columns:minmax(0,1fr)}
  .flujo-resumen{position:static}
  .flujo-resumen:not([data-paso="1"]){order:-1}
  .flujo-resumen dl{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
}
@media (max-width:640px){
  .flujo{gap:16px}
  .flujo-resumen{padding:12px 14px}
  .flujo-resumen h2,.flujo-resumen .ayuda{display:none}
  .flujo-resumen[data-paso="1"] .ayuda{display:none}
  .flujo-resumen dl{grid-template-columns:1fr;gap:6px}
  .flujo-resumen dd{font-size:.9375rem}
  .flujo-resumen .cambiar{margin-top:10px}
}

/* ===== Barra lateral delgada y cabecera blanca discreta ===== */
body.portal .side{width:212px}
body.portal .side-marca{padding:16px 14px 14px;gap:10px;align-items:center}
body.portal .side-marca img{width:38px;height:38px;padding:2px}
body.portal .side-marca span{display:grid;gap:1px}
body.portal .side-marca b{font-size:.92rem;line-height:1.2;white-space:normal}
body.portal .side-marca small{font-size:.76rem;font-weight:400;line-height:1.25;color:var(--sobre-tinta)}
body.portal .side nav{padding:4px 10px 14px}
body.portal .side h3{margin:14px 8px 6px;font-size:.82rem;font-weight:600;letter-spacing:0;color:var(--sobre-tinta)}
body.portal .side nav a{min-height:42px;padding:8px 10px;gap:10px;margin-bottom:3px;border-radius:8px;font-size:.95rem;color:#fff}
body.portal .side nav a svg{width:18px;height:18px;padding:0;border-radius:0;background:none;opacity:.9;box-sizing:content-box}
body.portal .side nav a:hover:not(.act){background:rgba(255,255,255,.07)}
body.portal .side nav a.act{background:rgba(255,255,255,.12);box-shadow:inset 3px 0 0 #fff;font-weight:600}
body.portal .side nav a.act svg{background:none;opacity:1}
body.portal .side a:focus-visible{outline:3px solid var(--riel-ok);outline-offset:2px}
body.portal .side .pie-s{padding:12px 10px 16px;display:grid;gap:4px}
body.portal .side .pie-s-t{margin:0 0 4px;font-size:.88rem;font-weight:600;color:#fff}
body.portal .side .pie-s a{min-height:38px;padding:6px 10px;font-size:.84rem;color:var(--sobre-tinta);border-radius:8px}
body.portal .side .pie-s a span{font-size:.84rem;white-space:nowrap}
body.portal .side .pie-s a svg{width:16px;height:16px;padding:0;background:none}
body.portal .side .pie-s a.ayuda-wa{min-height:40px;justify-content:center;gap:6px;padding:6px 8px;background:#fff;color:var(--tinta);font-weight:600;box-shadow:none}
body.portal .side .pie-s a.ayuda-wa span{font-size:.82rem}
body.portal .side .pie-s a.ayuda-wa:hover{background:var(--claro)}
body.portal .side .pie-s a:not(.ayuda-wa):hover{background:rgba(255,255,255,.07);color:#fff}

body.portal .portada{background:#fff;color:var(--tinta);box-shadow:0 0 0 100vmax #fff;padding:14px 0 12px;margin:0 0 20px}
body.portal .portada::after{content:'';position:absolute;left:-100vmax;right:-100vmax;bottom:0;height:1px;background:var(--borde)}
body.portal .portada-sello{display:none}
body.portal .portada h1{color:var(--tinta);font-size:clamp(1.35rem,1.1rem + .7vw,1.65rem);line-height:1.15;margin:0 auto 2px}
body.portal .portada .lead{color:var(--muted);font-size:.92rem;line-height:1.4}
body.portal .portada .lead a{color:var(--tinta)}
body.portal .portada .volver{color:var(--tinta);border-color:var(--borde-2);min-height:34px;font-size:.88rem}
body.portal .portada .volver:hover{background:var(--claro);border-color:var(--teal)}
body.portal .portada .camino{display:grid;gap:6px;margin:10px auto 0;max-width:340px;width:100%}
body.portal .portada .paso-n{margin:0;font-size:.82rem;font-weight:600;color:var(--muted)}
body.portal .portada .camino .barra{display:flex;align-items:center;margin:0;max-width:none;min-width:0}
body.portal .portada .barra li{flex:1 1 0;display:flex;flex-direction:row;align-items:center;gap:0;font-size:0;color:var(--muted)}
body.portal .portada .barra li:last-child{flex:0 0 auto}
body.portal .portada .barra li::before{display:none}
body.portal .portada .barra .et{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
body.portal .portada .barra li:not(:last-child)::after{content:'';flex:1;height:1.5px;margin:0 6px;background:var(--borde-2);border-radius:2px}
body.portal .portada .barra li.hecho:not(:last-child)::after{background:var(--tinta)}
body.portal .portada .barra li:not(.actual) .cuenta{width:9px;height:9px;min-width:0;border:0;padding:0;font-size:0;background:var(--borde-2);box-shadow:none}
body.portal .portada .barra .hecho .cuenta{background:var(--tinta)}
body.portal .portada .barra .actual .cuenta{width:22px;height:22px;display:grid;place-items:center;font-size:.78rem;font-weight:700;background:var(--tinta);border:0;color:#fff;box-shadow:0 0 0 3px rgba(24,59,78,.14)}
@media (min-width:1280px){
  body.portal .portada:has(.barra){column-gap:32px}
  body.portal .portada:has(.barra) .camino{margin:0;min-width:400px}
}
@media (min-width:1025px) and (max-width:1279px){
  body.portal .portada:has(.barra){display:block}
  body.portal .portada:has(.barra) .camino{margin:10px 0 0}
}
@media (max-width:1024px){
  body.portal .side{width:min(280px,86vw)}
}
@media (max-width:560px){
  body.portal .portada{padding:12px 0 10px}
  body.portal .portada .barra li:not(.actual) .et{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  body.portal .portada .barra li:not(:last-child)::after{margin:0 6px}
}
body.portal #buscar .buscar-cab{margin:0 0 14px}
body.portal #buscar .buscar-cab h2{margin:0 0 2px;font-size:1.15rem;color:var(--teal-t)}
body.portal #buscar .buscar-cab p{margin:0;color:var(--muted);font-size:.92rem}
body.portal form#buscar button.continuar{border-radius:999px;min-height:46px;font-size:1rem;font-weight:600;background:var(--teal);border-color:var(--teal);color:#fff;transition:background .15s,color .15s}
body.portal form#buscar button.continuar.pendiente{background:#d7dde0;border-color:#d7dde0;color:#5f7078}
body.portal form#buscar button.continuar.pendiente:hover{background:#cfd6da;border-color:#cfd6da}
`;

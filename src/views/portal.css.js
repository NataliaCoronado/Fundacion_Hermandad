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
body.portal .mes-g span{color:var(--suave);font-weight:400}
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
`;

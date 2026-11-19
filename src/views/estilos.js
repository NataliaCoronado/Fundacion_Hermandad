'use strict';
module.exports = `
:root{
  --navy:#0b3b4c;--navy-2:#0f4a5e;--teal:#16808b;--teal-t:#127f8c;--teal-2:#0f6d77;
  --bg:#f3f7f8;--sup:#fff;--borde:#dde8eb;--borde-2:#c8d8dd;--muted:#5a6e76;--suave:#8a9ca3;--claro:#e6f3f5;
  --err:#b42318;--err-bg:#fdecea;--ok:#167a45;--ok-bg:#e3f5ea;--pend:#8a5a00;--pend-bg:#fff4d6;--az:#2563b8;--az-bg:#e3eefc;
  --r:14px;--r-s:10px;--sombra:0 1px 2px rgba(11,59,76,.05),0 4px 14px rgba(11,59,76,.06);--sombra-2:0 10px 30px rgba(11,59,76,.12);
  --fs:16px;--ancho:1140px
}
*{box-sizing:border-box}
html{font-size:var(--fs);-webkit-text-size-adjust:100%}
html.tam1{--fs:18px}html.tam2{--fs:20px}
html.contraste{--bg:#fff;--navy:#000;--navy-2:#000;--muted:#111;--suave:#222;--borde:#000;--borde-2:#000;--teal:#004b52;--teal-t:#004b52;--teal-2:#003a40;--claro:#fff}
body{margin:0;background:var(--bg);color:var(--navy);font-family:'Public Sans','Segoe UI',system-ui,-apple-system,sans-serif;line-height:1.5;min-height:100vh;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
h1,h2,h3{color:var(--navy);line-height:1.2;margin:0 0 .5rem;letter-spacing:-.01em}
h1{font-family:'Source Serif 4',Georgia,serif;font-size:2.1rem;font-weight:700}
h2{font-size:1.25rem;font-weight:700}
h3{font-size:1.02rem;font-weight:700}
p{margin:0 0 .75rem}
a{color:var(--teal-t);text-underline-offset:3px}
img{max-width:100%}
hr{border:0;border-top:1px solid var(--borde);margin:20px 0}
.saltar{position:absolute;left:-999px;top:8px;background:var(--navy);color:#fff;padding:10px 16px;border-radius:8px;z-index:50}.saltar:focus{left:8px}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible,[tabindex]:focus-visible{outline:3px solid #f2b705;outline-offset:2px}

.btn,form button[type=submit],button.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1.5px solid var(--teal);background:var(--teal);color:#fff;padding:11px 20px;border-radius:var(--r-s);font:inherit;font-weight:700;font-size:.92rem;line-height:1.2;text-decoration:none;cursor:pointer;transition:background .15s,box-shadow .15s,transform .05s}
.btn svg{width:18px;height:18px;flex:none}
.btn,form button[type=submit]{white-space:nowrap}
.btn:hover,form button[type=submit]:hover{background:var(--teal-2);border-color:var(--teal-2)}
.btn:active,form button[type=submit]:active{transform:translateY(1px)}
.btn.sec,form button.sec{background:#fff;color:var(--navy);border-color:var(--borde-2)}
.btn.sec:hover{background:var(--claro);border-color:var(--teal)}
.btn.grande{padding:15px 26px;font-size:1rem}
.btn.blq{display:flex;width:100%;margin-top:12px}
.btn.chico{padding:7px 12px;font-size:.82rem}
.btn[disabled],.btn.off{opacity:.45;pointer-events:none}
button{font:inherit;cursor:pointer}

label{display:block;font-weight:600;font-size:.86rem;margin:14px 0 6px;color:var(--navy)}
input,select,textarea{font:inherit;font-size:.95rem;padding:11px 14px;border:1.5px solid var(--borde-2);border-radius:var(--r-s);background:#fff;color:var(--navy);width:100%;max-width:100%;transition:border-color .15s,box-shadow .15s}
input:hover,select:hover,textarea:hover{border-color:var(--suave)}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 4px rgba(22,128,139,.15)}
input[type=checkbox],input[type=radio]{width:18px;height:18px;accent-color:var(--teal);padding:0;flex:none}
label input,label select,label textarea{margin-top:6px;font-weight:400}
.check{display:flex!important;gap:10px;align-items:flex-start;font-weight:400!important}
.check input{margin-top:2px}

.aviso{background:var(--claro);border:1px solid #cbe6eb;border-radius:var(--r-s);padding:13px 16px;font-size:.92rem;margin:14px 0;color:var(--navy)}
.aviso.err{background:var(--err-bg);border-color:#f5c2bd;color:var(--err)}
.aviso.okk{background:var(--ok-bg);border-color:#b7e0c6;color:var(--ok)}
.error{color:var(--err)}.ok{color:var(--ok)}
.badge,.etiqueta{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:.74rem;font-weight:700;white-space:nowrap;letter-spacing:.02em}
.badge:before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
.badge.ok,.etiqueta{background:var(--ok-bg);color:var(--ok)}
.badge.pend,.etiqueta.pend{background:var(--pend-bg);color:var(--pend)}
.badge.mal{background:var(--err-bg);color:var(--err)}
.etiqueta{margin-bottom:8px}

.tarjeta{background:var(--sup);border:1px solid var(--borde);border-radius:var(--r);padding:28px;box-shadow:var(--sombra)}
.lead{color:var(--muted);font-size:1.06rem;line-height:1.6;max-width:640px}
.sobre{display:inline-block;color:var(--teal-t);background:var(--claro);font-weight:700;font-size:.72rem;letter-spacing:.08em;margin:0 0 16px;padding:6px 12px;border-radius:999px}
.sec-t{font-size:.72rem;letter-spacing:.08em;color:var(--teal-t);font-weight:700;margin:22px 0 4px;text-transform:uppercase}
.sec-t:first-child{margin-top:0}
.fila{display:flex;gap:16px;padding:12px 0;border-bottom:1px solid var(--borde);font-size:.94rem}
.fila:last-of-type{border-bottom:0}.fila span{width:140px;color:var(--muted);flex:none}.fila b{flex:1;font-weight:600}
.col{max-width:480px;margin:0 auto}.col-c{text-align:center}
.dos{display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start}
details{border-bottom:1px solid var(--borde);padding:14px 0}summary{cursor:pointer;font-weight:700}
.vacio{text-align:center;color:var(--muted);padding:28px 16px;border:1.5px dashed var(--borde-2);border-radius:var(--r);background:#fafcfc}

.tabla-w{overflow-x:auto;border:1px solid var(--borde);border-radius:12px;margin:12px 0 4px;background:#fff}
table{border-collapse:collapse;width:100%;font-size:.89rem}
th{background:#f6f9fa;text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;padding:12px 14px;border-bottom:1px solid var(--borde);white-space:nowrap}
td{padding:12px 14px;border-bottom:1px solid var(--borde);vertical-align:middle}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover{background:#f8fbfc}
td form{display:inline-flex!important;gap:6px;align-items:center;margin:0!important;padding:0!important;background:none!important;border:0!important}
td form select{width:auto;padding:6px 10px;font-size:.84rem}
td form button,td form button[type=submit]{padding:6px 12px;font-size:.8rem;border-radius:8px}

.cab{background:rgba(255,255,255,.96);backdrop-filter:saturate(1.4) blur(8px);display:flex;justify-content:space-between;align-items:center;padding:12px max(20px,calc((100% - var(--ancho))/2));gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--borde)}
header.sup{position:sticky;top:0;z-index:20}
.marca{display:flex;gap:10px;align-items:center;text-decoration:none;color:var(--teal-t);font-weight:700;font-size:.75rem;line-height:1.2}
.logo{height:44px;width:auto;display:block}
.sello{width:40px;height:40px;border-radius:50%;object-fit:contain;background:#fff;flex:none}
.nav{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.nav a{padding:9px 14px;border-radius:999px;color:var(--navy);text-decoration:none;font-weight:600;font-size:.9rem;transition:background .15s}
.nav a:hover{background:var(--bg)}
.nav a.act{background:var(--claro);color:var(--teal-t)}
.nav a.cta{background:var(--teal);color:#fff;margin-left:6px}.nav a.cta:hover{background:var(--teal-2)}
.acc{background:var(--navy);color:#dcebef;font-size:.76rem;font-weight:600;padding:8px max(20px,calc((100% - var(--ancho))/2));display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.acc button{background:rgba(255,255,255,.08);border:0;color:#fff;font:inherit;padding:3px 9px;border-radius:6px;margin-left:2px}
.acc button:hover{background:rgba(255,255,255,.2)}
.acc div{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
main{flex:1;width:100%;max-width:calc(var(--ancho) + 40px);margin:0 auto;padding:40px 20px 72px}
.pie{background:#fff;border-top:1px solid var(--borde);padding:28px max(20px,calc((100% - var(--ancho))/2));display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;font-size:.8rem;color:var(--muted)}
.pie .marca{color:var(--navy);font-size:.72rem}
.pie .sello{width:34px;height:34px}
.encab{margin-bottom:28px}.encab h1{margin-bottom:8px}

.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:56px;align-items:center;margin:8px 0 48px}
.hero h1{font-size:clamp(2.1rem,4vw,3rem);line-height:1.1;margin-bottom:18px}
.hero .acciones{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
.hero-img{position:relative}
.hero-img img{width:100%;height:360px;object-fit:cover;border-radius:20px;box-shadow:var(--sombra-2);display:block}
.hero-img .flot{position:absolute;left:-28px;bottom:-24px;background:#fff;border-radius:var(--r);padding:16px 18px;box-shadow:var(--sombra-2);display:flex;gap:12px;align-items:center;max-width:290px;font-size:.86rem}
.hero-img .flot b{display:block}
.ico-c{flex:none;width:42px;height:42px;border-radius:12px;background:var(--claro);color:var(--teal);display:grid;place-items:center}
.ico-c svg{width:22px;height:22px}
.datos{background:linear-gradient(120deg,var(--navy),var(--navy-2));color:#fff;border-radius:20px;padding:32px 40px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin-bottom:56px}
.datos b{font-family:'Source Serif 4',Georgia,serif;font-size:1.8rem;display:block;line-height:1.1}.datos span{color:#bcd7de;font-size:.85rem}
.titulo-sec{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:18px;flex-wrap:wrap}
.titulo-sec h2{font-family:'Source Serif 4',Georgia,serif;font-size:1.7rem;margin:0}
.titulo-sec p{margin:0;color:var(--muted)}
.pasos3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:56px}
.pasos3>div{background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:24px;box-shadow:var(--sombra)}
.pasos3 .n{width:38px;height:38px;border-radius:50%;background:var(--teal);color:#fff;display:grid;place-items:center;font-weight:800;margin-bottom:14px}
.pasos3 b{display:block;margin-bottom:6px;font-size:1.02rem}.pasos3 p{margin:0;color:var(--muted);font-size:.9rem}
.sedes-mini{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.sedes-mini a{position:relative;display:block;border-radius:12px;overflow:hidden;text-decoration:none;color:#fff;aspect-ratio:4/3;box-shadow:var(--sombra)}
.sedes-mini img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.sedes-mini a:hover img{transform:scale(1.04)}
.sedes-mini span{position:absolute;inset:auto 0 0 0;padding:28px 12px 10px;background:linear-gradient(transparent,rgba(5,30,40,.85));font-weight:700;font-size:.86rem}
.sedes-mini .ilus{object-fit:contain;background:#e8f4f7}

.volver{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-weight:600;font-size:.88rem;text-decoration:none;margin-bottom:20px}
.volver:hover{color:var(--teal-t)}
.barra{display:flex;gap:8px;margin-bottom:32px;counter-reset:p;list-style:none;padding:0}
.barra div{flex:1;font-size:.78rem;color:var(--suave);font-weight:600;display:flex;flex-direction:column;gap:8px}
.barra div:before{content:'';display:block;height:5px;border-radius:5px;background:#dbe7ea}
.barra .hecho{color:var(--muted)}
.barra .hecho:before,.barra .actual:before{background:var(--teal)}.barra .actual{color:var(--navy);font-weight:800}
.paso-t{margin-bottom:24px}.paso-t h1{margin-bottom:6px}.paso-t .lead{margin:0}
.grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}
.opcion{background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:20px;display:flex;flex-direction:column;gap:6px;box-shadow:var(--sombra);transition:box-shadow .2s,transform .2s,border-color .2s}
.opcion:hover{box-shadow:var(--sombra-2);transform:translateY(-2px);border-color:var(--borde-2)}
.opcion h3{margin:4px 0 2px;font-size:1.06rem}.opcion p{margin:0;color:var(--muted);font-size:.87rem}
.opcion .meta{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}
.opcion .meta span{background:var(--bg);border-radius:999px;padding:3px 10px;font-size:.76rem;font-weight:600;color:var(--muted)}
.opcion .btn{margin-top:auto}
.opcion .sp{flex:1;min-height:10px}
.foto{display:block;width:calc(100% + 40px);margin:-20px -20px 10px;height:140px;object-fit:cover;border-radius:var(--r) var(--r) 0 0}
.foto.lat{width:100%;margin:0 0 14px;height:160px;border-radius:12px}
.foto.ilus{object-fit:contain;background:#eaf5f8}
.pestanas{display:inline-flex;gap:4px;background:#e8eff1;padding:4px;border-radius:12px;margin:0 0 24px;flex-wrap:wrap}
.pestanas a{padding:9px 18px;text-decoration:none;color:var(--muted);font-weight:700;font-size:.9rem;border-radius:9px}
.pestanas a:hover{color:var(--navy)}
.pestanas a.act{background:#fff;color:var(--teal-t);box-shadow:0 1px 3px rgba(11,59,76,.12)}
.semana{background:#fff;border:1px solid var(--borde);border-radius:var(--r);padding:16px 20px;box-shadow:var(--sombra);max-width:680px;margin:0 0 28px}
.sem-cab{display:flex;align-items:center;justify-content:space-between;text-align:center}
.sem-cab small{display:block;color:var(--muted);font-size:.8rem}.sem-cab b{font-size:1.05rem}
.flecha{width:40px;height:40px;display:grid;place-items:center;border-radius:50%;font-size:1.5rem;text-decoration:none;color:var(--teal-t);font-weight:700;border:1px solid var(--borde)}
.flecha:hover{background:var(--claro)}.flecha.off{color:#c3d1d5;border-color:transparent}
.sem-dias{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:14px}
.dsem{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;border:2px solid transparent;border-radius:12px;text-decoration:none;color:var(--navy);min-height:68px}
.dsem small{font-size:.72rem;color:var(--muted);font-weight:700}.dsem b{font-size:1.15rem}
.dsem .punto{width:6px;height:6px;border-radius:50%;background:var(--teal);margin-top:4px}
.dsem.sel{background:var(--teal);border-color:var(--teal)}.dsem.sel b,.dsem.sel small{color:#fff}.dsem.sel .punto{background:#fff}
.dsem.off{color:#a9b8bd}.dsem.off b{font-weight:500}
a.dsem:hover:not(.sel){background:var(--claro)}
.dia-t{color:var(--navy);font-size:1.2rem;margin:0 0 16px}
.profs{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:18px}
.prof{background:#fff;border:1px solid var(--borde);border-radius:var(--r);box-shadow:var(--sombra);padding:20px}
.prof-cab{display:flex;gap:14px;align-items:center;padding-bottom:14px;border-bottom:1px solid var(--borde)}
.prof-cab b{display:block;font-size:1rem}.prof-cab small{font-size:.84rem;color:var(--muted)}
.prof-cab .chip{margin-left:auto}
.chip{display:inline-block;background:var(--claro);color:var(--teal-t);font-weight:700;font-size:.74rem;padding:4px 10px;border-radius:999px}
.av{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--teal),var(--navy-2));color:#fff;display:grid;place-items:center;font-weight:800;font-size:.9rem;flex:none}
.prof .lugar{margin:12px 0 0;font-size:.86rem;color:var(--muted);display:flex;gap:6px;align-items:flex-start}
.prof .lugar svg{width:16px;height:16px;flex:none;margin-top:2px;color:var(--teal)}
.prof .lugar b{color:var(--navy)}
.franja{font-size:.72rem;font-weight:800;letter-spacing:.08em;color:var(--suave);margin:16px 0 8px}
.horas{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px}
.horas a{padding:10px 0;text-align:center;border:1.5px solid var(--borde-2);border-radius:10px;color:var(--navy);font-weight:700;text-decoration:none;font-size:.92rem;background:#fff;transition:all .15s}
.horas a:hover{background:var(--teal);border-color:var(--teal);color:#fff}
.resumen-r{display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start}
.exito{display:flex;gap:16px;align-items:center;margin-bottom:28px}
.exito .ico-c{width:56px;height:56px;border-radius:50%;background:var(--ok-bg);color:var(--ok)}
.exito .ico-c svg{width:28px;height:28px}
.exito h1{margin:0 0 4px}.exito p{margin:0}

body.pers{flex-direction:row;background:#f1f5f6}
.side{width:248px;flex:none;align-self:flex-start;background:linear-gradient(180deg,var(--navy) 0%,#082e3c 100%);color:#c9dde3;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
.side-marca{display:flex;align-items:center;gap:10px;padding:20px 20px 18px;color:#fff;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.08)}
.side-marca img{width:38px;height:38px;border-radius:50%;background:#fff;padding:2px}
.side-marca b{display:block;font-size:.82rem;line-height:1.2}.side-marca small{font-size:.68rem;color:#9fc0c9;font-weight:600}
.side nav{padding:10px 12px 16px;flex:1}
.side h3{font-size:.66rem;letter-spacing:.1em;color:#7fa3ad;margin:18px 10px 6px;font-weight:700}
.side a{display:flex;align-items:center;gap:12px;padding:8px 12px;border-radius:10px;text-decoration:none;color:#d3e4e9;font-size:.89rem;font-weight:500;margin-bottom:2px;transition:background .15s}
.side a svg{width:18px;height:18px;flex:none;opacity:.85}
.side a:hover{background:rgba(255,255,255,.07);color:#fff}
.side a.act{background:var(--teal);color:#fff;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.18)}
.side a.act svg{opacity:1}
.side .pie-s{padding:14px 12px 18px;border-top:1px solid rgba(255,255,255,.08)}
.app{flex:1;min-width:0;display:flex;flex-direction:column;min-height:100vh}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 32px;background:#fff;border-bottom:1px solid var(--borde);position:sticky;top:0;z-index:10;flex-wrap:wrap}
.top h1{font-family:inherit;font-size:1.35rem;margin:0;font-weight:800}
.top .der{display:flex;align-items:center;gap:14px}
.fecha-hoy{display:flex;align-items:center;gap:8px;border:1px solid var(--borde);border-radius:10px;padding:8px 12px;font-size:.84rem;font-weight:600;color:var(--muted)}
.fecha-hoy svg{width:16px;height:16px}
.yo{display:flex;align-items:center;gap:10px;font-size:.85rem}
.yo .av{width:38px;height:38px;font-size:.78rem}
.yo b{display:block;font-size:.86rem}.yo small{color:var(--muted);font-size:.75rem}
.yo form{margin:0}
.yo button{background:none;border:1px solid var(--borde);color:var(--muted);border-radius:10px;padding:8px 12px;font-weight:600;font-size:.82rem}
.yo button:hover{background:var(--bg);color:var(--navy)}
.app main{max-width:none;margin:0;padding:28px 32px 56px}
.cont{background:#fff;border:1px solid var(--borde);border-radius:16px;padding:28px;box-shadow:var(--sombra);min-width:0}
.cont>p,.cont .nota{color:var(--muted);max-width:820px}
.cont h2{margin:32px 0 12px;font-size:1.1rem}
.cont h2:first-child{margin-top:0}
.cont form:not([style]):not(.inl){display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 18px;align-items:end;margin:8px 0 24px;padding:20px;background:#f7fafb;border:1px solid var(--borde);border-radius:12px}
.cont form:not([style]):not(.inl) label{margin-top:8px}
.cont form:not([style]):not(.inl) button[type=submit]{grid-column:1/-1;justify-self:start;margin-top:14px}
.cont form label:has(input[type=checkbox]){display:flex;gap:10px;align-items:center;font-weight:500;align-self:center;margin-top:22px}
.cont form label:has(input[type=checkbox]) input{margin:0}
.hola{display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.hola h2{font-size:1.5rem;margin:0 0 4px}.hola p{margin:0;color:var(--muted)}
.rapidas{display:flex;gap:10px;flex-wrap:wrap}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:0 0 22px}
.kpi{background:#fff;border:1px solid var(--borde);border-radius:16px;padding:18px 20px;box-shadow:var(--sombra);display:flex;gap:14px;align-items:center;text-decoration:none;color:var(--navy)}
a.kpi:hover{border-color:var(--teal);box-shadow:var(--sombra-2)}
.kpi .ico-c{width:48px;height:48px;border-radius:14px}
.kpi b{display:block;font-size:1.75rem;line-height:1;font-weight:800}
.kpi span{font-size:.82rem;color:var(--muted)}
.kpi.dest{background:linear-gradient(135deg,var(--teal),var(--teal-2));border-color:transparent;color:#fff}
.kpi.dest span{color:#d5f0f2}.kpi.dest .ico-c{background:rgba(255,255,255,.18);color:#fff}
.kpi.am .ico-c{background:var(--pend-bg);color:#b07800}.kpi.az .ico-c{background:var(--az-bg);color:var(--az)}.kpi.gr .ico-c{background:#eef2f3;color:var(--muted)}
.paneles{display:grid;grid-template-columns:1.4fr 1fr;gap:20px;align-items:start}
.panel{background:#fff;border:1px solid var(--borde);border-radius:16px;padding:22px;box-shadow:var(--sombra);min-width:0}
.panel-t{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px}
.panel-t h2{margin:0;font-size:1.02rem}.panel-t a{font-size:.82rem;font-weight:700;text-decoration:none}
.proximas{list-style:none;margin:0;padding:0}
.proximas li{display:grid;grid-template-columns:70px 1fr auto;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--borde)}
.proximas li:last-child{border:0}
.proximas .hora{text-align:center;background:var(--bg);border-radius:10px;padding:6px 4px;line-height:1.15}
.proximas .hora b{display:block;font-size:.95rem}.proximas .hora small{font-size:.68rem;color:var(--muted);text-transform:uppercase;font-weight:700}
.proximas .q b{display:block;font-size:.92rem}.proximas .q small{color:var(--muted);font-size:.8rem}
.barras{display:flex;flex-direction:column;gap:12px}
.barras .b{display:grid;grid-template-columns:130px 1fr 32px;gap:10px;align-items:center;font-size:.84rem}
.barras .b span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.barras .tr{height:10px;background:#edf3f4;border-radius:999px;overflow:hidden}
.barras .tr i{display:block;height:100%;background:linear-gradient(90deg,var(--teal),#3bb3bd);border-radius:999px}
.barras b{text-align:right}
.tareas{list-style:none;margin:0;padding:0}
.tareas a{display:flex;align-items:center;gap:12px;padding:12px;border-radius:12px;text-decoration:none;color:var(--navy);border:1px solid var(--borde);margin-bottom:8px}
.tareas a:hover{border-color:var(--teal);background:#f7fbfc}
.tareas .ico-c{width:36px;height:36px;border-radius:10px}.tareas .ico-c svg{width:18px;height:18px}
.tareas b{display:block;font-size:.9rem}.tareas small{color:var(--muted);font-size:.78rem}
.tareas .n{margin-left:auto;font-weight:800;font-size:1.1rem}
.actividad{list-style:none;margin:0;padding:0}.actividad li{padding:10px 0;border-bottom:1px solid var(--borde)}.actividad li:last-child{border:0}
.actividad b{display:block;font-size:.88rem}.actividad small{color:var(--muted);font-size:.78rem}
.tres{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.badge.az{background:var(--az-bg);color:var(--az)}
.sub-form{grid-column:1/-1;margin:22px 0 0!important;padding-top:16px;border-top:1px solid var(--borde)}
.sub-form small{display:block;text-transform:none;letter-spacing:0;font-weight:400;color:var(--muted);font-size:.84rem;margin-top:2px}
input[type=file]{padding:8px;background:#fff}
.filtro{display:flex!important;gap:12px;align-items:end;flex-wrap:wrap;margin:0 0 20px!important;padding:0!important;background:none!important;border:0!important}
.filtro label{margin:0;font-size:.8rem}.filtro select,.filtro input{width:auto;min-width:180px}
.filtro .btn{padding:11px 16px}
.filtro .sep{flex:1}
.agg{overflow:auto;border:1px solid var(--borde);border-radius:14px;background:#fff;max-height:72vh}
.agg-g{display:grid;min-width:max-content}
.agg-g>div{border-right:1px solid #e9f0f2;border-bottom:1px solid #e9f0f2;padding:6px;min-height:64px;font-size:.78rem}
.agg-g .cab{position:sticky;top:0;z-index:2;background:#fbfdfd;text-align:center;min-height:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:12px 8px;border-bottom:1px solid var(--borde)}
.agg-g .cab .av{width:36px;height:36px;font-size:.76rem}.agg-g .cab b{font-size:.82rem}.agg-g .cab small{color:var(--muted);font-size:.72rem}
.agg-g .hr{position:sticky;left:0;background:#fbfdfd;color:var(--muted);font-weight:700;text-align:right;z-index:1;padding-top:10px;border-right:1px solid var(--borde)}
.agg-g .esq{position:sticky;left:0;top:0;z-index:3;background:#fbfdfd}
.cel{border-radius:10px;padding:7px 9px;border-left:4px solid;height:100%}
.cel b{display:block;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cel small{font-size:.7rem;opacity:.85}
.cel.ok{background:#e3f5ea;border-color:#2e9e5b;color:#134d2b}.cel.pend{background:#fff4d6;border-color:#e0a800;color:#6b4f00}
.cel.az{background:#e3eefc;border-color:#3a7bd5;color:#173f73}.cel.mal{background:#fdecea;border-color:#d14343;color:#7a1c1c}
.cel.libre{background:#fff;border:1.5px dashed #b9cdd3;color:var(--teal-t);text-decoration:none;display:block;opacity:.8}
.cel.libre:hover{background:var(--claro);opacity:1;border-color:var(--teal)}
.cel.nd{background:repeating-linear-gradient(135deg,#f0f4f5,#f0f4f5 6px,#e6ecee 6px,#e6ecee 12px);border-color:#b9c4c8;color:#6b7b81}
.agg-g .vac{background:#f8fafb}
.leyenda{display:flex;gap:16px;flex-wrap:wrap;font-size:.77rem;color:var(--muted);margin:12px 0 0}
.leyenda i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px}
body.ingreso{flex-direction:row;background:#fff}
.ing-izq{flex:1;background:linear-gradient(150deg,var(--navy),#0c5563 60%,var(--teal));color:#fff;padding:56px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.ing-izq:after{content:'';position:absolute;right:-120px;bottom:-120px;width:380px;height:380px;border-radius:50%;background:rgba(255,255,255,.06)}
.ing-izq h1{color:#fff;font-size:2.4rem;max-width:460px;margin-bottom:14px}
.ing-izq p{color:#cfe5ea;max-width:440px;font-size:1.02rem}
.ing-izq .logo-b{background:#fff;border-radius:14px;padding:10px 14px;display:inline-block}
.ing-izq ul{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:12px}
.ing-izq li{display:flex;gap:10px;align-items:center;color:#e3f1f4;font-size:.92rem}
.ing-izq li svg{width:18px;height:18px;color:#7fd6dd}
.ing-der{width:min(520px,100%);display:flex;align-items:center;justify-content:center;padding:40px}
.ing-caja{width:100%;max-width:380px}
.ing-caja h2{font-size:1.6rem;margin-bottom:6px}
.ing-caja .sub{color:var(--muted);margin-bottom:22px}
.ing-caja .ayuda{font-size:.8rem;color:var(--muted);margin-top:22px;padding:12px 14px;background:var(--bg);border-radius:10px}
.solo{max-width:560px;margin:60px auto}


.sub-p{color:var(--muted);font-size:.84rem;margin:-6px 0 12px}
.col-p{display:grid;gap:20px;min-width:0;align-content:start}
.dos-g{grid-template-columns:1fr 1fr;margin-bottom:20px}
.tres{margin-bottom:4px}
.kpi .dl{display:block;font-size:.74rem;font-weight:700;margin-top:6px}
.kpi .dl.bueno{color:var(--ok)}.kpi .dl.malo{color:var(--err)}.kpi .dl.neutro{color:var(--muted);font-weight:600}
.kpi.dest .dl.bueno,.kpi.dest .dl.malo,.kpi.dest .dl.neutro{color:#e6f6f7}
.graf{margin:0}
.graf svg{width:100%;height:auto;display:block;overflow:visible}
.graf .gl{stroke:#e8eef0;stroke-width:1}
.graf .eje{fill:var(--muted);font-size:11px;font-family:inherit}.graf .eje.flojo{fill:var(--suave);font-size:10px}
.graf .guia{stroke:var(--navy);stroke-width:1;stroke-dasharray:3 3;opacity:0}
.graf .col:hover .guia{opacity:.35}
.graf .hit{fill:transparent;cursor:crosshair}
.graf .fondo-col{fill:transparent}.graf .col:hover .fondo-col{fill:#f2f7f8}
.leyenda-g{list-style:none;display:flex;flex-wrap:wrap;gap:6px 18px;padding:0;margin:10px 0 0;font-size:.8rem;color:var(--muted)}
.leyenda-g li{display:flex;align-items:center;gap:7px}
.leyenda-g i{width:12px;height:12px;border-radius:3px;flex:none}
.l-datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.l-datos li{display:grid;grid-template-columns:12px 1fr;column-gap:8px;align-items:center}
.l-datos b{grid-column:2;color:var(--navy);font-size:1.15rem}.l-datos small{grid-column:2;font-size:.74rem}
.vista-tabla{border:0;padding:6px 0 0;margin-top:6px}
.vista-tabla summary{font-size:.78rem;color:var(--teal-t);font-weight:700;list-style:none}
.vista-tabla summary::-webkit-details-marker{display:none}
.vista-tabla summary:before{content:'▸ '}.vista-tabla[open] summary:before{content:'▾ '}
.bh{display:flex;flex-direction:column;gap:10px}
.bh .b{display:grid;grid-template-columns:minmax(90px,150px) 1fr auto;gap:10px;align-items:center;font-size:.84rem;padding:2px 4px;border-radius:6px}
.bh .b:hover{background:#f4f8f9}
.bh .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bh .tr{height:10px;background:#edf3f4;border-radius:999px;overflow:hidden}
.bh .tr i{display:block;height:100%;border-radius:0 4px 4px 0}
.bh b{text-align:right;min-width:34px;font-variant-numeric:tabular-nums}
.mini-t{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:4px 0 10px}.mini-t~.mini-t{margin-top:20px}
.seg{display:flex;gap:2px;height:22px;border-radius:6px;overflow:hidden;margin:6px 0 4px}
.seg i{display:block;min-width:3px;cursor:default}
.seg i:hover{filter:brightness(.92)}
.datos-l{list-style:none;padding:0;margin:18px 0 0;border-top:1px solid var(--borde)}
.datos-l li{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--borde);font-size:.88rem}
.datos-l span{color:var(--muted)}
.med{display:inline-flex;align-items:center;gap:8px;min-width:130px}
.med .tr{flex:1;height:8px;background:#edf3f4;border-radius:999px;overflow:hidden;min-width:60px}
.med .tr i{display:block;height:100%;border-radius:0 4px 4px 0}
.med b{font-size:.84rem;font-variant-numeric:tabular-nums;min-width:40px;text-align:right}
.suave{color:var(--suave)}
#tip{position:fixed;z-index:100;pointer-events:none;background:#0b2a35;color:#fff;border-radius:10px;padding:9px 12px;font-size:.8rem;line-height:1.45;box-shadow:0 8px 24px rgba(0,0,0,.22);max-width:280px;opacity:0;transition:opacity .08s}
#tip.ver{opacity:1}#tip b{font-weight:700}#tip .tt{display:flex;align-items:center;gap:6px;color:#d7e6ea}#tip .tt b{color:#fff}
#tip i{width:9px;height:9px;border-radius:2px;display:inline-block;flex:none}
.alertas{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.alertas li{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--borde);border-left:4px solid var(--borde-2);border-radius:12px}
.alertas li.pend{border-left-color:#e0a800}.alertas li.mal{border-left-color:#d14343}.alertas li.az{border-left-color:var(--az)}
.alertas .ico-c{width:34px;height:34px;border-radius:10px}.alertas .ico-c svg{width:18px;height:18px}
.alertas li.pend .ico-c{background:var(--pend-bg);color:#b07800}.alertas li.mal .ico-c{background:var(--err-bg);color:var(--err)}.alertas li.az .ico-c{background:var(--az-bg);color:var(--az)}
.alertas .tx{flex:1;min-width:0}.alertas b{display:block;font-size:.88rem}.alertas small{color:var(--muted);font-size:.78rem;display:block}
.alertas a{font-size:.8rem;font-weight:700;text-decoration:none;white-space:nowrap;align-self:center}
.cuenta{font-size:.82rem;color:var(--muted);margin:0 0 4px}
.acc-f{display:inline-flex;gap:6px;align-items:center}
.alerta-t{color:var(--err);font-weight:700}
.filtro input[type=search]{min-width:220px}
.filtro-r{display:flex;flex-wrap:wrap;gap:12px;align-items:end;background:#fff;border:1px solid var(--borde);border-radius:16px;padding:16px 18px;margin:0 0 20px;box-shadow:var(--sombra)}
.filtro-r label{margin:0;font-size:.78rem}.filtro-r input,.filtro-r select{width:auto;min-width:150px;padding:9px 12px}
.rapidos{display:flex;gap:4px;background:#eef3f4;padding:4px;border-radius:12px;flex-wrap:wrap;margin-right:auto}
.rapidos a{padding:8px 12px;border-radius:9px;font-size:.82rem;font-weight:700;color:var(--muted);text-decoration:none}
.rapidos a:hover{color:var(--navy)}.rapidos a.act{background:#fff;color:var(--teal-t);box-shadow:0 1px 3px rgba(11,59,76,.12)}
.descargas{display:flex;gap:10px;flex-wrap:wrap}
.sedes-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}
.sede-c{background:#fff;border:1px solid var(--borde);border-radius:16px;padding:16px;box-shadow:var(--sombra);display:flex;flex-direction:column}
.sede-cab{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px}.sede-cab h3{margin:0;font-size:1.05rem}
.sede-c .dir{display:flex;gap:8px;font-size:.82rem;color:var(--muted);margin:4px 0}.sede-c .dir svg{width:16px;height:16px;flex:none;color:var(--teal);margin-top:2px}
.mini-k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0;padding:12px 0;border-top:1px solid var(--borde);border-bottom:1px solid var(--borde)}
.mini-k b{display:block;font-size:1.1rem;font-variant-numeric:tabular-nums}.mini-k span{font-size:.7rem;color:var(--muted);line-height:1.2;display:block}
.esps{display:flex;flex-wrap:wrap;gap:6px}.esps span{background:var(--bg);border-radius:999px;padding:3px 10px;font-size:.74rem;font-weight:600;color:var(--muted)}
.sede-c .enl{margin:14px 0 0;font-size:.84rem;font-weight:700;margin-top:auto;padding-top:14px}.sede-c .enl a{text-decoration:none}
.sem-nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0 14px}.sem-nav b{margin:0 6px}
.resumen-sem{display:flex;gap:18px;flex-wrap:wrap;font-size:.86rem;margin:0 0 12px;align-items:center}
.resumen-sem i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.c-res{background:#3a7bd5}.c-dis{background:#1baf7a}.c-blo{background:repeating-linear-gradient(135deg,#c3ced2,#c3ced2 3px,#e6ecee 3px,#e6ecee 6px)}
.rejilla{display:grid;grid-template-columns:64px repeat(var(--cols),minmax(110px,1fr));border:1px solid var(--borde);border-radius:14px;overflow:auto;background:#fff}
.rejilla>*{border-right:1px solid #e9f0f2;border-bottom:1px solid #e9f0f2;min-height:54px;padding:5px}
.rejilla .cab-d{background:#fbfdfd;text-align:center;min-height:0;padding:10px 4px;display:flex;flex-direction:column;align-items:center}
.rejilla .cab-d small{font-size:.7rem;color:var(--muted);font-weight:700;text-transform:uppercase}.rejilla .cab-d b{font-size:1.05rem}
.rejilla .cab-d.hoy b{background:var(--teal);color:#fff;border-radius:999px;width:30px;height:30px;display:grid;place-items:center}
.rejilla .hr{font-size:.78rem;font-weight:700;color:var(--muted);text-align:right;padding-top:16px;background:#fbfdfd}
.rejilla .vac{background:#fafcfc}
.rejilla .cl{margin:0!important;padding:5px!important;background:none!important;border-right:1px solid #e9f0f2!important;border-bottom:1px solid #e9f0f2!important;border-radius:0!important;display:block!important}
.rejilla .cl button,.rejilla .cl.res b{all:unset;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;width:100%;height:100%;min-height:42px;border-radius:9px;padding:5px 9px;border-left:4px solid;cursor:pointer;font-size:.78rem}
.rejilla .cl button b{font-size:.8rem}.rejilla .cl button small{font-size:.7rem;opacity:0;transition:opacity .1s}
.rejilla .cl button:hover small,.rejilla .cl button:focus-visible small{opacity:1}
.rejilla .cl button:focus-visible{outline:3px solid #f2b705}
.rejilla .cl.dis button{background:#e3f5ea;border-color:#1baf7a;color:#134d2b}.rejilla .cl.dis button:hover{background:#d2eedd}
.rejilla .cl.blo button{background:repeating-linear-gradient(135deg,#f0f4f5,#f0f4f5 6px,#e6ecee 6px,#e6ecee 12px);border-color:#b9c4c8;color:#56666c}.rejilla .cl.blo button:hover{background:#e3eaec}
.rejilla .cl.res b{background:#e3eefc;border-color:#3a7bd5;color:#173f73;cursor:default;font-weight:700}
.nota{font-size:.8rem;color:var(--muted);margin-top:8px}
.herr{border:1px solid var(--borde);border-radius:12px;padding:0;margin:10px 0;background:#fff}
.herr summary{padding:14px 16px;font-size:.92rem}
.herr[open] summary{border-bottom:1px solid var(--borde)}
.herr form{margin:0!important;border:0!important;border-radius:0 0 12px 12px!important}
.dias-f{border:0;padding:0;margin:8px 0 0;display:flex;gap:12px;flex-wrap:wrap;align-items:center;grid-column:1/-1}
.dias-f legend{font-weight:600;font-size:.86rem;margin-bottom:6px;padding:0}
.dias-f .check{margin:0;font-weight:500!important}
.herr .check{grid-column:1/-1}
.roles-r{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 16px}
.roles-r>div{border:1px solid var(--borde);border-radius:12px;padding:14px;display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center}
.roles-r small{grid-column:1/-1;color:var(--muted);font-size:.8rem}
@media(max-width:1100px){.dos-g{grid-template-columns:1fr}}
@media(max-width:700px){.roles-r{grid-template-columns:1fr}.mini-k{grid-template-columns:repeat(2,1fr)}.rapidos{margin-right:0}}

@media(max-width:1100px){.kpis{grid-template-columns:repeat(2,1fr)}.paneles,.tres{grid-template-columns:1fr}}
@media(max-width:900px){
  .hero,.dos,.resumen-r{grid-template-columns:1fr}.hero{gap:40px}.hero-img .flot{left:12px}
  .datos{grid-template-columns:1fr 1fr;padding:26px}.pasos3{grid-template-columns:1fr}
  body.pers{flex-direction:column}.side{width:100%;height:auto;position:static}.side nav{display:flex;flex-wrap:wrap;gap:4px}.side h3{width:100%}
  .top{padding:14px 18px}.app main{padding:18px}.cont{padding:18px}
  body.ingreso{flex-direction:column}.ing-izq{padding:32px}.ing-izq h1{font-size:1.8rem}
  .profs{grid-template-columns:1fr}.barra div{font-size:0}.barra .actual{font-size:.78rem}
}
@media(max-width:560px){h1{font-size:1.7rem}.kpis{grid-template-columns:1fr}.tarjeta{padding:20px}.fila span{width:110px}}
@media print{.cab,.acc,.pie,.side,.top .der,.btn,button,.volver{display:none!important}body.pers{display:block}.cont{border:0;box-shadow:none}}
`;

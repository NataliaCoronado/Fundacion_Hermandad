'use strict';
const { esc } = require('./util');

const CSS = `<style>
.ag{margin:0 0 32px}
.ag-cab{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 14px}
.ag-cab h2{margin:0;font-size:1.25rem}
.ag-cab small{color:var(--muted);font-size:.82rem}
.ag-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
@media(max-width:1100px){.ag-grid{grid-template-columns:1fr}}
.ag-c{background:#fff;border:1px solid var(--borde);border-radius:8px;padding:16px 18px 14px;box-shadow:var(--sombra);min-width:0}
.ag-c h3{margin:0 0 2px;font-size:1rem}
.ag-c .preg{margin:0 0 12px;color:var(--muted);font-size:.84rem}
.ag-c-cab{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
.ag-seg{display:inline-flex;border:1px solid var(--borde-2);border-radius:6px;overflow:hidden}
.ag-seg button{background:#fff;border:0;border-left:1px solid var(--borde-2);padding:5px 11px;font:inherit;font-size:.8rem;font-weight:600;color:var(--muted);cursor:pointer;min-height:30px}
.ag-seg button:first-child{border-left:0}
.ag-seg button[aria-pressed=true]{background:var(--navy);color:#fff}
.ag svg{display:block;width:100%;height:auto;overflow:visible}
.ag svg text{font-family:inherit;fill:var(--muted);font-size:11px}
.ag svg .lbl{fill:var(--navy);font-size:12px}
.ag svg .val{fill:var(--navy);font-size:11px;font-weight:600}
.ag .hit{cursor:pointer;outline:none;transition:opacity .15s}
.ag .hit:hover,.ag .hit:focus-visible{opacity:.78}
.ag .hit:focus-visible rect,.ag .hit:focus-visible circle{stroke:#f2b705;stroke-width:2}
.ag .hit.sel rect,.ag rect.hit.sel{stroke:var(--navy);stroke-width:2}
.ag .vacio-g{padding:36px 8px;text-align:center;color:var(--muted);font-size:.9rem;border:1px dashed var(--borde-2);border-radius:6px}
.ag-ley{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 0;font-size:.8rem;color:var(--muted)}
.ag-ley span{display:inline-flex;align-items:center;gap:6px}
.ag-ley i{width:10px;height:10px;border-radius:2px;display:inline-block}
.ag-miga{font-size:.84rem;margin:0 0 8px}
.ag-miga button{background:none;border:0;padding:0;color:var(--teal-t);font:inherit;font-weight:600;cursor:pointer;text-decoration:underline}
.ag-tabla{margin-top:16px}
.ag-tabla-cab{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}
.ag-tabla-cab h3{margin:0;font-size:1rem}
.ag-chip{display:inline-flex;align-items:center;gap:8px;background:var(--claro);color:var(--navy);border-radius:6px;padding:4px 6px 4px 10px;font-size:.82rem;font-weight:600}
.ag-chip button{background:none;border:0;color:var(--teal-t);font:inherit;font-weight:700;cursor:pointer;padding:2px 6px}
.ag-acc{display:flex;gap:8px;flex-wrap:wrap}
.ag-pag{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:10px;font-size:.84rem;color:var(--muted)}
.ag-est{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:.8rem}
.ag-est i{width:8px;height:8px;border-radius:50%;display:inline-block}
details.inst{margin:8px 0 20px;border-top:1px solid var(--borde);padding-top:14px}
details.inst>summary{cursor:pointer;font-weight:600;font-size:1.05rem;color:var(--navy);padding:6px 0}
details.inst[open]>summary{margin-bottom:8px}
</style>`;

const SCRIPT = `<script>(function(){
var raiz=document.getElementById('ag');if(!raiz)return;
var D=JSON.parse(document.getElementById('ag-datos').textContent);
var URL_JSON=raiz.dataset.json;
var EST=[['ATE','Atendidas','#2e7a4f'],['CON','Confirmadas','#347d86'],['PEN','Pendientes','#9fcbd0'],['NOA','No asistió','#c0843a'],['CAN','Canceladas','#b9c4c8']];
var NEST={};EST.forEach(function(e){NEST[e[0]]=e});
var DIAS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],DIASL=['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
var MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
var sel=null,drill=null,gran='dia',pag=0,POR=20;
function e(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(x){return x.toLocaleString('es-CL')}
function dow(f){var d=new Date(f+'T12:00:00');return (d.getDay()+6)%7}
function fCorta(f){return +f.slice(8,10)+' '+MES[+f.slice(5,7)-1]}
function lunes(f){var d=new Date(f+'T12:00:00');d.setDate(d.getDate()-dow(f));return d.toISOString().slice(0,10)}
function sumar(f,k){var d=new Date(f+'T12:00:00');d.setDate(d.getDate()+k);return d.toISOString().slice(0,10)}
function sedeN(id){return D.sedes[id]||'Sin lugar'}
function vacio(){return '<div class="vacio-g">No hay información para este período.</div>'}
function sedeFoco(){return D.sede||drill}
function pasa(r){if(!sel)return true;
 if(sel.sid!=null&&r[2]!==sel.sid)return false;if(sel.esp!=null&&r[3]!==sel.esp)return false;
 if(sel.est&&r[5]!==sel.est)return false;if(sel.desde&&(r[0]<sel.desde||r[0]>sel.hasta))return false;
 if(sel.dow!=null&&(dow(r[0])!==sel.dow||r[1].slice(0,2)!==sel.hora))return false;return true}
function elegir(s){sel=s;pag=0;dibujar();var t=document.getElementById('ag-tabla');if(t&&s)t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'})}
function hit(attrs,tip,lbl){return '<g class="hit" tabindex="0" role="button" aria-label="'+e(lbl)+'" data-tip="'+e(tip)+'" '+attrs+'>'}

function ocupacion(){
 var foco=sedeFoco(),g={};
 D.cupos.forEach(function(c){if(foco&&c[0]!==foco)return;var k=foco?c[1]:c[0];g[k]=g[k]||[0,0];g[k][0]+=c[2];g[k][1]+=c[3]});
 var f=Object.keys(g).map(function(k){return{k:k,n:foco?k:sedeN(+k),c:g[k][0],o:g[k][1],p:g[k][0]?Math.round(g[k][1]/g[k][0]*100):0}}).sort(function(a,b){return b.p-a.p||b.c-a.c});
 var miga=drill&&!D.sede?'<p class="ag-miga"><button type="button" data-a="sube">Toda la red</button> / '+e(sedeN(drill))+'</p>':'';
 if(!f.length)return miga+vacio();
 var W=560,L=150,R=110,h=26,H=f.length*h+8,bw=W-L-R;
 var s='<svg viewBox="0 0 '+W+' '+H+'" role="group" aria-label="Ocupación">';
 f.forEach(function(x,i){var y=i*h+4,w=Math.max(2,bw*x.p/100);
  var tip='<b>'+e(x.n)+'</b><br>'+x.p+'% ocupado · '+n(x.o)+' de '+n(x.c)+' horas publicadas';
  var act=foco?'data-a="oc-esp" data-esp="'+e(x.k)+'"':'data-a="oc-sede" data-sid="'+x.k+'"';
  var on=sel&&(foco?sel.esp===x.k&&sel.sid===foco:sel.sid===+x.k&&sel.esp==null&&!sel.est);
  s+=hit(act,tip,x.n+': '+x.p+'% ocupado, '+x.o+' de '+x.c+' horas')+'<rect x="'+L+'" y="'+y+'" width="'+bw+'" height="'+(h-10)+'" rx="2" fill="#eef3f4"/>'+
  '<rect class="'+(on?'sel':'')+'" x="'+L+'" y="'+y+'" width="'+w+'" height="'+(h-10)+'" rx="2" fill="#347d86"/>'+
  '<text class="lbl" x="'+(L-8)+'" y="'+(y+12)+'" text-anchor="end">'+e(x.n.length>22?x.n.slice(0,21)+'…':x.n)+'</text>'+
  '<text class="val" x="'+(L+bw+8)+'" y="'+(y+12)+'">'+x.p+'%</text><text x="'+(L+bw+42)+'" y="'+(y+12)+'">'+n(x.o)+'/'+n(x.c)+' h</text></g>'});
 return miga+s+'</svg>'}

function cubeta(f){return gran==='mes'?f.slice(0,7):gran==='semana'?lunes(f):f}
function etiqueta(k){return gran==='mes'?MES[+k.slice(5,7)-1]+' '+k.slice(2,4):fCorta(k)}
function evolucion(){
 var k=[],f=D.desde;while(f<=D.hasta){var c=cubeta(f);if(k.indexOf(c)<0)k.push(c);f=sumar(f,1)}
 var cur={},prev={};D.reservas.forEach(function(r){var c=cubeta(r[0]);cur[c]=(cur[c]||0)+1});
 var pk=[],pf=D.prevDesde;while(pf<=D.prevHasta){var pc=cubeta(pf);if(pk.indexOf(pc)<0)pk.push(pc);pf=sumar(pf,1)}
 Object.keys(D.previo).forEach(function(d){var c=cubeta(d);prev[c]=(prev[c]||0)+D.previo[d]});
 var tot=D.reservas.length,totP=Object.keys(D.previo).reduce(function(s,d){return s+D.previo[d]},0);
 if(!tot)return vacio();
 var ys=k.map(function(x){return cur[x]||0}),yp=k.map(function(x,i){return pk[i]?prev[pk[i]]||0:null});
 var hayP=totP>0,max=Math.max.apply(null,ys.concat(hayP?yp.filter(function(v){return v!=null}):[]).concat([1]));
 var paso=Math.pow(10,Math.floor(Math.log10(max)));if(max/paso>5)paso*=2;var top=Math.ceil(max/paso)*paso;
 var W=560,H=230,L=40,R=12,T=10,B=28,pw=W-L-R,ph=H-T-B,dx=k.length>1?pw/(k.length-1):0;
 function X(i){return L+(k.length>1?i*dx:pw/2)}function Y(v){return T+ph-ph*v/top}
 var s='<svg viewBox="0 0 '+W+' '+H+'" role="group" aria-label="Evolución de reservas">';
 for(var t=0;t<=top;t+=paso){s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(t)+'" y2="'+Y(t)+'" stroke="#e1e8ea"/><text x="'+(L-6)+'" y="'+(Y(t)+4)+'" text-anchor="end">'+n(t)+'</text>'}
 var cada=Math.ceil(k.length/8);k.forEach(function(x,i){if(i%cada===0||i===k.length-1)s+='<text x="'+X(i)+'" y="'+(H-8)+'" text-anchor="middle">'+e(etiqueta(x))+'</text>'});
 if(hayP)s+='<polyline fill="none" stroke="#9fb3ba" stroke-width="1.5" stroke-dasharray="4 4" points="'+yp.map(function(v,i){return v==null?'':X(i)+','+Y(v)}).filter(Boolean).join(' ')+'"/>';
 s+='<polyline fill="none" stroke="#183b4e" stroke-width="2" points="'+ys.map(function(v,i){return X(i)+','+Y(v)}).join(' ')+'"/>';
 k.forEach(function(x,i){var hasta=gran==='mes'?x+'-31':gran==='semana'?sumar(x,6):x;
  var tip='<b>'+e(etiqueta(x))+(gran==='semana'?' (semana)':'')+'</b><br>'+n(ys[i])+' reservas'+(hayP&&yp[i]!=null?'<br>Período anterior: '+n(yp[i]):'');
  var on=sel&&sel.desde===x;
  s+=hit('data-a="ev" data-k="'+x+'" data-h="'+hasta+'"',tip,etiqueta(x)+': '+ys[i]+' reservas')+'<rect x="'+(X(i)-Math.max(6,dx/2))+'" y="'+T+'" width="'+Math.max(12,dx)+'" height="'+ph+'" fill="transparent"/><circle cx="'+X(i)+'" cy="'+Y(ys[i])+'" r="'+(on?5:3.5)+'" fill="'+(on?'#f2b705':'#183b4e')+'" stroke="#fff" stroke-width="1.5"/></g>'});
 s+='</svg>';
 var dif=hayP?Math.round((tot-totP)/totP*100):null;
 s+='<div class="ag-ley"><span><i style="background:#183b4e"></i>Período actual: '+n(tot)+' reservas</span>'+(hayP?'<span><i style="background:#9fb3ba"></i>Período anterior: '+n(totP)+' ('+(dif>=0?'+':'')+dif+'%)</span>':'<span>Sin reservas en el período anterior para comparar.</span>')+'</div>';
 return s}

function estado(){
 var foco=sedeFoco(),g={};D.reservas.forEach(function(r){if(foco&&r[2]!==foco)return;var k=foco?r[3]:r[2];g[k]=g[k]||{t:0};g[k][r[5]]=(g[k][r[5]]||0)+1;g[k].t++});
 var f=Object.keys(g).map(function(k){return{k:k,n:foco?k:sedeN(+k),v:g[k]}}).sort(function(a,b){return b.v.t-a.v.t});
 if(!f.length)return vacio();
 var max=Math.max.apply(null,f.map(function(x){return x.v.t})),W=560,L=150,R=48,h=26,H=f.length*h+8,bw=W-L-R;
 var s='<svg viewBox="0 0 '+W+' '+H+'" role="group" aria-label="Estado de las reservas">';
 f.forEach(function(x,i){var y=i*h+4,xx=L;
  s+='<text class="lbl" x="'+(L-8)+'" y="'+(y+12)+'" text-anchor="end">'+e(x.n.length>22?x.n.slice(0,21)+'…':x.n)+'</text>';
  EST.forEach(function(es){var v=x.v[es[0]]||0;if(!v)return;var w=bw*v/max;
   var on=sel&&sel.est===es[0]&&(foco?sel.esp===x.k:sel.sid===+x.k);
   s+=hit('data-a="es" data-k="'+e(x.k)+'" data-e="'+es[0]+'"','<b>'+e(x.n)+'</b><br>'+es[1]+': '+n(v)+' ('+Math.round(v/x.v.t*100)+'%)',x.n+', '+es[1]+': '+v)+'<rect class="'+(on?'sel':'')+'" x="'+xx+'" y="'+y+'" width="'+w+'" height="'+(h-10)+'" fill="'+es[2]+'"/></g>';xx+=w});
  s+='<text class="val" x="'+(xx+6)+'" y="'+(y+12)+'">'+n(x.v.t)+'</text>'});
 s+='</svg><div class="ag-ley">'+EST.map(function(es){return '<span><i style="background:'+es[2]+'"></i>'+es[1]+'</span>'}).join('')+'</div>';
 return s}

function calor(){
 var act=D.reservas.filter(function(r){return r[5]!=='CAN'});if(!act.length)return vacio();
 var m={},hs={},ds={0:1,1:1,2:1,3:1,4:1},max=0;
 act.forEach(function(r){var d=dow(r[0]),h=r[1].slice(0,2);hs[h]=1;ds[d]=1;var k=d+'|'+h;m[k]=(m[k]||0)+1;if(m[k]>max)max=m[k]});
 var H=Object.keys(hs).sort(),Dd=Object.keys(ds).map(Number).sort();
 var W=560,L=40,T=18,cw=(W-L)/H.length,ch=26,Ht=T+Dd.length*ch+4;
 var s='<svg viewBox="0 0 '+W+' '+Ht+'" role="group" aria-label="Mapa de calor de la agenda">';
 H.forEach(function(h,i){s+='<text x="'+(L+i*cw+cw/2)+'" y="12" text-anchor="middle">'+h+'</text>'});
 Dd.forEach(function(d,j){var y=T+j*ch;s+='<text class="lbl" x="'+(L-8)+'" y="'+(y+16)+'" text-anchor="end">'+DIAS[d]+'</text>';
  H.forEach(function(h,i){var v=m[d+'|'+h]||0,a=v?.12+.88*v/max:0,on=sel&&sel.dow===d&&sel.hora===h;
   var r='<rect class="'+(on?'sel':'')+'" x="'+(L+i*cw+1)+'" y="'+(y+1)+'" width="'+(cw-2)+'" height="'+(ch-2)+'" rx="2" fill="'+(v?'rgba(52,125,134,'+a.toFixed(2)+')':'#f3f6f7')+'"/>'+(v&&cw>26?'<text x="'+(L+i*cw+cw/2)+'" y="'+(y+17)+'" text-anchor="middle" style="fill:'+(a>.55?'#fff':'#183b4e')+'">'+v+'</text>':'');
   s+=v?hit('data-a="hm" data-d="'+d+'" data-h="'+h+'"','<b>'+DIASL[d]+' '+h+':00</b><br>'+n(v)+' reservas vigentes',DIASL[d]+' '+h+':00: '+v+' reservas')+r+'</g>':r})});
 return s+'</svg><div class="ag-ley"><span>Menos</span>'+[.15,.4,.65,.9].map(function(a){return '<i style="background:rgba(52,125,134,'+a+')"></i>'}).join('')+'<span>Más reservas</span></div>'}

function filas(){return D.reservas.filter(pasa).sort(function(a,b){return a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:1})}
function descripcion(){if(!sel)return '';var p=[];
 if(sel.sid!=null)p.push(sedeN(sel.sid));if(sel.esp!=null)p.push(sel.esp);if(sel.est)p.push(NEST[sel.est][1]);
 if(sel.desde)p.push(sel.desde===sel.hasta?fCorta(sel.desde):fCorta(sel.desde)+' al '+fCorta(sel.hasta>D.hasta?D.hasta:sel.hasta));
 if(sel.dow!=null)p.push(DIASL[sel.dow]+' '+sel.hora+':00');return p.join(' · ')}
function agendaUrl(){var p=new URLSearchParams({vista:'semana',fecha:sel&&sel.desde||D.desde});var s=sel&&sel.sid!=null?sel.sid:sedeFoco();if(s)p.set('sede',s);if(sel&&sel.esp)p.set('esp',sel.esp);return '/admin/agendas?'+p}
function tabla(){var f=filas(),tp=Math.max(1,Math.ceil(f.length/POR));if(pag>=tp)pag=tp-1;var v=f.slice(pag*POR,pag*POR+POR);
 var cab='<div class="ag-tabla-cab"><div><h3>Reservas del período</h3>'+(sel?'<span class="ag-chip">'+e(descripcion())+'<button type="button" data-a="limpia" aria-label="Quitar filtro">×</button></span>':'<span class="preg" style="color:var(--muted);font-size:.84rem">Haz clic en un gráfico para filtrar esta tabla.</span>')+'</div>'+
 '<div class="ag-acc"><a class="btn sec chico" href="'+e(agendaUrl())+'">Abrir en la agenda</a><button type="button" class="btn sec chico" data-a="csv"'+(f.length?'':' disabled')+'>Descargar CSV</button></div></div>';
 if(!f.length)return cab+vacio();
 return cab+'<div class="tabla-w"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Lugar</th><th>Especialidad</th><th>Profesional</th><th>Estado</th></tr></thead><tbody>'+
 v.map(function(r){var es=NEST[r[5]];return '<tr><td>'+e(fCorta(r[0]))+' '+r[0].slice(0,4)+'</td><td>'+e(r[1])+'</td><td>'+e(sedeN(r[2]))+'</td><td>'+e(r[3])+'</td><td>'+e(D.profs[r[4]]||'')+'</td><td><span class="ag-est"><i style="background:'+es[2]+'"></i>'+es[1]+'</span></td></tr>'}).join('')+
 '</tbody></table></div><div class="ag-pag"><span>'+n(pag*POR+1)+'–'+n(Math.min(f.length,pag*POR+POR))+' de '+n(f.length)+'</span><button type="button" class="btn sec chico" data-a="ant"'+(pag?'':' disabled')+'>Anterior</button><button type="button" class="btn sec chico" data-a="sig"'+(pag<tp-1?'':' disabled')+'>Siguiente</button></div>'}
function csv(){var f=filas(),q=function(x){return '"'+String(x).replace(/"/g,'""')+'"'};
 var t=[[ 'Período',D.desde+' a '+D.hasta],['Filtro',descripcion()||'Sin filtro'],[],['Fecha','Hora','Lugar','Especialidad','Profesional','Estado']].concat(f.map(function(r){return [r[0],r[1],sedeN(r[2]),r[3],D.profs[r[4]]||'',NEST[r[5]][1]]}));
 var b=new Blob(['\\ufeff'+t.map(function(r){return r.map(q).join(';')}).join('\\r\\n')],{type:'text/csv;charset=utf-8'});
 var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='reservas-'+D.desde+'-a-'+D.hasta+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},0)}
function pon(id,h){var x=document.getElementById(id);if(x)x.innerHTML=h}
function dibujar(){pon('ag-oc',ocupacion());pon('ag-ev',evolucion());pon('ag-es',estado());pon('ag-hm',calor());pon('ag-tabla',tabla());
 var u=document.getElementById('ag-act');if(u)u.textContent='Actualizado a las '+new Date(D.generado).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
 [].forEach.call(raiz.querySelectorAll('[data-gran]'),function(b){b.setAttribute('aria-pressed',String(b.dataset.gran===gran))})}
function accion(t){var a=t.dataset.a,foco=sedeFoco();
 if(a==='sube'){drill=null;elegir(null)}
 else if(a==='oc-sede'){drill=+t.dataset.sid;elegir({sid:+t.dataset.sid})}
 else if(a==='oc-esp')elegir({sid:foco,esp:t.dataset.esp});
 else if(a==='es')elegir(foco?{sid:foco,esp:t.dataset.k,est:t.dataset.e}:{sid:+t.dataset.k,est:t.dataset.e});
 else if(a==='ev')elegir({desde:t.dataset.k,hasta:t.dataset.h});
 else if(a==='hm')elegir({dow:+t.dataset.d,hora:t.dataset.h});
 else if(a==='limpia'){sel=null;pag=0;dibujar()}
 else if(a==='ant'){pag--;dibujar()}else if(a==='sig'){pag++;dibujar()}
 else if(a==='csv')csv()}
raiz.addEventListener('click',function(ev){var g=ev.target.closest('[data-gran]');if(g){gran=g.dataset.gran;dibujar();return}var t=ev.target.closest('[data-a]');if(t&&raiz.contains(t))accion(t)});
raiz.addEventListener('keydown',function(ev){if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches&&ev.target.matches('g.hit')){ev.preventDefault();accion(ev.target)}});
dibujar();
setInterval(function(){if(document.hidden)return;fetch(URL_JSON,{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j){D=j;dibujar()}}).catch(function(){})},60000);
})();</script>`;

const panel = (datos, consulta) => `${CSS}<section class="ag" id="ag" data-json="/admin/reportes/agenda.json?${esc(consulta)}" aria-labelledby="ag-t">
<div class="ag-cab"><h2 id="ag-t">Actividad de agenda</h2><small id="ag-act" aria-live="polite"></small></div>
<div class="ag-grid">
<article class="ag-c"><h3>Ocupación de horas</h3><p class="preg">¿Qué lugares y especialidades tienen más horas publicadas ocupadas? Elige un lugar para ver sus especialidades.</p><div id="ag-oc"></div></article>
<article class="ag-c"><div class="ag-c-cab"><div><h3>Evolución de reservas</h3><p class="preg">Reservas por fecha de atención, comparadas con el período anterior.</p></div>
<div class="ag-seg" role="group" aria-label="Agrupar por"><button type="button" data-gran="dia" aria-pressed="true">Día</button><button type="button" data-gran="semana" aria-pressed="false">Semana</button><button type="button" data-gran="mes" aria-pressed="false">Mes</button></div></div><div id="ag-ev"></div></article>
<article class="ag-c"><h3>Estado de las reservas</h3><p class="preg">Atendidas, confirmadas, pendientes, ausencias y cancelaciones por lugar.</p><div id="ag-es"></div></article>
<article class="ag-c"><h3>Demanda por día y hora</h3><p class="preg">Reservas vigentes según día de la semana y hora de inicio.</p><div id="ag-hm"></div></article>
</div>
<div class="ag-c ag-tabla" id="ag-tabla" aria-live="polite"></div>
<script type="application/json" id="ag-datos">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>
</section>${SCRIPT}`;

module.exports = { panel };

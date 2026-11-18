"use strict";
module.exports = `<script>(()=>{
 document.addEventListener('submit',e=>{const f=e.target;for(const name of new Set([...f.querySelectorAll('[data-list]')].map(x=>x.dataset.list))){const hidden=f.querySelector('input[name="'+name+'"]');if(hidden)hidden.value=[...f.querySelectorAll('[data-list="'+name+'"]:checked')].map(x=>x.value).join(',');}const ps=f.querySelectorAll('[data-prof]');if(ps.length){
   const elegidos=[...ps].filter(x=>x.checked);
   f.querySelector('[name=prof]').value=elegidos.length===ps.length?'':elegidos.map(x=>x.dataset.prof).join(',')||'ninguno';
 }});
 document.addEventListener('change',e=>{if(e.target.name==='periodo'&&e.target.value!=='rango'){const f=e.target.form;f.querySelector('[name=desde]').value='';f.querySelector('[name=hasta]').value='';}});
 const filtrosAgenda=document.querySelector('[data-filtros-agenda]');
 if(filtrosAgenda){
   const pantallaChica=matchMedia('(max-width:760px)');
   const ajustarFiltros=()=>{filtrosAgenda.open=!pantallaChica.matches;};
   ajustarFiltros();
   pantallaChica.addEventListener('change',ajustarFiltros);
 }
 let previo=null;
 const cerrar=()=>{document.querySelector('.drawer-backdrop')?.remove();document.body.style.overflow='';previo?.focus();};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')cerrar();if(e.key==='Tab'&&document.querySelector('.drawer')){const els=[...document.querySelector('.drawer').querySelectorAll('a,button,input,select,summary')].filter(x=>x.offsetParent!==null);if(!els.length)return;const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 document.addEventListener('click',async e=>{const a=e.target.closest('[data-drawer]');if(a){e.preventDefault();previo=a;try{const r=await fetch(a.href);const doc=new DOMParser().parseFromString(await r.text(),'text/html');const main=doc.querySelector('.workspace');if(!r.ok||!main){location.href=a.href;return;}const bg=document.createElement('div');bg.className='drawer-backdrop';const drawer=document.createElement('section');drawer.className='drawer';drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label','Detalle del cupo o reserva');drawer.innerHTML='<button class="drawer-close" type="button">Cerrar ×</button>';drawer.append(main);bg.append(drawer);document.body.append(bg);document.body.style.overflow='hidden';drawer.querySelector('button').focus();bg.addEventListener('click',ev=>{if(ev.target===bg||ev.target.closest('.drawer-close'))cerrar();});}catch{location.href=a.href;}return;}
 const cat=e.target.closest('[data-category]');if(cat){const chart=cat.closest('[data-chart]');chart.querySelectorAll('[data-category]').forEach(x=>x.style.opacity=x===cat?'1':'.35');const detail=chart.querySelector('.chart-detail');detail.textContent=cat.dataset.category;}
 const png=e.target.closest('[data-png]');if(png){const chart=png.closest('[data-chart]'),svg=chart.querySelector('svg'),copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');const blob=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),im=new Image();im.onload=()=>{const cv=document.createElement('canvas');cv.width=1400;cv.height=900;const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,1400,900);cx.fillStyle='#153e4e';cx.font='bold 28px system-ui';cx.fillText(chart.querySelector('h3').textContent,45,48);cx.font='16px system-ui';cx.fillText(chart.dataset.context||'',45,80);cx.drawImage(im,40,110,1320,690);const link=document.createElement('a');link.download=chart.dataset.chart+'.png';link.href=cv.toDataURL('image/png');link.click();URL.revokeObjectURL(url);};im.src=url;}
 });
})();</script>`;

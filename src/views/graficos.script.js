'use strict';

// Dibuja los gráficos [data-ec] con ECharts (servido desde /vendor/echarts.min.js, sin CDN).
module.exports = `<script src="/vendor/echarts.min.js"></script><script>
(function(){
  if(!window.echarts)return;
  var C={navy:'#0b3b4c',muted:'#5a6e76',suave:'#8a9ca3',grid:'#e6eef0',borde:'#c8d8dd',previo:'#9aabb3'};
  var reducir=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf=new Intl.NumberFormat('es-CL');
  var f=function(v,s){return v==null?'Sin datos':nf.format(v)+(s||'')};
  var punto=function(c){return '<span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:'+c+';margin-right:7px"></span>'};
  var linea=function(c,n,v){return '<div style="display:flex;justify-content:space-between;gap:18px;margin-top:4px">'+'<span>'+punto(c)+n+'</span><b style="font-variant-numeric:tabular-nums">'+v+'</b></div>'};
  function base(el,ancho){
    var chico=ancho<480;
    return {
      animation:!reducir,animationDuration:650,animationEasing:'cubicOut',animationDurationUpdate:300,
      textStyle:{fontFamily:getComputedStyle(el).fontFamily,color:C.muted},
      tooltip:{confine:true,backgroundColor:'#fff',borderColor:C.borde,borderWidth:1,padding:[10,13],
        textStyle:{color:C.navy,fontSize:13,fontFamily:getComputedStyle(el).fontFamily},
        extraCssText:'box-shadow:0 10px 28px rgba(11,59,76,.16);border-radius:10px;min-width:150px'},
      chico:chico
    };
  }
  var ejeX=function(datos,extra){return Object.assign({type:'category',data:datos,axisLine:{lineStyle:{color:C.borde}},axisTick:{show:false},axisLabel:{color:C.muted,fontSize:12,hideOverlap:true,margin:12}},extra||{})};
  var ejeY=function(spec){return {type:'value',min:0,max:spec.max,minInterval:spec.entero?1:undefined,axisLabel:{color:C.muted,fontSize:12,formatter:function(v){return nf.format(v)+(spec.sufijo||'')}},splitLine:{lineStyle:{color:C.grid}},axisLine:{show:false},axisTick:{show:false}}};
  var leyenda=function(s){return {top:0,left:0,icon:'roundRect',itemWidth:14,itemHeight:5,itemGap:18,textStyle:{color:C.muted,fontSize:12.5},data:s.map(function(x){return x.nombre})}};

  function lineas(spec,o){
    var unica=spec.series.length===1;
    o.grid={left:4,right:18,top:unica?14:42,bottom:6,containLabel:true};
    if(!unica)o.legend=leyenda(spec.series);
    o.xAxis=ejeX(spec.ejes,{boundaryGap:false});o.yAxis=ejeY(spec);
    o.tooltip.trigger='axis';o.tooltip.axisPointer={type:'line',lineStyle:{color:C.navy,opacity:.35,type:'dashed'}};
    o.tooltip.formatter=function(ps){
      var h='<div style="font-weight:700;margin-bottom:2px">'+spec.titulos[ps[0].dataIndex]+'</div>';
      ps.forEach(function(p){h+=linea(p.color,p.seriesName,f(p.value,spec.sufijo))});return h};
    o.series=spec.series.map(function(s){
      var r={type:'line',name:s.nombre,data:s.valores,smooth:.2,symbol:'circle',symbolSize:7,showSymbol:spec.ejes.length<=16&&!s.previo,
        lineStyle:{width:s.previo?1.8:2.8,type:(s.trazo||s.previo)?'dashed':'solid',color:s.previo?C.previo:s.color},
        itemStyle:{color:s.previo?C.previo:s.color,borderColor:'#fff',borderWidth:2},
        emphasis:{focus:'series',scale:1.3},z:s.previo?1:3};
      if(unica)r.areaStyle={color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:s.color+'38'},{offset:1,color:s.color+'05'}]}};
      return r});
  }
  function apiladas(spec,o){
    o.grid={left:4,right:10,top:42,bottom:6,containLabel:true};
    o.legend=leyenda(spec.series);o.xAxis=ejeX(spec.ejes);o.yAxis=ejeY({});
    o.tooltip.trigger='axis';o.tooltip.axisPointer={type:'shadow',shadowStyle:{color:'rgba(22,128,139,.07)'}};
    o.tooltip.formatter=function(ps){
      var t=0,h='<div style="font-weight:700;margin-bottom:2px">'+spec.titulos[ps[0].dataIndex]+'</div>';
      ps.forEach(function(p){t+=p.value||0;h+=linea(p.color,p.seriesName,f(p.value))});
      return h+'<div style="border-top:1px solid '+C.grid+';margin-top:7px;padding-top:6px;display:flex;justify-content:space-between"><span>Total</span><b>'+f(t)+'</b></div>'};
    o.series=spec.series.map(function(s,i){
      return {type:'bar',name:s.nombre,stack:'t',data:s.valores,barMaxWidth:30,itemStyle:{color:s.color,borderColor:'#fff',borderWidth:1,borderRadius:i===spec.series.length-1?[4,4,0,0]:0},emphasis:{focus:'series'}}});
  }
  function barras(spec,o){
    var max=spec.max||Math.max.apply(null,spec.filas.map(function(x){return x.n}))||1;
    o.grid={left:4,right:46,top:6,bottom:6,containLabel:true};
    o.xAxis={type:'value',max:max,show:false};
    o.yAxis={type:'category',inverse:true,data:spec.filas.map(function(x){return x.nombre}),axisLine:{show:false},axisTick:{show:false},
      axisLabel:{color:C.navy,fontSize:12.5,width:o.chico?96:150,overflow:'truncate'}};
    o.tooltip.trigger='item';
    o.tooltip.formatter=function(p){var x=spec.filas[p.dataIndex];return '<div style="font-weight:700">'+x.nombre+'</div><div style="margin-top:4px">'+f(x.n,spec.sufijo)+'</div>'+(x.extra?'<div style="color:'+C.muted+';margin-top:2px">'+x.extra+'</div>':'')};
    o.series=[{type:'bar',data:spec.filas.map(function(x){return x.n}),barWidth:14,showBackground:true,backgroundStyle:{color:'#edf3f4',borderRadius:[0,7,7,0]},
      itemStyle:{color:spec.color,borderRadius:[0,7,7,0]},label:{show:true,position:'right',color:C.navy,fontWeight:700,fontSize:12.5,formatter:function(p){return nf.format(p.value)+(spec.sufijo||'')}},
      emphasis:{itemStyle:{opacity:.85}}}];
  }
  function anillo(spec,o){
    o.legend={bottom:0,left:'center',icon:'roundRect',itemWidth:12,itemHeight:12,itemGap:16,textStyle:{color:C.muted,fontSize:12.5},
      formatter:function(n){var p=spec.partes.filter(function(x){return x.nombre===n})[0];return n+'  '+nf.format(p.n)+' · '+Math.round(p.n/spec.total*100)+' %'}};
    o.tooltip.trigger='item';
    o.tooltip.formatter=function(p){return '<div style="font-weight:700">'+p.name+'</div><div style="margin-top:4px">'+nf.format(p.value)+' '+(spec.unidad||'citas')+' · '+Math.round(p.percent)+' %</div>'};
    o.title={text:nf.format(spec.total),subtext:spec.unidad||'citas',left:'center',top:'33%',textStyle:{color:C.navy,fontSize:26,fontWeight:700},subtextStyle:{color:C.muted,fontSize:13}};
    o.series=[{type:'pie',radius:['56%','78%'],center:['50%','43%'],padAngle:2,avoidLabelOverlap:true,label:{show:false},
      itemStyle:{borderRadius:6,borderColor:'#fff',borderWidth:2},emphasis:{scaleSize:6},
      data:spec.partes.map(function(p){return {name:p.nombre,value:p.n,itemStyle:{color:p.color}}})}];
  }
  function calor(spec,o){
    o.grid={left:4,right:12,top:8,bottom:56,containLabel:true};
    o.xAxis={type:'category',data:spec.x,splitArea:{show:false},axisLine:{show:false},axisTick:{show:false},axisLabel:{color:C.muted,fontSize:12}};
    o.yAxis={type:'category',data:spec.y,inverse:true,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:C.navy,fontSize:12.5}};
    o.visualMap={min:0,max:spec.max,calculable:false,orient:'horizontal',left:'center',bottom:0,itemWidth:12,itemHeight:150,text:['Más '+spec.unidad,'Menos'],
      textStyle:{color:C.muted,fontSize:12},inRange:{color:['#eef6f7','#a9d6db','#3f9ca6','#16808b','#0b3b4c']}};
    o.tooltip.trigger='item';
    o.tooltip.formatter=function(p){return '<div style="font-weight:700">'+spec.y[p.value[1]]+' · '+spec.x[p.value[0]]+'</div><div style="margin-top:4px">'+nf.format(p.value[2])+' '+spec.unidad+'</div>'};
    o.series=[{type:'heatmap',data:spec.datos.map(function(d){return {value:d,label:{color:d[2]>spec.max*.45?'#fff':C.navy}}}),itemStyle:{borderColor:'#fff',borderWidth:2,borderRadius:4},
      label:{show:!o.chico,color:C.navy,fontSize:11.5,formatter:function(p){return p.value[2]?nf.format(p.value[2]):''}},
      emphasis:{itemStyle:{borderColor:C.navy,borderWidth:2}}}];
  }
  var tipos={lineas:lineas,apiladas:apiladas,barras:barras,anillo:anillo,calor:calor};

  function dibujar(el){
    if(el.getAttribute('data-ec-listo'))return;
    var spec;try{spec=JSON.parse(el.getAttribute('data-ec'))}catch(e){return}
    var armar=tipos[spec.tipo];if(!armar)return;
    el.setAttribute('data-ec-listo','1');
    var grafico=echarts.init(el,null,{renderer:'svg'});
    var pintar=function(){var o=base(el,el.clientWidth);armar(spec,o);delete o.chico;grafico.setOption(o,true)};
    pintar();
    var ancho=el.clientWidth;
    if(window.ResizeObserver)new ResizeObserver(function(){
      grafico.resize();
      if(Math.abs(el.clientWidth-ancho)>40&&(el.clientWidth<480)!==(ancho<480)){ancho=el.clientWidth;pintar()}else ancho=el.clientWidth;
    }).observe(el);
  }
  function todos(raiz){(raiz.querySelectorAll?raiz.querySelectorAll('[data-ec]'):[]).forEach(dibujar)}
  todos(document);
  new MutationObserver(function(ms){ms.forEach(function(m){
    m.removedNodes.forEach(function(n){if(n.querySelectorAll)n.querySelectorAll('[data-ec-listo]').forEach(function(e){var i=echarts.getInstanceByDom(e);if(i)i.dispose()})});
    m.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.hasAttribute&&n.hasAttribute('data-ec'))dibujar(n);else todos(n)}})})}).observe(document.body,{childList:true,subtree:true});
})();
</script>`;

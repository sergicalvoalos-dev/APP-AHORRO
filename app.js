
(function(){
  /* ---------- datos de ejemplo ---------- */
  /* Estado guardado del usuario. Empieza vacío: se rellena desde Firebase. */
  function defaultState(){
    return {cfg:{nombreMeta:'Mi reto',meta:0,inicial:0,sueldo:0,
      cats:[{id:'reto',n:'Ahorro para el reto',pct:40,col:1,fijo:true},{id:'inv',n:'Inversión',pct:30,col:2,fijo:true},
        {id:'c3',n:'Gastos fijos',pct:8,col:3},{id:'c4',n:'Ocio y gastos variables',pct:17,col:4},{id:'c5',n:'Colchón de imprevistos',pct:5,col:5}]},
      meses:[],pos:[],seq:10,preciosFecha:null};
  }
  /* Completa un estado cargado con los campos que falten, para que versiones viejas o copias no rompan nada */
  function normalize(x){
    var d=defaultState();
    if(!x||typeof x!=='object')return d;
    var c=x.cfg&&typeof x.cfg==='object'?x.cfg:{};
    var cfg={nombreMeta:typeof c.nombreMeta==='string'?c.nombreMeta:d.cfg.nombreMeta,meta:+c.meta||0,inicial:+c.inicial||0,sueldo:+c.sueldo||0,
      cats:Array.isArray(c.cats)&&c.cats.length?c.cats:d.cfg.cats};
    if(!cfg.cats.some(function(k){return k.id==='reto'}))cfg.cats.unshift(d.cfg.cats[0]);
    if(!cfg.cats.some(function(k){return k.id==='inv'}))cfg.cats.splice(1,0,d.cfg.cats[1]);
    var meses=Array.isArray(x.meses)?x.meses.map(function(m){
      return {y:+m.y,m:+m.m,base:+m.base||0,dietas:+m.dietas||0,manual:!!m.manual,real:+m.real||0,
        sobrante:+m.sobrante||0,sobDest:m.sobDest||'piso',sobPct:m.sobPct==null?50:+m.sobPct,
        retiro:+m.retiro||0,retDest:m.retDest||'piso',retPct:m.retPct==null?50:+m.retPct,
        extra:+m.extra||0,extraTxt:m.extraTxt||'',extDest:m.extDest||'piso',extPct:m.extPct==null?50:+m.extPct,hecho:true};
    }).filter(function(m){return isFinite(m.y)&&m.m>=0&&m.m<12}):[];
    meses.sort(function(a,b){return (a.y*12+a.m)-(b.y*12+b.m)});
    var pos=Array.isArray(x.pos)?x.pos.map(function(p){
      return {n:String(p.n||'Activo'),isin:p.isin||'',precio:+p.precio||0,
        compras:Array.isArray(p.compras)?p.compras.map(function(c){return {f:c.f,imp:+c.imp||0,p:+c.p||0,q:+c.q||0,seq:+c.seq||0,src:c.src==='piso'?'piso':'inv'}}):[],
        ventas:Array.isArray(p.ventas)?p.ventas.map(function(v){return {f:v.f,q:+v.q||0,p:+v.p||0,piso:v.piso!==false,seq:+v.seq||0}}):[]};
    }):[];
    return {cfg:cfg,meses:meses,pos:pos,seq:+x.seq||10,preciosFecha:x.preciosFecha||null};
  }
  var S=defaultState();
  var LIVE={data:null};
  function livePrice(isin){var x=isin&&LIVE.data&&LIVE.data.precios[String(isin).toUpperCase()];return x&&x.precio>0?x:null}
  var MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var MESC=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  /* ---------- utilidades ---------- */
  function nfm(o){try{o.useGrouping='always';return new Intl.NumberFormat('es-ES',o)}catch(e){return new Intl.NumberFormat('es-ES',o)}}
  var nf0=nfm({maximumFractionDigits:0}),nf1=nfm({minimumFractionDigits:1,maximumFractionDigits:1}),nf2=nfm({minimumFractionDigits:2,maximumFractionDigits:2});
  var nf4=nfm({minimumFractionDigits:2,maximumFractionDigits:4});
  function eur(n){return nf0.format(Math.round(n))+' €'}
  function eur2(n){return nf2.format(n)+' €'}
  function pc(n){return nf1.format(n)+' %'}
  function sg(n,f){return (n>0.0001?'+':n<-0.0001?'−':'')+f(Math.abs(n))}
  function idx(m){return m.y*12+m.m}
  function fromIdx(i){return {y:Math.floor(i/12),m:i%12}}
  function lab(m){return MES[m.m]+' '+m.y}
  function $(s){return document.querySelector(s)}
  function escH(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function catBy(id){return S.cfg.cats.filter(function(k){return k.id===id})[0]}
  function pctOf(id){var k=catBy(id);return k?k.pct:0}
  function metaMes(){return S.cfg.sueldo*pctOf('reto')/100}
  function niceR(x){if(x<=0)return 0;var st=Math.pow(10,Math.floor(Math.log10(x)))/2;return Math.max(st,Math.round(x/st)*st)}
  function hitosAuto(meta){var o=[];if(meta<=0)return o;[0.05,0.1,0.25,0.5,0.75].forEach(function(f){var v=niceR(meta*f);if(v>0&&v<meta&&o.indexOf(v)<0)o.push(v)});o.push(meta);return o}
  function num(v){var x=parseFloat(String(v).replace(',','.'));return isFinite(x)?x:0}

  var IC={
    ok:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="var(--good)"/><path d="M4.5 8.3l2.2 2.2 4.8-5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn:'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l7.2 12.6H.8z" fill="var(--warn)"/><path d="M8 6v3.4M8 11.5v.1" stroke="#1b1300" stroke-width="1.6" stroke-linecap="round"/></svg>',
    bad:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="var(--crit)"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };
  var TXT={ok:'Cumplido',bad:'No cumplido'};
  function chip(k){return '<span class="chip">'+IC[k]+'<span>'+TXT[k]+'</span></span>'}

  /* ---------- cálculos ---------- */
  function curIdx(){var n=new Date();return n.getFullYear()*12+n.getMonth()}
  function clampP(p){return Math.min(100,Math.max(0,+p||0))}
  function fP(d,p){return d==='piso'?1:(d==='repartir'?clampP(p)/100:0)}
  function fI(d,p){return d==='inversion'?1:(d==='repartir'?1-clampP(p)/100:0)}
  /* Qué pasa con el dinero de un mes */
  function flujo(m){
    var sp=m.sobrante*fP(m.sobDest,m.sobPct),si=m.sobrante*fI(m.sobDest,m.sobPct),
        rp=m.retiro*fP(m.retDest,m.retPct),ri=m.retiro*fI(m.retDest,m.retPct),
        ex=m.extra||0,ep=ex*fP(m.extDest,m.extPct),ei=ex*fI(m.extDest,m.extPct);
    return {sp:sp,si:si,rp:rp,ri:ri,ep:ep,ei:ei,
      piso:apart(m)+sp+rp+ep,                                   /* suma al ahorro del reto */
      invPrev:(m.base+m.dietas)*pctOf('inv')/100+si+ri+ei,        /* lo que toca invertir */
      gastos:(m.sobrante-sp-si)+(m.retiro-rp-ri)+(ex-ep-ei)};
  }
  function mesDe(f){var t=/^(\d{4})-(\d{2})/.exec(f||'');return t?(+t[1])*12+(+t[2]-1):null}
  function comprasMes(m){var k=idx(m),a=0,b=0;S.pos.forEach(function(p){p.compras.forEach(function(c){if(mesDe(c.f)!==k)return;if(c.src==='piso')b+=c.imp;else a+=c.imp})});return {inv:a,piso:b}}
  function comprasPiso(){var t=0;S.pos.forEach(function(p){p.compras.forEach(function(c){if(c.src==='piso')t+=c.imp})});return t}
  function prevMes(m){return (m.base+m.dietas)*pctOf('reto')/100}
  /* Lo apartado para el reto: se calcula solo con el % del perfil, salvo que marques que no llegaste */
  function apart(m){return m.manual?Math.max(0,+m.real||0):prevMes(m)}
  function estMes(m){var pv=prevMes(m),r=pv>0?apart(m)/pv:1;return {pv:pv,r:r,k:r>=0.995?'ok':'bad'}}
  /* Orden de los apuntes: por fecha y, a igual fecha, por el orden en que los escribiste */
  var SEQ=0;
  function nseq(){return ++SEQ}
  function initSeq(){S.pos.forEach(function(p){p.compras.forEach(function(c){if(!c.seq)c.seq=nseq()});(p.ventas||[]).forEach(function(v){if(!v.seq)v.seq=nseq()})})}

  /* FIFO por etapas: una venta consume primero las compras más antiguas.
     Cuando las acciones llegan a cero se cierra la etapa y la siguiente compra abre otra. */
  function fifo(p){
    var ev=[];
    p.compras.forEach(function(x,k){var q=x.q>0?x.q:x.imp/x.p;ev.push({t:'c',f:x.f,s:x.seq||0,k:k,imp:x.imp,p:x.p,q0:q,src:x.src||'inv'})});
    (p.ventas||[]).forEach(function(v,k){ev.push({t:'v',f:v.f,s:v.seq||0,k:k,q:v.q,p:v.p,piso:v.piso!==false})});
    ev.sort(function(a,b){return a.f<b.f?-1:(a.f>b.f?1:(a.s!==b.s?a.s-b.s:(a.t===b.t?a.k-b.k:(a.t==='c'?-1:1))))});
    var lots=[],cur={cs:[],sales:[]},cycles=[];
    ev.forEach(function(e){
      if(e.t==='c'){var lot={k:e.k,f:e.f,s:e.s,imp:e.imp,p:e.p,q0:e.q0,rem:e.q0,src:e.src};lots.push(lot);cur.cs.push(lot);return}
      var avail=lots.reduce(function(a,l){return a+l.rem},0),q=e.q;
      if(Math.abs(q-avail)<0.0001)q=avail;
      var left=q,cost=0,i,l,t;
      for(i=0;i<lots.length&&left>1e-9;i++){l=lots[i];if(l.rem<=1e-9)continue;t=Math.min(l.rem,left);cost+=l.imp*(t/l.q0);l.rem-=t;left-=t}
      var proceeds=e.q*e.p;
      cur.sales.push({k:e.k,f:e.f,s:e.s,q:e.q,p:e.p,proceeds:proceeds,cost:cost,gain:proceeds-cost,rent:cost>0?(proceeds-cost)/cost:0,piso:e.piso,over:left>1e-6});
      var rest=lots.reduce(function(a,l){return a+l.rem},0);
      if(rest<=1e-9){cycles.push(cur);cur={cs:[],sales:[]};lots=[]}
    });
    return {cycles:cycles,act:cur};
  }
  function minF(cs){var m='';cs.forEach(function(c){if(!m||c.f<m)m=c.f});return m}

  function calc(){
    var c=S.cfg,ms=S.meses,piso=c.inicial,extra=0,retR=0,sob=0,apar=0;
    ms.forEach(function(m){var f=flujo(m);piso+=f.piso;extra+=f.ep;retR+=f.rp;sob+=f.sp;apar+=apart(m)});
    var cpiso=comprasPiso();piso-=cpiso;
    var pos=S.pos.map(function(p,i){
      var f=fifo(p),a=f.act,q=0,inv=0,vp=0,gainA=0;
      a.cs.forEach(function(x){q+=x.rem;inv+=x.imp*(x.rem/x.q0)});
      a.sales.forEach(function(v){gainA+=v.gain;if(v.piso)vp+=v.proceeds});
      var cyc=f.cycles.map(function(cy,k){
        var cost=0,proc=0,gain=0;
        cy.sales.forEach(function(v){cost+=v.cost;proc+=v.proceeds;gain+=v.gain;if(v.piso)vp+=v.proceeds});
        return {k:k,cs:cy.cs,sales:cy.sales,cost:cost,proc:proc,gain:gain,f0:minF(cy.cs),f1:cy.sales.length?cy.sales[cy.sales.length-1].f:''};
      });
      var gainC=cyc.reduce(function(s,x){return s+x.gain},0);
      var lp=livePrice(p.isin),precio=lp?lp.precio:p.precio;
      var val=q*precio;
      return {i:i,n:p.n,isin:p.isin||'',precio:precio,live:lp,manual:p.precio,q:q,inv:inv,val:val,pl:val-inv,rent:inv>0?(val-inv)/inv:0,peso:0,
        cs:a.cs,sales:a.sales,f0:minF(a.cs),medio:q>0?inv/q:0,gainA:gainA,gainC:gainC,gain:gainA+gainC,vp:vp,cyc:cyc,
        activo:q>1e-4,vacio:p.compras.length===0&&(p.ventas||[]).length===0};
    });
    var vpiso=pos.reduce(function(s,p){return s+p.vp},0);
    piso+=vpiso;
    var last=ms.length?ms[ms.length-1]:null,lastI=last?idx(last):curIdx()-1;
    var hechos=ms.filter(function(m){return m.hecho});
    /* Fecha del reto: plan = sueldo base × % del reto. Se recalcula con lo ahorrado de verdad. */
    var Tm=metaMes(),startI=ms.length?idx(ms[0]):curIdx();
    var refI=hechos.length?idx(hechos[hechos.length-1]):startI-1;
    var rest=Math.max(0,c.meta-piso);
    var nRest=Tm>0?Math.ceil(rest/Tm-1e-9):null;
    var finI=rest<=0?refI:(nRest===null?null:refI+nRest);
    var planN=Tm>0?Math.ceil(Math.max(0,c.meta-c.inicial)/Tm-1e-9):null;
    var planI=planN===null?null:startI+planN-1;
    var delta=(finI!==null&&planI!==null)?finI-planI:null;
    var cerr=hechos.length?refI-startI+1:0;
    var esperado=c.inicial+Tm*cerr;
    var cv=pos.reduce(function(s,p){return s+p.val},0),ci=pos.reduce(function(s,p){return s+p.inv},0);
    var realized=pos.reduce(function(s,p){return s+p.gain},0);
    pos.forEach(function(p){p.peso=cv>0?p.val/cv:0});
    var hs=hitosAuto(c.meta);
    return {piso:piso,last:last,lastI:lastI,lastHecho:hechos.length?hechos[hechos.length-1]:null,cpiso:cpiso,
      Tm:Tm,startI:startI,refI:refI,rest:rest,nRest:nRest,finI:finI,planN:planN,planI:planI,delta:delta,cerr:cerr,esperado:esperado,
      extra:extra,retR:retR,sob:sob,aparDif:apar-Tm*cerr,pos:pos,cv:cv,ci:ci,hs:hs,realized:realized,vpiso:vpiso};
  }

  /* ---------- gráfico circular de la cartera ---------- */
  /* Un color por activo, fijo según el activo (no según su tamaño), del 1 al 8. Si hubiera más de 8, el resto va a «Otros». */
  function donutCard(d){
    var act=d.pos.filter(function(p){return p.activo&&p.val>0}).sort(function(a,b){return b.val-a.val});
    var head='<div class="card-head"><h2>Cartera</h2><button class="btn ghost ro-keep" type="button" id="go-cart">Ver cartera</button></div>';
    if(!act.length)return '<section class="card donut-card">'+head+'<p class="hint">Cuando añadas tus activos en Cartera, aquí verás cómo se reparte tu dinero invertido.</p></section>';
    var slices=act.slice(0,act.length>8?7:8).map(function(p){return {n:p.n,v:p.val,col:'var(--s'+((p.i%8)+1)+')'}});
    if(act.length>8){var rest=act.slice(7).reduce(function(s,p){return s+p.val},0);slices.push({n:'Otros',v:rest,col:'var(--line-strong)'})}
    var tot=d.cv,R=70,C=2*Math.PI*R,gap=slices.length>1?2:0,off=0,arcs='';
    slices.forEach(function(x){
      var len=C*x.v/tot,dash=Math.max(0,len-gap);
      arcs+='<circle r="'+R+'" cx="90" cy="90" fill="none" stroke="'+x.col+'" stroke-width="26" stroke-dasharray="'+dash.toFixed(2)+' '+C.toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'"><title>'+escH(x.n)+': '+eur(x.v)+' ('+pc(x.v/tot*100)+')</title></circle>';
      off+=len;
    });
    var pls=d.cv-d.ci,lg='';
    slices.forEach(function(x){lg+='<li><span class="sw" style="background:'+x.col+'"></span><span class="ln">'+escH(x.n)+'</span><span class="p num">'+pc(x.v/tot*100)+'</span></li>'});
    return '<section class="card donut-card">'+head+
      '<div class="donut-wrap"><div class="donut" role="img" aria-label="Reparto de la cartera: '+escH(slices.map(function(x){return x.n+' '+pc(x.v/tot*100)}).join(', '))+'">'+
      '<svg viewBox="0 0 180 180" aria-hidden="true"><g transform="rotate(-90 90 90)">'+arcs+'</g></svg>'+
      '<div class="donut-c"><b class="num">'+eur(tot)+'</b><span class="num '+cl(pls)+'">'+arr(pls)+sg(pls,eur)+' ('+sg(d.ci>0?pls/d.ci*100:0,pc)+')</span></div></div>'+
      '<ul class="legend donut-lg">'+lg+'</ul></div></section>';
  }

  /* ---------- panel ---------- */
  function mesesTxt(n){return n===1?'1 mes':n+' meses'}
  function renderPanel(){
    if(!(S.cfg.meta>0)){
      $('#view-panel').innerHTML='<section class="card welcome"><div class="eyebrow">Primeros pasos</div><h2>Define tu reto</h2>'+
        '<p>Ve a Perfil y pon el nombre del reto, la cantidad que quieres ahorrar, con cuánto empiezas y tu sueldo base. Después, cada final de mes, apunta tus ingresos en Ingresos y tus compras en Cartera.</p>'+
        '<p class="ro-only hint">Estás en modo consulta. Hazlo desde el ordenador.</p>'+
        '<button class="btn ro-hide" type="button" id="go-perfil">Ir a Perfil</button></section>';
      var gp=$('#go-perfil');if(gp)gp.onclick=function(){show('perfil')};
      return;
    }
    var d=calc(),c=S.cfg,prog=c.meta>0?Math.min(1,d.piso/c.meta):0,pr=pctOf('reto');

    var estV='—',estS;
    if(d.rest<=0){estV='Conseguido';estS='Ya tienes el dinero del reto.'}
    else if(d.Tm>0){estV=cap(MESC[fromIdx(d.finI).m])+' '+fromIdx(d.finI).y;estS='Te faltan '+eur(d.rest)+': unos '+mesesTxt(d.nRest)+' ahorrando '+eur(d.Tm)+' al mes (el '+nf0.format(pr)+' % de tu sueldo base).'}
    else estS='Pon un porcentaje en «Ahorro para el reto» en Perfil para calcular la fecha.';

    var dV='—',dC='',dS='';
    if(d.delta!==null){
      if(d.delta>0){dV=mesesTxt(d.delta)+' de retraso';dC='down'}
      else if(d.delta<0){dV=mesesTxt(-d.delta)+' antes';dC='up'}
      else dV='Al día';
      dS='Al empezar ('+lab(fromIdx(d.startI))+') tu plan marcaba '+MESC[fromIdx(d.planI).m]+' '+fromIdx(d.planI).y+'.';
    }else dS='Se calcula cuando tengas un porcentaje para el reto.';

    var mv=[];
    if(Math.abs(d.aparDif)>=0.5)mv.push('lo apartado del sueldo '+sg(d.aparDif,eur));
    if(d.sob>0)mv.push('sobrantes +'+eur(d.sob));
    if(d.extra>0)mv.push('dinero extra +'+eur(d.extra));
    if(d.retR>0)mv.push('retiros de trading +'+eur(d.retR));
    if(d.vpiso>0)mv.push('ventas de la cartera +'+eur(d.vpiso));
    if(d.cpiso>0)mv.push('compras con el ahorro −'+eur(d.cpiso));
    var dif=d.piso-d.esperado;
    var mS=d.cerr>0?(mv.length?cap(mv.join(' · '))+'.':'Has ahorrado justo lo que marcaba el plan.'):'Cierra tu primer mes en Ingresos para comparar con el plan.';

    var hero='<section class="card"><div class="hero-top"><div><div class="eyebrow">'+escH(c.nombreMeta||'Mi reto')+'</div>'+
      '<div class="big num">'+eur(d.piso)+'<span class="of">de '+eur(c.meta)+'</span></div></div><div class="pct num">'+pc(prog*100)+'</div></div>'+
      '<div class="bar" role="img" aria-label="Progreso del reto: '+pc(prog*100)+'"><i style="width:'+(prog*100)+'%"></i></div>'+
      '<dl class="facts"><div><dt>Fecha estimada</dt><dd><span class="v num">'+estV+'</span><span class="s">'+estS+'</span></dd></div>'+
      '<div><dt>Frente a tu plan</dt><dd><span class="v num '+dC+'">'+dV+'</span><span class="s">'+dS+' La fecha se recalcula sola cada mes.</span></dd></div>'+
      '<div><dt>Qué ha movido la fecha</dt><dd><span class="v num '+(d.cerr>0?(dif>=0?'up':'down'):'')+'">'+(d.cerr>0?sg(dif,eur)+' sobre el plan':'—')+'</span><span class="s">'+mS+'</span></dd></div></dl></section>';

    var dk=dirtyKeys(),sm=sugMes(false),pending=!dk.length&&!!sm&&d.lastI<curIdx(),pend='';
    if(dk.length)pend='<section class="card"><div class="sec-head"><div><h2>Cambios sin guardar</h2><p>'+cap(dk.map(function(k){return lab(fromIdx(k))}).join(', '))+(dk.length===1?' tiene':' tienen')+' cambios en Ingresos que no cuentan en el panel hasta que los guardes.</p></div><button class="btn" id="go-dirty">Revisar</button></div></section>';
    else if(pending)pend='<section class="card"><div class="sec-head"><div><h2>'+cap(lab(sm))+' sin registrar</h2><p>Añade el sueldo y las dietas de ese mes para mantener la fecha al día.</p></div><button class="btn" id="go-mes">Registrar mes</button></div></section>';

    var tot=d.piso+d.cv,wp=tot>0?d.piso/tot*100:50;
    var capital='<section class="card"><div class="card-head"><h2>Capital total</h2><span class="hint">Reto e inversión por separado</span></div>'+
      '<div class="big num" style="font-size:38px">'+eur(tot)+'</div>'+
      '<div class="stackbar" role="img" aria-label="Reparto del capital"><i style="width:'+wp+'%;background:var(--s1)"></i><i style="width:'+(100-wp)+'%;background:var(--s2)"></i></div>'+
      '<ul class="legend"><li><span class="sw" style="background:var(--s1)"></span><span>Ahorro del reto</span><span class="p num">'+pc(wp)+'</span><span class="a num">'+eur(d.piso)+'</span></li>'+
      '<li><span class="sw" style="background:var(--s2)"></span><span>Cartera de inversión</span><span class="p num">'+pc(100-wp)+'</span><span class="a num">'+eur(d.cv)+'</span></li></ul>'+
      '<p class="hint" style="margin-top:12px">Para el reto solo cuenta el ahorro. La cartera queda aparte.'+(d.vpiso>0?' El ahorro incluye '+eur(d.vpiso)+' de activos vendidos que pasaron a liquidez.':'')+(d.cpiso>0?' Se han restado '+eur(d.cpiso)+' de compras pagadas con el ahorro del reto.':'')+'</p></section>';

    var cart=donutCard(d);

    $('#view-panel').innerHTML=hero+pend+'<div class="row">'+cart+capital+'</div>';
    if(pending)$('#go-mes').onclick=function(){var t=sugMes(false);closeOpen();var r=addMes(t);show('ingresos');if(!r)$('#nm-msg').textContent=cap(lab(t))+' añadido. Revisa el sueldo y las dietas y pulsa «Guardar».'};
    if(dk.length)$('#go-dirty').onclick=function(){closeOpen();openK=dk[dk.length-1];show('ingresos')};
    $('#go-cart').onclick=function(){show('cartera')};
  }

  /* ---------- ingresos ---------- */
  var DEST=[['piso','Al ahorro del reto'],['inversion','A inversión'],['repartir','Repartir entre reto e inversión'],['gastos','A gastos (no se ahorra)']];
  var TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>';
  var SAVE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/></svg>';
  var MCHEV='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /* D guarda los borradores por mes (clave = índice del mes). El panel solo usa S.meses, lo guardado. */
  var D={},openK=null,delK=null;
  function ymStr(t){return t.y+'-'+String(t.m+1).padStart(2,'0')}
  function cap(s){return s.replace(/^./,function(x){return x.toUpperCase()})}
  function savedBy(k){return S.meses.filter(function(m){return idx(m)===k})[0]||null}
  function clone(o){return JSON.parse(JSON.stringify(o))}
  function isDirty(k){var d=D[k];if(!d)return false;var s=savedBy(k);return !s||JSON.stringify(d)!==JSON.stringify(s)}
  function dirtyKeys(){return Object.keys(D).map(Number).filter(isDirty).sort(function(a,b){return a-b})}
  function sugMes(withDrafts){
    var have={},cur=curIdx();
    S.meses.forEach(function(m){have[idx(m)]=1});
    if(withDrafts)Object.keys(D).forEach(function(k){have[k]=1});
    var keys=Object.keys(have).map(Number).sort(function(a,b){return a-b});
    if(!keys.length)return fromIdx(cur);
    var n=keys[keys.length-1]+1;
    if(n<=cur)return fromIdx(n);
    for(var k=keys[0];k<=cur;k++)if(!have[k])return fromIdx(k);
    return null;
  }
  /* Crea un mes nuevo como borrador y lo abre. Devuelve '' o el motivo por el que no se puede. */
  function addMes(t){
    if(!t)return 'Ya tienes registrados todos los meses hasta el actual.';
    var k=idx(t);
    if(k>curIdx())return 'No puedes añadir un mes que todavía no ha empezado.';
    if(savedBy(k)||D[k])return cap(lab(t))+' ya está en la lista.';
    D[k]={y:t.y,m:t.m,base:S.cfg.sueldo,dietas:0,manual:false,real:0,sobrante:0,sobDest:'piso',sobPct:50,retiro:0,retDest:'piso',retPct:50,extra:0,extraTxt:'',extDest:'piso',extPct:50,hecho:true};
    openK=k;delK=null;
    return '';
  }
  function closeOpen(){
    if(openK!==null&&D[openK]&&savedBy(openK)&&!isDirty(openK))delete D[openK];
    openK=null;delK=null;
  }
  function headTag(k){return !savedBy(k)?'Nuevo · sin guardar':(isDirty(k)?'Sin guardar':'')}

  function mesCard(k){
    var m=D[k]||savedBy(k),open=openK===k,tg=headTag(k);
    var head='<button type="button" class="mes-btn" id="mt-'+k+'" data-mt="'+k+'" aria-expanded="'+open+'" aria-controls="mb-'+k+'">'+MCHEV+
      '<span class="mes-n">'+lab(m)+'</span><i class="tag2" id="mtag-'+k+'"'+(tg?'':' hidden')+'>'+tg+'</i>'+
      (open?'<span class="mes-chip" id="mc-'+k+'"></span>':(savedBy(k)?'<span class="mes-chip">'+chip(estMes(savedBy(k)).k)+'</span>':''))+'</button>';
    if(!open)return '<article class="card mes">'+head+'</article>';
    function fld(id,l,key,v,ph){return '<div class="f"><label for="'+id+'">'+l+'</label><input id="'+id+'" type="number" inputmode="decimal" min="0" step="any" data-mk="'+k+'" data-k="'+key+'" value="'+v+'"'+(ph?' placeholder="'+ph+'"':'')+'></div>'}
    function dsel(id,key,v){var o='';DEST.forEach(function(x){o+='<option value="'+x[0]+'"'+(v===x[0]?' selected':'')+'>'+x[1]+'</option>'});return '<div class="f"><label for="'+id+'">Destino</label><select id="'+id+'" data-mk="'+k+'" data-k="'+key+'">'+o+'</select></div>'}
    function pfld(id,key,v,dest){return '<div class="f" id="w'+id+'"'+(dest==='repartir'?'':' hidden')+'><label for="'+id+'">% al reto (el resto, a inversión)</label><input id="'+id+'" type="number" inputmode="numeric" min="0" max="100" step="1" data-mk="'+k+'" data-k="'+key+'" value="'+v+'"></div>'}
    var isNew=!savedBy(k);
    return '<article class="card mes is-open">'+head+'<div class="mes-body" id="mb-'+k+'">'+
      '<div class="grp"><p class="grp-t">Ingresos</p><div class="fields">'+fld('b'+k,'Sueldo base (€)','base',m.base)+fld('d'+k,'Dietas (€)','dietas',m.dietas)+'</div></div>'+
      '<div class="grp"><p class="grp-t">Ahorro del reto</p><div class="auto"><span>Toca apartar</span><b class="num" id="pv'+k+'"></b><small id="pvs'+k+'"></small></div>'+
      '<label class="chk"><input type="checkbox" id="mn'+k+'" data-mk="'+k+'" data-k="manual"'+(m.manual?' checked':'')+'> No he podido apartarlo todo</label>'+
      '<div class="fields" id="wr'+k+'"'+(m.manual?'':' hidden')+'>'+fld('rl'+k,'Lo que he apartado de verdad (€)','real',m.manual?m.real:'')+'</div></div>'+
      '<div class="grp"><p class="grp-t">Sobrante del mes anterior</p><div class="fields">'+fld('s'+k,'Importe (€)','sobrante',m.sobrante)+dsel('sd'+k,'sobDest',m.sobDest)+pfld('sp'+k,'sobPct',m.sobPct,m.sobDest)+'</div></div>'+
      '<div class="grp"><p class="grp-t">Retiro de trading</p><div class="fields">'+fld('r'+k,'Importe (€)','retiro',m.retiro)+dsel('rd'+k,'retDest',m.retDest)+pfld('rp'+k,'retPct',m.retPct,m.retDest)+'</div></div>'+
      '<div class="grp"><p class="grp-t">Dinero extra (regalos, herencias…)</p><div class="fields">'+fld('e'+k,'Importe (€)','extra',m.extra||0)+
      '<div class="f"><label for="et'+k+'">Concepto</label><input id="et'+k+'" type="text" data-mk="'+k+'" data-k="extraTxt" value="'+escH(m.extraTxt||'')+'" placeholder="Regalo, herencia…"></div>'+
      dsel('ed'+k,'extDest',m.extDest||'piso')+pfld('ep'+k,'extPct',m.extPct==null?50:m.extPct,m.extDest||'piso')+'</div></div>'+
      '<div class="mfoot" id="mf-'+k+'"></div>'+
      '<div class="mact"><button class="btn" type="button" id="ms-'+k+'" data-msave="'+k+'">'+SAVE+'<span>Guardar</span></button>'+
      '<button class="btn ghost" type="button" id="md-'+k+'" data-mdisc="'+k+'">'+(isNew?'Descartar mes':'Descartar cambios')+'</button>'+
      (isNew?'':'<button type="button" class="icon-btn mdel" data-mdel="'+k+'" aria-label="Borrar '+lab(m)+'" title="Borrar mes">'+TRASH+'</button>')+'</div>'+
      (delK===k?'<div class="actions confirm"><span>¿Borrar '+lab(m)+'? Se quita del panel y se pierden sus datos.</span><button class="btn" type="button" data-mdel-yes="'+k+'">Sí, borrar</button><button class="btn ghost" type="button" data-mdel-no="1">No</button></div>':'')+
      '</div></article>';
  }
  function updMes(k){
    var m=D[k];if(!m||!$('#mc-'+k))return;
    var e=estMes(m),f=flujo(m),cm=comprasMes(m);
    $('#mc-'+k).innerHTML=chip(e.k);
    $('#pv'+k).textContent=eur(e.pv);
    $('#pvs'+k).textContent='El '+nf1.format(pctOf('reto'))+' % de '+eur(m.base+m.dietas)+' (sueldo + dietas). Se calcula con tu reparto del Perfil.';
    var ap=apart(m),parts=[];
    if(ap>0)parts.push('apartado '+eur(ap));
    if(f.sp>0)parts.push('sobrante '+eur(f.sp));
    if(f.rp>0)parts.push('retiro '+eur(f.rp));
    if(f.ep>0)parts.push((m.extraTxt?m.extraTxt.toLowerCase():'dinero extra')+' '+eur(f.ep));
    var dif=cm.inv-f.invPrev,invTxt;
    if(Math.abs(dif)<0.5)invTxt=f.invPrev>0?'Has invertido todo lo previsto.':'No había nada previsto para invertir.';
    else if(dif<0)invTxt='Te quedan '+eur(-dif)+' por invertir.';
    else invTxt='Has invertido '+eur(dif)+' más de lo previsto.';
    var ip=['sueldo y dietas '+eur((m.base+m.dietas)*pctOf('inv')/100)];if(f.si>0)ip.push('sobrante '+eur(f.si));if(f.ri>0)ip.push('retiro '+eur(f.ri));if(f.ei>0)ip.push('extra '+eur(f.ei));
    function row(l,v,s){return '<div class="mr"><span>'+l+'</span><b class="num">'+v+'</b>'+(s?'<small>'+s+'</small>':'')+'</div>'}
    var h=(m.manual?row('Apartado de verdad',eur(ap),e.r<0.995?'El '+Math.round(e.r*100)+' % de lo previsto: te faltaron '+eur(e.pv-ap)+', y eso retrasa la fecha estimada.':'Has apartado lo previsto o más.'):'')+
      row('Suma al ahorro del reto',eur(f.piso),parts.length?cap(parts.join(' + ')):'')+
      row('Para invertir',eur(f.invPrev),cap(ip.join(' + ')))+
      row('Invertido según Cartera',eur(cm.inv),invTxt);
    if(cm.piso>0)h+=row('Comprado con el ahorro del reto',eur(cm.piso),'Se resta del ahorro del reto.');
    if(f.gastos>0)h+=row('A gastos',eur(f.gastos),'No se ahorra.');
    $('#mf-'+k).innerHTML=h;
    /* estado de guardado */
    var dirty=isDirty(k),isNew=!savedBy(k),tg=headTag(k),tgEl=$('#mtag-'+k);
    if(tgEl){tgEl.textContent=tg;tgEl.hidden=!tg}
    var sb=$('#ms-'+k);sb.disabled=!dirty;sb.querySelector('span').textContent=dirty?'Guardar':'Guardado';
    $('#md-'+k).disabled=!isNew&&!dirty;
  }
  function renderIngresos(msg,focusId){
    var s=sugMes(true),cur=ymStr(fromIdx(curIdx()));
    var keys={};S.meses.forEach(function(m){keys[idx(m)]=1});Object.keys(D).forEach(function(k){keys[k]=1});
    var list=Object.keys(keys).map(Number).sort(function(a,b){return b-a});
    var h='<div class="sec-head"><div><h2>Ingresos</h2><p>Toca un mes para ver sus datos. Lo que cambies no cuenta en el panel hasta que pulses «Guardar».</p></div>'+
      '<form class="addm" id="f-mes"><div class="f"><label for="nm">Mes</label><input id="nm" type="month" value="'+(s?ymStr(s):cur)+'" max="'+cur+'"></div><button class="btn" type="submit">Añadir mes</button></form></div>'+
      '<p class="ok-msg" id="nm-msg" aria-live="polite">'+(msg||'')+'</p><div class="mes-list" id="meses">';
    if(!list.length)h+='<section class="card"><p class="hint">Todavía no hay ningún mes. Elige el mes arriba y pulsa «Añadir mes».</p></section>';
    list.forEach(function(k){h+=mesCard(k)});
    $('#view-ingresos').innerHTML=h+'</div>';
    if(openK!==null)updMes(openK);
    $('#f-mes').addEventListener('submit',function(e){
      e.preventDefault();
      var v=/^(\d{4})-(\d{2})$/.exec($('#nm').value||'');
      if(!v){$('#nm-msg').textContent='Elige un mes.';return}
      var t={y:+v[1],m:+v[2]-1};closeOpen();var r=addMes(t);
      if(r){renderIngresos(r);return}
      renderIngresos(cap(lab(t))+' añadido. Revisa el sueldo y las dietas y pulsa «Guardar».');
    });
    document.querySelectorAll('[data-mt]').forEach(function(b){b.onclick=function(){
      var k=+b.dataset.mt;
      if(openK===k){closeOpen()}
      else{closeOpen();openK=k;if(!D[k])D[k]=clone(savedBy(k))}
      renderIngresos('','mt-'+k);
    }});
    document.querySelectorAll('[data-msave]').forEach(function(b){b.onclick=function(){
      var k=+b.dataset.msave,m=clone(D[k]),l=lab(m);
      S.meses=S.meses.filter(function(x){return idx(x)!==k});S.meses.push(m);S.meses.sort(function(a,b){return idx(a)-idx(b)});
      delete D[k];openK=null;delK=null;
      renderIngresos(cap(l)+' guardado. El panel ya lo tiene en cuenta.','mt-'+k);
    }});
    document.querySelectorAll('[data-mdisc]').forEach(function(b){b.onclick=function(){
      var k=+b.dataset.mdisc,l=lab(D[k]);
      if(!savedBy(k)){delete D[k];openK=null;renderIngresos(cap(l)+' descartado.');return}
      D[k]=clone(savedBy(k));renderIngresos('Cambios de '+l+' descartados.','mt-'+k);
    }});
    document.querySelectorAll('[data-mdel]').forEach(function(b){b.onclick=function(){delK=+b.dataset.mdel;renderIngresos()}});
    document.querySelectorAll('[data-mdel-no]').forEach(function(b){b.onclick=function(){delK=null;renderIngresos()}});
    document.querySelectorAll('[data-mdel-yes]').forEach(function(b){b.onclick=function(){
      var k=+b.dataset.mdelYes,l=lab(savedBy(k));
      S.meses=S.meses.filter(function(x){return idx(x)!==k});delete D[k];openK=null;delK=null;
      renderIngresos(cap(l)+' borrado.');
    }});
    if(focusId){var f=$('#'+focusId);if(f)f.focus()}
  }

  /* ---------- cartera ---------- */
  function esc(s){return escH(s)}
  function fdate(s){var a=(s||'').split('-');return a.length===3?a[2]+'/'+a[1]+'/'+a[0]:'—'}
  function fshort(s){var a=(s||'').split('-');return a.length===3?a[2]+'/'+a[1]+'/'+a[0].slice(2):'—'}
  var openKey=null,delIdx=null,cpanel=null;
  function arr(n){return n>=0?'▲ ':'▼ '}
  function cl(n){return n>=0?'up':'down'}
  var CHEV='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* Todo lo que se ha vendido de un activo, sumando todas las ventas (parciales o totales, de cualquier etapa) */
  function ventasDe(p){
    var all=[];p.cyc.forEach(function(c){all=all.concat(c.sales)});all=all.concat(p.sales);
    var r={n:all.length,cost:0,proc:0,gain:0,reto:0,f0:'',f1:''};
    all.forEach(function(x){r.cost+=x.cost;r.proc+=x.proceeds;r.gain+=x.gain;if(x.piso)r.reto+=x.proceeds;if(!r.f0||x.f<r.f0)r.f0=x.f;if(!r.f1||x.f>r.f1)r.f1=x.f});
    return r;
  }
  var opsOpen=null;
  /* Lista compacta de todas las compras y ventas de un activo, para corregirlas */
  function opsList(i){
    var p=S.pos[i],items=[];
    p.compras.forEach(function(c,k){items.push({t:'c',k:k,f:c.f,s:c.seq||0,imp:c.imp,p:c.p,q:c.q>0?c.q:c.imp/c.p,src:c.src})});
    (p.ventas||[]).forEach(function(v,k){items.push({t:'v',k:k,f:v.f,s:v.seq||0,imp:v.q*v.p,p:v.p,q:v.q,piso:v.piso!==false})});
    items.sort(function(a,b){return a.f<b.f?1:(a.f>b.f?-1:b.s-a.s)});
    var h='<div class="ops" id="ops-'+i+'"><div class="ops-in"><div class="ops-row ops-head"><span>Operación</span><span>Fecha</span><span>Importe</span><span>Precio</span><span>Acciones</span><span></span></div>';
    items.forEach(function(x){
      var key=x.t+':'+i+':'+x.k;
      if(editKey===key){h+=(x.t==='c'?compraForm(i,x.k):ventaForm(i,x.k));return}
      var tipo=x.t==='c'?'Compra'+(x.src==='piso'?' (con ahorro del reto)':''):'Venta'+(x.piso?'':' (no va al reto)');
      h+='<div class="ops-row"><span>'+tipo+'</span><span>'+fdate(x.f)+'</span><span class="num">'+eur2(x.imp)+'</span><span class="num">'+eur2(x.p)+'</span><span class="num">'+nf4.format(x.q)+'</span>'+itemAct(x.t,i,x.k,x.t==='c'?'esta compra':'esta venta')+'</div>';
    });
    return h+'</div></div>';
  }
  function opsToggle(i){
    var on=opsOpen===i;
    return '<button type="button" class="link-btn ops-tg" data-ops="'+i+'" aria-expanded="'+on+'">'+(on?'Ocultar compras y ventas':'Corregir compras y ventas')+'</button>'+(on?opsList(i):'');
  }

  /* Fila de un activo que tienes ahora: solo lo que sigue en cartera */
  function activeBlock(p){
    var key='a'+p.i,open=openKey===key;
    var cells='<span data-l="Invertido">'+eur(p.inv)+'</span><span data-l="Valor">'+eur(p.val)+'</span>'+
      '<span data-l="Ganancia" class="'+cl(p.pl)+'">'+arr(p.pl)+sg(p.pl,eur)+'</span>'+
      '<span data-l="Rentab." class="'+cl(p.rent)+'">'+sg(p.rent*100,pc)+'</span><span data-l="Peso">'+pc(p.peso*100)+'</span>';
    var h='<div class="pos"><button type="button" class="pos-btn num" id="tg-'+key+'" data-tg="'+key+'" aria-expanded="'+open+'" aria-controls="det-'+key+'">'+
      '<span class="nm">'+CHEV+'<span class="nmt">'+esc(p.n)+'</span></span>'+cells+'</button>';
    if(p.vacio){
      h+='<div class="det" style="padding-top:0">'+(delIdx===p.i?
        '<div class="actions"><span class="hint">¿Quitar '+esc(p.n)+'? No tiene compras ni ventas.</span><button class="btn" type="button" data-del-yes="'+p.i+'">Sí, quitar</button><button class="btn ghost" type="button" data-del-no="1">No</button></div>':
        '<div class="actions"><span class="hint">Todavía sin compras. Añade la primera con «Añadir compra».</span><button class="btn ghost" type="button" data-del="'+p.i+'">Quitar activo</button></div>')+'</div>';
    }
    if(open){
      var lots=p.cs.filter(function(c){return c.rem>1e-9}).sort(function(a,b){return a.f<b.f?1:(a.f>b.f?-1:b.s-a.s)});
      var d='<div class="det" id="det-'+key+'" role="region" aria-label="Detalle de '+esc(p.n)+'"><p class="det-sum">'+
        '<span>Precio medio <b class="num">'+eur2(p.medio)+'</b></span><span>Acciones <b class="num">'+nf4.format(p.q)+'</b></span><span>Precio actual <b class="num">'+eur2(p.precio)+'</b></span>'+
        (p.isin?'<span>ISIN <b>'+esc(p.isin)+'</b></span>':'')+'</p>';
      if(lots.length){
        d+='<div class="lots"><div class="lots-in"><div class="lot-row lot-head"><span>Compra</span><span>Invertido</span><span>Precio</span><span>Acciones</span><span>Valor hoy</span><span>Beneficio</span></div>';
        lots.forEach(function(c){
          var impR=c.imp*(c.rem/c.q0),val=c.rem*p.precio,pl=val-impR;
          d+='<div class="lot-row"><span>'+fdate(c.f)+'</span><span class="num">'+eur2(impR)+'</span><span class="num">'+eur2(c.p)+'</span><span class="num">'+nf4.format(c.rem)+'</span><span class="num">'+eur2(val)+'</span><span class="num '+cl(pl)+'">'+sg(pl,eur2)+'</span></div>';
        });
        d+='</div></div>';
      }
      var vs=ventasDe(p);
      if(vs.n)d+='<p class="hint" style="margin:8px 0 0">Ya has vendido parte de este activo: lo ves en «Ventas».</p>';
      h+=d+opsToggle(p.i)+'</div>';
    }
    return h+'</div>';
  }

  /* Fila de ventas de un activo: todo lo que te ha aportado al venderlo */
  function salesBlock(p,vs){
    var key='s'+p.i,open=openKey===key,rent=vs.cost>0?vs.gain/vs.cost*100:0;
    var h='<div class="pos"><button type="button" class="pos-btn num" id="tg-'+key+'" data-tg="'+key+'" aria-expanded="'+open+'" aria-controls="det-'+key+'">'+
      '<span class="nm">'+CHEV+'<span class="nmt">'+esc(p.n)+'</span></span>'+
      '<span data-l="Coste">'+eur(vs.cost)+'</span><span data-l="Recibido">'+eur(vs.proc)+'</span>'+
      '<span data-l="Resultado" class="'+cl(vs.gain)+'">'+arr(vs.gain)+sg(vs.gain,eur)+'</span>'+
      '<span data-l="Rentab." class="'+cl(vs.gain)+'">'+sg(rent,pc)+'</span><span data-l="Estado">'+(p.activo?'En cartera':'Vendido')+'</span></button>';
    if(open){
      h+='<div class="det" id="det-'+key+'" role="region" aria-label="Ventas de '+esc(p.n)+'"><p class="det-txt">'+
        (vs.n===1?'Una venta, el '+fdate(vs.f0)+'. ':vs.n+' ventas entre el '+fdate(vs.f0)+' y el '+fdate(vs.f1)+'. ')+
        'Recibiste '+eur2(vs.proc)+' por acciones que te costaron '+eur2(vs.cost)+': '+(vs.gain>=0?'ganaste ':'perdiste ')+eur2(Math.abs(vs.gain))+'.'+
        (vs.reto>0?' '+(Math.abs(vs.reto-vs.proc)<0.01?'Todo':eur2(vs.reto)+' de ese dinero')+' pasó al ahorro del reto.':'')+
        (p.activo?' Todavía tienes acciones de este activo en tu cartera.':'')+'</p>'+opsToggle(p.i)+'</div>';
    }
    return h+'</div>';
  }

  /* ---------- editar y borrar compras y ventas ---------- */
  var editKey=null,delKey=null;
  function itemAct(t,i,k,what){
    var key=t+':'+i+':'+k;
    if(delKey===key)return '<div class="cp-act confirm"><span>¿Borrar '+what+'?</span><button class="btn" type="button" data-dyes="'+key+'">Sí, borrar</button><button class="btn ghost" type="button" data-dno="1">No</button></div>';
    return '<div class="cp-act"><button type="button" class="link-btn" data-iedit="'+key+'">Editar</button><button type="button" class="link-btn" data-idel="'+key+'">Borrar</button></div>';
  }
  function compraForm(i,k){
    var x=S.pos[i].compras[k];
    return '<div class="cp cp-edit"><div class="f"><label for="ec-f">Fecha</label><input id="ec-f" type="date" value="'+x.f+'"></div>'+
      '<div class="f"><label for="ec-imp">Dinero invertido (€)</label><input id="ec-imp" type="number" inputmode="decimal" step="any" min="0" value="'+x.imp+'"></div>'+
      '<div class="f"><label for="ec-p">Precio por acción (€)</label><input id="ec-p" type="number" inputmode="decimal" step="any" min="0" value="'+x.p+'"></div>'+
      '<div class="f"><label for="ec-q">Acciones</label><input id="ec-q" type="number" inputmode="decimal" step="any" min="0" value="'+(x.q>0?Math.round(x.q*10000)/10000:'')+'" placeholder="Se calcula sola"></div>'+
      '<div class="f"><label for="ec-src">Pagado con</label><select id="ec-src"><option value="inv"'+(x.src!=='piso'?' selected':'')+'>Dinero para invertir</option><option value="piso"'+(x.src==='piso'?' selected':'')+'>Ahorro del reto (se resta)</option></select></div>'+
      '<div class="cp-act"><button class="btn" type="button" data-isave="c:'+i+':'+k+'">Guardar cambios</button><button class="btn ghost" type="button" data-icancel="1">Cancelar</button></div>'+
      '<p class="ok-msg" id="ie-msg" aria-live="polite"></p></div>';
  }
  function ventaForm(i,k){
    var x=S.pos[i].ventas[k];
    return '<div class="cp cp-edit"><div class="f"><label for="ev-f">Fecha</label><input id="ev-f" type="date" value="'+x.f+'"></div>'+
      '<div class="f"><label for="ev-q">Acciones vendidas</label><input id="ev-q" type="number" inputmode="decimal" step="any" min="0" value="'+Math.round(x.q*10000)/10000+'"></div>'+
      '<div class="f"><label for="ev-p">Precio de venta (€)</label><input id="ev-p" type="number" inputmode="decimal" step="any" min="0" value="'+x.p+'"></div>'+
      '<label class="chk" style="grid-column:1/-1"><input type="checkbox" id="ev-piso"'+(x.piso!==false?' checked':'')+'> El dinero cuenta para el ahorro del reto</label>'+
      '<div class="cp-act"><button class="btn" type="button" data-isave="v:'+i+':'+k+'">Guardar cambios</button><button class="btn ghost" type="button" data-icancel="1">Cancelar</button></div>'+
      '<p class="ok-msg" id="ie-msg" aria-live="polite"></p></div>';
  }
  /* Aplica un cambio y lo deshace si deja ventas imposibles o el ahorro en negativo */
  function tryChange(i,fn){
    var p=S.pos[i],bk={c:clone(p.compras),v:clone(p.ventas||[])};
    fn(p);
    var r=fifo(p),all=[];r.cycles.forEach(function(c){all=all.concat(c.sales)});all=all.concat(r.act.sales);
    var bad=all.filter(function(x){return x.over})[0];
    if(bad){p.compras=bk.c;p.ventas=bk.v;return 'No se puede: la venta del '+fdate(bad.f)+' quedaría con más acciones de las que tenías en esa fecha. Corrige o borra antes esa venta.'}
    if(calc().piso<-0.005){p.compras=bk.c;p.ventas=bk.v;return 'No se puede: el ahorro del reto quedaría en negativo.'}
    return '';
  }
  function bindItems(){
    function parse(key){var a=key.split(':');return {t:a[0],i:+a[1],k:+a[2]}}
    function done(msg){editKey=null;delKey=null;refreshForms();updCartera();$('#cart-msg').textContent=msg}
    document.querySelectorAll('[data-iedit]').forEach(function(b){b.onclick=function(){editKey=b.dataset.iedit;delKey=null;updCartera()}});
    document.querySelectorAll('[data-idel]').forEach(function(b){b.onclick=function(){delKey=b.dataset.idel;editKey=null;updCartera()}});
    document.querySelectorAll('[data-icancel]').forEach(function(b){b.onclick=function(){editKey=null;updCartera()}});
    document.querySelectorAll('[data-dno]').forEach(function(b){b.onclick=function(){delKey=null;updCartera()}});
    document.querySelectorAll('[data-dyes]').forEach(function(b){b.onclick=function(){
      var o=parse(b.dataset.dyes),n=S.pos[o.i].n;
      var err=tryChange(o.i,function(p){if(o.t==='c')p.compras.splice(o.k,1);else p.ventas.splice(o.k,1)});
      if(err){delKey=null;updCartera();$('#cart-msg').textContent=err;return}
      done((o.t==='c'?'Compra':'Venta')+' de '+n+' borrada. La cartera se ha recalculado.');
    }});
    document.querySelectorAll('[data-isave]').forEach(function(b){b.onclick=function(){
      var o=parse(b.dataset.isave),n=S.pos[o.i].n,err;
      if(o.t==='c'){
        var f=$('#ec-f').value,im=num($('#ec-imp').value),pr=num($('#ec-p').value),q=num($('#ec-q').value),src=$('#ec-src').value;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(f)){$('#ie-msg').textContent='Elige una fecha.';return}
        if(im<=0||pr<=0){$('#ie-msg').textContent='El dinero invertido y el precio deben ser mayores que cero.';return}
        if(!(q>0))q=im/pr;
        err=tryChange(o.i,function(p){var old=p.compras[o.k];p.compras[o.k]={f:f,imp:im,p:pr,q:q,seq:old.seq,src:src}});
      }else{
        var vf=$('#ev-f').value,vq=num($('#ev-q').value),vp=num($('#ev-p').value),vpi=$('#ev-piso').checked;
        if(!/^\d{4}-\d{2}-\d{2}$/.test(vf)){$('#ie-msg').textContent='Elige una fecha.';return}
        if(vq<=0||vp<=0){$('#ie-msg').textContent='Las acciones y el precio deben ser mayores que cero.';return}
        err=tryChange(o.i,function(p){var old=p.ventas[o.k];p.ventas[o.k]={f:vf,q:vq,p:vp,piso:vpi,seq:old.seq}});
      }
      if(err){$('#ie-msg').textContent=err;return}
      done((o.t==='c'?'Compra':'Venta')+' de '+n+' actualizada. La cartera se ha recalculado.');
    }});
  }

  function updCartera(focusId){
    var d=calc(),pls=d.cv-d.ci;
    $('#cart-kpi').innerHTML='<div class="card kpi"><div class="l">Invertido</div><div class="v num">'+eur(d.ci)+'</div></div>'+
      '<div class="card kpi"><div class="l">Valor actual</div><div class="v num">'+eur(d.cv)+'</div></div>'+
      '<div class="card kpi"><div class="l">Ganancia o pérdida</div><div class="v num '+cl(pls)+'">'+arr(pls)+sg(pls,eur)+'</div><div class="l num">'+sg(d.ci>0?pls/d.ci*100:0,pc)+'</div></div>'+
      '<div class="card kpi"><div class="l">Ganancia realizada</div><div class="v num '+cl(d.realized)+'">'+arr(d.realized)+sg(d.realized,eur)+'</div><div class="l">Por lo que ya has vendido</div></div>';
    var list='<div class="pos-head"><span>Activo</span><span>Invertido</span><span>Valor</span><span>Ganancia</span><span>Rentab.</span><span>Peso</span></div>',n=0;
    d.pos.forEach(function(p){if(p.activo||p.vacio){list+=activeBlock(p);n++}});
    if(!n)list+='<p class="hint" style="padding:12px 8px">No tienes ninguna posición abierta. Añade una compra para empezar.</p>';
    list+='<div class="pos-tot num"><span>Total</span><span data-l="Invertido">'+eur(d.ci)+'</span><span data-l="Valor">'+eur(d.cv)+'</span>'+
      '<span data-l="Ganancia" class="'+cl(pls)+'">'+sg(pls,eur)+'</span><span data-l="Rentab.">'+sg(d.ci>0?pls/d.ci*100:0,pc)+'</span><span data-l="Peso">100 %</span></div>';
    $('#cart-tbl').innerHTML=list;
    var sv=[];
    d.pos.forEach(function(p){var vs=ventasDe(p);if(vs.n)sv.push({p:p,vs:vs})});
    sv.sort(function(a,b){return a.vs.f1<b.vs.f1?1:(a.vs.f1>b.vs.f1?-1:0)});
    $('#closed-card').hidden=!sv.length;
    if(sv.length){
      var cr='<div class="pos-head"><span>Activo</span><span>Coste</span><span>Recibido</span><span>Resultado</span><span>Rentab.</span><span>Estado</span></div>';
      sv.forEach(function(x){cr+=salesBlock(x.p,x.vs)});
      var tg=sv.reduce(function(s,x){return s+x.vs.gain},0),tp=sv.reduce(function(s,x){return s+x.vs.proc},0),tc=sv.reduce(function(s,x){return s+x.vs.cost},0);
      cr+='<div class="pos-tot num"><span>Total</span><span data-l="Coste">'+eur(tc)+'</span><span data-l="Recibido">'+eur(tp)+'</span><span data-l="Resultado" class="'+cl(tg)+'">'+sg(tg,eur)+'</span><span data-l="Rentab.">'+sg(tc>0?tg/tc*100:0,pc)+'</span><span></span></div>';
      $('#cart-closed').innerHTML=cr;
    }
    if(openKey&&!$('#det-'+openKey))openKey=null;
    document.querySelectorAll('[data-tg]').forEach(function(b){b.onclick=function(){var k=b.dataset.tg;openKey=(openKey===k)?null:k;editKey=null;delKey=null;opsOpen=null;updCartera('tg-'+k)}});
    document.querySelectorAll('[data-ops]').forEach(function(b){b.onclick=function(){var i=+b.dataset.ops;opsOpen=(opsOpen===i)?null:i;editKey=null;delKey=null;updCartera()}});
    bindItems();
    document.querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){delIdx=+b.dataset.del;updCartera()}});
    document.querySelectorAll('[data-del-no]').forEach(function(b){b.onclick=function(){delIdx=null;updCartera()}});
    document.querySelectorAll('[data-del-yes]').forEach(function(b){b.onclick=function(){
      var i=+b.dataset.delYes;S.pos.splice(i,1);openKey=null;delIdx=null;refreshForms();updCartera();
      $('#a-msg').textContent='Activo quitado.';
    }});
    if(focusId){var f=$('#'+focusId);if(f)f.focus()}
  }

  function refreshForms(){
    var d=calc(),pr='',oc='',ov='';
    d.pos.forEach(function(p){
      var sinpos=!p.activo&&!p.vacio;
      oc+='<option value="'+p.i+'">'+esc(p.n)+(sinpos?' (sin posición)':'')+'</option>';
      pr+='<div class="priceRow"><span class="pn">'+esc(p.n)+'</span>'+
        '<input id="pi'+p.i+'" type="text" autocapitalize="characters" spellcheck="false" maxlength="12" data-isin="'+p.i+'" value="'+esc(p.isin)+'" placeholder="ISIN" aria-label="ISIN de '+esc(p.n)+'">'+
        (p.live?'<span class="pl-live num">'+eur2(p.live.precio)+'</span>':'<input id="pp'+p.i+'" type="number" inputmode="decimal" step="0.01" min="0" data-pi="'+p.i+'" value="'+p.manual+'" aria-label="Precio de '+esc(p.n)+'">')+
        '<span class="src" id="ps'+p.i+'">'+srcTxt(p,sinpos)+'</span></div>';
      if(p.activo)ov+='<option value="'+p.i+'">'+esc(p.n)+' ('+nf4.format(p.q)+' acciones)</option>';
    });
    $('#price-list').innerHTML=pr;
    var a=$('#c-act'),v=$('#v-act'),ca=a.value,cv=v.value;
    a.innerHTML=oc;v.innerHTML=ov;
    if(ca&&a.querySelector('option[value="'+ca+'"]'))a.value=ca;
    if(cv&&v.querySelector('option[value="'+cv+'"]'))v.value=cv;
    $('#f-venta').querySelectorAll('input,select,button').forEach(function(x){x.disabled=!ov});
    $('#v-none').hidden=!!ov;
    prevVenta();
  }
  function srcTxt(p,sinpos){
    if(p.live){var f=p.live.fecha?p.live.fecha.split('-').reverse().slice(0,2).join('/'):'';return 'En directo ('+(p.live.mercado?cap(String(p.live.mercado).toLowerCase())+', ':'')+f+')'}
    if(p.isin&&LIVE.data)return 'Este ISIN aún no está en la lista de precios automáticos. Mientras tanto se usa el precio manual.';
    return sinpos?'Sin posición':'Manual';
  }
  function fit(q,p){return Math.abs(q-p.q)<0.0001?p.q:q}
  /* Simula la venta con las reglas reales y devuelve su registro */
  function simSale(i,q,price,date){
    var p=S.pos[i],tmp={compras:p.compras,ventas:(p.ventas||[]).concat([{f:date,q:q,p:price,piso:true,seq:1e9}])},r=fifo(tmp),all=[];
    r.cycles.forEach(function(c){all=all.concat(c.sales)});all=all.concat(r.act.sales);
    return all.filter(function(s){return s.s===1e9})[0];
  }
  function prevVenta(){
    var el=$('#v-prev'),i=$('#v-act').value;
    if(i===''||i===null){el.textContent='';return}
    var d=calc(),p=d.pos[+i];
    if(!p){el.textContent='';return}
    var q=fit(num($('#v-q').value),p),pr=num($('#v-p').value);
    if(q<=0||pr<=0){el.textContent='Escribe cuántas acciones vendes y a qué precio para ver cuánto recibirías.';return}
    if(q>p.q+1e-6){el.textContent='Tienes '+nf4.format(p.q)+' acciones de '+p.n+'. No puedes vender más.';return}
    var v=simSale(+i,q,pr,$('#v-fec').value);
    if(!v||v.over){el.textContent='En esa fecha todavía no tenías tantas acciones de '+p.n+'. Revisa la fecha de la venta.';return}
    el.textContent='Recibirías '+eur2(v.proceeds)+'. Ganancia: '+sg(v.gain,eur2)+' ('+sg(v.rent*100,pc)+'). Se calcula con las compras más antiguas primero.';
  }

  function updPrecioMsg(){
    var el=$('#pb-msg');if(!el)return;
    if(!S.pos.length){el.textContent='Añade tus activos y sus compras abajo. El valor de la cartera sale del precio de cada uno.';return}
    var d=calc(),act=d.pos.filter(function(p){return p.activo}),vivos=act.filter(function(p){return p.live}),sin=act.filter(function(p){return !p.live});
    if(LIVE.data&&vivos.length){
      var h=new Date(LIVE.data.actualizado);
      var txt='Precios en directo de justETF, consultados el '+h.toLocaleDateString('es-ES',{day:'numeric',month:'long'})+' a las '+h.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})+'. Se actualizan solos cada 15 minutos en horario de mercado.';
      if(sin.length)txt+=' Sin precio automático: '+sin.map(function(p){return p.n}).join(', ')+'. Para esos se usa el precio que apuntes abajo.';
      el.textContent=txt;return;
    }
    if(!S.preciosFecha){el.textContent='Apunta el precio actual de cada activo abajo, en «Precio de cada activo».';return}
    var f=new Date(S.preciosFecha);
    el.textContent='Precios apuntados por última vez el '+f.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})+'. Actualízalos abajo con los de Trade Republic.';
  }
  function renderCartera(){
    openKey=null;delIdx=null;editKey=null;delKey=null;opsOpen=null;cpanel=null;
    var today=new Date().toISOString().slice(0,10);
    $('#view-cartera').innerHTML='<div class="sec-head"><div><h2>Cartera</h2><p>Tus activos, lo que valen hoy y lo que te han dado tus ventas.</p></div></div>'+
      '<section class="card pricebar"><div><div class="eyebrow">Precios</div><p class="hint" id="pb-msg"></p></div></section>'+
      '<div class="kpis" id="cart-kpi"></div>'+
      '<div class="cart-actions ro-hide" role="group" aria-label="Acciones de la cartera">'+
        '<button type="button" class="btn ghost" data-cpanel="compra" aria-expanded="false" aria-controls="cp-compra">Añadir compra</button>'+
        '<button type="button" class="btn ghost" data-cpanel="venta" aria-expanded="false" aria-controls="cp-venta">Vender</button>'+
        '<button type="button" class="btn ghost" data-cpanel="activo" aria-expanded="false" aria-controls="cp-activo">Añadir activo</button>'+
        '<button type="button" class="btn ghost" data-cpanel="precios" aria-expanded="false" aria-controls="cp-precios">Precios e ISIN</button>'+
      '</div><div id="cpanels">'+
      '<section class="card cpanel" id="cp-compra" hidden><div class="card-head"><h2>Añadir compra</h2></div><form id="f-compra"><div class="formgrid">'+
      '<div class="f"><label for="c-act">Activo</label><select id="c-act"></select></div>'+
      '<div class="f"><label for="c-fec">Fecha de la compra</label><input id="c-fec" type="date" value="'+today+'"></div>'+
      '<div class="f"><label for="c-imp">Dinero invertido (€)</label><input id="c-imp" type="number" inputmode="decimal" step="any" min="0" placeholder="500"></div>'+
      '<div class="f"><label for="c-p">Precio por acción (€)</label><input id="c-p" type="number" inputmode="decimal" step="any" min="0" placeholder="663,76"></div>'+
      '<div class="f"><label for="c-q">Acciones compradas</label><input id="c-q" type="number" inputmode="decimal" step="any" min="0" placeholder="Se calcula sola"></div>'+
      '<div class="f"><label for="c-src">Pagado con</label><select id="c-src"><option value="inv">Dinero para invertir</option><option value="piso">Ahorro del reto (se resta)</option></select></div>'+
      '</div><p class="hint" style="margin-top:10px">Escribe el dinero que has puesto y el precio al que compraste: las acciones se calculan solas. Si Trade Republic te da otra cifra de acciones, puedes escribirla tú. Si recompras con dinero que tenías en el ahorro del reto (por ejemplo, de una venta), elige «Ahorro del reto» para que no se cuente dos veces.</p>'+
      '<div style="margin-top:12px"><button class="btn" type="submit">Añadir compra</button></div><p class="ok-msg" id="c-msg" aria-live="polite"></p></form></section>'+
      '<section class="card cpanel" id="cp-venta" hidden><div class="card-head"><h2>Vender o liquidar</h2></div><p class="hint" id="v-none" hidden>No tienes ningún activo con acciones para vender.</p>'+
      '<form id="f-venta"><div class="formgrid">'+
      '<div class="f"><label for="v-act">Activo</label><select id="v-act"></select></div>'+
      '<div class="f"><label for="v-fec">Fecha de la venta</label><input id="v-fec" type="date" value="'+today+'"></div>'+
      '<div class="f"><label for="v-q">Acciones vendidas</label><input id="v-q" type="number" inputmode="decimal" step="any" min="0"></div>'+
      '<div class="f"><label for="v-p">Precio de venta (€ por acción)</label><input id="v-p" type="number" inputmode="decimal" step="any" min="0"></div>'+
      '</div><div class="stack" style="gap:8px;margin-top:12px">'+
      '<label class="chk"><input type="checkbox" id="v-all"> Vender todas las acciones</label>'+
      '<label class="chk"><input type="checkbox" id="v-piso" checked> El dinero pasa a liquidez y cuenta para el ahorro del reto</label></div>'+
      '<p class="hint" id="v-prev" style="margin-top:10px" aria-live="polite"></p>'+
      '<div style="margin-top:12px"><button class="btn" type="submit">Registrar venta</button></div><p class="ok-msg" id="v-msg" aria-live="polite"></p></form></section>'+
      '<section class="card cpanel" id="cp-activo" hidden><div class="card-head"><h2>Añadir activo</h2></div><form id="f-activo"><div class="formgrid">'+
      '<div class="f"><label for="a-n">Nombre</label><input id="a-n" type="text" placeholder="Por ejemplo, Bonos europeos"></div>'+
      '<div class="f"><label for="a-isin">ISIN (opcional)</label><input id="a-isin" type="text" placeholder="IE00B5BMR087"></div>'+
      '<div class="f"><label for="a-p">Precio actual (€)</label><input id="a-p" type="number" inputmode="decimal" step="any" min="0"></div>'+
      '</div><div style="margin-top:12px"><button class="btn" type="submit">Añadir activo</button></div><p class="ok-msg" id="a-msg" aria-live="polite"></p></form></section>'+
      '<section class="card cpanel" id="cp-precios" hidden><div class="card-head"><h2>Precios e ISIN</h2></div><div id="price-list"></div>'+
      '<p class="hint" style="margin-top:8px">Con el ISIN, el precio se pone solo si el activo está en la lista de precios automáticos. Si no, escribe el precio por acción que ves en Trade Republic.</p></section></div>'+
      '<section class="card"><div class="card-head"><h2>Activos</h2><span class="hint">Toca uno para ver sus compras</span></div><div id="cart-tbl"></div><p class="ok-msg" id="cart-msg" aria-live="polite"></p></section>'+
      '<section class="card" id="closed-card" hidden><div class="card-head"><h2>Ventas</h2><span class="hint">Lo que te ha aportado cada activo al venderlo</span></div><div id="cart-closed"></div></section>';
    refreshForms();updCartera();
    document.querySelectorAll('[data-cpanel]').forEach(function(b){b.onclick=function(){
      var k=b.dataset.cpanel;cpanel=(cpanel===k)?null:k;
      document.querySelectorAll('[data-cpanel]').forEach(function(x){x.setAttribute('aria-expanded',x.dataset.cpanel===cpanel?'true':'false')});
      document.querySelectorAll('.cpanel').forEach(function(x){x.hidden=x.id!=='cp-'+cpanel});
      if(cpanel){var f=$('#cp-'+cpanel+' input:not([type=hidden]),#cp-'+cpanel+' select');if(f&&f.focus)f.focus()}
    }});

    var qEd=false;
    function autoQ(){if(qEd)return;var im=num($('#c-imp').value),p=num($('#c-p').value);$('#c-q').value=(im>0&&p>0)?String(Math.round(im/p*10000)/10000):''}
    $('#c-imp').addEventListener('input',autoQ);
    $('#c-p').addEventListener('input',autoQ);
    $('#c-q').addEventListener('input',function(){qEd=$('#c-q').value!==''});
    updPrecioMsg();

    $('#f-compra').addEventListener('submit',function(e){
      e.preventDefault();
      var im=num($('#c-imp').value),p=num($('#c-p').value),q=num($('#c-q').value),i=+$('#c-act').value;
      if(im<=0||p<=0){$('#c-msg').textContent='Escribe el dinero invertido y el precio de compra, los dos mayores que cero.';return}
      if(!(q>0))q=im/p;
      var src=$('#c-src').value;
      if(src==='piso'){var disp=calc().piso;if(im>disp+0.005){$('#c-msg').textContent='En el ahorro del reto solo tienes '+eur2(disp)+'. Baja el importe o págalo con el dinero para invertir.';return}}
      S.pos[i].compras.push({f:$('#c-fec').value,imp:im,p:p,q:q,seq:nseq(),src:src});
      ['#c-imp','#c-p','#c-q'].forEach(function(s){$(s).value=''});qEd=false;
      $('#c-msg').textContent='Compra añadida a '+S.pos[i].n+': '+eur2(im)+' a '+eur2(p)+' ('+nf4.format(q)+' acciones).'+(src==='piso'?' Se ha restado del ahorro del reto.':'');$('#c-src').value='inv';
      refreshForms();updCartera();
    });

    function setAll(){
      var i=$('#v-act').value,all=$('#v-all').checked;
      if(i!==''&&all){var p=calc().pos[+i];if(p)$('#v-q').value=String(Math.round(p.q*10000)/10000)}
      $('#v-q').readOnly=all;
      if(i!==''&&!num($('#v-p').value)){var p2=calc().pos[+i];if(p2&&p2.precio>0)$('#v-p').value=p2.precio}
      prevVenta();
    }
    $('#v-act').addEventListener('change',function(){$('#v-p').value='';setAll()});
    $('#v-all').addEventListener('change',setAll);
    $('#v-q').addEventListener('input',prevVenta);
    $('#v-p').addEventListener('input',prevVenta);
    $('#v-fec').addEventListener('change',prevVenta);
    setAll();
    $('#f-venta').addEventListener('submit',function(e){
      e.preventDefault();
      var i=+$('#v-act').value,pr=num($('#v-p').value),p=calc().pos[i];
      if(!p){return}
      var q=fit(num($('#v-q').value),p);
      if(q<=0||pr<=0){$('#v-msg').textContent='Escribe las acciones vendidas y el precio de venta, los dos mayores que cero.';return}
      if(q>p.q+1e-6){$('#v-msg').textContent='Tienes '+nf4.format(p.q)+' acciones de '+p.n+'. No puedes vender más.';return}
      var sim=simSale(i,q,pr,$('#v-fec').value);
      if(!sim||sim.over){$('#v-msg').textContent='En esa fecha todavía no tenías tantas acciones de '+p.n+'. Revisa la fecha de la venta.';return}
      if(!S.pos[i].ventas)S.pos[i].ventas=[];
      var piso=$('#v-piso').checked;
      S.pos[i].ventas.push({f:$('#v-fec').value,q:q,p:pr,piso:piso,seq:nseq()});
      var cerr=!calc().pos[i].activo;
      $('#v-q').value='';$('#v-p').value='';$('#v-all').checked=false;$('#v-q').readOnly=false;
      refreshForms();updCartera();setAll();
      $('#v-msg').textContent='Venta registrada en '+S.pos[i].n+'. '+(cerr?'Se cierra esta etapa y pasa a «Activos cerrados» con su historial. ':'')+(piso?'El dinero suma al ahorro del reto.':'El dinero no se suma al ahorro del reto.');
    });

    $('#f-activo').addEventListener('submit',function(e){
      e.preventDefault();
      var n=$('#a-n').value.trim(),pr=num($('#a-p').value);
      if(!n){$('#a-msg').textContent='Escribe el nombre del activo.';return}
      var isinN=$('#a-isin').value.replace(/\s+/g,'').toUpperCase(),lp=livePrice(isinN);
      if(pr<=0&&lp)pr=lp.precio;
      if(pr<=0){$('#a-msg').textContent='Escribe su precio actual, mayor que cero. Si su ISIN está en la lista de precios automáticos, el precio se pone solo.';return}
      S.pos.push({n:n,isin:isinN,precio:pr,compras:[],ventas:[]});
      ['#a-n','#a-isin','#a-p'].forEach(function(s){$(s).value=''});
      refreshForms();updCartera();
      $('#a-msg').textContent='Activo añadido. Ahora registra su primera compra en «Añadir compra».';
    });
  }

  /* ---------- copia de seguridad ---------- */
  var bkPend=null;
  function hoyStr(){var n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0')}
  function bindBackup(){
    $('#bk-down').onclick=function(){
      S.seq=SEQ;
      var data=JSON.stringify({app:'app-ahorro',version:1,exportado:new Date().toISOString(),datos:S},null,2);
      try{
        var url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');
        a.href=url;a.download='app-ahorro-copia-'+hoyStr()+'.json';document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){URL.revokeObjectURL(url)},1000);
        $('#bk-msg').textContent='Copia descargada.';
      }catch(e){$('#bk-msg').textContent='No se pudo descargar la copia en este navegador.'}
    };
    $('#bk-file').onchange=function(){
      var f=this.files&&this.files[0];this.value='';if(!f)return;
      var rd=new FileReader();
      rd.onload=function(){
        var x;try{x=JSON.parse(rd.result)}catch(e){$('#bk-msg').textContent='Ese archivo no es una copia válida.';return}
        if(!x||x.app!=='app-ahorro'||!x.datos){$('#bk-msg').textContent='Ese archivo no es una copia de esta app.';return}
        bkPend=x;
        var when=x.exportado?new Date(x.exportado).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}):'fecha desconocida';
        $('#bk-confirm').innerHTML='<div class="actions confirm" style="margin-top:12px"><span>¿Sustituir todos tus datos actuales por la copia del '+when+'? No se puede deshacer.</span>'+
          '<button class="btn" type="button" id="bk-yes">Sí, cargar copia</button><button class="btn ghost" type="button" id="bk-no">No</button></div>';
        $('#bk-msg').textContent='';
        $('#bk-yes').onclick=function(){
          S=normalize(bkPend.datos);bkPend=null;D={};openK=null;SEQ=Math.max(S.seq||10,10);initSeq();
          renderPerfil('');$('#bk-msg').textContent='Copia cargada. Tus datos se han sustituido por los de la copia.';
        };
        $('#bk-no').onclick=function(){bkPend=null;$('#bk-confirm').innerHTML='';};
      };
      rd.readAsText(f);
    };
  }

  /* ---------- perfil ---------- */
  var MAXCATS=8;
  function catPctSum(){return S.cfg.cats.reduce(function(s,k){return s+k.pct},0)}
  function catRow(k){
    var nm=k.fijo?'<span class="cn">'+escH(k.n)+'<small>'+(k.id==='reto'?'Fija: decide la fecha del reto':'Fija: lo que tocará invertir cada mes')+'</small></span>':
      '<input class="cn-in" id="cn-'+k.id+'" type="text" data-cn="'+k.id+'" value="'+escH(k.n)+'" aria-label="Nombre de la categoría">';
    return '<div class="crow"><span class="sw" style="background:var(--s'+k.col+')"></span>'+nm+
      '<span class="cp-in"><input id="cp-'+k.id+'" type="number" inputmode="decimal" min="0" max="100" step="any" data-cp="'+k.id+'" value="'+k.pct+'" aria-label="Porcentaje de '+escH(k.n)+'"><span class="hint">%</span></span>'+
      '<span class="amt num" id="ca-'+k.id+'"></span>'+
      (k.fijo?'<span class="icon-sp"></span>':'<button type="button" class="icon-btn" data-cdel="'+k.id+'" aria-label="Quitar '+escH(k.n)+'" title="Quitar categoría">'+TRASH+'</button>')+'</div>';
  }
  function updPerfil(){
    var c=S.cfg,sum=catPctSum(),el;
    c.cats.forEach(function(k){el=$('#ca-'+k.id);if(el)el.textContent=eur(c.sueldo*k.pct/100)});
    if((el=$('#pf-psum'))){
      var st;
      if(Math.abs(sum-100)<0.001)st=chip('ok').replace('Cumplido','Suma 100 %');
      else if(sum>100)st=chip('bad').replace(TXT.bad,'Te pasas '+nf1.format(sum-100)+' %');
      else st='<span class="chip"><span class="ring"></span><span>'+nf1.format(100-sum)+' % sin asignar</span></span>';
      el.innerHTML='<b class="num">'+nf1.format(sum)+' %</b> '+st;
    }
    if((el=$('#pf-sum'))){
      var d=calc(),Tm=d.Tm,h='';
      h+='<div class="mr"><span>Ahorro al mes según tu reparto</span><b class="num">'+eur(Tm)+'</b><small>El '+nf1.format(pctOf('reto'))+' % de '+eur(c.sueldo)+'.</small></div>';
      if(Tm>0&&d.planI!==null){
        var pf=fromIdx(d.planI);
        h+='<div class="mr"><span>Si cumples el plan desde el principio</span><b class="num">'+cap(MESC[pf.m])+' '+pf.y+'</b><small>'+mesesTxt(d.planN)+' desde '+lab(fromIdx(d.startI))+', empezando con '+eur(c.inicial)+'.</small></div>';
        if(d.rest<=0)h+='<div class="mr"><span>Con lo que llevas ahorrado</span><b class="num">Conseguido</b></div>';
        else{var fe=fromIdx(d.finI);h+='<div class="mr"><span>Con lo que llevas ahorrado</span><b class="num">'+cap(MESC[fe.m])+' '+fe.y+'</b><small>Esta es la fecha que ves en el panel.</small></div>'}
      }else h+='<p class="hint">Pon un porcentaje en «Ahorro para el reto» para calcular la fecha.</p>';
      el.innerHTML=h;
    }
    var add=$('#f-cat');if(add)add.querySelectorAll('input,button').forEach(function(x){x.disabled=c.cats.length>=MAXCATS});
    updHeader();
  }
  function renderPerfil(msg){
    var c=S.cfg,rows='';
    c.cats.forEach(function(k){rows+=catRow(k)});
    function fld(id,l,v,t,extra){return '<div class="f"><label for="'+id+'">'+l+'</label><input id="'+id+'" type="'+(t||'number')+'" '+(t?'':'inputmode="decimal" min="0" step="any" ')+(extra||'')+' value="'+escH(String(v))+'"></div>'}
    $('#view-perfil').innerHTML='<div class="sec-head"><div><h2>Perfil</h2><p>Tu reto y cómo repartes el sueldo. El panel se recalcula con lo que pongas.</p></div></div>'+
      '<div class="row"><section class="card"><div class="card-head"><h2>Tu reto</h2></div><div class="fields">'+
      fld('pf-mn','Nombre del reto',c.nombreMeta,'text','placeholder="Piso, coche, consola…"')+fld('pf-meta','Cantidad objetivo (€)',c.meta)+
      fld('pf-ini','Con cuánto empiezas (€)',c.inicial)+fld('pf-sue','Sueldo base al mes (€)',c.sueldo)+'</div>'+
      '<p class="hint" style="margin-top:10px">«Con cuánto empiezas» es lo que ya tenías ahorrado antes del primer mes que registras en Ingresos.</p>'+
      '<div class="pf-sum" id="pf-sum"></div></section>'+
      '<section class="card"><div class="card-head"><h2>Reparto del sueldo</h2><span class="hint">Lo que no asignes queda libre</span></div>'+
      '<div id="cat-list">'+rows+'</div><div class="total-line"><span>Total</span><span id="pf-psum"></span></div>'+
      '<form id="f-cat" class="cat-add"><div class="f"><label for="nc-n">Nueva categoría</label><input id="nc-n" type="text" placeholder="Por ejemplo, Viajes"></div>'+
      '<div class="f nc-p"><label for="nc-p">%</label><input id="nc-p" type="number" inputmode="decimal" min="0" max="100" step="any" placeholder="0"></div>'+
      '<button class="btn" type="submit">Añadir</button></form><p class="ok-msg" id="cat-msg" aria-live="polite">'+(msg||'')+'</p></section></div>'+
      '<section class="card"><div class="card-head"><h2>Copia de seguridad</h2></div>'+
      '<p class="hint">Tus datos se guardan solos en tu cuenta. Además, puedes descargar una copia en un archivo y guardarla donde quieras. Si algún día la necesitas, la cargas aquí.</p>'+
      '<div class="actions" style="margin-top:12px"><button class="btn ghost" type="button" id="bk-down">Descargar copia</button>'+
      '<label class="btn ghost ro-hide" for="bk-file">Cargar copia</label><input type="file" id="bk-file" accept=".json,application/json" hidden></div>'+
      '<div id="bk-confirm"></div><p class="ok-msg" id="bk-msg" aria-live="polite"></p></section>';
    updPerfil();
    bindBackup();
    $('#f-cat').addEventListener('submit',function(e){
      e.preventDefault();
      var n=$('#nc-n').value.trim(),p=Math.min(100,Math.max(0,num($('#nc-p').value)));
      if(!n){$('#cat-msg').textContent='Escribe el nombre de la categoría.';return}
      if(c.cats.length>=MAXCATS){$('#cat-msg').textContent='Puedes tener como máximo '+MAXCATS+' categorías.';return}
      var used={};c.cats.forEach(function(k){used[k.col]=1});
      var col=3;while(used[col]&&col<8)col++;
      c.cats.push({id:'c'+(++SEQ),n:n,pct:p,col:col});
      renderPerfil('«'+n+'» añadida.');
    });
    document.querySelectorAll('[data-cdel]').forEach(function(b){b.onclick=function(){
      var id=b.dataset.cdel,k=c.cats.filter(function(x){return x.id===id})[0];
      c.cats=c.cats.filter(function(x){return x.id!==id});
      renderPerfil('«'+(k?k.n:'')+'» quitada. Su porcentaje queda libre.');
    }});
  }

  /* ---------- eventos ---------- */
  document.addEventListener('input',function(e){
    var t=e.target;
    if(t.id==='pf-mn'){S.cfg.nombreMeta=t.value.trim();updHeader();return}
    var pm={'pf-meta':'meta','pf-ini':'inicial','pf-sue':'sueldo'};
    if(pm[t.id]){S.cfg[pm[t.id]]=Math.max(0,num(t.value));updPerfil();return}
    if(t.dataset&&t.dataset.cp){var ck=catBy(t.dataset.cp);if(ck)ck.pct=Math.min(100,Math.max(0,num(t.value)));updPerfil();return}
    if(t.dataset&&t.dataset.cn){var cn=catBy(t.dataset.cn);if(cn)cn.n=t.value.trim()||'Sin nombre';return}
    if(t.dataset&&t.dataset.k&&t.dataset.mk!==undefined){
      if(t.tagName==='SELECT'||t.type==='checkbox')return;
      var mk=+t.dataset.mk,k=t.dataset.k,dm=D[mk];if(!dm)return;
      if(t.type==='text'){dm[k]=t.value;updMes(mk);return}
      var v=Math.max(0,num(t.value));
      if(k==='sobPct'||k==='retPct'||k==='extPct')v=Math.min(100,v);
      dm[k]=v;
      updMes(mk);return}
    if(t.dataset&&t.dataset.isin!==undefined){
      var ii=+t.dataset.isin;if(!S.pos[ii])return;
      S.pos[ii].isin=t.value.replace(/\s+/g,'').toUpperCase();
      if(t.value!==S.pos[ii].isin){var cp=t.selectionStart;t.value=S.pos[ii].isin;try{t.setSelectionRange(cp,cp)}catch(e){}}
      updCartera();updPrecioMsg();
      var dd=calc().pos[ii],ps=$('#ps'+ii);if(ps&&dd)ps.textContent=srcTxt(dd,!dd.activo&&!dd.vacio);
      return}
    if(t.dataset&&t.dataset.pi!==undefined){S.pos[+t.dataset.pi].precio=Math.max(0,num(t.value));S.preciosFecha=new Date().toISOString();updCartera();updPrecioMsg();return}
  });
  document.addEventListener('change',function(e){
    var t=e.target;
    if(t.dataset&&t.dataset.isin!==undefined&&curTab==='cartera'){refreshForms();return}
    if(t.type==='checkbox'&&t.dataset&&t.dataset.k==='manual'){
      var mi=+t.dataset.mk,mm=D[mi];if(!mm)return;mm.manual=t.checked;
      if(t.checked&&!(mm.real>0))mm.real=Math.round(prevMes(mm));
      var rl=$('#rl'+mi);if(rl)rl.value=t.checked?mm.real:'';
      var wr=$('#wr'+mi);if(wr)wr.hidden=!t.checked;
      updMes(mi);return}
    if(t.tagName==='SELECT'&&t.dataset&&t.dataset.k&&t.dataset.mk!==undefined){
      var i=+t.dataset.mk,k=t.dataset.k;if(!D[i])return;D[i][k]=t.value;
      var w=$('#w'+({sobDest:'sp',retDest:'rp',extDest:'ep'}[k]||'x')+i);if(w)w.hidden=t.value!=='repartir';
      updMes(i)}
    if(t.dataset&&t.dataset.k&&(t.type==='number')&&t.value!==''&&num(t.value)<0){t.value='0'}
    if(t.dataset&&(t.dataset.k==='sobPct'||t.dataset.k==='retPct'||t.dataset.k==='extPct'||t.dataset.cp)&&num(t.value)>100){t.value='100'}
    if(t.type==='number'&&(t.dataset.cp||/^pf-/.test(t.id))&&t.value!==''&&num(t.value)<0){t.value='0'}
  });

  function updHeader(){var c=S.cfg;$('#h-meta').textContent=c.nombreMeta||'Mi reto';$('#sub').textContent='Mes en curso: '+lab(fromIdx(curIdx()))}
  var R={panel:renderPanel,ingresos:renderIngresos,cartera:renderCartera,perfil:renderPerfil};
  function show(tab){
    ['panel','ingresos','cartera','perfil'].forEach(function(n){
      var on=n===tab;$('#view-'+n).hidden=!on;$('#tab-'+n).setAttribute('aria-selected',on?'true':'false');
    });
    R[tab]();updHeader();
    window.scrollTo(0,0);
  }
  document.querySelectorAll('.tab').forEach(function(b){b.addEventListener('click',function(){show(b.dataset.tab)})});
  /* ---------- tema claro / oscuro ---------- */
  function initTheme(){
    var root=document.documentElement,mq=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
    function effective(){var t=root.getAttribute('data-theme');if(t==='dark'||t==='light')return t;return (mq&&mq.matches)?'dark':'light'}
    function sync(){var t=effective();$('#th-light').setAttribute('aria-pressed',t==='light'?'true':'false');$('#th-dark').setAttribute('aria-pressed',t==='dark'?'true':'false')}
    function set(t){root.setAttribute('data-theme',t);try{localStorage.setItem('camino-tema',t)}catch(e){}sync()}
    try{var saved=localStorage.getItem('camino-tema');if(saved==='dark'||saved==='light')root.setAttribute('data-theme',saved)}catch(e){}
    $('#th-light').addEventListener('click',function(){set('light')});
    $('#th-dark').addEventListener('click',function(){set('dark')});
    if(mq&&mq.addEventListener)mq.addEventListener('change',sync);
    if(window.MutationObserver)new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-theme']});
    sync();
  }
  initTheme();

  /* ---------- precios en directo ---------- */
  /* Un proceso automático de GitHub publica cada 15 minutos los precios por ISIN en la rama «precios». */
  var PRECIOS_URL='https://raw.githubusercontent.com/sergicalvoalos-dev/APP-AHORRO/precios/precios.json';
  function aplicarPrecios(j){
    if(!j||!j.precios||typeof j.precios!=='object')return false;
    if(LIVE.data&&LIVE.data.actualizado===j.actualizado)return false;
    LIVE.data=j;return true;
  }
  function refrescarVista(){
    if(!started)return;
    var ae=document.activeElement;
    if(!RO&&ae&&ae.closest&&ae.closest('main')&&/INPUT|SELECT|TEXTAREA/.test(ae.tagName))return;
    if(curTab==='cartera'){updCartera();refreshForms();updPrecioMsg()}
    else if(curTab==='panel')renderPanel();
  }
  function cargarPrecios(){
    if(!window.fetch)return;
    fetch(PRECIOS_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){
      if(aplicarPrecios(j)){try{localStorage.setItem('app-ahorro-precios',JSON.stringify(j))}catch(e){}refrescarVista()}
    }).catch(function(){});
  }
  try{aplicarPrecios(JSON.parse(localStorage.getItem('app-ahorro-precios')||'null'))}catch(e){}
  cargarPrecios();
  setInterval(cargarPrecios,10*60*1000);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')cargarPrecios()});

  /* ---------- modo consulta (móvil) ---------- */
  var RO=false,mqRO=window.matchMedia?[window.matchMedia('(max-width: 759px)'),window.matchMedia('(hover: none) and (pointer: coarse)')]:[];
  function isMobile(){return mqRO.some(function(m){return m.matches})}
  function applyRO(){
    document.body.classList.toggle('ro',RO);
    var note=$('#ro-note');if(note)note.hidden=!RO;
    if(!RO)return;
    document.querySelectorAll('main input, main select, main textarea').forEach(function(el){if(!el.disabled)el.disabled=true});
  }
  function setRO(v){
    if(v===RO)return;RO=v;
    if(RO){D={};openK=null;delK=null}else if(started)loadDrafts();
    if(started)show(curTab);else applyRO();
  }
  mqRO.forEach(function(m){if(m.addEventListener)m.addEventListener('change',function(){setRO(isMobile())})});
  if(window.MutationObserver)new MutationObserver(function(){if(RO)applyRO()}).observe(document.querySelector('main'),{childList:true,subtree:true});

  /* ---------- guardado: avisa a Firebase cuando cambia lo guardado ---------- */
  var started=false,lastSaved=null,saveCb=null,uidKey='',curTab='panel';
  function serial(){S.seq=SEQ;return JSON.stringify(S)}
  function draftKey(){return 'app-ahorro-borradores-'+uidKey}
  function saveDrafts(){if(RO)return;try{localStorage.setItem(draftKey(),JSON.stringify(D))}catch(e){}}
  function loadDrafts(){D={};if(RO)return;try{var x=JSON.parse(localStorage.getItem(draftKey())||'{}');Object.keys(x).forEach(function(k){if(x[k]&&typeof x[k]==='object')D[k]=x[k]})}catch(e){}}
  function check(){
    if(!started||RO)return;
    var j=serial();
    if(j!==lastSaved){lastSaved=j;if(saveCb)saveCb(j)}
    saveDrafts();
  }
  ['input','change','click','submit'].forEach(function(ev){document.addEventListener(ev,function(){setTimeout(check,0)})});
  var showBase=show;
  show=function(tab){curTab=tab;showBase(tab);applyRO()};
  document.querySelectorAll('.tab').forEach(function(b){b.addEventListener('click',function(){curTab=b.dataset.tab;applyRO()})});

  var STX={saved:'Guardado',saving:'Guardando…',pend:'Cambios por guardar…',offline:'Sin conexión: se guardará al volver',error:'No se pudo guardar',ro:'Modo consulta'};
  window.APP={
    /* json: estado guardado en Firebase (texto) o null si es la primera vez */
    start:function(json,uid){
      var x=null;try{x=json?JSON.parse(json):null}catch(e){x=null}
      S=normalize(x);SEQ=Math.max(S.seq||10,10);initSeq();
      uidKey=uid||'';RO=isMobile();loadDrafts();openK=null;delK=null;
      lastSaved=serial();started=true;
      show(curTab);
    },
    /* Cambios que llegan de otro dispositivo */
    update:function(json){
      if(!started||json===lastSaved)return;
      var x=null;try{x=JSON.parse(json)}catch(e){return}
      S=normalize(x);SEQ=Math.max(S.seq||10,SEQ);initSeq();lastSaved=serial();
      var ae=document.activeElement;
      if(!RO&&ae&&ae.closest&&ae.closest('main')&&/INPUT|SELECT|TEXTAREA/.test(ae.tagName))return;
      show(curTab);
    },
    onSave:function(cb){saveCb=cb},
    setStatus:function(k){var el=$('#save-st');if(!el)return;if(RO&&k==='saved')k='ro';el.textContent=STX[k]||'';el.className='save-st st-'+k},
    reset:function(){started=false;S=defaultState();D={};openK=null;lastSaved=null},
    isReadOnly:function(){return RO},
    _state:function(){return S},_precios:function(j){if(aplicarPrecios(j))refrescarVista()},_drafts:function(){return D},_setRO:setRO
  };
})();

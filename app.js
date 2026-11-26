(function(){
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var H=window.KK_HOURS||[],RM=matchMedia('(prefers-reduced-motion: reduce)').matches;

// cabecera
var top=$('.top'),VID=$$('.vidrio,.rd'),tkv=0;function sc(){top.classList.toggle('sc',scrollY>30);if(tkv)return;tkv=requestAnimationFrame(function(){tkv=0;var a=(135+scrollY*.12)%360;VID.forEach(function(v){v.style.setProperty('--ang',a+'deg')})})}sc();addEventListener('scroll',sc,{passive:true});
var bg=$('.burger'),mm=$('.mm');
if(bg)bg.addEventListener('click',function(){var o=bg.getAttribute('aria-expanded')!=='true';bg.setAttribute('aria-expanded',o);mm.classList.toggle('on',o);mm.setAttribute('aria-hidden',!o);document.body.style.overflow=o?'hidden':'';sc()});
$$('.mm a').forEach(function(a){a.addEventListener('click',function(){if(bg.getAttribute('aria-expanded')==='true')bg.click()})});

// abierto ahora (lunes = 0) · se corrige con los días cerrados que marque Kike en su panel
function mins(t){var p=t.split(':');return +p[0]*60+ +p[1]}
var NOM=['el lunes','el martes','el miércoles','el jueves','el viernes','el sábado','el domingo'],MLc=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function ymd(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function pdia(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2],12)}
function cierreDe(dia){var c=(window.KK_DISP&&KK_DISP.cierres)||[];for(var i=0;i<c.length;i++)if(dia>=c[i].desde&&dia<=c[i].hasta)return c[i];return null}
function espDe(dia){var c=(window.KK_DISP&&KK_DISP.especiales)||[];for(var i=0;i<c.length;i++)if(dia>=c[i].desde&&dia<=c[i].hasta)return c[i];return null}
function rangosDe(d){var dia=ymd(d);if(cierreDe(dia))return [];var e=espDe(dia);if(e)return e.tramos;return H[(d.getDay()+6)%7]||[]}
function estadoAhora(){
 var now=new Date(),m=now.getHours()*60+now.getMinutes(),txt=null,open=false,ci=cierreDe(ymd(now));
 rangosDe(now).forEach(function(r){if(m>=mins(r[0])&&m<mins(r[1])){open=true;txt='Abierto ahora · hasta las '+r[1]}});
 if(!open){var hoy=rangosDe(now).filter(function(r){return mins(r[0])>m})[0];
  if(hoy)txt='Cerrado ahora · abre a las '+hoy[0];
  else for(var i=1;i<40;i++){var d=new Date(now);d.setDate(now.getDate()+i);var rs=rangosDe(d);if(rs.length){txt=(ci?ci.motivo+' · abre ':'Cerrado · abre ')+(i===1?'mañana':i<7?NOM[(d.getDay()+6)%7]:'el '+d.getDate()+' de '+MLc[d.getMonth()])+' a las '+rs[0][0];break}}}
 $$('[data-open]').forEach(function(b){b.lastElementChild.textContent=txt;b.classList.toggle('cl',!open)});
}
function avisoCierre(){
 var c=((window.KK_DISP&&KK_DISP.cierres)||[]).slice().sort(function(a,b){return a.desde<b.desde?-1:1}),hoy=ymd(new Date()),lim=ymd(new Date(Date.now()+21*864e5));
 var x=c.filter(function(x){return x.desde<=lim&&x.hasta>=hoy})[0],el=$('.aviso-c');
 var lim7=ymd(new Date(Date.now()+7*864e5)),es=((window.KK_DISP&&KK_DISP.especiales)||[]).filter(function(e){return e.desde<=lim7&&e.hasta>=hoy&&e.tramos.length}).sort(function(a,b){return a.desde<b.desde?-1:1})[0];
 if(!x&&es){x={desde:es.desde,hasta:es.hasta,motivo:'',esp:es.tramos}}
 if(!x){if(el)el.remove();return}
 var f=function(s){var d=pdia(s);return d.getDate()+' de '+['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][d.getMonth()]};
 var t=x.desde===x.hasta?'El '+f(x.desde)+' está cerrado':(x.desde<=hoy?'Cerrado hasta el '+f(x.hasta)+' incluido':'Del '+f(x.desde)+' al '+f(x.hasta)+' está cerrado');
 if(x.esp){var hs=x.esp.map(function(r){return 'de '+r[0]+' a '+r[1]}).join(' y ');t=(x.desde===x.hasta?(x.desde===hoy?'Hoy':'El '+f(x.desde)):'Del '+f(x.desde)+' al '+f(x.hasta))+' solo se abre '+hs}
 if(!el){el=document.createElement('div');el.className='aviso-c';el.setAttribute('role','status');var mn=$('main');mn.insertBefore(el,mn.firstChild)}
 el.innerHTML='<div class="wrap"><b></b><span></span></div>';el.querySelector('b').textContent=t;el.querySelector('span').textContent=x.motivo?'('+x.motivo.toLowerCase()+')':'';
}
estadoAhora();
var DISP_OK=window.KK_API?fetch(KK_API+'?a=disp').then(function(r){return r.json()}).then(function(d){if(d&&d.ok){window.KK_DISP=d;if(d.horario&&d.horario.length===7)H=d.horario;estadoAhora();avisoCierre()}return d}).catch(function(){return null}):Promise.resolve(null);
var now=new Date();
$$('.hours li').forEach(function(li){if(+li.dataset.d===now.getDay())li.classList.add('today')});

// aparición escalonada por grupo
var io='IntersectionObserver' in window&&!RM?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -30px'}):null;
var g=new Map();
$$('.rv').forEach(function(el){var p=el.parentElement,n=g.get(p)||0;g.set(p,n+1);if(io){el.style.transitionDelay=Math.min(n,7)*90+'ms';io.observe(el)}else el.classList.add('in')});

// "Así se pide cita": el ticket se rellena con el scroll, siempre suavizado
var HS=$('[data-historia]');
if(HS){
 var bar=$('[data-hbar]'),pasosH=$$('[data-hp]'),lineas=$$('[data-hl]'),dia=$('[data-hdia]'),hora=$('[data-hhora]'),sello=$('[data-hsello]'),htk=$('[data-htk]');
 var obj=0,sp=0,corre=false;
 function lee(){var r=HS.getBoundingClientRect(),tot=r.height-innerHeight;obj=Math.max(0,Math.min(1,-r.top/Math.max(1,tot)))}
 function cl(v){return Math.max(0,Math.min(1,v))}
 function sm(t){return t*t*(3-2*t)}
 function dibuja(){
  var f=sp*4; // 0..4
  bar.style.transform='scaleY('+sp.toFixed(4)+')';
  pasosH.forEach(function(li,k){var d=f-k-.5,o=cl(1-Math.max(0,Math.abs(d)-.35)*3.3);if(k===0&&f<.5)o=1;if(k===3&&f>3.5)o=1;
   li.style.opacity=o.toFixed(3);li.style.transform='translateY('+(-Math.sign(d)*Math.max(0,Math.abs(d)-.35)*90).toFixed(1)+'px)';li.style.visibility=o<.01?'hidden':'visible'});
  lineas.forEach(function(l,k){var t=sm(cl((f-k)*1.4));l.style.opacity=(.18+.82*t).toFixed(3);l.style.transform='translateX('+((1-t)*18).toFixed(1)+'px)';l.classList.toggle('on',t>.98)});
  var td=sm(cl(f-1));dia.textContent=Math.max(1,Math.round(1+td*20));
  var th=sm(cl(f-2)),mins=600+Math.round(th*15)*30;hora.textContent=Math.floor(mins/60)+':'+('0'+mins%60).slice(-2);
  var ts=cl((f-3.15)*2.2);sello.style.opacity=ts.toFixed(3);sello.style.transform='rotate(-12deg) scale('+(1.8-.8*sm(ts)).toFixed(3)+')';
  htk.style.transform='rotate('+(-7+9*sm(sp)).toFixed(2)+'deg) translateY('+(Math.sin(sp*Math.PI)*-18).toFixed(1)+'px)'}
 function bucle(){var d=obj-sp;sp+=d*(RM?1:.075);if(Math.abs(d)<.0004)sp=obj;dibuja();if(sp!==obj)requestAnimationFrame(bucle);else corre=false}
 function pide(){lee();if(!corre){corre=true;requestAnimationFrame(bucle)}}
 addEventListener('scroll',pide,{passive:true});addEventListener('resize',pide);lee();sp=obj;dibuja();
}

// galería: flechas y arrastre
var gal=$('[data-gal]');
if(gal){
 $$('[data-g]').forEach(function(b){b.addEventListener('click',function(){var w=gal.querySelector('.gi').offsetWidth+18;gal.scrollBy({left:+b.dataset.g*w,behavior:RM?'auto':'smooth'})})});
 var x0=null,s0=0,mov=false;
 gal.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse')return;x0=e.clientX;s0=gal.scrollLeft;mov=false;gal.classList.add('drag')});
 addEventListener('pointermove',function(e){if(x0===null)return;var dx=e.clientX-x0;if(Math.abs(dx)>4)mov=true;gal.scrollLeft=s0-dx});
 addEventListener('pointerup',function(){if(x0===null)return;x0=null;gal.classList.remove('drag')});
 gal.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();$('[data-g="'+(e.key==='ArrowRight'?1:-1)+'"]').click()}});
}

// reservar
var days=$('[data-days]');if(!days)return;
var st={v:null,p:null,d:null,t:null},slots=$('[data-slots]'),fm=$('[data-form]'),send=$('[data-send]'),tk=$('.tk');
var DN=['dom','lun','mar','mié','jue','vie','sáb'],ML=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],DL=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
$$('[data-svc] .opt').forEach(function(b){b.addEventListener('click',function(){$$('[data-svc] .opt').forEach(function(x){x.classList.toggle('on',x===b)});st.v=b.dataset.v;st.p=b.dataset.p;sum()})});
// días y horas: los cierres, las horas bloqueadas y las citas ya cogidas vienen del panel de Kike
function libre(dia,t){var D=window.KK_DISP;if(!D)return true;if((D.ocupadas[dia]||[]).indexOf(t)>-1)return false;return !(D.bloqueos||[]).some(function(x){return x.dia===dia&&x.horas.indexOf(t)>-1})}
var base=new Date();base.setHours(0,0,0,0);
function pintaDias(){days.innerHTML='';var N=window.KK_DISP?28:14;
 for(var i=0;i<N;i++){(function(i){var d=new Date(base);d.setDate(base.getDate()+i);var dia=ymd(d),ci=cierreDe(dia),rs=rangosDe(d);
  var b=document.createElement('button');b.type='button';b.innerHTML='<small>'+DN[d.getDay()]+'</small><b>'+d.getDate()+'</b><small>'+(ci?'cerrado':ML[d.getMonth()].slice(0,3))+'</small>';
  b.setAttribute('aria-label',DL[d.getDay()]+' '+d.getDate()+' de '+ML[d.getMonth()]+(ci?', cerrado: '+ci.motivo:!rs.length?', cerrado':''));
  if(!rs.length){b.disabled=true;b.title=ci?ci.motivo:'Cerrado';if(ci)b.classList.add('vac')}
  if(st.d&&st.d.getTime()===d.getTime()){if(b.disabled){st.d=null;st.t=null}else b.classList.add('on')}
  b.addEventListener('click',function(){$$('button',days).forEach(function(x){x.classList.toggle('on',x===b)});st.d=d;st.t=null;pinta();sum(1)});
  days.appendChild(b)})(i)}
 if(st.d)pinta();else slots.innerHTML='<p class="empty">Elige un día para ver las horas libres.</p>'}
pintaDias();DISP_OK.then(function(d){if(d)pintaDias()});
function pinta(){slots.innerHTML='';var rs=rangosDe(st.d),n=new Date(),hay=0,dia=ymd(st.d),paso=(window.KK_DISP&&KK_DISP.intervalo)||30;
 rs.forEach(function(r,ri){var a=mins(r[0]),z=mins(r[1]);var lab=document.createElement('p');lab.className='grp';lab.textContent=rs.length>1?(ri?'Tarde':'Mañana'):'Horario';slots.appendChild(lab);
  for(var m=a;m+paso<=z;m+=paso){(function(m){if(st.d.toDateString()===n.toDateString()&&m<=n.getHours()*60+n.getMinutes()+20)return;
   var t=Math.floor(m/60)+':'+('0'+m%60).slice(-2),b=document.createElement('button');b.type='button';b.textContent=t;
   if(!libre(dia,t)){b.disabled=true;b.setAttribute('aria-label',t+', ocupado')}else hay++;
   if(st.t===t&&!b.disabled)b.classList.add('on');
   b.addEventListener('click',function(){$$('button',slots).forEach(function(x){x.classList.toggle('on',x===b)});st.t=t;sum()});slots.appendChild(b)})(m)}});
 if(!hay)slots.innerHTML='<p class="empty">Ese día ya no quedan horas libres. Prueba otro día.</p>'}
fm.addEventListener('input',function(){sum()});
function sum(t){
 $('[data-s=v]').textContent=st.v||'—';$('[data-s=n]').textContent=fm.n.value.trim()||'—';$('[data-s=p]').textContent=st.p?st.p+' €':'—';
 if(st.d){$('[data-cd]').textContent=st.d.getDate();$('[data-cw]').textContent=DL[st.d.getDay()];$('[data-cm]').textContent='de '+ML[st.d.getMonth()]}
 $('[data-ch]').textContent=st.t||'--:--';
 if(t){tk.classList.remove('tick');void tk.offsetWidth;tk.classList.add('tick')}
 send.disabled=!(st.v&&st.d&&st.t&&fm.n.value.trim()&&fm.t.value.trim())}
var res=$('[data-res]');
function msgRes(t,mal){if(!res)return;res.textContent=t;res.classList.toggle('mal',!!mal);res.hidden=!t}
send.addEventListener('click',function(){
 var msg='Hola Kike, quería reservar cita.\n\nServicio: '+st.v+'\nDía: '+DL[st.d.getDay()]+' '+st.d.getDate()+' de '+ML[st.d.getMonth()]+' a las '+st.t+'\nNombre: '+fm.n.value.trim()+'\nTeléfono: '+fm.t.value.trim()+(fm.m.value.trim()?'\n\n'+fm.m.value.trim():'');
 var url=window.KK_WA+'?text='+encodeURIComponent(msg);
 if(!window.KK_API){window.open(url,'_blank','noopener');return}
 var w=window.open('','_blank');send.disabled=true;msgRes('Apuntando tu cita…');
 var ctrl=window.AbortController?new AbortController():null,to=setTimeout(function(){if(ctrl)ctrl.abort()},9000);
 fetch(KK_API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},signal:ctrl?ctrl.signal:undefined,
  body:JSON.stringify({a:'cita',dia:ymd(st.d),hora:st.t,servicio:st.v,precio:st.p,nombre:fm.n.value.trim(),telefono:fm.t.value.trim(),nota:fm.m.value.trim()})})
 .then(function(r){return r.json()}).then(function(r){clearTimeout(to);
  if(r.ok){msgRes('Cita apuntada. Termina de enviarla por WhatsApp para que Kike te la confirme.');if(w)w.location.href=url;else window.location.href=url;
   (KK_DISP.ocupadas[ymd(st.d)]=KK_DISP.ocupadas[ymd(st.d)]||[]).push(st.t);st.t=null;pinta();sum()}
  else{if(w)w.close();msgRes(r.error==='ocupada'?'Esa hora se acaba de coger. Elige otra, por favor.':r.error==='cerrado'?'Ese día Kike no abre. Elige otro día, por favor.':'No se ha podido apuntar la cita. Prueba otra hora o llama al 611 25 66 26.',1);
   fetch(KK_API+'?a=disp').then(function(x){return x.json()}).then(function(d){if(d.ok){KK_DISP=d;H=d.horario;st.t=null;pintaDias();sum()}})}})
 .catch(function(){clearTimeout(to);msgRes('No hemos podido conectar. Te abrimos WhatsApp para que pidas la cita directamente.',1);if(w)w.location.href=url;else window.open(url,'_blank','noopener')})
 .then(function(){sum()});
});
})();

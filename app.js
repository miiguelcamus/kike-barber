(function(){
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var H=window.KK_HOURS||[],RM=matchMedia('(prefers-reduced-motion: reduce)').matches;

// cabecera
var top=$('.top'),VID=$$('.vidrio'),tkv=0;function sc(){top.classList.toggle('sc',scrollY>30);if(tkv)return;tkv=requestAnimationFrame(function(){tkv=0;var a=(135+scrollY*.12)%360;VID.forEach(function(v){v.style.setProperty('--ang',a+'deg')})})}sc();addEventListener('scroll',sc,{passive:true});
var bg=$('.burger'),mm=$('.mm');
if(bg)bg.addEventListener('click',function(){var o=bg.getAttribute('aria-expanded')!=='true';bg.setAttribute('aria-expanded',o);mm.classList.toggle('on',o);mm.setAttribute('aria-hidden',!o);document.body.style.overflow=o?'hidden':'';sc()});
$$('.mm a').forEach(function(a){a.addEventListener('click',function(){if(bg.getAttribute('aria-expanded')==='true')bg.click()})});

// abierto ahora (lunes = 0)
function mins(t){var p=t.split(':');return +p[0]*60+ +p[1]}
var now=new Date(),wd=(now.getDay()+6)%7,m=now.getHours()*60+now.getMinutes(),txt=null,open=false,NOM=['el lunes','el martes','el miércoles','el jueves','el viernes','el sábado','el domingo'];
(H[wd]||[]).forEach(function(r){if(m>=mins(r[0])&&m<mins(r[1])){open=true;txt='Abierto ahora · hasta las '+r[1]}});
if(!open){var hoy=(H[wd]||[]).filter(function(r){return mins(r[0])>m})[0];
 if(hoy)txt='Cerrado ahora · abre a las '+hoy[0];
 else for(var i=1;i<8;i++){var d=(wd+i)%7;if(H[d]&&H[d].length){txt='Cerrado · abre '+(i===1?'mañana':NOM[d])+' a las '+H[d][0][0];break}}}
$$('[data-open]').forEach(function(b){b.lastElementChild.textContent=txt;b.classList.toggle('cl',!open)});
$$('.hours li').forEach(function(li){if(+li.dataset.d===now.getDay())li.classList.add('today')});

// aparición escalonada por grupo
var io='IntersectionObserver' in window&&!RM?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1,rootMargin:'0px 0px -30px'}):null;
var g=new Map();
$$('.rv').forEach(function(el){var p=el.parentElement,n=g.get(p)||0;g.set(p,n+1);if(io){el.style.transitionDelay=Math.min(n,7)*90+'ms';io.observe(el)}else el.classList.add('in')});

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
// huecos ocupados de ejemplo, siempre los mismos para el mismo día
function ocupado(key){var h=2166136261;for(var i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0)%10<3}
var base=new Date();base.setHours(0,0,0,0);
for(var i=0;i<14;i++){(function(i){var d=new Date(base);d.setDate(base.getDate()+i);
 var b=document.createElement('button');b.type='button';b.innerHTML='<small>'+DN[d.getDay()]+'</small><b>'+d.getDate()+'</b><small>'+ML[d.getMonth()].slice(0,3)+'</small>';
 b.setAttribute('aria-label',DL[d.getDay()]+' '+d.getDate()+' de '+ML[d.getMonth()]);
 b.addEventListener('click',function(){$$('button',days).forEach(function(x){x.classList.toggle('on',x===b)});st.d=d;st.t=null;pinta();sum(1)});
 days.appendChild(b)})(i)}
function pinta(){slots.innerHTML='';var rs=H[(st.d.getDay()+6)%7]||[],n=new Date(),hay=0,key=st.d.toDateString();
 rs.forEach(function(r,ri){var a=mins(r[0]),z=mins(r[1]);var lab=document.createElement('p');lab.className='grp';lab.textContent=rs.length>1?(ri?'Tarde':'Mañana'):'Horario';slots.appendChild(lab);
  for(var m=a;m+30<=z;m+=30){(function(m){if(st.d.toDateString()===n.toDateString()&&m<=n.getHours()*60+n.getMinutes()+20)return;
   var t=Math.floor(m/60)+':'+('0'+m%60).slice(-2),b=document.createElement('button');b.type='button';b.textContent=t;hay++;
   if(ocupado(key+t)){b.disabled=true;b.setAttribute('aria-label',t+', ocupado')}
   b.addEventListener('click',function(){$$('button',slots).forEach(function(x){x.classList.toggle('on',x===b)});st.t=t;sum()});slots.appendChild(b)})(m)}});
 if(!hay)slots.innerHTML='<p class="empty">Hoy ya no quedan horas. Prueba otro día.</p>'}
fm.addEventListener('input',function(){sum()});
function sum(t){
 $('[data-s=v]').textContent=st.v||'—';$('[data-s=n]').textContent=fm.n.value.trim()||'—';$('[data-s=p]').textContent=st.p?st.p+' €':'—';
 if(st.d){$('[data-cd]').textContent=st.d.getDate();$('[data-cw]').textContent=DL[st.d.getDay()];$('[data-cm]').textContent='de '+ML[st.d.getMonth()]}
 $('[data-ch]').textContent=st.t||'--:--';
 if(t){tk.classList.remove('tick');void tk.offsetWidth;tk.classList.add('tick')}
 send.disabled=!(st.v&&st.d&&st.t&&fm.n.value.trim()&&fm.t.value.trim())}
send.addEventListener('click',function(){var msg='Hola Kike, quería reservar cita.\n\nServicio: '+st.v+'\nDía: '+DL[st.d.getDay()]+' '+st.d.getDate()+' de '+ML[st.d.getMonth()]+' a las '+st.t+'\nNombre: '+fm.n.value.trim()+'\nTeléfono: '+fm.t.value.trim()+(fm.m.value.trim()?'\n\n'+fm.m.value.trim():'');
 window.open(window.KK_WA+'?text='+encodeURIComponent(msg),'_blank','noopener')});
})();

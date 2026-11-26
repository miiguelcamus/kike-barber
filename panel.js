(function(){
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var API=window.KK_API||'',LOCAL=!API||API.indexOf('@@')===0;
var SERV=[['Corte de pelo','12'],['Degradado','14'],['Arreglo de barba','8'],['Corte + barba','18'],['Diseño o rayas','+3'],['Corte infantil','10']];
var DN=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],DC=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],DL=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
var MN=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var MOTIVOS=['Vacaciones','Festivo','Formación','Asuntos propios'];
var PIN='',D=null,ED=null,sucio=false,semOff=0,mesOff=0,selA=null,selB=null,motSel='Vacaciones',editId=null,tSync=0;

// ---------------------------------------------------------------- fechas
function pd(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2],12)}
function fd(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
function add(s,n){var d=pd(s);d.setDate(d.getDate()+n);return fd(d)}
function ws(s){return (pd(s).getDay()+6)%7}
function mins(h){var p=String(h).split(':');return +p[0]*60+ +p[1]}
function hhmm(m){return Math.floor(m/60)+':'+('0'+m%60).slice(-2)}
function largo(s){var d=pd(s);return DN[d.getDay()]+' '+d.getDate()+' de '+MN[d.getMonth()]}
function corto(s){var d=pd(s);return d.getDate()+' '+MN[d.getMonth()].slice(0,3)}
function cap(t){return t.charAt(0).toUpperCase()+t.slice(1)}
function dias(a,b){return Math.round((pd(b)-pd(a))/864e5)+1}
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function num(p){var n=parseFloat(String(p).replace(',','.'));return isNaN(n)||/^\+/.test(String(p))?0:n}
function waNum(t){var d=String(t||'').replace(/\D/g,'');if(d.length===9)d='34'+d;return d}
function wa(t,msg){var n=waNum(t);return n?'https://wa.me/'+n+'?text='+encodeURIComponent(msg):''}
function nom1(n){return String(n||'').replace(/\s*\(ejemplo\)/,'').split(' ')[0]}

// ---------------------------------------------------------------- reglas (iguales que en el servidor)
function cierreDe(c,dia){for(var i=0;i<(c.cierres||[]).length;i++){var x=c.cierres[i];if(dia>=x.desde&&dia<=x.hasta)return x}return null}
function espDe(c,dia){var l=c.especiales||[];for(var i=0;i<l.length;i++)if(dia>=l[i].desde&&dia<=l[i].hasta)return l[i];return null}
function horarioDe(c,dia){if(cierreDe(c,dia))return [];var e=espDe(c,dia);return e?e.tramos:(c.horario[ws(dia)]||[])}
function cerrado(c,dia){var x=cierreDe(c,dia);if(x)return x.motivo||'Cerrado';if(horarioDe(c,dia).length)return '';return espDe(c,dia)?'Cerrado':'Cerrado por horario'}
function tramosTxt(t){return t.length?t.map(function(r){return r[0]+' a '+r[1]}).join(' y de '):'Cerrado'}
function tramoCorto(t){return t.length?t.map(function(r){return r[0].replace(':00','')+'–'+r[1].replace(':00','')}).join(' · '):'Cerrado'}
function huecos(c,dia){var r=[],p=c.intervalo||30;horarioDe(c,dia).forEach(function(t){for(var m=mins(t[0]);m+p<=mins(t[1]);m+=p)r.push(hhmm(m))});return r}
function bloqDe(c,dia){for(var i=0;i<(c.bloqueos||[]).length;i++)if(c.bloqueos[i].dia===dia)return c.bloqueos[i];return null}
function activas(){return D.citas.filter(function(x){return x.estado!=='Cancelada'})}
function delDia(dia){return activas().filter(function(x){return x.dia===dia}).sort(function(a,b){return mins(a.hora)-mins(b.hora)})}

// ---------------------------------------------------------------- servidor
function api(body){
 if(LOCAL)return Promise.resolve(mock(Object.assign({pin:PIN},body)));
 return fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({pin:PIN},body))})
  .then(function(r){return r.json()});
}
var ERR={pin:'El PIN no es correcto.',cerrado:'Ese día está cerrado.',ocupada:'Esa hora ya está cogida o bloqueada.',hora:'Esa hora no entra en el horario de ese día.',pasado:'Esa hora ya ha pasado.',nombre:'Escribe el nombre del cliente.',fecha:'Elige día y hora.',noexiste:'Esa cita ya no existe. Recarga el panel.'};
function msgErr(r){return (ERR[r&&r.error]||'No se ha podido guardar. Revisa la conexión y vuelve a intentarlo.')+(r&&r.motivo&&r.error==='cerrado'?' ('+r.motivo+')':'')}

function carga(silencio){
 if(!silencio)sync('Cargando…');
 return api({a:'panel'}).then(function(r){
  if(!r.ok){if(r.error==='pin'){salir();return}throw r}
  D=r;D.cfg.especiales=D.cfg.especiales||[];D.cfg.bloqueos=D.cfg.bloqueos||[];ED=JSON.parse(JSON.stringify(D.cfg));
  pinta();sync('Actualizado a las '+r.ahora.slice(11));
 }).catch(function(){sync('Sin conexión',1)});
}
function sync(t,mal){var s=$('[data-sync]');s.textContent=t;s.classList.toggle('mal',!!mal)}
var tt;function aviso(t){var e=$('[data-toast]');e.textContent=t;e.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){e.classList.remove('on')},3400)}

// ---------------------------------------------------------------- acceso
function guardaPin(p){try{if(p)localStorage.setItem('kk_pin',p);else localStorage.removeItem('kk_pin')}catch(e){}}
function leePin(){try{return localStorage.getItem('kk_pin')||''}catch(e){return ''}}
function entra(){$('[data-login]').hidden=true;$('[data-app]').hidden=false;carga();clearInterval(tSync);tSync=setInterval(function(){if(!F&&!$('[data-dlg]').open&&!document.hidden)carga(1)},60000)}
function salir(){PIN='';guardaPin('');D=null;$('[data-app]').hidden=true;$('[data-login]').hidden=false;clearInterval(tSync);$('[data-lform] input').value='';$('[data-lform] input').focus()}
$('[data-lform]').addEventListener('submit',function(e){e.preventDefault();var p=e.target.pin.value.trim(),er=$('[data-lerr]'),b=$('button',e.target);
 er.textContent='';b.disabled=true;b.textContent='Entrando…';PIN=p;
 api({a:'login'}).then(function(r){if(r.ok){guardaPin(p);entra()}else er.textContent=r.error==='pin'?'Ese PIN no es correcto.':'No se ha podido entrar.'})
  .catch(function(){er.textContent='No hay conexión. Prueba otra vez en un momento.'})
  .then(function(){b.disabled=false;b.textContent='Entrar'})});
$('[data-salir]').addEventListener('click',function(){salir()});

// ---------------------------------------------------------------- pestañas
$$('[data-tab]').forEach(function(b){b.addEventListener('click',function(){
 $$('[data-tab]').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-selected',x===b)});
 $$('[data-p]').forEach(function(s){s.classList.toggle('on',s.dataset.p===b.dataset.tab)});window.scrollTo(0,0)})});

// ---------------------------------------------------------------- pintar todo
function pinta(){
 $('[data-fecha]').textContent=cap(largo(D.hoy));
 pintaHoy();pintaAgenda();pintaDisp();pintaCitas();pintaStats();
}

function pill(e){return '<span class="pill e-'+e.replace(' ','')+'">'+esc(e)+'</span>'}
function waMsg(x){return 'Hola '+nom1(x.nombre)+', soy Kike. Te confirmo tu cita '+(x.dia===D.hoy?'hoy':(x.dia===add(D.hoy,1)?'mañana':'el '+largo(x.dia)))+' a las '+x.hora+'. ¡Nos vemos!'}
function itemCita(x,conDia){
 var w=wa(x.telefono,waMsg(x));
 return '<li class="it" data-id="'+esc(x.id)+'"><time>'+esc(x.hora)+(conDia?'<small>'+corto(x.dia)+'</small>':'')+'</time>'+
  '<div class="it-t"><b>'+esc(x.nombre)+'</b><small>'+esc(x.servicio||'Sin servicio')+(x.nota?' · '+esc(x.nota):'')+'</small></div>'+
  '<select class="est-s e-'+x.estado.replace(' ','')+'" data-est aria-label="Estado de la cita">'+D.estados.map(function(e){return '<option'+(e===x.estado?' selected':'')+'>'+e+'</option>'}).join('')+'</select>'+
  (w?'<a class="ic-wa" href="'+w+'" target="_blank" rel="noopener" aria-label="WhatsApp a '+esc(x.nombre)+'"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s1 2.6 1.1 2.7c.1.2 1.9 2.9 4.6 4 1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3z"/></svg></a>':'<span class="ic-wa off"></span>')+'</li>';
}

function lunesDe(s){return add(s,-ws(s))}
function pintaHoy(){
 var c=D.cfg,hoy=D.hoy,hc=delDia(hoy),pend=hc.filter(function(x){return x.estado==='Pendiente'}).length,lun=lunesDe(hoy);
 var sem=activas().filter(function(x){return x.dia>=lun&&x.dia<=add(lun,6)}).length;
 var ahoraM=mins(D.ahora.slice(11)),sig=hc.filter(function(x){return mins(x.hora)>=ahoraM&&x.estado!=='Hecha'&&x.estado!=='No vino'})[0];
 var prox=(c.cierres||[]).filter(function(x){return x.hasta>=hoy}).sort(function(a,b){return a.desde<b.desde?-1:1})[0];
 var mot=cerrado(c,hoy);
 $('[data-kpis]').innerHTML=
  '<div class="kpi"><small>Citas hoy</small><b>'+hc.length+'</b><span>'+(mot?'Hoy está cerrado · '+esc(mot):pend+' por confirmar')+'</span></div>'+
  '<div class="kpi"><small>Siguiente</small><b>'+(sig?esc(sig.hora):'—')+'</b><span>'+(sig?esc(sig.nombre):'No quedan citas hoy')+'</span></div>'+
  '<div class="kpi"><small>Esta semana</small><b>'+sem+'</b><span>citas apuntadas</span></div>'+
  '<div class="kpi kpi-n"><small>Próximo cierre</small><b>'+(prox?(prox.desde===prox.hasta?corto(prox.desde):corto(prox.desde)+' – '+corto(prox.hasta)):'—')+'</b><span>'+(prox?esc(prox.motivo):'No hay días cerrados')+'</span></div>';
 $('[data-hoy-n]').textContent=hc.length?hc.length+(hc.length===1?' cita':' citas'):'';
 $('[data-hoy]').innerHTML=hc.length?hc.map(function(x){return itemCita(x)}).join(''):'<li class="vacio">'+(mot?'Hoy está cerrado: '+esc(mot)+'.':'Hoy no tienes citas. Cuando alguien reserve en la web, aparecerá aquí.')+'</li>';
 var h='';for(var i=1;i<=7;i++){var d=add(hoy,i),m=cerrado(c,d),cs=delDia(d);
  h+='<div class="pd"><div class="pd-h"><b>'+(i===1?'Mañana':cap(DN[pd(d).getDay()]))+'</b><span>'+corto(d)+'</span>'+(m?'<em class="cerr">'+esc(m)+'</em>':'<em>'+cs.length+(cs.length===1?' cita':' citas')+'</em>')+'</div>'+
  (cs.length?'<ul class="pd-l">'+cs.map(function(x){return '<li data-id="'+esc(x.id)+'"><time>'+x.hora+'</time>'+esc(x.nombre)+'<span class="dot e-'+x.estado.replace(' ','')+'" title="'+x.estado+'"></span></li>'}).join('')+'</ul>':'')+'</div>'}
 $('[data-prox]').innerHTML=h;
}

// ---------------------------------------------------------------- agenda semanal
var FH=30;
function pintaAgenda(){
 var c=D.cfg,lun=add(lunesDe(D.hoy),semOff*7),p=c.intervalo||30,ini=24*60,fin=0;
 c.horario.forEach(function(d){d.forEach(function(r){ini=Math.min(ini,mins(r[0]));fin=Math.max(fin,mins(r[1]))})});
 if(fin<=ini){ini=600;fin=1200}
 activas().forEach(function(x){if(x.dia>=lun&&x.dia<=add(lun,6)){ini=Math.min(ini,mins(x.hora));fin=Math.max(fin,mins(x.hora)+p)}});
 ini=Math.floor(ini/60)*60;fin=Math.ceil(fin/60)*60;
 var rows=(fin-ini)/30,alto=rows*FH;
 $('[data-sem-t]').textContent=semOff===0?'Esta semana':(corto(lun)+' – '+corto(add(lun,6)));
 var h='<div class="ag-h"><span></span>';
 for(var k=0;k<7;k++){var d=add(lun,k);h+='<span class="'+(d===D.hoy?'hoy':'')+'">'+DC[k]+' <b>'+pd(d).getDate()+'</b></span>'}
 h+='</div><div class="ag-b" style="--alto:'+alto+'px"><div class="ag-hrs">';
 for(var m=ini;m<fin;m+=60)h+='<span style="top:'+((m-ini)/30*FH)+'px">'+hhmm(m)+'</span>';
 h+='</div>';
 for(k=0;k<7;k++){var d2=add(lun,k),mot=cerrado(c,d2),bq=bloqDe(c,d2),cs=delDia(d2),pas=d2<D.hoy;
  h+='<div class="ag-col'+(d2===D.hoy?' hoy':'')+(pas?' pas':'')+'" data-dia="'+d2+'">';
  if(mot&&!cs.length)h+='<div class="ag-cerr"><span>'+esc(mot)+'</span></div>';
  else{
   if(mot)h+='<div class="ag-cerr fondo"><span>'+esc(mot)+'</span></div>';
   horarioDe(c,d2).forEach(function(r){h+='<i class="ag-ab" style="top:'+((mins(r[0])-ini)/30*FH)+'px;height:'+((mins(r[1])-mins(r[0]))/30*FH)+'px"></i>'});
   if(!mot&&!pas)huecos(c,d2).forEach(function(t){var b=bq&&bq.horas.indexOf(t)>-1,o=cs.some(function(x){return x.hora===t});if(o)return;
    h+='<button type="button" class="ag-hu'+(b?' bq':'')+'" data-hu="'+t+'" style="top:'+((mins(t)-ini)/30*FH)+'px;height:'+(p/30*FH)+'px" aria-label="'+(b?'Hora bloqueada':'Apuntar cita')+' '+largo(d2)+' a las '+t+'">'+(b?'Bloqueada':'+ '+t)+'</button>'});
  }
  cs.forEach(function(x){h+='<button type="button" class="ag-ci e-'+x.estado.replace(' ','')+'" data-id="'+esc(x.id)+'" style="top:'+((mins(x.hora)-ini)/30*FH+1)+'px;height:'+(p/30*FH-2)+'px"><b>'+x.hora+'</b> '+esc(nom1(x.nombre))+'<small>'+esc(x.servicio)+'</small></button>'});
  h+='</div>'}
 $('[data-ag]').innerHTML=h+'</div>';
}
$$('[data-sem]').forEach(function(b){b.addEventListener('click',function(){var v=+b.dataset.sem;semOff=v===0?0:semOff+v;pintaAgenda()})});
$('[data-ag]').addEventListener('click',function(e){var ci=e.target.closest('[data-id]');if(ci){abreCita(ci.dataset.id);return}
 var hu=e.target.closest('[data-hu]');if(hu){if(hu.classList.contains('bq')){aviso('Esa hora la has quitado. Puedes devolverla en «Días y horario».');return}abreNueva(hu.closest('[data-dia]').dataset.dia,hu.dataset.hu)}});

// ---------------------------------------------------------------- días y horario (guiado, guarda al momento)
function clona(o){return JSON.parse(JSON.stringify(o))}
function pintaDisp(){ED=clona(D.cfg);ED.especiales=ED.especiales||[];pintaCal();pintaCierres();if(F)pintaEd()}
function guardaCfg(c,msg){
 var b=$('[data-ok]',$('[data-ed]'));if(b){b.disabled=true;b.textContent='Guardando…'}
 return api({a:'guardar',cfg:c}).then(function(r){if(!r.ok)throw r;D.cfg=r.cfg;D.cfg.especiales=D.cfg.especiales||[];F=null;cierraEd();pinta();aviso(msg)})
  .catch(function(r){aviso(msgErr(r));if(b){b.disabled=false;b.textContent=b.dataset.t}});
}
function recorta(l,a,b){var n=[];(l||[]).forEach(function(x){
 if(x.hasta<a||x.desde>b){n.push(x);return}
 if(x.desde<a)n.push(Object.assign({},x,{id:x.id+'a',hasta:add(a,-1)}));
 if(x.hasta>b)n.push(Object.assign({},x,{id:x.id+'b',desde:add(b,1)}))});return n}
function limpiaRango(c,a,b){c.cierres=recorta(c.cierres,a,b);c.especiales=recorta(c.especiales,a,b)}
function manTar(dia,cual){var t=D.cfg.horario[ws(dia)]||[];return t.filter(function(r){return cual==='m'?mins(r[0])<840:mins(r[0])>=840})}
function dentro(t,tramos){var m=mins(t);return tramos.some(function(r){return m>=mins(r[0])&&m<mins(r[1])})}
function diasDe(a,b){var r=[];for(var d=a;d<=b;d=add(d,1))r.push(d);return r}

// calendario resumen
function pintaCal(){
 var base=pd(D.hoy);base.setDate(1);base.setMonth(base.getMonth()+mesOff);
 var y=base.getFullYear(),mo=base.getMonth(),pri=fd(new Date(y,mo,1,12)),nd=new Date(y,mo+1,0).getDate();
 $('[data-mes-t]').textContent=cap(MN[mo])+' '+y;
 var h=DC.map(function(d){return '<span class="cal-h">'+d+'</span>'}).join('');
 for(var i=0;i<ws(pri);i++)h+='<span></span>';
 var sa=F&&F.desde,sb=F&&(F.hasta||F.desde);
 for(var dd=1;dd<=nd;dd++){var d=fd(new Date(y,mo,dd,12)),ci=cierreDe(ED,d),es=!ci&&espDe(ED,d),hor=!ci&&!es&&!(ED.horario[ws(d)]||[]).length,n=delDia(d).length,pas=d<D.hoy,bq=bloqDe(ED,d);
  var cls=['cd'];if(pas)cls.push('pas');if(d===D.hoy)cls.push('hoy');if(ci)cls.push('cierre');else if(es)cls.push(es.tramos.length?'esp':'cierre');else if(hor)cls.push('horc');if(sa&&d>=sa&&d<=sb)cls.push('sel');
  var lab=ci?esc(ci.motivo):es?tramoCorto(es.tramos):hor?'Cerrado':'';
  h+='<button type="button" class="'+cls.join(' ')+'" data-cd="'+d+'"'+(pas?' disabled':'')+' aria-label="'+largo(d)+(ci?', no trabajas: '+esc(ci.motivo):es?', trabajas de '+tramosTxt(es.tramos):hor?', cerrado por horario':'')+(bq&&!ci?', horas quitadas':'')+(n?', '+n+' citas':'')+'"><b>'+dd+'</b>'+(lab?'<small>'+lab+'</small>':'')+(n?'<i class="cd-n">'+n+'</i>':'')+(bq&&!ci?'<i class="cd-bq" title="Horas quitadas"></i>':'')+'</button>'}
 $('[data-cal]').innerHTML=h;
}
$$('[data-mes]').forEach(function(b){b.addEventListener('click',function(){mesOff=Math.max(0,Math.min(14,mesOff+ +b.dataset.mes));pintaCal()})});
$('[data-cal]').addEventListener('click',function(e){var b=e.target.closest('[data-cd]');if(!b||b.disabled)return;abreEd('dia',b.dataset.cd)});

// lista de cambios
function pintaCierres(){
 var l=(ED.cierres||[]).map(function(x){return {t:'c',x:x,d:x.desde}}).concat((ED.especiales||[]).map(function(x){return {t:'e',x:x,d:x.desde}})).concat((ED.bloqueos||[]).map(function(x){return {t:'b',x:x,d:x.dia}}))
  .filter(function(o){return (o.x.hasta||o.x.dia)>=D.hoy}).sort(function(a,b){return a.d<b.d?-1:1});
 $('[data-cierres]').innerHTML=l.length?l.map(function(o){var x=o.x,tit,det,cls;
  if(o.t==='b'){tit=cap(largo(x.dia));det='Horas quitadas: '+x.horas.join(', ')+(x.motivo?' · '+esc(x.motivo):'');cls='li-bq'}
  else{var n=dias(x.desde,x.hasta);tit=n===1?cap(largo(x.desde)):corto(x.desde)+' – '+corto(x.hasta)+' · '+n+' días';
   det=o.t==='c'?'No trabajas · '+esc(x.motivo):(x.tramos.length?'Solo de '+tramosTxt(x.tramos):'No trabajas');cls=o.t==='c'?'li-c':'li-esp'}
  return '<li class="'+cls+'"><div><b>'+tit+'</b><span>'+det+'</span></div><button class="b b-sm b-claro" data-qc="'+o.t+':'+esc(x.id)+'">Deshacer</button></li>'}).join(''):'<li class="vacio">Todavía no has cambiado nada. Usa los botones de arriba o toca un día del calendario.</li>';
}
$('[data-cierres]').addEventListener('click',function(e){var b=e.target.closest('[data-qc]');if(!b)return;var p=b.dataset.qc.split(':'),k={c:'cierres',e:'especiales',b:'bloqueos'}[p[0]],c=clona(D.cfg);
 c.especiales=c.especiales||[];c[k]=c[k].filter(function(x){return x.id!==p[1]});b.disabled=true;guardaCfg(c,'Deshecho. Ese día vuelve a su horario normal en la web.')});

// asistente
var F=null;
$$('[data-acc]').forEach(function(b){b.addEventListener('click',function(){abreEd(b.dataset.acc)})});
function abreEd(tipo,dia){
 var d=dia||D.hoy;F={tipo:tipo,desde:d,hasta:d,motivo:'Vacaciones',cuando:'t',tramos:null,horas:null,bqMot:''};
 if(tipo==='horas'){var bq=bloqDe(D.cfg,d);F.horas=bq?bq.horas.slice():[];F.bqMot=bq?bq.motivo||'':''}
 if(tipo==='semana')F.sem=clona(D.cfg.horario),F.int=D.cfg.intervalo||30;
 $$('[data-acc]').forEach(function(x){x.classList.toggle('on',x.dataset.acc===tipo)});
 var el=$('[data-ed]');el.hidden=false;pintaEd();pintaCal();el.scrollIntoView({behavior:'smooth',block:'start'});
}
function cierraEd(){F=null;var el=$('[data-ed]');el.hidden=true;el.innerHTML='';$$('[data-acc]').forEach(function(x){x.classList.remove('on')});if(ED)pintaCal()}
function fechas(uno){var mx=add(D.hoy,365);
 return '<div class="ed-f"><label>'+(uno?'Día':'Desde')+'<input type="date" data-f="desde" min="'+D.hoy+'" max="'+mx+'" value="'+F.desde+'"></label>'+(uno?'':'<label>Hasta <small>(incluido)</small><input type="date" data-f="hasta" min="'+F.desde+'" max="'+mx+'" value="'+F.hasta+'"></label>')+'</div>'+
  (uno?'':'<p class="ayuda">Si es un solo día, deja las dos fechas iguales.</p>')}
function citasAviso(cs,txt){if(!cs.length)return '';
 return '<div class="sel-w"><b>'+(cs.length===1?'Hay 1 cita':'Hay '+cs.length+' citas')+' que se quedan fuera.</b> '+txt+'<ul>'+cs.slice(0,6).map(function(x){var w=wa(x.telefono,'Hola '+nom1(x.nombre)+', soy Kike. El '+largo(x.dia)+' cambio el horario y no puedo a las '+x.hora+'. ¿Te la cambio a otra hora u otro día?');
  return '<li><span>'+corto(x.dia)+' '+x.hora+' · '+esc(x.nombre)+'</span>'+(w?'<a href="'+w+'" target="_blank" rel="noopener">Avisar por WhatsApp</a>':'')+'</li>'}).join('')+'</ul>'+(cs.length>6?'<p class="mas">Y '+(cs.length-6)+' más. Las tienes todas en la pestaña «Citas».</p>':'')+'</div>'}
function paso(n,t){return '<p class="paso"><span>'+n+'</span>'+t+'</p>'}
function botones(txt,cls,extra){return '<div class="sel-b"><button class="b '+(cls||'b-negro')+'" data-ok data-t="'+txt+'">'+txt+'</button>'+(extra||'')+'<button class="b b-claro" data-cancela>Cancelar</button></div>'}
function pintaEd(){
 var el=$('[data-ed]'),h='',t=F.tipo;
 if(t==='dia'){
  var d=F.desde,ci=cierreDe(D.cfg,d),es=espDe(D.cfg,d),bq=bloqDe(D.cfg,d),ahora=ci?'No trabajas ('+esc(ci.motivo)+').':es?(es.tramos.length?'Trabajas solo de '+tramosTxt(es.tramos)+'.':'No trabajas.'):(D.cfg.horario[ws(d)]||[]).length?'Horario normal, de '+tramosTxt(D.cfg.horario[ws(d)])+'.':'Cerrado por tu horario de siempre.';
  h='<div class="ed-h"><h2>'+cap(largo(d))+'</h2><button type="button" class="x" data-cancela aria-label="Cerrar">×</button></div><p class="ed-ahora">'+ahora+(bq?' Horas quitadas: '+bq.horas.join(', ')+'.':'')+' '+(delDia(d).length?delDia(d).length+' citas apuntadas.':'Sin citas.')+'</p>'+
   '<div class="ed-op"><button type="button" class="b b-claro" data-ir="cerrar">No trabajo este día</button><button type="button" class="b b-claro" data-ir="menos">Trabajo menos horas</button><button type="button" class="b b-claro" data-ir="horas">Quitar unas horas</button>'+(ci||es?'<button type="button" class="b b-negro" data-normal>Volver al horario normal</button>':'')+'</div>';
 }
 else if(t==='cerrar'){
  var r=diasDe(F.desde,F.hasta),cs=activas().filter(function(x){return x.dia>=F.desde&&x.dia<=F.hasta});
  h='<div class="ed-h"><h2>No trabajo uno o varios días</h2><button type="button" class="x" data-cancela aria-label="Cerrar">×</button></div>'+
   paso(1,'¿Qué días no trabajas?')+fechas()+
   paso(2,'¿Por qué? <small>Saldrá en la web como aviso</small>')+'<div class="chips">'+MOTIVOS.map(function(m){return '<button type="button" class="chip'+(m===F.motivo?' on':'')+'" data-mot="'+m+'">'+m+'</button>'}).join('')+'<input class="chip-in" data-motx maxlength="60" placeholder="Otro motivo" value="'+(MOTIVOS.indexOf(F.motivo)<0?esc(F.motivo):'')+'"></div>'+
   '<p class="resumen">La web no dejará pedir cita '+(r.length===1?'el '+largo(F.desde):'del '+largo(F.desde)+' al '+largo(F.hasta)+' ('+r.length+' días)')+'.</p>'+
   citasAviso(cs,'No se borran solas: avísales para cambiarlas.')+botones(r.length===1?'Cerrar este día':'Cerrar estos '+r.length+' días','b-rojo');
 }
 else if(t==='menos'){
  var dd=diasDe(F.desde,F.hasta),tr=function(d){return F.cuando==='otras'?F.tramos:manTar(d,F.cuando)};
  if(F.cuando==='otras'&&!F.tramos){var e2=espDe(D.cfg,F.desde);F.tramos=clona(e2&&e2.tramos.length?e2.tramos:[['10:00','14:00']])}
  var g={};dd.forEach(function(d){var k=tramosTxt(tr(d));(g[k]=g[k]||[]).push(d)});var ks=Object.keys(g);
  var fuera=activas().filter(function(x){return x.dia>=F.desde&&x.dia<=F.hasta&&!dentro(x.hora,tr(x.dia))});
  var M=[['m','Solo por la mañana'],['t','Solo por la tarde'],['otras','Elijo yo las horas']];
  h='<div class="ed-h"><h2>Un día trabajo menos horas</h2><button type="button" class="x" data-cancela aria-label="Cerrar">×</button></div>'+
   paso(1,'¿Qué día?')+fechas()+
   paso(2,'¿Cuándo trabajas ese día?')+'<div class="modos" role="radiogroup" aria-label="Cuándo trabajas">'+M.map(function(m){return '<button type="button" role="radio" aria-checked="'+(F.cuando===m[0])+'" class="modo'+(F.cuando===m[0]?' on':'')+'" data-cuando="'+m[0]+'">'+m[1]+'</button>'}).join('')+'</div>'+
   (F.cuando==='otras'?'<div class="tr tr-o">'+F.tramos.map(function(x,j){return '<span class="tm"><span class="tm-l">De</span><input type="time" step="900" value="'+('0'+x[0]).slice(-5)+'" data-ot="'+j+'-0" aria-label="Desde"><i>a</i><input type="time" step="900" value="'+('0'+x[1]).slice(-5)+'" data-ot="'+j+'-1" aria-label="Hasta">'+(F.tramos.length>1?'<button type="button" data-oq="'+j+'" aria-label="Quitar este tramo">×</button>':'')+'</span>'}).join('')+(F.tramos.length<3?'<button type="button" class="b b-sm b-claro" data-om>+ Añadir otro rato</button>':'')+'</div>':'')+
   '<p class="resumen">'+(ks.length===1?(ks[0]==='Cerrado'?'Tu horario de ese día no tiene '+(F.cuando==='m'?'mañana':'tarde')+': no se darán citas.':'La web solo dará citas de '+ks[0]+'.'):ks.map(function(k){return g[k].map(function(d){return DC[ws(d)]+' '+pd(d).getDate()}).join(', ')+': '+(k==='Cerrado'?'sin citas':'de '+k)}).join('<br>'))+'</p>'+
   citasAviso(fuera,'Avísales para cambiarlas de hora.')+botones('Guardar');
 }
 else if(t==='horas'){
  var d3=F.desde,mot=cerrado(D.cfg,d3),cs3=delDia(d3),now=d3===D.hoy?mins(D.ahora.slice(11)):-1,hu=huecos(D.cfg,d3);
  h='<div class="ed-h"><h2>Quitar unas horas sueltas</h2><button type="button" class="x" data-cancela aria-label="Cerrar">×</button></div>'+
   paso(1,'¿Qué día?')+fechas(true)+
   paso(2,'Toca las horas que <u>no</u> quieres dar')+
   (mot?'<p class="vacio">Ese día ya no trabajas ('+esc(mot)+').</p>':'<div class="slots">'+hu.map(function(x){var c=cs3.filter(function(y){return y.hora===x})[0],on=F.horas.indexOf(x)>-1,pas=mins(x)<=now;
    return '<button type="button" class="sl'+(on?' on':'')+(c?' ci':'')+'" data-sl="'+x+'"'+(c||pas?' disabled':'')+' aria-pressed="'+on+'">'+x+'<small>'+(c?'cita':on?'quitada':'libre')+'</small></button>'}).join('')+'</div>'+
   '<p class="ayuda">Las que tienen cita no se pueden quitar. Cámbiala o cancélala antes.</p>'+
   paso(3,'Motivo <small>(opcional, solo lo ves tú)</small>')+'<input class="ed-in" data-bqmot maxlength="60" placeholder="Por ejemplo: médico" value="'+esc(F.bqMot)+'">'+
   '<p class="resumen">'+(F.horas.length?'Los clientes no podrán pedir: '+F.horas.join(', ')+'.':'No has quitado ninguna hora todavía.')+'</p>'+
   botones(F.horas.length?'Quitar '+(F.horas.length===1?'esta hora':'estas '+F.horas.length+' horas'):'Guardar'));
 }
 else if(t==='semana'){
  h='<div class="ed-h"><h2>Mi horario de siempre</h2><button type="button" class="x" data-cancela aria-label="Cerrar">×</button></div><p class="ayuda">Es el horario de cada semana. Para un día concreto usa los otros botones.</p>'+
   '<div class="hor">'+F.sem.map(function(d,i){var ab=d.length>0;
    return '<div class="hr'+(ab?'':' off')+'" data-hd="'+i+'"><b>'+DL[i]+'</b><label class="sw"><input type="checkbox" data-hab'+(ab?' checked':'')+'><span></span><em>'+(ab?'Trabajo':'Cerrado')+'</em></label>'+
    '<div class="tr">'+d.map(function(x,j){return '<span class="tm"><span class="tm-l">De</span><input type="time" step="900" value="'+('0'+x[0]).slice(-5)+'" data-t="'+j+'-0" aria-label="'+DL[i]+', desde"><i>a</i><input type="time" step="900" value="'+('0'+x[1]).slice(-5)+'" data-t="'+j+'-1" aria-label="'+DL[i]+', hasta">'+(d.length>1?'<button type="button" data-qt="'+j+'" aria-label="Quitar este rato">×</button>':'')+'</span>'}).join('')+
    (ab&&d.length<3?'<button type="button" class="b b-sm b-claro" data-mt>+ Otro rato</button>':'')+'</div></div>'}).join('')+'</div>'+
   '<label class="int">Dar citas cada <select data-int>'+[15,20,30,45,60].map(function(v){return '<option'+(v===F.int?' selected':'')+'>'+v+'</option>'}).join('')+'</select> minutos</label>'+
   botones('Guardar mi horario');
 }
 el.innerHTML=h;
}
var ED_=$('[data-ed]');
ED_.addEventListener('change',function(e){var x=e.target;
 if(x.matches('[data-f]')){F[x.dataset.f]=x.value||F[x.dataset.f];if(F.hasta<F.desde)F.hasta=F.desde;if(F.tipo==='horas'){var bq=bloqDe(D.cfg,F.desde);F.horas=bq?bq.horas.slice():[];F.bqMot=bq?bq.motivo||'':''}pintaEd();pintaCal();return}
 if(x.matches('[data-ot]')&&x.value){var p=x.dataset.ot.split('-');F.tramos[+p[0]][+p[1]]=x.value.replace(/^0/,'');pintaEd();return}
 var row=x.closest('[data-hd]');
 if(row){var i=+row.dataset.hd;if(x.matches('[data-hab]'))F.sem[i]=x.checked?[['10:00','14:00'],['16:00','20:00']]:[];else if(x.matches('[data-t]')&&x.value){var q=x.dataset.t.split('-');F.sem[i][+q[0]][+q[1]]=x.value.replace(/^0/,'')}pintaEd();return}
 if(x.matches('[data-int]'))F.int=+x.value});
ED_.addEventListener('input',function(e){var x=e.target;
 if(x.matches('[data-motx]')&&x.value.trim()){F.motivo=x.value.trim();$$('[data-mot]').forEach(function(m){m.classList.remove('on')})}
 if(x.matches('[data-bqmot]'))F.bqMot=x.value});
ED_.addEventListener('click',function(e){var t=e.target,c;
 if(t.closest('[data-cancela]')){cierraEd();return}
 if(t.closest('[data-ir]')){var d=F.desde;abreEd(t.closest('[data-ir]').dataset.ir,d);return}
 if(t.closest('[data-mot]')){F.motivo=t.closest('[data-mot]').dataset.mot;pintaEd();return}
 if(t.closest('[data-cuando]')){F.cuando=t.closest('[data-cuando]').dataset.cuando;pintaEd();return}
 if(t.closest('[data-om]')){var u=F.tramos[F.tramos.length-1],f=u?Math.min(mins(u[1])+60,1320):600;F.tramos.push([hhmm(f),hhmm(Math.min(f+120,1425))]);pintaEd();return}
 if(t.closest('[data-oq]')){F.tramos.splice(+t.closest('[data-oq]').dataset.oq,1);pintaEd();return}
 if(t.closest('[data-sl]')){var s=t.closest('[data-sl]').dataset.sl,k=F.horas.indexOf(s);if(k>-1)F.horas.splice(k,1);else F.horas.push(s);F.horas.sort(function(a,b){return mins(a)-mins(b)});pintaEd();return}
 var row=t.closest('[data-hd]');
 if(row&&t.closest('[data-qt]')){F.sem[+row.dataset.hd].splice(+t.closest('[data-qt]').dataset.qt,1);pintaEd();return}
 if(row&&t.closest('[data-mt]')){var i=+row.dataset.hd,u2=F.sem[i][F.sem[i].length-1],f2=u2?Math.min(mins(u2[1])+60,1380):600;F.sem[i].push([hhmm(f2),hhmm(Math.min(f2+120,1425))]);pintaEd();return}
 if(t.closest('[data-normal]')){c=clona(D.cfg);c.especiales=c.especiales||[];limpiaRango(c,F.desde,F.desde);guardaCfg(c,'Listo. Ese día vuelve a su horario normal en la web.');return}
 if(!t.closest('[data-ok]'))return;
 c=clona(D.cfg);c.especiales=c.especiales||[];c.bloqueos=c.bloqueos||[];
 if(F.tipo==='cerrar'){limpiaRango(c,F.desde,F.hasta);c.cierres.push({id:'n'+Date.now().toString(36),desde:F.desde,hasta:F.hasta,motivo:F.motivo||'Cerrado'});
  guardaCfg(c,(F.desde===F.hasta?'Día cerrado':'Días cerrados')+'. La web ya no deja pedir cita.')}
 else if(F.tipo==='menos'){
  if(F.cuando==='otras'&&(!F.tramos.length||F.tramos.some(function(r){return mins(r[0])>=mins(r[1])}))){aviso('Revisa las horas: cada rato tiene que empezar antes de terminar.');return}
  limpiaRango(c,F.desde,F.hasta);
  if(F.cuando==='otras')c.especiales.push({id:'e'+Date.now().toString(36),desde:F.desde,hasta:F.hasta,tramos:clona(F.tramos).sort(function(x,y){return mins(x[0])-mins(y[0])})});
  else diasDe(F.desde,F.hasta).forEach(function(d,i){c.especiales.push({id:'e'+Date.now().toString(36)+i,desde:d,hasta:d,tramos:manTar(d,F.cuando)})});
  guardaCfg(c,'Guardado. La web solo dará citas en esas horas.')}
 else if(F.tipo==='horas'){c.bloqueos=c.bloqueos.filter(function(x){return x.dia!==F.desde});if(F.horas.length)c.bloqueos.push({id:'b'+Date.now().toString(36),dia:F.desde,horas:F.horas.slice(),motivo:F.bqMot});
  guardaCfg(c,F.horas.length?'Horas quitadas. Los clientes ya no pueden pedirlas.':'Guardado. Ese día tiene todas sus horas.')}
 else if(F.tipo==='semana'){
  if(F.sem.some(function(d){return d.some(function(r){return mins(r[0])>=mins(r[1])})})){aviso('Revisa el horario: algún rato termina antes de empezar.');return}
  c.horario=F.sem;c.intervalo=F.int;guardaCfg(c,'Horario guardado. La web ya lo usa.')}
});
// ---------------------------------------------------------------- lista de citas
var fEst=$('[data-fest]');['Pendiente','Confirmada','Hecha','No vino','Cancelada'].forEach(function(e){var o=document.createElement('option');o.value=o.textContent=e;fEst.appendChild(o)});
function filtradas(){var q=$('[data-bus]').value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''),e=fEst.value,cu=$('[data-fcuando]').value;
 return D.citas.filter(function(x){if(e&&x.estado!==e)return false;if(cu==='prox'&&x.dia<D.hoy)return false;if(cu==='pas'&&x.dia>=D.hoy)return false;
  return !q||(x.nombre+' '+x.telefono+' '+x.servicio+' '+x.nota).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').indexOf(q)>-1})
  .sort(function(a,b){var k=(a.dia+a.hora.padStart(5,'0'))<(b.dia+b.hora.padStart(5,'0'))?-1:1;return cu==='pas'?-k:k})}
function pintaCitas(){var l=filtradas();
 $('[data-tcitas]').innerHTML=l.length?l.slice(0,300).map(function(x){return '<tr data-id="'+esc(x.id)+'" tabindex="0"><td>'+cap(DN[pd(x.dia).getDay()]).slice(0,3)+' '+corto(x.dia)+'</td><td>'+x.hora+'</td><td><b>'+esc(x.nombre)+'</b><small>'+esc(x.telefono)+'</small></td><td>'+esc(x.servicio)+'</td><td>'+pill(x.estado)+'</td><td class="mu">'+esc(x.origen)+'</td></tr>'}).join(''):'<tr><td colspan="6" class="vacio">No hay citas con esos filtros.</td></tr>';
 $('[data-tnota]').textContent=l.length+(l.length===1?' cita':' citas')+(l.length>300?' (se muestran las 300 primeras)':'');}
['[data-bus]','[data-fcuando]','[data-fest]'].forEach(function(s){$(s).addEventListener('input',pintaCitas)});
$('[data-tcitas]').addEventListener('click',function(e){var r=e.target.closest('[data-id]');if(r)abreCita(r.dataset.id)});
$('[data-tcitas]').addEventListener('keydown',function(e){if(e.key==='Enter'){var r=e.target.closest('[data-id]');if(r)abreCita(r.dataset.id)}});
$('[data-csv]').addEventListener('click',function(){var l=filtradas(),f=function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'};
 var csv='﻿Día;Hora;Cliente;Teléfono;Servicio;Precio;Estado;Nota;Origen\n'+l.map(function(x){return [x.dia.split('-').reverse().join('/'),x.hora,x.nombre,x.telefono,x.servicio,x.precio,x.estado,x.nota,x.origen].map(f).join(';')}).join('\n');
 var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='citas-kike-'+D.hoy+'.csv';document.body.appendChild(a);a.click();a.remove()});

// ---------------------------------------------------------------- estadísticas
function pintaStats(){
 var hoy=D.hoy,mes=hoy.slice(0,7),a=activas(),am=a.filter(function(x){return x.dia.slice(0,7)===mes});
 var euros=am.filter(function(x){return x.estado!=='No vino'}).reduce(function(s,x){return s+num(x.precio)},0);
 var hace30=add(hoy,-30),pas=D.citas.filter(function(x){return x.dia>=hace30&&x.dia<hoy&&x.estado!=='Cancelada'}),nv=pas.filter(function(x){return x.estado==='No vino'}).length;
 var cli={};a.forEach(function(x){var k=waNum(x.telefono)||x.nombre.toLowerCase();(cli[k]=cli[k]||{n:x.nombre,c:0,u:''}).c++;if(x.dia<=hoy&&x.dia>cli[k].u)cli[k].u=x.dia});
 var nc=Object.keys(cli).length;
 $('[data-skpis]').innerHTML='<div class="kpi"><small>Citas este mes</small><b>'+am.length+'</b><span>'+cap(MN[+mes.slice(5)-1])+'</span></div>'+
  '<div class="kpi"><small>Caja estimada del mes</small><b>'+Math.round(euros)+' €</b><span>orientativo, por precio de servicio</span></div>'+
  '<div class="kpi"><small>Clientes distintos</small><b>'+nc+'</b><span>desde que se usa el panel</span></div>'+
  '<div class="kpi"><small>No vinieron</small><b>'+(pas.length?Math.round(nv*100/pas.length):0)+' %</b><span>últimos 30 días</span></div>';
 var lun=lunesDe(hoy),sem=[];for(var i=7;i>=0;i--){var l=add(lun,-7*i),n=a.filter(function(x){return x.dia>=l&&x.dia<=add(l,6)}).length;sem.push([l,n])}
 var mx=Math.max.apply(null,sem.map(function(s){return s[1]}).concat([1]));
 $('[data-sem-bar]').innerHTML=sem.map(function(s,i){return '<div><b>'+s[1]+'</b><i style="--h:'+Math.round(s[1]*100/mx)+'%"'+(i===7?' class="act"':'')+'></i><span>'+(i===7?'Esta':corto(s[0]))+'</span></div>'}).join('');
 var sv={};a.forEach(function(x){var k=x.servicio||'Sin servicio';sv[k]=(sv[k]||0)+1});
 var sl=Object.keys(sv).map(function(k){return [k,sv[k]]}).sort(function(x,y){return y[1]-x[1]}).slice(0,6),sm=sl.length?sl[0][1]:1;
 $('[data-serv]').innerHTML=sl.length?sl.map(function(s){return '<li><span>'+esc(s[0])+'</span><i style="--w:'+Math.round(s[1]*100/sm)+'%"></i><b>'+s[1]+'</b></li>'}).join(''):'<li class="vacio">Aún no hay citas.</li>';
 var hs={};a.forEach(function(x){var h=x.hora.split(':')[0];hs[h]=(hs[h]||0)+1});
 var hk=Object.keys(hs).sort(function(x,y){return +x-+y}),hm=Math.max.apply(null,hk.map(function(k){return hs[k]}).concat([1]));
 $('[data-horas]').innerHTML=hk.length?hk.map(function(k){return '<div title="'+hs[k]+' citas"><i style="--o:'+(.15+.85*hs[k]/hm).toFixed(2)+'"><b>'+hs[k]+'</b></i><span>'+(+k)+'h</span></div>'}).join(''):'<p class="vacio">Aún no hay citas.</p>';
 var rp=Object.keys(cli).map(function(k){return cli[k]}).filter(function(x){return x.c>1}).sort(function(x,y){return y.c-x.c}).slice(0,6);
 $('[data-rep]').innerHTML=rp.length?rp.map(function(x){return '<li><b>'+esc(x.n)+'</b><span>'+x.c+' citas'+(x.u?' · última el '+corto(x.u):'')+'</span></li>'}).join(''):'<li class="vacio">Cuando un cliente repita, saldrá aquí.</li>';
}

// ---------------------------------------------------------------- cambiar estado desde las listas
document.addEventListener('change',function(e){if(!e.target.matches('[data-est]'))return;var li=e.target.closest('[data-id]'),id=li.dataset.id,est=e.target.value,s=e.target;
 s.className='est-s e-'+est.replace(' ','');s.disabled=true;
 api({a:'estado',id:id,estado:est}).then(function(r){if(!r.ok)throw r;D.citas.forEach(function(x){if(x.id===id)x.estado=est});pinta();aviso('Cita marcada como «'+est+'»')})
  .catch(function(r){aviso(msgErr(r));carga(1)})});
document.addEventListener('click',function(e){var li=e.target.closest('.it[data-id],.pd-l [data-id]');if(!li||e.target.closest('select,a'))return;abreCita(li.dataset.id)});

// ---------------------------------------------------------------- diálogo de cita
var dlg=$('[data-dlg]'),cf=$('[data-cform]');
cf.servicio.innerHTML=SERV.map(function(s){return '<option value="'+s[0]+'" data-p="'+s[1]+'">'+s[0]+'</option>'}).join('')+'<option value="">Otro / sin especificar</option>';
function horasDlg(actual){var d=cf.dia.value,sel=cf.hora,forz=cf.forzar.checked,er=$('[data-derr]');er.textContent='';if(!d){sel.innerHTML='';return}
 var mot=cerrado(D.cfg,d),bq=bloqDe(D.cfg,d),oc=delDia(d).filter(function(x){return x.id!==editId}).map(function(x){return x.hora}),p=D.cfg.intervalo||30,lst;
 if(forz){lst=[];for(var m=480;m<=1320;m+=p)lst.push(hhmm(m))}else lst=mot?[]:huecos(D.cfg,d);
 if(actual&&lst.indexOf(actual)<0)lst.push(actual);lst.sort(function(a,b){return mins(a)-mins(b)});
 var now=d===D.hoy?mins(D.ahora.slice(11)):-1;
 sel.innerHTML=lst.map(function(t){var o=oc.indexOf(t)>-1,b=bq&&bq.horas.indexOf(t)>-1,pas=mins(t)<=now&&!forz&&t!==actual;
  return '<option value="'+t+'"'+((o||b||pas)&&!forz?' disabled':'')+'>'+t+(o?' · ocupada':b?' · bloqueada':pas?' · ya pasó':'')+'</option>'}).join('');
 if(actual)sel.value=actual;else{var f=[].slice.call(sel.options).filter(function(o){return !o.disabled})[0];if(f)sel.value=f.value}
 if(mot&&!forz)er.textContent='Ese día está cerrado ('+mot+'). Marca la última casilla si aun así quieres apuntarla.';
 else if(!lst.length||![].slice.call(sel.options).some(function(o){return !o.disabled}))er.textContent='Ese día no quedan horas libres.';
}
cf.dia.addEventListener('change',function(){horasDlg()});cf.forzar.addEventListener('change',function(){horasDlg(cf.hora.value)});
function abreNueva(dia,hora){editId=null;cf.reset();$('#dlg-t').textContent='Nueva cita';$('[data-destado]').hidden=true;$('[data-dconf]').hidden=false;$('[data-dwa]').hidden=true;
 cf.dia.min=D.hoy;cf.dia.value=dia||D.hoy;horasDlg(hora);$('[data-dok]').textContent='Guardar cita';muestra();setTimeout(function(){cf.nombre.focus()},60)}
function abreCita(id){var x=D.citas.filter(function(c){return c.id===id})[0];if(!x)return;editId=id;cf.reset();
 $('#dlg-t').textContent=x.nombre;$('[data-dconf]').hidden=true;
 cf.nombre.value=x.nombre;cf.telefono.value=x.telefono;cf.servicio.value=x.servicio;cf.nota.value=x.nota;cf.dia.removeAttribute('min');cf.dia.value=x.dia;horasDlg(x.hora);
 var de=$('[data-destado]');de.hidden=false;de.innerHTML='<span>Estado</span>'+D.estados.map(function(e){return '<button type="button" class="chip e-'+e.replace(' ','')+(e===x.estado?' on':'')+'" data-de="'+e+'">'+e+'</button>'}).join('');
 var w=wa(x.telefono,waMsg(x)),a=$('[data-dwa]');a.hidden=!w;if(w)a.href=w;
 $('[data-dok]').textContent='Guardar cambios';muestra()}
function muestra(){if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','')}
function cierraDlg(){if(dlg.close)dlg.close();else dlg.removeAttribute('open')}
$$('[data-cerrar]',dlg).forEach(function(b){b.addEventListener('click',cierraDlg)});
dlg.addEventListener('click',function(e){if(e.target===dlg)cierraDlg()});
$('[data-destado]').addEventListener('click',function(e){var b=e.target.closest('[data-de]');if(!b)return;var est=b.dataset.de;
 api({a:'estado',id:editId,estado:est}).then(function(r){if(!r.ok)throw r;D.citas.forEach(function(x){if(x.id===editId)x.estado=est});$$('[data-de]').forEach(function(x){x.classList.toggle('on',x===b)});pinta();aviso('Cita marcada como «'+est+'»')}).catch(function(r){aviso(msgErr(r))})});
$('[data-nueva]').addEventListener('click',function(){abreNueva()});
cf.addEventListener('submit',function(e){e.preventDefault();var er=$('[data-derr]'),b=$('[data-dok]');
 if(!cf.nombre.value.trim()){er.textContent='Escribe el nombre del cliente.';cf.nombre.focus();return}
 if(!cf.hora.value){er.textContent='Elige una hora.';return}
 var o=cf.servicio.options[cf.servicio.selectedIndex];
 var body={a:editId?'editar':'nueva',id:editId,nombre:cf.nombre.value.trim(),telefono:cf.telefono.value.trim(),servicio:cf.servicio.value,precio:o?o.dataset.p||'':'',dia:cf.dia.value,hora:cf.hora.value,nota:cf.nota.value.trim(),confirmada:cf.confirmada.checked,forzar:cf.forzar.checked};
 b.disabled=true;er.textContent='';
 api(body).then(function(r){if(!r.ok)throw r;cierraDlg();aviso(editId?'Cita actualizada':'Cita guardada: '+largo(body.dia)+' a las '+body.hora);return carga(1)})
  .catch(function(r){er.textContent=msgErr(r)}).then(function(){b.disabled=false})});

// ---------------------------------------------------------------- prueba local sin servidor
var M=null;
function mock(b){
 if(!M){var h=fd(new Date()),c=[],N=['Carlos','Dani','Rubén','Álex','Marcos','Iván','Sergio','Pablo','Hugo','Adrián'],H=['10:00','11:00','12:30','16:30','17:30','19:00'],k=0;
  for(var d=-14;d<=6;d++){var dia=add(h,d);if(ws(dia)===6)continue;for(var j=0;j<3;j++){var s=SERV[(k+j)%5];c.push({id:'m'+k+j,creada:'',dia:dia,hora:H[(k+j*2)%6],servicio:s[0],precio:s[1],nombre:N[(k+j)%10]+' (ejemplo)',telefono:'600000000',nota:'',estado:d<0?(j===2&&k%3===0?'No vino':'Hecha'):(j===0?'Pendiente':'Confirmada'),origen:'Ejemplo'})}k++}
  M={cfg:{horario:[[['10:00','14:00'],['16:00','20:00']],[['10:00','14:00'],['16:00','20:00']],[['10:00','14:00'],['16:00','20:00']],[['10:00','14:00'],['16:00','20:00']],[['10:00','14:00'],['16:00','20:00']],[['10:00','14:00'],['16:00','20:00']],[['10:00','15:00']]],cierres:[{id:'x',desde:add(h,9),hasta:add(h,12),motivo:'Vacaciones'}],especiales:[],bloqueos:[],intervalo:30},citas:c}}
 if(b.a==='login')return {ok:b.pin==='123456',error:'pin'};
 if(b.a==='panel'){var n=new Date();return {ok:true,hoy:fd(n),ahora:fd(n)+' '+('0'+n.getHours()).slice(-2)+':'+('0'+n.getMinutes()).slice(-2),cfg:JSON.parse(JSON.stringify(M.cfg)),citas:JSON.parse(JSON.stringify(M.citas)),estados:['Pendiente','Confirmada','Hecha','Cancelada','No vino'],maxDias:60}}
 if(b.a==='guardar'){M.cfg=JSON.parse(JSON.stringify(b.cfg));return {ok:true,cfg:M.cfg}}
 if(b.a==='estado'){M.citas.forEach(function(x){if(x.id===b.id)x.estado=b.estado});return {ok:true}}
 if(b.a==='nueva'){M.citas.push({id:'n'+Date.now(),dia:b.dia,hora:b.hora,servicio:b.servicio,precio:b.precio,nombre:b.nombre,telefono:b.telefono,nota:b.nota,estado:b.confirmada?'Confirmada':'Pendiente',origen:'Panel'});return {ok:true}}
 if(b.a==='editar'){M.citas.forEach(function(x){if(x.id===b.id){x.dia=b.dia;x.hora=b.hora;x.nombre=b.nombre;x.telefono=b.telefono;x.servicio=b.servicio;x.nota=b.nota}});return {ok:true}}
 return {ok:false};
}

// ---------------------------------------------------------------- arranque
PIN=leePin();
if(PIN){api({a:'login'}).then(function(r){if(r.ok)entra();else{guardaPin('');$('[data-lform] input').focus()}}).catch(function(){})}
else $('[data-lform] input').focus();
})();

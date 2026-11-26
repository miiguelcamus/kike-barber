/**
 * Kike barber shop · citas y disponibilidad
 *
 * Qué hace:
 *   - Guarda el horario, los días cerrados (vacaciones, festivos…) y las horas bloqueadas.
 *   - La web lo lee y no deja pedir cita en días cerrados ni en horas ocupadas.
 *   - Guarda cada cita en una hoja de cálculo y, si se activa, avisa por correo.
 *   - El panel privado (panel.html) lo gestiona todo con un PIN.
 *
 * Puesta en marcha:
 *   1. Ejecuta instalar() una vez. Crea la hoja, el horario inicial y el PIN
 *      (lo verás en el registro de ejecución y en Configuración → Propiedades del script).
 *   2. Implementar → Nueva implementación → Aplicación web
 *        Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario
 *   3. Copia la URL /exec en la web (window.KK_API).
 *
 * Propiedades del script opcionales:
 *   AVISAR_A = correo@ejemplo.com  → manda un correo con cada cita nueva.
 */

var TZ = 'Europe/Madrid';
var NEGOCIO = 'Kike barber shop';
var COLS = ['ID', 'Creada', 'Día', 'Hora', 'Servicio', 'Precio', 'Nombre', 'Teléfono', 'Nota', 'Estado', 'Origen'];
var ESTADOS = ['Pendiente', 'Confirmada', 'Hecha', 'Cancelada', 'No vino'];
var HORARIO_INICIAL = [ // lunes = 0
  [['10:00', '14:00'], ['16:00', '20:00']], [['10:00', '14:00'], ['16:00', '20:00']],
  [['10:00', '14:00'], ['16:00', '20:00']], [['10:00', '14:00'], ['16:00', '20:00']],
  [['10:00', '14:00'], ['16:00', '20:00']], [['10:00', '14:00'], ['16:00', '20:00']],
  [['10:00', '15:00']]
];
var MAX_DIAS = 60;

function props_() { return PropertiesService.getScriptProperties(); }

function instalar() {
  var p = props_();
  var ss = null, id = p.getProperty('SS_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(NEGOCIO + ' · Citas'); p.setProperty('SS_ID', ss.getId()); }
  var sh = ss.getSheetByName('Citas') || ss.insertSheet('Citas');
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#141110').setFontColor('#F2EADF');
    sh.setFrozenRows(1);
    sh.getRange('A:K').setNumberFormat('@');
  }
  var h1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (h1 && ss.getSheets().length > 1) ss.deleteSheet(h1);
  if (!p.getProperty('CFG')) p.setProperty('CFG', JSON.stringify({ horario: HORARIO_INICIAL, cierres: [], bloqueos: [], intervalo: 30 }));
  if (!p.getProperty('PIN')) p.setProperty('PIN', String(Math.floor(100000 + Math.random() * 900000)));
  Logger.log('Hoja: ' + ss.getUrl());
  Logger.log('PIN del panel: ' + p.getProperty('PIN'));
}

// ------------------------------------------------------------------ utilidades
function cfg_() { return JSON.parse(props_().getProperty('CFG') || '{}'); }
function hoja_() { return SpreadsheetApp.openById(props_().getProperty('SS_ID')).getSheetByName('Citas'); }
function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function ahora_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function mins_(h) { var p = String(h).split(':'); return +p[0] * 60 + +p[1]; }
function hhmm_(m) { return Math.floor(m / 60) + ':' + ('0' + m % 60).slice(-2); }
function fecha_(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
function sumaDias_(s, n) { var d = fecha_(s); d.setDate(d.getDate() + n); return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function diaSemana_(s) { return (fecha_(s).getDay() + 6) % 7; } // lunes = 0
function esFecha_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
function esHora_(s) { return /^\d{1,2}:\d{2}$/.test(String(s)); }
function limpia_(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 120); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function citas_() {
  var sh = hoja_(), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, COLS.length).getDisplayValues().map(function (r, i) {
    return { fila: i + 2, id: r[0], creada: r[1], dia: r[2], hora: r[3], servicio: r[4], precio: r[5], nombre: r[6], telefono: r[7], nota: r[8], estado: r[9], origen: r[10] };
  });
}

function cerrado_(c, dia) {
  for (var i = 0; i < (c.cierres || []).length; i++) {
    var x = c.cierres[i];
    if (dia >= x.desde && dia <= x.hasta) return x.motivo || 'Cerrado';
  }
  return horarioDe_(c, dia).length ? '' : 'Cerrado ese día';
}

function espDe_(c, dia) {
  var l = c.especiales || [];
  for (var i = 0; i < l.length; i++) if (dia >= l[i].desde && dia <= l[i].hasta) return l[i];
  return null;
}

// horario real de un día: cerrado, horario especial o el de cada semana
function horarioDe_(c, dia) {
  for (var i = 0; i < (c.cierres || []).length; i++) if (dia >= c.cierres[i].desde && dia <= c.cierres[i].hasta) return [];
  var e = espDe_(c, dia);
  return e ? e.tramos : (c.horario[diaSemana_(dia)] || []);
}

function horaValida_(c, dia, hora) {
  var m = mins_(hora), paso = c.intervalo || 30;
  return horarioDe_(c, dia).some(function (r) { return m >= mins_(r[0]) && m + paso <= mins_(r[1]) && (m - mins_(r[0])) % paso === 0; });
}

function bloqueada_(c, dia, hora) {
  return (c.bloqueos || []).some(function (b) { return b.dia === dia && (b.horas || []).indexOf(hora) > -1; });
}

function ocupadas_(desde) {
  var o = {};
  citas_().forEach(function (x) {
    if (x.dia >= desde && x.estado !== 'Cancelada') (o[x.dia] = o[x.dia] || []).push(x.hora);
  });
  return o;
}

// ------------------------------------------------------------------ web pública
function doGet(e) {
  var a = e && e.parameter && e.parameter.a;
  if (a === 'disp') {
    var c = cfg_(), hoy = hoy_();
    return json_({
      ok: true, hoy: hoy, horario: c.horario, intervalo: c.intervalo || 30, maxDias: MAX_DIAS,
      cierres: (c.cierres || []).filter(function (x) { return x.hasta >= hoy; }).map(function (x) { return { desde: x.desde, hasta: x.hasta, motivo: x.motivo }; }),
      especiales: (c.especiales || []).filter(function (x) { return x.hasta >= hoy; }).map(function (x) { return { desde: x.desde, hasta: x.hasta, tramos: x.tramos }; }),
      bloqueos: (c.bloqueos || []).filter(function (x) { return x.dia >= hoy; }).map(function (x) { return { dia: x.dia, horas: x.horas }; }),
      ocupadas: ocupadas_(hoy)
    });
  }
  return json_({ ok: true, servicio: 'citas ' + NEGOCIO });
}

function doPost(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'formato' }); }
  try {
    if (b.a === 'cita') return json_(nuevaCita_(b, 'Web'));
    if (!pinOk_(b.pin)) return json_({ ok: false, error: 'pin' });
    if (b.a === 'login') return json_({ ok: true });
    if (b.a === 'panel') return json_(panel_());
    if (b.a === 'guardar') return json_(guardaCfg_(b.cfg));
    if (b.a === 'nueva') return json_(nuevaCita_(b, 'Panel'));
    if (b.a === 'estado') return json_(cambiaEstado_(b.id, b.estado));
    if (b.a === 'editar') return json_(editaCita_(b));
    return json_({ ok: false, error: 'accion' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

// ------------------------------------------------------------------ panel (con PIN)
function pinOk_(pin) {
  var cache = CacheService.getScriptCache(), fallos = +(cache.get('fallos') || 0);
  if (fallos >= 12) return false;
  if (String(pin || '') === props_().getProperty('PIN')) return true;
  cache.put('fallos', String(fallos + 1), 900);
  return false;
}

function panel_() {
  var c = cfg_();
  return { ok: true, hoy: hoy_(), ahora: ahora_(), cfg: c, citas: citas_().map(function (x) { delete x.fila; return x; }), estados: ESTADOS, maxDias: MAX_DIAS };
}

function guardaCfg_(n) {
  if (!n || !n.horario || n.horario.length !== 7) return { ok: false, error: 'horario' };
  var horario = n.horario.map(function (d) {
    return (d || []).filter(function (r) { return esHora_(r[0]) && esHora_(r[1]) && mins_(r[0]) < mins_(r[1]); }).slice(0, 3).map(function (r) { return [r[0], r[1]]; });
  });
  var cierres = (n.cierres || []).filter(function (x) { return esFecha_(x.desde) && esFecha_(x.hasta) && x.desde <= x.hasta; })
    .map(function (x) { return { id: limpia_(x.id, 20) || Utilities.getUuid().slice(0, 8), desde: x.desde, hasta: x.hasta, motivo: limpia_(x.motivo, 60) || 'Cerrado' }; }).slice(0, 200);
  var bloqueos = (n.bloqueos || []).filter(function (x) { return esFecha_(x.dia) && (x.horas || []).length; })
    .map(function (x) { return { id: limpia_(x.id, 20) || Utilities.getUuid().slice(0, 8), dia: x.dia, horas: x.horas.filter(esHora_).slice(0, 40), motivo: limpia_(x.motivo, 60) }; }).slice(0, 300);
  var especiales = (n.especiales || []).filter(function (x) { return esFecha_(x.desde) && esFecha_(x.hasta) && x.desde <= x.hasta; })
    .map(function (x) { return { id: limpia_(x.id, 24) || Utilities.getUuid().slice(0, 8), desde: x.desde, hasta: x.hasta, tramos: (x.tramos || []).filter(function (r) { return esHora_(r[0]) && esHora_(r[1]) && mins_(r[0]) < mins_(r[1]); }).slice(0, 3).map(function (r) { return [r[0], r[1]]; }) }; }).slice(0, 400);
  var c = { horario: horario, cierres: cierres, especiales: especiales, bloqueos: bloqueos, intervalo: [15, 20, 30, 45, 60].indexOf(+n.intervalo) > -1 ? +n.intervalo : 30 };
  props_().setProperty('CFG', JSON.stringify(c));
  return { ok: true, cfg: c };
}

function nuevaCita_(b, origen) {
  var dia = String(b.dia || ''), hora = String(b.hora || ''), nombre = limpia_(b.nombre, 60), tel = limpia_(b.telefono, 30);
  if (!esFecha_(dia) || !esHora_(hora)) return { ok: false, error: 'fecha' };
  if (!nombre) return { ok: false, error: 'nombre' };
  if (origen === 'Web' && !tel) return { ok: false, error: 'telefono' };
  var c = cfg_(), hoy = hoy_(), forzar = origen === 'Panel' && b.forzar;
  if (dia < hoy) return { ok: false, error: 'pasado' };
  if (dia === hoy && mins_(hora) <= mins_(Utilities.formatDate(new Date(), TZ, 'HH:mm')) && !forzar) return { ok: false, error: 'pasado' };
  if (dia > sumaDias_(hoy, MAX_DIAS) && origen === 'Web') return { ok: false, error: 'lejos' };
  if (!forzar) {
    var mot = cerrado_(c, dia);
    if (mot) return { ok: false, error: 'cerrado', motivo: mot };
    if (!horaValida_(c, dia, hora)) return { ok: false, error: 'hora' };
    if (bloqueada_(c, dia, hora)) return { ok: false, error: 'ocupada' };
  }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, error: 'ocupado' }; }
  try {
    if (!forzar && (ocupadas_(dia)[dia] || []).indexOf(hora) > -1) return { ok: false, error: 'ocupada' };
    var id = Utilities.getUuid().slice(0, 8);
    var estado = origen === 'Panel' ? (b.confirmada ? 'Confirmada' : 'Pendiente') : 'Pendiente';
    hoja_().appendRow([id, ahora_(), dia, hora, limpia_(b.servicio, 60), limpia_(b.precio, 12), nombre, tel, limpia_(b.nota, 300), estado, origen]);
    if (origen === 'Web') { try { avisa_(b, dia, hora, nombre, tel); } catch (e) {} }
    return { ok: true, id: id };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

function busca_(id) {
  var cs = citas_();
  for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
  return null;
}

function cambiaEstado_(id, estado) {
  if (ESTADOS.indexOf(estado) < 0) return { ok: false, error: 'estado' };
  var x = busca_(String(id));
  if (!x) return { ok: false, error: 'noexiste' };
  hoja_().getRange(x.fila, 10).setValue(estado);
  return { ok: true };
}

function editaCita_(b) {
  var x = busca_(String(b.id));
  if (!x) return { ok: false, error: 'noexiste' };
  var dia = esFecha_(b.dia) ? b.dia : x.dia, hora = esHora_(b.hora) ? b.hora : x.hora;
  if ((dia !== x.dia || hora !== x.hora) && !b.forzar) {
    var c = cfg_(), mot = cerrado_(c, dia);
    if (mot) return { ok: false, error: 'cerrado', motivo: mot };
    if (bloqueada_(c, dia, hora) || (ocupadas_(dia)[dia] || []).indexOf(hora) > -1) return { ok: false, error: 'ocupada' };
  }
  hoja_().getRange(x.fila, 3, 1, 7).setValues([[dia, hora, limpia_(b.servicio != null ? b.servicio : x.servicio, 60), x.precio, limpia_(b.nombre || x.nombre, 60), limpia_(b.telefono != null ? b.telefono : x.telefono, 30), limpia_(b.nota != null ? b.nota : x.nota, 300)]]);
  return { ok: true };
}

function avisa_(b, dia, hora, nombre, tel) {
  var para = props_().getProperty('AVISAR_A');
  if (!para) return;
  var d = String(tel).replace(/\D/g, ''); if (d.length === 9) d = '34' + d;
  var txt = 'Hola ' + nombre.split(' ')[0] + ', soy Kike. Te confirmo la cita el ' + dia.split('-').reverse().join('/') + ' a las ' + hora + '.';
  MailApp.sendEmail({
    to: para, name: NEGOCIO,
    subject: 'Cita nueva · ' + dia.split('-').reverse().join('/') + ' ' + hora + ' · ' + nombre,
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#141110"><h2 style="margin:0 0 12px">Cita nueva</h2>' +
      '<p><b>' + nombre + '</b> · ' + (b.servicio || '') + '<br>' + dia.split('-').reverse().join('/') + ' a las ' + hora + '<br>' + tel + '</p>' +
      (d ? '<p><a href="https://wa.me/' + d + '?text=' + encodeURIComponent(txt) + '" style="display:inline-block;background:#25D366;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:bold">Confirmar por WhatsApp</a></p>' : '') + '</div>'
  });
}

// ------------------------------------------------------------------ datos de ejemplo
/** Añade citas de ejemplo (marcadas como tales) para enseñar el panel. */
function crearEjemplos() {
  var hoy = hoy_(), sh = hoja_(), filas = [];
  var N = ['Carlos', 'Dani', 'Rubén', 'Álex', 'Marcos', 'Iván', 'Sergio', 'Pablo', 'Hugo', 'Adrián', 'Javi', 'Leo', 'Óscar', 'Mario'];
  var S = [['Corte de pelo', '12'], ['Degradado', '14'], ['Corte + barba', '18'], ['Arreglo de barba', '8'], ['Corte infantil', '10']];
  var H = ['10:00', '10:30', '11:30', '12:00', '13:00', '16:30', '17:00', '18:00', '18:30', '19:30'];
  var k = 0;
  for (var dd = -20; dd <= 9; dd++) {
    var dia = sumaDias_(hoy, dd), ws = diaSemana_(dia);
    if (ws === 6) continue;
    var n = dd < 0 ? 2 + (k % 3) : 3 + (k % 3);
    for (var j = 0; j < n; j++) {
      var s = S[(k + j) % S.length], h = H[(k * 3 + j * 4) % H.length];
      var est = dd < 0 ? (j % 7 === 6 ? 'No vino' : 'Hecha') : (j % 3 === 0 ? 'Pendiente' : 'Confirmada');
      filas.push([Utilities.getUuid().slice(0, 8), ahora_(), dia, h, s[0], s[1], N[(k + j) % N.length] + ' (ejemplo)', '600 000 0' + ('0' + ((k + j) % 100)).slice(-2), '', est, 'Ejemplo']);
    }
    k++;
  }
  var seen = {}; filas = filas.filter(function (f) { var key = f[2] + f[3]; if (seen[key]) return false; seen[key] = 1; return true; });
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, COLS.length).setValues(filas);
  Logger.log('Citas de ejemplo: ' + filas.length);
}

/** Borra todas las citas de ejemplo. */
function borrarEjemplos() {
  var sh = hoja_(), cs = citas_(), n = 0;
  for (var i = cs.length - 1; i >= 0; i--) if (cs[i].origen === 'Ejemplo' || /\(ejemplo\)|prueba/i.test(cs[i].nombre)) { sh.deleteRow(cs[i].fila); n++; }
  Logger.log('Borradas: ' + n);
}

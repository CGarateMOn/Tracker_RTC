/* =================================================================
   Pega aquí la URL /exec del Apps Script. Con el valor de fábrica
   la página funciona con datos de ejemplo.
================================================================= */
const API_URL = 'https://script.google.com/macros/s/AKfycbwCM_bRu-hi0G5x822DMGd1HQsE2HbcogclQN5Z5WdsgVekWF1HWMa7I4M9PjkhC7_e/exec';

const K_DATOS='rtc-datos-v2', K_FILT='rtc-filtros-v2', K_FAV='rtc-favoritas-v2', K_GATE='rtc-gate-v1', K_SEG='rtc-seguimiento-v1', K_INTRO='rtc-intro-v1', K_PROMO='rtc-promo-v1', K_NOVEDAD='rtc-novedad-eventos-v1';

const PRACTICAS=['Estrategia','Consultoría de Negocio','Tecnología y AI','Financiero y M&A'];
const MOD_P=['Summer','Off-cycle'];
const MOD_F=['Graduate programme','Entrada directa'];
/* los eventos reutilizan la columna Modalidad de la hoja para guardar su
   FORMATO. Mismo campo, misma maquinaria de filtrado/conteo: solo cambia
   el vocabulario y la etiqueta con la que se enseña. */
const MOD_E=['Presencial','Online','Híbrido'];
const PLAZOS=['Fecha fija','Rolling','Sin publicar'];
const CURSOS=['Todos','Penúltimo año','Solo máster'];
const ESTADOS=['Abierta','Próximamente','Cerrada'];
/* con qué se arranca y a qué se vuelve al quitar filtros: lo abierto y
   lo que está por abrir, nunca lo ya cerrado */
const ESTADO_POR_DEFECTO=['Abierta','Próximamente'];
/* los filtros de conjunto que limpia limpiarFiltros(). 'estado' va
   aparte porque no se vacía, se devuelve a su valor por defecto. */
const CAMPOS_FILTRO=['practica','modalidad','ciudad','empresa','plazo','curso','seg'];

/* la hoja sigue mandando "Entrada directa": esto solo traduce cómo se
   ENSEÑA la modalidad (filtro y tarjetas), nunca el valor que se filtra,
   cuenta o guarda — ese sigue siendo el de la hoja. */
const ETIQ_MODALIDAD={'Entrada directa':'Full time'};

const DEMO={actualizado:new Date().toISOString(),ofertas:[
 {id:'RTC-0001',empresa:'McKinsey & Company',descripcion:'Business Analyst',tipo:'Tiempo completo',practica:'Estrategia',modalidad:'Graduate programme',estado:'Abierta',ciudad:'Madrid Barcelona',curso:'',tipoPlazo:'Rolling',deadline:'',link:'#',alta:'2026-08-01'},
 {id:'RTC-0002',empresa:'QuantumBlack',descripcion:'Data Scientist Intern',tipo:'Prácticas',practica:'Tecnología y AI',modalidad:'Summer',estado:'Abierta',ciudad:'Madrid',curso:'Penúltimo año',tipoPlazo:'Fecha fija',deadline:'2026-08-18',link:'#',alta:'2026-08-05'},
 {id:'RTC-0003',empresa:'Bain & Company',descripcion:'Associate Consultant Intern',tipo:'Prácticas',practica:'Estrategia',modalidad:'Summer',estado:'Próximamente',ciudad:'Madrid',curso:'Penúltimo año',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-07-28'},
 {id:'RTC-0004',empresa:'Monitor Deloitte',descripcion:'Strategy Analyst',tipo:'Tiempo completo',practica:'Estrategia',modalidad:'Entrada directa',estado:'Abierta',ciudad:'Barcelona',curso:'',tipoPlazo:'Fecha fija',deadline:'2026-09-30',link:'#',alta:'2026-08-02'},
 {id:'RTC-0005',empresa:'Deloitte',descripcion:'Financial Advisory, M&A Intern',tipo:'Prácticas',practica:'Financiero y M&A',modalidad:'Off-cycle',estado:'Abierta',ciudad:'Madrid',curso:'Todos',tipoPlazo:'Rolling',deadline:'',link:'#',alta:'2026-08-09'},
 {id:'RTC-0006',empresa:'KPMG',descripcion:'Audit Graduate Programme',tipo:'Tiempo completo',practica:'Auditoría & Legal',modalidad:'Graduate programme',estado:'Cerrada',ciudad:'Madrid',curso:'',tipoPlazo:'Fecha fija',deadline:'2026-06-15',link:'#',alta:'2026-05-01'},
 {id:'RTC-0007',empresa:'Accenture',descripcion:'Technology Consulting Intern',tipo:'Prácticas',practica:'Tecnología y AI',modalidad:'Summer',estado:'Abierta',ciudad:'Bilbao',curso:'Todos',tipoPlazo:'Fecha fija',deadline:'2026-08-14',link:'#',alta:'2026-08-10'},
 {id:'RTC-0008',empresa:'EY-Parthenon',descripcion:'Summer Intern',tipo:'Prácticas',practica:'Estrategia',modalidad:'Summer',estado:'Próximamente',ciudad:'Madrid',curso:'Solo máster',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-08-11'},
 {id:'RTC-0009',empresa:'Strategy&',descripcion:'Consulting Intern',tipo:'Prácticas',practica:'Estrategia',modalidad:'Summer',estado:'Abierta',ciudad:'Valencia',curso:'Penúltimo año',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-08-11'},
 {id:'RTC-0010',empresa:'Road to Consulting',descripcion:'Taller de casos: profit & loss',tipo:'Evento',practica:'Estrategia',modalidad:'Online',estado:'Abierta',ciudad:'Online',curso:'',tipoPlazo:'Fecha fija',deadline:'2026-09-28',link:'#',alta:'2026-09-12'},
 {id:'RTC-0011',empresa:'Bain & Company',descripcion:'Women in Consulting · networking',tipo:'Evento',practica:'Estrategia',modalidad:'Presencial',estado:'Abierta',ciudad:'Madrid',curso:'',tipoPlazo:'Fecha fija',deadline:'2026-10-15',link:'#',alta:'2026-09-14'},
 {id:'RTC-0012',empresa:'Accenture',descripcion:'Open day de tecnología',tipo:'Evento',practica:'Tecnología y AI',modalidad:'Híbrido',estado:'Próximamente',ciudad:'Barcelona',curso:'',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-09-15'}
]};

const HOY=new Date(); HOY.setHours(0,0,0,0);
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let TODAS=[];
/* guardadas: claves de OFERTA (claveOferta), no de empresa. Guardar
   una oferta de McKinsey no marca todas las de McKinsey. */
let FAV=new Set();
/* estado de candidatura por OFERTA:
   clave de oferta → 'aplicada'|'entrevista'|'oferta'|'rechazada'.
   La ausencia de clave es "sin seguimiento" y no se persiste. */
let SEG={};
const S={gate:null,practica:new Set(),modalidad:new Set(),ciudad:new Set(),empresa:new Set(),
         plazo:new Set(),curso:new Set(),estado:new Set(ESTADO_POR_DEFECTO),seg:new Set(),
         soloFav:false,orden:'plazo',q:''};

/* ---------- normalización ---------- */
function norm(o){
  const g=(...k)=>{for(const n of k){const v=o[n];if(v!=null&&String(v).trim()!=='')return String(v).trim();}return '';};
  let tipo=g('tipo','Tipo de Oferta');
  /* "Evento" va el primero: es el único tipo que no es una oferta de
     trabajo, y así no puede colarse por los patrones de abajo. */
  if(/^evento|^event\b|charla|webinar|workshop|taller|networking|masterclass|open day/i.test(tipo))tipo='Evento';
  else if(/intern|práctic|practic/i.test(tipo))tipo='Prácticas';
  else if(/full|completo/i.test(tipo))tipo='Contrato laboral';
  let est=g('estado','Estado');
  if(/^cerrad/i.test(est))est='Cerrada';
  else if(/^abiert|^en curso/i.test(est))est='Abierta';
  else if(/^no inici|^próxim|^proxim/i.test(est))est='Próximamente';
  /* en los eventos la columna Modalidad es el formato: se lleva al
     vocabulario de MOD_E igual que tipo/estado, para que el filtro y los
     contadores cuadren con lo que escriba la hoja ("On-line",
     "En persona", "in person", "híbrido"...). */
  let modalidad=g('modalidad','Modalidad');
  if(tipo==='Evento'){
    if(/presencial|en.?persona|in.?person/i.test(modalidad))modalidad='Presencial';
    else if(/on.?line|virtual|remoto|webinar|streaming/i.test(modalidad))modalidad='Online';
    else if(/h[íi]brid|mixto/i.test(modalidad))modalidad='Híbrido';
  }
  const ciudad=g('ciudad','Ciudad');
  return {id:g('id','ID'),empresa:g('empresa','Empresa'),descripcion:g('descripcion','Descripción'),
    tipo,estado:est,ciudad,ciudades:ciudad.split(/\s+/).filter(Boolean),link:g('link','Link'),deadline:g('deadline','Deadline'),
    practica:g('practica','Práctica'),modalidad,curso:g('curso','Curso'),
    tipoPlazo:g('tipoPlazo','Tipo de plazo'),alta:g('alta','Fecha de alta')};
}

/* =================================================================
   COLORES DE MARCA
   Una entrada por MATRIZ. Todas sus ramas comparten color, aunque en
   el tablón sigan apareciendo como empresas distintas: QuantumBlack
   con el azul de McKinsey, BCG X y BCG Gamma con el verde de BCG,
   Monitor Deloitte con el verde de Deloitte, EY-Parthenon con el
   amarillo de EY, Strategy& con el naranja de PwC…
   Basta con listar la matriz: cualquier nombre que la contenga
   ("Bain Vector", "Deloitte Digital") hereda el color. Solo necesitan
   clave propia las ramas que NO llevan dentro el nombre de la matriz
   (QuantumBlack, Strategy&, Sogeti, everis…).
   Las marcas no listadas reciben un color estable derivado del nombre,
   así que añadir empresas a la hoja nunca rompe nada.
================================================================= */
const MARCAS = [
  /* --- casa: eventos organizados por RTC --- */
  {matriz:'Road to Consulting', color:'#004E54',
   ramas:['rtc','road to consulting','talentum']},

  /* --- estrategia --- */
  {matriz:'McKinsey & Company', color:'#2251FF',
   ramas:['mckinsey','quantumblack','quantum black','mckinsey digital','orphoz']},

  {matriz:'Boston Consulting Group', color:'#177B57',
   ramas:['bcg','boston consulting','bcg x','bcg gamma','bcg platinion','platinion',
          'bcg digital ventures','inverto']},

  {matriz:'Bain & Company', color:'#CC0000',
   ramas:['bain','bain vector','vector','bain digital']},

  {matriz:'Kearney',       color:'#7A2E3B', ramas:['kearney','a t kearney']},
  {matriz:'Oliver Wyman',  color:'#0083C1', ramas:['oliver wyman','oliver wyman nera','nera']},
  {matriz:'Roland Berger', color:'#009B77', ramas:['roland berger']},
  {matriz:'L.E.K.',        color:'#00539B', ramas:['l e k','lek']},
  {matriz:'Arthur D. Little', color:'#12A9BF', ramas:['arthur d little']},
  {matriz:'Advancy',         color:'#B8860B', ramas:['advancy']},

  /* --- big four --- */
  {matriz:'Deloitte', color:'#86BC25',
   ramas:['deloitte','monitor deloitte','monitor','deloitte digital']},

  {matriz:'EY', color:'#FFE600',
   ramas:['ey','ey parthenon','parthenon','ernst & young']},

  {matriz:'PwC', color:'#D04A02',
   ramas:['pwc','strategy&','strategy and','pricewaterhousecoopers']},

  {matriz:'KPMG', color:'#00338D', ramas:['kpmg']},

  /* --- tecnología --- */
  {matriz:'Accenture', color:'#A100FF',
   ramas:['accenture','accenture song','accenture strategy','avanade']},

  {matriz:'Capgemini', color:'#0070AD',
   ramas:['capgemini','capgemini invent','sogeti','altran','frog']},

  {matriz:'IBM',      color:'#0F62FE', ramas:['ibm','ibm ix','red hat']},
  {matriz:'NTT DATA', color:'#0075C2', ramas:['ntt','ntt data','everis']},
  {matriz:'Indra',    color:'#6E2585', ramas:['indra','minsait']},

  /* --- reestructuración y otras --- */
  {matriz:'Alvarez & Marsal', color:'#005587', ramas:['alvarez','alvarez & marsal']},
  {matriz:'AlixPartners',     color:'#E4002B', ramas:['alixpartners','alix']},
  {matriz:'FTI Consulting',   color:'#003463', ramas:['fti consulting','fti']},
  {matriz:'Grant Thornton',   color:'#4B286D', ramas:['grant thornton']},
  {matriz:'BDO',              color:'#ED1A3B', ramas:['bdo']},
  {matriz:'Forvis Mazars',    color:'#0033A1', ramas:['mazars','forvis']},
  {matriz:'RSM',              color:'#3F9C35', ramas:['rsm']}
];

const sinAcentos=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

/* "EY-Parthenon" → " ey parthenon " · "Strategy&" → " strategy & "
   Los espacios de los extremos permiten comparar por palabra entera:
   así "ey" reconoce a EY pero no a Kearn-ey ni a McKins-ey. */
const enPalabras=s=>' '+sinAcentos(s).replace(/&/g,' & ').replace(/[^a-z0-9&]+/g,' ').trim()+' ';

/* rama → color, de la clave más específica a la más genérica */
const CLAVES=MARCAS
  .flatMap(m=>m.ramas.map(r=>[enPalabras(r),m.color]))
  .sort((a,b)=>b[0].length-a[0].length);

function colorMarca(nombre){
  const n=enPalabras(nombre);
  for(const [clave,hex] of CLAVES) if(n.includes(clave)) return hex;
  /* reserva: tono estable a partir del nombre, dentro de la paleta */
  let h=0; for(let i=0;i<n.length;i++) h=(h*31+n.charCodeAt(i))%360;
  return `hsl(${h} 42% 38%)`;
}

/* clave estable por oferta para el seguimiento (SEG). Usa el ID de la
   hoja si existe; si no, una combinación de campos que rara vez
   cambia. Si esos campos cambian más adelante (o el ID llega tarde),
   el seguimiento de esa oferta concreta se pierde. Es una limitación
   aceptada de no tener backend propio. */
function claveOferta(o){
  if(o.id) return 'id:'+o.id;
  return ['f',sinAcentos(o.empresa),sinAcentos(o.descripcion),sinAcentos(o.ciudad),o.alta].join('|');
}

/* ---------- estado real, plazo y color ----------
   doble seguridad: si la hoja ya dice Cerrada, se respeta. Si dice
   Próximamente, también (tiene prioridad, aún no ha abierto). Si dice
   Abierta (o no dice nada) pero el deadline ya pasó, se trata como
   Cerrada aunque nadie haya actualizado la hoja. Único punto de verdad:
   filtro (pasa), tarjeta (clase) y etiqueta (plazo) pasan todos por
   estadoReal(), así no pueden desincronizarse entre sí. */
/* o.deadline llega unas veces como fecha simple ("2026-09-04", desde la
   hoja) y otras como ISO completo con hora y "Z" ("2026-09-04T22:00:00.000Z",
   cuando Apps Script serializa un objeto Date). Si ya trae hora, se respeta
   tal cual (Date la interpreta en UTC y el navegador la pasa a local); si es
   solo fecha, se le añade T00:00:00 para fijarla a medianoche local y evitar
   que el desplazamiento UTC la mueva un día. Único punto de parseo: cualquier
   otro sitio que necesite la fecha del deadline debe pasar por aquí, no
   volver a tocar o.deadline directamente. */
const fechaDeadline=o=>{
  if(!o.deadline)return null;
  const d=o.deadline.includes('T')?new Date(o.deadline):new Date(o.deadline+'T00:00:00');
  return isNaN(d)?null:d;
};
const dias=o=>{
  const d=fechaDeadline(o);
  if(!d)return null;
  const medianoche=new Date(d);medianoche.setHours(0,0,0,0);
  return Math.round((medianoche-HOY)/86400000);
};
function estadoReal(o){
  if(o.estado==='Cerrada'||o.estado==='Próximamente')return o.estado;
  const n=dias(o);
  return (n!==null&&n<0)?'Cerrada':o.estado;
}
const esEvento=o=>o.tipo==='Evento';

/* En un evento el "deadline" de la hoja es la FECHA EN QUE SE CELEBRA,
   no la fecha límite para aplicar: cambia el texto de la etiqueta, no la
   lógica. Reutiliza estadoReal()/dias() y los mismos niveles de color,
   así que un evento pasado cuenta como 'Cerrada' y queda oculto por
   defecto igual que una oferta cerrada. */
function plazoEvento(o){
  const est=estadoReal(o);
  if(est==='Cerrada')return{txt:'Ya se celebró',nivel:'cerrada'};
  if(est==='Próximamente')return{txt:'Inscripción pronto',nivel:'preview'};
  const n=dias(o);
  if(n===null)return{txt:'Sin fecha',nivel:'sinfecha'};
  if(n===0)return{txt:'Es hoy',nivel:'critico'};
  if(n===1)return{txt:'Es mañana',nivel:'critico'};
  if(n<=3)return{txt:'En '+n+' días',nivel:'critico'};
  if(n<=14)return{txt:'En '+n+' días',nivel:'proximo'};
  return{txt:'El '+fechaDeadline(o).toLocaleDateString('es-ES',{day:'numeric',month:'short'}),nivel:'lejano'};
}

/* nivel, por prioridad:
   preview  → estadoReal === 'Próximamente'
   cerrada  → estadoReal === 'Cerrada' (estado real de la hoja, o deadline pasado)
   rolling  → tipoPlazo === 'Rolling'
   sinfecha → tipoPlazo === 'Sin publicar', o sin deadline parseable
   critico  → abierta, quedan 3 días o menos
   proximo  → abierta, entre 4 y 14 días
   lejano   → abierta, más de 14 días
---------------------------------------- */
function plazo(o){
  if(esEvento(o))return plazoEvento(o);
  const est=estadoReal(o);
  if(est==='Próximamente')return{txt:'Abre pronto',nivel:'preview'};
  if(est==='Cerrada')return{txt:'Cerrada',nivel:'cerrada'};
  const n=dias(o);
  if(o.tipoPlazo==='Rolling')return{txt:'Aplica ya · cierra al cubrirse',nivel:'rolling'};
  if(o.tipoPlazo==='Sin publicar'||n===null)return{txt:'Sin fecha',nivel:'sinfecha'};
  if(n<=3)return{txt:n===0?'Cierra hoy':n===1?'Cierra mañana':'Cierra en '+n+' días',nivel:'critico'};
  if(n<=14)return{txt:'Cierra en '+n+' días',nivel:'proximo'};
  return{txt:'Cierra el '+fechaDeadline(o).toLocaleDateString('es-ES',{day:'numeric',month:'short'}),nivel:'lejano'};
}
function clase(o){
  const est=estadoReal(o);
  if(est==='Cerrada')return 'is-shut';
  if(est==='Próximamente')return 'is-soon';
  const n=dias(o);
  return (n!==null&&n>=0&&n<=7)?'is-urgent':'is-open';
}

/* ---------- filtrado ----------
   'ambas' (el "Todo" de la portada) enseña ofertas y eventos mezclados;
   'eventos' enseña SOLO eventos; y los dos gates de trabajo nunca dejan
   pasar un evento, aunque una fila sin tipo sí siga colándose en ellos
   como hasta ahora. */
const pasaGate=o=>{
  if(S.gate==='ambas')return true;
  if(S.gate==='eventos')return esEvento(o);
  if(esEvento(o))return false;
  if(!o.tipo)return true;
  return S.gate==='practicas'?o.tipo==='Prácticas':o.tipo==='Contrato laboral';
};
const enSet=(set,v)=>set.size===0||v===''||set.has(v);

function pasa(o,salta){
  if(!pasaGate(o))return false;
  if(salta!=='estado'&&S.estado.size){const est=estadoReal(o);if(est&&!S.estado.has(est))return false;}
  if(salta!=='practica'&&!enSet(S.practica,o.practica))return false;
  if(salta!=='modalidad'&&!enSet(S.modalidad,o.modalidad))return false;
  if(salta!=='ciudad'&&S.ciudad.size&&!o.ciudades.some(c=>S.ciudad.has(c)))return false;
  if(salta!=='empresa'&&!enSet(S.empresa,o.empresa))return false;
  if(salta!=='plazo'&&!enSet(S.plazo,o.tipoPlazo))return false;
  if(salta!=='curso'&&!enSet(S.curso,o.curso))return false;
  if(salta!=='seg'&&S.seg.size&&!S.seg.has(SEG[claveOferta(o)]||''))return false;
  if(S.soloFav&&!FAV.has(claveOferta(o)))return false;
  if(S.q&&!(o.empresa+' '+o.descripcion+' '+o.ciudad).toLowerCase().includes(S.q))return false;
  return true;
}
const resultados=()=>TODAS.filter(o=>pasa(o,null));
const cuenta=(campo,prop,valor)=>TODAS.filter(o=>pasa(o,campo)&&(Array.isArray(o[prop])?o[prop].includes(valor):o[prop]===valor)).length;
/* siempre dentro del gate activo: en la vista de eventos no tiene
   sentido ofrecer "Curso" o "Tipo de plazo" porque los rellenen las
   ofertas de trabajo, que ahí no se ven. */
const tieneDatos=prop=>TODAS.some(o=>pasaGate(o)&&o[prop]!=='');

function ordenar(a){
  /* la vista de eventos no tiene control de orden (ver pintarFiltros):
     va siempre por fecha, que es lo único que se quiere de una agenda, y
     así no se queda clavado el orden que se eligiera en el tablón de
     ofertas, donde sí hay control y no se podría deshacer desde aquí. */
  const orden=S.gate==='eventos'?'plazo':S.orden;
  if(orden==='empresa')return a.sort((x,y)=>x.empresa.localeCompare(y.empresa,'es'));
  if(orden==='recientes')return a.sort((x,y)=>String(y.alta).localeCompare(String(x.alta)));
  return a.sort((x,y)=>{
    const dx=dias(x),dy=dias(y);
    if(dx===null&&dy===null)return x.empresa.localeCompare(y.empresa,'es');
    if(dx===null)return 1; if(dy===null)return -1;
    return dx-dy;
  });
}

/* ---------- controles ----------
   etiquetas (opcional): mapa valor real → texto a mostrar. data-v sigue
   llevando el valor real (con eso se filtra, cuenta y guarda); solo el
   texto visible del <span> cambia. */
function ops(campo,prop,valores,set,buscador,etiquetas){
  const l=valores.map(v=>{
    const n=cuenta(campo,prop,v);
    const texto=etiquetas&&etiquetas[v]||v;
    return `<label class="opt ${n?'':'vacio'}"><input type="checkbox" data-campo="${campo}" data-v="${esc(v)}" ${set.has(v)?'checked':''}><span>${esc(texto)}</span><span class="c">${n}</span></label>`;
  }).join('');
  return (buscador?'<input class="buscar" type="search" placeholder="Buscar…" aria-label="Filtrar la lista">':'')+l;
}

const SEG_ETIQ={aplicada:'Aplicada',entrevista:'Entrevista',oferta:'Oferta',rechazada:'Rechazada'};
function opsSeg(){
  return Object.keys(SEG_ETIQ).map(v=>{
    const n=TODAS.filter(o=>pasa(o,'seg')&&(SEG[claveOferta(o)]||'')===v).length;
    return `<label class="opt ${n?'':'vacio'}"><input type="checkbox" data-campo="seg" data-v="${v}" ${S.seg.has(v)?'checked':''}><span>${SEG_ETIQ[v]}</span><span class="c">${n}</span></label>`;
  }).join('');
}

function drop(clave,etiqueta,n,interior,ancho){
  return `<details class="drop" name="filtro-abierto" data-k="${clave}" data-on="${n?1:0}">
    <summary><span class="lb">${etiqueta}${n?' ('+n+')':''}</span><span class="car">▼</span></summary>
    <div class="panel${ancho?' wide':''}">${interior}</div></details>`;
}

const opsOrden=etiquetas=>etiquetas
  .map(([v,t])=>`<label class="opt"><input type="radio" name="orden" data-orden="${v}" ${S.orden===v?'checked':''}><span>${t}</span></label>`)
  .join('');

const botonFav=texto=>`<button class="chip" aria-pressed="${S.soloFav}" id="favbtn">★ ${texto}<span class="n">${FAV.size}</span></button>`;

/* la fila es una rejilla de tres columnas: con dos controles se reparten
   el ancho, y con uno solo se queda a un tercio, como los demás. Sin
   controles se le quita la clase entera, para que no deje su margen
   suelto en la barra. */
const fila=(sel,controles)=>{
  $(sel).className=controles.length?'filtros'+(controles.length===2?' dos':''):'';
  $(sel).innerHTML=controles.join('');
};

function pintarFiltros(){
  /* las listas abiertas (ciudad y empresa) se sacan solo de lo que el
     gate deja ver: si no, la vista de eventos ofrecería las 60 empresas
     del tablón de ofertas, todas con 0. */
  const visibles=TODAS.filter(o=>pasaGate(o));
  const ciudades=[...new Set(visibles.flatMap(o=>o.ciudades))].sort((a,b)=>a.localeCompare(b,'es'));
  const empresas=[...new Set(visibles.map(o=>o.empresa).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  /* =========== vista de eventos ===========
     Tres controles y nada más, a propósito: formato (online / presencial),
     quién lo organiza y guardados. Sector, ciudad, curso, tipo de plazo y
     seguimiento de candidatura son campos de oferta de trabajo y ahí solo
     estorban; el orden tampoco está, va fijo por fecha (ver ordenar). */
  if(S.gate==='eventos'){
    /* solo los formatos que existen de verdad: si todos los eventos son
       online, un desplegable con una única opción no filtra nada. */
    const formatos=MOD_E.filter(v=>visibles.some(o=>o.modalidad===v));
    const c=[];
    if(formatos.length>1)
      c.push(drop('modalidad','Formato',S.modalidad.size,ops('modalidad','modalidad',formatos,S.modalidad)));
    if(empresas.length>1)
      c.push(drop('empresa','Organizador',S.empresa.size,ops('empresa','empresa',empresas,S.empresa,empresas.length>8)));
    c.push(botonFav('Guardados'));
    fila('#row1',c);
    fila('#row2',[]);
    return;
  }

  const verPlazo=tieneDatos('tipoPlazo');
  const verCurso=S.gate!=='full'&&tieneDatos('curso');
  const nAv=S.empresa.size+(verPlazo?S.plazo.size:0)+(verCurso?S.curso.size:0);

  /* --- fila 1: sector, modalidad y ciudad --- */
  const c1=[];
  if(tieneDatos('practica'))
    c1.push(drop('practica','Sector',S.practica.size,ops('practica','practica',PRACTICAS,S.practica)));

  if(tieneDatos('modalidad')){
    const et=S.gate==='practicas'?'Tipo de prácticas':S.gate==='full'?'Tipo de entrada':'Modalidad';
    const inner=S.gate==='ambas'
      ? `<div class="grupo">Prácticas</div>${ops('modalidad','modalidad',MOD_P,S.modalidad)}
         <div class="grupo">Contrato laboral</div>${ops('modalidad','modalidad',MOD_F,S.modalidad,false,ETIQ_MODALIDAD)}
         <div class="grupo">Eventos</div>${ops('modalidad','modalidad',MOD_E,S.modalidad)}`
      : ops('modalidad','modalidad',S.gate==='practicas'?MOD_P:MOD_F,S.modalidad,false,ETIQ_MODALIDAD);
    c1.push(drop('modalidad',et,S.modalidad.size,inner));
  }
  if(ciudades.length>1)
    c1.push(drop('ciudad','Ciudad',S.ciudad.size,ops('ciudad','ciudades',ciudades,S.ciudad,ciudades.length>8)));

  fila('#row1',c1);

  /* --- fila 2: tu candidatura, avanzados y guardadas ---
     Guardadas se enseña siempre (aunque FAV esté vacío) para que
     se sepa que la opción existe desde el principio. */
  fila('#row2',[
    drop('seg','Tu candidatura',S.seg.size,opsSeg()),
    drop('mas','Más filtros',nAv,
      `<div class="grupo">Empresa</div>${ops('empresa','empresa',empresas,S.empresa,true)}
       ${verPlazo?`<div class="grupo">Tipo de plazo</div>${ops('plazo','tipoPlazo',PLAZOS,S.plazo)}`:''}
       ${verCurso?`<div class="grupo">Curso</div>${ops('curso','curso',CURSOS,S.curso)}`:''}
       <div class="grupo">Orden</div>
       ${opsOrden([['plazo','Por plazo'],['recientes','Recién añadidas'],['empresa','Por empresa']])}`,
      true),
    botonFav('Guardadas')
  ]);
}

function pintarEstado(abierto){
  const act=ESTADOS.filter(e=>S.estado.has(e));
  $('#estadoline').innerHTML = abierto
    ? `<div class="cajas">${ESTADOS.map(v=>`<label class="opt"><input type="checkbox" data-campo="estado" data-v="${v}" ${S.estado.has(v)?'checked':''}><span>${v}</span></label>`).join('')}</div>`
    : `Mostrando: <b>${act.length?act.join(' · '):'nada'}</b> <button id="estadobtn">cambiar</button>`;
}

/* deja los filtros como recién llegado. Único sitio que define qué es
   "sin filtros": lo usan el botón "Quitar filtros", el de la lista
   vacía y el cambio de sección. Si se añade un filtro nuevo a S, va
   aquí y los tres sitios quedan al día solos.
   Las guardadas (FAV) y el seguimiento (SEG) NO se tocan: son datos del
   usuario, no filtros; lo que se apaga es el interruptor de ver solo
   guardadas. El orden tampoco, que no filtra nada. */
function limpiarFiltros(){
  CAMPOS_FILTRO.forEach(k=>S[k].clear());
  S.estado=new Set(ESTADO_POR_DEFECTO);
  S.soloFav=false;
  S.q='';
  $('#q').value='';
}

function hayFiltros(){
  const estadoPorDefecto=S.estado.size===ESTADO_POR_DEFECTO.length&&ESTADO_POR_DEFECTO.every(v=>S.estado.has(v));
  return S.practica.size+S.modalidad.size+S.ciudad.size+S.empresa.size+S.plazo.size+S.curso.size+S.seg.size
    +(S.q?1:0)+(S.soloFav?1:0)+(estadoPorDefecto?0:1) > 0;
}

function pintarControles(estadoAbierto){
  pintarFiltros();
  pintarEstado(estadoAbierto);
  $('#modo').textContent='Buscas: '+({practicas:'Prácticas',full:'Contrato laboral',eventos:'Eventos',ambas:'Todo'}[S.gate]||'-')+' · cambiar';
  $('#reset').hidden=!hayFiltros();
}

/* ---------- lista ---------- */
const TARJETA_ESQUELETO=`<li><article class="card skel">
      <div class="top">
        <div>
          <div class="sk sk-title"></div>
          <div class="sk sk-desc"></div>
        </div>
      </div>
      <div class="tags">
        <div class="sk sk-meta"></div>
        <div class="sk sk-plazo"></div>
      </div>
      <div class="sk sk-seg"></div>
    </article></li>`;

function pintarLista(){
  if(!CARGADO){
    $('#count').textContent='';
    $('#hint').innerHTML='';
    $('#list').innerHTML=TARJETA_ESQUELETO.repeat(5);
    return;
  }

  /* en el gate de eventos toda la lista son eventos, así que los textos
     de alrededor (contador, avisos, vacío) hablan de eventos y no de
     ofertas. En "Todo" van mezclados y se sigue diciendo "ofertas". */
  const vistaEv=S.gate==='eventos';
  const items=ordenar(resultados());
  /* en "Todo" la lista puede llevar ofertas y eventos a la vez: ahí
     "ofertas" sería mentira a medias, así que se cuentan resultados. */
  const nombre=vistaEv?['evento','eventos']
    :items.some(esEvento)?['resultado','resultados']
    :['oferta','ofertas'];
  $('#count').textContent=items.length===1?'1 '+nombre[0]:items.length+' '+nombre[1];

  const ocultas=!S.estado.has('Cerrada')?TODAS.filter(o=>pasa(o,'estado')&&estadoReal(o)==='Cerrada').length:0;
  const pasadas=ocultas===1
    ?(vistaEv?'Hay 1 evento parecido que ya se celebró.':'Hay 1 oferta similar que ya está cerrada.')
    :'Hay '+ocultas+(vistaEv?' eventos parecidos que ya se celebraron.':' ofertas similares que ya están cerradas.');
  if(PENDIENTE){
    $('#hint').innerHTML=`<div class="hint">Hay datos más recientes. <button id="aplicarnuevos">Aplicarlos</button></div>`;
  }else{
    $('#hint').innerHTML=(ocultas&&items.length)
      ?`<div class="hint">${pasadas} <button id="vercerradas">Puedes ver${vistaEv?(ocultas===1?'lo':'los'):(ocultas===1?'la':'las')} si quieres</button></div>`:'';
  }

  if(!items.length){
    /* la hoja todavía no trae ni un evento: no es que los filtros tapen
       nada, es que no hay qué enseñar. Pedir "quita filtros" ahí solo
       confunde. */
    if(vistaEv&&!TODAS.some(esEvento)){
      $('#list').innerHTML=`<li class="empty"><b>Aún no hay eventos publicados</b>
        En cuanto haya charlas, talleres u open days aparecerán aquí.
        <br><button id="abrirgate">Ver las ofertas</button></li>`;
      return;
    }
    $('#list').innerHTML=`<li class="empty"><b>${vistaEv?'No hay ningún evento con esas características':'No hay ninguna posición con esas características'}</b>
      Prueba a quitar algún filtro o a ampliar la búsqueda.
      ${ocultas?`<br><br>${pasadas}`:''}
      <br><button id="resetvacio">Quitar todos los filtros</button></li>`;
    return;
  }

  $('#list').innerHTML=items.map(o=>{
    const clave=claveOferta(o),seg=SEG[clave]||'',fav=FAV.has(clave);
    const ev=esEvento(o);
    const p=plazo(o);
    const col=colorMarca(o.empresa);
    /* sin repetidos: un evento "Online" celebrado "Online" pone las dos
       cosas en la misma columna de la hoja y quedaría "Online · Online". */
    const meta=[...new Set([o.practica,ETIQ_MODALIDAD[o.modalidad]||o.modalidad,o.ciudades.join(', ')].filter(Boolean))].join(' · ');
    /* solo http(s): el marcador "#" de la hoja, una celda a medias o un
       "javascript:" pegado por error no se convierten en enlace. */
    const href=/^https?:\/\//i.test(o.link)?`href="${esc(o.link)}" target="_blank" rel="noopener"`:'';
    /* un evento no es una candidatura: se puede guardar con la estrella,
       pero no lleva el desplegable de seguimiento (aplicada/entrevista/
       oferta/rechazada), que ahí no significaría nada. */
    return `<li><article class="card ${clase(o)}" style="border-left-color:${col}">
      <div class="top">
        <div>
          <div class="empresa"><a ${href}>${esc(o.empresa)}</a></div>
          <p class="desc">${esc(o.descripcion)}</p>
        </div>
        <button class="fav" aria-pressed="${fav}" aria-label="Guardar ${ev?'evento':'oferta'}: ${esc(o.descripcion)} ${ev?'de':'en'} ${esc(o.empresa)}" data-key="${esc(clave)}">${fav?'★':'☆'}</button>
      </div>
      <div class="tags">
        ${ev?'<span class="tag-evento">Evento</span>':''}
        ${meta?`<span class="meta">${esc(meta)}</span>`:''}
        <span class="plazo n-${p.nivel}">${esc(p.txt)}</span>
      </div>
      ${ev?'':`<div class="seg">
        <select class="seg-select${seg?' v-'+seg:''}" data-seg="${esc(clave)}" aria-label="Tu candidatura en ${esc(o.empresa)}">
          <option value=""${seg?'':' selected'}>Sin seguimiento</option>
          ${Object.keys(SEG_ETIQ).map(v=>`<option value="${v}"${seg===v?' selected':''}>${SEG_ETIQ[v]}</option>`).join('')}
        </select>
      </div>`}
    </article></li>`;
  }).join('');
}

function render(opts){
  const abiertos=[...document.querySelectorAll('details.drop[open]')]
    .map(d=>d.dataset.k).filter(k=>k!==(opts&&opts.cerrar));
  pintarControles(opts&&opts.estadoAbierto);
  pintarLista();
  document.querySelectorAll('details.drop').forEach(d=>{if(abiertos.includes(d.dataset.k))d.open=true;});
  guardar();
}

/* ---------- persistencia ---------- */
const CAMPOS=['practica','modalidad','ciudad','empresa','plazo','curso','estado','seg'];
function guardar(){
  try{
    const o={orden:S.orden,soloFav:S.soloFav};
    CAMPOS.forEach(k=>o[k]=[...S[k]]);
    localStorage.setItem(K_FILT,JSON.stringify(o));
    localStorage.setItem(K_FAV,JSON.stringify([...FAV]));
    localStorage.setItem(K_SEG,JSON.stringify(SEG));
  }catch(e){}
}
function cargarPrefs(){
  try{
    FAV=new Set(JSON.parse(localStorage.getItem(K_FAV)||'[]'));
    SEG=JSON.parse(localStorage.getItem(K_SEG)||'{}');
    S.gate=localStorage.getItem(K_GATE);
    const o=JSON.parse(localStorage.getItem(K_FILT)||'null');
    if(o){CAMPOS.forEach(k=>{if(o[k])S[k]=new Set(o[k]);});S.orden=o.orden||'plazo';S.soloFav=!!o.soloFav;}
  }catch(e){}
}

/* ---------- eventos ---------- */
/* promo del grupo de WhatsApp: vive siempre en la píldora "¡Únete a
   RTC!" junto a "Buscas: ... · cambiar" en la cabecera (ver CSS,
   sección "promo del grupo de WhatsApp").

   La tarjeta desplegada se enseña SOLO UNA VEZ por navegador: la
   primera vez que se llega al tablón. A partir de ahí queda la píldora,
   que sigue abriéndola a mano cuando se pulsa, pero nunca se despliega
   sola otra vez — ni al cambiar de gate, ni al recargar. K_PROMO guarda
   ese "ya se le enseñó"; quien ya la hubiera cerrado con la X antes de
   este cambio tiene la clave puesta y no la vuelve a ver, que es justo
   lo que quería.

   Se oculta del todo mientras el gate o la intro están abiertos, para
   que no quede tapada pero seguible por teclado.

   En móvil la tarjeta va fixed y centrada en el ancho de pantalla,
   porque anclada al lateral de la píldora se sale del viewport y se
   corta sin forma de cerrarla; en escritorio (≥1024px) hay sitio de
   sobra y el CSS la ancla pegada a la píldora con calc(100% + 8px),
   así que ahí no hace falta calcular el top a mano. */
const ESCRITORIO=matchMedia('(min-width:1024px)');
const promoYaVista=()=>{try{return localStorage.getItem(K_PROMO)==='1'}catch(e){return false}};
function abrirPromo(expandida){
  $('#promoChip').hidden=false;
  if(expandida&&!ESCRITORIO.matches){
    const r=$('#promoChip').getBoundingClientRect();
    $('#promoCard').style.top=Math.round(r.bottom+8)+'px';
  }else{
    $('#promoCard').style.top='';
  }
  $('#promoCard').hidden=!expandida;
  $('#promoChip').setAttribute('aria-expanded',expandida?'true':'false');
  /* se marca al enseñarla, nunca se desmarca: es un "ya la ha visto" */
  if(expandida){try{localStorage.setItem(K_PROMO,'1')}catch(e){}}
}
function ocultarPromo(){$('#promoChip').hidden=true;$('#promoCard').hidden=true;}

/* =================================================================
   GUÍA "AHORA HAY EVENTOS"
   Solo para quien ya usaba el tablón antes de que existieran: quien
   entra por primera vez ve la opción en el gate desde el minuto uno y
   no necesita que se le señale.
   Son dos pasos encadenados: palpita la píldora "Buscas: ... · cambiar"
   y, en cuanto se abre el gate, deja de palpitar esa y pasa a palpitar
   la opción "Eventos". Elegir cualquier sección la termina.
   Se enseña UNA sola vez por navegador: K_NOVEDAD se marca al arrancar
   la guía, no al terminarla, para no repetirla si se recarga a medias.
   Si localStorage no está disponible se da por vista, y así no reaparece
   en cada carga de una ventana privada.
   El resalte es puro CSS (clase .palpita, ver "guía ahora hay eventos"
   en style.css); la insignia "Nuevo" va en un ::after a propósito,
   porque pintarControles() reescribe el textContent de #modo en cada
   render y se llevaría por delante cualquier hijo que le colgáramos.
================================================================= */
let GUIA=false;
const novedadVista=()=>{try{return localStorage.getItem(K_NOVEDAD)==='1'}catch(e){return true}};
const marcarNovedadVista=()=>{try{localStorage.setItem(K_NOVEDAD,'1')}catch(e){}};
const opcionEventos=()=>document.querySelector('.gopt[data-g="eventos"]');

function empezarGuia(){
  if(novedadVista())return;
  marcarNovedadVista();
  GUIA=true;
  /* si el gate ya está abierto se salta el primer paso */
  if($('#gate').classList.contains('on'))pasoEventos();
  else $('#modo').classList.add('palpita');
}
function pasoEventos(){
  $('#modo').classList.remove('palpita');
  const op=opcionEventos(); if(op)op.classList.add('palpita');
}
function finGuia(){
  if(!GUIA)return;
  GUIA=false;
  $('#modo').classList.remove('palpita');
  const op=opcionEventos(); if(op)op.classList.remove('palpita');
}

function abrirGate(){$('#gate').classList.add('on');document.body.classList.add('gate-open');ocultarPromo();if(GUIA)pasoEventos();}
/* al salir del gate la promo solo se despliega si es la primera vez;
   después queda la píldora, que sigue abriéndola a mano */
function cerrarGate(){$('#gate').classList.remove('on');document.body.classList.remove('gate-open');abrirPromo(!promoYaVista());}
function abrirIntro(){$('#intro').classList.add('on');document.body.classList.add('intro-open');ocultarPromo();}
function cerrarIntro(){$('#intro').classList.remove('on');document.body.classList.remove('intro-open');}

document.addEventListener('click',e=>{
  if(e.target.closest('#empezar')){
    try{localStorage.setItem(K_INTRO,'1')}catch(err){}
    cerrarIntro();
    S.gate='ambas';
    abrirGate();
    return;
  }
  /* estrella de muestra del paso 2 de la intro: solo enciende/apaga
     su propio dibujo, no toca FAV en ningún momento. */
  const mfav=e.target.closest('.mock-fav');
  if(mfav){
    const on=mfav.getAttribute('aria-pressed')==='true';
    mfav.setAttribute('aria-pressed',on?'false':'true');
    mfav.textContent=on?'☆':'★';
    return;
  }
  const g=e.target.closest('.gopt');
  if(g){finGuia();
    /* los filtros no se portan entre secciones: cada una empieza de
       cero. Aparte de ser lo esperado (lo que buscas en prácticas no
       tiene por qué valer en eventos), varios filtros ni siquiera
       existen en todas —modalidad tiene vocabulario propio en cada
       una, y curso, tipo de plazo, sector y ciudad desaparecen en
       eventos—, así que arrastrarlos dejaba la lista filtrada en
       invisible y vacía sin explicación.
       Volver a elegir la sección en la que ya estás no limpia nada:
       no te has movido de pantalla. */
    if(S.gate!==g.dataset.g)limpiarFiltros();
    S.gate=g.dataset.g;try{localStorage.setItem(K_GATE,S.gate)}catch(err){}
    cerrarGate();render();return;}
  if(e.target.closest('#modo')||e.target.closest('#abrirgate')){abrirGate();return;}
  const chip=e.target.closest('.chip[data-campo]');
  if(chip){const s=S[chip.dataset.campo],v=chip.dataset.v;s.has(v)?s.delete(v):s.add(v);render();return;}
  if(e.target.closest('#favbtn')){S.soloFav=!S.soloFav;render();return;}
  const f=e.target.closest('.fav');
  if(f){const k=f.dataset.key;FAV.has(k)?FAV.delete(k):FAV.add(k);if(!FAV.size)S.soloFav=false;render();return;}
  if(e.target.closest('#estadobtn')){pintarEstado(true);return;}
  if(e.target.closest('#vercerradas')){S.estado.add('Cerrada');render();return;}
  if(e.target.closest('#aplicarnuevos')){
    if(PENDIENTE){const d=PENDIENTE;PENDIENTE=null;aplicar(d,'en directo');}
    return;
  }
  if(e.target.closest('#reset')||e.target.closest('#resetvacio')){
    limpiarFiltros();render();return;
  }
  if(e.target.closest('#promoChip')){
    abrirPromo($('#promoCard').hidden);
    return;
  }
  if(e.target.closest('#promoClose')){
    abrirPromo(false);
    return;
  }
  const cta=e.target.closest('.promo-cta');
  if(cta){
    cta.classList.remove('pulsa');
    void cta.offsetWidth; /* fuerza reflow para poder repetir la animación en el siguiente clic */
    cta.classList.add('pulsa');
    return;
  }
});

document.addEventListener('change',e=>{
  const t=e.target;
  /* desplegable de muestra del paso 3 de la intro: solo repinta su
     propio color, no toca SEG en ningún momento. */
  if(t.classList.contains('mock-seg')){
    t.classList.remove('v-aplicada','v-entrevista','v-oferta','v-rechazada');
    if(t.value)t.classList.add('v-'+t.value);
    return;
  }
  if(t.classList.contains('seg-select')){
    const k=t.dataset.seg,v=t.value;
    if(v)SEG[k]=v; else delete SEG[k];
    render();
    return;
  }
  if(t.dataset.campo){
    const s=S[t.dataset.campo],v=t.dataset.v;
    t.checked?s.add(v):s.delete(v);
    /* estos filtros son de opción rápida: elegir una vez y cerrar. Si no,
       el panel se queda abierto tapando "Quitar filtros", que es justo lo
       siguiente que se busca.
       'empresa' entra aquí por el "Organizador" suelto de la vista de
       eventos. En el tablón de ofertas la empresa vive dentro de "Más
       filtros" (data-k="mas"), así que cerrar 'empresa' no le afecta: ahí
       sigue abierto para poder marcar varias casillas seguidas. */
    const AUTOCIERRE=['practica','modalidad','ciudad','seg','empresa'];
    render({estadoAbierto:t.dataset.campo==='estado',cerrar:AUTOCIERRE.includes(t.dataset.campo)?t.dataset.campo:null});
    return;
  }
  if(t.dataset.orden){S.orden=t.dataset.orden;render();}
});

document.addEventListener('input',e=>{
  if(!e.target.classList.contains('buscar'))return;
  const v=e.target.value.toLowerCase();
  let visible=false;
  e.target.parentElement.querySelectorAll('label.opt').forEach(l=>{
    if(!l.querySelector('input[type=checkbox]'))return;
    const ok=l.textContent.toLowerCase().includes(v);
    l.style.display=ok?'':'none';
    if(ok)visible=true;
  });
});

let t;
$('#q').addEventListener('input',e=>{
  clearTimeout(t);
  t=setTimeout(()=>{
    S.q=e.target.value.trim().toLowerCase();
    render();
  },130);
});

/* =================================================================
   CARGA EN TRES CAPAS
   1. INMEDIATO: datos.json (estático, lo escribe la GitHub Action de
      .github/workflows/actualizar-datos.yml cada hora). Nada bloquea
      este paso: si responde, se pinta al momento.
   2. Si datos.json falla (aún no existe, sin red...), la copia
      guardada en localStorage.
   3. Si tampoco hay nada, esqueletos (ver TARJETA_ESQUELETO en
      pintarLista) hasta que responda la capa de fondo.
   Después de pintar lo que sea, y sin bloquear ese primer pintado,
   refrescar() intenta la hoja en directo de Apps Script por si acaso
   datos.json está desactualizado.
================================================================= */
let CARGADO=false;

/* ÚNICO punto que convierte la respuesta cruda en la lista de la app.
   Lo usan aplicar() (lo que se pinta) y refrescar() (lo que se compara
   con lo pintado): si los dos no filtran exactamente igual, la
   comparación "¿han cambiado los datos?" sale distinta siempre y el
   aviso "Hay datos más recientes" aparece en cada refresco aunque no
   haya cambiado nada.
   La exclusión de Auditoría & Legal es de ofertas de trabajo: un evento
   no se descarta por el sector que tenga apuntado en la hoja. */
function normalizarTodas(data){
  /* defensivo a propósito: esto es lo único que hay entre una respuesta
     rara de Apps Script (una fila null, un "ofertas" que no es lista) y
     una pantalla en blanco. Una fila mala se tira, el resto se pinta. */
  const filas=data&&Array.isArray(data.ofertas)?data.ofertas:[];
  return filas.filter(o=>o&&typeof o==='object').map(norm)
    .filter(o=>o.empresa&&(esEvento(o)||o.practica!=='Auditoría & Legal'));
}

function aplicar(data,origen){
  CARGADO=true;
  TODAS=normalizarTodas(data);
  const f=data.actualizado?new Date(data.actualizado).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}):'-';
  let aviso='';
  if(origen==='datos.json'&&data.actualizado){
    const horas=(Date.now()-new Date(data.actualizado).getTime())/3600000;
    if(horas>3)aviso=' · puede estar desactualizado';
  }
  $('#foot').textContent=`Datos actualizados: ${f}${aviso}`;
  render();
}

const espera=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- capa 3: refresco en directo, en segundo plano ---------- */
const REFRESCO_TIMEOUT_MS=20000;
const REFRESCO_ESPERAS_MS=[1000,2000,4000,8000,16000,30000];

async function pedirDatosEnDirecto(){
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),REFRESCO_TIMEOUT_MS);
  try{
    const r=await fetch(API_URL,{signal:ctrl.signal});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return await r.json();
  }finally{
    clearTimeout(t);
  }
}

/* datos que llegaron distintos a los pintados mientras el usuario
   tenía algún filtro activo: se enseña un aviso en vez de repintar
   solo. #aplicarnuevos (en el listener de clic) los aplica. */
let PENDIENTE=null;
let refrescando=false;
async function refrescar(){
  if(refrescando||API_URL.indexOf('PEGA_AQUI')===0)return;
  refrescando=true;
  try{
    for(let intento=0;;intento++){
      try{
        const data=await pedirDatosEnDirecto();
        try{localStorage.setItem(K_DATOS,JSON.stringify(data))}catch(e){}
        const nuevas=normalizarTodas(data);
        if(JSON.stringify(nuevas)===JSON.stringify(TODAS))return; /* idénticos: nada, ni repintar */
        if(!TODAS.length||!hayFiltros()){
          aplicar(data,'en directo');
        }else{
          PENDIENTE=data;
          $('#hint').innerHTML=`<div class="hint">Hay datos más recientes. <button id="aplicarnuevos">Aplicarlos</button></div>`;
        }
        return;
      }catch(err){
        if(intento>=REFRESCO_ESPERAS_MS.length)return; /* se acabaron los intentos: silencio, ya hay datos válidos */
        await espera(REFRESCO_ESPERAS_MS[intento]);
      }
    }
  }finally{
    refrescando=false;
  }
}

/* ---------- capas 1 y 2: primera pintura ---------- */
async function cargarInicial(){
  cargarPrefs();
  let primeraVez=false;
  try{primeraVez=!localStorage.getItem(K_INTRO)}catch(e){}
  if(primeraVez){
    /* quien entra por primera vez ya ve "Eventos" en el gate: no hay
       novedad que contarle, y se da por vista para que no le salte
       la guía más adelante. */
    marcarNovedadVista();
    abrirIntro();
  }
  else if(!S.gate){S.gate='ambas';empezarGuia();abrirGate();}
  else{
    /* vuelta con el gate ya elegido: no hay cierre de gate que dispare
       la promo, así que se pone aquí. La píldora se enseña siempre; la
       tarjeta, solo si es la primera vez (ver abrirPromo).
       Las dos cosas van encadenadas, nunca a la vez: si toca la guía de
       eventos, la tarjeta de la promo se queda para la próxima visita.
       Soltarlas juntas llena la pantalla de avisos y la tarjeta tapa
       justo la barra que la guía está señalando. */
    empezarGuia();
    abrirPromo(!GUIA&&!promoYaVista());
  }

  let listo=false;
  try{
    const r=await fetch('datos.json?t='+Date.now());
    if(r.ok){aplicar(await r.json(),'datos.json');listo=true;}
  }catch(e){}

  if(!listo){
    try{
      const c=localStorage.getItem(K_DATOS);
      if(c){aplicar(JSON.parse(c),'copia guardada');listo=true;}
    }catch(e){}
  }

  if(!listo){
    if(API_URL.indexOf('PEGA_AQUI')===0){aplicar(DEMO,'datos de ejemplo');return;}
    render(); /* nada pintado todavía: pintarLista() enseña los esqueletos */
  }

  refrescar();
}
cargarInicial();

/* =================================================================
   Pega aquí la URL /exec del Apps Script. Con el valor de fábrica
   la página funciona con datos de ejemplo.
================================================================= */
const API_URL = 'https://script.google.com/macros/s/AKfycbwCM_bRu-hi0G5x822DMGd1HQsE2HbcogclQN5Z5WdsgVekWF1HWMa7I4M9PjkhC7_e/exec';

const K_DATOS='rtc-datos-v2', K_FILT='rtc-filtros-v2', K_FAV='rtc-favoritas-v2', K_GATE='rtc-gate-v1', K_SEG='rtc-seguimiento-v1', K_INTRO='rtc-intro-v1';

const PRACTICAS=['Estrategia','Tecnología y AI','Financiero y M&A','Auditoría & Legal'];
const MOD_P=['Summer','Off-cycle'];
const MOD_F=['Graduate programme','Entrada directa'];
const PLAZOS=['Fecha fija','Rolling','Sin publicar'];
const CURSOS=['Todos','Penúltimo año','Solo máster'];
const ESTADOS=['Abierta','Próximamente','Cerrada'];

const DEMO={actualizado:new Date().toISOString(),ofertas:[
 {id:'RTC-0001',empresa:'McKinsey & Company',descripcion:'Business Analyst',tipo:'Tiempo completo',practica:'Estrategia',modalidad:'Graduate programme',estado:'Abierta',ciudad:'Madrid Barcelona',curso:'',tipoPlazo:'Rolling',deadline:'',link:'#',alta:'2026-08-01'},
 {id:'RTC-0002',empresa:'QuantumBlack',descripcion:'Data Scientist Intern',tipo:'Prácticas',practica:'Tecnología y AI',modalidad:'Summer',estado:'Abierta',ciudad:'Madrid',curso:'Penúltimo año',tipoPlazo:'Fecha fija',deadline:'2026-08-18',link:'#',alta:'2026-08-05'},
 {id:'RTC-0003',empresa:'Bain & Company',descripcion:'Associate Consultant Intern',tipo:'Prácticas',practica:'Estrategia',modalidad:'Summer',estado:'Próximamente',ciudad:'Madrid',curso:'Penúltimo año',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-07-28'},
 {id:'RTC-0004',empresa:'Monitor Deloitte',descripcion:'Strategy Analyst',tipo:'Tiempo completo',practica:'Estrategia',modalidad:'Entrada directa',estado:'Abierta',ciudad:'Barcelona',curso:'',tipoPlazo:'Fecha fija',deadline:'2026-09-30',link:'#',alta:'2026-08-02'},
 {id:'RTC-0005',empresa:'Deloitte',descripcion:'Financial Advisory — M&A Intern',tipo:'Prácticas',practica:'Financiero y M&A',modalidad:'Off-cycle',estado:'Abierta',ciudad:'Madrid',curso:'Todos',tipoPlazo:'Rolling',deadline:'',link:'#',alta:'2026-08-09'},
 {id:'RTC-0006',empresa:'KPMG',descripcion:'Audit Graduate Programme',tipo:'Tiempo completo',practica:'Auditoría & Legal',modalidad:'Graduate programme',estado:'Cerrada',ciudad:'Madrid',curso:'',tipoPlazo:'Fecha fija',deadline:'2026-06-15',link:'#',alta:'2026-05-01'},
 {id:'RTC-0007',empresa:'Accenture',descripcion:'Technology Consulting Intern',tipo:'Prácticas',practica:'Tecnología y AI',modalidad:'Summer',estado:'Abierta',ciudad:'Bilbao',curso:'Todos',tipoPlazo:'Fecha fija',deadline:'2026-08-14',link:'#',alta:'2026-08-10'},
 {id:'RTC-0008',empresa:'EY-Parthenon',descripcion:'Summer Intern',tipo:'Prácticas',practica:'Estrategia',modalidad:'Summer',estado:'Próximamente',ciudad:'Madrid',curso:'Solo máster',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-08-11'},
 {id:'RTC-0009',empresa:'Strategy&',descripcion:'Consulting Intern',tipo:'Prácticas',practica:'Estrategia',modalidad:'Summer',estado:'Abierta',ciudad:'Valencia',curso:'Penúltimo año',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-08-11'}
]};

const HOY=new Date(); HOY.setHours(0,0,0,0);
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let TODAS=[];
/* guardadas: claves de OFERTA (claveOferta), no de empresa — guardar
   una oferta de McKinsey no marca todas las de McKinsey. */
let FAV=new Set();
/* estado de candidatura por OFERTA:
   clave de oferta → 'aplicada'|'entrevista'|'oferta'|'rechazada'.
   La ausencia de clave es "sin seguimiento" y no se persiste. */
let SEG={};
const S={gate:null,practica:new Set(),modalidad:new Set(),ciudad:new Set(),empresa:new Set(),
         plazo:new Set(),curso:new Set(),estado:new Set(['Abierta','Próximamente']),seg:new Set(),
         soloFav:false,orden:'plazo',q:''};

/* ---------- normalización ---------- */
function norm(o){
  const g=(...k)=>{for(const n of k){const v=o[n];if(v!=null&&String(v).trim()!=='')return String(v).trim();}return '';};
  let tipo=g('tipo','Tipo de Oferta');
  if(/intern|práctic|practic/i.test(tipo))tipo='Prácticas';
  else if(/full|completo/i.test(tipo))tipo='Tiempo completo';
  let est=g('estado','Estado');
  if(/^cerrad/i.test(est))est='Cerrada';
  else if(/^abiert|^en curso/i.test(est))est='Abierta';
  else if(/^no inici|^próxim|^proxim/i.test(est))est='Próximamente';
  const ciudad=g('ciudad','Ciudad');
  return {id:g('id','ID'),empresa:g('empresa','Empresa'),descripcion:g('descripcion','Descripción'),
    tipo,estado:est,ciudad,ciudades:ciudad.split(/\s+/).filter(Boolean),link:g('link','Link'),deadline:g('deadline','Deadline'),
    practica:g('practica','Práctica'),modalidad:g('modalidad','Modalidad'),curso:g('curso','Curso'),
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
  /* --- estrategia --- */
  {matriz:'McKinsey & Company', color:'#2251FF',
   ramas:['mckinsey','quantumblack','quantum black','mckinsey digital','orphoz']},

  {matriz:'Boston Consulting Group', color:'#177B57',
   ramas:['bcg','boston consulting','bcg x','bcg gamma','bcg platinion','platinion',
          'bcg digital ventures','inverto']},

  {matriz:'Bain & Company', color:'#CC0000',
   ramas:['bain','bain vector','vector','bain digital']},

  {matriz:'Kearney',       color:'#7A2E3B', ramas:['kearney','a t kearney']},
  {matriz:'Oliver Wyman',  color:'#0083C1', ramas:['oliver wyman']},
  {matriz:'Roland Berger', color:'#009B77', ramas:['roland berger']},
  {matriz:'L.E.K.',        color:'#00539B', ramas:['l e k','lek']},

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
   el seguimiento de esa oferta concreta se pierde — es una limitación
   aceptada de no tener backend propio. */
function claveOferta(o){
  if(o.id) return 'id:'+o.id;
  return ['f',sinAcentos(o.empresa),sinAcentos(o.descripcion),sinAcentos(o.ciudad),o.alta].join('|');
}

/* ---------- plazo y color ----------
   nivel, por prioridad:
   preview  → estado === 'Próximamente' (prioridad sobre el resto)
   cerrada  → estado === 'Cerrada' o deadline pasado
   rolling  → tipoPlazo === 'Rolling'
   sinfecha → tipoPlazo === 'Sin publicar', o sin deadline parseable
   critico  → abierta, quedan 3 días o menos
   proximo  → abierta, entre 4 y 14 días
   lejano   → abierta, más de 14 días
---------------------------------------- */
const dias=o=>{if(!o.deadline)return null;const d=new Date(o.deadline+'T00:00:00');return isNaN(d)?null:Math.round((d-HOY)/86400000);};
function plazo(o){
  if(o.estado==='Próximamente')return{txt:'Abre pronto',nivel:'preview'};
  const n=dias(o);
  if(o.estado==='Cerrada'||(n!==null&&n<0))return{txt:'Cerrada',nivel:'cerrada'};
  if(o.tipoPlazo==='Rolling')return{txt:'Aplica ya · cierra al cubrirse',nivel:'rolling'};
  if(o.tipoPlazo==='Sin publicar'||n===null)return{txt:'Sin fecha',nivel:'sinfecha'};
  if(n<=3)return{txt:n===0?'Hoy':n===1?'Mañana':'Quedan '+n+' días',nivel:'critico'};
  if(n<=14)return{txt:'Quedan '+n+' días',nivel:'proximo'};
  const d=new Date(o.deadline+'T00:00:00');
  return{txt:d.toLocaleDateString('es-ES',{day:'numeric',month:'short'}),nivel:'lejano'};
}
function clase(o){
  if(o.estado==='Cerrada')return 'is-shut';
  if(o.estado==='Próximamente')return 'is-soon';
  const n=dias(o);
  return (n!==null&&n>=0&&n<=7)?'is-urgent':'is-open';
}

/* ---------- filtrado ---------- */
const pasaGate=o=>S.gate==='ambas'||!o.tipo||(S.gate==='practicas'?o.tipo==='Prácticas':o.tipo==='Tiempo completo');
const enSet=(set,v)=>set.size===0||v===''||set.has(v);

function pasa(o,salta){
  if(!pasaGate(o))return false;
  if(salta!=='estado'&&S.estado.size&&o.estado&&!S.estado.has(o.estado))return false;
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
const tieneDatos=prop=>TODAS.some(o=>o[prop]!=='');

function ordenar(a){
  if(S.orden==='empresa')return a.sort((x,y)=>x.empresa.localeCompare(y.empresa,'es'));
  if(S.orden==='recientes')return a.sort((x,y)=>String(y.alta).localeCompare(String(x.alta)));
  return a.sort((x,y)=>{
    const dx=dias(x),dy=dias(y);
    if(dx===null&&dy===null)return x.empresa.localeCompare(y.empresa,'es');
    if(dx===null)return 1; if(dy===null)return -1;
    return dx-dy;
  });
}

/* ---------- controles ---------- */
function ops(campo,prop,valores,set,buscador){
  const l=valores.map(v=>{
    const n=cuenta(campo,prop,v);
    return `<label class="opt ${n?'':'vacio'}"><input type="checkbox" data-campo="${campo}" data-v="${esc(v)}" ${set.has(v)?'checked':''}><span>${esc(v)}</span><span class="c">${n}</span></label>`;
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

function pintarFiltros(){
  const ciudades=[...new Set(TODAS.flatMap(o=>o.ciudades))].sort((a,b)=>a.localeCompare(b,'es'));
  const empresas=[...new Set(TODAS.map(o=>o.empresa).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const nAv=S.empresa.size+S.plazo.size+S.curso.size;
  const verCurso=S.gate!=='full'&&tieneDatos('curso');

  /* --- fila 1: industria, modalidad y ciudad --- */
  let h1='';
  if(tieneDatos('practica'))
    h1+=drop('practica','Industria',S.practica.size,ops('practica','practica',PRACTICAS,S.practica));

  if(tieneDatos('modalidad')){
    const et=S.gate==='practicas'?'Tipo de prácticas':S.gate==='full'?'Tipo de entrada':'Modalidad';
    const inner=S.gate==='ambas'
      ? `<div class="grupo">Prácticas</div>${ops('modalidad','modalidad',MOD_P,S.modalidad)}
         <div class="grupo">Tiempo completo</div>${ops('modalidad','modalidad',MOD_F,S.modalidad)}`
      : ops('modalidad','modalidad',S.gate==='practicas'?MOD_P:MOD_F,S.modalidad);
    h1+=drop('modalidad',et,S.modalidad.size,inner);
  }
  if(ciudades.length>1)
    h1+=drop('ciudad','Ciudad',S.ciudad.size,ops('ciudad','ciudades',ciudades,S.ciudad,ciudades.length>8));

  $('#row1').innerHTML=h1;

  /* --- fila 2: tu candidatura, avanzados y guardadas ---
     Guardadas se enseña siempre (aunque FAV esté vacío) para que
     se sepa que la opción existe desde el principio. */
  let h2='';
  h2+=drop('seg','Tu candidatura',S.seg.size,opsSeg());

  h2+=drop('mas','Más filtros',nAv,
    `<div class="grupo">Empresa</div>${ops('empresa','empresa',empresas,S.empresa,true)}
     ${tieneDatos('tipoPlazo')?`<div class="grupo">Tipo de plazo</div>${ops('plazo','tipoPlazo',PLAZOS,S.plazo)}`:''}
     ${verCurso?`<div class="grupo">Curso</div>${ops('curso','curso',CURSOS,S.curso)}`:''}
     <div class="grupo">Orden</div>
     ${[['plazo','Por plazo'],['recientes','Recién añadidas'],['empresa','Por empresa']]
       .map(([v,t])=>`<label class="opt"><input type="radio" name="orden" data-orden="${v}" ${S.orden===v?'checked':''}><span>${t}</span></label>`).join('')}`,
    true);

  h2+=`<button class="chip" aria-pressed="${S.soloFav}" id="favbtn">★ Guardadas<span class="n">${FAV.size}</span></button>`;
  $('#row2').innerHTML=h2;
}

function pintarEstado(abierto){
  const act=ESTADOS.filter(e=>S.estado.has(e));
  $('#estadoline').innerHTML = abierto
    ? `<div class="cajas">${ESTADOS.map(v=>`<label class="opt"><input type="checkbox" data-campo="estado" data-v="${v}" ${S.estado.has(v)?'checked':''}><span>${v}</span></label>`).join('')}</div>`
    : `Mostrando: <b>${act.length?act.join(' · '):'nada'}</b> <button id="estadobtn">cambiar</button>`;
}

function hayFiltros(){
  const estadoPorDefecto=S.estado.size===2&&S.estado.has('Abierta')&&S.estado.has('Próximamente');
  return S.practica.size+S.modalidad.size+S.ciudad.size+S.empresa.size+S.plazo.size+S.curso.size+S.seg.size
    +(S.q?1:0)+(S.soloFav?1:0)+(estadoPorDefecto?0:1) > 0;
}

function pintarControles(estadoAbierto){
  pintarFiltros();
  pintarEstado(estadoAbierto);
  $('#modo').textContent='Buscas: '+({practicas:'Prácticas',full:'Tiempo completo',ambas:'Las dos'}[S.gate]||'—')+' · cambiar';
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

  const items=ordenar(resultados());
  $('#count').textContent=items.length===1?'1 oferta':items.length+' ofertas';

  const ocultas=!S.estado.has('Cerrada')?TODAS.filter(o=>pasa(o,'estado')&&o.estado==='Cerrada').length:0;
  if(PENDIENTE){
    $('#hint').innerHTML=`<div class="hint">Hay datos más recientes. <button id="aplicarnuevos">Aplicarlos</button></div>`;
  }else{
    $('#hint').innerHTML=(ocultas&&items.length)
      ?`<div class="hint">${ocultas===1?'Hay 1 oferta similar que ya está cerrada.':'Hay '+ocultas+' ofertas similares que ya están cerradas.'} <button id="vercerradas">Puedes ver${ocultas===1?'la':'las'} si quieres</button></div>`:'';
  }

  if(!items.length){
    $('#list').innerHTML=`<li class="empty"><b>No hay ninguna posición con esas características</b>
      Prueba a quitar algún filtro o a ampliar la búsqueda.
      ${ocultas?`<br><br>${ocultas===1?'Hay 1 similar que ya está cerrada.':'Hay '+ocultas+' similares que ya están cerradas.'}`:''}
      <br><button id="resetvacio">Quitar todos los filtros</button></li>`;
    return;
  }

  $('#list').innerHTML=items.map(o=>{
    const clave=claveOferta(o),seg=SEG[clave]||'',fav=FAV.has(clave);
    const p=plazo(o);
    const col=colorMarca(o.empresa);
    const meta=[o.practica,o.modalidad,o.ciudades.join(', ')].filter(Boolean).join(' · ');
    const href=(o.link&&o.link!=='#')?`href="${esc(o.link)}" target="_blank" rel="noopener"`:'';
    return `<li><article class="card ${clase(o)}" style="border-left-color:${col}">
      <div class="top">
        <div>
          <div class="empresa"><a ${href}>${esc(o.empresa)}</a></div>
          <p class="desc">${esc(o.descripcion)}</p>
        </div>
        <button class="fav" aria-pressed="${fav}" aria-label="Guardar oferta: ${esc(o.descripcion)} en ${esc(o.empresa)}" data-key="${esc(clave)}">${fav?'★':'☆'}</button>
      </div>
      <div class="tags">
        ${meta?`<span class="meta">${esc(meta)}</span>`:''}
        <span class="plazo n-${p.nivel}">${esc(p.txt)}</span>
      </div>
      <div class="seg">
        <select class="seg-select${seg?' v-'+seg:''}" data-seg="${esc(clave)}" aria-label="Tu candidatura en ${esc(o.empresa)}">
          <option value=""${seg?'':' selected'}>Sin seguimiento</option>
          ${Object.keys(SEG_ETIQ).map(v=>`<option value="${v}"${seg===v?' selected':''}>${SEG_ETIQ[v]}</option>`).join('')}
        </select>
      </div>
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
function abrirGate(){$('#gate').classList.add('on');document.body.classList.add('gate-open');}
function cerrarGate(){$('#gate').classList.remove('on');document.body.classList.remove('gate-open');}
function abrirIntro(){$('#intro').classList.add('on');document.body.classList.add('intro-open');}
function cerrarIntro(){$('#intro').classList.remove('on');document.body.classList.remove('intro-open');}

document.addEventListener('click',e=>{
  if(e.target.closest('#empezar')){
    try{localStorage.setItem(K_INTRO,'1')}catch(err){}
    cerrarIntro();
    S.gate='ambas';
    abrirGate();
    return;
  }
  const g=e.target.closest('.gopt');
  if(g){S.gate=g.dataset.g;try{localStorage.setItem(K_GATE,S.gate)}catch(err){}
    S.modalidad.clear();cerrarGate();render();return;}
  if(e.target.closest('#modo')){abrirGate();return;}
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
    ['practica','modalidad','ciudad','empresa','plazo','curso','seg'].forEach(k=>S[k].clear());
    S.estado=new Set(['Abierta','Próximamente']);S.soloFav=false;S.q='';$('#q').value='';render();return;
  }
});

document.addEventListener('change',e=>{
  const t=e.target;
  if(t.classList.contains('seg-select')){
    const k=t.dataset.seg,v=t.value;
    if(v)SEG[k]=v; else delete SEG[k];
    render();
    return;
  }
  if(t.dataset.campo){
    const s=S[t.dataset.campo],v=t.dataset.v;
    t.checked?s.add(v):s.delete(v);
    /* estos filtros son de opción rápida: elegir una vez y cerrar.
       "Más filtros" queda fuera a propósito, ahí sí conviene marcar
       varias casillas seguidas sin que el panel se cierre solo. */
    const AUTOCIERRE=['practica','modalidad','ciudad','seg'];
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
$('#q').addEventListener('input',e=>{clearTimeout(t);t=setTimeout(()=>{S.q=e.target.value.trim().toLowerCase();render();},130);});

/* =================================================================
   CARGA EN TRES CAPAS
   1. INMEDIATO: datos.json (estático, lo escribe la GitHub Action de
      .github/workflows/actualizar-datos.yml cada hora). Nada bloquea
      este paso — si responde, se pinta al momento.
   2. Si datos.json falla (aún no existe, sin red...), la copia
      guardada en localStorage.
   3. Si tampoco hay nada, esqueletos (ver TARJETA_ESQUELETO en
      pintarLista) hasta que responda la capa de fondo.
   Después de pintar lo que sea, y sin bloquear ese primer pintado,
   refrescar() intenta la hoja en directo de Apps Script por si acaso
   datos.json está desactualizado.
================================================================= */
let CARGADO=false;
function aplicar(data,origen){
  CARGADO=true;
  TODAS=(data.ofertas||[]).map(norm).filter(o=>o.empresa);
  const f=data.actualizado?new Date(data.actualizado).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}):'—';
  let aviso='';
  if(origen==='datos.json'&&data.actualizado){
    const horas=(Date.now()-new Date(data.actualizado).getTime())/3600000;
    if(horas>3)aviso=' · puede estar desactualizado';
  }
  $('#foot').textContent=`Datos actualizados: ${f} · ${origen}${aviso}`;
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
        const nuevas=(data.ofertas||[]).map(norm).filter(o=>o.empresa);
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
  if(primeraVez)abrirIntro();
  else if(!S.gate){S.gate='ambas';abrirGate();}

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

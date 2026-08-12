/* =================================================================
   Pega aquí la URL /exec del Apps Script. Con el valor de fábrica
   la página funciona con datos de ejemplo.
================================================================= */
const API_URL = 'PEGA_AQUI_TU_URL_DE_APPS_SCRIPT';

const K_DATOS='rtc-datos-v2', K_FILT='rtc-filtros-v2', K_FAV='rtc-favoritas-v1', K_GATE='rtc-gate-v1';

const PRACTICAS=['Estrategia','Tecnología y AI','Financiero y M&A','Auditoría'];
const MOD_P=['Summer','Off-cycle'];
const MOD_F=['Graduate programme','Entrada directa'];
const PLAZOS=['Fecha fija','Rolling','Sin publicar'];
const CURSOS=['2º','3º','4º','Máster'];
const ESTADOS=['Abierta','Próximamente','Cerrada'];

const DEMO={actualizado:new Date().toISOString(),ofertas:[
 {id:'RTC-0001',empresa:'McKinsey & Company',descripcion:'Business Analyst',tipo:'Tiempo completo',practica:'Estrategia',modalidad:'Graduate programme',estado:'Abierta',ciudad:'Madrid',curso:'',tipoPlazo:'Rolling',deadline:'',link:'#',alta:'2026-08-01'},
 {id:'RTC-0002',empresa:'QuantumBlack',descripcion:'Data Scientist Intern',tipo:'Prácticas',practica:'Tecnología y AI',modalidad:'Summer',estado:'Abierta',ciudad:'Madrid',curso:'3º',tipoPlazo:'Fecha fija',deadline:'2026-08-18',link:'#',alta:'2026-08-05'},
 {id:'RTC-0003',empresa:'Bain & Company',descripcion:'Associate Consultant Intern',tipo:'Prácticas',practica:'Estrategia',modalidad:'Summer',estado:'Próximamente',ciudad:'Madrid',curso:'3º',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-07-28'},
 {id:'RTC-0004',empresa:'Deloitte',descripcion:'Monitor Deloitte — Analyst',tipo:'Tiempo completo',practica:'Estrategia',modalidad:'Entrada directa',estado:'Abierta',ciudad:'Barcelona',curso:'',tipoPlazo:'Fecha fija',deadline:'2026-09-30',link:'#',alta:'2026-08-02'},
 {id:'RTC-0005',empresa:'Deloitte',descripcion:'Financial Advisory — M&A Intern',tipo:'Prácticas',practica:'Financiero y M&A',modalidad:'Off-cycle',estado:'Abierta',ciudad:'Madrid',curso:'4º',tipoPlazo:'Rolling',deadline:'',link:'#',alta:'2026-08-09'},
 {id:'RTC-0006',empresa:'KPMG',descripcion:'Audit Graduate Programme',tipo:'Tiempo completo',practica:'Auditoría',modalidad:'Graduate programme',estado:'Cerrada',ciudad:'Madrid',curso:'',tipoPlazo:'Fecha fija',deadline:'2026-06-15',link:'#',alta:'2026-05-01'},
 {id:'RTC-0007',empresa:'Accenture',descripcion:'Technology Consulting Intern',tipo:'Prácticas',practica:'Tecnología y AI',modalidad:'Summer',estado:'Abierta',ciudad:'Bilbao',curso:'2º',tipoPlazo:'Fecha fija',deadline:'2026-08-14',link:'#',alta:'2026-08-10'},
 {id:'RTC-0008',empresa:'EY',descripcion:'EY-Parthenon Summer Intern',tipo:'Prácticas',practica:'Estrategia',modalidad:'Summer',estado:'Próximamente',ciudad:'Madrid',curso:'4º',tipoPlazo:'Sin publicar',deadline:'',link:'#',alta:'2026-08-11'}
]};

const HOY=new Date(); HOY.setHours(0,0,0,0);
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let TODAS=[];
let FAV=new Set();
const S={gate:null,practica:new Set(),modalidad:new Set(),ciudad:new Set(),empresa:new Set(),
         plazo:new Set(),curso:new Set(),estado:new Set(['Abierta','Próximamente']),
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
  return {id:g('id','ID'),empresa:g('empresa','Empresa'),descripcion:g('descripcion','Descripción'),
    tipo,estado:est,ciudad:g('ciudad','Ciudad'),link:g('link','Link'),deadline:g('deadline','Deadline'),
    practica:g('practica','Práctica'),modalidad:g('modalidad','Modalidad'),curso:g('curso','Curso'),
    tipoPlazo:g('tipoPlazo','Tipo de plazo'),alta:g('alta','Fecha de alta')};
}

/* =================================================================
   COLORES DE MARCA
   Se busca por coincidencia dentro del nombre, así que "Deloitte",
   "Monitor Deloitte" y "Deloitte Financial Advisory" caen en la misma
   entrada. El orden importa: lo más específico, arriba.
   Las marcas no listadas reciben un color estable derivado del nombre,
   así que añadir empresas a la hoja nunca rompe nada.
================================================================= */
const MARCAS = [
  ['quantumblack',   '#1A1A1A'],
  ['quantum black',  '#1A1A1A'],
  ['mckinsey',       '#051C2C'],
  ['bcg',            '#177B57'],
  ['boston consulting','#177B57'],
  ['bain',           '#C8102E'],
  ['kearney',        '#7A2E3B'],
  ['oliver wyman',   '#0083C1'],
  ['roland berger',  '#009B77'],
  ['strategy&',      '#D04A02'],
  ['monitor',        '#86BC25'],
  ['deloitte',       '#86BC25'],
  ['parthenon',      '#2E2E38'],
  ['ey',             '#2E2E38'],
  ['kpmg',           '#00338D'],
  ['pwc',            '#D04A02'],
  ['accenture',      '#A100FF'],
  ['capgemini',      '#0070AD'],
  ['ntt',            '#0075C2'],
  ['ibm',            '#0F62FE'],
  ['minsait',        '#6E2585'],
  ['indra',          '#6E2585'],
  ['alvarez',        '#00263E'],
  ['alixpartners',   '#E4002B']
];

const sinAcentos=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function colorMarca(nombre){
  const n=sinAcentos(nombre);
  for(const [clave,hex] of MARCAS) if(n.includes(clave)) return hex;
  /* reserva: tono estable a partir del nombre, dentro de la paleta */
  let h=0; for(let i=0;i<n.length;i++) h=(h*31+n.charCodeAt(i))%360;
  return `hsl(${h} 42% 38%)`;
}

function textoSobre(color){
  const m=color.match(/^#([0-9a-f]{6})$/i);
  if(!m) return '#fff';
  const v=parseInt(m[1],16);
  const L=(0.2126*(v>>16&255)+0.7152*(v>>8&255)+0.0722*(v&255))/255;
  return L>0.62?'#151A2B':'#fff';
}

function iniciales(nombre){
  const p=nombre.replace(/&/g,' ').split(/\s+/).filter(w=>w.length>1&&!/^(the|and|de|of|company|group)$/i.test(w));
  return ((p[0]?.[0]||'')+(p[1]?.[0]||'')).toUpperCase()||nombre.slice(0,2).toUpperCase();
}

/* Pon true si prefieres que la barra izquierda sea el color de marca
   en lugar de la señal de urgencia. */
const BARRA_MARCA = false;

/* ---------- plazo y color ---------- */
const dias=o=>{if(!o.deadline)return null;const d=new Date(o.deadline+'T00:00:00');return isNaN(d)?null:Math.round((d-HOY)/86400000);};
function plazo(o){
  if(o.tipoPlazo==='Rolling')return{txt:'Cierra al cubrirse',urge:false};
  if(o.tipoPlazo==='Sin publicar')return{txt:'Sin fecha publicada',urge:false};
  const n=dias(o);
  if(n===null)return{txt:'Sin fecha',urge:false};
  if(n<0)return{txt:'Cerrada',urge:false};
  if(n===0)return{txt:'Hoy',urge:true};
  if(n===1)return{txt:'Mañana',urge:true};
  return{txt:'Quedan '+n+' días',urge:n<=7};
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
  if(salta!=='ciudad'&&!enSet(S.ciudad,o.ciudad))return false;
  if(salta!=='empresa'&&!enSet(S.empresa,o.empresa))return false;
  if(salta!=='plazo'&&!enSet(S.plazo,o.tipoPlazo))return false;
  if(salta!=='curso'&&!enSet(S.curso,o.curso))return false;
  if(S.soloFav&&!FAV.has(o.empresa))return false;
  if(S.q&&!(o.empresa+' '+o.descripcion+' '+o.ciudad).toLowerCase().includes(S.q))return false;
  return true;
}
const resultados=()=>TODAS.filter(o=>pasa(o,null));
const cuenta=(campo,prop,valor)=>TODAS.filter(o=>pasa(o,campo)&&o[prop]===valor).length;
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

function drop(clave,etiqueta,n,interior,ancho){
  return `<details class="drop" data-k="${clave}" data-on="${n?1:0}">
    <summary><span class="lb">${etiqueta}${n?' ('+n+')':''}</span><span class="car">▼</span></summary>
    <div class="panel${ancho?' wide':''}">${interior}</div></details>`;
}

function pintarFiltros(){
  const ciudades=[...new Set(TODAS.map(o=>o.ciudad).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const empresas=[...new Set(TODAS.map(o=>o.empresa).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const nAv=S.empresa.size+S.plazo.size+S.curso.size;
  const verCurso=S.gate!=='full'&&tieneDatos('curso');

  /* --- fila 1: industria y modalidad --- */
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
  $('#row1').innerHTML=h1;

  /* --- fila 2: ciudad y avanzados --- */
  let h2='';
  if(ciudades.length>1)
    h2+=drop('ciudad','Ciudad',S.ciudad.size,ops('ciudad','ciudad',ciudades,S.ciudad,ciudades.length>8));

  h2+=drop('mas','Más filtros',nAv,
    `<div class="grupo">Empresa</div>${ops('empresa','empresa',empresas,S.empresa,true)}
     ${tieneDatos('tipoPlazo')?`<div class="grupo">Tipo de plazo</div>${ops('plazo','tipoPlazo',PLAZOS,S.plazo)}`:''}
     ${verCurso?`<div class="grupo">Curso</div>${ops('curso','curso',CURSOS,S.curso)}`:''}
     <div class="grupo">Orden</div>
     ${[['plazo','Por plazo'],['recientes','Recién añadidas'],['empresa','Por empresa']]
       .map(([v,t])=>`<label class="opt"><input type="radio" name="orden" data-orden="${v}" ${S.orden===v?'checked':''}><span>${t}</span></label>`).join('')}`,
    true);

  if(FAV.size)h2+=`<button class="chip ancho" aria-pressed="${S.soloFav}" id="favbtn">★ Mis empresas<span class="n">${FAV.size}</span></button>`;
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
  return S.practica.size+S.modalidad.size+S.ciudad.size+S.empresa.size+S.plazo.size+S.curso.size
    +(S.q?1:0)+(S.soloFav?1:0)+(estadoPorDefecto?0:1) > 0;
}

function pintarControles(estadoAbierto){
  pintarFiltros();
  pintarEstado(estadoAbierto);
  $('#modo').textContent='Buscas: '+({practicas:'Prácticas',full:'Tiempo completo',ambas:'Las dos'}[S.gate]||'—')+' · cambiar';
  $('#reset').hidden=!hayFiltros();
}

/* ---------- lista ---------- */
function pintarLista(){
  const items=ordenar(resultados());
  $('#count').textContent=items.length===1?'1 oferta':items.length+' ofertas';

  const ocultas=!S.estado.has('Cerrada')?TODAS.filter(o=>pasa(o,'estado')&&o.estado==='Cerrada').length:0;
  $('#hint').innerHTML=(ocultas&&items.length)
    ?`<div class="hint">Hay ${ocultas} ${ocultas===1?'oferta cerrada que también encaja':'ofertas cerradas que también encajan'}. <button id="vercerradas">Mostrarlas</button></div>`:'';

  if(!items.length){
    $('#list').innerHTML=`<li class="empty"><b>No hay ninguna posición con esas características</b>
      Prueba a quitar algún filtro o a ampliar la búsqueda.
      ${ocultas?`<br><br>Hay ${ocultas} cerradas que sí encajan.`:''}
      <br><button id="resetvacio">Quitar todos los filtros</button></li>`;
    return;
  }

  $('#list').innerHTML=items.map(o=>{
    const p=plazo(o),fav=FAV.has(o.empresa);
    const col=colorMarca(o.empresa);
    const href=(o.link&&o.link!=='#')?`href="${esc(o.link)}" target="_blank" rel="noopener"`:'';
    return `<li><article class="card ${clase(o)}" ${BARRA_MARCA?`style="border-left-color:${col}"`:''}>
      <div class="top">
        <span class="logo" aria-hidden="true" style="background:${col};color:${textoSobre(col)}">${esc(iniciales(o.empresa))}</span>
        <div>
          <div class="empresa"><a ${href}>${esc(o.empresa)}</a></div>
          <p class="desc">${esc(o.descripcion)}</p>
        </div>
        <button class="fav" aria-pressed="${fav}" aria-label="Seguir ${esc(o.empresa)}" data-emp="${esc(o.empresa)}">${fav?'★':'☆'}</button>
      </div>
      <div class="tags">
        <span class="pill est">${esc(o.estado||'—')}</span>
        ${o.practica?`<span class="pill">${esc(o.practica)}</span>`:''}
        ${o.modalidad?`<span class="pill">${esc(o.modalidad)}</span>`:''}
        ${o.ciudad?`<span class="pill">${esc(o.ciudad)}</span>`:''}
        <span class="dl ${p.urge?'urge':''}">${p.txt}</span>
      </div>
    </article></li>`;
  }).join('');
}

function render(opts){
  const abiertos=[...document.querySelectorAll('details.drop[open]')].map(d=>d.dataset.k);
  pintarControles(opts&&opts.estadoAbierto);
  pintarLista();
  document.querySelectorAll('details.drop').forEach(d=>{if(abiertos.includes(d.dataset.k))d.open=true;});
  guardar();
}

/* ---------- persistencia ---------- */
const CAMPOS=['practica','modalidad','ciudad','empresa','plazo','curso','estado'];
function guardar(){
  try{
    const o={orden:S.orden,soloFav:S.soloFav};
    CAMPOS.forEach(k=>o[k]=[...S[k]]);
    localStorage.setItem(K_FILT,JSON.stringify(o));
    localStorage.setItem(K_FAV,JSON.stringify([...FAV]));
  }catch(e){}
}
function cargarPrefs(){
  try{
    FAV=new Set(JSON.parse(localStorage.getItem(K_FAV)||'[]'));
    S.gate=localStorage.getItem(K_GATE);
    const o=JSON.parse(localStorage.getItem(K_FILT)||'null');
    if(o){CAMPOS.forEach(k=>{if(o[k])S[k]=new Set(o[k]);});S.orden=o.orden||'plazo';S.soloFav=!!o.soloFav;}
  }catch(e){}
}

/* ---------- eventos ---------- */
document.addEventListener('click',e=>{
  const g=e.target.closest('.gopt');
  if(g){S.gate=g.dataset.g;try{localStorage.setItem(K_GATE,S.gate)}catch(err){}
    S.modalidad.clear();$('#gate').classList.remove('on');render();return;}
  if(e.target.closest('#modo')){$('#gate').classList.add('on');return;}
  const chip=e.target.closest('.chip[data-campo]');
  if(chip){const s=S[chip.dataset.campo],v=chip.dataset.v;s.has(v)?s.delete(v):s.add(v);render();return;}
  if(e.target.closest('#favbtn')){S.soloFav=!S.soloFav;render();return;}
  const f=e.target.closest('.fav');
  if(f){const em=f.dataset.emp;FAV.has(em)?FAV.delete(em):FAV.add(em);if(!FAV.size)S.soloFav=false;render();return;}
  if(e.target.closest('#estadobtn')){pintarEstado(true);return;}
  if(e.target.closest('#vercerradas')){S.estado.add('Cerrada');render();return;}
  if(e.target.closest('#reset')||e.target.closest('#resetvacio')){
    ['practica','modalidad','ciudad','empresa','plazo','curso'].forEach(k=>S[k].clear());
    S.estado=new Set(['Abierta','Próximamente']);S.soloFav=false;S.q='';$('#q').value='';render();return;
  }
});

document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.campo){
    const s=S[t.dataset.campo],v=t.dataset.v;
    t.checked?s.add(v):s.delete(v);
    render({estadoAbierto:t.dataset.campo==='estado'});
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

/* ---------- carga ---------- */
function aplicar(data,origen){
  TODAS=(data.ofertas||[]).map(norm).filter(o=>o.empresa);
  const f=data.actualizado?new Date(data.actualizado).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}):'—';
  $('#foot').textContent=`Datos actualizados: ${f} · ${origen}`;
  render();
}

async function cargar(){
  cargarPrefs();
  if(!S.gate){S.gate='ambas';$('#gate').classList.add('on');}
  try{const c=localStorage.getItem(K_DATOS);if(c)aplicar(JSON.parse(c),'copia guardada');}catch(e){}

  if(API_URL.indexOf('PEGA_AQUI')===0){aplicar(DEMO,'datos de ejemplo');return;}
  try{
    const r=await fetch(API_URL);
    if(!r.ok)throw new Error('HTTP '+r.status);
    const data=await r.json();
    try{localStorage.setItem(K_DATOS,JSON.stringify(data))}catch(e){}
    aplicar(data,'en directo');
  }catch(err){
    if(!TODAS.length){
      $('#count').textContent='';
      $('#list').innerHTML=`<li class="empty"><b>No se pudieron cargar las ofertas</b>Revisa la conexión y vuelve a intentarlo.</li>`;
    }
  }
}
cargar();

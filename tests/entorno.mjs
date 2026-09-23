/* ---------------------------------------------------------------------
   Andamiaje de las pruebas de lógica.

   script.js no tiene módulos ni exporta nada: se evalúa entero con
   `new Function` sobre un DOM de mentira, y al final se le pega una
   línea que expone sus interioridades en globalThis.__api. Así se puede
   probar sin tocar ni una línea del fichero de producción.

   Si añades una función a script.js y quieres probarla, métela en la
   lista de `exporta` de abajo.
--------------------------------------------------------------------- */
import fs from 'fs';
export const RUTA=new URL('../script.js',import.meta.url);

export function montar({almacen={}, fallaLocalStorage=false, respuestas={}}={}){
  const nodo=()=>({innerHTML:'',textContent:'',value:'',hidden:false,className:'',style:{},dataset:{},
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},contains(c){return this._s.has(c)}},
    addEventListener(){},setAttribute(){},getBoundingClientRect(){return{bottom:0}},
    querySelectorAll(){return[]},querySelector(){return nodo()}});
  const pantalla={};
  const doc={querySelector(s){return pantalla[s]||=nodo()},querySelectorAll(){return[]},
    addEventListener(t,f){(doc._h||={})[t]=f},body:{classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},contains(c){return this._s.has(c)}}}};
  globalThis.document=doc;
  globalThis.localStorage=fallaLocalStorage
    ? {getItem(){throw new Error('bloqueado')},setItem(){throw new Error('bloqueado')},removeItem(){throw new Error('bloqueado')}}
    : {getItem:k=>k in almacen?almacen[k]:null,setItem:(k,v)=>almacen[k]=String(v),removeItem:k=>delete almacen[k]};
  globalThis.matchMedia=()=>({matches:false});
  globalThis.AbortController=class{constructor(){this.signal={}}abort(){}};
  globalThis.fetch=async(url)=>{
    for(const [clave,r] of Object.entries(respuestas))
      if(String(url).includes(clave)) return typeof r==='function'?r():r;
    throw new Error('sin ruta para '+url);
  };
  const src=fs.readFileSync(RUTA,'utf8');
  const exporta='\nglobalThis.__api={S,get TODAS(){return TODAS},set TODAS(v){TODAS=v},get FAV(){return FAV},get SEG(){return SEG},'
    +'get CARGADO(){return CARGADO},get PENDIENTE(){return PENDIENTE},set PENDIENTE(v){PENDIENTE=v},'
    +'norm,plazo,plazoEvento,clase,dias,fechaDeadline,estadoReal,esEvento,pasaGate,pasa,cuenta,tieneDatos,ordenar,resultados,'
    +'colorMarca,claveOferta,render,pintarFiltros,pintarLista,aplicar,guardar,cargarPrefs,hayFiltros,refrescar,'
    +'MOD_E,MOD_P,MOD_F,PRACTICAS,DEMO,esc,normalizarTodas};';
  new Function(src+exporta)();
  return {api:globalThis.__api, pantalla, doc, almacen};
}

/* ---------- fechas relativas a hoy ----------
   Ojo: NO usar toISOString() para esto. Convierte a UTC, y en horario
   peninsular (UTC+1/+2) la medianoche local cae en el día anterior, así
   que d(1) devolvería hoy. Se formatea a mano desde la hora local. */
const iso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
export const dia=n=>{const x=new Date();x.setHours(0,0,0,0);x.setDate(x.getDate()+n);return iso(x)};

let ok=0, fallos=[];
export const eq=(a,b,msg)=>{
  const A=JSON.stringify(a), B=JSON.stringify(b);
  if(A===B) ok++; else fallos.push(`${msg}\n      esperado: ${B}\n      obtenido: ${A}`);
};
export const cierto=(v,msg)=>eq(!!v,true,msg);
export const resumen=titulo=>{
  console.log(`\n${fallos.length?'✗':'✓'} ${titulo}: ${ok} pasan, ${fallos.length} fallan`);
  fallos.forEach(f=>console.log('   ✗ '+f));
  const n=fallos.length; ok=0; fallos=[]; return n;
};

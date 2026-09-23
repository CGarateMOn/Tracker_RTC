/* ---------------------------------------------------------------------
   Estado que sobrevive a la sesión: localStorage (incluido corrupto y
   bloqueado), qué se limpia al cambiar de gate, la carga en tres capas
   y el refresco en directo contra Apps Script.
--------------------------------------------------------------------- */
import {montar,eq,cierto,resumen,dia as d} from './entorno.mjs';
import {oferta as fila, evento, respuesta as datos} from './datos.mjs';
let malos=0;
const espera=ms=>new Promise(r=>setTimeout(r,ms));

/* ============ 12. persistencia ============ */
{
  const almacen={};
  const {api}=montar({almacen});
  api.S.gate='ambas';
  api.S.practica=new Set(['Estrategia']); api.S.ciudad=new Set(['Madrid']);
  api.S.orden='empresa'; api.S.soloFav=true; api.FAV.add('id:7'); api.SEG['id:7']='entrevista';
  api.guardar();
  cierto(almacen['rtc-filtros-v2'],'filtros guardados');
  cierto(almacen['rtc-favoritas-v2'],'favoritas guardadas');
  cierto(almacen['rtc-seguimiento-v1'],'seguimiento guardado');

  /* nueva sesión con ese almacén */
  const b=montar({almacen:{...almacen,'rtc-gate-v1':'eventos'}});
  b.api.cargarPrefs();
  eq([...b.api.S.practica],['Estrategia'],'se recupera el sector');
  eq([...b.api.S.ciudad],['Madrid'],'se recupera la ciudad');
  eq(b.api.S.orden,'empresa','se recupera el orden');
  eq(b.api.S.soloFav,true,'se recupera "solo guardadas"');
  eq([...b.api.FAV],['id:7'],'se recuperan las favoritas');
  eq(b.api.SEG,{'id:7':'entrevista'},'se recupera el seguimiento');
  eq(b.api.S.gate,'eventos','se recupera el gate nuevo "eventos"');

  /* gate antiguo sigue valiendo */
  const c=montar({almacen:{'rtc-gate-v1':'ambas'}});
  c.api.cargarPrefs(); eq(c.api.S.gate,'ambas','el gate "ambas" de antes sigue funcionando');

  /* almacén corrupto */
  const e=montar({almacen:{'rtc-filtros-v2':'{roto','rtc-favoritas-v2':'nope','rtc-seguimiento-v1':'[[['}});
  let err=null; try{e.api.cargarPrefs()}catch(x){err=x.message}
  eq(err,null,'localStorage corrupto no rompe el arranque');

  /* localStorage bloqueado (modo privado) */
  const f=montar({fallaLocalStorage:true});
  let err2=null;
  try{f.api.cargarPrefs(); f.api.aplicar(datos([fila({ID:'1'}),evento({ID:'e1'})]),'t');
      f.api.S.gate='eventos'; f.api.render(); f.api.guardar();}catch(x){err2=x.message}
  eq(err2,null,'localStorage bloqueado: la app sigue funcionando');
  malos+=resumen('persistencia');
}

/* ============ 13. cambiar de sección limpia TODOS los filtros ============ */
{
  const {api,doc}=montar();
  api.aplicar(datos([fila({ID:'1'}),evento({ID:'e1'})]),'t');
  const clic=g=>doc._h.click({target:{closest:s=>s==='.gopt'?{dataset:{g}}:null}});
  const ponerDeTodo=()=>{
    api.S.practica=new Set(['Estrategia']); api.S.modalidad=new Set(['Summer']);
    api.S.ciudad=new Set(['Madrid']);       api.S.empresa=new Set(['ACME']);
    api.S.plazo=new Set(['Rolling']);       api.S.curso=new Set(['Todos']);
    api.S.seg=new Set(['aplicada']);        api.S.estado=new Set(['Cerrada']);
    api.S.soloFav=true;                     api.S.q='mckinsey';
  };
  const activos=()=>['practica','modalidad','ciudad','empresa','plazo','curso','seg']
    .reduce((n,k)=>n+api.S[k].size,0)+(api.S.soloFav?1:0)+(api.S.q?1:0);

  /* de prácticas a eventos */
  api.S.gate='practicas'; ponerDeTodo(); clic('eventos');
  eq(activos(),0,'cambiar de sección: no queda ningún filtro puesto');
  eq([...api.S.estado].sort(),['Abierta','Próximamente'],'cambiar de sección: el estado vuelve a su valor por defecto');
  eq(api.S.q,'','cambiar de sección: se limpia la búsqueda');
  eq(api.hayFiltros(),false,'cambiar de sección: hayFiltros() dice que no hay ninguno');

  /* también entre las dos secciones de trabajo, que antes sí se portaban */
  api.S.gate='practicas'; ponerDeTodo(); clic('full');
  eq(activos(),0,'de prácticas a contrato laboral: tampoco se portan');
  api.S.gate='ambas'; ponerDeTodo(); clic('practicas');
  eq(activos(),0,'de Todo a prácticas: tampoco se portan');
  api.S.gate='eventos'; ponerDeTodo(); clic('ambas');
  eq(activos(),0,'de eventos a Todo: tampoco se portan');

  /* lo que NO son filtros se respeta */
  api.FAV.add('id:1'); api.SEG['id:1']='entrevista'; api.S.orden='empresa';
  api.S.gate='practicas'; ponerDeTodo(); clic('eventos');
  eq([...api.FAV],['id:1'],'cambiar de sección: las guardadas no se tocan');
  eq(api.SEG,{'id:1':'entrevista'},'cambiar de sección: el seguimiento no se toca');
  eq(api.S.orden,'empresa','cambiar de sección: el orden no es un filtro, se respeta');

  /* volver a elegir la MISMA sección no limpia: no te has movido */
  api.S.gate='eventos'; ponerDeTodo(); clic('eventos');
  cierto(activos()>0,'reelegir la misma sección no limpia nada');
  malos+=resumen('cambio de sección');
}

/* ============ 13b. la promo del grupo: la tarjeta, una sola vez por navegador ============ */
{
  const almacen={};
  const {api,pantalla,doc}=montar({almacen});
  const chip=()=>pantalla['#promoChip'], tarjeta=()=>pantalla['#promoCard'];
  const elegirGate=g=>doc._h.click({target:{closest:s=>s==='.gopt'?{dataset:{g}}:null}});
  api.aplicar(datos([evento({ID:'e1'})]),'t');

  /* primera elección de gate: se despliega */
  elegirGate('eventos');
  eq(tarjeta().hidden,false,'promo: la primera vez se despliega sola');
  eq(chip().hidden,false,'promo: la píldora se ve');
  eq(almacen['rtc-promo-v1'],'1','promo: queda marcada como vista');

  /* cambiar de gate ya NO la vuelve a desplegar */
  elegirGate('practicas');
  eq(tarjeta().hidden,true,'promo: al cambiar de gate ya no se despliega');
  eq(chip().hidden,false,'promo: la píldora sigue ahí');
  elegirGate('ambas');
  eq(tarjeta().hidden,true,'promo: ni al tercer cambio de gate');

  /* pero se puede abrir a mano desde la píldora, y cerrarla */
  doc._h.click({target:{closest:s=>s==='#promoChip'?{}:null}});
  eq(tarjeta().hidden,false,'promo: la píldora la sigue abriendo a mano');
  doc._h.click({target:{closest:s=>s==='#promoClose'?{}:null}});
  eq(tarjeta().hidden,true,'promo: la X la cierra');

  /* sesión nueva con ese mismo almacén: píldora sí, tarjeta no */
  const b=montar({almacen:{...almacen,'rtc-intro-v1':'1','rtc-gate-v1':'eventos'},
                  respuestas:{'datos.json':{ok:true,json:async()=>datos([evento({ID:'e1'})])}}});
  await espera(40);
  eq(b.pantalla['#promoChip'].hidden,false,'promo: al volver, la píldora se ve');
  eq(b.pantalla['#promoCard'].hidden,true,'promo: al volver, la tarjeta NO se despliega');

  /* usuario que nunca la ha visto y vuelve con el gate ya elegido: se le enseña una vez.
     Se le marca la novedad de eventos para aislar la promo: si no, la guía
     tiene prioridad y la promo se aplaza (eso se prueba aparte, más abajo). */
  const c=montar({almacen:{'rtc-intro-v1':'1','rtc-gate-v1':'ambas','rtc-novedad-eventos-v1':'1'},
                  respuestas:{'datos.json':{ok:true,json:async()=>datos([evento({ID:'e1'})])}}});
  await espera(40);
  eq(c.pantalla['#promoCard'].hidden,false,'promo: quien no la ha visto la recibe al volver');
  eq(c.almacen['rtc-promo-v1'],'1','promo: y queda marcada');

  /* quien ya la había cerrado con la X antes de este cambio no la vuelve a ver */
  const d2=montar({almacen:{'rtc-intro-v1':'1','rtc-gate-v1':'ambas','rtc-promo-v1':'1','rtc-novedad-eventos-v1':'1'},
                   respuestas:{'datos.json':{ok:true,json:async()=>datos([evento({ID:'e1'})])}}});
  await espera(40);
  eq(d2.pantalla['#promoCard'].hidden,true,'promo: quien ya la cerró antes no la vuelve a ver');

  /* con localStorage bloqueado no se cuelga: se enseña y punto */
  const e=montar({fallaLocalStorage:true});
  let err=null;
  try{e.api.aplicar(datos([evento({ID:'e1'})]),'t');
      e.doc._h.click({target:{closest:s=>s==='.gopt'?{dataset:{g:'eventos'}}:null}});}catch(x){err=x.message}
  eq(err,null,'promo: localStorage bloqueado no rompe nada');
  malos+=resumen('promo del grupo');
}

/* ============ 13c. guía "ahora hay eventos", una sola vez y solo a los antiguos ============ */
{
  const datosFake={'datos.json':{ok:true,json:async()=>datos([evento({ID:'e1'})])}};
  const antiguo=()=>({'rtc-intro-v1':'1','rtc-gate-v1':'practicas','rtc-promo-v1':'1'});
  const palpita=(pantalla,sel)=>pantalla[sel]&&pantalla[sel].classList.contains('palpita');

  /* usuario antiguo: arranca palpitando la píldora de cambiar de sección */
  const almacen=antiguo();
  const {pantalla,doc}=montar({almacen,respuestas:datosFake});
  await espera(40);
  eq(palpita(pantalla,'#modo'),true,'guía: al volver, palpita "cambiar"');
  eq(almacen['rtc-novedad-eventos-v1'],'1','guía: se marca al arrancar, no al terminar');

  /* al abrir el gate pasa el testigo a la opción Eventos */
  doc._h.click({target:{closest:s=>s==='#modo'?{}:null}});
  eq(palpita(pantalla,'#modo'),false,'guía: deja de palpitar "cambiar" al abrir el gate');
  eq(pantalla['#gate'].classList.contains('on'),true,'guía: el gate se abre');

  /* elegir sección termina la guía */
  doc._h.click({target:{closest:s=>s==='.gopt'?{dataset:{g:'eventos'}}:null}});
  eq(palpita(pantalla,'#modo'),false,'guía: termina al elegir sección');

  /* segunda visita del mismo usuario: ya no palpita nada */
  const b=montar({almacen,respuestas:datosFake});
  await espera(40);
  eq(palpita(b.pantalla,'#modo'),false,'guía: en la siguiente visita ya no palpita');

  /* usuario NUEVO: ve la intro, no la guía, y queda marcada para siempre */
  const nuevo={};
  const c=montar({almacen:nuevo,respuestas:datosFake});
  await espera(40);
  eq(c.pantalla['#intro'].classList.contains('on'),true,'guía: al nuevo le sale la intro');
  eq(palpita(c.pantalla,'#modo'),false,'guía: al nuevo NO le palpita nada');
  eq(nuevo['rtc-novedad-eventos-v1'],'1','guía: al nuevo se le da por vista (ya ve Eventos en el gate)');
  /* y al volver tampoco le salta */
  const d2=montar({almacen:{...nuevo,'rtc-gate-v1':'ambas'},respuestas:datosFake});
  await espera(40);
  eq(palpita(d2.pantalla,'#modo'),false,'guía: al nuevo no le salta en visitas posteriores');

  /* antiguo sin sección elegida: el gate ya está abierto, se salta el primer paso */
  const e={'rtc-intro-v1':'1'};
  const f=montar({almacen:e,respuestas:datosFake});
  await espera(40);
  eq(f.pantalla['#gate'].classList.contains('on'),true,'guía: sin sección elegida se abre el gate');
  eq(palpita(f.pantalla,'#modo'),false,'guía: ahí no palpita "cambiar" (el gate ya está abierto)');
  eq(e['rtc-novedad-eventos-v1'],'1','guía: también queda marcada');

  /* ventana privada: se da por vista, para no repetirla en cada carga */
  const g=montar({fallaLocalStorage:true,respuestas:datosFake});
  let err=null; try{await espera(40)}catch(x){err=x.message}
  eq(err,null,'guía: localStorage bloqueado no rompe nada');
  eq(palpita(g.pantalla,'#modo'),false,'guía: en ventana privada no palpita (se da por vista)');
  /* guía y promo nunca a la vez: la tarjeta de la promo espera a la
     siguiente visita para no tapar lo que la guía está señalando */
  const sinNada={'rtc-intro-v1':'1','rtc-gate-v1':'practicas'};   /* ni promo ni novedad vistas */
  const h=montar({almacen:sinNada,respuestas:datosFake});
  await espera(40);
  eq(palpita(h.pantalla,'#modo'),true,'guía+promo: palpita la guía');
  eq(h.pantalla['#promoCard'].hidden,true,'guía+promo: la tarjeta de promo NO se despliega encima');
  eq(h.pantalla['#promoChip'].hidden,false,'guía+promo: la píldora de promo sí se ve');
  eq(sinNada['rtc-promo-v1'],undefined,'guía+promo: la promo queda pendiente para la próxima visita');
  const i=montar({almacen:sinNada,respuestas:datosFake});
  await espera(40);
  eq(palpita(i.pantalla,'#modo'),false,'guía+promo: en la 2ª visita la guía ya no sale');
  eq(i.pantalla['#promoCard'].hidden,false,'guía+promo: y ahora sí se despliega la promo');
  malos+=resumen('guía de eventos');
}

/* ============ 14. carga en tres capas ============ */
{
  /* capa 1: datos.json responde */
  const a=montar({respuestas:{'datos.json':{ok:true,json:async()=>datos([fila({ID:'1'}),evento({ID:'e1'})])}}});
  await espera(30);
  eq(a.api.TODAS.length,2,'capa 1: pinta desde datos.json');
  cierto(a.api.CARGADO,'capa 1: marca CARGADO');

  /* capa 2: datos.json falla → copia de localStorage */
  const b=montar({almacen:{'rtc-datos-v2':JSON.stringify(datos([evento({ID:'e9'})]))},
                  respuestas:{'datos.json':()=>{throw new Error('404')}}});
  await espera(30);
  eq(b.api.TODAS.map(o=>o.id),['e9'],'capa 2: cae a la copia de localStorage');

  /* capa 3: nada → esqueletos */
  const c=montar({respuestas:{}});
  await espera(30);
  eq(c.api.CARGADO,false,'capa 3: sin datos, no marca CARGADO');
  cierto(c.pantalla['#list'].innerHTML.includes('skel'),'capa 3: pinta esqueletos');
  eq(c.pantalla['#count'].textContent,'','capa 3: contador vacío, no "0 ofertas"');
  malos+=resumen('carga en tres capas');
}

/* ============ 15. refresco en directo ============ */
{
  const payload=datos([fila({ID:'1'}),fila({ID:'2',"Práctica":'Auditoría & Legal'}),evento({ID:'e1'})]);
  const {api,pantalla}=montar({respuestas:{
    'datos.json':{ok:true,json:async()=>payload},
    'script.google.com':{ok:true,json:async()=>payload},   /* MISMOS datos que ya están pintados */
  }});
  await espera(60);
  eq(api.TODAS.map(o=>o.id),['1','e1'],'Auditoría & Legal se descarta, el evento no');
  api.S.practica=new Set(['Estrategia']);         /* usuario con filtros activos */
  api.PENDIENTE=null;
  await api.refrescar();
  eq(api.PENDIENTE,null,'datos idénticos: NO debe aparecer el aviso "Hay datos más recientes"');
  eq(pantalla['#hint'].innerHTML.includes('datos más recientes'),false,'datos idénticos: sin banner');

  /* y si SÍ cambian, el aviso debe aparecer */
  const otro=datos([fila({ID:'1'}),fila({ID:'3'}),evento({ID:'e1'})]);
  /* el primer refresco (el del arranque) devuelve lo mismo; el segundo, datos nuevos */
  let llamadas=0;
  const {api:a2,pantalla:p2}=montar({respuestas:{
    'datos.json':{ok:true,json:async()=>payload},
    'script.google.com':()=>({ok:true,json:async()=>(llamadas++===0?payload:otro)}),
  }});
  await espera(60);
  eq(a2.PENDIENTE,null,'arranque con datos iguales: sin banner');
  a2.S.practica=new Set(['Estrategia']);
  await a2.refrescar();
  cierto(a2.PENDIENTE,'datos distintos + filtros activos: sí avisa');
  cierto(p2['#hint'].innerHTML.includes('datos más recientes'),'datos distintos: sale el banner');

  /* sin filtros activos, se aplica solo sin preguntar */
  const {api:a3}=montar({respuestas:{
    'datos.json':{ok:true,json:async()=>payload},
    'script.google.com':{ok:true,json:async()=>otro},
  }});
  await espera(60);
  await a3.refrescar();
  eq(a3.PENDIENTE,null,'sin filtros: aplica en silencio, sin banner');
  eq(a3.TODAS.map(o=>o.id),['1','3','e1'],'sin filtros: los datos nuevos ya están dentro');
  malos+=resumen('refresco en directo');
}
process.exit(malos?1:0);

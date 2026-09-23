/* ---------------------------------------------------------------------
   Casos límite: filas corruptas o a medias, volumen, y enlaces con
   esquemas que no deben acabar en un href.
--------------------------------------------------------------------- */
import {montar,eq,cierto,resumen,dia as d} from './entorno.mjs';
import {evento, respuesta as datos} from './datos.mjs';
let malos=0;

/* ---- 16. basura y casos límite en los datos ---- */
{
  const {api,pantalla}=montar();
  const casos={
    'sin clave ofertas':{actualizado:'x'},
    'ofertas null':{ofertas:null},
    'ofertas no es array':{ofertas:'nope'},
    'fila null':{ofertas:[null,evento()]},
    'fila vacía':{ofertas:[{},evento()]},
    'sin empresa':{ofertas:[evento({Empresa:''})]},
    'deadline basura':{ofertas:[evento({Deadline:'32/13/2026'})]},
    'deadline ISO con Z':{ofertas:[evento({Deadline:d(5)+'T22:00:00.000Z'})]},
    'IDs duplicados':{ofertas:[evento({ID:'dup'}),evento({ID:'dup',"Descripción":'Otra'})]},
    'sin ID':{ofertas:[evento({ID:''}),evento({ID:'',"Descripción":'Otra'})]},
    'texto larguísimo':{ofertas:[evento({"Descripción":'x'.repeat(3000),Empresa:'y'.repeat(300)})]},
    'emoji y acentos':{ofertas:[evento({Empresa:'Ñandú 🚀 & Cía',"Descripción":'Charla · í ü ç'})]},
    'campos numéricos':{ofertas:[evento({Deadline:20261115,Empresa:12345})]},
  };
  for(const [nombre,data] of Object.entries(casos)){
    let err=null;
    try{ api.aplicar(data,'t'); for(const g of ['eventos','ambas','practicas']){api.S.gate=g;api.render();} }
    catch(e){ err=e.message }
    eq(err,null,`no revienta con: ${nombre}`);
  }
  /* dos eventos sin ID y con descripción distinta → claves distintas (favoritos no se mezclan) */
  api.aplicar(datos([evento({ID:''}),evento({ID:'',"Descripción":'Otra'})]),'t');
  const [a,b]=api.TODAS.map(api.claveOferta);
  cierto(a!==b,'dos eventos sin ID no comparten favorito');
  /* IDs duplicados SÍ comparten clave: limitación conocida, que quede documentada por el test */
  api.aplicar(datos([evento({ID:'dup'}),evento({ID:'dup',"Descripción":'Otra'})]),'t');
  eq(api.TODAS.map(api.claveOferta)[0],api.TODAS.map(api.claveOferta)[1],'IDs duplicados en la hoja comparten estado (limitación conocida)');
  malos+=resumen('datos corruptos y límites');
}

/* ---- 17. volumen ---- */
{
  const {api,pantalla}=montar();
  const muchos=[];
  for(let i=0;i<1200;i++) muchos.push(evento({ID:'E'+i,Empresa:'Empresa '+(i%140),Deadline:d(i%200),
    Modalidad:['On-line','En persona','Híbrido'][i%3]}));
  api.aplicar(datos(muchos),'t');
  api.S.gate='eventos';
  const t0=Date.now(); api.render(); const ms=Date.now()-t0;
  cierto(ms<3000,`1200 eventos y 140 organizadores: render en ${ms} ms`);
  cierto(pantalla['#row1'].innerHTML.includes('class="buscar"'),'con 140 organizadores aparece el buscador del panel');
  eq(api.TODAS.length,1200,'no se pierde ninguna fila');
  malos+=resumen('volumen');
}

/* ---- 18. esquemas de enlace peligrosos ---- */
{
  const {api,pantalla}=montar();
  api.aplicar(datos([evento({ID:'js',Link:'javascript:alert(1)'}),evento({ID:'ok',Link:'https://bien.test'}),
                     evento({ID:'vacio',Link:'#'})]),'t');
  api.S.gate='eventos'; api.render();
  const h=pantalla['#list'].innerHTML;
  const hrefs=[...h.matchAll(/href="([^"]*)"/g)].map(m=>m[1]);
  cierto(!hrefs.some(u=>/^javascript:/i.test(u)),'un Link "javascript:" no llega a href');
  cierto(hrefs.includes('https://bien.test'),'los enlaces normales se conservan');
  cierto(!hrefs.includes('#'),'el placeholder "#" no genera enlace');
  malos+=resumen('enlaces');
}
process.exit(malos?1:0);

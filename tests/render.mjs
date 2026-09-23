/* ---------------------------------------------------------------------
   Pintado: que render() no reviente con ninguna combinación de datos y
   gate, que cada vista enseñe los controles que le tocan, y que las
   tarjetas, los avisos y el contador digan lo correcto.
--------------------------------------------------------------------- */
import {montar,eq,cierto,resumen,dia as d} from './entorno.mjs';
import {oferta as fila, evento, respuesta as datos} from './datos.mjs';
let malos=0;


/* ============ 6. render en todos los gates, con datos y sin ellos ============ */
{
  const conjuntos={
    'vacío':[],
    'solo ofertas':[fila({ID:'1'}),fila({ID:'2',"Tipo de Oferta":'Tiempo completo',Modalidad:'Entrada directa'})],
    'solo eventos':[evento({ID:'e1'}),evento({ID:'e2',Modalidad:'En persona',Ciudad:''})],
    'mezcla':[fila({ID:'1'}),evento({ID:'e1'}),fila({ID:'2',Estado:'Cerrada'}),evento({ID:'e2',Deadline:d(-3)})],
    'todo cerrado':[fila({ID:'1',Estado:'Cerrada'}),evento({ID:'e1',Deadline:d(-5)})],
    'campos vacíos':[fila({ID:'x',Empresa:'Z',"Práctica":'',Modalidad:'',Ciudad:'',Deadline:'',"Tipo de plazo":'',Curso:''})],
  };
  const {api,pantalla}=montar();
  for(const [nombre,ofertas] of Object.entries(conjuntos)){
    api.aplicar(datos(ofertas),'test');
    for(const g of ['practicas','full','eventos','ambas']){
      api.S.gate=g;
      let err=null; try{api.render()}catch(e){err=e.message}
      eq(err,null,`render sin excepción · ${nombre} · gate ${g}`);
      cierto(typeof pantalla['#list'].innerHTML==='string','#list se pinta · '+nombre+' · '+g);
      cierto(pantalla['#count'].textContent!=='undefined','#count se pinta · '+nombre+' · '+g);
    }
  }
  malos+=resumen('render() en toda combinación de datos × gate');
}

/* ============ 7. la vista de eventos enseña exactamente 3 controles ============ */
{
  const {api,pantalla}=montar();
  api.aplicar(datos([evento({ID:'e1'}),evento({ID:'e2',Modalidad:'En persona',Empresa:'Otra'}),fila({ID:'1',Ciudad:'Bilbao'})]),'t');
  api.S.gate='eventos'; api.render();
  const r1=pantalla['#row1'].innerHTML, r2=pantalla['#row2'].innerHTML;
  eq([...r1.matchAll(/class="lb">([^<]*)</g)].map(m=>m[1]),['Formato','Organizador'],'eventos: fila 1 = Formato + Organizador');
  cierto(/id="favbtn"/.test(r1),'eventos: Guardados en la fila 1');
  eq(r2,'','eventos: fila 2 vacía (sin Orden)');
  eq(pantalla['#row2'].className,'','eventos: fila 2 sin clase, no deja margen suelto');
  for(const prohibido of ['Sector','Ciudad','Curso','Tipo de plazo','Tu candidatura','Más filtros','Orden'])
    cierto(!(r1+r2).includes('>'+prohibido),`eventos: no aparece "${prohibido}"`);
  cierto(/Guardados/.test(r1)&&!/Guardadas/.test(r1),'eventos: dice "Guardados"');

  api.S.gate='ambas'; api.render();
  const a1=pantalla['#row1'].innerHTML, a2=pantalla['#row2'].innerHTML;
  for(const esperado of ['Sector','Modalidad','Ciudad','Tu candidatura','Más filtros'])
    cierto((a1+a2).includes('>'+esperado),`ofertas: sigue estando "${esperado}"`);
  cierto(/Guardadas/.test(a2),'ofertas: dice "Guardadas"');
  cierto((a1+a2).includes('>Eventos</div>'),'ofertas: el panel de Modalidad tiene el grupo Eventos');
  malos+=resumen('controles por vista');
}

/* ============ 8. Formato solo enseña lo que existe ============ */
{
  const {api,pantalla}=montar();
  const ver=()=>[...pantalla['#row1'].innerHTML.matchAll(/data-campo="modalidad" data-v="([^"]*)"/g)].map(m=>m[1]);
  api.S.gate='eventos';
  api.aplicar(datos([evento({ID:'a'}),evento({ID:'b',Modalidad:'En persona'})]),'t'); api.render();
  eq(ver(),['Presencial','Online'],'dos formatos presentes → dos opciones');
  api.aplicar(datos([evento({ID:'a'}),evento({ID:'b'})]),'t'); api.render();
  eq(ver(),[],'un solo formato → no hay desplegable (no filtraría nada)');
  api.aplicar(datos([evento({ID:'a'}),evento({ID:'b',Modalidad:'En persona'}),evento({ID:'c',Modalidad:'Híbrido'})]),'t'); api.render();
  eq(ver(),['Presencial','Online','Híbrido'],'tres formatos → tres opciones');
  malos+=resumen('opciones de Formato');
}

/* ============ 9. tarjeta: seguimiento, estrella y escapado ============ */
{
  const {api,pantalla}=montar();
  api.aplicar(datos([fila({ID:'1'}),evento({ID:'e1'})]),'t');
  api.S.gate='ambas'; api.render();
  const html=pantalla['#list'].innerHTML;
  eq((html.match(/seg-select/g)||[]).length,1,'solo la oferta lleva desplegable de seguimiento');
  eq((html.match(/class="fav"/g)||[]).length,2,'las dos llevan estrella');
  eq((html.match(/tag-evento/g)||[]).length,1,'solo el evento lleva etiqueta EVENTO');
  cierto(/Guardar evento: /.test(html),'aria-label del evento dice "Guardar evento"');
  cierto(/Guardar oferta: /.test(html),'aria-label de la oferta dice "Guardar oferta"');
  cierto(!/is-evento/.test(html),'sin clase is-evento (fondo blanco como el resto)');

  /* escapado */
  api.aplicar(datos([fila({ID:'x',Empresa:'<img src=x onerror=alert(1)>',"Descripción":'"><script>alert(2)</script>',
    Link:'https://x.test/?a=1&b="2"',Ciudad:'Madrid'})]),'t');
  api.render();
  const h=pantalla['#list'].innerHTML;
  cierto(!/<img src=x/.test(h),'empresa con HTML → escapada');
  cierto(!/<script>/.test(h),'descripción con <script> → escapada');
  cierto(h.includes('&lt;img'),'empresa aparece escapada como texto');
  cierto(/href="https:\/\/x.test\/\?a=1&amp;b=&quot;2&quot;"/.test(h),'link escapado sin romper el atributo');
  /* meta sin duplicados */
  api.aplicar(datos([evento({ID:'o',Ciudad:'Online',Modalidad:'On-line',"Práctica":''})]),'t');
  api.S.gate='eventos'; api.render();
  eq([...pantalla['#list'].innerHTML.matchAll(/class="meta">([^<]*)</g)].map(m=>m[1]),['Online'],'"Online · Online" se deduplica');
  malos+=resumen('tarjetas');
}

/* ============ 10. estados vacíos ============ */
{
  const {api,pantalla}=montar();
  api.S.gate='eventos';
  api.aplicar(datos([fila({ID:'1'})]),'t'); api.render();
  cierto(/Aún no hay eventos publicados/.test(pantalla['#list'].innerHTML),'sin ningún evento: mensaje propio');
  cierto(/id="abrirgate"/.test(pantalla['#list'].innerHTML),'sin eventos: botón para ir a las ofertas');
  cierto(!/Quitar todos los filtros/.test(pantalla['#list'].innerHTML),'sin eventos: NO pide quitar filtros');

  api.aplicar(datos([evento({ID:'e1',Deadline:d(-9)})]),'t'); api.render();
  const h=pantalla['#list'].innerHTML;
  cierto(/No hay ningún evento con esas características/.test(h),'eventos todos pasados: mensaje de filtros');
  cierto(/ya se celebró/.test(h),'eventos pasados: avisa de los ya celebrados, en masculino');

  api.aplicar(datos([fila({ID:'1',Estado:'Cerrada'})]),'t'); api.S.gate='ambas'; api.render();
  cierto(/ya está cerrada/.test(pantalla['#list'].innerHTML),'ofertas cerradas: texto en femenino');
  malos+=resumen('estados vacíos y avisos');
}

/* ============ 11. contador ============ */
{
  const {api,pantalla}=montar();
  const t=()=>pantalla['#count'].textContent;
  api.aplicar(datos([evento({ID:'e1'})]),'x'); api.S.gate='eventos'; api.render(); eq(t(),'1 evento','1 evento');
  api.aplicar(datos([evento({ID:'e1'}),evento({ID:'e2'})]),'x'); api.render(); eq(t(),'2 eventos','2 eventos');
  api.aplicar(datos([fila({ID:'1'})]),'x'); api.S.gate='ambas'; api.render(); eq(t(),'1 oferta','1 oferta');
  api.aplicar(datos([fila({ID:'1'}),fila({ID:'2'})]),'x'); api.render(); eq(t(),'2 ofertas','2 ofertas');
  api.aplicar(datos([fila({ID:'1'}),evento({ID:'e1'})]),'x'); api.render(); eq(t(),'2 resultados','mezcla → resultados');
  malos+=resumen('contador');
}
process.exit(malos?1:0);

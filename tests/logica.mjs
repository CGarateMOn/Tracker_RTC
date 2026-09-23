/* ---------------------------------------------------------------------
   Lógica pura: normalización de la hoja, fechas y plazos, colores de
   marca, claves de oferta, la puerta de entrada (gate) y el filtrado.
--------------------------------------------------------------------- */
import {montar,eq,cierto,resumen,dia as d} from './entorno.mjs';
let malos=0;
const HOY=d(0);

/* ============ 1. norm() ============ */
{
  const {api}=montar();
  const n=api.norm;
  eq(n({'Tipo de Oferta':'Evento'}).tipo,'Evento','tipo: Evento');
  eq(n({'Tipo de Oferta':'Eventos'}).tipo,'Evento','tipo: Eventos');
  eq(n({'Tipo de Oferta':'Workshop'}).tipo,'Evento','tipo: Workshop');
  eq(n({'Tipo de Oferta':'Open day'}).tipo,'Evento','tipo: Open day');
  eq(n({'Tipo de Oferta':'Networking'}).tipo,'Evento','tipo: Networking');
  eq(n({'Tipo de Oferta':'Prácticas'}).tipo,'Prácticas','tipo: Prácticas');
  eq(n({'Tipo de Oferta':'Internship'}).tipo,'Prácticas','tipo: Internship');
  eq(n({'Tipo de Oferta':'Tiempo completo'}).tipo,'Contrato laboral','tipo: Tiempo completo');
  eq(n({'Tipo de Oferta':'Full time'}).tipo,'Contrato laboral','tipo: Full time');
  eq(n({'Tipo de Oferta':''}).tipo,'','tipo: vacío se queda vacío');
  eq(n({'Tipo de Oferta':'Otra cosa'}).tipo,'Otra cosa','tipo: desconocido se respeta');

  /* formato de evento */
  for(const [dato,esperado] of [['On-line','Online'],['on line','Online'],['ONLINE','Online'],['Virtual','Online'],
      ['En persona','Presencial'],['en-persona','Presencial'],['In person','Presencial'],['Presencial','Presencial'],
      ['Híbrido','Híbrido'],['hibrido','Híbrido'],['Mixto','Híbrido'],['',''],['Otra','Otra']])
    eq(n({'Tipo de Oferta':'Evento',Modalidad:dato}).modalidad,esperado,`formato evento: "${dato}"`);
  /* la modalidad de las OFERTAS no se toca */
  eq(n({'Tipo de Oferta':'Prácticas',Modalidad:'Off-cycle'}).modalidad,'Off-cycle','modalidad de oferta intacta');
  eq(n({'Tipo de Oferta':'Prácticas',Modalidad:'On-line'}).modalidad,'On-line','oferta con "On-line" NO se normaliza');

  /* estado */
  for(const [dato,esperado] of [['Cerrada','Cerrada'],['cerrado','Cerrada'],['Abierta','Abierta'],['En curso','Abierta'],
      ['Próximamente','Próximamente'],['proximamente','Próximamente'],['No iniciado','Próximamente'],['',''],])
    eq(n({Estado:dato}).estado,esperado,`estado: "${dato}"`);

  /* campos ausentes, nulos y con espacios */
  const vacio=n({});
  eq(vacio,{id:'',empresa:'',descripcion:'',tipo:'',estado:'',ciudad:'',ciudades:[],link:'',deadline:'',
            practica:'',modalidad:'',curso:'',tipoPlazo:'',alta:''},'fila vacía no revienta');
  eq(n({Empresa:null,'Descripción':undefined,Ciudad:'  '}).ciudades,[],'nulos y espacios → vacío');
  eq(n({Ciudad:'Madrid Barcelona  Bilbao'}).ciudades,['Madrid','Barcelona','Bilbao'],'ciudades múltiples');
  /* acepta claves ya normalizadas (contrato documentado de norm) */
  eq(n({tipo:'Evento',modalidad:'On-line',empresa:'X'}).modalidad,'Online','acepta claves ya normalizadas');
  malos+=resumen('norm()');
}

/* ============ 2. fechas, estadoReal, plazo, clase ============ */
{
  const {api}=montar();
  eq(api.fechaDeadline({deadline:''}),null,'deadline vacío → null');
  eq(api.fechaDeadline({deadline:'no-fecha'}),null,'deadline basura → null');
  eq(api.dias({deadline:HOY}),0,'deadline hoy → 0 días');
  eq(api.dias({deadline:d(1)}),1,'mañana → 1');
  eq(api.dias({deadline:d(-1)}),-1,'ayer → -1');
  /* ISO con Z no debe desplazar el día (bug clásico de UTC) */
  eq(api.dias({deadline:HOY+'T22:00:00.000Z'}),1,'ISO 22:00Z → día siguiente en hora local (CEST, documentado)');
  eq(api.dias({deadline:HOY+'T08:00:00.000Z'}),0,'ISO 08:00Z → mismo día');

  eq(api.estadoReal({estado:'Abierta',deadline:d(-1)}),'Cerrada','abierta con deadline pasado → Cerrada');
  eq(api.estadoReal({estado:'Próximamente',deadline:d(-1)}),'Próximamente','próximamente gana al deadline pasado');
  eq(api.estadoReal({estado:'Cerrada',deadline:d(99)}),'Cerrada','cerrada en hoja manda');
  eq(api.estadoReal({estado:'Abierta',deadline:''}),'Abierta','sin deadline → se respeta');

  const p=(o)=>api.plazo({tipo:'',estado:'Abierta',tipoPlazo:'',deadline:'',...o});
  eq(p({estado:'Próximamente'}).nivel,'preview','oferta: preview');
  eq(p({estado:'Cerrada'}).nivel,'cerrada','oferta: cerrada');
  eq(p({tipoPlazo:'Rolling'}).nivel,'rolling','oferta: rolling');
  eq(p({tipoPlazo:'Sin publicar'}).nivel,'sinfecha','oferta: sin publicar');
  eq(p({deadline:HOY}).txt,'Cierra hoy','oferta: cierra hoy');
  eq(p({deadline:d(1)}).txt,'Cierra mañana','oferta: cierra mañana');
  eq(p({deadline:d(3)}).nivel,'critico','oferta: 3 días = crítico');
  eq(p({deadline:d(4)}).nivel,'proximo','oferta: 4 días = próximo');
  eq(p({deadline:d(14)}).nivel,'proximo','oferta: 14 días = próximo');
  eq(p({deadline:d(15)}).nivel,'lejano','oferta: 15 días = lejano');

  const e=(o)=>api.plazo({tipo:'Evento',estado:'Abierta',tipoPlazo:'',deadline:'',...o});
  eq(e({deadline:HOY}).txt,'Es hoy','evento: es hoy');
  eq(e({deadline:d(1)}).txt,'Es mañana','evento: es mañana');
  eq(e({deadline:d(3)}),{txt:'En 3 días',nivel:'critico'},'evento: 3 días');
  eq(e({deadline:d(4)}).nivel,'proximo','evento: 4 días');
  eq(e({deadline:d(14)}).nivel,'proximo','evento: 14 días');
  eq(e({deadline:d(15)}).nivel,'lejano','evento: 15 días');
  eq(e({deadline:d(-1)}),{txt:'Ya se celebró',nivel:'cerrada'},'evento pasado');
  eq(e({estado:'Próximamente'}),{txt:'Inscripción pronto',nivel:'preview'},'evento próximamente');
  eq(e({}),{txt:'Sin fecha',nivel:'sinfecha'},'evento sin fecha');
  /* el "Rolling"/"Sin publicar" de las ofertas NO debe filtrarse a los eventos */
  eq(e({tipoPlazo:'Rolling',deadline:d(5)}).txt,'En 5 días','evento ignora tipoPlazo Rolling');
  eq(e({tipoPlazo:'Sin publicar',deadline:d(5)}).txt,'En 5 días','evento ignora tipoPlazo Sin publicar');

  eq(api.clase({estado:'Cerrada',deadline:''}),'is-shut','clase cerrada');
  eq(api.clase({estado:'Próximamente',deadline:''}),'is-soon','clase próximamente');
  eq(api.clase({estado:'Abierta',deadline:d(7)}),'is-urgent','clase urgente (7 días)');
  eq(api.clase({estado:'Abierta',deadline:d(8)}),'is-open','clase abierta (8 días)');
  malos+=resumen('fechas / estado / plazo / clase');
}

/* ============ 3. colores de marca y clave de oferta ============ */
{
  const {api}=montar();
  const c=api.colorMarca;
  eq(c('McKinsey & Company'),'#2251FF','McKinsey');
  eq(c('QuantumBlack'),'#2251FF','QuantumBlack hereda McKinsey');
  eq(c('Monitor Deloitte'),'#86BC25','Monitor Deloitte hereda Deloitte');
  eq(c('EY-Parthenon'),'#FFE600','EY-Parthenon hereda EY');
  eq(c('Strategy&'),'#D04A02','Strategy& hereda PwC');
  eq(c('Road to Consulting'),'#004E54','RTC');
  eq(c('RTC'),'#004E54','RTC (siglas)');
  cierto(c('Kearney')!==c('EY'),'"ey" NO coincide con Kearn-ey');
  cierto(c('McKinsey & Company')!==c('EY'),'"ey" NO coincide con McKins-ey');
  eq(c('Empresa Inventada SL'),c('Empresa Inventada SL'),'marca no listada: color estable');
  cierto(/^hsl\(/.test(c('Empresa Inventada SL')),'marca no listada: HSL de reserva');

  const k=api.claveOferta;
  eq(k({id:'RTC-1'}),'id:RTC-1','clave por ID');
  cierto(k({id:'',empresa:'A',descripcion:'B',ciudad:'C',alta:''})!==k({id:'',empresa:'A',descripcion:'D',ciudad:'C',alta:''}),
    'sin ID: descripciones distintas → claves distintas');
  cierto(k({id:'RTC-0106'})!==k({id:'RTC-0107'}),'dos eventos del mismo sitio → claves distintas');
  malos+=resumen('colores y claves');
}

/* ============ 4. pasaGate ============ */
{
  const {api}=montar();
  const tipos=['Prácticas','Contrato laboral','Evento',''];
  const esperado={practicas:[1,0,0,1],full:[0,1,0,1],eventos:[0,0,1,0],ambas:[1,1,1,1]};
  for(const [g,exp] of Object.entries(esperado)){
    api.S.gate=g;
    eq(tipos.map(t=>api.pasaGate({tipo:t})?1:0),exp,`gate "${g}" sobre [prácticas, contrato, evento, sin tipo]`);
  }
  malos+=resumen('pasaGate()');
}

/* ============ 5. pasa() / cuenta() / ordenar() ============ */
{
  const {api}=montar();
  const base={id:'',empresa:'A',descripcion:'x',tipo:'Prácticas',estado:'Abierta',ciudad:'Madrid',ciudades:['Madrid'],
    link:'',deadline:d(10),practica:'Estrategia',modalidad:'Summer',curso:'Todos',tipoPlazo:'Fecha fija',alta:''};
  const of=(o={})=>({...base,...o});
  api.TODAS=[of({id:'1'}),of({id:'2',practica:'Tecnología y AI'}),of({id:'3',ciudad:'Bilbao',ciudades:['Bilbao']}),
             of({id:'4',estado:'Cerrada'}),of({id:'5',tipo:'Evento',modalidad:'Online',deadline:d(5)})];
  api.S.gate='ambas'; api.S.estado=new Set(['Abierta','Próximamente']);
  ['practica','modalidad','ciudad','empresa','plazo','curso','seg'].forEach(k=>api.S[k].clear());
  api.S.q=''; api.S.soloFav=false;

  eq(api.resultados().map(o=>o.id),['1','2','3','5'],'por defecto oculta la cerrada');
  api.S.practica=new Set(['Estrategia']);
  eq(api.resultados().map(o=>o.id),['1','3','5'],'filtro de sector');
  eq(api.cuenta('practica','practica','Tecnología y AI'),1,'cuenta() ignora su propio filtro (skip-self)');
  eq(api.cuenta('ciudad','ciudades','Bilbao'),1,'cuenta() por array de ciudades');
  api.S.practica.clear();

  api.S.ciudad=new Set(['Madrid']);
  eq(api.resultados().map(o=>o.id),['1','2','5'],'filtro de ciudad excluye al que no la tiene (3 es Bilbao)');
  api.S.ciudad.clear();

  api.S.q='tecnolog';
  eq(api.resultados().length,0,'búsqueda sobre empresa/descripción/ciudad, no sobre sector');
  api.S.q='madrid';
  eq(api.resultados().map(o=>o.id),['1','2','5'],'búsqueda por ciudad');
  api.S.q='';

  api.FAV.add('id:2');
  api.S.soloFav=true;
  eq(api.resultados().map(o=>o.id),['2'],'solo guardadas');
  api.S.soloFav=false; api.FAV.clear();

  api.SEG['id:1']='aplicada';
  api.S.seg=new Set(['aplicada']);
  eq(api.resultados().map(o=>o.id),['1'],'filtro de seguimiento');
  api.S.seg.clear(); delete api.SEG['id:1'];

  /* campo vacío nunca excluye (comportamiento histórico) */
  api.TODAS.push(of({id:'6',practica:''}));
  api.S.practica=new Set(['Estrategia']);
  cierto(api.resultados().some(o=>o.id==='6'),'campo vacío no se excluye del filtro');
  api.S.practica.clear(); api.TODAS.pop();

  /* orden */
  api.S.orden='empresa';
  api.S.gate='eventos';
  api.TODAS=[of({id:'e1',tipo:'Evento',empresa:'Zeta',deadline:d(30)}),of({id:'e2',tipo:'Evento',empresa:'Alfa',deadline:d(2)})];
  eq(api.ordenar(api.resultados()).map(o=>o.id),['e2','e1'],'eventos: siempre por fecha aunque S.orden sea "empresa"');
  api.S.gate='ambas';
  api.TODAS=[of({id:'a',empresa:'Zeta'}),of({id:'b',empresa:'Alfa'})];
  eq(api.ordenar(api.resultados()).map(o=>o.id),['b','a'],'ofertas: respeta orden por empresa');
  api.S.orden='plazo';
  api.TODAS=[of({id:'a',deadline:''}),of({id:'b',deadline:d(3)})];
  eq(api.ordenar(api.resultados()).map(o=>o.id),['b','a'],'orden por plazo: sin fecha al final');
  malos+=resumen('filtrado, conteo y orden');
}
process.exit(malos?1:0);
